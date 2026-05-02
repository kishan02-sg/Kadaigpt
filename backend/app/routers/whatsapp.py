"""
KadaiGPT - WhatsApp Bot Router
Webhook for receiving WhatsApp messages via Evolution API
Full 2-way bot with query handling and auto-responses
"""

from fastapi import APIRouter, Request, HTTPException, status, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import json
import logging
import httpx

from app.database import get_db
from app.config import settings
from app.services.whatsapp_bot import whatsapp_bot

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp"])


# ==================== SCHEMAS ====================

class WhatsAppMessage(BaseModel):
    """Incoming WhatsApp message"""
    from_: str
    type: str
    text: Optional[str] = None
    timestamp: str

class SendMessageRequest(BaseModel):
    """Request to send a message"""
    phone: str
    message: str
    
class WelcomeMessageRequest(BaseModel):
    """Request to send welcome message"""
    phone: str
    user_name: str


# ==================== WAHA WEBHOOK ====================

@router.post("/webhook")
async def waha_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Receive webhook events from WAHA (WhatsApp HTTP API)
    Events: message, session.status, etc.
    """
    try:
        body = await request.json()
        
        event = body.get("event", "")
        session = body.get("session", "default")
        
        logger.info(f"WhatsApp webhook received: {event} from session {session}")
        
        # WAHA message event
        if event == "message":
            payload = body.get("payload", {})
            background_tasks.add_task(handle_waha_message, payload)
            return {"status": "processing", "event": event}
        
        # WAHA session status
        elif event == "session.status":
            status = body.get("payload", {}).get("status", "")
            logger.info(f"WhatsApp session status: {status}")
            return {"status": "ok", "session_status": status}
        
        # Evolution API format (backward compatibility)
        elif event == "messages.upsert":
            data = body.get("data", {})
            background_tasks.add_task(handle_evolution_message, data)
            return {"status": "processing", "event": event}
            
        elif event == "connection.update":
            state = body.get("data", {}).get("state", "")
            logger.info(f"WhatsApp connection state: {state}")
            return {"status": "ok", "connection_state": state}
        
        # Legacy WhatsApp Cloud API format support
        elif "entry" in body:
            return await handle_legacy_webhook(body)
            
        else:
            # Try to process as WAHA message if no event type
            if "payload" in body and "from" in body.get("payload", {}):
                background_tasks.add_task(handle_waha_message, body.get("payload", {}))
                return {"status": "processing"}
            
            logger.debug(f"Unhandled webhook event: {event}")
            return {"status": "ok", "event": event}
            
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}


async def handle_waha_message(payload: Dict[str, Any]):
    """Process incoming WAHA WhatsApp message (text, voice, audio)"""
    try:
        # Skip if it's our own message
        if payload.get("fromMe", False):
            return
        
        # Get sender phone number (format: 91xxxxxxxx@c.us)
        from_id = payload.get("from", "")
        phone = from_id.replace("@c.us", "").replace("@s.whatsapp.net", "")
        
        # Check message type
        msg_type = payload.get("type", "text")
        
        # Handle voice/audio messages
        if msg_type in ["audio", "ptt"]:  # ptt = push to talk (voice note)
            logger.info(f"Voice message from {phone}")
            
            # Try to get audio data from WAHA
            audio_url = payload.get("mediaUrl") or payload.get("body")
            if audio_url:
                response = await whatsapp_bot.process_voice_message(phone, audio_url)
            else:
                response = "🎤 I received your voice message but couldn't process it. Please try sending text instead."
            
            if response:
                await whatsapp_bot.send_message(phone, response)
            return
        
        # Handle text messages
        text = ""
        if payload.get("body"):
            text = payload.get("body")
        elif payload.get("text"):
            text = payload.get("text")
        
        if not text:
            logger.debug("No text content in message")
            return
            
        logger.info(f"Message from {phone}: {text}")
        
        # Process message and get response
        response = await whatsapp_bot.process_incoming_message(phone, text)
        
        # Send response
        if response:
            await whatsapp_bot.send_message(phone, response)
            logger.info(f"Response sent to {phone}")
            
    except Exception as e:
        logger.error(f"Error handling WAHA message: {e}")


async def handle_evolution_message(data: Dict[str, Any]):
    """Process incoming Evolution API WhatsApp message"""
    try:
        # Extract message details
        key = data.get("key", {})
        message_content = data.get("message", {})
        
        # Skip if it's our own message
        if key.get("fromMe", False):
            return
            
        # Get sender phone number
        remote_jid = key.get("remoteJid", "")
        phone = remote_jid.replace("@s.whatsapp.net", "").replace("@c.us", "")
        
        # Get message text
        text = ""
        if "conversation" in message_content:
            text = message_content["conversation"]
        elif "extendedTextMessage" in message_content:
            text = message_content["extendedTextMessage"].get("text", "")
        elif "buttonsResponseMessage" in message_content:
            text = message_content["buttonsResponseMessage"].get("selectedButtonId", "")
        elif "listResponseMessage" in message_content:
            text = message_content["listResponseMessage"].get("singleSelectReply", {}).get("selectedRowId", "")
            
        if not text:
            logger.debug("No text content in message")
            return
            
        logger.info(f"Message from {phone}: {text}")
        
        # Process message and get response
        response = await whatsapp_bot.process_incoming_message(phone, text)
        
        # Send response
        if response:
            await whatsapp_bot.send_message(phone, response)
            logger.info(f"Response sent to {phone}")
            
    except Exception as e:
        logger.error(f"Error handling Evolution message: {e}")


async def handle_legacy_webhook(body: dict) -> dict:
    """Handle legacy WhatsApp Cloud API format"""
    try:
        entry = body.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})
        messages = value.get("messages", [])
        
        if not messages:
            return {"status": "no messages"}
        
        message = messages[0]
        from_number = message.get("from", "")
        msg_type = message.get("type", "text")
        
        if msg_type == "text":
            text = message.get("text", {}).get("body", "").strip()
            response = await whatsapp_bot.process_incoming_message(from_number, text)
            
            logger.info(f"[WhatsApp Bot] From: {from_number}, Message: {text}")
            
            return {
                "status": "processed",
                "from": from_number,
                "response": response
            }
        
        return {"status": "unsupported message type"}
        
    except Exception as e:
        logger.error(f"[WhatsApp Bot] Legacy webhook error: {e}")
        return {"status": "error", "detail": str(e)}


# ==================== VERIFY WEBHOOK (for Meta API) ====================

@router.get("/webhook")
async def verify_webhook(
    mode: Optional[str] = None,
    token: Optional[str] = None,
    challenge: Optional[str] = None
):
    """
    WhatsApp webhook verification endpoint (Meta Cloud API)
    """
    verify_token = getattr(settings, 'WHATSAPP_VERIFY_TOKEN', 'kadaigpt_verify_token')
    
    if mode == "subscribe" and token == verify_token:
        return int(challenge) if challenge else "OK"
    
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Verification failed"
    )


# ==================== SEND MESSAGE ENDPOINTS ====================

@router.post("/send")
async def send_message(request: SendMessageRequest):
    """Send a WhatsApp message via Evolution API"""
    result = await whatsapp_bot.send_message(request.phone, request.message)
    
    if result.get("success"):
        return {"success": True, "message": "Message sent", "data": result.get("data")}
    else:
        # Fallback to wa.me link
        phone = request.phone.replace(" ", "").replace("-", "")
        if len(phone) == 10:
            phone = "91" + phone
        
        return {
            "success": False,
            "fallback": True,
            "whatsapp_link": f"https://wa.me/{phone}?text={request.message.replace(' ', '%20')}",
            "error": result.get("error"),
            "instructions": "Evolution API not available. Use this link to send manually."
        }


@router.post("/welcome")
async def send_welcome(request: WelcomeMessageRequest):
    """Send welcome message to new user"""
    result = await whatsapp_bot.send_welcome_message(request.phone, request.user_name)
    
    if result.get("success"):
        return {"success": True, "message": "Welcome message sent"}
    else:
        return {"success": False, "error": result.get("error")}


# ==================== STATUS & CONNECTION ====================

@router.get("/status")
async def get_connection_status():
    """Check WhatsApp/Evolution API connection status"""
    status = await whatsapp_bot.check_connection()
    return status


@router.get("/qrcode")
async def get_qr_code():
    """Get QR code for WhatsApp connection"""
    result = await whatsapp_bot.get_qr_code()
    
    if result.get("success"):
        return result
    else:
        return {"success": False, "error": result.get("error", "Failed to get QR code")}


# ==================== BOT TESTING ====================

@router.post("/test")
async def test_bot_response(message: str):
    """Test bot response without sending WhatsApp message"""
    response = await whatsapp_bot.process_incoming_message("test", message)
    return {"input": message, "response": response}


@router.get("/test-commands")
async def get_test_commands():
    """Get list of available bot commands for testing"""
    return {
        "commands": [
            {"command": "hi", "description": "Greeting"},
            {"command": "help", "description": "Show all commands"},
            {"command": "sales", "description": "Today's sales report"},
            {"command": "expense", "description": "Today's expenses"},
            {"command": "profit", "description": "Profit/loss report"},
            {"command": "stock", "description": "Low stock alerts"},
            {"command": "bills", "description": "Recent bills"},
            {"command": "customers", "description": "Customer list"},
            {"command": "products", "description": "Product inventory"},
            {"command": "gst", "description": "GST summary"},
            {"command": "report", "description": "Full daily report"},
        ]
    }


# ==================== TEMPLATES ====================

@router.get("/templates")
async def get_templates():
    """Get available message templates"""
    return {
        "templates": [
            {
                "id": "welcome",
                "name": "Welcome Message",
                "description": "Send to new users",
                "variables": ["user_name"]
            },
            {
                "id": "bill_receipt",
                "name": "Bill Receipt",
                "description": "Send bill details to customer",
                "variables": ["bill_number", "customer_name", "total", "items"]
            },
            {
                "id": "payment_reminder",
                "name": "Payment Reminder",
                "description": "Remind customer about pending dues",
                "variables": ["customer_name", "amount", "due_date"]
            },
            {
                "id": "low_stock_alert",
                "name": "Low Stock Alert",
                "description": "Alert about low stock items",
                "variables": ["product_count", "products"]
            },
            {
                "id": "daily_summary",
                "name": "Daily Summary",
                "description": "End of day business summary",
                "variables": ["date", "sales", "bills", "profit"]
            }
        ]
    }


# ==================== BULK OPERATIONS ====================

@router.post("/bulk-send")
async def send_bulk_messages(
    phones: List[str],
    message: str,
    background_tasks: BackgroundTasks
):
    """Send message to multiple recipients"""
    
    async def send_bulk():
        results = []
        for phone in phones[:50]:  # Limit to 50
            result = await whatsapp_bot.send_message(phone, message)
            results.append({"phone": phone, **result})
            # Add delay between messages
            import asyncio
            await asyncio.sleep(2)
        return results
    
    background_tasks.add_task(send_bulk)
    
    return {
        "status": "queued",
        "total": min(len(phones), 50),
        "message": "Bulk messages are being sent in background"
    }


@router.get("/stats")
async def get_whatsapp_stats():
    """Get WhatsApp bot statistics"""
    # TODO: Implement with real database tracking
    return {
        "connection_status": (await whatsapp_bot.check_connection()).get("connected", False),
        "messages_processed": 0,
        "auto_replies": 0,
        "reminders_sent": 0,
        "bills_shared": 0,
        "last_message": None
    }


# ==================== USER MANAGEMENT FOR WHATSAPP BOT ====================

# In-memory user store (replace with DB in production)
whatsapp_users = {}


class WhatsAppUserRegister(BaseModel):
    """WhatsApp user registration"""
    phone: str
    store_name: str
    user_name: str


class ProcessMessageRequest(BaseModel):
    """Process incoming message"""
    phone: str
    message: str


@router.get("/user/{phone}")
async def get_whatsapp_user(phone: str):
    """Check if user is registered via WhatsApp"""
    # Clean phone number
    clean_phone = phone.replace("+", "").replace(" ", "").replace("-", "")
    
    if clean_phone in whatsapp_users:
        return {"user": whatsapp_users[clean_phone]}
    
    # TODO: Check database
    return {"user": None}


@router.post("/register")
async def register_whatsapp_user(request: WhatsAppUserRegister):
    """Register a new user via WhatsApp"""
    clean_phone = request.phone.replace("+", "").replace(" ", "").replace("-", "")
    
    user = {
        "phone": clean_phone,
        "name": request.user_name,
        "store": request.store_name,
        "registered_at": datetime.now().isoformat(),
        "plan": "free_trial"
    }
    
    whatsapp_users[clean_phone] = user
    
    # TODO: Save to database
    logger.info(f"New WhatsApp user registered: {clean_phone} - {request.store_name}")
    
    return {"success": True, "user": user}


@router.post("/process")
async def process_whatsapp_message(request: ProcessMessageRequest):
    """Process incoming WhatsApp message and return response"""
    try:
        response = await whatsapp_bot.process_incoming_message(
            request.phone, 
            request.message
        )
        return {"response": response}
    except Exception as e:
        logger.error(f"Error processing message: {e}")
        return {"response": "Sorry, something went wrong. Please try again."}


@router.get("/connected-users")
async def get_connected_users():
    """Get list of connected WhatsApp users"""
    return {
        "total": len(whatsapp_users),
        "users": list(whatsapp_users.values())
    }
