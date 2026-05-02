"""
KadaiGPT - Audit Trail Router
Endpoints for viewing audit logs and system activity
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import Optional
from datetime import datetime, timedelta

from app.database import get_db
from app.models import AuditTrail, User
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/audit", tags=["Audit Trail"])


# ═══════════════════════════════════════════════════════════════════
# Audit Trail Endpoints
# ═══════════════════════════════════════════════════════════════════

@router.get("/logs")
async def get_audit_logs(
    entity_type: Optional[str] = Query(None, description="Filter by entity type: bill, product, customer"),
    action: Optional[str] = Query(None, description="Filter by action: create, update, delete, login"),
    days: int = Query(7, ge=1, le=90, description="Number of days to look back"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get audit trail logs for the current user's store."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    query = (
        select(AuditTrail)
        .where(AuditTrail.store_id == current_user.store_id)
        .where(AuditTrail.created_at >= cutoff)
    )
    
    if entity_type:
        query = query.where(AuditTrail.entity_type == entity_type)
    if action:
        query = query.where(AuditTrail.action == action)
    
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Get paginated results
    query = query.order_by(desc(AuditTrail.created_at)).offset(offset).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return {
        "total": total,
        "logs": [
            {
                "id": log.id,
                "action": log.action,
                "entity_type": log.entity_type,
                "entity_id": log.entity_id,
                "user_id": log.user_id,
                "ip_address": log.ip_address,
                "old_values": log.old_values,
                "new_values": log.new_values,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
        "pagination": {
            "limit": limit,
            "offset": offset,
            "total": total,
            "has_more": (offset + limit) < total
        }
    }


@router.get("/summary")
async def get_audit_summary(
    days: int = Query(7, ge=1, le=90),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a summary of audit activity for the store."""
    cutoff = datetime.utcnow() - timedelta(days=days)
    
    # Count by action type
    action_query = (
        select(AuditTrail.action, func.count(AuditTrail.id))
        .where(AuditTrail.store_id == current_user.store_id)
        .where(AuditTrail.created_at >= cutoff)
        .group_by(AuditTrail.action)
    )
    action_result = await db.execute(action_query)
    action_counts = {row[0]: row[1] for row in action_result.all()}
    
    # Count by entity type
    entity_query = (
        select(AuditTrail.entity_type, func.count(AuditTrail.id))
        .where(AuditTrail.store_id == current_user.store_id)
        .where(AuditTrail.created_at >= cutoff)
        .group_by(AuditTrail.entity_type)
    )
    entity_result = await db.execute(entity_query)
    entity_counts = {row[0]: row[1] for row in entity_result.all()}
    
    # Total activity
    total_query = (
        select(func.count(AuditTrail.id))
        .where(AuditTrail.store_id == current_user.store_id)
        .where(AuditTrail.created_at >= cutoff)
    )
    total_result = await db.execute(total_query)
    total = total_result.scalar() or 0
    
    return {
        "period_days": days,
        "total_events": total,
        "by_action": action_counts,
        "by_entity": entity_counts,
    }


# ═══════════════════════════════════════════════════════════════════
# Audit Trail Helper (used by other routers)
# ═══════════════════════════════════════════════════════════════════

async def log_audit_event(
    db: AsyncSession,
    store_id: int,
    user_id: int,
    action: str,
    entity_type: str,
    entity_id: int = None,
    old_values: dict = None,
    new_values: dict = None,
    ip_address: str = None,
    user_agent: str = None,
):
    """Helper to log an audit event from any router."""
    event = AuditTrail(
        store_id=store_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(event)
    # Don't commit here — let the caller's transaction handle it
