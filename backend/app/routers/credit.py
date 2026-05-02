"""
KadaiGPT - Credit Management API Router
Endpoints for Credit Book 2.0: scoring, reminders, and analytics.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.models import User
from app.routers.auth import get_current_active_user
from app.services.credit_engine import credit_engine

router = APIRouter(prefix="/credit", tags=["Credit Management"])


@router.get("/summary")
async def get_credit_summary(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get store-wide credit summary with risk distribution"""
    try:
        summary = await credit_engine.get_credit_summary(db, current_user.store_id)
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/customer/{customer_id}")
async def get_customer_credit(
    customer_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get detailed credit information for a specific customer"""
    try:
        details = await credit_engine.get_customer_credit_details(
            db, current_user.store_id, customer_id
        )
        return details
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/overdue")
async def get_overdue_customers(
    days: int = Query(default=30, description="Days threshold for overdue"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get list of customers with overdue credit"""
    try:
        overdue = await credit_engine.get_overdue_customers(
            db, current_user.store_id, days
        )
        return {"overdue_customers": overdue, "threshold_days": days}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reminder/{customer_id}")
async def generate_reminder(
    customer_id: int,
    language: str = Query(default="en", description="Language: en, ta, hi, te"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate payment reminder message for a customer"""
    try:
        reminder = await credit_engine.generate_reminder_message(
            db, current_user.store_id, customer_id, language
        )
        return reminder
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
