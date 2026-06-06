"""
KadaiGPT - Expenses Router
Store expense tracking (rent, salary, utilities, inventory, etc.)
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

from app.database import get_db
from app.models import Expense, User
from app.routers.auth import get_current_active_user

router = APIRouter(prefix="/expenses", tags=["Expenses"])


class ExpenseCreate(BaseModel):
    category: str = Field(default="other", max_length=50)
    description: str = Field(..., min_length=1, max_length=255)
    amount: float = Field(..., ge=0)
    date: Optional[str] = None          # ISO date string (YYYY-MM-DD); defaults to today
    recurring: bool = False


def _to_dict(e: Expense) -> dict:
    return {
        "id": e.id,
        "category": e.category,
        "description": e.description,
        "amount": e.amount,
        "date": e.expense_date.isoformat() if e.expense_date else None,
        "recurring": e.recurring,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


def _parse_date(value: Optional[str]) -> datetime:
    if not value:
        return datetime.utcnow()
    try:
        # Accept 'YYYY-MM-DD' or full ISO
        return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return datetime.utcnow()


@router.get("")
async def list_expenses(
    category: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=500),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """List expenses for the current store, newest first."""
    query = select(Expense).where(Expense.store_id == current_user.store_id)
    if category and category != "all":
        query = query.where(Expense.category == category)
    query = query.order_by(desc(Expense.expense_date)).limit(limit)
    result = await db.execute(query)
    return [_to_dict(e) for e in result.scalars().all()]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_expense(
    payload: ExpenseCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new expense for the current store."""
    expense = Expense(
        store_id=current_user.store_id,
        category=payload.category or "other",
        description=payload.description,
        amount=payload.amount,
        expense_date=_parse_date(payload.date),
        recurring=payload.recurring,
    )
    db.add(expense)
    await db.commit()
    await db.refresh(expense)
    return _to_dict(expense)


@router.delete("/{expense_id}")
async def delete_expense(
    expense_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an expense (must belong to the current store)."""
    result = await db.execute(
        select(Expense).where(
            Expense.id == expense_id,
            Expense.store_id == current_user.store_id,
        )
    )
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    await db.delete(expense)
    await db.commit()
    return {"message": "Expense deleted", "id": expense_id}
