"""
KadaiGPT - GST Compliance API Router
Endpoints for GST returns, HSN codes, tax calculations, and compliance checks
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.models import User
from app.routers.auth import get_current_active_user
from app.services.gst_engine import gst_engine

router = APIRouter(prefix="/gst", tags=["GST Compliance"])


@router.get("/gstr1")
async def generate_gstr1(
    year: int = Query(default=None, description="Financial year"),
    month: int = Query(default=None, description="Month (1-12)"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate GSTR-1 (Outward Supplies) report for a period"""
    if not year:
        year = datetime.now().year
    if not month:
        month = datetime.now().month
    
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Month must be 1-12")
    
    try:
        report = await gst_engine.generate_gstr1(db, current_user.store_id, year, month)
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating GSTR-1: {str(e)}")


@router.get("/gstr3b")
async def generate_gstr3b(
    year: int = Query(default=None),
    month: int = Query(default=None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Generate GSTR-3B (Summary Return) for a period"""
    if not year:
        year = datetime.now().year
    if not month:
        month = datetime.now().month
    
    try:
        report = await gst_engine.generate_gstr3b(db, current_user.store_id, year, month)
        return report
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating GSTR-3B: {str(e)}")


@router.get("/hsn-suggest")
async def suggest_hsn_code(
    product_name: str = Query(..., description="Product name to suggest HSN code for"),
):
    """Get AI-powered HSN code suggestions for a product"""
    suggestions = await gst_engine.suggest_hsn_code(product_name)
    return {"product_name": product_name, "suggestions": suggestions}


@router.get("/calculate-tax")
async def calculate_tax(
    amount: float = Query(..., description="Taxable amount"),
    gst_rate: float = Query(default=18, description="GST rate (0, 5, 12, 18, 28)"),
    seller_state: str = Query(default="33", description="Seller state code"),
    buyer_state: Optional[str] = Query(default=None, description="Buyer state code"),
):
    """Calculate CGST/SGST/IGST breakdown for a transaction"""
    if gst_rate not in [0, 5, 12, 18, 28]:
        raise HTTPException(status_code=400, detail="GST rate must be 0, 5, 12, 18, or 28")
    
    result = gst_engine.calculate_tax(amount, gst_rate, seller_state, buyer_state)
    return result


@router.get("/compliance-status")
async def get_compliance_status(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get overall GST compliance status with alerts and recommendations"""
    try:
        status = await gst_engine.check_compliance_status(db, current_user.store_id)
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
