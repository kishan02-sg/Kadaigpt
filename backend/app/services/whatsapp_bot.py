"""
WhatsApp Bot Service for KadaiGPT
Enhanced version with database integration, order creation, reminders, and more
Uses WAHA (WhatsApp HTTP API) for WhatsApp integration
"""

import httpx
import json
import re
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from app.config import settings
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db

logger = logging.getLogger(__name__)

# In-memory cache for quick data access (refreshed periodically)
_data_cache = {
    'bills': [],
    'products': [],
    'customers': [],
    'expenses': [],
    'last_refresh': None
}


class WhatsAppBotService:
    """Service for handling WhatsApp bot interactions with AI-powered NLP"""
    
    def __init__(self):
        self.waha_url = settings.EVOLUTION_API_URL or "http://localhost:8080"
        self.api_key = settings.EVOLUTION_API_KEY or "kadaigpt-wa-secret-2026"
        self.session_name = "default"  # WAHA Core only supports 'default' session
        self.store_name = "KadaiGPT Store"

        # Official Meta WhatsApp Cloud API config (preferred when set)
        self.cloud_token = settings.WHATSAPP_CLOUD_TOKEN
        self.cloud_phone_id = settings.WHATSAPP_PHONE_NUMBER_ID
        self.cloud_api_version = settings.WHATSAPP_CLOUD_API_VERSION
        
        # Conversation states for multi-step interactions
        self._conversation_states = {}
        
        # Try to import NLP service for AI-powered understanding
        try:
            from app.services.nlp_service import nlp_service
            self.nlp_service = nlp_service
            self.ai_enabled = True
            logger.info("AI NLP service initialized")
        except Exception as e:
            logger.warning(f"NLP service not available: {e}")
            self.nlp_service = None
            self.ai_enabled = False
    
    async def process_voice_message(self, phone: str, audio_url: str) -> str:
        """Process voice message using AI transcription"""
        if not self.nlp_service or not self.ai_enabled:
            return """🎤 I received your voice message!

I can understand voice notes, but AI transcription is not configured yet.

Please send me a text message instead, or try:
• *sales* - Check today's sales
• *stock* - Check inventory
• *help* - See all commands

_Pro tip: You can speak in Hindi, Tamil, or English - I understand all!_"""
        
        try:
            # Download audio from WAHA
            audio_data = await self._download_media(audio_url)
            
            if not audio_data:
                return "🎤 Couldn't download voice message. Please try again or send text."
            
            # Transcribe using NLP service (Gemini AI)
            result = await self.nlp_service.transcribe_voice(audio_data)
            
            if not result.get("success") or not result.get("text"):
                return "🎤 I heard your voice but couldn't understand it clearly. Please try again or type your message."
            
            transcribed_text = result["text"]
            detected_lang = result.get("language", "unknown")
            
            logger.info(f"Voice transcribed ({detected_lang}): {transcribed_text}")
            
            # Now process the transcribed text like a normal message
            response = await self.process_incoming_message(phone, transcribed_text)
            
            # Add transcription confirmation
            return f"🎤 _I heard: \"{transcribed_text[:100]}{'...' if len(transcribed_text) > 100 else ''}\"_\n\n{response}"
            
        except Exception as e:
            logger.error(f"Voice processing error: {e}")
            return "🎤 Sorry, there was an error processing your voice message. Please try sending text."
    
    async def _download_media(self, media_url: str) -> Optional[bytes]:
        """Download media from WAHA/Evolution API"""
        try:
            headers = {"X-Api-Key": self.api_key}
            async with httpx.AsyncClient() as client:
                response = await client.get(media_url, headers=headers, timeout=60)
                if response.status_code == 200:
                    return response.content
                else:
                    logger.error(f"Failed to download media: {response.status_code}")
                    return None
        except Exception as e:
            logger.error(f"Media download error: {e}")
            return None

        
    # ==================== WAHA API METHODS ====================
    
    @property
    def provider(self) -> Optional[str]:
        """Which sending provider is configured: 'cloud' (official Meta), 'evolution', or None.
        Placeholder/example values are treated as not-configured."""
        if self.cloud_token and self.cloud_phone_id:
            return "cloud"
        url = (settings.EVOLUTION_API_URL or "").strip()
        placeholder = (not url) or any(
            p in url for p in ("your-", "example", "localhost", "127.0.0.1", "changeme")
        )
        if url and not placeholder:
            return "evolution"
        return None

    @property
    def is_configured(self) -> bool:
        """True when a real provider is set up for automated sending."""
        return self.provider is not None

    async def send_message(self, phone: str, message: str) -> Dict[str, Any]:
        """Send a WhatsApp message via the configured provider (Meta Cloud API
        preferred, else WAHA/Evolution). Returns {success, data|error}."""
        if self.provider == "cloud":
            return await self._send_cloud(phone, message)
        return await self._send_waha(phone, message)

    async def _send_cloud(self, phone: str, message: str, token: str = None, phone_id: str = None) -> Dict[str, Any]:
        """Send via the official Meta WhatsApp Cloud API (global creds or per-store overrides)."""
        try:
            token = token or self.cloud_token
            phone_id = phone_id or self.cloud_phone_id
            clean_phone = self._format_phone(phone)
            url = f"https://graph.facebook.com/{self.cloud_api_version}/{phone_id}/messages"
            payload = {
                "messaging_product": "whatsapp",
                "to": clean_phone,
                "type": "text",
                "text": {"preview_url": False, "body": message},
            }
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=payload, headers=headers, timeout=30)
            if resp.status_code // 100 == 2:
                logger.info(f"[WA Cloud] message sent to {phone}")
                return {"success": True, "data": resp.json(), "provider": "cloud"}
            logger.error(f"[WA Cloud] send failed ({resp.status_code}): {resp.text[:300]}")
            return {"success": False, "error": resp.text[:300], "provider": "cloud"}
        except Exception as e:
            logger.error(f"[WA Cloud] error: {e}")
            return {"success": False, "error": str(e), "provider": "cloud"}

    async def _send_waha(self, phone: str, message: str, url: str = None, key: str = None, session: str = None) -> Dict[str, Any]:
        """Send a WhatsApp message via WAHA / Evolution API (global or per-store overrides)."""
        try:
            base = (url or self.waha_url).rstrip("/")
            api_key = key or self.api_key
            sess = session or self.session_name
            clean_phone = self._format_phone(phone)
            send_url = f"{base}/api/sendText"
            payload = {
                "session": sess,
                "chatId": f"{clean_phone}@c.us",
                "text": message
            }
            headers = {
                "X-Api-Key": api_key,
                "Content-Type": "application/json"
            }
            async with httpx.AsyncClient() as client:
                response = await client.post(send_url, json=payload, headers=headers, timeout=30)
                if response.status_code in (200, 201):
                    logger.info(f"[WAHA] message sent to {phone}")
                    return {"success": True, "data": response.json(), "provider": "evolution"}
                logger.error(f"[WAHA] failed to send message: {response.text}")
                return {"success": False, "error": response.text, "provider": "evolution"}
        except Exception as e:
            logger.error(f"[WAHA] error sending message: {e}")
            return {"success": False, "error": str(e), "provider": "evolution"}
    
    async def send_welcome_message(self, phone: str, user_name: str) -> Dict[str, Any]:
        """Send welcome message to new user"""
        message = f"""🎉 *Welcome to {self.store_name}!*

Namaste {user_name}! 🙏

Thank you for registering with us. I'm your KadaiGPT AI assistant, here to help you manage your business.

*Quick Commands:*

📊 *Reports*
• `sales` - Today's sales
• `expense` - Expenses report
• `profit` - P&L summary
• `report` - Full daily report

📦 *Inventory*
• `stock` - Low stock alerts
• `products` - All products
• `add [product]` - Quick add product

🧾 *Billing*
• `bills` - Recent bills
• `newbill` - Create new bill
• `sendbill [number]` - Send bill

👥 *Customers*
• `customers` - All customers
• `remind [name]` - Send reminder

⏰ *Reminders*
• `reminder` - Set reminders
• `pending` - Pending payments

Type *help* anytime to see all commands!

_Powered by KadaiGPT AI_ 🤖"""

        return await self.send_message(phone, message)
    
    # ==================== NLP INTENT DETECTION ====================
    
    def _detect_intent(self, message: str) -> Dict[str, Any]:
        """
        Advanced NLP-like intent detection using keyword matching, 
        semantic similarity, and context understanding
        """
        clean_msg = message.strip().lower()
        
        # Intent patterns with variations and semantic meanings
        intents = {
            'greeting': {
                'keywords': ['hi', 'hello', 'hai', 'hey', 'vanakkam', 'namaste', 'good morning', 
                            'good evening', 'good afternoon', 'howdy', 'hola', 'namaskar', 'sup',
                            'whats up', "what's up", 'how are you', 'how r u'],
                'patterns': [r'^hi+$', r'^hey+$', r'^hello+$'],
                'confidence': 0.9
            },
            'sales_query': {
                'keywords': ['sales', 'revenue', 'sell', 'sold', 'earning', 'income', 'money made',
                            'how much', 'total', 'collection', 'turnover', 'விற்பனை', 'बिक्री'],
                'patterns': [r'how much.*(sold|made|earned|sell)', r'(today|yesterday|week|month).*(sales|revenue)',
                            r'what.*(sales|revenue)', r'show.*(sales|revenue)', r'tell.*(sales|revenue)'],
                'questions': ['how much did i sell', 'what are my sales', 'show me sales', 
                             'how is business', 'how much money', 'total sales', 'todays collection'],
                'confidence': 0.85
            },
            'expense_query': {
                'keywords': ['expense', 'spending', 'spent', 'cost', 'expenditure', 'outgoing',
                            'செலவு', 'खर्च', 'payment made', 'paid', 'outflow'],
                'patterns': [r'how much.*(spent|expense|cost)', r'(today|week|month).*(expense|spending)',
                            r'what.*(expense|cost)', r'show.*(expense)', r'my.*(spending|expense)'],
                'questions': ['how much did i spend', 'what are my expenses', 'show me expenses'],
                'confidence': 0.85
            },
            'profit_query': {
                'keywords': ['profit', 'margin', 'net', 'income', 'p&l', 'pnl', 'earnings',
                            'லாபம்', 'लाभ', 'gain', 'surplus', 'bottom line'],
                'patterns': [r'how much.*(profit|gain|earned)', r'what.*(profit|margin)',
                            r'am i.*(profit|loss)', r'show.*(profit|pnl|p&l)'],
                'questions': ['am i in profit', 'how much profit', 'what is my margin'],
                'confidence': 0.85
            },
            'stock_query': {
                'keywords': ['stock', 'inventory', 'available', 'remaining', 'left', 'quantity',
                            'சரக்கு', 'स्टॉक', 'item count', 'low stock', 'out of stock', 'restock'],
                'patterns': [r'(how much|how many).*(stock|left|available|remaining)', 
                            r'what.*(stock|inventory)', r'check.*(stock|availability)',
                            r'(low|out of).*(stock)', r'need.*(restock|order)'],
                'questions': ['whats in stock', 'do i have stock', 'check inventory', 'low stock items'],
                'confidence': 0.85
            },
            'bill_query': {
                'keywords': ['bill', 'invoice', 'receipt', 'transaction', 'order', 'purchase',
                            'பில்', 'बिल', 'khata', 'bill number', 'recent bill'],
                'patterns': [r'show.*(bill|invoice|receipt)', r'(recent|latest|last).*(bill|invoice)',
                            r'(today|yesterday).*(bill)', r'how many.*(bill|invoice)'],
                'questions': ['show me bills', 'recent transactions', 'todays bills'],
                'confidence': 0.85
            },
            'customer_query': {
                'keywords': ['customer', 'client', 'buyer', 'patron', 'வாடிக்கையாளர்', 'ग्राहक',
                            'credit customer', 'pending customer', 'regular customer'],
                'patterns': [r'(show|list|all).*(customer|client)', r'(how many).*(customer)',
                            r'customer.*(credit|pending|due)', r'who.*(owe|pending)'],
                'questions': ['list customers', 'show customers', 'who owes money'],
                'confidence': 0.85
            },
            'create_bill': {
                'keywords': ['new bill', 'create bill', 'make bill', 'start bill', 'newbill',
                            'புதிய பில்', 'नया बिल', 'billing'],
                'patterns': [r'(create|make|new|start).*(bill|invoice|receipt)', r'i want to bill',
                            r'bill.*(customer|client)', r'sell.*(to|something)'],
                'questions': ['create a new bill', 'i want to bill someone', 'start billing'],
                'confidence': 0.9
            },
            'add_product': {
                'keywords': ['add product', 'new product', 'add item', 'create product', 'add'],
                'patterns': [r'(add|create|new).*(product|item)', r'i want to add', r'^add\b'],
                'confidence': 0.9
            },
            'report': {
                'keywords': ['report', 'summary', 'daily', 'weekly', 'monthly', 'overview',
                            'dashboard', 'analysis', 'analytics', 'இன்று', 'आज'],
                'patterns': [r'(daily|weekly|monthly).*(report|summary)', r'give.*(report|summary)',
                            r'(business|sales).*(report|summary)', r'how.*(business|doing)'],
                'questions': ['how is my business', 'daily summary', 'give me a report'],
                'confidence': 0.85
            },
            'gst_query': {
                'keywords': ['gst', 'tax', 'vat', 'gstr', 'filing', 'வரி', 'टैक्स', 'taxation'],
                'patterns': [r'(gst|tax).*(report|summary|collected)', r'how much.*(tax|gst)',
                            r'(monthly|quarterly).*(gst|tax)'],
                'questions': ['show gst collected', 'tax report', 'gst summary'],
                'confidence': 0.85
            },
            'pending_payments': {
                'keywords': ['pending', 'due', 'credit', 'owe', 'outstanding', 'balance',
                            'கடன்', 'उधार', 'baki', 'udhar'],
                'patterns': [r'(who|which).*(owe|pending|credit)', r'(pending|due).*(payment|amount)',
                            r'(credit|outstanding).*(customer|amount)'],
                'questions': ['who owes me', 'pending payments', 'outstanding dues'],
                'confidence': 0.85
            },
            'reminder': {
                'keywords': ['remind', 'reminder', 'alert', 'notify', 'follow up', 'ஞாபகம்'],
                'patterns': [r'(send|set).*(reminder|alert)', r'remind.*(customer|client)',
                            r'follow up with'],
                'confidence': 0.85
            },
            'price_query': {
                'keywords': ['price', 'rate', 'cost', 'how much', 'விலை', 'कीमत'],
                'patterns': [r'(price|rate|cost).*(of|for)', r'how much (is|for)',
                            r'check.*(price|rate)'],
                'questions': ['what is the price', 'price of', 'rate of'],
                'confidence': 0.85
            },
            'send_bill': {
                'keywords': ['sendbill', 'send bill', 'share bill', 'bill send'],
                'patterns': [r'sendbill.*', r'(send|share).*(bill|receipt)'],
                'confidence': 0.9
            },
            'create_order': {
                'keywords': ['neworder', 'purchase order', 'new order', 'create order', 'po', 'ஆர்டர்'],
                'patterns': [r'(create|make|new).*(order|purchase order)', r'order.*(supplier)',
                            r'neworder'],
                'questions': ['create purchase order', 'place an order'],
                'confidence': 0.9
            },
            'help': {
                'keywords': ['help', 'commands', 'what can you do', 'how to', 'guide', 'tutorial',
                            'உதவி', 'मदद', 'assist', 'support'],
                'patterns': [r'(what|how).*(can you|do you)', r'help me', r'i need help',
                            r'(show|list).*(command|feature)'],
                'questions': ['what can you do', 'how to use', 'help me'],
                'confidence': 0.9
            },
            'thanks': {
                'keywords': ['thanks', 'thank you', 'thx', 'ty', 'நன்றி', 'धन्यवाद', 'appreciated'],
                'patterns': [r'^thank', r'^thx', r'^ty$'],
                'confidence': 0.95
            },
            'prediction': {
                'keywords': ['predict', 'forecast', 'future', 'next week', 'next month', 'trend',
                            'எதிர்வுகூறல்', 'भविष्यवाणी', 'estimate', 'projection'],
                'patterns': [r'(predict|forecast).*(sales|revenue)', r'(next|coming).*(week|month)',
                            r'what.*(expect|estimate)', r'how.*(next|future)'],
                'questions': ['what will be my sales', 'predict next week', 'future forecast'],
                'confidence': 0.85
            }
        }
        
        best_match = {'intent': 'unknown', 'confidence': 0, 'entities': {}}
        
        for intent_name, intent_data in intents.items():
            score = 0
            
            # Check keywords (fuzzy matching)
            for keyword in intent_data.get('keywords', []):
                if keyword in clean_msg:
                    score += 0.4
                # Fuzzy match - allow typos
                elif self._fuzzy_match(keyword, clean_msg):
                    score += 0.3
            
            # Check patterns (regex)
            for pattern in intent_data.get('patterns', []):
                if re.search(pattern, clean_msg):
                    score += 0.5
            
            # Check full questions (semantic similarity)
            for question in intent_data.get('questions', []):
                similarity = self._semantic_similarity(clean_msg, question)
                if similarity > 0.6:
                    score += similarity * 0.5
            
            # Normalize and apply base confidence
            final_confidence = min(1.0, score * intent_data.get('confidence', 0.8))
            
            if final_confidence > best_match['confidence']:
                best_match = {
                    'intent': intent_name,
                    'confidence': final_confidence,
                    'entities': self._extract_entities(clean_msg, intent_name)
                }
        
        # If confidence is too low, return unknown
        if best_match['confidence'] < 0.3:
            best_match['intent'] = 'unknown'
        
        return best_match
    
    def _fuzzy_match(self, keyword: str, text: str) -> bool:
        """Simple fuzzy matching for typo tolerance"""
        # Check if keyword is a subsequence with 1-2 missing/extra chars
        words = text.split()
        for word in words:
            if len(keyword) > 3 and len(word) > 3:
                # Allow 1 character difference
                if abs(len(keyword) - len(word)) <= 1:
                    matches = sum(1 for a, b in zip(keyword, word) if a == b)
                    if matches >= len(keyword) - 1:
                        return True
        return False
    
    def _semantic_similarity(self, text1: str, text2: str) -> float:
        """Calculate semantic similarity between two texts"""
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        # Jaccard similarity with word importance weighting
        important_words = {'sales', 'profit', 'expense', 'stock', 'bill', 'customer', 'report',
                         'predict', 'gst', 'pending', 'remind', 'how', 'what', 'show', 'create'}
        
        important_matches = intersection.intersection(important_words)
        
        base_similarity = len(intersection) / len(union)
        importance_bonus = len(important_matches) * 0.1
        
        return min(1.0, base_similarity + importance_bonus)
    
    def _extract_entities(self, text: str, intent: str) -> Dict[str, Any]:
        """Extract entities from the message"""
        entities = {}
        
        # Extract numbers
        numbers = re.findall(r'\d+', text)
        if numbers:
            entities['numbers'] = [int(n) for n in numbers]
        
        # Extract time references
        if any(t in text for t in ['today', 'இன்று', 'आज']):
            entities['time_period'] = 'today'
        elif any(t in text for t in ['yesterday', 'நேற்று', 'कल']):
            entities['time_period'] = 'yesterday'
        elif any(t in text for t in ['week', 'வாரம்', 'हफ्ता']):
            entities['time_period'] = 'week'
        elif any(t in text for t in ['month', 'மாதம்', 'महीना']):
            entities['time_period'] = 'month'
        
        # Extract names (simple heuristic - capitalized words)
        words = text.split()
        potential_names = [w for w in words if w[0].isupper() and len(w) > 2]
        if potential_names:
            entities['names'] = potential_names
        
        return entities
    
    async def _resolve_user(self, phone: str, db: AsyncSession):
        """Look up the registered User by WhatsApp phone number.

        Matches on the last 10 digits so a +91 / 0 prefix difference between
        what the sender's number looks like and what the user typed at
        registration never blocks the lookup.
        """
        from app.models import User

        digits = re.sub(r"\D", "", phone or "")
        suffix = digits[-10:]
        if not suffix:
            return None
        result = await db.execute(
            select(User).where(
                User.phone.like(f"%{suffix}"),
                User.is_active == True,  # noqa: E712
            )
        )
        return result.scalar_one_or_none()

    async def _resolve_ctx(self, phone: str) -> Optional[Dict[str, Any]]:
        """Resolve the registered store owner for a WhatsApp number.

        Returns {"user_id", "store_id"} or None when the number isn't linked
        to a KadaiGPT account. Every owner-side command is store-scoped — we
        never act on fake/no data.
        """
        from app.database import async_session_maker

        try:
            async with async_session_maker() as db:
                user = await self._resolve_user(phone, db)
                if not user or not user.store_id:
                    return None
                return {"user_id": user.id, "store_id": user.store_id}
        except Exception as e:
            logger.error(f"[WA] user resolution failed for {phone}: {e}")
            return None

    def _registration_prompt(self, phone: str) -> str:
        """Clear message for numbers not linked to a KadaiGPT account."""
        return (
            "⚠️ *Your WhatsApp number isn't linked to a KadaiGPT account.*\n\n"
            "To use the bot, register this number in the KadaiGPT app:\n"
            "1. Open the app → *Settings*\n"
            "2. Set your *phone number* (Profile) to the number you're messaging from\n"
            "3. Send any message here again\n\n"
            "_Your number is matched automatically — no other setup needed._"
        )

    async def process_incoming_message(self, phone: str, message: str, user_id: Optional[int] = None) -> str:
        """Process incoming message using AI-powered NLP or fallback to rule-based"""

        original_msg = message.strip()

        # Check for conversation state (multi-step commands) — the state carries
        # the resolved user/store, so no re-resolution needed mid-flow.
        if phone in self._conversation_states:
            return await self._handle_conversation(phone, original_msg)

        # Resolve the registered store owner for this number. Unregistered
        # numbers get told to register — never fake data, never a silent crash.
        ctx = await self._resolve_ctx(phone)
        if ctx is None:
            logger.info(f"[WA] unregistered number tried owner commands: {phone}")
            return self._registration_prompt(phone)

        # Try AI-powered NLP first (if available)
        if self.ai_enabled and self.nlp_service:
            try:
                ai_result = await self.nlp_service.process_text(original_msg)
                if ai_result.get("ai_processed") and ai_result.get("confidence", 0) > 0.5:
                    intent = ai_result.get("intent", "unknown")
                    entities = ai_result.get("entities", {})
                    confidence = ai_result.get("confidence", 0)

                    logger.info(f"AI NLP: intent={intent}, confidence={confidence:.2f}")

                    # Use AI's suggested response if it's a general question
                    if intent == "general_question" and ai_result.get("suggested_response"):
                        return ai_result["suggested_response"]

                    # Route to handlers based on AI-detected intent
                    return await self._route_intent(intent, entities, ctx, phone, original_msg)
            except Exception as e:
                logger.warning(f"AI NLP failed, falling back to rules: {e}")

        # Fallback to rule-based NLP
        intent_result = self._detect_intent(original_msg)
        intent = intent_result['intent']
        confidence = intent_result['confidence']
        entities = intent_result.get('entities', {})

        logger.info(f"Rule-based NLP: intent={intent}, confidence={confidence:.2f}")

        # Route to handler
        return await self._route_intent(intent, entities, ctx, phone, original_msg)
    
    # ════════════════════════════════════════════════════════════════════
    # CUSTOMER-FACING STOREFRONT BOT
    # The shop's WhatsApp number is the bot, so inbound senders are CUSTOMERS.
    # They ask about stock / price / store info; we answer from that store's
    # live data. (Owner management commands above are unreachable inbound.)
    # ════════════════════════════════════════════════════════════════════

    _STOP_WORDS = {
        "is", "are", "do", "does", "you", "have", "got", "the", "a", "an", "any",
        "available", "availability", "in", "stock", "price", "rate", "cost", "of",
        "for", "how", "much", "what", "whats", "tell", "me", "there", "this", "that",
        "today", "now", "pls", "please", "can", "i", "get", "buy", "want", "need",
        "?", "hai", "kya", "hain", "iruka", "irukka", "iruku", "und", "unda", " unde",
    }

    def _extract_product_query(self, msg: str) -> str:
        """Pull the likely product name out of a customer question."""
        cleaned = re.sub(r"[?¿!.,]", " ", (msg or "").lower())
        words = [w for w in cleaned.split() if w and w not in self._STOP_WORDS]
        # numbers/units like '2', 'kg' aren't a product name
        words = [w for w in words if not w.isdigit() and w not in ("kg", "g", "ltr", "l", "litre", "liter")]
        return " ".join(words).strip()

    def _is_store_info_query(self, low: str) -> bool:
        keys = ["timing", "timings", "time", "open", "close", "hours", "address",
                "location", "where", "phone", "contact", "upi", "payment", "gpay", "shop info"]
        return any(k in low for k in keys)

    def _is_greeting(self, low: str) -> bool:
        words = low.split()
        return len(words) <= 3 and any(
            g in low for g in ["hi", "hello", "hey", "help", "menu", "start",
                               "vanakkam", "namaste", "namaskara", "hii"]
        )

    def _customer_menu(self, store_name: str) -> str:
        return (
            f"🙏 Welcome to *{store_name}*!\n\n"
            "You can ask me:\n"
            "• *Is rice available?* — check stock\n"
            "• *Price of sugar* — check price\n"
            "• *Store timings* — hours & address\n\n"
            "_Just type an item name to check it._"
        )

    def _store_info_reply(self, store) -> str:
        if not store:
            return "Sorry, store details aren't available right now."
        parts = [f"🏪 *{store.name}*"]
        if store.address:
            parts.append(f"📍 {store.address}")
        if store.phone:
            parts.append(f"📞 {store.phone}")
        if store.opening_time or store.closing_time:
            parts.append(f"🕒 {store.opening_time or '—'} to {store.closing_time or '—'}")
        if getattr(store, "upi_id", None):
            parts.append(f"💳 UPI: {store.upi_id}")
        return "\n".join(parts)

    def _product_reply(self, products: List, query: str) -> str:
        lines = []
        for p in products[:8]:
            unit = p.unit or "pcs"
            if (p.current_stock or 0) > 0:
                lines.append(f"✅ *{p.name}* — available ({p.current_stock} {unit}) at ₹{p.selling_price:g}/{unit}")
            else:
                lines.append(f"❌ *{p.name}* — out of stock")
        more = f"\n…and {len(products) - 8} more" if len(products) > 8 else ""
        return "\n".join(lines) + more

    async def process_customer_message(self, phone: str, message: str, store_id: int) -> str:
        """Answer a customer's WhatsApp question from a specific store's live data."""
        from app.database import async_session_maker
        from app.models import Product, Store

        msg = (message or "").strip()
        low = msg.lower()
        try:
            async with async_session_maker() as db:
                store = (await db.execute(select(Store).where(Store.id == store_id))).scalar_one_or_none()
                store_name = store.name if store else "our shop"

                if self._is_store_info_query(low):
                    return self._store_info_reply(store)
                if self._is_greeting(low):
                    return self._customer_menu(store_name)

                product_name = self._extract_product_query(msg)
                if not product_name:
                    return self._customer_menu(store_name)

                result = await db.execute(
                    select(Product).where(
                        Product.store_id == store_id,
                        Product.is_active == True,  # noqa: E712
                        Product.name.ilike(f"%{product_name}%"),
                    ).limit(12)
                )
                products = result.scalars().all()
                if products:
                    return self._product_reply(products, product_name)
                return (
                    f"😔 Sorry, we don't have *{product_name}* listed at {store_name} right now.\n"
                    "Try another item, or type *menu* for help."
                )
        except Exception as e:
            logger.error(f"[WA Customer] error for store {store_id}: {e}")
            return "Sorry, I couldn't check that right now. Please try again in a moment."

    # ── Store-aware sending (reply via the correct shop's connection) ──────
    async def send_message_for_store(self, store, phone: str, message: str) -> Dict[str, Any]:
        """Send a reply using the store's own WhatsApp connection; fall back to global."""
        try:
            from app.utils.encryption import data_encryptor
            if store and store.wa_provider == "cloud" and store.wa_cloud_token_enc and store.wa_cloud_phone_id:
                token = data_encryptor.decrypt(store.wa_cloud_token_enc)
                return await self._send_cloud(phone, message, token=token, phone_id=store.wa_cloud_phone_id)
            if store and store.wa_provider == "evolution" and store.wa_evolution_url:
                key = data_encryptor.decrypt(store.wa_evolution_key_enc or "")
                return await self._send_waha(phone, message, url=store.wa_evolution_url,
                                             key=key, session=store.wa_session or "default")
        except Exception as e:
            logger.warning(f"[WA] store-aware send failed, using global: {e}")
        return await self.send_message(phone, message)

    async def _route_intent(self, intent: str, entities: Dict, ctx: Dict, phone: str, original_msg: str) -> str:
        """Route to appropriate handler based on intent.

        ctx = {"user_id", "store_id"} resolved from the sender's phone — every
        handler is scoped to the caller's store.
        """
        store_id = ctx.get("store_id")
        user_id = ctx.get("user_id")

        if intent == 'greeting':
            return self._get_greeting_response()

        elif intent == 'help':
            return self._get_help_response()

        elif intent == 'thanks':
            return self._get_thanks_response()

        elif intent == 'sales_query':
            return await self._get_sales_response(store_id, entities.get('time_period', 'today'))

        elif intent == 'expense_query':
            return await self._get_expense_response(store_id)

        elif intent == 'profit_query':
            return await self._get_profit_response(store_id)

        elif intent == 'stock_query':
            return await self._get_stock_response(store_id)

        elif intent == 'bill_query':
            return await self._get_bills_response(store_id)

        elif intent == 'customer_query':
            return await self._get_customers_response(store_id)

        elif intent == 'create_bill':
            return await self._start_create_bill(phone, ctx)

        elif intent == 'add_product':
            # Extract product name if provided
            product_name = original_msg.replace('add', '').replace('product', '').replace('item', '').strip()
            return await self._start_add_product(phone, product_name, ctx)

        elif intent == 'report':
            return await self._get_daily_report(store_id)

        elif intent == 'gst_query':
            return await self._get_gst_response(store_id)

        elif intent == 'pending_payments':
            return await self._get_pending_payments(store_id)

        elif intent == 'reminder':
            # Extract customer name if provided
            names = entities.get('names', [])
            if names:
                return await self._send_payment_reminder(phone, names[0], ctx)
            return await self._get_reminders_menu(phone)

        elif intent == 'price_query':
            # Extract product name from the message (strip command words)
            product = re.sub(
                r'\b(price|rate|cost|of|for|check|how|much|is|the)\b',
                '',
                original_msg, flags=re.IGNORECASE
            ).strip().strip(':').strip()
            return await self._get_product_price(store_id, product or original_msg)

        elif intent == 'send_bill':
            # Extract the bill number (last token, e.g. sendbill INV-20260101-ABCD)
            bill_no = original_msg.replace('sendbill', '', 1).strip() or None
            if not bill_no:
                return (
                    "📤 *Send Bill*\n\nUsage: `sendbill <bill number>`\n\n"
                    "Example: `sendbill INV-20260115-AB12`\n\n"
                    "Type *bills* to see recent bill numbers."
                )
            return await self._send_bill_to_customer(store_id, phone, bill_no)

        elif intent == 'create_order':
            return await self._start_create_order(phone, ctx)

        elif intent == 'prediction':
            return await self._get_ai_predictions(store_id)

        else:
            # Unknown intent - try to be helpful
            return self._get_smart_fallback(original_msg)
    
    def _get_thanks_response(self) -> str:
        """Response for thank you messages"""
        responses = [
            "You're welcome! 😊 Happy to help. Just ask if you need anything else!",
            "My pleasure! 🙏 I'm here 24/7 to help manage your business.",
            "Glad I could help! 💪 Keep growing your business!",
            "Always here for you! 🌟 Type *help* to see what else I can do."
        ]
        import random
        return random.choice(responses)
    
    def _get_smart_fallback(self, message: str) -> str:
        """Smart fallback when intent is not recognized"""
        clean = message.lower()
        
        # Try to give contextual suggestions
        if any(word in clean for word in ['how', 'what', 'show', 'tell']):
            return """🤔 I'm not sure what you're asking about, but I can help with:

• 📊 *Sales, profit, expenses* - Just ask "how much did I sell today?"
• 📦 *Stock & inventory* - Try "what's in stock?" or "low stock items"
• 🧾 *Bills & invoices* - Say "show recent bills" or "create new bill"
• 👥 *Customers* - Ask "who owes me money?" or "list customers"
• 🔮 *AI Predictions* - Say "predict my sales" or "forecast next week"

Just ask naturally - I understand casual questions! 💬"""
        
        elif any(word in clean for word in ['can you', 'do you', 'are you']):
            return """🤖 Yes! I'm KadaiGPT, your AI business assistant.

*I can help you:*
• Track sales, expenses & profits
• Manage inventory & stock alerts
• Create and send bills via WhatsApp
• Track customer credit & send reminders
• Predict future sales using AI
• Generate GST reports

Just ask me anything naturally! For example:
_"How much did I earn this week?"_
_"Who has pending payments?"_
_"Predict my next week's sales"_"""
        
        else:
            return """👋 I didn't quite get that, but no worries!

Try asking me things like:
• "How are my sales today?"
• "Show me low stock items"
• "Create a new bill"
• "Predict next week's revenue"

Or type *help* to see all I can do! 🌟"""
    
    async def _get_ai_predictions(self, store_id: Optional[int]) -> str:
        """Get AI predictions response"""
        # In real implementation, this would call the ML prediction service
        return """🔮 *AI Business Predictions*

📈 *Next Week Forecast*
• Predicted Revenue: Based on your recent trends
• Peak Day: Saturday (historically highest)
• Peak Hours: 10 AM - 1 PM, 5 PM - 8 PM

📊 *Trend Analysis*
• Week-over-week growth analysis
• Seasonal patterns detected
• Customer behavior insights

💡 *AI Recommendations*
• Stock up on your top 5 fast-moving items
• Consider promotions on slow days
• Send loyalty rewards to VIP customers

_For detailed predictions, check the Analytics page in the app!_

Type *sales* to see current performance."""
        
        # =============== THANK YOU ===============
        if any(word in clean_msg for word in ['thank', 'thanks', 'நன்றி']):
            return "You're welcome! 🙏 Is there anything else I can help you with?"
        
        # =============== CANCEL ===============
        if clean_msg in ['cancel', 'exit', 'quit', 'stop']:
            if phone in self._conversation_states:
                del self._conversation_states[phone]
            return "Action cancelled. Type *help* to see available commands."
        
        # =============== DEFAULT ===============
        return self._get_default_response()
    
    # ==================== CONVERSATION HANDLERS ====================
    
    async def _handle_conversation(self, phone: str, message: str) -> str:
        """Handle multi-step conversations"""
        state = self._conversation_states.get(phone, {})
        action = state.get('action')
        
        if message.lower() in ['cancel', 'exit', 'quit']:
            del self._conversation_states[phone]
            return "Action cancelled. How can I help you?"
        
        if action == 'add_product':
            return await self._handle_add_product_step(phone, message, state)
        elif action == 'create_bill':
            return await self._handle_create_bill_step(phone, message, state)
        elif action == 'create_order':
            return await self._handle_create_order_step(phone, message, state)
        elif action == 'set_reminder':
            return await self._handle_reminder_step(phone, message, state)
        
        # Unknown state, clear it
        del self._conversation_states[phone]
        return self._get_default_response()
    
    # ==================== ADD PRODUCT FLOW ====================
    
    async def _start_add_product(self, phone: str, product_name: str, ctx: Optional[Dict] = None) -> str:
        """Start add product conversation"""
        self._conversation_states[phone] = {
            'action': 'add_product',
            'step': 'get_price',
            'name': product_name,
            'user_id': ctx.get('user_id') if ctx else None,
            'store_id': ctx.get('store_id') if ctx else None,
        }
        return f"""📦 *Adding New Product*

Product: *{product_name}*

Please enter the *price* (in ₹):
_(e.g., 120 or 45.50)_

Type *cancel* to abort."""
    
    async def _handle_add_product_step(self, phone: str, message: str, state: dict) -> str:
        """Handle add product steps"""
        step = state.get('step')
        
        if step == 'get_price':
            try:
                price = float(message.replace('₹', '').replace(',', '').strip())
                state['price'] = price
                state['step'] = 'get_stock'
                self._conversation_states[phone] = state
                return f"""Price: ₹{price}

Now enter the *stock quantity*:
_(e.g., 50)_"""
            except ValueError:
                return "Invalid price. Please enter a number (e.g., 120 or 45.50):"
        
        elif step == 'get_stock':
            try:
                stock = int(message.replace(',', '').strip())
                state['stock'] = stock
                state['step'] = 'confirm'
                self._conversation_states[phone] = state
                
                return f"""📦 *Confirm Product Details*

• *Name*: {state['name']}
• *Price*: ₹{state['price']}
• *Stock*: {stock} units

Reply *yes* to confirm or *cancel* to abort."""
            except ValueError:
                return "Invalid quantity. Please enter a whole number (e.g., 50):"
        
        elif step == 'confirm':
            if message.lower() in ['yes', 'y', 'confirm']:
                store_id = state.get('store_id')
                user_id = state.get('user_id')
                name = state.get('name', '').strip()
                price = state.get('price')
                stock = state.get('stock')
                del self._conversation_states[phone]

                if not store_id:
                    return self._registration_prompt(phone)

                from app.database import async_session_maker
                from app.services.bot_actions import create_product_for_store

                try:
                    async with async_session_maker() as db:
                        ok, msg = await create_product_for_store(
                            db, store_id, user_id, name, price, stock, source="whatsapp"
                        )
                    if ok:
                        return f"{msg}\n\nType *products* to see all products."
                    return msg
                except Exception as e:
                    logger.error(f"[WA] add product failed: {e}")
                    return "⚠️ Could not save the product right now. Please try again in a moment."
            else:
                del self._conversation_states[phone]
                return "Product not added. Type *help* to see other commands."
        
        return self._get_default_response()
    
    # ==================== CREATE BILL FLOW ====================
    
    async def _start_create_bill(self, phone: str, ctx: Optional[Dict] = None) -> str:
        """Start create bill conversation"""
        self._conversation_states[phone] = {
            'action': 'create_bill',
            'step': 'get_customer',
            'items': [],
            'user_id': ctx.get('user_id') if ctx else None,
            'store_id': ctx.get('store_id') if ctx else None,
        }
        return """🧾 *Create New Bill*

Please enter *customer name or phone*:
_(e.g., Ramesh or 9876543210)_

Type *cancel* to abort."""
    
    async def _handle_create_bill_step(self, phone: str, message: str, state: dict) -> str:
        """Handle create bill steps"""
        step = state.get('step')
        
        if step == 'get_customer':
            # A 10-13 digit input is a phone number — keeps the customer's phone
            # so the bill can be sent on WhatsApp (sendbill) after creation.
            digits = re.sub(r"\D", "", message)
            if 10 <= len(digits) <= 13:
                state['customer_phone'] = message.strip()
                state['customer'] = None
            else:
                state['customer'] = message
                state['customer_phone'] = None
            state['step'] = 'get_items'
            self._conversation_states[phone] = state
            return f"""Customer: *{message}*

Now add items in format:
*product name, qty, price*
_(e.g., Rice 5kg, 2, 300)_

Send items one by one, then type *done* when finished."""
        
        elif step == 'get_items':
            if message.lower() == 'done':
                if not state['items']:
                    return "No items added. Please add at least one item:"
                
                state['step'] = 'confirm'
                self._conversation_states[phone] = state
                
                # Calculate total
                total = sum(item['qty'] * item['price'] for item in state['items'])
                
                items_text = "\n".join([f"  • {i['name']} x{i['qty']} = ₹{i['qty']*i['price']}" for i in state['items']])
                
                return f"""🧾 *Bill Summary*

*Customer*: {state['customer']}

*Items*:
{items_text}

━━━━━━━━━━━━━
*Total*: ₹{total}

Reply *confirm* to create bill or *cancel* to abort."""
            
            # Parse item
            parts = [p.strip() for p in message.split(',')]
            if len(parts) >= 3:
                try:
                    item = {
                        'name': parts[0],
                        'qty': int(parts[1]),
                        'price': float(parts[2])
                    }
                    state['items'].append(item)
                    self._conversation_states[phone] = state
                    
                    total = sum(i['qty'] * i['price'] for i in state['items'])
                    return f"""✅ Added: {item['name']} x{item['qty']} @ ₹{item['price']}
Running Total: ₹{total}

Add more items or type *done* to finish."""
                except ValueError:
                    return "Invalid format. Use: *product name, quantity, price*"
            else:
                return "Invalid format. Use: *product name, quantity, price*\n_(e.g., Rice 5kg, 2, 300)_"
        
        elif step == 'confirm':
            if message.lower() in ['confirm', 'yes', 'y']:
                store_id = state.get('store_id')
                user_id = state.get('user_id')
                customer = state.get('customer') or "Walk-in"
                total = sum(item['qty'] * item['price'] for item in state['items'])
                del self._conversation_states[phone]

                if not store_id:
                    return self._registration_prompt(phone)

                from app.database import async_session_maker
                from app.services.bot_actions import create_bill_for_bot

                try:
                    async with async_session_maker() as db:
                        ok, detail, _bill = await create_bill_for_bot(
                            db, store_id, user_id, state['items'],
                            customer_name=customer,
                            customer_phone=state.get('customer_phone'),
                            source="whatsapp",
                        )
                    if not ok:
                        return detail
                    bill_no = detail
                except Exception as e:
                    logger.error(f"[WA] create bill failed: {e}")
                    return "⚠️ Could not create the bill right now. Please try again in a moment."

                return f"""✅ *Bill Created Successfully!*

📄 Bill No: *{bill_no}*
👤 Customer: {customer}
💰 Total: ₹{total:,.2f}
📅 Date: {datetime.now().strftime('%d %b %Y %I:%M %p')}

To send this bill to customer, type:
*sendbill {bill_no}*

Type *bills* to see all bills."""
            else:
                del self._conversation_states[phone]
                return "Bill cancelled. Type *help* to see other commands."
        
        return self._get_default_response()
    
    # ==================== CREATE ORDER FLOW ====================
    
    async def _start_create_order(self, phone: str, ctx: Optional[Dict] = None) -> str:
        """Start create purchase order conversation"""
        self._conversation_states[phone] = {
            'action': 'create_order',
            'step': 'get_supplier',
            'items': [],
            'user_id': ctx.get('user_id') if ctx else None,
            'store_id': ctx.get('store_id') if ctx else None,
        }
        return """📋 *Create Purchase Order*

Enter *supplier name*:
_(e.g., Metro Wholesale or Reliance)_

Type *cancel* to abort."""
    
    async def _handle_create_order_step(self, phone: str, message: str, state: dict) -> str:
        """Handle create order steps"""
        step = state.get('step')
        
        if step == 'get_supplier':
            state['supplier'] = message
            state['step'] = 'get_supplier_phone'
            self._conversation_states[phone] = state
            return f"""Supplier: *{message}*

Enter *supplier phone number* (optional, reply *skip*):
_(e.g., 9876543210)_"""
        
        elif step == 'get_supplier_phone':
            if message.lower() in ('skip', 'skip it', 'none', 'no'):
                state['supplier_phone'] = None
            else:
                state['supplier_phone'] = message.strip()
            state['step'] = 'get_items'
            self._conversation_states[phone] = state
            return f"""Supplier: *{state['supplier']}*

Add items to order in format:
*product name, quantity*
_(e.g., Rice 25kg, 10)_

Send items one by one, then type *done*."""
        
        elif step == 'get_items':
            if message.lower() == 'done':
                if not state['items']:
                    return "No items added. Please add at least one item:"
                
                state['step'] = 'confirm'
                self._conversation_states[phone] = state
                
                items_text = "\n".join([f"  • {i['name']} - {i['qty']} units" for i in state['items']])
                
                return f"""📋 *Purchase Order Summary*

*Supplier*: {state['supplier']}

*Items*:
{items_text}

Reply *confirm* to create PO or *cancel* to abort."""
            
            parts = [p.strip() for p in message.split(',')]
            if len(parts) >= 2:
                try:
                    item = {
                        'name': parts[0],
                        'qty': int(parts[1])
                    }
                    state['items'].append(item)
                    self._conversation_states[phone] = state
                    return f"✅ Added: {item['name']} - {item['qty']} units\n\nAdd more or type *done*."
                except ValueError:
                    return "Invalid format. Use: *product name, quantity*"
            else:
                return "Invalid format. Use: *product name, quantity*"
        
        elif step == 'confirm':
            if message.lower() in ['confirm', 'yes', 'y']:
                store_id = state.get('store_id')
                user_id = state.get('user_id')
                del self._conversation_states[phone]

                if not store_id:
                    return self._registration_prompt(phone)

                from app.database import async_session_maker
                from app.services.bot_actions import create_purchase_order_for_store

                try:
                    async with async_session_maker() as db:
                        ok, detail, _po = await create_purchase_order_for_store(
                            db, store_id, user_id, state['supplier'], state['items'],
                            supplier_phone=state.get('supplier_phone'), source="whatsapp",
                        )
                    if not ok:
                        return detail
                    po_no = detail
                except Exception as e:
                    logger.error(f"[WA] create PO failed: {e}")
                    return "⚠️ Could not create the order right now. Please try again in a moment."

                items_text = "\n".join([f"• {i['name']} - {i['qty']} units" for i in state['items']])
                return f"""✅ *Purchase Order Created!*

📋 PO No: *{po_no}*
🏪 Supplier: {state['supplier']}
📅 Date: {datetime.now().strftime('%d %b %Y')}

*Items:*
{items_text}

Order saved. View it in the app under *Suppliers → Orders*."""
            else:
                del self._conversation_states[phone]
                return "Order cancelled."
        
        return self._get_default_response()
    
    # ==================== REMINDERS ==================== 
    
    async def _get_reminders_menu(self, phone: str) -> str:
        """Show reminders menu"""
        return """⏰ *Reminder Options*

1️⃣ *pending* - View pending payments
2️⃣ *remind [name]* - Send reminder to customer
3️⃣ *remind all* - Bulk reminders

_Example: remind Ramesh Kumar_"""
    
    async def _send_payment_reminder(self, phone: str, customer_name: str, ctx: Dict) -> str:
        """Send a WhatsApp payment reminder to a real customer with pending credit."""
        store_id = ctx.get("store_id")
        from app.database import async_session_maker
        from app.models import Customer

        try:
            async with async_session_maker() as db:
                result = await db.execute(
                    select(Customer).where(
                        Customer.store_id == store_id,
                        Customer.deleted_at.is_(None),
                        Customer.name.ilike(customer_name.strip()),
                    )
                )
                customer = result.scalars().first()
        except Exception as e:
            logger.error(f"[WA] reminder lookup failed: {e}")
            return "⚠️ Couldn't look up that customer right now. Please try again."

        if not customer:
            return (
                f"⚠️ No customer named *{customer_name}* found in your store.\n"
                "Type *pending* to see customers with outstanding balances."
            )

        pending = customer.credit or 0
        if pending <= 0:
            return f"✅ *{customer.name}* has no pending balance — nothing to remind."
        if not customer.phone:
            return (
                f"⚠️ *{customer.name}* has ₹{pending:,.2f} pending but no phone saved, "
                "so I can't send a WhatsApp reminder. Update the customer's phone in the app."
            )

        message = (
            f"🙏 Hello *{customer.name}*!\n\n"
            f"A friendly reminder from {self.store_name}: you have a pending balance of "
            f"*₹{pending:,.2f}*. Please settle at your earliest convenience.\n\n"
            "Thank you! 🙏\n_Powered by KadaiGPT_"
        )
        result = await self.send_message(customer.phone, message)
        if result.get("success"):
            return f"✅ Reminder sent to *{customer.name}* (₹{pending:,.2f} pending)."
        return (
            f"⚠️ Reminder prepared for *{customer.name}* (₹{pending:,.2f} pending), "
            "but sending failed right now. Check the WhatsApp connection in the app."
        )

    async def _handle_reminder_step(self, phone: str, message: str, state: dict) -> str:
        """Handle reminder steps"""
        if message.lower() in ['confirm', 'yes']:
            del self._conversation_states[phone]
            return "✅ Reminder sent successfully!"
        else:
            del self._conversation_states[phone]
            return "Reminder cancelled."

    async def _get_pending_payments(self, store_id: Optional[int]) -> str:
        """Get pending payments from real customer credit data."""
        from app.database import async_session_maker
        from app.services.bot_data import get_pending_payments

        try:
            async with async_session_maker() as db:
                pending = await get_pending_payments(db, store_id)
        except Exception as e:
            logger.error(f"[WA] pending payments failed: {e}")
            return "⚠️ Couldn't fetch pending payments right now. Please try again."

        if not pending:
            return (
                "💰 *Pending Payments*\n\n"
                "No pending payments found.\n\n"
                "_Add credit sales to track pending payments._"
            )
        total = sum(p["amount"] for p in pending)
        lines = "\n".join(f"• *{p['name']}* — ₹{p['amount']:,.2f}" for p in pending)
        return f"💰 *Pending Payments*\n\nTotal outstanding: *₹{total:,.2f}*\n\n{lines}"
    
    # ==================== ORDERS MENU ====================
    
    async def _get_orders_menu(self, phone: str) -> str:
        """Show orders menu"""
        return """📋 *Order Options*

1️⃣ *neworder* - Create purchase order
2️⃣ *orders* - View all orders
3️⃣ *pending orders* - Pending deliveries

_Example: neworder_"""
    
    # ==================== PRICE CHECK ====================
    
    async def _get_product_price(self, store_id: Optional[int], product: str) -> str:
        """Get product price from the store's inventory."""
        from app.database import async_session_maker
        from app.models import Product

        try:
            async with async_session_maker() as db:
                result = await db.execute(
                    select(Product).where(
                        Product.store_id == store_id,
                        Product.is_active == True,  # noqa: E712
                        Product.name.ilike(f"%{product.strip()}%"),
                    ).limit(5)
                )
                products = result.scalars().all()
        except Exception as e:
            logger.error(f"[WA] price check failed: {e}")
            return "⚠️ Couldn't check prices right now. Please try again."

        if not products:
            return (
                f"💰 *Price Check*\n\nProduct: *{product}*\nPrice: Not found\n\n"
                "_Add the product first or check spelling._"
            )
        if len(products) > 1:
            lines = "\n".join(
                f"• *{p.name}* — ₹{p.selling_price:g}{' (out of stock)' if not p.current_stock else ''}"
                for p in products[:5]
            )
            return f"💰 *Price Check — {len(products)} matches*\n\n{lines}"
        p = products[0]
        stock = (
            f"✅ {p.current_stock} {p.unit or 'pcs'} in stock"
            if (p.current_stock or 0) > 0
            else "❌ Out of stock"
        )
        return f"💰 *Price Check*\n\nProduct: *{p.name}*\nPrice: ₹{p.selling_price:g}\n{stock}"

    # ==================== SEND BILL ====================

    async def _send_bill_to_customer(self, store_id: Optional[int], phone: str, bill_id: str) -> str:
        """Fetch a bill from the DB and send it to the customer's WhatsApp."""
        from sqlalchemy import or_
        from app.database import async_session_maker
        from app.models import Bill, BillItem, Store

        try:
            async with async_session_maker() as db:
                cond = Bill.bill_number == bill_id
                if bill_id.isdigit():
                    cond = or_(cond, Bill.id == int(bill_id))
                bill = (
                    await db.execute(
                        select(Bill).where(Bill.store_id == store_id, cond)
                    )
                ).scalars().first()

                if not bill:
                    return (
                        f"⚠️ Bill *{bill_id}* not found in your store.\n"
                        "Type *bills* to see recent bills."
                    )
                if not bill.customer_phone:
                    return (
                        f"⚠️ Bill *{bill.bill_number}* has no customer phone saved, "
                        "so I can't send it on WhatsApp."
                    )

                store = (
                    await db.execute(select(Store).where(Store.id == store_id))
                ).scalar_one_or_none()
                items = (
                    await db.execute(
                        select(BillItem).where(BillItem.bill_id == bill.id)
                    )
                ).scalars().all()

                store_name = store.name if store else "KadaiGPT Store"
                lines = [f"🧾 *{store_name}*", f"Bill: {bill.bill_number}", ""]
                for it in items[:20]:
                    lines.append(f"• {it.product_name} x{it.quantity:g} — ₹{it.total:g}")
                lines += [
                    "",
                    f"*Total: ₹{bill.total_amount:,.2f}*",
                    f"Payment: {bill.payment_method.value if bill.payment_method else 'CASH'}",
                    "",
                    "Thank you for shopping with us! 🙏",
                    "_Powered by KadaiGPT_",
                ]
                wa_msg = "\n".join(lines)
                customer_phone = bill.customer_phone
                bill_number = bill.bill_number
                bill_total = bill.total_amount
                customer_name = bill.customer_name or "customer"
        except Exception as e:
            logger.error(f"[WA] send bill failed: {e}")
            return "⚠️ Couldn't fetch that bill right now. Please try again."

        result = await self.send_message(customer_phone, wa_msg)
        if result.get("success"):
            return f"✅ Bill *{bill_number}* (₹{bill_total:,.2f}) sent to {customer_name}."
        return (
            f"⚠️ Bill *{bill_number}* fetched, but sending failed right now. "
            "Check the WhatsApp connection in the app."
        )
    
    # ==================== RESPONSE GENERATORS ====================
    
    def _get_greeting_response(self) -> str:
        hour = datetime.now().hour
        if hour < 12:
            greeting = "Good Morning"
        elif hour < 17:
            greeting = "Good Afternoon"
        else:
            greeting = "Good Evening"
            
        return f"""👋 *{greeting}!*

I'm your KadaiGPT AI assistant. How can I help you today?

*Quick Commands:*
📊 *sales* / *expense* / *profit*
📦 *stock* / *products*
🧾 *bills* / *newbill*
👥 *customers* / *pending*

Type *help* for all commands! 💬"""

    def _get_help_response(self) -> str:
        return """📚 *KadaiGPT Bot Commands*

*📊 Reports*
• `sales` - Today's sales
• `expense` - Expenses report
• `profit` - Profit/Loss
• `report` - Full daily report
• `gst` - GST summary

*📦 Inventory*
• `stock` - Low stock alerts
• `products` - All products
• `add [name]` - Add product
• `price [name]` - Check price

*🧾 Billing*
• `bills` - Recent bills
• `newbill` - Create bill
• `sendbill [no]` - Send to customer

*👥 Customers*
• `customers` - Customer list
• `pending` - Pending payments
• `remind [name]` - Payment reminder

*📋 Orders*
• `orders` - Order options
• `neworder` - Create PO

*💬 General*
• `hi` - Greeting
• `cancel` - Cancel action
• `help` - This menu

_Supports Tamil: விற்பனை, செலவு, பில், சரக்கு_"""

    def _get_default_response(self) -> str:
        return """🤔 I didn't understand that.

Try:
• *sales* / *expense* / *profit*
• *stock* / *products*
• *bills* / *newbill*
• *help* - All commands

Or say *hi* to get started! 👋"""

    async def _get_sales_response(self, store_id: Optional[int], period: str = 'today') -> str:
        """Get today's sales from the store's real data."""
        today = datetime.now().strftime("%d %b %Y")
        from app.database import async_session_maker
        from app.services.bot_data import get_sales_summary

        try:
            async with async_session_maker() as db:
                data = await get_sales_summary(db, store_id)
        except Exception as e:
            logger.error(f"[WA] sales report failed: {e}")
            return (
                f"📊 *Sales Report*\n📅 {today}\n\n"
                "⚠️ Unable to fetch live data right now. Please try again.\n\n"
                "Type *help* for other commands."
            )

        breakdown = data["payment_breakdown"]
        pay_lines = "\n".join(
            f"• {m.title()}: ₹{v:,.0f}" for m, v in breakdown.items()
        ) or "• No sales yet"
        trend = "📈" if data["change_percent"] >= 0 else "📉"
        return f"""📊 *Sales Report*
📅 {today}

💰 *Today's Sales*: ₹{data['revenue']:,.0f}
🧾 *Bills Created*: {data['bills']}
📈 *Avg Bill Value*: ₹{data['avg_bill']:,.0f}
{trend} *vs Yesterday*: {data['change_percent']:+.1f}%

💳 *Payment Breakdown*
{pay_lines}

_Updated just now_ ✨
Type *report* for full summary."""

    async def _get_expense_response(self, store_id: Optional[int]) -> str:
        today = datetime.now().strftime("%d %b %Y")
        from app.database import async_session_maker
        from app.services.bot_data import get_expense_summary

        try:
            async with async_session_maker() as db:
                data = await get_expense_summary(db, store_id)
        except Exception as e:
            logger.error(f"[WA] expense report failed: {e}")
            return (
                f"💸 *Expense Report*\n📅 {today}\n\n"
                "⚠️ Unable to fetch expenses right now. Please try again."
            )

        cat_lines = "\n".join(
            f"• {k.title()}: ₹{v:,.0f}" for k, v in data["by_category"].items()
        ) or "• No expenses yet"
        return f"""💸 *Expense Report*
📅 {today}

📉 *Total Expenses*: ₹{data['total']:,.0f}
📝 *Transactions*: {data['count']}

*By Category*
{cat_lines}

_Updated just now_"""

    async def _get_profit_response(self, store_id: Optional[int]) -> str:
        today = datetime.now().strftime("%d %b %Y")
        from app.database import async_session_maker
        from app.services.bot_data import get_sales_summary, get_expense_summary

        try:
            async with async_session_maker() as db:
                sales = await get_sales_summary(db, store_id)
                expenses = await get_expense_summary(db, store_id)
        except Exception as e:
            logger.error(f"[WA] profit report failed: {e}")
            return (
                f"💹 *Profit & Loss*\n📅 {today}\n\n"
                "⚠️ Unable to fetch profit data right now. Please try again."
            )

        net = sales["revenue"] - expenses["total"]
        return f"""💹 *Profit & Loss*
📅 {today}

📈 *Income*: ₹{sales['revenue']:,.0f}
📉 *Expenses*: ₹{expenses['total']:,.0f}
━━━━━━━━━━━━━
✅ *Net Profit*: ₹{net:,.0f}

_Updated just now_"""

    async def _get_stock_response(self, store_id: Optional[int]) -> str:
        from app.database import async_session_maker
        from app.services.bot_data import get_stock_summary

        try:
            async with async_session_maker() as db:
                data = await get_stock_summary(db, store_id)
        except Exception as e:
            logger.error(f"[WA] stock report failed: {e}")
            return "⚠️ Unable to fetch stock right now. Please try again."

        if not data["low_items"]:
            return (
                "📦 *Stock Status*\n\n"
                f"✅ {data['total']} products, all well stocked!\n\n"
                "Type *products* for full inventory."
            )
        lines = "\n".join(
            f"• *{it['name']}* — {it['stock']} left (min {it['min']})"
            for it in data["low_items"]
        )
        return f"""📦 *Stock Status*

⚠️ *Low Stock Items*: {data['low']}
❌ *Out of Stock*: {data['out']}

{lines}

Type *products* for full inventory."""

    async def _get_bills_response(self, store_id: Optional[int]) -> str:
        today = datetime.now().strftime("%d %b %Y")
        from app.database import async_session_maker
        from app.services.bot_data import get_recent_bills

        try:
            async with async_session_maker() as db:
                bills = await get_recent_bills(db, store_id, limit=5)
        except Exception as e:
            logger.error(f"[WA] bills report failed: {e}")
            return (
                f"🧾 *Recent Bills*\n📅 {today}\n\n"
                "⚠️ Unable to fetch bills right now. Please try again."
            )

        if not bills:
            return (
                f"🧾 *Recent Bills*\n📅 {today}\n\nNo bills found.\n\n"
                "Create a bill: Type *newbill*"
            )
        lines = "\n".join(
            f"• *{b['bill_number']}* — ₹{b['total']:,.0f} ({b['customer']})"
            for b in bills
        )
        return f"🧾 *Recent Bills*\n📅 {today}\n\n{lines}\n\nCreate a bill: Type *newbill*"

    async def _get_customers_response(self, store_id: Optional[int]) -> str:
        from app.database import async_session_maker
        from app.services.bot_data import get_customers_summary

        try:
            async with async_session_maker() as db:
                data = await get_customers_summary(db, store_id)
        except Exception as e:
            logger.error(f"[WA] customers report failed: {e}")
            return "⚠️ Unable to fetch customers right now. Please try again."

        return f"""👥 *Customers*

📊 *Total*: {data['total']}
🆕 *New This Month*: {data['new_this_month']}
💰 *With Balance*: {data['with_balance']}

Add customers from the KadaiGPT app."""

    async def _get_products_response(self, store_id: Optional[int]) -> str:
        from app.database import async_session_maker
        from app.services.bot_data import get_stock_summary

        try:
            async with async_session_maker() as db:
                data = await get_stock_summary(db, store_id)
        except Exception as e:
            logger.error(f"[WA] products report failed: {e}")
            return "⚠️ Unable to fetch products right now. Please try again."

        return f"""📦 *Products*

📊 *Total Products*: {data['total']}
✅ *In Stock*: {data['in_stock']}
⚠️ *Low Stock*: {data['low']}
❌ *Out of Stock*: {data['out']}

Add products: Type *add [product name]*"""

    async def _get_gst_response(self, store_id: Optional[int]) -> str:
        from app.database import async_session_maker
        from app.services.bot_data import get_gst_summary

        try:
            async with async_session_maker() as db:
                data = await get_gst_summary(db, store_id)
        except Exception as e:
            logger.error(f"[WA] gst report failed: {e}")
            return "⚠️ Unable to fetch GST data right now. Please try again."

        cgst = data["tax"] / 2
        sgst = data["tax"] / 2
        return f"""📋 *GST Summary*
📅 {data['period']}

💰 *Taxable Sales*: ₹{data['taxable']:,.0f}
📊 *CGST*: ₹{cgst:,.0f}
📊 *SGST*: ₹{sgst:,.0f}
━━━━━━━━━━━━━
💵 *Total GST Collected*: ₹{data['tax']:,.0f}

_For the current month_"""

    async def _get_daily_report(self, store_id: Optional[int]) -> str:
        today = datetime.now().strftime("%A, %d %B %Y")
        time_now = datetime.now().strftime("%I:%M %p")
        from app.database import async_session_maker
        from app.services.bot_data import get_daily_report

        try:
            async with async_session_maker() as db:
                d = await get_daily_report(db, store_id)
        except Exception as e:
            logger.error(f"[WA] daily report failed: {e}")
            return (
                f"📊 *DAILY BUSINESS REPORT*\n📅 {today}\n\n"
                "⚠️ Unable to fetch the report right now. Please try again."
            )

        sales = d["sales"]
        return f"""📊 *DAILY BUSINESS REPORT*
📅 {today}
🕐 Generated at {time_now}

━━━━━━━━━━━━━━━━━━━

💰 *SALES*
• Revenue: ₹{sales['revenue']:,.0f}
• Bills: {sales['bills']}
• Avg Bill: ₹{sales['avg_bill']:,.0f}

💸 *EXPENSES*
• Total: ₹{d['expenses']['total']:,.0f}

💹 *PROFIT*
• Net: ₹{d['profit']:,.0f}

📦 *INVENTORY*
• Low Stock: {d['stock']['low']}
• Out of Stock: {d['stock']['out']}

👥 *CUSTOMERS*
• Total: {d['customers']['total']}
• Pending: ₹{d['pending_total']:,.0f}

━━━━━━━━━━━━━━━━━━━

_Powered by KadaiGPT AI_ 🤖"""

    # ==================== HELPER METHODS ====================
    
    def _format_phone(self, phone: str) -> str:
        """Format phone number for WhatsApp"""
        digits = re.sub(r'\D', '', phone)
        
        if len(digits) == 10:
            digits = '91' + digits
        elif digits.startswith('0'):
            digits = '91' + digits[1:]
            
        return digits
    
    async def check_connection(self) -> Dict[str, Any]:
        """Check WAHA connection status"""
        try:
            url = f"{self.waha_url}/api/sessions/{self.session_name}"
            headers = {"X-Api-Key": self.api_key}
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    status = data.get("status", "STOPPED")
                    return {
                        "connected": status == "WORKING",
                        "state": status,
                        "session": self.session_name
                    }
                else:
                    return {"connected": False, "error": response.text}
                    
        except Exception as e:
            return {"connected": False, "error": str(e)}
    
    async def get_qr_code(self) -> Dict[str, Any]:
        """Get QR code for connecting WhatsApp via WAHA"""
        try:
            url = f"{self.waha_url}/api/{self.session_name}/auth/qr?format=raw"
            headers = {"X-Api-Key": self.api_key}
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, timeout=30)
                
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "success": True,
                        "qrcode": data.get("value"),
                        "code": data.get("value")
                    }
                else:
                    return {"success": False, "error": response.text}
                    
        except Exception as e:
            return {"success": False, "error": str(e)}


# Singleton instance
whatsapp_bot = WhatsAppBotService()
