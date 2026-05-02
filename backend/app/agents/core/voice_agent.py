"""
KadaiGPT - Voice AI Agent
Multi-lingual voice interface with speech-to-text and text-to-speech
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime
import re
import os

from .base_agent import BaseAgent, AgentTool, ActionType, logger

# Try to import Google Generative AI
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False


@dataclass
class VoiceCommand:
    """Parsed voice command"""
    text: str
    language: str
    intent: str
    entities: Dict
    confidence: float


class VoiceAIAgent(BaseAgent):
    """
    Voice AI Agent - Multi-lingual voice interface
    
    Capabilities:
    - Speech-to-text processing
    - Multi-language support (Hindi, Tamil, Telugu, English)
    - Voice command parsing
    - Context-aware responses
    - Natural language generation for spoken output
    - Hands-free billing
    """
    
    def __init__(self, store_id: int):
        self.supported_languages = {
            "en": "English",
            "hi": "Hindi",
            "ta": "Tamil",
            "te": "Telugu",
            "kn": "Kannada",
            "ml": "Malayalam"
        }
        
        # Initialize Gemini for NLU
        if GEMINI_AVAILABLE:
            api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
            if api_key:
                genai.configure(api_key=api_key)
                self.model = genai.GenerativeModel('gemini-pro')
            else:
                self.model = None
        else:
            self.model = None
        
        # Voice command patterns (multilingual)
        self.command_patterns = {
            "add_product": {
                "en": [r"add (.+)", r"put (.+)", r"include (.+)"],
                "hi": [r"(.+) add karo", r"(.+) dalo", r"(.+) lagao"],
                "ta": [r"(.+) சேர்", r"(.+) போடு"],
                "te": [r"(.+) add cheyyi", r"(.+) pettу"]
            },
            "remove_product": {
                "en": [r"remove (.+)", r"delete (.+)", r"cancel (.+)"],
                "hi": [r"(.+) hatao", r"(.+) nikalo"],
                "ta": [r"(.+) நீக்கு", r"(.+) తీసేయ్"]
            },
            "check_price": {
                "en": [r"price of (.+)", r"how much (.+)", r"cost of (.+)"],
                "hi": [r"(.+) ka price", r"(.+) kitna hai", r"(.+) ka daam"],
                "ta": [r"(.+) விலை என்ன", r"(.+) எவ்வளவு"],
                "te": [r"(.+) rate enti", r"(.+) entha"]
            },
            "check_stock": {
                "en": [r"stock of (.+)", r"how much (.+) left", r"do we have (.+)"],
                "hi": [r"(.+) stock", r"(.+) kitna bacha", r"(.+) hai kya"],
                "ta": [r"(.+) stock", r"(.+) இருக்கா"],
                "te": [r"(.+) stock undi", r"(.+) unda"]
            },
            "apply_discount": {
                "en": [r"(\d+) percent (?:off|discount)", r"give (\d+)% discount"],
                "hi": [r"(\d+) percent discount", r"(\d+)% de do"],
            },
            "complete_bill": {
                "en": [r"complete (?:the )?bill", r"finish bill", r"done", r"that's all", r"final"],
                "hi": [r"bill bana", r"bill karo", r"bas itna", r"ho gaya"],
                "ta": [r"bill போடு", r"முடிச்சு"],
                "te": [r"bill cheyyi", r"aipoindi"]
            },
            "payment": {
                "en": [r"cash", r"upi", r"card", r"credit", r"debit", r"online"],
                "hi": [r"cash", r"upi", r"card"],
            },
            "read_total": {
                "en": [r"what's the total", r"total", r"how much", r"bill amount"],
                "hi": [r"total kitna", r"kitna hua", r"total batao"],
            }
        }
        
        # Product name mappings (common variations)
        self.product_aliases = {
            "rice": ["chawal", "arisi", "biyyam", "rice"],
            "dal": ["daal", "dal", "paruppu", "pappu"],
            "sugar": ["cheeni", "sakkar", "sugar"],
            "salt": ["namak", "uppu", "salt"],
            "oil": ["tel", "oil", "ennai"],
            "milk": ["doodh", "paal", "milk"],
            "flour": ["atta", "maida", "flour"],
            "tea": ["chai", "tea", "chai patti"],
        }
        
        super().__init__(
            name="VoiceAgent",
            description="Multi-lingual voice interface for hands-free operations",
            store_id=store_id
        )
    
    def _register_default_tools(self):
        """Register voice-specific tools"""
        
        self.register_tool(AgentTool(
            name="parse_voice_command",
            description="Parse voice input and extract intent",
            parameters={"text": "voice transcription", "language": "detected language"},
            action_type=ActionType.QUERY,
            handler=self._parse_voice_command
        ))
        
        self.register_tool(AgentTool(
            name="process_billing_command",
            description="Process a billing-related voice command",
            parameters={"command": "parsed command"},
            action_type=ActionType.MUTATION,
            handler=self._process_billing_command
        ))
        
        self.register_tool(AgentTool(
            name="generate_voice_response",
            description="Generate natural language response for TTS",
            parameters={"intent": "response intent", "data": "response data"},
            action_type=ActionType.QUERY,
            handler=self._generate_voice_response
        ))
        
        self.register_tool(AgentTool(
            name="translate_response",
            description="Translate response to target language",
            parameters={"text": "text to translate", "target_lang": "target language code"},
            action_type=ActionType.QUERY,
            handler=self._translate_response
        ))
        
        self.register_tool(AgentTool(
            name="handle_conversation",
            description="Handle multi-turn conversation",
            parameters={"user_input": "current user input", "context": "conversation context"},
            action_type=ActionType.QUERY,
            handler=self._handle_conversation
        ))

    async def think(self, input_data: Dict) -> Dict:
        """Voice-specific reasoning"""
        text = input_data.get('goal', '')
        language = input_data.get('language', 'en')
        
        # First parse the command
        command = await self._parse_voice_command(text, language)
        
        if command["intent"] != "unknown":
            return {
                "action": "process_billing_command",
                "parameters": {"command": command},
                "reasoning": f"Processing {command['intent']} command"
            }
        else:
            # Use Gemini for complex understanding
            return {
                "action": "handle_conversation",
                "parameters": {"user_input": text, "context": input_data.get('context', {})},
                "reasoning": "Using AI for complex query understanding"
            }

    # ==================== Tool Handlers ====================
    
    async def _parse_voice_command(self, text: str, language: str = "en") -> Dict:
        """Parse voice command and extract intent"""
        
        text_lower = text.lower().strip()
        detected_intent = "unknown"
        entities = {}
        confidence = 0.0
        
        # Try pattern matching for each intent
        for intent, lang_patterns in self.command_patterns.items():
            patterns = lang_patterns.get(language, lang_patterns.get("en", []))
            
            for pattern in patterns:
                match = re.search(pattern, text_lower)
                if match:
                    detected_intent = intent
                    confidence = 0.9
                    
                    # Extract entities from match groups
                    if match.groups():
                        if intent in ["add_product", "remove_product", "check_price", "check_stock"]:
                            entities["product"] = match.group(1).strip()
                        elif intent == "apply_discount":
                            entities["discount"] = int(match.group(1))
                    break
            
            if detected_intent != "unknown":
                break
        
        # Normalize product names
        if "product" in entities:
            entities["normalized_product"] = self._normalize_product_name(entities["product"])
        
        # Extract quantity if present
        qty_match = re.search(r'(\d+(?:\.\d+)?)\s*(kg|g|l|ml|litre|liter|packet|pcs|piece|dozen)?', text_lower)
        if qty_match:
            entities["quantity"] = float(qty_match.group(1))
            entities["unit"] = qty_match.group(2) or "pcs"
        
        return {
            "original_text": text,
            "language": language,
            "intent": detected_intent,
            "entities": entities,
            "confidence": confidence
        }
    
    def _normalize_product_name(self, product: str) -> str:
        """Normalize product name across languages"""
        product_lower = product.lower()
        
        for standard_name, aliases in self.product_aliases.items():
            for alias in aliases:
                if alias in product_lower:
                    return standard_name
        
        return product
    
    async def _process_billing_command(self, command: Dict) -> Dict:
        """Process billing-related voice command"""
        
        intent = command.get("intent")
        entities = command.get("entities", {})
        
        if intent == "add_product":
            product = entities.get("normalized_product", entities.get("product", ""))
            quantity = entities.get("quantity", 1)
            unit = entities.get("unit", "pcs")
            
            # Simulate adding to bill
            return {
                "status": "success",
                "action": "product_added",
                "product": product,
                "quantity": quantity,
                "unit": unit,
                "message": f"Added {quantity} {unit} of {product} to bill",
                "spoken_response": f"Added {quantity} {unit} of {product}"
            }
        
        elif intent == "remove_product":
            product = entities.get("normalized_product", entities.get("product", ""))
            return {
                "status": "success",
                "action": "product_removed",
                "product": product,
                "message": f"Removed {product} from bill",
                "spoken_response": f"Removed {product}"
            }
        
        elif intent == "check_price":
            product = entities.get("normalized_product", entities.get("product", ""))
            # Mock price lookup
            prices = {"rice": 85, "dal": 140, "sugar": 45, "oil": 180, "milk": 60}
            price = prices.get(product, "unknown")
            
            return {
                "status": "success",
                "action": "price_checked",
                "product": product,
                "price": price,
                "spoken_response": f"{product} is {price} rupees per kg" if price != "unknown" else f"Sorry, I couldn't find price for {product}"
            }
        
        elif intent == "check_stock":
            product = entities.get("normalized_product", entities.get("product", ""))
            # Mock stock lookup
            stock = {"rice": "45 kg", "dal": "8 kg", "sugar": "120 kg"}
            available = stock.get(product, "unknown")
            
            return {
                "status": "success",
                "action": "stock_checked",
                "product": product,
                "stock": available,
                "spoken_response": f"We have {available} of {product}" if available != "unknown" else f"Couldn't find stock info for {product}"
            }
        
        elif intent == "apply_discount":
            discount = entities.get("discount", 0)
            return {
                "status": "success",
                "action": "discount_applied",
                "discount": discount,
                "spoken_response": f"Applied {discount} percent discount"
            }
        
        elif intent == "complete_bill":
            return {
                "status": "success",
                "action": "bill_completed",
                "spoken_response": "Bill completed. Total is 523 rupees. Payment mode?"
            }
        
        elif intent == "payment":
            return {
                "status": "success",
                "action": "payment_received",
                "method": entities.get("text", "cash"),
                "spoken_response": "Payment received. Thank you! Receipt printing."
            }
        
        elif intent == "read_total":
            return {
                "status": "success",
                "action": "total_read",
                "total": 523,
                "spoken_response": "Current total is 5 hundred and 23 rupees"
            }
        
        else:
            return {
                "status": "unknown",
                "action": "clarify",
                "spoken_response": "Sorry, I didn't understand. Please repeat."
            }
    
    async def _generate_voice_response(self, intent: str, data: Dict) -> Dict:
        """Generate natural language response for TTS"""
        
        responses = {
            "product_added": "Added {quantity} {unit} of {product}. Anything else?",
            "product_removed": "Removed {product}. What else?",
            "price_checked": "{product} costs {price} rupees per kg",
            "stock_checked": "We have {stock} of {product} in stock",
            "discount_applied": "Done! {discount} percent discount applied",
            "bill_completed": "Bill ready. Total is {total} rupees. Cash or UPI?",
            "greeting": "Hello! I'm ready for billing. What items?",
            "thank_you": "Thank you for shopping with us! Have a great day!",
            "error": "Sorry, something went wrong. Please try again."
        }
        
        template = responses.get(intent, responses["error"])
        
        try:
            spoken_text = template.format(**data)
        except KeyError:
            spoken_text = template
        
        return {
            "intent": intent,
            "spoken_text": spoken_text,
            "ssml": f"<speak>{spoken_text}</speak>",  # For advanced TTS
            "duration_estimate": len(spoken_text.split()) * 0.4  # Approximate seconds
        }
    
    async def _translate_response(self, text: str, target_lang: str = "en") -> Dict:
        """Translate response to target language"""
        
        # Common translations for key phrases
        translations = {
            "hi": {
                "Added": "Add kar diya",
                "Total is": "Total hai",
                "rupees": "rupaye",
                "Thank you": "Dhanyavaad",
                "Anything else": "Aur kuch",
            },
            "ta": {
                "Added": "சேர்த்தேன்",
                "Total is": "மொத்தம்",
                "rupees": "ரூபாய்",
                "Thank you": "நன்றி",
            }
        }
        
        if target_lang == "en":
            return {"translated_text": text, "language": "en"}
        
        # Simple word replacement (in production, use proper translation API)
        translated = text
        lang_dict = translations.get(target_lang, {})
        for eng, trans in lang_dict.items():
            translated = translated.replace(eng, trans)
        
        return {
            "original_text": text,
            "translated_text": translated,
            "language": target_lang,
            "note": "Basic translation - use professional API for accuracy"
        }
    
    async def _handle_conversation(self, user_input: str, context: Dict = None) -> Dict:
        """Handle multi-turn conversation using Gemini"""
        
        context = context or {}
        conversation_history = context.get("history", [])
        
        # Add current input to history
        conversation_history.append({"role": "user", "text": user_input})
        
        if self.model:
            prompt = f"""You are a helpful voice assistant for a retail store in India.
The user said: "{user_input}"

Previous conversation:
{conversation_history[-5:] if conversation_history else "None"}

Respond naturally and concisely (max 2 sentences) to help with:
- Adding/removing products from bill
- Checking prices or stock
- Applying discounts
- Completing transactions

Respond in the same language the user spoke in.
"""
            try:
                response = self.model.generate_content(prompt)
                assistant_response = response.text
            except Exception as e:
                logger.error(f"Gemini error: {e}")
                assistant_response = "I understand. How can I help you with billing today?"
        else:
            # Fallback response
            assistant_response = "I'm ready to help with your billing. What would you like to add?"
        
        # Add response to history
        conversation_history.append({"role": "assistant", "text": assistant_response})
        
        return {
            "user_input": user_input,
            "response": assistant_response,
            "spoken_response": assistant_response,
            "conversation_history": conversation_history[-10:],  # Keep last 10 turns
            "status": "success"
        }
    
    # ==================== High-Level Voice Interface ====================
    
    async def process_voice_input(self, audio_text: str, language: str = "en") -> Dict:
        """
        Main entry point for voice input processing
        Returns structured response with text for TTS
        """
        
        # Add to memory
        self.memory.add_to_short_term({
            "type": "voice_input",
            "text": audio_text,
            "language": language
        })
        
        # Parse and process
        command = await self._parse_voice_command(audio_text, language)
        
        if command["intent"] != "unknown":
            result = await self._process_billing_command(command)
        else:
            result = await self._handle_conversation(audio_text, {
                "history": self.memory.short_term
            })
        
        # Translate if needed
        if language != "en" and "spoken_response" in result:
            translation = await self._translate_response(result["spoken_response"], language)
            result["spoken_response"] = translation["translated_text"]
        
        return {
            "input": audio_text,
            "language": language,
            "intent": command.get("intent", "conversation"),
            "response": result,
            "timestamp": datetime.now().isoformat()
        }
