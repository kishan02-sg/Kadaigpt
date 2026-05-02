"""
KadaiGPT - In-App Notifications Router
Database-backed notifications for low stock alerts, payment reminders, system events
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, update
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

from app.database import get_db
from app.models import Notification, User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["In-App Notifications"])


# ═══════════════════════════════════════════════════════════════════
# Schemas
# ═══════════════════════════════════════════════════════════════════

class NotificationCreate(BaseModel):
    title: str
    message: str
    notification_type: str = "info"  # info, warning, alert, success
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None


class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    notification_type: str
    is_read: bool
    entity_type: Optional[str]
    entity_id: Optional[int]
    created_at: str
    read_at: Optional[str]


# ═══════════════════════════════════════════════════════════════════
# Get Notifications
# ═══════════════════════════════════════════════════════════════════

@router.get("/")
async def get_notifications(
    unread_only: bool = Query(False, description="Only show unread notifications"),
    notification_type: Optional[str] = Query(None, description="Filter by type"),
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get notifications for the current user."""
    query = (
        select(Notification)
        .where(
            (Notification.store_id == current_user.store_id) &
            ((Notification.user_id == current_user.id) | (Notification.user_id.is_(None)))
        )
    )
    
    if unread_only:
        query = query.where(Notification.is_read == False)
    if notification_type:
        query = query.where(Notification.notification_type == notification_type)
    
    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Unread count
    unread_query = (
        select(func.count(Notification.id))
        .where(
            (Notification.store_id == current_user.store_id) &
            ((Notification.user_id == current_user.id) | (Notification.user_id.is_(None))) &
            (Notification.is_read == False)
        )
    )
    unread_result = await db.execute(unread_query)
    unread_count = unread_result.scalar() or 0
    
    # Paginated results
    query = query.order_by(desc(Notification.created_at)).offset(offset).limit(limit)
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    return {
        "total": total,
        "unread_count": unread_count,
        "notifications": [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "notification_type": n.notification_type,
                "is_read": n.is_read,
                "entity_type": n.entity_type,
                "entity_id": n.entity_id,
                "created_at": n.created_at.isoformat() if n.created_at else None,
                "read_at": n.read_at.isoformat() if n.read_at else None,
            }
            for n in notifications
        ]
    }


@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get the count of unread notifications (for badge display)."""
    query = (
        select(func.count(Notification.id))
        .where(
            (Notification.store_id == current_user.store_id) &
            ((Notification.user_id == current_user.id) | (Notification.user_id.is_(None))) &
            (Notification.is_read == False)
        )
    )
    result = await db.execute(query)
    count = result.scalar() or 0
    return {"unread_count": count}


# ═══════════════════════════════════════════════════════════════════
# Mark as Read
# ═══════════════════════════════════════════════════════════════════

@router.put("/{notification_id}/read")
async def mark_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark a single notification as read."""
    result = await db.execute(
        select(Notification).where(
            (Notification.id == notification_id) &
            (Notification.store_id == current_user.store_id)
        )
    )
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notification.is_read = True
    notification.read_at = datetime.utcnow()
    await db.commit()
    
    return {"success": True, "message": "Notification marked as read"}


@router.put("/mark-all-read")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark all notifications as read for the current user."""
    now = datetime.utcnow()
    stmt = (
        update(Notification)
        .where(
            (Notification.store_id == current_user.store_id) &
            ((Notification.user_id == current_user.id) | (Notification.user_id.is_(None))) &
            (Notification.is_read == False)
        )
        .values(is_read=True, read_at=now)
    )
    result = await db.execute(stmt)
    await db.commit()
    
    return {"success": True, "marked_count": result.rowcount}


# ═══════════════════════════════════════════════════════════════════
# Create Notification (internal use + admin)
# ═══════════════════════════════════════════════════════════════════

@router.post("/")
async def create_notification(
    data: NotificationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a notification (admin/system use)."""
    notification = Notification(
        store_id=current_user.store_id,
        user_id=None,  # Broadcast to all store users
        title=data.title,
        message=data.message,
        notification_type=data.notification_type,
        entity_type=data.entity_type,
        entity_id=data.entity_id,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)
    
    return {
        "success": True,
        "notification": {
            "id": notification.id,
            "title": notification.title,
            "message": notification.message,
        }
    }


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a notification."""
    result = await db.execute(
        select(Notification).where(
            (Notification.id == notification_id) &
            (Notification.store_id == current_user.store_id)
        )
    )
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    await db.delete(notification)
    await db.commit()
    
    return {"success": True, "message": "Notification deleted"}


# ═══════════════════════════════════════════════════════════════════
# Helper: Create notification from other services
# ═══════════════════════════════════════════════════════════════════

async def create_system_notification(
    db: AsyncSession,
    store_id: int,
    title: str,
    message: str,
    notification_type: str = "info",
    user_id: int = None,
    entity_type: str = None,
    entity_id: int = None,
):
    """Helper function to create notifications from other routers/services."""
    notification = Notification(
        store_id=store_id,
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        entity_type=entity_type,
        entity_id=entity_id,
    )
    db.add(notification)
    # Don't commit — let the caller's transaction handle it
    return notification
