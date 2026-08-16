"""
KadaiGPT - Telegram Bot Router
Webhook for receiving Telegram messages
Fast & reliable - No QR codes needed!
"""

from fastapi import APIRouter, Request, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Dict, Any
import logging
import os
import httpx

from app.config import settings
from app.database import get_db
from app.routers.auth import get_current_active_user
from app.services.telegram_bot import telegram_bot

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/telegram", tags=["Telegram"])


# ==================== WEBHOOK ====================

@router.post("/webhook")
async def telegram_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Receive webhook updates from Telegram Bot API
    """
    try:
        update = await request.json()
        
        logger.info(f"Telegram update received: {update.get('update_id')}")
        
        # Handle message updates
        if "message" in update:
            message = update["message"]
            chat_id = str(message.get("chat", {}).get("id", ""))
            text = message.get("text", "")
            user = message.get("from", {})
            user_name = user.get("first_name", "") + " " + user.get("last_name", "")
            user_name = user_name.strip() or "Friend"
            
            if text and chat_id:
                background_tasks.add_task(process_telegram_message, chat_id, text, user_name)
            
            return {"ok": True}
        
        # Handle callback queries (button clicks)
        elif "callback_query" in update:
            callback = update["callback_query"]
            chat_id = str(callback.get("message", {}).get("chat", {}).get("id", ""))
            data = callback.get("data", "")
            
            if data and chat_id:
                background_tasks.add_task(process_telegram_callback, chat_id, data)
            
            return {"ok": True}
        
        return {"ok": True}
        
    except Exception as e:
        logger.error(f"Telegram webhook error: {e}")
        return {"ok": False, "error": str(e)}


async def process_telegram_message(chat_id: str, text: str, user_name: str):
    """Process incoming Telegram message"""
    try:
        # Process message and get response (the bot handles /start itself so it
        # can show account-linking status and store-scoped data)
        response = await telegram_bot.process_incoming_message(chat_id, text, user_name)
        
        # Send response
        if response:
            await telegram_bot.send_message(chat_id, response)
            logger.info(f"Response sent to Telegram {chat_id}")
            
    except Exception as e:
        logger.error(f"Error processing Telegram message: {e}")
        await telegram_bot.send_message(chat_id, "Sorry, something went wrong. Please try again.")


async def process_telegram_callback(chat_id: str, data: str):
    """Process callback query from inline buttons"""
    try:
        response = await telegram_bot.process_incoming_message(chat_id, data)
        if response:
            await telegram_bot.send_message(chat_id, response)
    except Exception as e:
        logger.error(f"Error processing Telegram callback: {e}")


# ==================== API ENDPOINTS ====================

class SendMessageRequest(BaseModel):
    chat_id: str
    message: str

class BroadcastRequest(BaseModel):
    message: str
    chat_ids: list[str]

class TelegramLinkRequest(BaseModel):
    """Bind the authenticated user's account to a Telegram chat via a one-time code."""
    code: str


@router.post("/link")
async def link_telegram_chat(
    payload: TelegramLinkRequest,
    current_user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Link the current user's account to a Telegram chat.

    Flow: the user sends /link to the bot -> bot stores a one-time code (valid
    30 min) -> the user enters that code here -> this binds the chat to the
    user's account so the bot shows store-scoped data.
    """
    from datetime import datetime
    from sqlalchemy import select
    from app.models import AuthSecurityState, User

    code = (payload.code or "").strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Code is required")

    result = await db.execute(
        select(AuthSecurityState).where(
            AuthSecurityState.kind == "telegram_link",
            AuthSecurityState.key == code,
        )
    )
    pending = result.scalar_one_or_none()

    if not pending:
        raise HTTPException(
            status_code=400,
            detail="Invalid link code. Send /link to the Telegram bot to get a new one."
        )
    if pending.expires_at and pending.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=400,
            detail="Link code expired. Send /link to the Telegram bot for a new one."
        )

    chat_id = (pending.data or {}).get("chat_id")
    if not chat_id:
        raise HTTPException(status_code=400, detail="Invalid link code payload.")

    # A chat can only be bound to one account.
    existing = await db.execute(
        select(User).where(
            User.telegram_chat_id == chat_id,
            User.id != current_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="This Telegram chat is already linked to another account."
        )

    # get_current_user returns a lightweight namespace (raw SQL) — load the
    # real ORM row so the attribute change is actually persisted by commit().
    user_row = await db.execute(select(User).where(User.id == current_user.id))
    user = user_row.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.telegram_chat_id = chat_id
    await db.delete(pending)
    await db.commit()
    logger.info(f"User {current_user.id} linked Telegram chat {chat_id}")
    return {"success": True, "message": "Telegram chat linked successfully!", "chat_id": chat_id}


@router.post("/send")
async def send_telegram_message(request: SendMessageRequest):
    """Send a message to a Telegram chat"""
    result = await telegram_bot.send_message(request.chat_id, request.message)
    return result


@router.post("/broadcast")
async def broadcast_message(request: BroadcastRequest):
    """Broadcast message to multiple chats"""
    results = []
    for chat_id in request.chat_ids:
        result = await telegram_bot.send_message(chat_id, request.message)
        results.append({"chat_id": chat_id, **result})
    return {"results": results}


@router.get("/status")
async def get_bot_status():
    """Get Telegram bot status"""
    try:
        if not telegram_bot.bot_token:
            return {
                "connected": False,
                "error": "Bot token not configured",
                "setup_instructions": "Get a token from @BotFather on Telegram"
            }
        
        url = f"https://api.telegram.org/bot{telegram_bot.bot_token}/getMe"
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("ok"):
                    bot_info = data.get("result", {})
                    return {
                        "connected": True,
                        "bot_username": bot_info.get("username"),
                        "bot_name": bot_info.get("first_name"),
                        "can_join_groups": bot_info.get("can_join_groups", False)
                    }
            
            return {"connected": False, "error": "Invalid token"}
            
    except Exception as e:
        return {"connected": False, "error": str(e)}


@router.post("/set-webhook")
async def set_telegram_webhook(webhook_url: str = None):
    """Set the Telegram webhook URL"""
    try:
        if not telegram_bot.bot_token:
            raise HTTPException(status_code=400, detail="Bot token not configured")
        
        # Use provided URL or construct from settings
        if not webhook_url:
            # Use VERCEL_URL env var if available, otherwise fallback
            base_url = os.environ.get("VERCEL_URL", "kadaigpt.vercel.app")
            if not base_url.startswith("http"):
                base_url = f"https://{base_url}"
            webhook_url = f"{base_url}/api/v1/telegram/webhook"
        
        url = f"https://api.telegram.org/bot{telegram_bot.bot_token}/setWebhook"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json={"url": webhook_url},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                return {"success": data.get("ok"), "description": data.get("description")}
            else:
                return {"success": False, "error": response.text}
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/webhook-info")
async def get_webhook_info():
    """Get current webhook info"""
    try:
        if not telegram_bot.bot_token:
            return {"error": "Bot token not configured"}
        
        url = f"https://api.telegram.org/bot{telegram_bot.bot_token}/getWebhookInfo"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10)
            return response.json()
            
    except Exception as e:
        return {"error": str(e)}
