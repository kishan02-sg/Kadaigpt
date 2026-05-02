"""
KadaiGPT - OCR Router
Handwritten bill processing with AI-powered extraction
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import base64
import os
import uuid
from datetime import datetime

from app.database import get_db
from app.models import HandwrittenBill, Product, User, OCRConfidence
from app.schemas import OCRResult, HandwrittenBillResponse
from app.routers.auth import get_current_active_user
from app.agents import ocr_agent
from app.config import settings


router = APIRouter(prefix="/ocr", tags=["OCR Processing"])


@router.post("/process", response_model=dict)
async def process_handwritten_bill(
    file: UploadFile = File(...),
    language: str = Form(default="en"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    🧠 OCR AGENT: Process a handwritten bill image
    
    Accepts image file and returns extracted data with confidence scores.
    """
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
        )
    
    # Read file
    contents = await file.read()
    
    # Check file size (max 10MB)
    if len(contents) > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum: {settings.max_upload_size_mb}MB"
        )
    
    # Get store products for matching
    products_result = await db.execute(
        select(Product).where(Product.store_id == current_user.store_id)
    )
    products = products_result.scalars().all()
    store_products = [
        {"name": p.name, "sku": p.sku, "price": p.selling_price}
        for p in products
    ]
    
    # Process with OCR Agent
    result = await ocr_agent.process_handwritten_bill(
        image_data=contents,
        store_products=store_products,
        language_hint=language
    )
    
    # Save image and create record
    upload_dir = os.path.join(settings.upload_dir, "ocr_images")
    os.makedirs(upload_dir, exist_ok=True)
    
    filename = f"{uuid.uuid4().hex}.jpg"
    filepath = os.path.join(upload_dir, filename)
    
    with open(filepath, "wb") as f:
        f.write(contents)
    
    # Determine confidence level
    confidence_level = OCRConfidence.LOW
    if result.overall_confidence >= 0.9:
        confidence_level = OCRConfidence.HIGH
    elif result.overall_confidence >= 0.7:
        confidence_level = OCRConfidence.MEDIUM
    
    # Create database record
    handwritten_bill = HandwrittenBill(
        store_id=current_user.store_id,
        image_path=filepath,
        raw_ocr_text=result.raw_text,
        extracted_data={
            "items": [
                {
                    "name": item.name,
                    "quantity": item.quantity,
                    "unit_price": item.unit_price,
                    "total": item.total,
                    "confidence": item.confidence,
                    "needs_review": item.needs_review
                }
                for item in result.extracted_items
            ],
            "total": result.extracted_total,
            "date": result.extracted_date
        },
        overall_confidence=result.overall_confidence,
        confidence_level=confidence_level,
        extracted_total=result.extracted_total,
        extracted_items=[
            {
                "name": item.name,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "total": item.total,
                "confidence": item.confidence
            }
            for item in result.extracted_items
        ]
    )
    
    db.add(handwritten_bill)
    await db.commit()
    await db.refresh(handwritten_bill)
    
    return {
        "success": result.success,
        "ocr_id": handwritten_bill.id,
        "raw_text": result.raw_text,
        "items": [
            {
                "name": item.name,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "total": item.total,
                "confidence": item.confidence,
                "needs_review": item.needs_review,
                "original_text": item.original_text
            }
            for item in result.extracted_items
        ],
        "extracted_total": result.extracted_total,
        "extracted_date": result.extracted_date,
        "overall_confidence": result.overall_confidence,
        "confidence_level": result.confidence_level.value,
        "suggestions": result.suggestions,
        "processing_time_ms": result.processing_time_ms
    }


@router.post("/process-base64", response_model=dict)
async def process_handwritten_bill_base64(
    image_base64: str = Form(...),
    language: str = Form(default="en"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Process handwritten bill from base64 encoded image
    (Useful for mobile apps that capture images)
    """
    try:
        # Decode base64
        if "," in image_base64:
            # Remove data URL prefix if present
            image_base64 = image_base64.split(",")[1]
        
        contents = base64.b64decode(image_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid base64 image data")
    
    # Get store products
    products_result = await db.execute(
        select(Product).where(Product.store_id == current_user.store_id)
    )
    products = products_result.scalars().all()
    store_products = [
        {"name": p.name, "sku": p.sku, "price": p.selling_price}
        for p in products
    ]
    
    # Process with OCR Agent
    result = await ocr_agent.process_handwritten_bill(
        image_data=contents,
        store_products=store_products,
        language_hint=language
    )
    
    return {
        "success": result.success,
        "items": [
            {
                "name": item.name,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "total": item.total,
                "confidence": item.confidence,
                "needs_review": item.needs_review
            }
            for item in result.extracted_items
        ],
        "extracted_total": result.extracted_total,
        "overall_confidence": result.overall_confidence,
        "confidence_level": result.confidence_level.value,
        "suggestions": result.suggestions,
        "processing_time_ms": result.processing_time_ms
    }


@router.get("/history", response_model=List[HandwrittenBillResponse])
async def get_ocr_history(
    verified_only: bool = False,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get history of processed handwritten bills"""
    query = select(HandwrittenBill).where(
        HandwrittenBill.store_id == current_user.store_id
    )
    
    if verified_only:
        query = query.where(HandwrittenBill.is_verified == True)
    
    query = query.order_by(HandwrittenBill.created_at.desc()).limit(limit)
    
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{ocr_id}", response_model=dict)
async def get_ocr_result(
    ocr_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific OCR result"""
    result = await db.execute(
        select(HandwrittenBill).where(
            HandwrittenBill.id == ocr_id,
            HandwrittenBill.store_id == current_user.store_id
        )
    )
    ocr_record = result.scalar_one_or_none()
    
    if not ocr_re:
        raise HTTPException(status_code=404, detail="OCR record not found")
    
    return {
        "id": ocr_record.id,
        "image_path": ocr_record.image_path,
        "raw_text": ocr_record.raw_ocr_text,
        "extracted_data": ocr_record.extracted_data,
        "overall_confidence": ocr_record.overall_confidence,
        "confidence_level": ocr_record.confidence_level.value if ocr_record.confidence_level else "unknown",
        "is_verified": ocr_record.is_verified,
        "created_at": ocr_record.created_at.isoformat()
    }


@router.post("/{ocr_id}/verify")
async def verify_ocr_result(
    ocr_id: int,
    corrections: Optional[dict] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Verify OCR result and apply corrections.
    The agent learns from corrections for future accuracy.
    """
    result = await db.execute(
        select(HandwrittenBill).where(
            HandwrittenBill.id == ocr_id,
            HandwrittenBill.store_id == current_user.store_id
        )
    )
    ocr_record = result.scalar_one_or_none()
    
    if not ocr_record:
        raise HTTPException(status_code=404, detail="OCR record not found")
    
    # Apply corrections and learn
    if corrections:
        ocr_record.corrections_made = corrections
        
        # Teach the OCR agent from corrections
        for item_correction in corrections.get("items", []):
            if "original_text" in item_correction and "corrected_name" in item_correction:
                ocr_agent.learn_from_correction(
                    item_correction["original_text"],
                    item_correction["corrected_name"]
                )
    
    ocr_record.is_verified = True
    ocr_record.verified_by = current_user.id
    ocr_record.verified_at = datetime.utcnow()
    
    await db.commit()
    
    return {
        "message": "OCR result verified",
        "id": ocr_id,
        "corrections_applied": corrections is not None
    }


@router.post("/{ocr_id}/convert-to-bill")
async def convert_to_digital_bill(
    ocr_id: int,
    customer_name: Optional[str] = None,
    customer_phone: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Convert verified OCR result into a digital bill
    """
    from app.routers.bills import create_bill
    from app.schemas import BillCreate, BillItemCreate, PaymentMethodEnum
    
    result = await db.execute(
        select(HandwrittenBill).where(
            HandwrittenBill.id == ocr_id,
            HandwrittenBill.store_id == current_user.store_id
        )
    )
    ocr_record = result.scalar_one_or_none()
    
    if not ocr_record:
        raise HTTPException(status_code=404, detail="OCR record not found")
    
    if not ocr_record.is_verified:
        raise HTTPException(
            status_code=400,
            detail="Please verify the OCR result before converting to bill"
        )
    
    # Build bill from OCR data
    items = []
    extracted_items = ocr_record.extracted_items or []
    
    for item in extracted_items:
        items.append(BillItemCreate(
            product_name=item.get("name", "Unknown"),
            unit_price=item.get("unit_price", 0),
            quantity=item.get("quantity", 1),
            discount_percent=0,
            tax_rate=0
        ))
    
    bill_data = BillCreate(
        customer_name=customer_name,
        customer_phone=customer_phone,
        payment_method=PaymentMethodEnum.CASH,
        items=items
    )
    
    # Create the bill
    bill = await create_bill(
        bill_data=bill_data,
        auto_print=False,
        current_user=current_user,
        db=db
    )
    
    # Link the OCR record to the bill
    ocr_record.converted_bill_id = bill.id
    await db.commit()
    
    return {
        "message": "Bill created from handwritten bill",
        "bill_id": bill.id,
        "bill_number": bill.bill_number,
        "total": bill.total_amount
    }


@router.get("/agent/stats")
async def get_ocr_agent_stats(
    current_user: User = Depends(get_current_active_user)
):
    """Get OCR agent statistics"""
    return ocr_agent.get_agent_stats()
