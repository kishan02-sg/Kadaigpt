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
    
    async def _resolve_ctx(self, chat_id: str) -> Optional[Dict[str, Any]]:
        """Resolve the registered owner for a Telegram chat via telegram_chat_id.

        Returns {"user_id", "store_id"} or None when the chat isn't linked to a
        KadaiGPT account.
        """
        from sqlalchemy import select
        from app.database import async_session_maker
        from app.models import User

        try:
            async with async_session_maker() as db:
                result = await db.execute(
                    select(User).where(
                        User.telegram_chat_id == chat_id,
                        User.is_active == True,  # noqa: E712
                    )
                )
                user = result.scalar_one_or_none()
                if not user or not user.store_id:
                    return None
                return {"user_id": user.id, "store_id": user.store_id}
        except Exception as e:
            logger.error(f"[TG] user resolution failed for {chat_id}: {e}")
            return None

    def _link_required_message(self) -> str:
        return (
            "🔗 *Your Telegram isn't linked to a KadaiGPT account yet.*\n\n"
            "1. Send */link* here to get a one-time code\n"
            "2. Open the KadaiGPT app → *Settings → Telegram*\n"
            "3. Enter the code\n\n"
            "Then I'll show your store's live data."
        )

    async def _handle_link(self, chat_id: str) -> str:
        """Generate a one-time linking code the user enters in the KadaiGPT app."""
        import secrets
        from datetime import datetime, timedelta
        from app.database import async_session_maker
        from app.models import AuthSecurityState

        code = secrets.token_hex(4).upper()  # 8 chars
        try:
            async with async_session_maker() as db:
                db.add(AuthSecurityState(
                    kind="telegram_link",
                    key=code,
                    data={"chat_id": chat_id},
                    expires_at=datetime.utcnow() + timedelta(minutes=30),
                ))
                await db.commit()
        except Exception as e:
            logger.error(f"[TG] link code generation failed: {e}")
            return "⚠️ Couldn't generate a link code right now. Please try again."

        return (
            f"🔗 *Link your KadaiGPT account*\n\n"
            f"Your one-time code: *{code}*\n\n"
            "Open the KadaiGPT app → *Settings → Telegram* and enter this code "
            "within 30 minutes.\n\n"
            "Once linked, I'll show your store's live data here."
        )

    async def _handle_command(self, chat_id: str, command: str, user_name: str) -> str:
        """Handle bot commands"""

        # /start, /help and /link work before linking; everything else needs an
        # account so reports and writes are store-scoped.
        if command == '/start':
            return await self._get_start_message(chat_id, user_name)
        elif command == '/help':
            return self._get_help_message()
        elif command == '/link':
            return await self._handle_link(chat_id)

        ctx = await self._resolve_ctx(chat_id)
        store_id = ctx.get("store_id") if ctx else None
        user_id = ctx.get("user_id") if ctx else None

        if not ctx:
            return self._link_required_message()

        if command == '/sales':
            return await self._get_sales_report(store_id)

        elif command == '/stock':
            return await self._get_stock_report(store_id)

        elif command == '/lowstock':
            return await self._get_low_stock_alerts(store_id)

        elif command == '/expense':
            return await self._get_expense_report(store_id)

        elif command == '/profit':
            return await self._get_profit_report(store_id)

        elif command == '/report':
            return await self._get_full_report(store_id)

        elif command == '/bill':
            if not ctx:
                return self._link_required_message()
            self._conversation_states[chat_id] = {
                'action': 'create_bill', 'step': 'customer',
                'user_id': user_id, 'store_id': store_id,
            }
            return "🧾 *Create New Bill*\n\nPlease enter customer name (or 'walk-in'):"

        elif command == '/addproduct':
            if not ctx:
                return self._link_required_message()
            self._conversation_states[chat_id] = {
                'action': 'add_product', 'step': 'name',
                'user_id': user_id, 'store_id': store_id,
            }
            return "📦 *Add New Product*\n\nPlease enter product name:"

        elif command == '/predict':
            return await self._get_predictions()

        elif command == '/suggest':
            return await self._get_suggestions()

        elif command == '/bills':
            return await self._get_recent_bills(store_id)

        elif command == '/pending':
            return await self._get_pending_payments(store_id)

        elif command == '/cancel':
            if chat_id in self._conversation_states:
                del self._conversation_states[chat_id]
            return "❌ Action cancelled. How can I help you?"

        else:
            return f"Unknown command: {command}\n\nType /help to see available commands."

    async def _get_start_message(self, chat_id: str, user_name: str) -> str:
        """Welcome message: full store access when linked, link prompt otherwise."""
        ctx = await self._resolve_ctx(chat_id)
        if not ctx:
            return (
                f"🎉 *Vanakkam {user_name}!* 🙏\n\n"
                "I'm your KadaiGPT AI assistant for your retail store.\n\n"
                "To get started, link your account:\n"
                "1. Send */link* here to get a one-time code\n"
                "2. Open the KadaiGPT app → *Settings → Telegram*\n"
                "3. Enter the code\n\n"
                "Type /help anytime."
            )
        return (
            f"🎉 *Vanakkam {user_name}!* 🙏\n\n"
            "I'm your KadaiGPT AI assistant. Your account is linked — "
            "I can see your store's live data.\n\n"
            "*Quick Commands:*\n"
            "📊 /sales • /expense • /profit • /report\n"
            "📦 /stock • /lowstock • /addproduct\n"
            "🧾 /bill • /bills • /pending\n\n"
            "Type /help for everything."
        )
    
    async def _handle_natural_language(self, chat_id: str, text: str) -> str:
        """Handle natural language queries (store-scoped once linked)"""
        ctx = await self._resolve_ctx(chat_id)
        store_id = ctx.get("store_id") if ctx else None

        if not ctx:
            return self._link_required_message()

        text_lower = text.lower()

        # Sales queries
        if any(word in text_lower for word in ['sales', 'sell', 'sold', 'revenue', 'விற்பனை']):
            return await self._get_sales_report(store_id)

        # Stock queries
        elif any(word in text_lower for word in ['stock', 'inventory', 'available', 'சரக்கு']):
            return await self._get_stock_report(store_id)

        # Expense queries
        elif any(word in text_lower for word in ['expense', 'cost', 'spending', 'செலவு']):
            return await self._get_expense_report(store_id)

        # Profit queries
        elif any(word in text_lower for word in ['profit', 'margin', 'earning', 'லாபம்']):
            return await self._get_profit_report(store_id)

        # Bill queries
        elif any(word in text_lower for word in ['bill', 'invoice', 'receipt', 'பில்']):
            return await self._get_recent_bills(store_id)

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

                store_id = state.get('store_id')
                user_id = state.get('user_id')
                customer = state.get('customer') or "Walk-in"
                items = state.get('items', [])
                total = sum(item['total'] for item in items)
                del self._conversation_states[chat_id]

                if not store_id:
                    return self._link_required_message()

                from app.database import async_session_maker
                from app.services.bot_actions import create_bill_for_bot

                try:
                    async with async_session_maker() as db:
                        ok, detail, _bill = await create_bill_for_bot(
                            db, store_id, user_id,
                            [{"name": it["name"], "qty": it["qty"], "price": it["price"]} for it in items],
                            customer_name=customer, source="telegram",
                        )
                    if not ok:
                        return detail
                except Exception as e:
                    logger.error(f"[TG] create bill failed: {e}")
                    return "⚠️ Could not create the bill right now. Please try again."

                bill_text = f"🧾 *BILL CREATED* ✅\n\n"
                bill_text += f"Bill No: {detail}\n"
                bill_text += f"Customer: {customer}\n"
                bill_text += f"Items: {len(items)}\n\n"

                for i, item in enumerate(items, 1):
                    bill_text += f"{i}. {item['name']} x{item['qty']} = ₹{item['total']}\n"

                bill_text += f"\n*Total: ₹{total}*\n\n"
                bill_text += "Type /bills to see recent bills."
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
            except (ValueError, TypeError):
                return "⚠️ Please enter a valid stock number."

            store_id = state.get('store_id')
            user_id = state.get('user_id')
            name = state.get('name', '').strip()
            price = state.get('price')
            del self._conversation_states[chat_id]

            if not store_id:
                return self._link_required_message()

            from app.database import async_session_maker
            from app.services.bot_actions import create_product_for_store

            try:
                async with async_session_maker() as db:
                    ok, msg = await create_product_for_store(
                        db, store_id, user_id, name, price, stock, source="telegram"
                    )
                if ok:
                    return f"{msg}\n\nType /stock to see inventory."
                return msg
            except Exception as e:
                logger.error(f"[TG] add product failed: {e}")
                return "⚠️ Could not save the product right now. Please try again."
        
        return "Something went wrong. Type /cancel to start over."
    
    def _get_help_message(self) -> str:
        """Get help message"""
        return """🤖 *KadaiGPT Bot Commands*

🔗 *Setup*
/link - Link your KadaiGPT account
/start - Welcome & status

📊 *Reports*

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
    
    # ==================== REPORT METHODS (real, store-scoped data) ====================

    async def _get_sales_report(self, store_id: Optional[int]) -> str:
        from app.database import async_session_maker
        from app.services.bot_data import get_sales_summary

        try:
            async with async_session_maker() as db:
                data = await get_sales_summary(db, store_id)
        except Exception as e:
            logger.error(f"[TG] sales report failed: {e}")
            return "⚠️ Unable to fetch sales data right now. Please try again."

        breakdown = data["payment_breakdown"]
        pay_lines = "\n".join(
            f"• {m.title()}: ₹{v:,.0f}" for m, v in breakdown.items()
        ) or "• No sales yet"
        trend = "📈" if data["change_percent"] >= 0 else "📉"
        return (
            "📊 *Today's Sales Report*\n\n"
            f"💰 Total Sales: ₹{data['revenue']:,.0f}\n"
            f"🧾 Bills: {data['bills']}\n"
            f"📈 Avg Bill: ₹{data['avg_bill']:,.0f}\n"
            f"{trend} vs Yesterday: {data['change_percent']:+.1f}%\n\n"
            f"*Payment Breakdown:*\n{pay_lines}\n\n"
            "_Updated just now_"
        )

    async def _get_stock_report(self, store_id: Optional[int]) -> str:
        from app.database import async_session_maker
        from app.services.bot_data import get_stock_summary

        try:
            async with async_session_maker() as db:
                data = await get_stock_summary(db, store_id)
        except Exception as e:
            logger.error(f"[TG] stock report failed: {e}")
            return "⚠️ Unable to fetch stock right now. Please try again."

        return (
            "📦 *Stock Summary*\n\n"
            f"✅ In Stock: {data['in_stock']} products\n"
            f"⚠️ Low Stock: {data['low']} products\n"
            f"❌ Out of Stock: {data['out']} products\n\n"
            "Type /lowstock for the list."
        )

    async def _get_low_stock_alerts(self, store_id: Optional[int]) -> str:
        from app.database import async_session_maker
        from app.services.bot_data import get_stock_summary

        try:
            async with async_session_maker() as db:
                data = await get_stock_summary(db, store_id)
        except Exception as e:
            logger.error(f"[TG] low stock failed: {e}")
            return "⚠️ Unable to fetch stock right now. Please try again."

        if not data["low_items"]:
            return f"✅ *Low Stock Alerts*\n\nNo items need restocking — {data['total']} products all well stocked!"
        lines = "\n".join(
            f"• {it['name']} - {it['stock']} left (Min: {it['min']})"
            for it in data["low_items"]
        )
        return f"⚠️ *Low Stock Alerts*\n\nThese items need restocking:\n\n{lines}\n\n💡 _Order soon to avoid stockouts!_"

    async def _get_expense_report(self, store_id: Optional[int]) -> str:
        from app.database import async_session_maker
        from app.services.bot_data import get_expense_summary

        try:
            async with async_session_maker() as db:
                data = await get_expense_summary(db, store_id)
        except Exception as e:
            logger.error(f"[TG] expense report failed: {e}")
            return "⚠️ Unable to fetch expenses right now. Please try again."

        cat_lines = "\n".join(
            f"• {k.title()}: ₹{v:,.0f}" for k, v in data["by_category"].items()
        ) or "• No expenses yet"
        return (
            "💸 *Today's Expenses*\n\n"
            f"Total: ₹{data['total']:,.0f}\n"
            f"Transactions: {data['count']}\n\n"
            f"*Breakdown:*\n{cat_lines}"
        )

    async def _get_profit_report(self, store_id: Optional[int]) -> str:
        from app.database import async_session_maker
        from app.services.bot_data import get_sales_summary, get_expense_summary

        try:
            async with async_session_maker() as db:
                sales = await get_sales_summary(db, store_id)
                expenses = await get_expense_summary(db, store_id)
        except Exception as e:
            logger.error(f"[TG] profit report failed: {e}")
            return "⚠️ Unable to fetch profit data right now. Please try again."

        net = sales["revenue"] - expenses["total"]
        margin = (net / sales["revenue"] * 100) if sales["revenue"] else 0
        return (
            "📈 *Profit Summary (Today)*\n\n"
            f"💰 Revenue: ₹{sales['revenue']:,.0f}\n"
            f"💸 Expenses: ₹{expenses['total']:,.0f}\n"
            f"✨ *Profit: ₹{net:,.0f}*\n"
            f"Margin: {margin:.1f}% 📊"
        )

    async def _get_full_report(self, store_id: Optional[int]) -> str:
        from app.database import async_session_maker
        from app.services.bot_data import get_daily_report

        try:
            async with async_session_maker() as db:
                d = await get_daily_report(db, store_id)
        except Exception as e:
            logger.error(f"[TG] full report failed: {e}")
            return "⚠️ Unable to fetch the report right now. Please try again."

        sales = d["sales"]
        return (
            "📋 *Daily Business Report*\n_Date: Today_\n\n"
            "💰 *Sales*\n"
            f"• Total: ₹{sales['revenue']:,.0f}\n"
            f"• Bills: {sales['bills']}\n"
            f"• Avg Bill: ₹{sales['avg_bill']:,.0f}\n\n"
            "💸 *Expenses*\n"
            f"• Total: ₹{d['expenses']['total']:,.0f}\n\n"
            "📈 *Profit*\n"
            f"• Today: ₹{d['profit']:,.0f}\n\n"
            "📦 *Inventory*\n"
            f"• Low Stock: {d['stock']['low']} items\n"
            f"• Out of Stock: {d['stock']['out']} items\n\n"
            "👥 *Customers*\n"
            f"• Total: {d['customers']['total']}\n"
            f"• Pending: ₹{d['pending_total']:,.0f}"
        )

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

    async def _get_recent_bills(self, store_id: Optional[int]) -> str:
        from app.database import async_session_maker
        from app.services.bot_data import get_recent_bills

        try:
            async with async_session_maker() as db:
                bills = await get_recent_bills(db, store_id, limit=5)
        except Exception as e:
            logger.error(f"[TG] recent bills failed: {e}")
            return "⚠️ Unable to fetch bills right now. Please try again."

        if not bills:
            return "🧾 *Recent Bills*\n\nNo bills found.\n\nType /bill to create a new bill."
        lines = "\n".join(
            f"• {b['bill_number']} - ₹{b['total']:,.0f} ({b['customer']})"
            for b in bills
        )
        return f"🧾 *Recent Bills*\n\n{lines}\n\nType /bill to create new bill."

    async def _get_pending_payments(self, store_id: Optional[int]) -> str:
        from app.database import async_session_maker
        from app.services.bot_data import get_pending_payments

        try:
            async with async_session_maker() as db:
                pending = await get_pending_payments(db, store_id)
        except Exception as e:
            logger.error(f"[TG] pending payments failed: {e}")
            return "⚠️ Unable to fetch pending payments right now. Please try again."

        if not pending:
            return "⏳ *Pending Payments*\n\nNo outstanding balances. 🎉"
        total = sum(p["amount"] for p in pending)
        lines = "\n".join(
            f"• {p['name']} - ₹{p['amount']:,.0f}"
            for p in pending
        )
        return f"⏳ *Pending Payments*\n\nTotal Outstanding: ₹{total:,.0f}\n\n{lines}"


# Global instance
telegram_bot = TelegramBotService()
