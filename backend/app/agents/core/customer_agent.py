"""
KadaiGPT - Customer Engagement Agent
Autonomous WhatsApp bot and customer relationship management
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass
import asyncio
import re

from .base_agent import (
    BaseAgent, AgentTool, AgentGoal, AgentStatus,
    ActionType, logger
)


@dataclass
class CustomerMessage:
    """Represents an incoming customer message"""
    phone: str
    message: str
    timestamp: datetime
    message_type: str = "text"  # text, image, voice
    metadata: Dict = None


@dataclass
class CustomerIntent:
    """Detected intent from customer message"""
    intent: str
    confidence: float
    entities: Dict
    requires_human: bool = False


class CustomerEngagementAgent(BaseAgent):
    """
    Customer Engagement Agent - Handles all customer interactions
    
    Capabilities:
    - Natural language understanding of customer queries
    - Product availability checks
    - Order status queries
    - Personalized offers based on purchase history
    - Loyalty program management
    - Complaint handling and escalation
    - Automated feedback collection
    - Festival/birthday greetings
    """
    
    def __init__(self, store_id: int, store_name: str = "Store"):
        self.store_name = store_name
        
        # Intent patterns for NLU
        self.intent_patterns = {
            "check_availability": [
                r"(do you have|is .* available|stock .* |.* in stock|have .*\?)",
                r"(availability of|can i get|looking for)"
            ],
            "price_query": [
                r"(price of|how much|cost of|rate of|what's the price|kitna hai)",
                r"(mrp|₹|rupees)"
            ],
            "order_status": [
                r"(order status|my order|where is my|delivery status|when will)",
                r"(track|tracking)"
            ],
            "complaint": [
                r"(complaint|problem|issue|not working|bad|worst|cheating)",
                r"(refund|return|exchange|damaged)"
            ],
            "loyalty_points": [
                r"(points|loyalty|rewards|balance|how many points)",
                r"(redeem|discount|offer)"
            ],
            "store_info": [
                r"(timing|open|close|address|location|where are you)",
                r"(delivery|home delivery|do you deliver)"
            ],
            "greeting": [
                r"(hi|hello|hey|namaste|good morning|good evening)",
                r"(start|menu)"
            ],
            "thanks": [
                r"(thank|thanks|thx|dhanyavaad|shukriya)",
                r"(great|awesome|perfect)"
            ]
        }
        
        super().__init__(
            name="CustomerAgent",
            description="AI-powered customer engagement via WhatsApp",
            store_id=store_id
        )
    
    def _register_default_tools(self):
        """Register customer engagement tools"""
        
        self.register_tool(AgentTool(
            name="detect_intent",
            description="Detect customer intent from message",
            parameters={"message": "customer message text"},
            action_type=ActionType.QUERY,
            handler=self._detect_intent
        ))
        
        self.register_tool(AgentTool(
            name="check_product_availability",
            description="Check if a product is available",
            parameters={"product_name": "name or keyword"},
            action_type=ActionType.QUERY,
            handler=self._check_availability
        ))
        
        self.register_tool(AgentTool(
            name="get_product_price",
            description="Get price of a product",
            parameters={"product_name": "name or keyword"},
            action_type=ActionType.QUERY,
            handler=self._get_price
        ))
        
        self.register_tool(AgentTool(
            name="get_customer_loyalty_info",
            description="Get customer loyalty points and tier",
            parameters={"phone": "customer phone number"},
            action_type=ActionType.QUERY,
            handler=self._get_loyalty_info
        ))
        
        self.register_tool(AgentTool(
            name="send_personalized_offer",
            description="Send personalized offer to customer",
            parameters={"phone": "customer phone", "offer_type": "type of offer"},
            action_type=ActionType.NOTIFICATION,
            handler=self._send_offer
        ))
        
        self.register_tool(AgentTool(
            name="handle_complaint",
            description="Handle customer complaint",
            parameters={"phone": "customer phone", "complaint": "complaint text"},
            action_type=ActionType.MUTATION,
            requires_approval=True,
            handler=self._handle_complaint
        ))
        
        self.register_tool(AgentTool(
            name="generate_response",
            description="Generate natural language response",
            parameters={"intent": "detected intent", "data": "relevant data"},
            action_type=ActionType.QUERY,
            handler=self._generate_response
        ))
        
        self.register_tool(AgentTool(
            name="send_whatsapp",
            description="Send WhatsApp message",
            parameters={"phone": "phone number", "message": "message text"},
            action_type=ActionType.NOTIFICATION,
            handler=self._send_whatsapp
        ))

    async def think(self, input_data: Dict) -> Dict:
        """Customer-specific reasoning"""
        # This agent is more reactive - responds to customer messages
        message = input_data.get('goal', '')
        
        # First detect intent
        intent_result = await self._detect_intent(message)
        intent = intent_result.get("intent", "unknown")
        
        if intent == "check_availability":
            # Extract product name and check availability
            product = intent_result.get("entities", {}).get("product", message)
            return {
                "action": "check_product_availability",
                "parameters": {"product_name": product},
                "reasoning": f"Customer asking about product availability: {product}"
            }
        elif intent == "price_query":
            product = intent_result.get("entities", {}).get("product", message)
            return {
                "action": "get_product_price",
                "parameters": {"product_name": product},
                "reasoning": f"Customer asking about price: {product}"
            }
        elif intent == "loyalty_points":
            return {
                "action": "get_customer_loyalty_info",
                "parameters": {"phone": input_data.get("customer_phone", "")},
                "reasoning": "Customer asking about loyalty points"
            }
        elif intent == "complaint":
            return {
                "action": "handle_complaint",
                "parameters": {
                    "phone": input_data.get("customer_phone", ""),
                    "complaint": message
                },
                "reasoning": "Customer has a complaint - needs careful handling"
            }
        elif intent == "greeting":
            return {
                "action": "generate_response",
                "parameters": {"intent": "greeting", "data": {}},
                "reasoning": "Responding to greeting"
            }
        else:
            return {
                "action": "generate_response",
                "parameters": {"intent": "general", "data": {"original_message": message}},
                "reasoning": "General query - provide helpful response"
            }

    # ==================== Tool Handlers ====================
    
    async def _detect_intent(self, message: str) -> Dict:
        """Detect intent using regex patterns and NLU"""
        message_lower = message.lower()
        
        detected_intent = "unknown"
        confidence = 0.0
        entities = {}
        
        for intent, patterns in self.intent_patterns.items():
            for pattern in patterns:
                if re.search(pattern, message_lower):
                    detected_intent = intent
                    confidence = 0.85
                    break
            if detected_intent != "unknown":
                break
        
        # Extract entities (product names, quantities)
        # Simple extraction - in production would use NER
        common_products = ["rice", "dal", "sugar", "oil", "milk", "butter", "salt", "flour", "tea", "coffee"]
        for product in common_products:
            if product in message_lower:
                entities["product"] = product
                break
        
        # Check for quantity
        qty_match = re.search(r'(\d+)\s*(kg|litre|l|packet|pcs|piece)', message_lower)
        if qty_match:
            entities["quantity"] = int(qty_match.group(1))
            entities["unit"] = qty_match.group(2)
        
        return {
            "intent": detected_intent,
            "confidence": confidence,
            "entities": entities,
            "requires_human": detected_intent == "complaint"
        }
    
    async def _check_availability(self, product_name: str) -> Dict:
        """Check product availability"""
        # Mock data - would query database
        products = {
            "rice": {"name": "Basmati Rice", "available": True, "stock": 45, "unit": "kg"},
            "dal": {"name": "Toor Dal", "available": True, "stock": 8, "unit": "kg"},
            "sugar": {"name": "Sugar", "available": True, "stock": 120, "unit": "kg"},
            "oil": {"name": "Sunflower Oil", "available": True, "stock": 25, "unit": "L"},
            "milk": {"name": "Milk", "available": True, "stock": 100, "unit": "L"},
            "salt": {"name": "Salt", "available": True, "stock": 5, "unit": "kg"}
        }
        
        product_key = product_name.lower().split()[0]
        product = products.get(product_key)
        
        if product:
            return {
                "found": True,
                "product": product["name"],
                "available": product["available"],
                "stock": product["stock"],
                "unit": product["unit"],
                "message": f"Yes! {product['name']} is available. We have {product['stock']} {product['unit']} in stock."
            }
        else:
            return {
                "found": False,
                "product": product_name,
                "message": f"Sorry, I couldn't find '{product_name}' in our inventory. Would you like me to check similar products?"
            }
    
    async def _get_price(self, product_name: str) -> Dict:
        """Get product price"""
        prices = {
            "rice": {"name": "Basmati Rice", "price": 85, "unit": "kg", "mrp": 95},
            "dal": {"name": "Toor Dal", "price": 140, "unit": "kg", "mrp": 160},
            "sugar": {"name": "Sugar", "price": 45, "unit": "kg", "mrp": 48},
            "oil": {"name": "Sunflower Oil", "price": 180, "unit": "L", "mrp": 195},
            "milk": {"name": "Milk", "price": 60, "unit": "L", "mrp": 62},
            "salt": {"name": "Salt", "price": 20, "unit": "kg", "mrp": 25}
        }
        
        product_key = product_name.lower().split()[0]
        product = prices.get(product_key)
        
        if product:
            savings = product["mrp"] - product["price"]
            return {
                "found": True,
                "product": product["name"],
                "price": product["price"],
                "mrp": product["mrp"],
                "unit": product["unit"],
                "savings": savings,
                "message": f"📦 {product['name']}\n💰 Price: ₹{product['price']}/{product['unit']}\n🏷️ MRP: ₹{product['mrp']}\n✅ You save: ₹{savings}!"
            }
        else:
            return {
                "found": False,
                "message": f"Sorry, I couldn't find the price for '{product_name}'. Please visit our store for more options!"
            }
    
    async def _get_loyalty_info(self, phone: str) -> Dict:
        """Get customer loyalty information"""
        # Mock data
        return {
            "found": True,
            "customer_name": "Valued Customer",
            "phone": phone,
            "points": 520,
            "tier": "Silver",
            "next_tier": "Gold",
            "points_to_next_tier": 480,
            "recent_rewards": [
                {"date": "2026-01-28", "points": 50, "reason": "Purchase of ₹500"},
                {"date": "2026-01-25", "points": 30, "reason": "Purchase of ₹300"}
            ],
            "message": f"🌟 Your Loyalty Status:\n\nPoints: 520 ⭐\nTier: Silver 🥈\n\nYou need just 480 more points to reach Gold tier! 🏆"
        }
    
    async def _send_offer(self, phone: str, offer_type: str = "general") -> Dict:
        """Send personalized offer"""
        offers = {
            "general": "🎉 Special Offer!\n20% OFF on Groceries this weekend!\nShow this message at checkout.\nValid till Sunday.",
            "loyalty": "🌟 VIP Offer!\nAs our valued Silver member, enjoy extra 10% OFF on your next purchase!\nUse code: SILVER10",
            "birthday": "🎂 Happy Birthday!\nEnjoy 25% OFF on your birthday month!\nAs our gift to you! 🎁",
            "winback": "We miss you! 😊\nCome back and enjoy 30% OFF on your next purchase!\nWe've got fresh stock waiting for you!"
        }
        
        message = offers.get(offer_type, offers["general"])
        
        return {
            "status": "sent",
            "phone": phone,
            "offer_type": offer_type,
            "message": message,
            "tracking_id": f"OFF-{datetime.now().strftime('%Y%m%d%H%M')}"
        }
    
    async def _handle_complaint(self, phone: str, complaint: str) -> Dict:
        """Handle customer complaint"""
        # Log the complaint
        ticket_id = f"TKT-{datetime.now().strftime('%Y%m%d%H%M')}"
        
        # Analyze sentiment and severity
        high_severity_words = ["cheating", "fraud", "legal", "police", "consumer forum"]
        is_high_severity = any(word in complaint.lower() for word in high_severity_words)
        
        return {
            "ticket_id": ticket_id,
            "status": "escalated" if is_high_severity else "logged",
            "severity": "high" if is_high_severity else "medium",
            "message": f"""🎫 Complaint Registered

Ticket ID: {ticket_id}
Status: {'Escalated to Manager' if is_high_severity else 'Under Review'}

We're sorry for the inconvenience. Our team will contact you within {'2 hours' if is_high_severity else '24 hours'}.

Thank you for your patience! 🙏""",
            "requires_followup": True,
            "assign_to": "manager" if is_high_severity else "support"
        }
    
    async def _generate_response(self, intent: str, data: Dict) -> Dict:
        """Generate natural language response"""
        responses = {
            "greeting": f"""🙏 Namaste! Welcome to {self.store_name}!

I'm your AI assistant. How can I help you today?

Quick options:
📦 Check product availability
💰 Know prices
⭐ Check loyalty points
📍 Store location & timing

Just type your query!""",
            
            "store_info": f"""📍 {self.store_name}

🕐 Timing: 8 AM - 10 PM (All days)
📞 Contact: +91-XXXXXXXXXX
🚚 Home Delivery: Available (Free above ₹500)

Visit us for fresh groceries at best prices! 🛒""",
            
            "general": f"""Thank you for reaching out! 

I'm here to help you with:
• Product availability & prices
• Order status
• Loyalty points
• Store information

Please let me know what you need! 😊""",
            
            "thanks": f"""You're welcome! 🙏

Thank you for choosing {self.store_name}!
We appreciate your business. 

Need anything else? Just message! 😊"""
        }
        
        return {
            "response": responses.get(intent, responses["general"]),
            "intent": intent
        }
    
    async def _send_whatsapp(self, phone: str, message: str) -> Dict:
        """Send WhatsApp message"""
        return {
            "status": "queued",
            "phone": phone,
            "message_preview": message[:100] + "..." if len(message) > 100 else message,
            "timestamp": datetime.now().isoformat()
        }

    # ==================== Proactive Methods ====================
    
    async def process_incoming_message(self, msg: CustomerMessage) -> Dict:
        """
        Main entry point for processing incoming WhatsApp messages
        Returns the response to send back
        """
        # Add to memory
        self.memory.add_to_short_term({
            "type": "incoming",
            "phone": msg.phone,
            "message": msg.message
        })
        
        # Run agent to process the message
        goal = AgentGoal(
            id=f"msg_{datetime.now().timestamp()}",
            description=msg.message
        )
        
        # Add customer context
        self.memory.context["customer_phone"] = msg.phone
        
        result = await self.run(goal)
        
        return result
    
    async def send_bulk_campaign(
        self,
        campaign_type: str,
        customers: List[Dict]
    ) -> Dict:
        """Send bulk marketing campaign"""
        results = {
            "total": len(customers),
            "sent": 0,
            "failed": 0,
            "campaign_type": campaign_type
        }
        
        for customer in customers:
            try:
                await self._send_offer(customer.get("phone", ""), campaign_type)
                results["sent"] += 1
            except Exception as e:
                results["failed"] += 1
                logger.error(f"Failed to send to {customer.get('phone')}: {e}")
        
        return results
    
    async def get_engagement_analytics(self) -> Dict:
        """Get customer engagement analytics"""
        return {
            "today": {
                "messages_received": 45,
                "messages_sent": 52,
                "avg_response_time": "30 seconds",
                "intents_breakdown": {
                    "availability": 15,
                    "price": 12,
                    "loyalty": 8,
                    "complaints": 2,
                    "other": 8
                }
            },
            "satisfaction_score": 4.5,
            "automation_rate": 0.92,  # 92% handled without human
            "escalation_rate": 0.04   # 4% needed human intervention
        }
