"""
KadaiGPT - Store Manager Agent
Central orchestrator that manages all other specialized agents
"""

import os
import json
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
import google.generativeai as genai

from .base_agent import (
    BaseAgent, AgentTool, AgentGoal, AgentStatus,
    ActionType, AgentOrchestrator, logger
)


class StoreManagerAgent(BaseAgent):
    """
    The Store Manager Agent is the central AI brain of KadaiGPT.
    
    Capabilities:
    - Understands natural language requests from store owner
    - Breaks down complex goals into sub-tasks
    - Delegates tasks to specialized agents
    - Coordinates multi-agent workflows
    - Makes high-level decisions
    - Reports progress and seeks approval
    """
    
    def __init__(self, store_id: int, store_name: str = "Store"):
        self.store_name = store_name
        self.specialized_agents: Dict[str, BaseAgent] = {}
        
        # Initialize Gemini
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-pro')
        else:
            self.model = None
            logger.warning("No Gemini API key found. Agent will use fallback logic.")
        
        super().__init__(
            name="StoreManager",
            description="Central AI agent that orchestrates all store operations",
            store_id=store_id
        )
        
        # System prompt for the agent
        self.system_prompt = f"""You are the Store Manager AI Agent for "{store_name}".

Your role is to:
1. Understand what the store owner/staff wants to accomplish
2. Break down complex requests into actionable steps
3. Decide which tools or specialized agents to use
4. Execute tasks autonomously when possible
5. Ask for clarification or approval when needed

You have access to the following capabilities:
- Inventory management (check stock, predict needs, reorder)
- Customer engagement (WhatsApp messages, loyalty programs)
- Billing operations (create bills, apply discounts)
- Analytics and reporting (sales trends, insights)
- Notifications (send alerts, reminders)

Always respond with a JSON object containing:
{{
    "understanding": "What you understood from the request",
    "plan": ["Step 1", "Step 2", ...],
    "action": "tool_name_to_execute_next" or "ask_clarification" or "goal_complete",
    "parameters": {{}},
    "reasoning": "Why you chose this action",
    "confidence": 0.0 to 1.0
}}
"""

    def _register_default_tools(self):
        """Register tools available to the Store Manager"""
        
        # Delegate to Inventory Agent
        self.register_tool(AgentTool(
            name="check_inventory",
            description="Check stock levels for products",
            parameters={"product_name": "optional product to check"},
            action_type=ActionType.QUERY,
            handler=self._check_inventory
        ))
        
        self.register_tool(AgentTool(
            name="get_low_stock_items",
            description="Get list of items that need restocking",
            parameters={},
            action_type=ActionType.QUERY,
            handler=self._get_low_stock_items
        ))
        
        self.register_tool(AgentTool(
            name="create_purchase_order",
            description="Create a purchase order for a supplier",
            parameters={"supplier_id": "int", "items": "list of {product_id, quantity}"},
            action_type=ActionType.MUTATION,
            requires_approval=True,
            handler=self._create_purchase_order
        ))
        
        # Customer engagement tools
        self.register_tool(AgentTool(
            name="send_whatsapp_message",
            description="Send a WhatsApp message to a customer",
            parameters={"phone": "customer phone", "message": "message text"},
            action_type=ActionType.NOTIFICATION,
            handler=self._send_whatsapp
        ))
        
        self.register_tool(AgentTool(
            name="get_customer_info",
            description="Get information about a customer",
            parameters={"phone": "customer phone or name"},
            action_type=ActionType.QUERY,
            handler=self._get_customer_info
        ))
        
        # Billing tools
        self.register_tool(AgentTool(
            name="create_bill",
            description="Create a new bill/invoice",
            parameters={"items": "list of products", "customer_phone": "optional"},
            action_type=ActionType.MUTATION,
            handler=self._create_bill
        ))
        
        # Analytics tools
        self.register_tool(AgentTool(
            name="get_sales_summary",
            description="Get sales summary for a period",
            parameters={"period": "today/week/month"},
            action_type=ActionType.QUERY,
            handler=self._get_sales_summary
        ))
        
        self.register_tool(AgentTool(
            name="get_business_insights",
            description="Get AI-generated business insights",
            parameters={},
            action_type=ActionType.QUERY,
            handler=self._get_insights
        ))
        
        # Completion tool
        self.register_tool(AgentTool(
            name="respond_to_user",
            description="Respond to the user with information or confirmation",
            parameters={"message": "response message"},
            action_type=ActionType.QUERY,
            handler=self._respond_to_user
        ))

    async def think(self, input_data: Dict) -> Dict:
        """
        Core reasoning - use LLM to decide what to do
        """
        self.status = AgentStatus.THINKING
        
        # Build prompt
        prompt = f"""{self.system_prompt}

Current context:
{input_data.get('context', '{}')}

Available tools:
{json.dumps([t for t in input_data.get('available_tools', [])], indent=2)}

User request / Goal:
{input_data.get('goal', 'No goal specified')}

Previous actions in this session:
{json.dumps(input_data.get('previous_actions', []), indent=2)}

Now decide what to do next. Respond with valid JSON only."""

        try:
            if self.model:
                # Use Gemini for reasoning
                response = self.model.generate_content(prompt)
                response_text = response.text
                
                # Parse JSON from response
                # Handle markdown code blocks
                if "```json" in response_text:
                    response_text = response_text.split("```json")[1].split("```")[0]
                elif "```" in response_text:
                    response_text = response_text.split("```")[1].split("```")[0]
                
                decision = json.loads(response_text.strip())
            else:
                # Fallback: simple keyword-based decision
                decision = self._fallback_decision(input_data.get('goal', ''))
            
            logger.info(f"[StoreManager] Decision: {decision.get('action')} - {decision.get('reasoning', '')[:100]}")
            return decision
            
        except Exception as e:
            logger.error(f"[StoreManager] Thinking error: {e}")
            return {
                "action": "respond_to_user",
                "parameters": {"message": f"I encountered an issue processing that request. Please try again."},
                "reasoning": f"Error during reasoning: {str(e)}"
            }
    
    def _fallback_decision(self, goal: str) -> Dict:
        """Simple keyword-based fallback when LLM is unavailable"""
        goal_lower = goal.lower()
        
        if any(w in goal_lower for w in ['stock', 'inventory', 'low stock', 'restock']):
            return {
                "action": "get_low_stock_items",
                "parameters": {},
                "reasoning": "User asked about inventory/stock"
            }
        elif any(w in goal_lower for w in ['sales', 'revenue', 'today', 'summary']):
            return {
                "action": "get_sales_summary",
                "parameters": {"period": "today"},
                "reasoning": "User asked about sales"
            }
        elif any(w in goal_lower for w in ['insight', 'suggest', 'recommend', 'advice']):
            return {
                "action": "get_business_insights",
                "parameters": {},
                "reasoning": "User asked for insights"
            }
        elif any(w in goal_lower for w in ['whatsapp', 'message', 'send', 'customer']):
            return {
                "action": "respond_to_user",
                "parameters": {"message": "Please specify the customer phone number and message you want to send."},
                "reasoning": "Need more info for WhatsApp"
            }
        else:
            return {
                "action": "respond_to_user",
                "parameters": {"message": f"I understood you want to: {goal}. How can I help with this specifically?"},
                "reasoning": "Clarifying user intent"
            }

    # ==================== Tool Handlers ====================
    
    async def _check_inventory(self, product_name: str = None) -> Dict:
        """Check inventory levels"""
        # In real implementation, query database
        return {
            "status": "success",
            "message": f"Checking inventory for: {product_name or 'all products'}",
            "data": {"total_products": 150, "low_stock": 8, "out_of_stock": 2}
        }
    
    async def _get_low_stock_items(self) -> Dict:
        """Get low stock items"""
        # Mock data - would query database
        items = [
            {"name": "Toor Dal", "stock": 8, "min_stock": 15, "days_left": 3},
            {"name": "Salt", "stock": 5, "min_stock": 20, "days_left": 2},
            {"name": "Sugar", "stock": 12, "min_stock": 25, "days_left": 4}
        ]
        return {
            "status": "success",
            "count": len(items),
            "items": items,
            "recommendation": "Consider restocking Salt and Toor Dal immediately"
        }
    
    async def _create_purchase_order(self, supplier_id: int, items: List) -> Dict:
        """Create a purchase order"""
        return {
            "status": "pending_approval",
            "message": f"Purchase order for {len(items)} items created. Awaiting approval.",
            "order_id": "PO-" + datetime.now().strftime("%Y%m%d%H%M")
        }
    
    async def _send_whatsapp(self, phone: str, message: str) -> Dict:
        """Send WhatsApp message"""
        return {
            "status": "success",
            "message": f"WhatsApp message queued for {phone}",
            "preview": message[:100] + "..."
        }
    
    async def _get_customer_info(self, phone: str) -> Dict:
        """Get customer information"""
        return {
            "status": "success",
            "customer": {
                "name": "Sample Customer",
                "phone": phone,
                "total_purchases": 15,
                "loyalty_points": 250,
                "tier": "Silver"
            }
        }
    
    async def _create_bill(self, items: List, customer_phone: str = None) -> Dict:
        """Create a new bill"""
        return {
            "status": "success",
            "bill_number": "INV-" + datetime.now().strftime("%Y%m%d%H%M"),
            "items_count": len(items) if items else 0,
            "message": "Bill created successfully"
        }
    
    async def _get_sales_summary(self, period: str = "today") -> Dict:
        """Get sales summary"""
        # Mock data
        summaries = {
            "today": {"sales": 24580, "bills": 47, "customers": 38},
            "week": {"sales": 158000, "bills": 312, "customers": 210},
            "month": {"sales": 625000, "bills": 1250, "customers": 850}
        }
        data = summaries.get(period, summaries["today"])
        return {
            "status": "success",
            "period": period,
            **data,
            "avg_bill_value": data["sales"] // data["bills"] if data["bills"] > 0 else 0
        }
    
    async def _get_insights(self) -> Dict:
        """Get AI-powered business insights"""
        return {
            "status": "success",
            "insights": [
                {"type": "trend", "title": "Rising Sales", "text": "Your Saturday sales are 32% higher than weekdays. Consider extended hours."},
                {"type": "alert", "title": "Low Stock", "text": "3 items need restocking within 3 days."},
                {"type": "opportunity", "title": "Dairy Growth", "text": "Dairy products show 15% week-over-week growth."},
                {"type": "customer", "title": "Loyal Customers", "text": "5 customers are close to Gold tier. Consider a promotion."}
            ]
        }
    
    async def _respond_to_user(self, message: str) -> Dict:
        """Respond to the user"""
        return {
            "status": "success",
            "response": message,
            "type": "agent_response"
        }

    # ==================== High-Level Methods ====================
    
    async def process_natural_language(self, user_input: str) -> Dict:
        """
        Process a natural language request from the user
        This is the main entry point for user interactions
        """
        goal = AgentGoal(
            id=f"goal_{datetime.now().timestamp()}",
            description=user_input,
            priority=1
        )
        
        # Add to memory
        self.memory.add_to_short_term({
            "type": "user_input",
            "content": user_input
        })
        
        # Run the agent loop
        result = await self.run(goal)
        
        return {
            "goal": user_input,
            "result": result,
            "actions_taken": len(self.action_history),
            "status": "completed"
        }
    
    async def get_proactive_suggestions(self) -> List[Dict]:
        """
        Generate proactive suggestions without being asked
        This runs periodically to provide value
        """
        suggestions = []
        
        # Check low stock
        low_stock = await self._get_low_stock_items()
        if low_stock.get("count", 0) > 0:
            suggestions.append({
                "type": "inventory",
                "priority": "high",
                "title": "Restock Needed",
                "message": f"{low_stock['count']} items are running low. {low_stock.get('recommendation', '')}",
                "action": "view_low_stock"
            })
        
        # Get insights
        insights = await self._get_insights()
        for insight in insights.get("insights", [])[:2]:
            suggestions.append({
                "type": insight["type"],
                "priority": "medium",
                "title": insight["title"],
                "message": insight["text"],
                "action": "view_insights"
            })
        
        return suggestions
