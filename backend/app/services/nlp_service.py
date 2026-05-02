"""
Advanced NLP Service for KadaiGPT WhatsApp Bot
Uses Google Gemini AI for natural language understanding and voice transcription
"""

import httpx
import json
import re
import base64
import logging
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime
from app.config import settings

logger = logging.getLogger(__name__)

# Gemini API configuration
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models"
GEMINI_MODEL = "gemini-1.5-flash"


class NLPService:
    """Advanced NLP service with AI-powered intent detection and voice support"""
    
    def __init__(self):
        self.api_key = settings.google_api_key
        self.store_context = ""
        
        # Business-specific prompt for understanding retail queries
        self.system_prompt = """You are KadaiGPT, an AI assistant for Indian retail shop owners.
You understand queries in English, Hindi, Tamil, and mixed languages (Hinglish, Tanglish).

Your job is to:
1. Understand the user's intent from their message
2. Extract relevant entities (product names, quantities, customer names, amounts, dates)
3. Return a structured response

For each message, return a JSON object with:
{
    "intent": "one of: sales_query, expense_query, profit_query, stock_query, bill_query, customer_query, create_bill, add_product, set_reminder, payment_reminder, greeting, help, thanks, prediction, gst_query, pending_payments, general_question, unknown",
    "confidence": 0.0-1.0,
    "entities": {
        "product_name": "if mentioned",
        "quantity": "if mentioned",
        "customer_name": "if mentioned",
        "phone": "if mentioned",
        "amount": "if mentioned",
        "date": "if mentioned",
        "time_period": "today/yesterday/week/month/year if mentioned"
    },
    "suggested_response": "Friendly response to send to user",
    "action_required": "specific action to take if any",
    "original_language": "detected language"
}

Examples:
- "aaj ki bikri kitni hui" -> sales_query, time_period: today
- "sugar ka stock check karo" -> stock_query, product_name: sugar
- "Rajesh uncle ko yaad dilao" -> payment_reminder, customer_name: Rajesh
- "kal kitna kamaya" -> profit_query, time_period: yesterday
- "bill banao 2kg chawal" -> create_bill, product_name: chawal, quantity: 2kg"""

    async def process_text(self, text: str, context: Dict = None) -> Dict[str, Any]:
        """
        Process text using Gemini AI for advanced NLP understanding
        Falls back to rule-based if AI is unavailable
        """
        if not self.api_key:
            logger.info("No Gemini API key, using rule-based NLP")
            return self._rule_based_process(text)
        
        try:
            result = await self._call_gemini_text(text, context)
            return result
        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            return self._rule_based_process(text)

    async def transcribe_voice(self, audio_data: bytes, mime_type: str = "audio/ogg") -> Dict[str, Any]:
        """
        Transcribe voice message using Gemini's multimodal capabilities
        """
        if not self.api_key:
            return {
                "success": False,
                "error": "Voice transcription requires Gemini API key",
                "text": None
            }
        
        try:
            result = await self._call_gemini_audio(audio_data, mime_type)
            return result
        except Exception as e:
            logger.error(f"Voice transcription error: {e}")
            return {
                "success": False,
                "error": str(e),
                "text": None
            }

    async def _call_gemini_text(self, text: str, context: Dict = None) -> Dict[str, Any]:
        """Call Gemini API for text understanding"""
        url = f"{GEMINI_API_URL}/{GEMINI_MODEL}:generateContent?key={self.api_key}"
        
        # Build context string
        context_str = ""
        if context:
            context_str = f"\n\nContext: {json.dumps(context)}"
        
        payload = {
            "contents": [{
                "parts": [{
                    "text": f"{self.system_prompt}{context_str}\n\nUser message: {text}\n\nRespond with JSON only."
                }]
            }],
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 1024,
                "responseMimeType": "application/json"
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=30)
            
            if response.status_code != 200:
                logger.error(f"Gemini API error: {response.text}")
                return self._rule_based_process(text)
            
            data = response.json()
            
            # Extract the generated text
            try:
                generated = data["candidates"][0]["content"]["parts"][0]["text"]
                result = json.loads(generated)
                result["ai_processed"] = True
                return result
            except (KeyError, json.JSONDecodeError) as e:
                logger.error(f"Failed to parse Gemini response: {e}")
                return self._rule_based_process(text)

    async def _call_gemini_audio(self, audio_data: bytes, mime_type: str) -> Dict[str, Any]:
        """Call Gemini API for audio transcription"""
        url = f"{GEMINI_API_URL}/{GEMINI_MODEL}:generateContent?key={self.api_key}"
        
        # Encode audio as base64
        audio_base64 = base64.b64encode(audio_data).decode('utf-8')
        
        payload = {
            "contents": [{
                "parts": [
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": audio_base64
                        }
                    },
                    {
                        "text": """Transcribe this voice message. The speaker is likely an Indian retail shop owner speaking in:
- Hindi
- English
- Tamil
- Mixed languages (Hinglish/Tanglish)

Return a JSON object with:
{
    "transcription": "the transcribed text",
    "language": "detected language",
    "confidence": 0.0-1.0
}

Just return the JSON, no additional text."""
                    }
                ]
            }],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 500,
                "responseMimeType": "application/json"
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=60)
            
            if response.status_code != 200:
                logger.error(f"Gemini audio error: {response.text}")
                return {"success": False, "error": response.text, "text": None}
            
            data = response.json()
            
            try:
                generated = data["candidates"][0]["content"]["parts"][0]["text"]
                result = json.loads(generated)
                return {
                    "success": True,
                    "text": result.get("transcription", ""),
                    "language": result.get("language", "unknown"),
                    "confidence": result.get("confidence", 0.0)
                }
            except (KeyError, json.JSONDecodeError) as e:
                logger.error(f"Failed to parse audio response: {e}")
                return {"success": False, "error": str(e), "text": None}

    def _rule_based_process(self, text: str) -> Dict[str, Any]:
        """
        Fallback rule-based NLP when AI is unavailable
        Enhanced with multi-language support
        """
        clean = text.lower().strip()
        
        # Intent patterns with multi-language support
        patterns = {
            'greeting': {
                'keywords': ['hi', 'hello', 'hey', 'namaste', 'vanakkam', 'namaskar', 'hola', 
                            'good morning', 'good evening', 'how are you', 'kaise ho', 'eppadi irukeenga'],
                'response': "🙏 Namaste! I'm KadaiGPT, your AI business assistant. How can I help you today?\n\nTry: *sales*, *stock*, *help*"
            },
            'sales_query': {
                'keywords': ['sales', 'bikri', 'sell', 'sold', 'revenue', 'collection', 'kamai',
                            'விற்பனை', 'बिक्री', 'kitna becha', 'aaj ki bikri', 'how much sell'],
                'response': None  # Dynamic response
            },
            'expense_query': {
                'keywords': ['expense', 'kharcha', 'spent', 'cost', 'expenditure', 'kharch', 
                            'செலவு', 'खर्च', 'kitna kharch', 'spending'],
                'response': None
            },
            'profit_query': {
                'keywords': ['profit', 'munafa', 'margin', 'kamai', 'earning', 'fayda',
                            'லாபம்', 'लाभ', 'kitna kamaya', 'net income'],
                'response': None
            },
            'stock_query': {
                'keywords': ['stock', 'inventory', 'maal', 'available', 'left', 'quantity',
                            'சரக்கு', 'स्टॉक', 'kitna maal', 'low stock', 'out of stock'],
                'response': None
            },
            'bill_query': {
                'keywords': ['bill', 'invoice', 'receipt', 'బిల్', 'பில்', 'बिल',
                            'last bill', 'recent bill', 'show bills'],
                'response': None
            },
            'customer_query': {
                'keywords': ['customer', 'grahak', 'client', 'வாடிக்கையாளர்', 'ग्राहक',
                            'credit customer', 'pending customer', 'kiske paas'],
                'response': None
            },
            'create_bill': {
                'keywords': ['new bill', 'create bill', 'make bill', 'bill banao', 'billing',
                            'புதிய பில்', 'नया बिल', 'start billing'],
                'response': "🧾 Starting bill creation...\nPlease provide:\n1. Customer phone (or type 'skip')\n2. Product and quantity\n\nExample: *9876543210 Rice 2kg*"
            },
            'help': {
                'keywords': ['help', 'madad', 'commands', 'what can you do', 'kya kar sakte ho',
                            'உதவி', 'मदद', 'how to use'],
                'response': self._get_help_message()
            },
            'thanks': {
                'keywords': ['thanks', 'thank you', 'dhanyawad', 'shukriya', 'நன்றி', 'धन्यवाद'],
                'response': "🙏 You're welcome! Happy to help. Type *help* anytime!"
            },
            'pending_payments': {
                'keywords': ['pending', 'udhar', 'credit', 'owe', 'baki', 'outstanding',
                            'கடன்', 'उधार', 'kiska baki'],
                'response': None
            },
            'prediction': {
                'keywords': ['predict', 'forecast', 'future', 'next week', 'trend',
                            'எதிர்வுகூறல்', 'भविष्यवाणी', 'aage ka'],
                'response': None
            }
        }
        
        # Find best matching intent
        best_intent = 'unknown'
        best_score = 0
        
        for intent, data in patterns.items():
            score = sum(1 for kw in data['keywords'] if kw in clean)
            if score > best_score:
                best_score = score
                best_intent = intent
        
        # Extract entities
        entities = self._extract_entities(clean)
        
        # Build response
        response = patterns.get(best_intent, {}).get('response')
        if not response:
            response = self._get_intent_response(best_intent)
        
        return {
            "intent": best_intent,
            "confidence": min(1.0, best_score * 0.4) if best_score > 0 else 0.3,
            "entities": entities,
            "suggested_response": response,
            "ai_processed": False
        }

    def _extract_entities(self, text: str) -> Dict[str, Any]:
        """Extract entities from text"""
        entities = {}
        
        # Extract numbers
        numbers = re.findall(r'\d+(?:\.\d+)?', text)
        if numbers:
            entities['numbers'] = [float(n) for n in numbers]
        
        # Extract phone numbers (10 digits)
        phones = re.findall(r'\b\d{10}\b', text)
        if phones:
            entities['phone'] = phones[0]
        
        # Extract amounts with currency
        amounts = re.findall(r'(?:rs\.?|₹|rupees?)\s*(\d+(?:,\d+)*(?:\.\d+)?)', text, re.IGNORECASE)
        if amounts:
            entities['amount'] = float(amounts[0].replace(',', ''))
        
        # Extract time periods
        if any(t in text for t in ['today', 'aaj', 'இன்று', 'आज']):
            entities['time_period'] = 'today'
        elif any(t in text for t in ['yesterday', 'kal', 'நேற்று', 'कल']):
            entities['time_period'] = 'yesterday'
        elif any(t in text for t in ['week', 'hafte', 'வாரம்', 'हफ्ता']):
            entities['time_period'] = 'week'
        elif any(t in text for t in ['month', 'mahine', 'மாதம்', 'महीना']):
            entities['time_period'] = 'month'
        
        # Extract quantities with units
        qty_patterns = [
            r'(\d+(?:\.\d+)?)\s*(kg|kilo|gram|g|liter|litre|l|piece|pcs|packet|pack)',
        ]
        for pattern in qty_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                entities['quantity'] = match.group(1)
                entities['unit'] = match.group(2)
                break
        
        return entities

    def _get_help_message(self) -> str:
        """Get help message"""
        return """🤖 *KadaiGPT AI Assistant*

📊 *Reports*
• "aaj ki bikri" → Today's sales
• "kitna kamaya" → Profit report
• "kharcha dikhao" → Expenses

📦 *Inventory*
• "stock check karo" → Check stock
• "low stock items" → Low alerts
• "sugar ka stock" → Product stock

🧾 *Billing*
• "bill banao" → Create bill
• "last 5 bills" → Recent bills
• "send bill" → WhatsApp bill

👥 *Customers*
• "pending payments" → Credit list
• "remind Rajesh" → Send reminder

🎤 *Voice Messages*
Just send a voice note in any language!
I understand Hindi, English, Tamil & more.

_Ask anything naturally - I understand you!_ 💬"""

    def _get_intent_response(self, intent: str) -> str:
        """Get default response for an intent"""
        responses = {
            'sales_query': "📊 Let me check your sales...",
            'expense_query': "💰 Checking your expenses...",
            'profit_query': "📈 Calculating your profit...",
            'stock_query': "📦 Checking inventory...",
            'bill_query': "🧾 Fetching recent bills...",
            'customer_query': "👥 Loading customer data...",
            'pending_payments': "💳 Checking pending payments...",
            'prediction': "🔮 Generating AI predictions...",
            'unknown': "🤔 I'm not sure what you mean. Try *help* to see what I can do!"
        }
        return responses.get(intent, responses['unknown'])


# Singleton instance
nlp_service = NLPService()
