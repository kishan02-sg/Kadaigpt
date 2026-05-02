"""
KadaiGPT - Print API Router
Handles receipt printing requests
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

from ..agents.print_agent import print_agent, PrinterInfo
from ..agents.thermal_printer import print_receipt, ReceiptBuilder

router = APIRouter(prefix="/print", tags=["Printing"])


class PrintReceiptRequest(BaseModel):
    """Request model for printing receipts"""
    bill_number: str
    store_name: Optional[str] = "KadaiGPT Store"
    store_address: Optional[str] = None
    store_phone: Optional[str] = None
    gstin: Optional[str] = None
    customer_name: Optional[str] = "Walk-in Customer"
    items: List[Dict[str, Any]]
    subtotal: Optional[float] = 0
    tax: Optional[float] = 0
    discount: Optional[float] = 0
    total: float
    payment_mode: Optional[str] = "Cash"
    printer_name: Optional[str] = "auto"
    use_thermal: Optional[bool] = True


class PrinterListResponse(BaseModel):
    """Response model for printer list"""
    printers: List[Dict[str, Any]]
    default_printer: Optional[str]
    total: int


class PrintResponse(BaseModel):
    """Response model for print operations"""
    success: bool
    message: str
    printer: str
    timestamp: str
    job_id: Optional[str] = None


@router.get("/printers", response_model=PrinterListResponse)
async def get_printers():
    """
    📋 GET AVAILABLE PRINTERS
    
    Returns a list of all detected printers on the system.
    """
    try:
        printers = await print_agent.get_available_printers(force_refresh=True)
        
        printer_list = []
        default_printer = None
        
        for p in printers:
            printer_dict = {
                "name": p.name,
                "status": p.status.value,
                "is_default": p.is_default,
                "paper_level": p.paper_level,
                "ink_level": p.ink_level
            }
            printer_list.append(printer_dict)
            
            if p.is_default:
                default_printer = p.name
        
        return PrinterListResponse(
            printers=printer_list,
            default_printer=default_printer,
            total=len(printer_list)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get printers: {str(e)}")


@router.post("/receipt", response_model=PrintResponse)
async def print_bill_receipt(request: PrintReceiptRequest):
    """
    🖨️ PRINT RECEIPT
    
    Prints a formatted receipt for a bill.
    Supports both thermal (ESC/POS) and regular printers.
    """
    try:
        bill_data = {
            "bill_number": request.bill_number,
            "store_name": request.store_name,
            "store_address": request.store_address,
            "store_phone": request.store_phone,
            "gstin": request.gstin,
            "customer_name": request.customer_name,
            "items": request.items,
            "subtotal": request.subtotal,
            "tax": request.tax,
            "discount": request.discount,
            "total": request.total,
            "payment_mode": request.payment_mode
        }
        
        result = await print_receipt(
            bill_data=bill_data,
            printer_name=request.printer_name,
            use_thermal=request.use_thermal
        )
        
        return PrintResponse(
            success=result.get("success", False),
            message=result.get("message", "Unknown result"),
            printer=request.printer_name,
            timestamp=result.get("timestamp", datetime.now().isoformat()),
            job_id=f"PJ-{int(datetime.now().timestamp())}"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Print failed: {str(e)}")


@router.post("/preview")
async def preview_receipt(request: PrintReceiptRequest):
    """
    👁️ PREVIEW RECEIPT
    
    Returns the receipt content as text for preview.
    """
    try:
        bill_data = {
            "bill_number": request.bill_number,
            "store_name": request.store_name,
            "customer_name": request.customer_name,
            "items": request.items,
            "subtotal": request.subtotal,
            "tax": request.tax,
            "discount": request.discount,
            "total": request.total,
            "payment_mode": request.payment_mode
        }
        
        builder = ReceiptBuilder()
        content = builder.build_plain_receipt(bill_data)
        
        return {
            "preview": content,
            "lines": content.count('\n') + 1,
            "characters": len(content)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preview failed: {str(e)}")


@router.post("/test")
async def test_print(printer_name: Optional[str] = "auto"):
    """
    🧪 TEST PRINT
    
    Prints a test page to verify printer connectivity.
    """
    try:
        test_bill = {
            "bill_number": "TEST-001",
            "store_name": "KadaiGPT Store",
            "customer_name": "Test Print",
            "items": [
                {"product_name": "Test Item 1", "quantity": 1, "unit_price": 100},
                {"product_name": "Test Item 2", "quantity": 2, "unit_price": 50}
            ],
            "subtotal": 200,
            "tax": 10,
            "total": 210,
            "payment_mode": "Test"
        }
        
        result = await print_receipt(
            bill_data=test_bill,
            printer_name=printer_name,
            use_thermal=True
        )
        
        return {
            "success": result.get("success", False),
            "message": result.get("message", "Test print sent"),
            "printer": printer_name
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Test print failed: {str(e)}")


@router.get("/status")
async def get_print_status():
    """
    📊 PRINT AGENT STATUS
    
    Returns the current status of the print agent.
    """
    printers = await print_agent.get_available_printers()
    ready_count = sum(1 for p in printers if p.status.value == "ready")
    
    return {
        "agent": "PrintAgent",
        "status": "active",
        "total_printers": len(printers),
        "ready_printers": ready_count,
        "last_scan": print_agent.last_scan_time.isoformat() if print_agent.last_scan_time else None,
        "decisions_logged": len(print_agent.decision_log)
    }
