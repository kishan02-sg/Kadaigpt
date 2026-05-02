"""
KadaiGPT - Advanced AI Workflow Engine
Automated triggers, actions, and intelligent workflows
"""

from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timedelta
import asyncio
import json
import logging

logger = logging.getLogger("KadaiGPT.Workflow")


class TriggerType(Enum):
    """Types of workflow triggers"""
    SCHEDULE = "schedule"           # Time-based (daily, hourly, etc.)
    EVENT = "event"                 # Event-based (stock_low, sale_complete, etc.)
    CONDITION = "condition"         # Condition-based (stock < 10, sales > 50000)
    WEBHOOK = "webhook"             # External webhook trigger
    AGENT_REQUEST = "agent_request" # Another agent requests this workflow


class ActionType(Enum):
    """Types of workflow actions"""
    SEND_NOTIFICATION = "send_notification"
    SEND_WHATSAPP = "send_whatsapp"
    CREATE_REPORT = "create_report"
    UPDATE_INVENTORY = "update_inventory"
    CREATE_PURCHASE_ORDER = "create_purchase_order"
    APPLY_DISCOUNT = "apply_discount"
    CALL_AGENT = "call_agent"
    EXECUTE_SCRIPT = "execute_script"
    SEND_EMAIL = "send_email"
    LOG_EVENT = "log_event"


@dataclass
class WorkflowTrigger:
    """Defines when a workflow should execute"""
    trigger_type: TriggerType
    config: Dict[str, Any]
    last_triggered: Optional[datetime] = None
    trigger_count: int = 0


@dataclass
class WorkflowAction:
    """Defines what a workflow should do"""
    action_type: ActionType
    config: Dict[str, Any]
    order: int = 0
    on_error: str = "continue"  # continue, stop, retry


@dataclass
class WorkflowCondition:
    """Conditional logic for workflows"""
    field: str
    operator: str  # eq, ne, gt, lt, gte, lte, contains, in
    value: Any
    
    def evaluate(self, data: Dict) -> bool:
        """Evaluate the condition against data"""
        actual = data.get(self.field)
        if actual is None:
            return False
        
        ops = {
            "eq": lambda a, b: a == b,
            "ne": lambda a, b: a != b,
            "gt": lambda a, b: a > b,
            "lt": lambda a, b: a < b,
            "gte": lambda a, b: a >= b,
            "lte": lambda a, b: a <= b,
            "contains": lambda a, b: b in str(a),
            "in": lambda a, b: a in b if isinstance(b, list) else False
        }
        
        return ops.get(self.operator, lambda a, b: False)(actual, self.value)


@dataclass
class Workflow:
    """Complete workflow definition"""
    id: str
    name: str
    description: str
    store_id: int
    triggers: List[WorkflowTrigger]
    actions: List[WorkflowAction]
    conditions: List[WorkflowCondition] = field(default_factory=list)
    enabled: bool = True
    created_at: datetime = field(default_factory=datetime.now)
    last_run: Optional[datetime] = None
    run_count: int = 0
    success_count: int = 0
    failure_count: int = 0


class WorkflowEngine:
    """
    Advanced Workflow Engine for autonomous automation
    
    Features:
    - Schedule-based workflows (daily reports, hourly checks)
    - Event-driven workflows (stock low → auto-order)
    - Conditional logic (if sales > X, then notify)
    - Multi-step actions
    - Agent integration
    """
    
    def __init__(self, store_id: int):
        self.store_id = store_id
        self.workflows: Dict[str, Workflow] = {}
        self.running = False
        self.event_handlers: Dict[str, List[str]] = {}  # event -> workflow_ids
        self.action_handlers: Dict[ActionType, Callable] = {}
        
        # Register default action handlers
        self._register_default_handlers()
        
        # Register built-in workflows
        self._register_default_workflows()
    
    def _register_default_handlers(self):
        """Register handlers for each action type"""
        self.action_handlers = {
            ActionType.SEND_NOTIFICATION: self._handle_notification,
            ActionType.SEND_WHATSAPP: self._handle_whatsapp,
            ActionType.CREATE_REPORT: self._handle_report,
            ActionType.UPDATE_INVENTORY: self._handle_inventory_update,
            ActionType.CREATE_PURCHASE_ORDER: self._handle_purchase_order,
            ActionType.APPLY_DISCOUNT: self._handle_discount,
            ActionType.CALL_AGENT: self._handle_agent_call,
            ActionType.LOG_EVENT: self._handle_log,
        }
    
    def _register_default_workflows(self):
        """Register built-in intelligent workflows"""
        
        # 1. Daily Morning Report
        self.register_workflow(Workflow(
            id="daily_morning_report",
            name="Daily Morning Report",
            description="Sends daily sales and inventory summary at 8 AM",
            store_id=self.store_id,
            triggers=[
                WorkflowTrigger(
                    trigger_type=TriggerType.SCHEDULE,
                    config={"time": "08:00", "days": ["mon", "tue", "wed", "thu", "fri", "sat"]}
                )
            ],
            actions=[
                WorkflowAction(ActionType.CALL_AGENT, {"agent": "inventory", "method": "run_daily_analysis"}, order=1),
                WorkflowAction(ActionType.CREATE_REPORT, {"type": "daily_summary"}, order=2),
                WorkflowAction(ActionType.SEND_WHATSAPP, {"template": "daily_report", "to": "owner"}, order=3)
            ]
        ))
        
        # 2. Low Stock Auto-Alert
        self.register_workflow(Workflow(
            id="low_stock_alert",
            name="Low Stock Auto-Alert",
            description="Automatically alerts when stock falls below minimum",
            store_id=self.store_id,
            triggers=[
                WorkflowTrigger(
                    trigger_type=TriggerType.EVENT,
                    config={"event": "stock_updated"}
                )
            ],
            conditions=[
                WorkflowCondition("current_stock", "lte", 10),
                WorkflowCondition("current_stock", "lt", "min_stock")
            ],
            actions=[
                WorkflowAction(ActionType.SEND_NOTIFICATION, {"title": "Low Stock Alert", "priority": "high"}, order=1),
                WorkflowAction(ActionType.SEND_WHATSAPP, {"template": "low_stock", "to": "owner"}, order=2)
            ]
        ))
        
        # 3. VIP Customer Auto-Upgrade
        self.register_workflow(Workflow(
            id="vip_auto_upgrade",
            name="VIP Customer Auto-Upgrade",
            description="Automatically upgrades customers to higher tier",
            store_id=self.store_id,
            triggers=[
                WorkflowTrigger(
                    trigger_type=TriggerType.EVENT,
                    config={"event": "points_added"}
                )
            ],
            conditions=[
                WorkflowCondition("total_points", "gte", 1000)
            ],
            actions=[
                WorkflowAction(ActionType.LOG_EVENT, {"event": "customer_tier_upgrade"}, order=1),
                WorkflowAction(ActionType.SEND_WHATSAPP, {"template": "tier_upgrade", "to": "customer"}, order=2)
            ]
        ))
        
        # 4. Sales Milestone Celebration
        self.register_workflow(Workflow(
            id="sales_milestone",
            name="Sales Milestone Celebration",
            description="Celebrates when daily sales cross ₹50,000",
            store_id=self.store_id,
            triggers=[
                WorkflowTrigger(
                    trigger_type=TriggerType.CONDITION,
                    config={"check_interval": 3600}  # Check hourly
                )
            ],
            conditions=[
                WorkflowCondition("daily_sales", "gte", 50000)
            ],
            actions=[
                WorkflowAction(ActionType.SEND_NOTIFICATION, {"title": "🎉 Sales Milestone!", "message": "Daily sales crossed ₹50,000!"}, order=1),
                WorkflowAction(ActionType.APPLY_DISCOUNT, {"type": "flash_sale", "discount": 10, "duration": 2}, order=2)
            ]
        ))
        
        # 5. End of Day Auto-Close
        self.register_workflow(Workflow(
            id="eod_auto_close",
            name="End of Day Auto-Close",
            description="Automatically generates EOD report and syncs data",
            store_id=self.store_id,
            triggers=[
                WorkflowTrigger(
                    trigger_type=TriggerType.SCHEDULE,
                    config={"time": "22:00", "days": ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]}
                )
            ],
            actions=[
                WorkflowAction(ActionType.CREATE_REPORT, {"type": "eod_summary"}, order=1),
                WorkflowAction(ActionType.CALL_AGENT, {"agent": "inventory", "method": "_detect_anomalies"}, order=2),
                WorkflowAction(ActionType.SEND_WHATSAPP, {"template": "eod_report", "to": "owner"}, order=3),
                WorkflowAction(ActionType.LOG_EVENT, {"event": "day_closed"}, order=4)
            ]
        ))
        
        # 6. Customer Re-engagement
        self.register_workflow(Workflow(
            id="customer_reengagement",
            name="Customer Re-engagement",
            description="Reaches out to customers who haven't visited in 30 days",
            store_id=self.store_id,
            triggers=[
                WorkflowTrigger(
                    trigger_type=TriggerType.SCHEDULE,
                    config={"time": "10:00", "days": ["mon", "thu"]}
                )
            ],
            actions=[
                WorkflowAction(ActionType.CALL_AGENT, {"agent": "customer", "method": "identify_inactive"}, order=1),
                WorkflowAction(ActionType.SEND_WHATSAPP, {"template": "winback", "to": "inactive_customers"}, order=2)
            ]
        ))
    
    def register_workflow(self, workflow: Workflow):
        """Register a new workflow"""
        self.workflows[workflow.id] = workflow
        
        # Index event-based workflows
        for trigger in workflow.triggers:
            if trigger.trigger_type == TriggerType.EVENT:
                event = trigger.config.get("event")
                if event:
                    if event not in self.event_handlers:
                        self.event_handlers[event] = []
                    self.event_handlers[event].append(workflow.id)
        
        logger.info(f"Registered workflow: {workflow.name}")
    
    async def trigger_event(self, event: str, data: Dict) -> List[Dict]:
        """Trigger all workflows listening to an event"""
        results = []
        workflow_ids = self.event_handlers.get(event, [])
        
        for wf_id in workflow_ids:
            workflow = self.workflows.get(wf_id)
            if workflow and workflow.enabled:
                # Check conditions
                if self._check_conditions(workflow, data):
                    result = await self.execute_workflow(wf_id, data)
                    results.append(result)
        
        return results
    
    def _check_conditions(self, workflow: Workflow, data: Dict) -> bool:
        """Check if all conditions are met"""
        if not workflow.conditions:
            return True
        
        return all(cond.evaluate(data) for cond in workflow.conditions)
    
    async def execute_workflow(self, workflow_id: str, context: Dict = None) -> Dict:
        """Execute a workflow"""
        workflow = self.workflows.get(workflow_id)
        if not workflow:
            return {"error": f"Workflow {workflow_id} not found"}
        
        if not workflow.enabled:
            return {"error": "Workflow is disabled"}
        
        logger.info(f"Executing workflow: {workflow.name}")
        
        context = context or {}
        results = []
        success = True
        
        # Sort actions by order
        sorted_actions = sorted(workflow.actions, key=lambda a: a.order)
        
        for action in sorted_actions:
            try:
                handler = self.action_handlers.get(action.action_type)
                if handler:
                    result = await handler(action.config, context)
                    results.append({
                        "action": action.action_type.value,
                        "result": result,
                        "status": "success"
                    })
                    # Pass result to next action
                    context["previous_result"] = result
            except Exception as e:
                logger.error(f"Action failed: {action.action_type.value} - {e}")
                results.append({
                    "action": action.action_type.value,
                    "error": str(e),
                    "status": "failed"
                })
                success = False
                
                if action.on_error == "stop":
                    break
        
        # Update workflow stats
        workflow.last_run = datetime.now()
        workflow.run_count += 1
        if success:
            workflow.success_count += 1
        else:
            workflow.failure_count += 1
        
        return {
            "workflow_id": workflow_id,
            "workflow_name": workflow.name,
            "success": success,
            "actions_executed": len(results),
            "results": results,
            "timestamp": datetime.now().isoformat()
        }
    
    # ==================== Action Handlers ====================
    
    async def _handle_notification(self, config: Dict, context: Dict) -> Dict:
        """Send in-app notification"""
        return {
            "type": "notification",
            "title": config.get("title", "Alert"),
            "message": config.get("message", ""),
            "priority": config.get("priority", "normal"),
            "sent_at": datetime.now().isoformat()
        }
    
    async def _handle_whatsapp(self, config: Dict, context: Dict) -> Dict:
        """Send WhatsApp message"""
        template = config.get("template", "default")
        recipient = config.get("to", "owner")
        
        # Generate message based on template
        messages = {
            "daily_report": f"📊 *Daily Report - {datetime.now().strftime('%d %b %Y')}*\n\nReady for review in KadaiGPT app.",
            "low_stock": f"⚠️ *Low Stock Alert*\n\n{context.get('product_name', 'Item')} is running low.",
            "tier_upgrade": "🎉 Congratulations! You've been upgraded to our VIP tier!",
            "winback": "We miss you! 😊 Come back for exclusive 20% OFF!",
            "eod_report": f"🌙 *End of Day Report*\n\nTotal Sales: ₹{context.get('total_sales', 0):,}"
        }
        
        return {
            "type": "whatsapp",
            "template": template,
            "recipient": recipient,
            "message_preview": messages.get(template, "Message sent"),
            "queued_at": datetime.now().isoformat()
        }
    
    async def _handle_report(self, config: Dict, context: Dict) -> Dict:
        """Generate a report"""
        report_type = config.get("type", "summary")
        
        return {
            "type": "report",
            "report_type": report_type,
            "generated_at": datetime.now().isoformat(),
            "data": context.get("report_data", {})
        }
    
    async def _handle_inventory_update(self, config: Dict, context: Dict) -> Dict:
        """Update inventory"""
        return {
            "type": "inventory_update",
            "action": config.get("action", "update"),
            "product_id": config.get("product_id"),
            "quantity": config.get("quantity"),
            "updated_at": datetime.now().isoformat()
        }
    
    async def _handle_purchase_order(self, config: Dict, context: Dict) -> Dict:
        """Create purchase order"""
        return {
            "type": "purchase_order",
            "po_number": f"PO-{datetime.now().strftime('%Y%m%d%H%M')}",
            "supplier_id": config.get("supplier_id"),
            "items": config.get("items", []),
            "status": "pending_approval",
            "created_at": datetime.now().isoformat()
        }
    
    async def _handle_discount(self, config: Dict, context: Dict) -> Dict:
        """Apply discount"""
        return {
            "type": "discount",
            "discount_type": config.get("type", "percentage"),
            "discount_value": config.get("discount", 10),
            "duration_hours": config.get("duration", 24),
            "applied_at": datetime.now().isoformat()
        }
    
    async def _handle_agent_call(self, config: Dict, context: Dict) -> Dict:
        """Call another agent"""
        return {
            "type": "agent_call",
            "agent": config.get("agent"),
            "method": config.get("method"),
            "result": "Agent call simulated",
            "called_at": datetime.now().isoformat()
        }
    
    async def _handle_log(self, config: Dict, context: Dict) -> Dict:
        """Log an event"""
        event = config.get("event", "unknown")
        logger.info(f"Workflow event: {event} - {context}")
        return {
            "type": "log",
            "event": event,
            "logged_at": datetime.now().isoformat()
        }
    
    def get_all_workflows(self) -> List[Dict]:
        """Get all registered workflows"""
        return [
            {
                "id": wf.id,
                "name": wf.name,
                "description": wf.description,
                "enabled": wf.enabled,
                "triggers": [t.trigger_type.value for t in wf.triggers],
                "actions_count": len(wf.actions),
                "run_count": wf.run_count,
                "success_rate": wf.success_count / wf.run_count if wf.run_count > 0 else 0,
                "last_run": wf.last_run.isoformat() if wf.last_run else None
            }
            for wf in self.workflows.values()
        ]
    
    def toggle_workflow(self, workflow_id: str, enabled: bool) -> bool:
        """Enable or disable a workflow"""
        workflow = self.workflows.get(workflow_id)
        if workflow:
            workflow.enabled = enabled
            return True
        return False
