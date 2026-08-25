"""
KadaiGPT - Store Manager Agent
Central orchestrator that manages all other specialized agents
"""

import os
import json
from typing import Dict, List
from datetime import datetime, timedelta, timezone

# Google Gemini via the modern google-genai SDK (httpx-based — the legacy
# google.generativeai package pulled in grpcio/protobuf and blew the Vercel
# function bundle past the 225 MB limit). Guarded so the agent still boots
# with fallback logic when the SDK isn't installed.
try:
    from google import genai
    GEMINI_AVAILABLE = True
except ImportError:
    genai = None
    GEMINI_AVAILABLE = False

from sqlalchemy import select, func, and_, or_

from app.models import Product, Bill, BillItem, Customer, BillStatus

from .base_agent import (
    BaseAgent, AgentTool, AgentGoal, AgentStatus,
    ActionType, logger
)

IST = timezone(timedelta(hours=5, minutes=30))


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

    def __init__(self, store_id: int, store_name: str = "Store", db=None):
        self.store_name = store_name
        self.db = db
        self.specialized_agents: Dict[str, BaseAgent] = {}

        # Initialize Gemini
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if api_key and GEMINI_AVAILABLE:
            self.genai_client = genai.Client(api_key=api_key)
            self.model = "gemini-2.5-flash"
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
                response = self.genai_client.models.generate_content(model=self.model, contents=prompt)
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
            logger.warning(
                f"[StoreManager] Gemini call failed ({type(e).__name__}: {e}). "
                "Using keyword fallback."
            )
            # Gracefully fall back to keyword-based decision so users always
            # get a useful response even when the LLM is unavailable.
            try:
                return self._fallback_decision(input_data.get('goal', ''))
            except Exception as fallback_err:
                logger.error(f"[StoreManager] Fallback also failed: {fallback_err}")
                return {
                    "action": "respond_to_user",
                    "parameters": {"message": "I'm having trouble connecting right now. Please check your sales, inventory, or analytics pages directly."},
                    "reasoning": f"Both Gemini and fallback failed: {str(e)}"
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
        """Check inventory levels for this store, optionally filtered by product name"""
        if product_name:
            result = await self.db.execute(
                select(Product).where(and_(
                    Product.store_id == self.store_id,
                    Product.is_active == True,
                    Product.name.ilike(f"%{product_name}%")
                )).limit(5)
            )
            matches = result.scalars().all()
            return {
                "status": "success",
                "message": (
                    f"Found {len(matches)} product(s) matching '{product_name}'"
                    if matches else f"No products found matching '{product_name}'"
                ),
                "data": {
                    "matches": [
                        {
                            "name": p.name,
                            "stock": p.current_stock or 0,
                            "min_stock": p.min_stock_alert or 0,
                            "unit": p.unit,
                            "selling_price": p.selling_price
                        } for p in matches
                    ]
                }
            }

        result = await self.db.execute(
            select(Product).where(and_(
                Product.store_id == self.store_id,
                Product.is_active == True
            ))
        )
        products = result.scalars().all()
        low_stock = sum(1 for p in products if 0 < (p.current_stock or 0) <= (p.min_stock_alert or 10))
        out_of_stock = sum(1 for p in products if (p.current_stock or 0) <= 0)
        return {
            "status": "success",
            "message": "Checking inventory for: all products",
            "data": {"total_products": len(products), "low_stock": low_stock, "out_of_stock": out_of_stock}
        }

    async def _get_low_stock_items(self) -> Dict:
        """Get this store's products that are at or below their reorder threshold"""
        result = await self.db.execute(
            select(Product).where(and_(
                Product.store_id == self.store_id,
                Product.is_active == True,
                Product.current_stock <= Product.min_stock_alert
            )).order_by(Product.current_stock.asc()).limit(10)
        )
        products = result.scalars().all()
        items = [
            {
                "name": p.name,
                "stock": p.current_stock or 0,
                "min_stock": p.min_stock_alert or 0,
                "unit": p.unit or "pcs"
            } for p in products
        ]
        recommendation = (
            f"Consider restocking {', '.join(i['name'] for i in items[:3])}"
            if items else "All products are sufficiently stocked"
        )
        return {
            "status": "success",
            "count": len(items),
            "items": items,
            "recommendation": recommendation
        }

    async def _create_purchase_order(self, supplier_id: int = None, items: List = None) -> Dict:
        """Purchase order creation isn't wired up yet - point the user at the Suppliers page"""
        return {
            "status": "not_supported",
            "message": "Creating purchase orders via the AI assistant isn't available yet. Use the Suppliers page to create one."
        }

    async def _send_whatsapp(self, phone: str = None, message: str = None) -> Dict:
        """WhatsApp sending isn't wired up yet - point the user at the WhatsApp Integration page"""
        return {
            "status": "not_supported",
            "message": "Sending WhatsApp messages via the AI assistant isn't available yet. Use the WhatsApp Integration page to message customers."
        }

    async def _get_customer_info(self, phone: str = None) -> Dict:
        """Look up a customer by phone number or name for this store"""
        if not phone:
            return {"status": "error", "message": "Please provide a customer phone number or name to look up."}

        result = await self.db.execute(
            select(Customer).where(and_(
                Customer.store_id == self.store_id,
                or_(Customer.phone == phone, Customer.name.ilike(f"%{phone}%"))
            )).limit(1)
        )
        customer = result.scalar_one_or_none()
        if not customer:
            return {"status": "not_found", "message": f"No customer found matching '{phone}'"}

        return {
            "status": "success",
            "customer": {
                "name": customer.name,
                "phone": customer.phone,
                "total_purchases": float(customer.total_purchases or 0),
                "loyalty_points": customer.loyalty_points or 0,
                "credit": float(customer.credit or 0),
                "last_purchase": customer.last_purchase.isoformat() if customer.last_purchase else None
            }
        }

    async def _create_bill(self, items: List = None, customer_phone: str = None) -> Dict:
        """Bill creation isn't wired up yet - point the user at the Create Bill page"""
        return {
            "status": "not_supported",
            "message": "Creating bills via the AI assistant isn't available yet. Use the Create Bill page to record a sale."
        }

    async def _get_sales_summary(self, period: str = "today") -> Dict:
        """Get a real sales summary for today/week/month for this store"""
        now_ist = datetime.now(IST).replace(tzinfo=None)
        today_start = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)

        if period == "week":
            start = today_start - timedelta(days=today_start.weekday())
        elif period == "month":
            start = today_start.replace(day=1)
        else:
            period = "today"
            start = today_start

        result = await self.db.execute(
            select(
                func.count(Bill.id),
                func.sum(Bill.total_amount),
                func.count(func.distinct(Bill.customer_phone))
            ).where(and_(
                Bill.store_id == self.store_id,
                Bill.status == BillStatus.COMPLETED,
                Bill.bill_date >= start
            ))
        )
        row = result.one()
        bills_count = row[0] or 0
        sales = float(row[1] or 0)
        customers = row[2] or 0

        return {
            "status": "success",
            "period": period,
            "sales": round(sales, 2),
            "bills": bills_count,
            "customers": customers,
            "avg_bill_value": round(sales / bills_count, 2) if bills_count > 0 else 0
        }

    async def _get_insights(self) -> Dict:
        """Generate business insights from this store's real sales and stock data"""
        insights = []
        today = datetime.now(IST).replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
        yesterday = today - timedelta(days=1)

        # Low stock
        low_stock = await self._get_low_stock_items()
        if low_stock["count"] > 0:
            insights.append({
                "type": "alert",
                "title": "Low Stock",
                "text": f"{low_stock['count']} item(s) need restocking: {', '.join(i['name'] for i in low_stock['items'][:3])}"
            })

        # Sales trend: today vs yesterday
        today_result = await self.db.execute(
            select(func.sum(Bill.total_amount)).where(and_(
                Bill.store_id == self.store_id,
                Bill.status == BillStatus.COMPLETED,
                Bill.bill_date >= today
            ))
        )
        yesterday_result = await self.db.execute(
            select(func.sum(Bill.total_amount)).where(and_(
                Bill.store_id == self.store_id,
                Bill.status == BillStatus.COMPLETED,
                Bill.bill_date >= yesterday,
                Bill.bill_date < today
            ))
        )
        today_sales = float(today_result.scalar() or 0)
        yesterday_sales = float(yesterday_result.scalar() or 0)

        if yesterday_sales > 0:
            change = round(((today_sales - yesterday_sales) / yesterday_sales) * 100, 1)
            if change >= 0:
                insights.append({
                    "type": "trend",
                    "title": "Sales Up",
                    "text": f"Today's sales (₹{today_sales:,.0f}) are {change}% higher than yesterday."
                })
            else:
                insights.append({
                    "type": "trend",
                    "title": "Sales Down",
                    "text": f"Today's sales (₹{today_sales:,.0f}) are {abs(change)}% lower than yesterday (₹{yesterday_sales:,.0f})."
                })
        elif today_sales > 0:
            insights.append({
                "type": "trend",
                "title": "Today's Sales",
                "text": f"₹{today_sales:,.0f} in sales so far today."
            })

        # Top-selling product over the last 30 days
        thirty_days_ago = today - timedelta(days=30)
        top_product_result = await self.db.execute(
            select(BillItem.product_name, func.sum(BillItem.quantity).label("qty"))
            .join(Bill, Bill.id == BillItem.bill_id)
            .where(and_(
                Bill.store_id == self.store_id,
                Bill.status == BillStatus.COMPLETED,
                Bill.bill_date >= thirty_days_ago
            ))
            .group_by(BillItem.product_name)
            .order_by(func.sum(BillItem.quantity).desc())
            .limit(1)
        )
        top_product = top_product_result.first()
        if top_product:
            insights.append({
                "type": "opportunity",
                "title": "Best Seller",
                "text": f"{top_product[0]} is your top-selling product over the last 30 days ({int(top_product[1])} units sold)."
            })

        if not insights:
            insights.append({
                "type": "info",
                "title": "Getting Started",
                "text": "Add products and record sales to start seeing AI-powered insights here."
            })

        return {
            "status": "success",
            "insights": insights
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
