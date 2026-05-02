"""
KadaiGPT - Email Notifications Router
Endpoints for managing email notifications and preferences
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime
import logging

from app.database import get_db
from app.routers.auth import get_current_user
from app.models import User

# Import email service
try:
    from app.services.email_service import email_service, EmailTemplate
    EMAIL_SERVICE_AVAILABLE = True
except ImportError:
    EMAIL_SERVICE_AVAILABLE = False

router = APIRouter(prefix="/notifications", tags=["Notifications"])
logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
# Pydantic Models
# ═══════════════════════════════════════════════════════════════════

class EmailSettings(BaseModel):
    daily_summary: bool = True
    low_stock_alerts: bool = True
    payment_reminders: bool = True
    weekly_report: bool = False
    email: Optional[EmailStr] = None


class SendTestEmailRequest(BaseModel):
    email: EmailStr
    template: str = "welcome"


class BulkReminderRequest(BaseModel):
    customer_ids: List[int]
    message_type: str = "payment"


# ═══════════════════════════════════════════════════════════════════
# Email Preferences
# ═══════════════════════════════════════════════════════════════════

# In-memory storage for email preferences (would be DB in production)
_email_preferences = {}


@router.get("/email/settings")
async def get_email_settings(
    current_user: User = Depends(get_current_user)
):
    """Get email notification settings"""
    user_prefs = _email_preferences.get(current_user.id, {
        "daily_summary": True,
        "daily_summary_time": "21:00",
        "low_stock_alerts": True,
        "payment_reminders": True,
        "weekly_report": False,
        "email": current_user.email
    })
    
    return {
        "settings": user_prefs,
        "email_service_enabled": EMAIL_SERVICE_AVAILABLE and email_service.enabled if EMAIL_SERVICE_AVAILABLE else False
    }


@router.put("/email/settings")
async def update_email_settings(
    settings: EmailSettings,
    current_user: User = Depends(get_current_user)
):
    """Update email notification settings"""
    _email_preferences[current_user.id] = settings.dict()
    
    return {
        "message": "Settings updated successfully",
        "settings": settings.dict()
    }


# ═══════════════════════════════════════════════════════════════════
# Send Emails
# ═══════════════════════════════════════════════════════════════════

@router.post("/email/test")
async def send_test_email(
    request: SendTestEmailRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Send a test email"""
    if not EMAIL_SERVICE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Email service not configured")
    
    try:
        if request.template == "welcome":
            html = EmailTemplate.welcome_email(current_user.store_name or "Your Store")
            subject = "🎉 Welcome to KadaiGPT!"
        elif request.template == "daily_summary":
            html = EmailTemplate.daily_summary({
                "date": datetime.utcnow().strftime("%B %d, %Y"),
                "total_sales": 47850,
                "total_bills": 68,
                "customers": 52,
                "net_profit": 39350,
                "low_stock_count": 5,
                "top_products": [
                    {"name": "Basmati Rice 5kg", "qty": 24, "revenue": 7200},
                    {"name": "Sugar 1kg", "qty": 45, "revenue": 2025},
                    {"name": "Toor Dal 1kg", "qty": 18, "revenue": 2700}
                ]
            })
            subject = "📊 Your Daily Business Summary - KadaiGPT"
        else:
            html = EmailTemplate.welcome_email(current_user.store_name or "Your Store")
            subject = "🎉 Test Email from KadaiGPT"
        
        # Send in background
        background_tasks.add_task(
            email_service.send_email,
            request.email,
            subject,
            html
        )
        
        return {
            "message": f"Test email queued for {request.email}",
            "template": request.template
        }
    except Exception as e:
        logger.error(f"Error sending test email: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/email/daily-summary")
async def send_daily_summary_email(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Trigger daily summary email for current user"""
    if not EMAIL_SERVICE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Email service not configured")
    
    # Get user email
    email = current_user.email
    if not email:
        raise HTTPException(status_code=400, detail="No email configured for user")
    
    # Generate summary data (would come from analytics in production)
    summary_data = {
        "date": datetime.utcnow().strftime("%B %d, %Y"),
        "total_sales": 47850,
        "total_bills": 68,
        "customers": 52,
        "net_profit": 39350,
        "low_stock_count": 5,
        "top_products": [
            {"name": "Basmati Rice 5kg", "qty": 24, "revenue": 7200},
            {"name": "Sugar 1kg", "qty": 45, "revenue": 2025},
            {"name": "Toor Dal 1kg", "qty": 18, "revenue": 2700}
        ]
    }
    
    background_tasks.add_task(
        email_service.send_daily_summary,
        email,
        summary_data
    )
    
    return {
        "message": f"Daily summary email queued for {email}",
        "scheduled": True
    }


@router.post("/email/low-stock-alert")
async def send_low_stock_alert(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Send low stock alert email"""
    if not EMAIL_SERVICE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Email service not configured")
    
    email = current_user.email
    if not email:
        raise HTTPException(status_code=400, detail="No email configured for user")
    
    # Demo low stock products
    low_stock_products = [
        {"name": "Basmati Rice 5kg", "stock": 5, "min_stock": 20},
        {"name": "Toor Dal 1kg", "stock": 3, "min_stock": 15},
        {"name": "Sugar 1kg", "stock": 8, "min_stock": 25}
    ]
    
    background_tasks.add_task(
        email_service.send_low_stock_alert,
        email,
        low_stock_products
    )
    
    return {
        "message": f"Low stock alert queued for {email}",
        "products_count": len(low_stock_products)
    }


# ═══════════════════════════════════════════════════════════════════
# Notification History
# ═══════════════════════════════════════════════════════════════════

# In-memory notification history
_notification_history = {}


@router.get("/history")
async def get_notification_history(
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    """Get notification history for current user"""
    user_history = _notification_history.get(current_user.id, [])
    
    # Add demo history if empty
    if not user_history:
        user_history = [
            {
                "id": 1,
                "type": "email",
                "template": "daily_summary",
                "recipient": current_user.email,
                "status": "sent",
                "created_at": "2026-01-30T21:00:00Z"
            },
            {
                "id": 2,
                "type": "email",
                "template": "low_stock_alert",
                "recipient": current_user.email,
                "status": "sent",
                "created_at": "2026-01-29T10:30:00Z"
            },
            {
                "id": 3,
                "type": "whatsapp",
                "template": "payment_reminder",
                "recipient": "+919876543210",
                "status": "delivered",
                "created_at": "2026-01-29T09:00:00Z"
            }
        ]
    
    return {
        "notifications": user_history[:limit],
        "total": len(user_history)
    }


# ═══════════════════════════════════════════════════════════════════
# Status & Health
# ═══════════════════════════════════════════════════════════════════

@router.get("/status")
async def get_notification_status():
    """Get notification service status"""
    return {
        "email": {
            "available": EMAIL_SERVICE_AVAILABLE,
            "configured": email_service.enabled if EMAIL_SERVICE_AVAILABLE else False
        },
        "whatsapp": {
            "available": True,
            "configured": False  # Would check WhatsApp API config
        },
        "sms": {
            "available": False,
            "configured": False
        }
    }
