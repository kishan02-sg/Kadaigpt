"""
KadaiGPT - AI Agent Base Framework
Core classes and interfaces for autonomous AI agents
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import asyncio
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("KadaiGPT.Agent")


class AgentStatus(Enum):
    IDLE = "idle"
    THINKING = "thinking"
    EXECUTING = "executing"
    WAITING_APPROVAL = "waiting_approval"
    COMPLETED = "completed"
    ERROR = "error"


class ActionType(Enum):
    QUERY = "query"          # Read-only action
    MUTATION = "mutation"    # Changes data
    NOTIFICATION = "notification"  # Sends message
    APPROVAL_REQUIRED = "approval_required"  # Needs human approval


@dataclass
class AgentTool:
    """Represents a tool/capability available to an agent"""
    name: str
    description: str
    parameters: Dict[str, Any]
    action_type: ActionType
    handler: Callable
    requires_approval: bool = False

    def to_dict(self) -> Dict:
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
            "action_type": self.action_type.value,
            "requires_approval": self.requires_approval
        }


@dataclass
class AgentAction:
    """Represents an action taken by an agent"""
    tool_name: str
    parameters: Dict[str, Any]
    reasoning: str
    timestamp: datetime = field(default_factory=datetime.now)
    result: Optional[Any] = None
    status: str = "pending"
    error: Optional[str] = None


@dataclass
class AgentMemory:
    """Short-term and long-term memory for agents"""
    short_term: List[Dict] = field(default_factory=list)  # Current conversation
    long_term: List[Dict] = field(default_factory=list)   # Persistent knowledge
    context: Dict[str, Any] = field(default_factory=dict)  # Current context

    def add_to_short_term(self, item: Dict):
        self.short_term.append({
            **item,
            "timestamp": datetime.now().isoformat()
        })
        # Keep only last 20 items in short-term
        if len(self.short_term) > 20:
            self.short_term = self.short_term[-20:]

    def add_to_long_term(self, item: Dict):
        self.long_term.append({
            **item,
            "timestamp": datetime.now().isoformat()
        })

    def get_context_str(self) -> str:
        """Get formatted context for LLM"""
        recent = self.short_term[-5:] if self.short_term else []
        return json.dumps({
            "recent_interactions": recent,
            "context": self.context
        }, default=str)


@dataclass
class AgentGoal:
    """Represents a goal/task for an agent"""
    id: str
    description: str
    priority: int = 1  # 1 = highest
    deadline: Optional[datetime] = None
    sub_goals: List['AgentGoal'] = field(default_factory=list)
    completed: bool = False
    result: Optional[Any] = None


class BaseAgent(ABC):
    """
    Base class for all AI Agents in KadaiGPT
    
    An agent is an autonomous entity that can:
    1. Receive goals/tasks
    2. Break them down into steps
    3. Use tools to accomplish steps
    4. Make decisions
    5. Learn from outcomes
    """
    
    def __init__(
        self,
        name: str,
        description: str,
        store_id: int,
        llm_client: Any = None
    ):
        self.name = name
        self.description = description
        self.store_id = store_id
        self.llm_client = llm_client
        self.status = AgentStatus.IDLE
        self.tools: Dict[str, AgentTool] = {}
        self.memory = AgentMemory()
        self.action_history: List[AgentAction] = []
        self.current_goal: Optional[AgentGoal] = None
        self.running = False
        
        # Register default tools
        self._register_default_tools()
    
    @abstractmethod
    def _register_default_tools(self):
        """Register agent-specific tools. Override in subclasses."""
        pass
    
    @abstractmethod
    async def think(self, input_data: Dict) -> Dict:
        """
        Core reasoning method. Given input, decide what to do.
        Returns: {"action": "tool_name", "parameters": {...}, "reasoning": "..."}
        """
        pass
    
    def register_tool(self, tool: AgentTool):
        """Register a new tool for this agent"""
        self.tools[tool.name] = tool
        logger.info(f"[{self.name}] Registered tool: {tool.name}")
    
    async def execute_tool(self, tool_name: str, parameters: Dict) -> Any:
        """Execute a registered tool"""
        if tool_name not in self.tools:
            raise ValueError(f"Unknown tool: {tool_name}")
        
        tool = self.tools[tool_name]
        
        # Check if approval required
        if tool.requires_approval:
            self.status = AgentStatus.WAITING_APPROVAL
            # In real implementation, would wait for human approval
            logger.info(f"[{self.name}] Waiting for approval: {tool_name}")
        
        self.status = AgentStatus.EXECUTING
        
        try:
            if asyncio.iscoroutinefunction(tool.handler):
                result = await tool.handler(**parameters)
            else:
                result = tool.handler(**parameters)
            
            # Record action
            action = AgentAction(
                tool_name=tool_name,
                parameters=parameters,
                reasoning="",
                result=result,
                status="completed"
            )
            self.action_history.append(action)
            
            return result
        except Exception as e:
            logger.error(f"[{self.name}] Tool execution failed: {e}")
            action = AgentAction(
                tool_name=tool_name,
                parameters=parameters,
                reasoning="",
                status="failed",
                error=str(e)
            )
            self.action_history.append(action)
            raise
        finally:
            self.status = AgentStatus.IDLE
    
    async def run(self, goal: AgentGoal):
        """
        Main agent loop - work towards completing a goal
        """
        self.current_goal = goal
        self.running = True
        self.status = AgentStatus.THINKING
        
        logger.info(f"[{self.name}] Starting goal: {goal.description}")
        
        try:
            while self.running and not goal.completed:
                # Think about what to do next
                decision = await self.think({
                    "goal": goal.description,
                    "context": self.memory.get_context_str(),
                    "available_tools": [t.to_dict() for t in self.tools.values()]
                })
                
                if decision.get("action") == "goal_complete":
                    goal.completed = True
                    goal.result = decision.get("result")
                    break
                
                # Execute the decided action
                tool_name = decision.get("action")
                parameters = decision.get("parameters", {})
                
                if tool_name:
                    result = await self.execute_tool(tool_name, parameters)
                    
                    # Add to memory
                    self.memory.add_to_short_term({
                        "action": tool_name,
                        "parameters": parameters,
                        "result": str(result)[:500]  # Truncate for memory
                    })
                
                # Small delay to prevent infinite loops
                await asyncio.sleep(0.1)
        
        except Exception as e:
            self.status = AgentStatus.ERROR
            logger.error(f"[{self.name}] Error during goal execution: {e}")
            raise
        finally:
            self.running = False
            self.status = AgentStatus.COMPLETED
        
        return goal.result
    
    def stop(self):
        """Stop the agent"""
        self.running = False
        logger.info(f"[{self.name}] Stopping...")
    
    def get_status(self) -> Dict:
        """Get current agent status"""
        return {
            "name": self.name,
            "status": self.status.value,
            "current_goal": self.current_goal.description if self.current_goal else None,
            "tools_count": len(self.tools),
            "actions_taken": len(self.action_history)
        }


class AgentOrchestrator:
    """
    Manages multiple agents and coordinates their work
    """
    
    def __init__(self, store_id: int):
        self.store_id = store_id
        self.agents: Dict[str, BaseAgent] = {}
        self.active_goals: List[AgentGoal] = []
    
    def register_agent(self, agent: BaseAgent):
        """Register an agent with the orchestrator"""
        self.agents[agent.name] = agent
        logger.info(f"[Orchestrator] Registered agent: {agent.name}")
    
    def get_agent(self, name: str) -> Optional[BaseAgent]:
        """Get an agent by name"""
        return self.agents.get(name)
    
    async def delegate_goal(self, agent_name: str, goal: AgentGoal) -> Any:
        """Delegate a goal to a specific agent"""
        agent = self.get_agent(agent_name)
        if not agent:
            raise ValueError(f"Unknown agent: {agent_name}")
        
        self.active_goals.append(goal)
        result = await agent.run(goal)
        self.active_goals.remove(goal)
        
        return result
    
    async def broadcast_event(self, event_type: str, data: Dict):
        """Broadcast an event to all agents"""
        for agent in self.agents.values():
            agent.memory.add_to_short_term({
                "type": "broadcast",
                "event": event_type,
                "data": data
            })
    
    def get_all_statuses(self) -> List[Dict]:
        """Get status of all agents"""
        return [agent.get_status() for agent in self.agents.values()]
