"""
KadaiGPT - Advanced AI Agents API Router
Full API for autonomous AI agent ecosystem

All endpoints are authenticated and scoped to the logged-in user's store.
Store Manager / Inventory / Analytics agents run against real store data.
Customer / Voice / Learning / Workflow agents are still demo-only and are
labeled as such (`is_demo: true`) until they are wired to live data.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Any, Optional
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, Store
from app.routers.auth import get_current_active_user

from ..agents.core.base_agent import AgentOrchestrator, AgentGoal
from ..agents.core.store_manager_agent import StoreManagerAgent
from ..agents.core.inventory_agent import InventoryAgent
from ..agents.core.customer_agent import CustomerEngagementAgent, CustomerMessage
from ..agents.core.analytics_agent import AnalyticsAgent
from ..agents.core.voice_agent import VoiceAIAgent
from ..agents.core.learning_agent import LearningAgent
from ..agents.core.workflow_engine import WorkflowEngine

router = APIRouter(prefix="/agents", tags=["AI Agents"])

# Agents that still run on simulated/demo data rather than this store's real records
DEMO_AGENTS = {"customer", "voice", "learning", "workflow"}


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

async def get_store_agents(store_id: int, db: AsyncSession) -> Dict:
    """
    Build a fresh set of AI agent instances scoped to one store.

    Agents are created per-request (not cached globally) because the
    Store Manager / Inventory / Analytics agents hold a reference to the
    request-scoped DB session - caching them across requests would leak
    closed sessions in the serverless environment.
    """
    store_result = await db.execute(select(Store).where(Store.id == store_id))
    store = store_result.scalar_one_or_none()
    store_name = store.name if store else "My Store"

    agents = {
        "orchestrator": AgentOrchestrator(store_id),
        "store_manager": StoreManagerAgent(store_id, store_name, db),
        "inventory": InventoryAgent(store_id, db),
        "customer": CustomerEngagementAgent(store_id, store_name),
        "analytics": AnalyticsAgent(store_id, db),
        "voice": VoiceAIAgent(store_id),
        "learning": LearningAgent(store_id),
        "workflow": WorkflowEngine(store_id)
    }

    orchestrator = agents["orchestrator"]
    orchestrator.register_agent(agents["store_manager"])
    orchestrator.register_agent(agents["inventory"])
    orchestrator.register_agent(agents["customer"])
    orchestrator.register_agent(agents["analytics"])
    orchestrator.register_agent(agents["voice"])
    orchestrator.register_agent(agents["learning"])

    return agents


def _mark_demo(data: Any, agent_name: str) -> Any:
    """Tag responses from agents that still run on simulated data."""
    if agent_name not in DEMO_AGENTS:
        return data
    note = "Demo data - this agent isn't connected to your store's live data yet"
    if isinstance(data, dict):
        return {**data, "is_demo": True, "demo_note": note}
    return {"is_demo": True, "demo_note": note, "result": data}


# ==================== Core Agent Endpoints ====================

@router.post("/query", response_model=AgentQueryResponse)
async def query_agent(
    request: AgentQueryRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Send a natural language query to any AI agent.
    Available agents: store_manager, inventory, customer, analytics, voice, learning
    """
    start_time = datetime.now()

    try:
        agents = await get_store_agents(current_user.store_id, db)

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
            response=_mark_demo(result, request.agent_type),
            actions_taken=len(agent.action_history),
            processing_time_ms=int(processing_time)
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_all_agents_status(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get status of all AI agents for the current store"""
    agents = await get_store_agents(current_user.store_id, db)

    statuses = {}
    for name, agent in agents.items():
        if hasattr(agent, 'get_status'):
            status = agent.get_status()
            status["is_demo"] = name in DEMO_AGENTS
            statuses[name] = status
        elif name == "workflow":
            statuses[name] = {
                "name": "WorkflowEngine",
                "workflows_count": len(agent.workflows),
                "active_events": len(agent.event_handlers),
                "is_demo": True
            }

    return {
        "store_id": current_user.store_id,
        "agents": statuses,
        "agent_count": len(statuses),
        "timestamp": datetime.now().isoformat()
    }


@router.get("/suggestions")
async def get_proactive_suggestions(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get proactive suggestions from the Store Manager based on real store data"""
    agents = await get_store_agents(current_user.store_id, db)
    store_manager = agents["store_manager"]

    suggestions = await store_manager.get_proactive_suggestions()

    return {
        "suggestions": suggestions,
        "count": len(suggestions),
        "timestamp": datetime.now()
    }


# ==================== Voice Agent Endpoints (demo) ====================

@router.post("/voice/command")
async def process_voice_command(
    request: VoiceCommandRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Process a voice command (transcribed text)"""
    agents = await get_store_agents(current_user.store_id, db)
    voice_agent = agents["voice"]

    result = await voice_agent.process_voice_input(request.text, request.language)
    return _mark_demo(result, "voice")


@router.get("/voice/languages")
async def get_supported_languages(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get supported languages for voice interface"""
    agents = await get_store_agents(current_user.store_id, db)
    voice_agent = agents["voice"]

    return {
        "languages": voice_agent.supported_languages,
        "default": "en"
    }


# ==================== Analytics Agent Endpoints ====================

@router.get("/analytics/forecast")
async def get_sales_forecast(
    days_ahead: int = 7,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get AI-powered sales forecast based on this store's sales history"""
    agents = await get_store_agents(current_user.store_id, db)
    return await agents["analytics"]._forecast_sales(days_ahead)


@router.get("/analytics/trends")
async def analyze_trends(
    metric: str = "sales",
    period: str = "month",
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Analyze sales and business trends for this store"""
    agents = await get_store_agents(current_user.store_id, db)
    return await agents["analytics"]._analyze_trends(metric, period)


@router.get("/analytics/anomalies")
async def detect_anomalies(
    sensitivity: str = "medium",
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Detect unusual patterns and anomalies in this store's sales"""
    agents = await get_store_agents(current_user.store_id, db)
    return await agents["analytics"]._detect_anomalies(sensitivity)


@router.get("/analytics/insights")
async def get_ai_insights(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get AI-generated business insights for this store"""
    agents = await get_store_agents(current_user.store_id, db)
    return await agents["analytics"]._generate_insights()


@router.get("/analytics/customers/segments")
async def get_customer_segments(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get customer segmentation analysis for this store"""
    agents = await get_store_agents(current_user.store_id, db)
    return await agents["analytics"]._segment_customers()


@router.post("/analytics/what-if")
async def analyze_what_if_scenario(
    request: WhatIfRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Analyze what-if scenarios against this store's real sales baseline"""
    agents = await get_store_agents(current_user.store_id, db)
    return await agents["analytics"]._what_if_analysis(request.scenario)


@router.get("/analytics/peak-hours")
async def get_peak_hour_analysis(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get peak hour analysis and staffing recommendations for this store"""
    agents = await get_store_agents(current_user.store_id, db)
    return await agents["analytics"]._peak_hour_analysis()


# ==================== Inventory Agent Endpoints ====================

@router.get("/inventory/analysis")
async def get_inventory_analysis(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get comprehensive inventory analysis for this store"""
    agents = await get_store_agents(current_user.store_id, db)
    return await agents["inventory"].run_daily_analysis()


@router.get("/inventory/predictions")
async def get_demand_predictions(
    days_ahead: int = 7,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get demand predictions for this store's products"""
    agents = await get_store_agents(current_user.store_id, db)
    return await agents["inventory"]._predict_stock_needs(days_ahead)


@router.get("/inventory/reorder")
async def get_reorder_suggestions(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get an optimized reorder list based on this store's stock levels"""
    agents = await get_store_agents(current_user.store_id, db)
    return await agents["inventory"]._generate_reorder_list()


@router.get("/inventory/slow-movers")
async def get_slow_movers(
    days: int = 30,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Identify slow-moving inventory for this store"""
    agents = await get_store_agents(current_user.store_id, db)
    return await agents["inventory"]._identify_slow_movers(days)


@router.get("/inventory/price-optimization")
async def get_price_optimization(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get AI price optimization suggestions for this store"""
    agents = await get_store_agents(current_user.store_id, db)
    return await agents["inventory"]._suggest_price_optimization()


# ==================== Customer Agent Endpoints (demo) ====================

@router.post("/customer/whatsapp/incoming")
async def handle_whatsapp_message(
    message: WhatsAppIncomingMessage,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Handle an incoming WhatsApp message (demo customer agent)"""
    agents = await get_store_agents(current_user.store_id, db)
    customer = agents["customer"]

    msg = CustomerMessage(
        phone=message.phone,
        message=message.message,
        timestamp=message.timestamp or datetime.now(),
        message_type=message.message_type
    )

    response = await customer.process_incoming_message(msg)
    return _mark_demo(response, "customer")


@router.post("/customer/campaign")
async def send_campaign(
    request: BulkCampaignRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a bulk marketing campaign (demo customer agent)"""
    agents = await get_store_agents(current_user.store_id, db)
    customer = agents["customer"]

    customers = [{"phone": phone} for phone in request.customer_phones]
    results = await customer.send_bulk_campaign(request.campaign_type, customers)
    return _mark_demo(results, "customer")


@router.get("/customer/engagement-stats")
async def get_engagement_stats(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get customer engagement analytics (demo customer agent)"""
    agents = await get_store_agents(current_user.store_id, db)
    customer = agents["customer"]

    stats = await customer.get_engagement_analytics()
    return _mark_demo(stats, "customer")


# ==================== Learning Agent Endpoints (demo) ====================

@router.post("/learning/feedback")
async def submit_feedback(
    request: FeedbackRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Submit feedback on an agent action (demo learning agent)"""
    agents = await get_store_agents(current_user.store_id, db)
    learning = agents["learning"]

    result = await learning._record_feedback(
        request.action_id,
        request.rating,
        request.helpful,
        request.comment
    )
    return _mark_demo(result, "learning")


@router.post("/learning/correction")
async def submit_correction(
    request: CorrectionRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Submit a correction for the agent to learn from (demo learning agent)"""
    agents = await get_store_agents(current_user.store_id, db)
    learning = agents["learning"]

    result = await learning._learn_correction(
        request.original,
        request.correction,
        request.context
    )
    return _mark_demo(result, "learning")


@router.get("/learning/stats")
async def get_learning_stats(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get learning statistics (demo learning agent)"""
    agents = await get_store_agents(current_user.store_id, db)
    learning = agents["learning"]

    stats = await learning._get_learning_stats()
    return _mark_demo(stats, "learning")


@router.get("/learning/patterns")
async def get_learned_patterns(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get behavior patterns learned by the agent (demo learning agent)"""
    agents = await get_store_agents(current_user.store_id, db)
    learning = agents["learning"]

    patterns = await learning._analyze_behavior_patterns()
    return _mark_demo(patterns, "learning")


@router.get("/learning/personalized")
async def get_personalized_suggestions(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get personalized suggestions based on learned preferences (demo learning agent)"""
    agents = await get_store_agents(current_user.store_id, db)
    learning = agents["learning"]

    suggestions = await learning._get_personalized_suggestion()
    return _mark_demo(suggestions, "learning")


# ==================== Workflow Endpoints (demo) ====================

@router.get("/workflows")
async def list_workflows(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """List all registered workflows (demo workflow engine)"""
    agents = await get_store_agents(current_user.store_id, db)
    workflow_engine = agents["workflow"]

    workflows = workflow_engine.get_all_workflows()
    return _mark_demo({
        "workflows": workflows,
        "count": len(workflows)
    }, "workflow")


@router.post("/workflows/execute")
async def execute_workflow(
    request: WorkflowExecuteRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Execute a workflow manually (demo workflow engine)"""
    agents = await get_store_agents(current_user.store_id, db)
    workflow_engine = agents["workflow"]

    result = await workflow_engine.execute_workflow(
        request.workflow_id,
        request.context
    )
    return _mark_demo(result, "workflow")


@router.post("/workflows/{workflow_id}/toggle")
async def toggle_workflow(
    workflow_id: str,
    enabled: bool,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Enable or disable a workflow (demo workflow engine)"""
    agents = await get_store_agents(current_user.store_id, db)
    workflow_engine = agents["workflow"]

    success = workflow_engine.toggle_workflow(workflow_id, enabled)

    if success:
        return _mark_demo({"status": "success", "workflow_id": workflow_id, "enabled": enabled}, "workflow")
    else:
        raise HTTPException(status_code=404, detail="Workflow not found")


@router.post("/workflows/trigger-event")
async def trigger_workflow_event(
    event: str,
    data: Optional[Dict] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Trigger an event to execute matching workflows (demo workflow engine)"""
    agents = await get_store_agents(current_user.store_id, db)
    workflow_engine = agents["workflow"]

    results = await workflow_engine.trigger_event(event, data or {})
    return _mark_demo({
        "event": event,
        "workflows_triggered": len(results),
        "results": results
    }, "workflow")


# ==================== Multi-Agent Orchestration ====================

@router.post("/orchestrate")
async def orchestrate_multi_agent_task(
    request: AgentQueryRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Orchestrate a complex task across multiple agents.
    The Store Manager will coordinate other agents as needed.
    """
    start_time = datetime.now()
    agents = await get_store_agents(current_user.store_id, db)

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
