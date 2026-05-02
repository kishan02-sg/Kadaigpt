"""
KadaiGPT - Advanced AI Agents API Router
Full API for autonomous AI agent ecosystem
"""

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks
from pydantic import BaseModel
from typing import Dict, List, Any, Optional
from datetime import datetime
import asyncio
import json

from ..agents.core.base_agent import AgentOrchestrator, AgentGoal
from ..agents.core.store_manager_agent import StoreManagerAgent
from ..agents.core.inventory_agent import InventoryAgent
from ..agents.core.customer_agent import CustomerEngagementAgent, CustomerMessage
from ..agents.core.analytics_agent import AnalyticsAgent
from ..agents.core.voice_agent import VoiceAIAgent
from ..agents.core.learning_agent import LearningAgent
from ..agents.core.workflow_engine import WorkflowEngine

router = APIRouter(prefix="/agents", tags=["AI Agents"])

# Store agent instances (in production, would use dependency injection + Redis)
agent_instances: Dict[int, Dict] = {}


# ==================== Request/Response Models ====================

class AgentQueryRequest(BaseModel):
    """Request to query an agent"""
    message: str
    agent_type: str = "store_manager"
    context: Optional[Dict] = None


class AgentQueryResponse(BaseModel):
    """Response from agent query"""
    success: bool
    agent: str
    response: Any
    actions_taken: int
    processing_time_ms: int


class VoiceCommandRequest(BaseModel):
    """Voice command request"""
    text: str
    language: str = "en"


class FeedbackRequest(BaseModel):
    """Feedback on agent action"""
    action_id: str
    rating: int
    helpful: bool
    comment: Optional[str] = None


class CorrectionRequest(BaseModel):
    """Correction for agent learning"""
    original: str
    correction: str
    context: Optional[str] = None


class WorkflowExecuteRequest(BaseModel):
    """Request to execute a workflow"""
    workflow_id: str
    context: Optional[Dict] = None


class WhatIfRequest(BaseModel):
    """What-if scenario analysis request"""
    scenario: str


class BulkCampaignRequest(BaseModel):
    """Bulk campaign request"""
    campaign_type: str
    customer_phones: List[str]


class WhatsAppIncomingMessage(BaseModel):
    """Incoming WhatsApp message"""
    phone: str
    message: str
    message_type: str = "text"
    timestamp: Optional[datetime] = None


# ==================== Helper Functions ====================

def get_store_agents(store_id: int) -> Dict:
    """Get or create all agents for a store"""
    if store_id not in agent_instances:
        store_name = "KadaiGPT Store"
        
        # Create all agents
        agents = {
            "orchestrator": AgentOrchestrator(store_id),
            "store_manager": StoreManagerAgent(store_id, store_name),
            "inventory": InventoryAgent(store_id),
            "customer": CustomerEngagementAgent(store_id, store_name),
            "analytics": AnalyticsAgent(store_id),
            "voice": VoiceAIAgent(store_id),
            "learning": LearningAgent(store_id),
            "workflow": WorkflowEngine(store_id)
        }
        
        # Register agents with orchestrator
        orchestrator = agents["orchestrator"]
        orchestrator.register_agent(agents["store_manager"])
        orchestrator.register_agent(agents["inventory"])
        orchestrator.register_agent(agents["customer"])
        orchestrator.register_agent(agents["analytics"])
        orchestrator.register_agent(agents["voice"])
        orchestrator.register_agent(agents["learning"])
        
        agent_instances[store_id] = agents
    
    return agent_instances[store_id]


# ==================== Core Agent Endpoints ====================

@router.post("/query", response_model=AgentQueryResponse)
async def query_agent(request: AgentQueryRequest, store_id: int = 1):
    """
    Send a natural language query to any AI agent.
    Available agents: store_manager, inventory, customer, analytics, voice
    """
    start_time = datetime.now()
    
    try:
        agents = get_store_agents(store_id)
        
        agent_map = {
            "store_manager": agents["store_manager"],
            "inventory": agents["inventory"],
            "customer": agents["customer"],
            "analytics": agents["analytics"],
            "voice": agents["voice"],
            "learning": agents["learning"]
        }
        
        agent = agent_map.get(request.agent_type)
        if not agent:
            raise HTTPException(status_code=404, detail=f"Agent '{request.agent_type}' not found")
        
        goal = AgentGoal(
            id=f"query_{datetime.now().timestamp()}",
            description=request.message,
            priority=1
        )
        
        if request.context:
            agent.memory.context.update(request.context)
        
        result = await agent.run(goal)
        
        # Record for learning
        await agents["learning"].process_interaction({
            "action_type": "query",
            "agent": request.agent_type,
            "query": request.message
        })
        
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        
        return AgentQueryResponse(
            success=True,
            agent=request.agent_type,
            response=result,
            actions_taken=len(agent.action_history),
            processing_time_ms=int(processing_time)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_all_agents_status(store_id: int = 1):
    """Get status of all AI agents"""
    agents = get_store_agents(store_id)
    
    statuses = {}
    for name, agent in agents.items():
        if hasattr(agent, 'get_status'):
            statuses[name] = agent.get_status()
        elif name == "workflow":
            statuses[name] = {
                "name": "WorkflowEngine",
                "workflows_count": len(agent.workflows),
                "active_events": len(agent.event_handlers)
            }
    
    return {
        "store_id": store_id,
        "agents": statuses,
        "agent_count": len(statuses),
        "timestamp": datetime.now().isoformat()
    }


@router.get("/suggestions")
async def get_proactive_suggestions(store_id: int = 1):
    """Get proactive suggestions from Store Manager"""
    agents = get_store_agents(store_id)
    store_manager = agents["store_manager"]
    
    suggestions = await store_manager.get_proactive_suggestions()
    
    return {
        "suggestions": suggestions,
        "count": len(suggestions),
        "timestamp": datetime.now()
    }


# ==================== Voice Agent Endpoints ====================

@router.post("/voice/command")
async def process_voice_command(request: VoiceCommandRequest, store_id: int = 1):
    """Process a voice command (transcribed text)"""
    agents = get_store_agents(store_id)
    voice_agent = agents["voice"]
    
    result = await voice_agent.process_voice_input(request.text, request.language)
    
    return result


@router.get("/voice/languages")
async def get_supported_languages(store_id: int = 1):
    """Get supported languages for voice interface"""
    agents = get_store_agents(store_id)
    voice_agent = agents["voice"]
    
    return {
        "languages": voice_agent.supported_languages,
        "default": "en"
    }


# ==================== Analytics Agent Endpoints ====================

@router.get("/analytics/forecast")
async def get_sales_forecast(days_ahead: int = 7, store_id: int = 1):
    """Get AI-powered sales forecast"""
    agents = get_store_agents(store_id)
    analytics = agents["analytics"]
    
    forecast = await analytics._forecast_sales(days_ahead)
    return forecast


@router.get("/analytics/trends")
async def analyze_trends(metric: str = "sales", period: str = "month", store_id: int = 1):
    """Analyze sales and business trends"""
    agents = get_store_agents(store_id)
    analytics = agents["analytics"]
    
    trends = await analytics._analyze_trends(metric, period)
    return trends


@router.get("/analytics/anomalies")
async def detect_anomalies(sensitivity: str = "medium", store_id: int = 1):
    """Detect unusual patterns and anomalies"""
    agents = get_store_agents(store_id)
    analytics = agents["analytics"]
    
    anomalies = await analytics._detect_anomalies(sensitivity)
    return anomalies


@router.get("/analytics/insights")
async def get_ai_insights(store_id: int = 1):
    """Get AI-generated business insights"""
    agents = get_store_agents(store_id)
    analytics = agents["analytics"]
    
    insights = await analytics._generate_insights()
    return insights


@router.get("/analytics/customers/segments")
async def get_customer_segments(store_id: int = 1):
    """Get customer segmentation analysis"""
    agents = get_store_agents(store_id)
    analytics = agents["analytics"]
    
    segments = await analytics._segment_customers()
    return segments


@router.post("/analytics/what-if")
async def analyze_what_if_scenario(request: WhatIfRequest, store_id: int = 1):
    """Analyze what-if scenarios"""
    agents = get_store_agents(store_id)
    analytics = agents["analytics"]
    
    analysis = await analytics._what_if_analysis(request.scenario)
    return analysis


@router.get("/analytics/peak-hours")
async def get_peak_hour_analysis(store_id: int = 1):
    """Get peak hour analysis and staffing recommendations"""
    agents = get_store_agents(store_id)
    analytics = agents["analytics"]
    
    analysis = await analytics._peak_hour_analysis()
    return analysis


# ==================== Inventory Agent Endpoints ====================

@router.get("/inventory/analysis")
async def get_inventory_analysis(store_id: int = 1):
    """Get comprehensive inventory analysis"""
    agents = get_store_agents(store_id)
    inventory = agents["inventory"]
    
    analysis = await inventory.run_daily_analysis()
    return analysis


@router.get("/inventory/predictions")
async def get_demand_predictions(days_ahead: int = 7, store_id: int = 1):
    """Get demand predictions for products"""
    agents = get_store_agents(store_id)
    inventory = agents["inventory"]
    
    predictions = await inventory._predict_stock_needs(days_ahead)
    return predictions


@router.get("/inventory/reorder")
async def get_reorder_suggestions(store_id: int = 1):
    """Get optimized reorder list"""
    agents = get_store_agents(store_id)
    inventory = agents["inventory"]
    
    reorder = await inventory._generate_reorder_list()
    return reorder


@router.get("/inventory/slow-movers")
async def get_slow_movers(days: int = 30, store_id: int = 1):
    """Identify slow-moving inventory"""
    agents = get_store_agents(store_id)
    inventory = agents["inventory"]
    
    slow_movers = await inventory._identify_slow_movers(days)
    return slow_movers


@router.get("/inventory/price-optimization")
async def get_price_optimization(store_id: int = 1):
    """Get AI price optimization suggestions"""
    agents = get_store_agents(store_id)
    inventory = agents["inventory"]
    
    suggestions = await inventory._suggest_price_optimization()
    return suggestions


# ==================== Customer Agent Endpoints ====================

@router.post("/customer/whatsapp/incoming")
async def handle_whatsapp_message(message: WhatsAppIncomingMessage, store_id: int = 1):
    """Handle incoming WhatsApp message"""
    agents = get_store_agents(store_id)
    customer = agents["customer"]
    
    msg = CustomerMessage(
        phone=message.phone,
        message=message.message,
        timestamp=message.timestamp or datetime.now(),
        message_type=message.message_type
    )
    
    response = await customer.process_incoming_message(msg)
    return response


@router.post("/customer/campaign")
async def send_campaign(request: BulkCampaignRequest, store_id: int = 1):
    """Send bulk marketing campaign"""
    agents = get_store_agents(store_id)
    customer = agents["customer"]
    
    customers = [{"phone": phone} for phone in request.customer_phones]
    results = await customer.send_bulk_campaign(request.campaign_type, customers)
    return results


@router.get("/customer/engagement-stats")
async def get_engagement_stats(store_id: int = 1):
    """Get customer engagement analytics"""
    agents = get_store_agents(store_id)
    customer = agents["customer"]
    
    stats = await customer.get_engagement_analytics()
    return stats


# ==================== Learning Agent Endpoints ====================

@router.post("/learning/feedback")
async def submit_feedback(request: FeedbackRequest, store_id: int = 1):
    """Submit feedback on agent action"""
    agents = get_store_agents(store_id)
    learning = agents["learning"]
    
    result = await learning._record_feedback(
        request.action_id,
        request.rating,
        request.helpful,
        request.comment
    )
    return result


@router.post("/learning/correction")
async def submit_correction(request: CorrectionRequest, store_id: int = 1):
    """Submit correction for agent to learn"""
    agents = get_store_agents(store_id)
    learning = agents["learning"]
    
    result = await learning._learn_correction(
        request.original,
        request.correction,
        request.context
    )
    return result


@router.get("/learning/stats")
async def get_learning_stats(store_id: int = 1):
    """Get learning statistics"""
    agents = get_store_agents(store_id)
    learning = agents["learning"]
    
    stats = await learning._get_learning_stats()
    return stats


@router.get("/learning/patterns")
async def get_learned_patterns(store_id: int = 1):
    """Get behavior patterns learned by the agent"""
    agents = get_store_agents(store_id)
    learning = agents["learning"]
    
    patterns = await learning._analyze_behavior_patterns()
    return patterns


@router.get("/learning/personalized")
async def get_personalized_suggestions(store_id: int = 1):
    """Get personalized suggestions based on learned preferences"""
    agents = get_store_agents(store_id)
    learning = agents["learning"]
    
    suggestions = await learning._get_personalized_suggestion()
    return suggestions


# ==================== Workflow Endpoints ====================

@router.get("/workflows")
async def list_workflows(store_id: int = 1):
    """List all registered workflows"""
    agents = get_store_agents(store_id)
    workflow_engine = agents["workflow"]
    
    workflows = workflow_engine.get_all_workflows()
    return {
        "workflows": workflows,
        "count": len(workflows)
    }


@router.post("/workflows/execute")
async def execute_workflow(request: WorkflowExecuteRequest, store_id: int = 1):
    """Execute a workflow manually"""
    agents = get_store_agents(store_id)
    workflow_engine = agents["workflow"]
    
    result = await workflow_engine.execute_workflow(
        request.workflow_id,
        request.context
    )
    return result


@router.post("/workflows/{workflow_id}/toggle")
async def toggle_workflow(workflow_id: str, enabled: bool, store_id: int = 1):
    """Enable or disable a workflow"""
    agents = get_store_agents(store_id)
    workflow_engine = agents["workflow"]
    
    success = workflow_engine.toggle_workflow(workflow_id, enabled)
    
    if success:
        return {"status": "success", "workflow_id": workflow_id, "enabled": enabled}
    else:
        raise HTTPException(status_code=404, detail="Workflow not found")


@router.post("/workflows/trigger-event")
async def trigger_workflow_event(event: str, data: Dict = None, store_id: int = 1):
    """Trigger an event to execute matching workflows"""
    agents = get_store_agents(store_id)
    workflow_engine = agents["workflow"]
    
    results = await workflow_engine.trigger_event(event, data or {})
    return {
        "event": event,
        "workflows_triggered": len(results),
        "results": results
    }


# ==================== Multi-Agent Orchestration ====================

@router.post("/orchestrate")
async def orchestrate_multi_agent_task(request: AgentQueryRequest, store_id: int = 1):
    """
    Orchestrate a complex task across multiple agents.
    The Store Manager will coordinate other agents as needed.
    """
    start_time = datetime.now()
    agents = get_store_agents(store_id)
    
    store_manager = agents["store_manager"]
    
    # Process through store manager (it will delegate to others)
    result = await store_manager.process_natural_language(request.message)
    
    processing_time = (datetime.now() - start_time).total_seconds() * 1000
    
    return {
        "success": True,
        "orchestrator": "StoreManager",
        "result": result,
        "processing_time_ms": int(processing_time),
        "timestamp": datetime.now().isoformat()
    }


# ==================== WebSocket for Real-time Updates ====================

class ConnectionManager:
    """Manage WebSocket connections"""
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, store_id: int):
        await websocket.accept()
        if store_id not in self.active_connections:
            self.active_connections[store_id] = []
        self.active_connections[store_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, store_id: int):
        if store_id in self.active_connections:
            self.active_connections[store_id].remove(websocket)
    
    async def broadcast(self, store_id: int, message: Dict):
        if store_id in self.active_connections:
            for connection in self.active_connections[store_id]:
                try:
                    await connection.send_json(message)
                except:
                    pass


manager = ConnectionManager()


@router.websocket("/ws/{store_id}")
async def websocket_endpoint(websocket: WebSocket, store_id: int):
    """WebSocket for real-time agent updates"""
    await manager.connect(websocket, store_id)
    
    try:
        agents = get_store_agents(store_id)
        
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            msg_type = message_data.get("type")
            
            if msg_type == "query":
                agent = agents["store_manager"]
                result = await agent.process_natural_language(message_data.get("message", ""))
                await websocket.send_json({"type": "response", "data": result})
            
            elif msg_type == "voice":
                agent = agents["voice"]
                result = await agent.process_voice_input(
                    message_data.get("text", ""),
                    message_data.get("language", "en")
                )
                await websocket.send_json({"type": "voice_response", "data": result})
            
            elif msg_type == "suggestions":
                agent = agents["store_manager"]
                suggestions = await agent.get_proactive_suggestions()
                await websocket.send_json({"type": "suggestions", "data": suggestions})
            
            elif msg_type == "ping":
                await websocket.send_json({"type": "pong", "timestamp": datetime.now().isoformat()})
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, store_id)
    except Exception as e:
        manager.disconnect(websocket, store_id)
        print(f"WebSocket error: {e}")
