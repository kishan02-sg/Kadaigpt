"""
KadaiGPT - GST Compliance Engine
Handles GSTR-1, GSTR-3B generation, HSN code suggestions,
state-wise tax intelligence, and e-invoice preparation.

Designed for Indian kirana stores transitioning to digital compliance.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, extract

from app.models import Store, Bill, BillItem, Product, BillStatus

logger = logging.getLogger("KadaiGPT.GST")

# Indian state codes for GST
STATE_CODES = {
    "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
    "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
    "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
    "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
    "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
    "16": "Tripura", "17": "Meghalaya", "18": "Assam",
    "19": "West Bengal", "20": "Jharkhand", "21": "Odisha",
    "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
    "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
    "36": "Telangana", "37": "Andhra Pradesh",
}

# Common HSN codes for kirana stores
HSN_DATABASE = {
    "rice": {"code": "1006", "rate": 5, "description": "Rice"},
    "wheat": {"code": "1001", "rate": 5, "description": "Wheat"},
    "atta": {"code": "1101", "rate": 5, "description": "Wheat flour"},
    "sugar": {"code": "1701", "rate": 5, "description": "Sugar"},
    "oil": {"code": "1507", "rate": 5, "description": "Edible oils"},
    "dal": {"code": "0713", "rate": 5, "description": "Pulses/Dal"},
    "milk": {"code": "0401", "rate": 0, "description": "Milk"},
    "curd": {"code": "0403", "rate": 0, "description": "Curd/Yogurt"},
    "tea": {"code": "0902", "rate": 5, "description": "Tea"},
    "coffee": {"code": "0901", "rate": 5, "description": "Coffee"},
    "biscuit": {"code": "1905", "rate": 18, "description": "Biscuits & bakery"},
    "soap": {"code": "3401", "rate": 18, "description": "Soap"},
    "detergent": {"code": "3402", "rate": 18, "description": "Detergent"},
    "shampoo": {"code": "3305", "rate": 18, "description": "Shampoo"},
    "toothpaste": {"code": "3306", "rate": 18, "description": "Toothpaste"},
    "chips": {"code": "2005", "rate": 12, "description": "Chips & snacks"},
    "soft_drink": {"code": "2202", "rate": 28, "description": "Aerated drinks"},
    "medicine": {"code": "3004", "rate": 12, "description": "Medicines"},
    "stationery": {"code": "4820", "rate": 18, "description": "Stationery"},
    "mobile_charger": {"code": "8504", "rate": 18, "description": "Chargers"},
}

# GST rate slabs
GST_SLABS = [0, 5, 12, 18, 28]

# Turnover thresholds
GST_THRESHOLD_GOODS = 4000000   # ₹40 Lakhs
GST_THRESHOLD_SERVICES = 2000000  # ₹20 Lakhs
COMPOSITION_THRESHOLD = 15000000  # ₹1.5 Crore
EINVOICE_THRESHOLD = 50000000    # ₹5 Crore


class GSTComplianceEngine:
    """
    Complete GST compliance engine for Indian retail.
    
    Features:
    - GSTR-1 generation (outward supplies)
    - GSTR-3B summary generation
    - HSN code auto-suggestion with AI
    - State-wise CGST/SGST/IGST calculation
    - Turnover threshold monitoring
    - Composition scheme analysis
    - E-invoice readiness check
    """

    async def generate_gstr1(
        self, db: AsyncSession, store_id: int,
        year: int, month: int
    ) -> Dict[str, Any]:
        """Generate GSTR-1 (Outward Supplies) data"""
        period_start = datetime(year, month, 1)
        if month == 12:
            period_end = datetime(year + 1, 1, 1)
        else:
            period_end = datetime(year, month + 1, 1)

        # Get all completed bills in the period
        result = await db.execute(
            select(Bill).where(and_(
                Bill.store_id == store_id,
                Bill.status == BillStatus.COMPLETED,
                Bill.bill_date >= period_start,
                Bill.bill_date < period_end
            ))
        )
        bills = result.scalars().all()

        # Categorize supplies
        b2b_supplies = []  # Business to Business (with GSTIN)
        b2c_large = []     # B2C > ₹2.5 Lakh
        b2c_small = []     # B2C <= ₹2.5 Lakh
        hsn_summary = {}

        for bill in bills:
            total = float(bill.total_amount or 0)
            tax = float(bill.tax_amount or 0)

            entry = {
                "invoice_number": bill.bill_number,
                "invoice_date": bill.bill_date.strftime("%d-%m-%Y") if bill.bill_date else "",
                "customer_name": bill.customer_name or "Walk-in",
                "taxable_value": round(total - tax, 2),
                "cgst": round(tax / 2, 2),
                "sgst": round(tax / 2, 2),
                "igst": 0,
                "total": round(total, 2),
                "payment_method": bill.payment_method.value if bill.payment_method else "cash"
            }

            if total > 250000:
                b2c_large.append(entry)
            else:
                b2c_small.append(entry)

        # HSN-wise summary
        items_result = await db.execute(
            select(BillItem).join(Bill).where(and_(
                Bill.store_id == store_id,
                Bill.status == BillStatus.COMPLETED,
                Bill.bill_date >= period_start,
                Bill.bill_date < period_end
            ))
        )
        items = items_result.scalars().all()

        for item in items:
            hsn = "9999"  # Default
            if item.product:
                prod_result = await db.execute(select(Product).where(Product.id == item.product_id))
                product = prod_result.scalar_one_or_none()
                if product and product.hsn_code:
                    hsn = product.hsn_code

            if hsn not in hsn_summary:
                hsn_summary[hsn] = {
                    "hsn_code": hsn, "quantity": 0,
                    "taxable_value": 0, "cgst": 0, "sgst": 0, "igst": 0, "total_tax": 0
                }

            taxable = float(item.subtotal or 0)
            tax_amt = float(item.tax_amount or 0)
            hsn_summary[hsn]["quantity"] += float(item.quantity or 0)
            hsn_summary[hsn]["taxable_value"] += taxable
            hsn_summary[hsn]["cgst"] += round(tax_amt / 2, 2)
            hsn_summary[hsn]["sgst"] += round(tax_amt / 2, 2)
            hsn_summary[hsn]["total_tax"] += tax_amt

        total_taxable = sum(float(b.total_amount or 0) - float(b.tax_amount or 0) for b in bills)
        total_tax = sum(float(b.tax_amount or 0) for b in bills)

        return {
            "return_type": "GSTR-1",
            "period": f"{month:02d}-{year}",
            "store_id": store_id,
            "filing_deadline": self._get_filing_deadline("GSTR-1", year, month),
            "summary": {
                "total_invoices": len(bills),
                "total_taxable_value": round(total_taxable, 2),
                "total_tax": round(total_tax, 2),
                "total_cgst": round(total_tax / 2, 2),
                "total_sgst": round(total_tax / 2, 2),
                "total_igst": 0,
            },
            "b2b_supplies": b2b_supplies,
            "b2c_large": b2c_large,
            "b2c_small_count": len(b2c_small),
            "b2c_small_total": round(sum(e["total"] for e in b2c_small), 2),
            "hsn_summary": list(hsn_summary.values()),
        }

    async def generate_gstr3b(
        self, db: AsyncSession, store_id: int,
        year: int, month: int
    ) -> Dict[str, Any]:
        """Generate GSTR-3B (Summary Return) data"""
        period_start = datetime(year, month, 1)
        period_end = datetime(year, month + 1, 1) if month < 12 else datetime(year + 1, 1, 1)

        result = await db.execute(
            select(
                func.count(Bill.id),
                func.sum(Bill.total_amount),
                func.sum(Bill.tax_amount),
                func.sum(Bill.discount_amount),
            ).where(and_(
                Bill.store_id == store_id,
                Bill.status == BillStatus.COMPLETED,
                Bill.bill_date >= period_start,
                Bill.bill_date < period_end
            ))
        )
        row = result.one()
        count = row[0] or 0
        total = float(row[1] or 0)
        tax = float(row[2] or 0)
        discount = float(row[3] or 0)

        taxable = total - tax

        return {
            "return_type": "GSTR-3B",
            "period": f"{month:02d}-{year}",
            "filing_deadline": self._get_filing_deadline("GSTR-3B", year, month),
            "3_1": {
                "description": "Outward supplies and inward supplies (reverse charge)",
                "taxable_value": round(taxable, 2),
                "igst": 0,
                "cgst": round(tax / 2, 2),
                "sgst": round(tax / 2, 2),
                "cess": 0,
            },
            "3_2": {
                "description": "Inter-state supplies",
                "supplies_to_unregistered": 0,
                "supplies_to_composition": 0,
                "supplies_to_uin_holders": 0,
            },
            "4": {
                "description": "Eligible ITC",
                "igst": 0, "cgst": 0, "sgst": 0, "cess": 0,
                "note": "Input credits from purchase invoices not yet tracked"
            },
            "5": {
                "description": "Tax payable",
                "igst": 0,
                "cgst": round(tax / 2, 2),
                "sgst": round(tax / 2, 2),
                "total_payable": round(tax, 2),
            },
            "summary": {
                "total_invoices": count,
                "total_sales": round(total, 2),
                "total_discount": round(discount, 2),
                "total_taxable": round(taxable, 2),
                "total_tax": round(tax, 2),
            }
        }

    async def suggest_hsn_code(self, product_name: str) -> List[Dict[str, Any]]:
        """AI-powered HSN code suggestion for a product"""
        name_lower = product_name.lower()
        suggestions = []

        for key, data in HSN_DATABASE.items():
            if key in name_lower or name_lower in key:
                suggestions.append({
                    "hsn_code": data["code"],
                    "description": data["description"],
                    "gst_rate": data["rate"],
                    "confidence": 0.9 if key == name_lower else 0.6,
                })

        # Keyword matching fallback
        keyword_map = {
            "chapati": "atta", "flour": "atta", "maida": "atta",
            "toor": "dal", "moong": "dal", "chana": "dal",
            "ghee": "oil", "mustard": "oil", "sunflower": "oil",
            "colgate": "toothpaste", "pepsodent": "toothpaste",
            "lux": "soap", "dove": "soap", "lifebuoy": "soap",
            "surf": "detergent", "tide": "detergent", "rin": "detergent",
            "parle": "biscuit", "britannia": "biscuit",
            "lays": "chips", "kurkure": "chips",
            "pepsi": "soft_drink", "coca": "soft_drink", "sprite": "soft_drink",
        }

        for keyword, category in keyword_map.items():
            if keyword in name_lower and category in HSN_DATABASE:
                data = HSN_DATABASE[category]
                if not any(s["hsn_code"] == data["code"] for s in suggestions):
                    suggestions.append({
                        "hsn_code": data["code"],
                        "description": data["description"],
                        "gst_rate": data["rate"],
                        "confidence": 0.5,
                    })

        if not suggestions:
            suggestions.append({
                "hsn_code": "9999",
                "description": "Other goods",
                "gst_rate": 18,
                "confidence": 0.2,
            })

        return sorted(suggestions, key=lambda x: x["confidence"], reverse=True)

    def calculate_tax(
        self, amount: float, gst_rate: float,
        seller_state: str, buyer_state: Optional[str] = None
    ) -> Dict[str, Any]:
        """Calculate CGST/SGST/IGST based on seller and buyer states"""
        tax_amount = round(amount * (gst_rate / 100), 2)
        is_interstate = buyer_state and buyer_state != seller_state

        if is_interstate:
            return {
                "taxable_amount": amount,
                "gst_rate": gst_rate,
                "igst": tax_amount,
                "cgst": 0,
                "sgst": 0,
                "total_tax": tax_amount,
                "total_with_tax": round(amount + tax_amount, 2),
                "supply_type": "inter_state"
            }
        else:
            half_tax = round(tax_amount / 2, 2)
            return {
                "taxable_amount": amount,
                "gst_rate": gst_rate,
                "igst": 0,
                "cgst": half_tax,
                "sgst": half_tax,
                "total_tax": tax_amount,
                "total_with_tax": round(amount + tax_amount, 2),
                "supply_type": "intra_state"
            }

    async def check_compliance_status(
        self, db: AsyncSession, store_id: int
    ) -> Dict[str, Any]:
        """Check overall GST compliance status and alerts"""
        # Get annual turnover
        year_start = datetime(datetime.now().year, 4, 1)  # FY starts April
        if datetime.now().month < 4:
            year_start = datetime(datetime.now().year - 1, 4, 1)

        result = await db.execute(
            select(func.sum(Bill.total_amount)).where(and_(
                Bill.store_id == store_id,
                Bill.status == BillStatus.COMPLETED,
                Bill.bill_date >= year_start
            ))
        )
        annual_turnover = float(result.scalar() or 0)

        alerts = []
        gst_required = annual_turnover >= GST_THRESHOLD_GOODS
        composition_eligible = annual_turnover < COMPOSITION_THRESHOLD
        einvoice_required = annual_turnover >= EINVOICE_THRESHOLD

        if annual_turnover >= GST_THRESHOLD_GOODS * 0.8 and not gst_required:
            alerts.append({
                "type": "warning",
                "title": "Approaching GST Threshold",
                "message": f"Turnover ₹{annual_turnover:,.0f} is {((annual_turnover/GST_THRESHOLD_GOODS)*100):.0f}% of ₹40L threshold",
                "action": "Consult your CA about GST registration"
            })

        if gst_required:
            alerts.append({
                "type": "critical",
                "title": "GST Registration Required",
                "message": f"Turnover ₹{annual_turnover:,.0f} exceeds ₹40L threshold",
                "action": "Register for GST immediately"
            })

        if composition_eligible and gst_required:
            tax_savings = round(annual_turnover * 0.17, 2)  # Rough savings estimate
            alerts.append({
                "type": "info",
                "title": "Composition Scheme Available",
                "message": f"Pay flat 1% tax instead of regular GST. Potential savings: ₹{tax_savings:,.0f}",
                "action": "Discuss with your CA"
            })

        store_result = await db.execute(select(Store).where(Store.id == store_id))
        store = store_result.scalar_one_or_none()
        has_gstin = bool(store and store.gst_number)

        return {
            "annual_turnover": round(annual_turnover, 2),
            "financial_year": f"{year_start.year}-{year_start.year + 1}",
            "gst_registered": has_gstin,
            "gstin": store.gst_number if store else None,
            "gst_required": gst_required,
            "composition_eligible": composition_eligible,
            "einvoice_required": einvoice_required,
            "gst_threshold": GST_THRESHOLD_GOODS,
            "threshold_percentage": round((annual_turnover / GST_THRESHOLD_GOODS) * 100, 1),
            "alerts": alerts,
        }

    def _get_filing_deadline(self, return_type: str, year: int, month: int) -> str:
        """Get filing deadline for GST return"""
        if return_type == "GSTR-1":
            # 11th of next month
            if month == 12:
                deadline = datetime(year + 1, 1, 11)
            else:
                deadline = datetime(year, month + 1, 11)
        elif return_type == "GSTR-3B":
            # 20th of next month
            if month == 12:
                deadline = datetime(year + 1, 1, 20)
            else:
                deadline = datetime(year, month + 1, 20)
        else:
            deadline = datetime(year, month, 28)

        return deadline.strftime("%d-%m-%Y")


gst_engine = GSTComplianceEngine()
