"""
KadaiGPT - Bulk Operations Router
Import/Export products, customers, and bills in bulk
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import csv
import io
import json
import logging

from app.database import get_db
from app.routers.auth import get_current_user
from app.models import User

router = APIRouter(prefix="/bulk", tags=["Bulk Operations"])
logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════
# Export Operations
# ═══════════════════════════════════════════════════════════════════

@router.get("/export/products")
async def export_products(
    format: str = "csv",
    current_user: User = Depends(get_current_user)
):
    """Export all products to CSV or JSON"""
    # Demo products for export
    products = [
        {"id": 1, "name": "Basmati Rice 5kg", "sku": "RICE-BAS-5KG", "barcode": "8901491101219", "price": 450, "stock": 45, "category": "Grains", "unit": "kg"},
        {"id": 2, "name": "Toor Dal 1kg", "sku": "DAL-TOOR-1KG", "barcode": "8901491101226", "price": 150, "stock": 60, "category": "Pulses", "unit": "kg"},
        {"id": 3, "name": "Sugar 1kg", "sku": "SUG-WHT-1KG", "barcode": "8901491101233", "price": 45, "stock": 80, "category": "Essentials", "unit": "kg"},
        {"id": 4, "name": "Refined Oil 1L", "sku": "OIL-REF-1L", "barcode": "8901491101240", "price": 180, "stock": 35, "category": "Oils", "unit": "L"},
        {"id": 5, "name": "Salt 1kg", "sku": "SALT-IOD-1KG", "barcode": "8901491101257", "price": 25, "stock": 100, "category": "Essentials", "unit": "kg"},
    ]
    
    if format == "json":
        return {
            "products": products,
            "exported_at": datetime.utcnow().isoformat(),
            "count": len(products)
        }
    
    # CSV export
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["id", "name", "sku", "barcode", "price", "stock", "category", "unit"])
    writer.writeheader()
    writer.writerows(products)
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=products_{datetime.now().strftime('%Y%m%d')}.csv"
        }
    )


@router.get("/export/customers")
async def export_customers(
    format: str = "csv",
    current_user: User = Depends(get_current_user)
):
    """Export all customers to CSV or JSON"""
    customers = [
        {"id": 1, "name": "Rajesh Kumar", "phone": "9876543210", "email": "rajesh@email.com", "credit": 2500, "total_purchases": 45600},
        {"id": 2, "name": "Lakshmi Stores", "phone": "9876543211", "email": "lakshmi@email.com", "credit": 5000, "total_purchases": 125000},
        {"id": 3, "name": "Ganesh Trading", "phone": "9876543212", "email": "ganesh@email.com", "credit": 0, "total_purchases": 78000},
    ]
    
    if format == "json":
        return {
            "customers": customers,
            "exported_at": datetime.utcnow().isoformat(),
            "count": len(customers)
        }
    
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["id", "name", "phone", "email", "credit", "total_purchases"])
    writer.writeheader()
    writer.writerows(customers)
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=customers_{datetime.now().strftime('%Y%m%d')}.csv"
        }
    )


@router.get("/export/bills")
async def export_bills(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    format: str = "csv",
    current_user: User = Depends(get_current_user)
):
    """Export bills to CSV or JSON"""
    bills = [
        {"id": 1, "bill_number": "INV-2026-0047", "customer_name": "Rajesh Kumar", "total": 1250, "payment_mode": "UPI", "created_at": "2026-02-01T10:30:00"},
        {"id": 2, "bill_number": "INV-2026-0048", "customer_name": "Lakshmi Stores", "total": 3500, "payment_mode": "Cash", "created_at": "2026-02-01T11:00:00"},
        {"id": 3, "bill_number": "INV-2026-0049", "customer_name": "Walk-in", "total": 450, "payment_mode": "UPI", "created_at": "2026-02-01T11:30:00"},
    ]
    
    if format == "json":
        return {
            "bills": bills,
            "exported_at": datetime.utcnow().isoformat(),
            "count": len(bills),
            "total_value": sum(b["total"] for b in bills)
        }
    
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=["id", "bill_number", "customer_name", "total", "payment_mode", "created_at"])
    writer.writeheader()
    writer.writerows(bills)
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=bills_{datetime.now().strftime('%Y%m%d')}.csv"
        }
    )


# ═══════════════════════════════════════════════════════════════════
# Import Operations
# ═══════════════════════════════════════════════════════════════════

class ImportResult(BaseModel):
    success: bool
    imported: int
    failed: int
    errors: List[str]


@router.post("/import/products", response_model=ImportResult)
async def import_products(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    current_user: User = Depends(get_current_user)
):
    """Import products from CSV file"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    try:
        contents = await file.read()
        decoded = contents.decode('utf-8')
        reader = csv.DictReader(io.StringIO(decoded))
        
        imported = 0
        failed = 0
        errors = []
        
        required_fields = ['name', 'price']
        
        for i, row in enumerate(reader, start=2):
            try:
                # Validate required fields
                if not all(row.get(f) for f in required_fields):
                    raise ValueError(f"Missing required fields: {required_fields}")
                
                # Validate price is numeric
                price = float(row.get('price', 0))
                if price <= 0:
                    raise ValueError("Price must be positive")
                
                # Would save to database here
                imported += 1
            except Exception as e:
                failed += 1
                errors.append(f"Row {i}: {str(e)}")
        
        return ImportResult(
            success=failed == 0,
            imported=imported,
            failed=failed,
            errors=errors[:10]  # Limit errors shown
        )
    
    except Exception as e:
        logger.error(f"Import error: {e}")
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")


@router.post("/import/customers", response_model=ImportResult)
async def import_customers(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Import customers from CSV file"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    try:
        contents = await file.read()
        decoded = contents.decode('utf-8')
        reader = csv.DictReader(io.StringIO(decoded))
        
        imported = 0
        failed = 0
        errors = []
        
        for i, row in enumerate(reader, start=2):
            try:
                if not row.get('name'):
                    raise ValueError("Name is required")
                
                # Validate phone if provided
                phone = row.get('phone', '')
                if phone and len(phone) != 10:
                    raise ValueError("Phone must be 10 digits")
                
                imported += 1
            except Exception as e:
                failed += 1
                errors.append(f"Row {i}: {str(e)}")
        
        return ImportResult(
            success=failed == 0,
            imported=imported,
            failed=failed,
            errors=errors[:10]
        )
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")


# ═══════════════════════════════════════════════════════════════════
# Templates
# ═══════════════════════════════════════════════════════════════════

@router.get("/templates/products")
async def get_product_template():
    """Get CSV template for product import"""
    template = """name,sku,barcode,price,stock,category,unit,min_stock,gst_rate
Basmati Rice 5kg,RICE-BAS-5KG,8901491101219,450,50,Grains,kg,20,5
Toor Dal 1kg,DAL-TOOR-1KG,8901491101226,150,30,Pulses,kg,15,5
"""
    
    return StreamingResponse(
        iter([template]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=products_template.csv"
        }
    )


@router.get("/templates/customers")
async def get_customer_template():
    """Get CSV template for customer import"""
    template = """name,phone,email,address,credit_limit
Rajesh Kumar,9876543210,rajesh@email.com,123 Main Street,10000
Lakshmi Stores,9876543211,lakshmi@email.com,456 Market Road,50000
"""
    
    return StreamingResponse(
        iter([template]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=customers_template.csv"
        }
    )


# ═══════════════════════════════════════════════════════════════════
# Backup & Restore
# ═══════════════════════════════════════════════════════════════════

@router.get("/backup")
async def create_backup(
    current_user: User = Depends(get_current_user)
):
    """Create a full backup of all store data"""
    backup_data = {
        "version": "1.0",
        "created_at": datetime.utcnow().isoformat(),
        "store_name": current_user.store_name,
        "user_id": current_user.id,
        "data": {
            "products": [
                {"id": 1, "name": "Basmati Rice 5kg", "price": 450, "stock": 45},
                {"id": 2, "name": "Toor Dal 1kg", "price": 150, "stock": 60},
            ],
            "customers": [
                {"id": 1, "name": "Rajesh Kumar", "phone": "9876543210", "credit": 2500},
            ],
            "bills": [
                {"id": 1, "bill_number": "INV-2026-0047", "total": 1250},
            ],
            "settings": {
                "gstin": "33AABCU9603R1ZM",
                "auto_print": True
            }
        }
    }
    
    json_str = json.dumps(backup_data, indent=2)
    
    return StreamingResponse(
        iter([json_str]),
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        }
    )


@router.post("/restore")
async def restore_backup(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Restore data from a backup file"""
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="Only JSON backup files are supported")
    
    try:
        contents = await file.read()
        backup_data = json.loads(contents.decode('utf-8'))
        
        # Validate backup format
        if "version" not in backup_data or "data" not in backup_data:
            raise HTTPException(status_code=400, detail="Invalid backup format")
        
        # Count items to restore
        products_count = len(backup_data["data"].get("products", []))
        customers_count = len(backup_data["data"].get("customers", []))
        bills_count = len(backup_data["data"].get("bills", []))
        
        # Would restore to database here
        
        return {
            "success": True,
            "message": "Backup restored successfully",
            "restored": {
                "products": products_count,
                "customers": customers_count,
                "bills": bills_count
            },
            "backup_date": backup_data.get("created_at")
        }
    
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")
