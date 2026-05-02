"""
KadaiGPT - AI Agents Core Package
Autonomous AI agents for store management
"""

from .base_agent import (
    BaseAgent,
    AgentTool,
    AgentGoal,
    AgentAction,
    AgentMemory,
    AgentStatus,
    ActionType,
    AgentOrchestrator
)

from .store_manager_agent import StoreManagerAgent
from .inventory_agent import InventoryAgent
from .customer_agent import CustomerEngagementAgent, CustomerMessage
from .analytics_agent import AnalyticsAgent
from .voice_agent import VoiceAIAgent
from .learning_agent import LearningAgent
from .workflow_engine import WorkflowEngine, Workflow, WorkflowTrigger, WorkflowAction

__all__ = [
    # Base classes
    "BaseAgent",
    "AgentTool",
    "AgentGoal",
    "AgentAction",
    "AgentMemory",
    "AgentStatus",
    "ActionType",
    "AgentOrchestrator",
    
    # Specialized Agents
    "StoreManagerAgent",
    "InventoryAgent",
    "CustomerEngagementAgent",
    "CustomerMessage",
    "AnalyticsAgent",
    "VoiceAIAgent",
    "LearningAgent",
    
    # Workflow Engine
    "WorkflowEngine",
    "Workflow",
    "WorkflowTrigger",
    "WorkflowAction"
]
