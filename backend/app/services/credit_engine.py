"""
KadaiGPT - Credit Management Engine (Credit Book 2.0)
AI-powered credit scoring, automated reminders, family linking,
and payment lifecycle management for kirana stores.
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.models import Store, Bill, Customer, BillStatus, PaymentMethod

logger = logging.getLogger("KadaiGPT.Credit")

# Credit score thresholds
CREDIT_SCORE_GREEN = 80   # Reliable payer
CREDIT_SCORE_YELLOW = 50  # Occasional delays
CREDIT_SCORE_RED = 30     # High risk


class CreditEngine:
    """
    Credit Book 2.0 for Kirana Stores
    
    Features:
    - AI-based credit scoring (Green/Yellow/Red)
    - Automated payment reminders via WhatsApp
    - Family account linking
    - Credit limit recommendations
    - Payment history analytics
    - Aging analysis (30/60/90 day buckets)
    """

    async def get_credit_summary(
        self, db: AsyncSession, store_id: int
    ) -> Dict[str, Any]:
        """Get store-wide credit summary"""
        result = await db.execute(
            select(Customer).where(
                and_(Customer.store_id == store_id, Customer.credit > 0)
            )
        )
        customers = result.scalars().all()

        total_credit = sum(float(c.credit or 0) for c in customers)
        
        # Categorize by risk
        green = [c for c in customers if self._calculate_score(c) >= CREDIT_SCORE_GREEN]
        yellow = [c for c in customers if CREDIT_SCORE_RED <= self._calculate_score(c) < CREDIT_SCORE_GREEN]
        red = [c for c in customers if self._calculate_score(c) < CREDIT_SCORE_RED]

        return {
            "total_outstanding": round(total_credit, 2),
            "total_customers_with_credit": len(customers),
            "risk_distribution": {
                "green": {"count": len(green), "amount": round(sum(float(c.credit or 0) for c in green), 2)},
                "yellow": {"count": len(yellow), "amount": round(sum(float(c.credit or 0) for c in yellow), 2)},
                "red": {"count": len(red), "amount": round(sum(float(c.credit or 0) for c in red), 2)},
            },
            "top_debtors": [
                {"name": c.name, "phone": c.phone, "amount": round(float(c.credit or 0), 2),
                 "score": self._calculate_score(c), "risk": self._get_risk_label(c)}
                for c in sorted(customers, key=lambda x: float(x.credit or 0), reverse=True)[:10]
            ],
            "aging_summary": self._aging_summary(customers),
        }

    async def get_customer_credit_details(
        self, db: AsyncSession, store_id: int, customer_id: int
    ) -> Dict[str, Any]:
        """Get detailed credit info for a specific customer"""
        result = await db.execute(
            select(Customer).where(
                and_(Customer.id == customer_id, Customer.store_id == store_id)
            )
        )
        customer = result.scalar_one_or_none()
        if not customer:
            raise ValueError(f"Customer {customer_id} not found")

        # Get credit purchase history
        bills_result = await db.execute(
            select(Bill).where(
                and_(
                    Bill.store_id == store_id,
                    Bill.customer_phone == customer.phone,
                    Bill.payment_method == PaymentMethod.CREDIT
                )
            ).order_by(Bill.created_at.desc()).limit(20)
        )
        credit_bills = bills_result.scalars().all()

        score = self._calculate_score(customer)
        
        # Determine recommended credit limit
        avg_purchase = float(customer.total_purchases or 0) / max(1, len(credit_bills))
        recommended_limit = round(avg_purchase * 3, -2)  # 3x avg purchase, rounded to 100

        return {
            "customer": {
                "id": customer.id,
                "name": customer.name,
                "phone": customer.phone,
                "email": customer.email,
            },
            "credit": {
                "outstanding": round(float(customer.credit or 0), 2),
                "total_purchases": round(float(customer.total_purchases or 0), 2),
                "credit_score": score,
                "risk_level": self._get_risk_label(customer),
                "recommended_limit": max(recommended_limit, 1000),
                "last_purchase": customer.last_purchase.isoformat() if customer.last_purchase else None,
            },
            "recent_credit_bills": [
                {
                    "bill_number": b.bill_number,
                    "amount": round(float(b.total_amount or 0), 2),
                    "date": b.bill_date.strftime("%d-%m-%Y") if b.bill_date else "",
                    "status": b.status.value if b.status else "completed",
                }
                for b in credit_bills[:10]
            ],
            "ai_insights": self._generate_credit_insights(customer, credit_bills),
        }

    async def get_overdue_customers(
        self, db: AsyncSession, store_id: int, days_threshold: int = 30
    ) -> List[Dict[str, Any]]:
        """Get customers with overdue credit"""
        result = await db.execute(
            select(Customer).where(
                and_(Customer.store_id == store_id, Customer.credit > 0)
            )
        )
        customers = result.scalars().all()
        
        overdue = []
        threshold_date = datetime.utcnow() - timedelta(days=days_threshold)
        
        for c in customers:
            if c.last_purchase and c.last_purchase < threshold_date:
                days_overdue = (datetime.utcnow() - c.last_purchase).days
                overdue.append({
                    "id": c.id,
                    "name": c.name,
                    "phone": c.phone,
                    "amount": round(float(c.credit or 0), 2),
                    "days_overdue": days_overdue,
                    "risk": self._get_risk_label(c),
                    "score": self._calculate_score(c),
                    "suggested_action": self._suggest_action(c, days_overdue),
                })
        
        return sorted(overdue, key=lambda x: x["amount"], reverse=True)

    async def generate_reminder_message(
        self, db: AsyncSession, store_id: int, customer_id: int,
        language: str = "en"
    ) -> Dict[str, Any]:
        """Generate payment reminder message in specified language"""
        result = await db.execute(
            select(Customer).where(
                and_(Customer.id == customer_id, Customer.store_id == store_id)
            )
        )
        customer = result.scalar_one_or_none()
        if not customer:
            raise ValueError("Customer not found")

        store_result = await db.execute(select(Store).where(Store.id == store_id))
        store = store_result.scalar_one_or_none()
        store_name = store.name if store else "Our Store"

        amount = float(customer.credit or 0)
        
        templates = {
            "en": f"Hi {customer.name}, this is a friendly reminder from {store_name}. "
                  f"Your pending amount is ₹{amount:,.0f}. "
                  f"Please visit us to settle your account. Thank you! 🙏",
            "ta": f"வணக்கம் {customer.name}, {store_name} கடையிலிருந்து நினைவூட்டல். "
                  f"உங்கள் நிலுவைத் தொகை ₹{amount:,.0f}. "
                  f"தயவுசெய்து உங்கள் கணக்கை தீர்க்கவும். நன்றி! 🙏",
            "hi": f"नमस्ते {customer.name}, {store_name} से याद दिलाना. "
                  f"आपकी बकाया राशि ₹{amount:,.0f} है। "
                  f"कृपया अपना हिसाब चुकाएं। धन्यवाद! 🙏",
            "te": f"నమస్కారం {customer.name}, {store_name} నుండి రిమైండర్. "
                  f"మీ బకాయి ₹{amount:,.0f}. "
                  f"దయచేసి మీ ఖాతాను సెటిల్ చేయండి. ధన్యవాదాలు! 🙏",
        }

        message = templates.get(language, templates["en"])

        return {
            "customer_name": customer.name,
            "customer_phone": customer.phone,
            "amount": round(amount, 2),
            "message": message,
            "language": language,
            "channel": "whatsapp",
        }

    # ── Private Helpers ──

    def _calculate_score(self, customer) -> int:
        """Calculate credit score (0-100) based on available data"""
        score = 70  # Base score
        
        credit = float(customer.credit or 0)
        total = float(customer.total_purchases or 0)
        
        # Credit utilization (lower is better)
        if total > 0:
            utilization = credit / total
            if utilization > 0.5:
                score -= 30
            elif utilization > 0.3:
                score -= 15
            elif utilization < 0.1:
                score += 10
        
        # Recency of last purchase
        if customer.last_purchase:
            days_since = (datetime.utcnow() - customer.last_purchase).days
            if days_since > 90:
                score -= 25
            elif days_since > 60:
                score -= 15
            elif days_since > 30:
                score -= 5
            elif days_since < 7:
                score += 10
        else:
            score -= 10
        
        # Loyalty (total purchases indicate trust)
        if total > 50000:
            score += 15
        elif total > 20000:
            score += 10
        elif total > 5000:
            score += 5
        
        return max(0, min(100, score))

    def _get_risk_label(self, customer) -> str:
        score = self._calculate_score(customer)
        if score >= CREDIT_SCORE_GREEN:
            return "green"
        elif score >= CREDIT_SCORE_YELLOW:
            return "yellow"
        return "red"

    def _aging_summary(self, customers) -> Dict[str, Any]:
        """Categorize credit into aging buckets"""
        buckets = {"0-30": 0, "31-60": 0, "61-90": 0, "90+": 0}
        now = datetime.utcnow()
        
        for c in customers:
            amount = float(c.credit or 0)
            if amount <= 0:
                continue
            if c.last_purchase:
                days = (now - c.last_purchase).days
                if days <= 30:
                    buckets["0-30"] += amount
                elif days <= 60:
                    buckets["31-60"] += amount
                elif days <= 90:
                    buckets["61-90"] += amount
                else:
                    buckets["90+"] += amount
            else:
                buckets["90+"] += amount
        
        return {k: round(v, 2) for k, v in buckets.items()}

    def _suggest_action(self, customer, days_overdue: int) -> str:
        amount = float(customer.credit or 0)
        if days_overdue > 90:
            return f"Send final notice. Consider offering {int(amount*0.1)} discount for immediate payment."
        elif days_overdue > 60:
            return "Send firm reminder via WhatsApp and call. Offer installment plan."
        elif days_overdue > 30:
            return "Send friendly WhatsApp reminder with payment link."
        return "Normal follow-up during next visit."

    def _generate_credit_insights(self, customer, bills) -> List[str]:
        insights = []
        credit = float(customer.credit or 0)
        
        if credit > 5000:
            insights.append(f"⚠️ High outstanding amount of ₹{credit:,.0f}")
        
        if customer.last_purchase:
            days = (datetime.utcnow() - customer.last_purchase).days
            if days > 30:
                insights.append(f"📅 No purchase in {days} days - may need reminder")
        
        if len(bills) > 5:
            avg = sum(float(b.total_amount or 0) for b in bills) / len(bills)
            insights.append(f"📊 Average credit purchase: ₹{avg:,.0f}")
        
        score = self._calculate_score(customer)
        if score >= CREDIT_SCORE_GREEN:
            insights.append("✅ Good credit history - reliable payer")
        elif score < CREDIT_SCORE_RED:
            insights.append("🔴 High risk - consider reducing credit limit")
        
        return insights


credit_engine = CreditEngine()
