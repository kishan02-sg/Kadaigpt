"""
KadaiGPT - Telegram Bot Service
Fast, reliable messaging bot - No QR codes needed!
"""

import httpx
import json
import logging
from typing import Optional, Dict, Any, List
from app.config import settings

logger = logging.getLogger(__name__)


class TelegramBotService:
    """Telegram Bot for KadaiGPT - Retail Intelligence"""
    
    def __init__(self):
        self.bot_token = settings.TELEGRAM_BOT_TOKEN or ""
        self.api_url = f"https://api.telegram.org/bot{self.bot_token}"
        self.store_name = "KadaiGPT Store"
        
        # Conversation states for multi-step interactions
        self._conversation_states = {}
        
    async def send_message(self, chat_id: str, text: str, parse_mode: str = "Markdown") -> Dict[str, Any]:
        """Send a message to a Telegram chat"""
        try:
            url = f"{self.api_url}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": text,
                "parse_mode": parse_mode
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, timeout=30)
                
                if response.status_code == 200:
                    logger.info(f"Message sent to {chat_id}")
                    return {"success": True, "data": response.json()}
                else:
                    logger.error(f"Failed to send message: {response.text}")
                    return {"success": False, "error": response.text}
                    
        except Exception as e:
            logger.error(f"Error sending Telegram message: {e}")
            return {"success": False, "error": str(e)}
    
    async def send_welcome_message(self, chat_id: str, user_name: str) -> Dict[str, Any]:
        """Send welcome message to new user"""
        message = f"""🎉 *Welcome to {self.store_name}!*

Namaste {user_name}! 🙏

I'm your KadaiGPT AI assistant, here to help you manage your retail business.

*Quick Commands:*

📊 *Reports*
• /sales - Today's sales
• /expense - Expenses report
• /profit - P&L summary
• /report - Full daily report

📦 *Inventory*
• /stock - Stock levels
• /lowstock - Low stock alerts
• /addproduct - Add new product

🧾 *Billing*
• /bill - Create new bill
• /bills - Recent bills
• /pending - Pending payments

💡 *AI Features*
• /predict - Sales predictions
• /suggest - Smart suggestions
• /help - All commands

Just type naturally in Tamil, Hindi or English - I understand! 🇮🇳

Type /help anytime for assistance."""

        return await self.send_message(chat_id, message)
    
    async def process_incoming_message(self, chat_id: str, text: str, user_name: str = "") -> str:
        """Process incoming message and generate response"""
        try:
            # Clean the message
            clean_text = text.strip().lower()
            
            # Check for ongoing conversation
            if chat_id in self._conversation_states:
                return await self._handle_conversation(chat_id, text)
            
            # Command handling
            if clean_text.startswith('/'):
                return await self._handle_command(chat_id, clean_text, user_name)
            
            # Natural language processing
            return await self._handle_natural_language(chat_id, text)
            
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            return "Sorry, something went wrong. Please try again or type /help."
    
    async def _handle_command(self, chat_id: str, command: str, user_name: str) -> str:
        """Handle bot commands"""
        
        if command in ['/start', '/help']:
            return self._get_help_message()
        
        elif command == '/sales':
            return await self._get_sales_report()
        
        elif command == '/stock':
            return await self._get_stock_report()
        
        elif command == '/lowstock':
            return await self._get_low_stock_alerts()
        
        elif command == '/expense':
            return await self._get_expense_report()
        
        elif command == '/profit':
            return await self._get_profit_report()
        
        elif command == '/report':
            return await self._get_full_report()
        
        elif command == '/bill':
            self._conversation_states[chat_id] = {'action': 'create_bill', 'step': 'customer'}
            return "🧾 *Create New Bill*\n\nPlease enter customer name (or 'walk-in'):"
        
        elif command == '/addproduct':
            self._conversation_states[chat_id] = {'action': 'add_product', 'step': 'name'}
            return "📦 *Add New Product*\n\nPlease enter product name:"
        
        elif command == '/predict':
            return await self._get_predictions()
        
        elif command == '/suggest':
            return await self._get_suggestions()
        
        elif command == '/bills':
            return await self._get_recent_bills()
        
        elif command == '/pending':
            return await self._get_pending_payments()
        
        elif command == '/cancel':
            if chat_id in self._conversation_states:
                del self._conversation_states[chat_id]
            return "❌ Action cancelled. How can I help you?"
        
        else:
            return f"Unknown command: {command}\n\nType /help to see available commands."
    
    async def _handle_natural_language(self, chat_id: str, text: str) -> str:
        """Handle natural language queries"""
        text_lower = text.lower()
        
        # Sales queries
        if any(word in text_lower for word in ['sales', 'sell', 'sold', 'revenue', 'விற்பனை']):
            return await self._get_sales_report()
        
        # Stock queries
        elif any(word in text_lower for word in ['stock', 'inventory', 'available', 'சரக்கு']):
            return await self._get_stock_report()
        
        # Expense queries
        elif any(word in text_lower for word in ['expense', 'cost', 'spending', 'செலவு']):
            return await self._get_expense_report()
        
        # Profit queries
        elif any(word in text_lower for word in ['profit', 'margin', 'earning', 'லாபம்']):
            return await self._get_profit_report()
        
        # Bill queries
        elif any(word in text_lower for word in ['bill', 'invoice', 'receipt', 'பில்']):
            return await self._get_recent_bills()
        
        # Greetings
        elif any(word in text_lower for word in ['hi', 'hello', 'hey', 'vanakkam', 'வணக்கம்', 'namaste']):
            return "🙏 Vanakkam! How can I help you today?\n\nType /help to see what I can do!"
        
        # Default response
        else:
            return self._get_default_response()
    
    async def _handle_conversation(self, chat_id: str, text: str) -> str:
        """Handle multi-step conversations"""
        state = self._conversation_states.get(chat_id, {})
        action = state.get('action')
        
        if text.lower() in ['cancel', 'exit', '/cancel']:
            del self._conversation_states[chat_id]
            return "❌ Action cancelled. How can I help you?"
        
        if action == 'create_bill':
            return await self._handle_bill_creation(chat_id, text, state)
        elif action == 'add_product':
            return await self._handle_product_addition(chat_id, text, state)
        
        del self._conversation_states[chat_id]
        return self._get_default_response()
    
    async def _handle_bill_creation(self, chat_id: str, text: str, state: dict) -> str:
        """Handle bill creation flow"""
        step = state.get('step')
        
        if step == 'customer':
            state['customer'] = text
            state['step'] = 'items'
            state['items'] = []
            self._conversation_states[chat_id] = state
            return "👤 Customer: *" + text + "*\n\nNow add items:\nFormat: `Product Name - Qty - Price`\n\nExample: `Rice 5kg - 2 - 250`\n\nType 'done' when finished."
        
        elif step == 'items':
            if text.lower() == 'done':
                if not state.get('items'):
                    return "⚠️ No items added yet! Add at least one item or type /cancel"
                
                # Generate bill summary
                items = state.get('items', [])
                total = sum(item['total'] for item in items)
                
                bill_text = f"🧾 *BILL SUMMARY*\n\n"
                bill_text += f"Customer: {state.get('customer')}\n"
                bill_text += f"Items: {len(items)}\n\n"
                
                for i, item in enumerate(items, 1):
                    bill_text += f"{i}. {item['name']} x{item['qty']} = ₹{item['total']}\n"
                
                bill_text += f"\n*Total: ₹{total}*\n\n"
                bill_text += "Bill created successfully! ✅"
                
                del self._conversation_states[chat_id]
                return bill_text
            
            # Parse item
            try:
                parts = text.split('-')
                if len(parts) >= 3:
                    name = parts[0].strip()
                    qty = int(parts[1].strip())
                    price = float(parts[2].strip())
                    
                    state['items'].append({
                        'name': name,
                        'qty': qty,
                        'price': price,
                        'total': qty * price
                    })
                    self._conversation_states[chat_id] = state
                    
                    return f"✅ Added: {name} x{qty} = ₹{qty * price}\n\nAdd more items or type 'done' to finish."
                else:
                    return "⚠️ Invalid format! Use: `Product - Qty - Price`"
            except:
                return "⚠️ Invalid format! Use: `Product - Qty - Price`"
        
        return "Something went wrong. Type /cancel to start over."
    
    async def _handle_product_addition(self, chat_id: str, text: str, state: dict) -> str:
        """Handle product addition flow"""
        step = state.get('step')
        
        if step == 'name':
            state['name'] = text
            state['step'] = 'price'
            self._conversation_states[chat_id] = state
            return f"📦 Product: *{text}*\n\nEnter selling price (₹):"
        
        elif step == 'price':
            try:
                price = float(text)
                state['price'] = price
                state['step'] = 'stock'
                self._conversation_states[chat_id] = state
                return f"💰 Price: ₹{price}\n\nEnter initial stock quantity:"
            except:
                return "⚠️ Please enter a valid price number."
        
        elif step == 'stock':
            try:
                stock = int(text)
                
                # Product summary
                product_text = f"✅ *Product Added!*\n\n"
                product_text += f"📦 Name: {state.get('name')}\n"
                product_text += f"💰 Price: ₹{state.get('price')}\n"
                product_text += f"📊 Stock: {stock} units\n"
                
                del self._conversation_states[chat_id]
                return product_text
            except:
                return "⚠️ Please enter a valid stock number."
        
        return "Something went wrong. Type /cancel to start over."
    
    def _get_help_message(self) -> str:
        """Get help message"""
        return """🤖 *KadaiGPT Bot Commands*

📊 *Reports*
/sales - Today's sales report
/expense - Expense summary
/profit - Profit & Loss
/report - Complete daily report

📦 *Inventory*
/stock - Current stock levels
/lowstock - Low stock alerts
/addproduct - Add new product

🧾 *Billing*
/bill - Create new bill
/bills - Recent bills
/pending - Pending payments

🔮 *AI Features*
/predict - Sales predictions
/suggest - Smart suggestions

💬 *Chat Naturally*
Just type in Tamil, Hindi or English!
Examples:
• "What are today's sales?"
• "Show low stock items"
• "இன்றைய விற்பனை?"

Type /cancel to stop any action."""
    
    def _get_default_response(self) -> str:
        """Default response for unrecognized input"""
        return """🤔 I didn't quite understand that.

Try these:
• Type /help for commands
• Ask about sales, stock, or bills
• Use Tamil or English naturally

Examples:
• "Show today's sales"
• "Low stock items"
• "Create a bill" """
    
    # Report methods (placeholder - connect to real DB)
    async def _get_sales_report(self) -> str:
        return """📊 *Today's Sales Report*

💰 Total Sales: ₹12,450
🧾 Bills: 28
👥 Customers: 25
📈 Avg Bill: ₹444

*Top Products:*
1. Rice 5kg - 15 units
2. Sugar 1kg - 22 units
3. Oil 1L - 18 units

_Updated just now_"""
    
    async def _get_stock_report(self) -> str:
        return """📦 *Stock Summary*

✅ In Stock: 156 products
⚠️ Low Stock: 8 products
❌ Out of Stock: 3 products

*Low Stock Items:*
• Sugar 1kg - 5 left
• Milk 500ml - 8 left
• Bread - 3 left

Type /lowstock for full list."""
    
    async def _get_low_stock_alerts(self) -> str:
        return """⚠️ *Low Stock Alerts*

These items need restocking:

1. Sugar 1kg - 5 left (Min: 20)
2. Milk 500ml - 8 left (Min: 30)
3. Bread - 3 left (Min: 10)
4. Eggs - 12 left (Min: 50)
5. Butter 100g - 4 left (Min: 15)

💡 _Order soon to avoid stockouts!_"""
    
    async def _get_expense_report(self) -> str:
        return """💸 *Today's Expenses*

Total: ₹3,200

*Breakdown:*
• Stock Purchase: ₹2,500
• Electricity: ₹400
• Transport: ₹200
• Misc: ₹100

📊 This month: ₹45,600"""
    
    async def _get_profit_report(self) -> str:
        return """📈 *Profit Summary*

*Today:*
💰 Revenue: ₹12,450
💸 Expenses: ₹3,200
✨ *Profit: ₹9,250*

*This Month:*
💰 Revenue: ₹3,45,000
💸 Expenses: ₹2,10,000
✨ *Profit: ₹1,35,000*

Margin: 39.1% 📊"""
    
    async def _get_full_report(self) -> str:
        return """📋 *Daily Business Report*
_Date: Today_

💰 *Sales*
• Total: ₹12,450
• Bills: 28
• Avg Bill: ₹444

💸 *Expenses*
• Total: ₹3,200
• Stock: ₹2,500

📈 *Profit*
• Today: ₹9,250
• Margin: 74.3%

📦 *Inventory*
• Low Stock: 8 items
• Out of Stock: 3 items

👥 *Customers*
• New: 5
• Returning: 20

🏆 *Top 3 Products*
1. Rice 5kg - ₹3,750
2. Oil 1L - ₹2,880
3. Sugar 1kg - ₹1,760"""
    
    async def _get_predictions(self) -> str:
        return """🔮 *AI Sales Predictions*

*Tomorrow's Forecast:*
💰 Expected Sales: ₹14,200
📈 +14% vs today

*This Week:*
Mon: ₹12,000 ✓
Tue: ₹14,200 (predicted)
Wed: ₹13,500 (predicted)
Thu: ₹15,800 (predicted)
Fri: ₹18,200 (weekend boost!)

*Advice:*
🛒 Stock up on:
• Rice - high demand expected
• Cooking oil - festival season"""
    
    async def _get_suggestions(self) -> str:
        return """💡 *Smart Suggestions*

Based on your sales patterns:

📦 *Restock Soon:*
• Sugar 1kg - likely to run out
• Milk - high afternoon demand

💰 *Pricing:*
• Rice margins are low - consider price revision

⏰ *Peak Hours:*
• 10-12 AM: Highest traffic
• 6-8 PM: Second peak

🎯 *Today's Tip:*
Place impulse items near counter - 23% more sales!"""
    
    async def _get_recent_bills(self) -> str:
        return """🧾 *Recent Bills*

1. #1234 - ₹850 - 10:30 AM
   Customer: Ramesh
   
2. #1233 - ₹1,200 - 10:15 AM
   Customer: Walk-in
   
3. #1232 - ₹450 - 09:45 AM
   Customer: Priya
   
4. #1231 - ₹2,100 - 09:30 AM
   Customer: Kumar Store

Type /bill to create new bill."""
    
    async def _get_pending_payments(self) -> str:
        return """⏳ *Pending Payments*

Total Outstanding: ₹8,450

1. Kumar Store - ₹3,200
   Due: 2 days ago ⚠️
   
2. Lakshmi Textiles - ₹2,750
   Due: Tomorrow
   
3. Raj Traders - ₹2,500
   Due: 3 days

💡 Send reminder to Kumar Store?"""


# Global instance
telegram_bot = TelegramBotService()
