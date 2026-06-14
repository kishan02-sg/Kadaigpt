"""
KadaiGPT - Advanced Analytics & Prediction Agent
Business intelligence and forecasting based on this store's real sales data
"""

from typing import Dict, List
from datetime import datetime, timedelta

from sqlalchemy import select, func, and_

from app.models import Product, Bill, BillItem, BillStatus, Customer

from .base_agent import BaseAgent, AgentTool, ActionType


class AnalyticsAgent(BaseAgent):
    """
    Advanced Analytics Agent - business intelligence grounded in real store data

    Capabilities:
    - Sales forecasting from recent sales history
    - Demand prediction from real sales velocity
    - Trend analysis (weekly patterns, growth/decline)
    - Anomaly detection in daily sales
    - Automated insights generation
    - Customer segmentation
    - What-if scenario estimates
    - Peak hour analysis
    """

    def __init__(self, store_id: int, db=None):
        self.db = db

        super().__init__(
            name="AnalyticsAgent",
            description="Analytics, forecasting, and business intelligence based on real store data",
            store_id=store_id
        )

    @staticmethod
    def _parse_date(value) -> datetime:
        """Normalize a date/datetime/string value returned by func.date() across DB backends"""
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            return datetime.strptime(value[:10], "%Y-%m-%d")
        return datetime(value.year, value.month, value.day)

    async def _get_daily_sales(self, days: int) -> List[Dict]:
        """Real daily sales totals for this store over the last `days` days"""
        start = datetime.now() - timedelta(days=days)

        result = await self.db.execute(
            select(
                func.date(Bill.bill_date).label("day"),
                func.sum(Bill.total_amount).label("sales"),
                func.count(Bill.id).label("bills"),
                func.count(func.distinct(Bill.customer_phone)).label("customers")
            )
            .where(and_(
                Bill.store_id == self.store_id,
                Bill.status == BillStatus.COMPLETED,
                Bill.bill_date >= start
            ))
            .group_by(func.date(Bill.bill_date))
            .order_by(func.date(Bill.bill_date))
        )

        return [
            {
                "date": row[0],
                "sales": float(row[1] or 0),
                "bills": row[2] or 0,
                "customers": row[3] or 0
            }
            for row in result.all()
        ]

    def _register_default_tools(self):
        """Register analytics tools"""

        self.register_tool(AgentTool(
            name="forecast_sales",
            description="Forecast sales for upcoming days based on recent history",
            parameters={"days_ahead": "number of days to forecast"},
            action_type=ActionType.QUERY,
            handler=self._forecast_sales
        ))

        self.register_tool(AgentTool(
            name="predict_demand",
            description="Predict demand for specific products",
            parameters={"product_id": "optional product filter", "period": "prediction period"},
            action_type=ActionType.QUERY,
            handler=self._predict_demand
        ))

        self.register_tool(AgentTool(
            name="analyze_trends",
            description="Analyze sales and customer trends",
            parameters={"metric": "sales/customers/products", "period": "week/month/quarter"},
            action_type=ActionType.QUERY,
            handler=self._analyze_trends
        ))

        self.register_tool(AgentTool(
            name="detect_anomalies",
            description="Detect unusual patterns in data",
            parameters={"sensitivity": "low/medium/high"},
            action_type=ActionType.QUERY,
            handler=self._detect_anomalies
        ))

        self.register_tool(AgentTool(
            name="generate_insights",
            description="Generate business insights from real store data",
            parameters={"focus_area": "optional area to focus on"},
            action_type=ActionType.QUERY,
            handler=self._generate_insights
        ))

        self.register_tool(AgentTool(
            name="customer_segmentation",
            description="Segment customers by spend and recency",
            parameters={},
            action_type=ActionType.QUERY,
            handler=self._segment_customers
        ))

        self.register_tool(AgentTool(
            name="what_if_analysis",
            description="Estimate outcomes of business scenarios",
            parameters={"scenario": "description of scenario"},
            action_type=ActionType.QUERY,
            handler=self._what_if_analysis
        ))

        self.register_tool(AgentTool(
            name="peak_hour_analysis",
            description="Analyze peak hours and optimize staffing",
            parameters={},
            action_type=ActionType.QUERY,
            handler=self._peak_hour_analysis
        ))

    async def think(self, input_data: Dict) -> Dict:
        """Analytics-specific reasoning"""
        goal = input_data.get('goal', '').lower()

        if 'forecast' in goal or 'predict' in goal or 'future' in goal:
            days = 7  # Default
            if 'week' in goal:
                days = 7
            elif 'month' in goal:
                days = 30
            return {
                "action": "forecast_sales",
                "parameters": {"days_ahead": days},
                "reasoning": "User wants sales forecast"
            }
        elif 'trend' in goal or 'pattern' in goal:
            return {
                "action": "analyze_trends",
                "parameters": {"metric": "sales", "period": "month"},
                "reasoning": "User wants trend analysis"
            }
        elif 'anomal' in goal or 'unusual' in goal or 'strange' in goal:
            return {
                "action": "detect_anomalies",
                "parameters": {"sensitivity": "medium"},
                "reasoning": "User wants anomaly detection"
            }
        elif 'insight' in goal or 'suggest' in goal or 'recommend' in goal:
            return {
                "action": "generate_insights",
                "parameters": {},
                "reasoning": "User wants AI insights"
            }
        elif 'customer' in goal or 'segment' in goal:
            return {
                "action": "customer_segmentation",
                "parameters": {},
                "reasoning": "User wants customer analysis"
            }
        elif 'what if' in goal or 'scenario' in goal or 'simulate' in goal:
            return {
                "action": "what_if_analysis",
                "parameters": {"scenario": goal},
                "reasoning": "User wants scenario analysis"
            }
        elif 'peak' in goal or 'hour' in goal or 'busy' in goal:
            return {
                "action": "peak_hour_analysis",
                "parameters": {},
                "reasoning": "User wants peak hour analysis"
            }
        else:
            return {
                "action": "generate_insights",
                "parameters": {},
                "reasoning": "Default to generating insights"
            }

    # ==================== Tool Handlers ====================

    async def _forecast_sales(self, days_ahead: int = 7) -> Dict:
        """Forecast sales using exponential smoothing over this store's last 30 days"""
        daily = await self._get_daily_sales(30)

        if len(daily) < 3:
            return {
                "status": "success",
                "forecast_period": f"{days_ahead} days",
                "predictions": [],
                "summary": {},
                "recommendations": [],
                "note": "Not enough sales history yet to generate a forecast. Record bills for a few more days."
            }

        sales_values = [d["sales"] for d in daily]
        overall_avg = sum(sales_values) / len(sales_values)

        weekday_totals: Dict[int, List[float]] = {}
        for d in daily:
            wd = self._parse_date(d["date"]).weekday()
            weekday_totals.setdefault(wd, []).append(d["sales"])
        weekday_avg = {wd: sum(vals) / len(vals) for wd, vals in weekday_totals.items()}

        variance = sum((v - overall_avg) ** 2 for v in sales_values) / len(sales_values)
        std_dev = variance ** 0.5

        alpha = 0.3
        forecast = sales_values[-1]

        predictions = []
        for i in range(days_ahead):
            future_date = datetime.now() + timedelta(days=i + 1)
            weekday = future_date.weekday()
            weekly_factor = (weekday_avg[weekday] / overall_avg) if weekday in weekday_avg and overall_avg > 0 else 1.0

            predicted_value = max(0, forecast * weekly_factor)

            predictions.append({
                "date": future_date.strftime("%Y-%m-%d"),
                "day": future_date.strftime("%A"),
                "predicted_sales": round(predicted_value),
                "lower_bound": round(max(0, predicted_value - 1.96 * std_dev)),
                "upper_bound": round(predicted_value + 1.96 * std_dev),
                "confidence": round(max(0.5, 0.85 - i * 0.02), 2)
            })

            forecast = alpha * sales_values[-1] + (1 - alpha) * forecast

        total_predicted = sum(p["predicted_sales"] for p in predictions)
        avg_daily = total_predicted // days_ahead
        best = max(predictions, key=lambda x: x["predicted_sales"])

        return {
            "status": "success",
            "forecast_period": f"{days_ahead} days",
            "predictions": predictions,
            "summary": {
                "total_predicted_sales": total_predicted,
                "average_daily": avg_daily,
                "best_day": best["day"],
                "model_used": "Exponential smoothing with weekly seasonality (based on your last 30 days)"
            },
            "recommendations": [
                f"Expected peak day: {best['day']} (₹{best['predicted_sales']:,})",
                "Stock up on fast-moving items before your peak day",
                "Consider promotional offers on slower days"
            ]
        }

    async def _predict_demand(self, product_id: int = None, period: str = "week") -> Dict:
        """Predict demand for products based on the last 30 days of real sales"""
        period_days = {"week": 7, "month": 30, "quarter": 90}.get(period, 7)
        thirty_days_ago = datetime.now() - timedelta(days=30)

        query = (
            select(
                BillItem.product_id,
                BillItem.product_name,
                func.sum(BillItem.quantity).label("total_qty")
            )
            .join(Bill, Bill.id == BillItem.bill_id)
            .where(and_(
                Bill.store_id == self.store_id,
                Bill.status == BillStatus.COMPLETED,
                Bill.bill_date >= thirty_days_ago,
                BillItem.product_id.isnot(None)
            ))
        )
        if product_id:
            query = query.where(BillItem.product_id == product_id)

        query = (
            query.group_by(BillItem.product_id, BillItem.product_name)
            .order_by(func.sum(BillItem.quantity).desc())
            .limit(10)
        )

        sales_result = await self.db.execute(query)
        sales_rows = sales_result.all()

        if not sales_rows:
            return {
                "status": "success",
                "period": period,
                "predictions": [],
                "summary": {"products_analyzed": 0, "need_urgent_order": 0, "total_shortfall": 0},
                "action_items": [],
                "note": "Not enough sales history yet to predict demand."
            }

        product_ids = [row[0] for row in sales_rows]
        products_result = await self.db.execute(select(Product).where(Product.id.in_(product_ids)))
        products_by_id = {p.id: p for p in products_result.scalars().all()}

        predictions = []
        for pid, pname, total_qty in sales_rows:
            daily_avg = (total_qty or 0) / 30
            product = products_by_id.get(pid)
            current_stock = (product.current_stock or 0) if product else 0
            predicted_demand = round(daily_avg * period_days, 1)
            days_of_stock = round(current_stock / daily_avg, 1) if daily_avg > 0 else None
            shortfall = max(0, round(predicted_demand - current_stock))

            if days_of_stock is not None and days_of_stock < 3:
                action = "order_urgent"
            elif days_of_stock is not None and days_of_stock < 7:
                action = "order_soon"
            else:
                action = "sufficient"

            predictions.append({
                "id": pid,
                "name": pname,
                "current_stock": current_stock,
                "predicted_demand": predicted_demand,
                "days_of_stock": days_of_stock,
                "shortfall": shortfall,
                "action": action
            })

        urgent = [p for p in predictions if p["action"] == "order_urgent"]

        return {
            "status": "success",
            "period": period,
            "predictions": predictions,
            "summary": {
                "products_analyzed": len(predictions),
                "need_urgent_order": len(urgent),
                "total_shortfall": sum(p["shortfall"] for p in predictions)
            },
            "action_items": [
                f"URGENT: Order {p['name']} - only {p['days_of_stock']} days of stock left"
                for p in urgent
            ]
        }

    async def _analyze_trends(self, metric: str = "sales", period: str = "month") -> Dict:
        """Analyze sales trends using real daily sales totals"""
        days = 30 if period == "month" else 7 if period == "week" else 90
        daily = await self._get_daily_sales(days)

        if len(daily) < 3:
            return {
                "status": "success",
                "period": period,
                "trend": {},
                "weekly_pattern": {},
                "insights": [],
                "recommendations": [],
                "note": "Not enough sales history yet to analyze trends."
            }

        values = [d["sales"] for d in daily]
        n = len(values)
        x_mean = (n - 1) / 2
        y_mean = sum(values) / n

        numerator = sum((i - x_mean) * (values[i] - y_mean) for i in range(n))
        denominator = sum((i - x_mean) ** 2 for i in range(n))
        slope = numerator / denominator if denominator != 0 else 0

        threshold = y_mean * 0.01 if y_mean else 0
        trend_direction = "upward" if slope > threshold else "downward" if slope < -threshold else "stable"
        trend_strength = abs(slope) / y_mean * 100 if y_mean else 0

        weekday_totals: Dict[str, List[float]] = {}
        for d in daily:
            day_name = self._parse_date(d["date"]).strftime("%A")
            weekday_totals.setdefault(day_name, []).append(d["sales"])

        weekday_summary = {
            day: round(sum(vals) / len(vals)) for day, vals in weekday_totals.items()
        }

        best_day = max(weekday_summary, key=weekday_summary.get)
        worst_day = min(weekday_summary, key=weekday_summary.get)

        insights = [
            f"{best_day} is your best day with ₹{weekday_summary[best_day]:,} avg sales",
            f"{worst_day} is your slowest day with ₹{weekday_summary[worst_day]:,} avg sales"
        ]
        if best_day != worst_day:
            insights.append(
                f"Potential gain: ₹{(weekday_summary[best_day] - weekday_summary[worst_day]) * 4:,}/month "
                f"if {worst_day} sales matched {best_day}"
            )

        return {
            "status": "success",
            "period": period,
            "trend": {
                "direction": trend_direction,
                "strength": f"{trend_strength:.1f}%",
                "daily_change": f"₹{abs(slope):.0f}",
                "interpretation": f"Sales are {trend_direction} at roughly ₹{abs(slope):.0f}/day"
            },
            "weekly_pattern": weekday_summary,
            "insights": insights,
            "recommendations": [
                f"Consider special offers on {worst_day} to boost sales",
                f"Ensure full staffing on {best_day}",
                "Track this trend weekly to catch changes early"
            ]
        }

    async def _detect_anomalies(self, sensitivity: str = "medium") -> Dict:
        """Detect unusual sales days using z-score analysis over the last 30 days"""
        daily = await self._get_daily_sales(30)

        if len(daily) < 5:
            return {
                "status": "success",
                "sensitivity": sensitivity,
                "baseline": {},
                "anomalies_found": 0,
                "anomalies": [],
                "summary": "Not enough sales history yet to detect anomalies.",
                "recommendation": "Record sales for at least a week to enable anomaly detection."
            }

        values = [d["sales"] for d in daily]
        mean = sum(values) / len(values)
        variance = sum((x - mean) ** 2 for x in values) / len(values)
        std_dev = variance ** 0.5

        thresholds = {"low": 3, "medium": 2, "high": 1.5}
        z_threshold = thresholds.get(sensitivity, 2)

        anomalies = []
        for d in daily:
            z_score = abs(d["sales"] - mean) / std_dev if std_dev > 0 else 0
            if z_score > z_threshold:
                anomalies.append({
                    "date": self._parse_date(d["date"]).strftime("%Y-%m-%d"),
                    "actual": round(d["sales"]),
                    "expected": round(mean),
                    "deviation": f"{((d['sales'] - mean) / mean * 100):+.1f}%" if mean else "0%",
                    "z_score": round(z_score, 2),
                    "severity": "high" if z_score > 3 else "medium" if z_score > 2 else "low",
                    "possible_causes": self._generate_anomaly_causes(d["sales"], mean)
                })

        return {
            "status": "success",
            "sensitivity": sensitivity,
            "baseline": {
                "mean_sales": round(mean),
                "std_deviation": round(std_dev),
                "threshold_used": f"±{z_threshold} standard deviations"
            },
            "anomalies_found": len(anomalies),
            "anomalies": anomalies,
            "summary": f"Found {len(anomalies)} unusual day(s) in the last {len(daily)} days",
            "recommendation": "Investigate high-severity anomalies to understand causes" if anomalies else "No unusual patterns detected"
        }

    def _generate_anomaly_causes(self, actual: float, expected: float) -> List[str]:
        """Generate possible causes for anomaly"""
        if actual > expected:
            return ["Festival/holiday", "Special promotion", "Competitor closed", "Bulk order"]
        else:
            return ["Weather issue", "Stock shortage", "Competitor promotion", "Staff shortage"]

    async def _generate_insights(self, focus_area: str = None) -> Dict:
        """Generate business insights from this store's real sales, stock and customer data"""
        insights = []

        # Weekly sales pattern
        trends = await self._analyze_trends(period="month")
        weekly_pattern = trends.get("weekly_pattern") or {}
        if len(weekly_pattern) >= 2:
            best_day = max(weekly_pattern, key=weekly_pattern.get)
            worst_day = min(weekly_pattern, key=weekly_pattern.get)
            if best_day != worst_day:
                insights.append({
                    "category": "trend",
                    "title": f"{best_day} Sales Surge",
                    "description": f"Your {best_day} sales average ₹{weekly_pattern[best_day]:,}, compared to ₹{weekly_pattern[worst_day]:,} on {worst_day}",
                    "impact": "high",
                    "confidence": 0.8,
                    "recommended_action": f"Ensure full stock and staffing on {best_day}s, and consider promotions on {worst_day}s"
                })

        # Top selling product
        thirty_days_ago = datetime.now() - timedelta(days=30)
        top_product_result = await self.db.execute(
            select(BillItem.product_name, func.sum(BillItem.quantity).label("qty"))
            .join(Bill, Bill.id == BillItem.bill_id)
            .where(and_(
                Bill.store_id == self.store_id,
                Bill.status == BillStatus.COMPLETED,
                Bill.bill_date >= thirty_days_ago
            ))
            .group_by(BillItem.product_name)
            .order_by(func.sum(BillItem.quantity).desc())
            .limit(1)
        )
        top_product = top_product_result.first()
        if top_product:
            insights.append({
                "category": "opportunity",
                "title": f"{top_product[0]} is Your Top Seller",
                "description": f"{top_product[0]} sold {int(top_product[1])} units in the last 30 days - your highest by volume",
                "impact": "medium",
                "confidence": 0.75,
                "recommended_action": f"Keep {top_product[0]} well-stocked and consider featuring it near checkout"
            })

        # Customer concentration + at-risk loyal customers
        customers_result = await self.db.execute(
            select(Customer).where(and_(
                Customer.store_id == self.store_id,
                Customer.is_active == True
            )).order_by(Customer.total_purchases.desc())
        )
        customers = customers_result.scalars().all()

        if len(customers) >= 5:
            total_revenue = sum(c.total_purchases or 0 for c in customers)
            top_n = max(1, round(len(customers) * 0.1))
            top_revenue = sum((c.total_purchases or 0) for c in customers[:top_n])
            if total_revenue > 0:
                concentration = top_revenue / total_revenue * 100
                if concentration > 30:
                    insights.append({
                        "category": "risk",
                        "title": "Customer Concentration Risk",
                        "description": f"Your top {top_n} customer(s) account for {concentration:.0f}% of tracked customer revenue",
                        "impact": "medium",
                        "confidence": 0.8,
                        "recommended_action": "Run a customer acquisition push to reduce dependency on a small group"
                    })

        now = datetime.now()
        at_risk = []
        for c in customers:
            if (c.total_purchases or 0) > 1000 and c.last_purchase:
                last = c.last_purchase.replace(tzinfo=None) if c.last_purchase.tzinfo else c.last_purchase
                if (now - last).days > 30:
                    at_risk.append(c)
        if at_risk:
            insights.append({
                "category": "action",
                "title": "Loyal Customers Going Quiet",
                "description": f"{len(at_risk)} high-value customer(s) haven't purchased in over 30 days",
                "impact": "high",
                "confidence": 0.8,
                "recommended_action": "Send a personalized re-engagement message via WhatsApp"
            })

        # Low stock
        stock_result = await self.db.execute(
            select(func.count(Product.id)).where(and_(
                Product.store_id == self.store_id,
                Product.is_active == True,
                Product.current_stock <= Product.min_stock_alert
            ))
        )
        low_stock_count = stock_result.scalar() or 0
        if low_stock_count > 0:
            insights.append({
                "category": "action",
                "title": "Items Need Restocking",
                "description": f"{low_stock_count} product(s) are at or below their minimum stock level",
                "impact": "high",
                "confidence": 1.0,
                "recommended_action": "Review the reorder list and place orders for critical items"
            })

        if not insights:
            insights.append({
                "category": "trend",
                "title": "Getting Started",
                "description": "Keep recording sales and managing stock - insights will improve as more data builds up",
                "impact": "low",
                "confidence": 1.0,
                "recommended_action": "Record daily sales consistently for richer insights"
            })

        return {
            "status": "success",
            "insights_count": len(insights),
            "insights": insights,
            "summary": {
                "high_impact": len([i for i in insights if i["impact"] == "high"]),
                "opportunities": len([i for i in insights if i["category"] == "opportunity"]),
                "risks": len([i for i in insights if i["category"] == "risk"])
            },
            "next_steps": [
                "Address high-impact items first",
                "Review insights weekly as more sales data builds up"
            ]
        }

    async def _segment_customers(self) -> Dict:
        """Segment this store's real customers by spend and recency"""
        result = await self.db.execute(
            select(Customer).where(and_(
                Customer.store_id == self.store_id,
                Customer.is_active == True
            ))
        )
        customers = result.scalars().all()

        if not customers:
            return {
                "status": "success",
                "total_customers": 0,
                "segments": [],
                "key_insights": [],
                "note": "No customers recorded yet."
            }

        now = datetime.now()
        spends = sorted([c.total_purchases or 0 for c in customers], reverse=True)
        high_spend_cutoff = spends[max(0, len(spends) // 5 - 1)]
        mid_spend_cutoff = spends[max(0, len(spends) // 2 - 1)]

        def recency_days(c):
            if not c.last_purchase:
                return None
            last = c.last_purchase.replace(tzinfo=None) if c.last_purchase.tzinfo else c.last_purchase
            return (now - last).days

        buckets: Dict[str, List] = {
            "Champions": [],
            "Loyal Customers": [],
            "At Risk": [],
            "Lost": [],
            "New / Potential": []
        }

        for c in customers:
            spend = c.total_purchases or 0
            days_since = recency_days(c)

            if days_since is None or days_since > 90:
                buckets["Lost"].append(c)
            elif spend >= high_spend_cutoff > 0 and days_since <= 30:
                buckets["Champions"].append(c)
            elif spend >= mid_spend_cutoff > 0 and days_since <= 60:
                buckets["Loyal Customers"].append(c)
            elif spend >= mid_spend_cutoff > 0 and days_since > 60:
                buckets["At Risk"].append(c)
            else:
                buckets["New / Potential"].append(c)

        strategies = {
            "Champions": "Reward them - early access to new products and exclusive offers",
            "Loyal Customers": "Upsell higher value products and ask for referrals",
            "At Risk": "Send a personalized offer to bring them back",
            "Lost": "Win-back campaign or deprioritize",
            "New / Potential": "Encourage repeat visits with a loyalty program"
        }

        total = len(customers)
        segments = []
        for name, members in buckets.items():
            if not members:
                continue
            avg_spend = sum((c.total_purchases or 0) for c in members) / len(members)
            segments.append({
                "segment": name,
                "count": len(members),
                "percentage": round(len(members) / total * 100),
                "avg_spend": round(avg_spend, 2),
                "strategy": strategies[name]
            })

        key_insights = []
        champions = next((s for s in segments if s["segment"] == "Champions"), None)
        loyal = next((s for s in segments if s["segment"] == "Loyal Customers"), None)
        at_risk = next((s for s in segments if s["segment"] == "At Risk"), None)
        if champions or loyal:
            combined_pct = (champions["percentage"] if champions else 0) + (loyal["percentage"] if loyal else 0)
            key_insights.append(f"Champions + Loyal Customers make up {combined_pct}% of your customer base")
        if at_risk:
            key_insights.append(f"{at_risk['count']} customer(s) are at risk of churning - consider reaching out")

        return {
            "status": "success",
            "total_customers": total,
            "segments": segments,
            "key_insights": key_insights
        }

    async def _what_if_analysis(self, scenario: str = "") -> Dict:
        """Estimate outcomes of business scenarios, grounded in this store's real numbers where possible"""
        scenario_lower = scenario.lower()

        if "discount" in scenario_lower or "20%" in scenario_lower:
            daily = await self._get_daily_sales(30)
            avg_daily_sales = sum(d["sales"] for d in daily) / len(daily) if daily else 0

            return {
                "scenario": "20% Discount on All Products",
                "simulation_period": "1 week",
                "based_on": (
                    f"Your average daily sales of ₹{avg_daily_sales:,.0f}"
                    if daily else "Industry-average assumptions (no sales history yet)"
                ),
                "predictions": {
                    "baseline_weekly_revenue": round(avg_daily_sales * 7),
                    "estimated_volume_change": "+30% to +50%",
                    "estimated_revenue_change": "+10% to +20%",
                    "margin_impact": "Lower per-unit margin - monitor closely"
                },
                "recommendation": "Run for a short, fixed window (3-5 days) and compare actual results against this baseline",
                "risks": ["Margin erosion", "Customers expecting permanently lower prices"],
                "ideal_timing": "End of month or during a festival period",
                "is_estimate": True
            }
        elif "staff" in scenario_lower or "hire" in scenario_lower:
            return {
                "scenario": "Hire 1 Additional Staff Member",
                "simulation_period": "1 month",
                "predictions": {
                    "expected_benefit": "Reduced wait times during peak hours, improved customer experience",
                    "typical_monthly_cost": "₹9,000 - ₹18,000 depending on part-time vs full-time"
                },
                "recommendation": "Consider part-time staff for peak hours only, then track sales before/after to measure impact",
                "is_estimate": True
            }
        elif "price" in scenario_lower or "increase" in scenario_lower:
            products_result = await self.db.execute(
                select(Product).where(and_(
                    Product.store_id == self.store_id,
                    Product.is_active == True,
                    Product.cost_price.isnot(None),
                    Product.selling_price.isnot(None),
                    Product.selling_price > 0
                ))
            )
            products = products_result.scalars().all()
            margins = [(p.selling_price - p.cost_price) / p.selling_price for p in products]
            avg_margin = sum(margins) / len(margins) if margins else 0

            return {
                "scenario": "5% Price Increase on All Products",
                "simulation_period": "1 month",
                "based_on": (
                    f"Your current average margin of {avg_margin * 100:.1f}%"
                    if margins else "No product pricing data available yet"
                ),
                "predictions": {
                    "estimated_volume_change": "-5% to -10%",
                    "estimated_revenue_change": "-3% to +2%",
                    "estimated_margin_change": f"+{avg_margin * 100 * 0.05:.1f} percentage points" if margins else "N/A"
                },
                "recommendation": "Avoid raising prices on staples (rice, dal, oil, sugar) which customers price-check most",
                "is_estimate": True
            }
        else:
            return {
                "scenario": scenario or "General business outlook",
                "available_scenarios": [
                    "What if I give a 20% discount?",
                    "What if I hire more staff?",
                    "What if I increase prices by 5%?"
                ],
                "message": "Please specify a scenario from the list above or describe your own"
            }

    async def _peak_hour_analysis(self) -> Dict:
        """Analyze peak hours from this store's real bills over the last 30 days"""
        thirty_days_ago = datetime.now() - timedelta(days=30)

        result = await self.db.execute(
            select(
                func.extract('hour', Bill.bill_date).label("hour"),
                func.sum(Bill.total_amount).label("sales"),
                func.count(Bill.id).label("bills")
            )
            .where(and_(
                Bill.store_id == self.store_id,
                Bill.status == BillStatus.COMPLETED,
                Bill.bill_date >= thirty_days_ago
            ))
            .group_by(func.extract('hour', Bill.bill_date))
        )
        rows = result.all()

        if not rows:
            return {
                "status": "success",
                "hourly_breakdown": {},
                "peak_hours": {},
                "slow_hours": {},
                "note": "Not enough sales history yet to analyze peak hours."
            }

        days_result = await self.db.execute(
            select(func.count(func.distinct(func.date(Bill.bill_date))))
            .where(and_(
                Bill.store_id == self.store_id,
                Bill.status == BillStatus.COMPLETED,
                Bill.bill_date >= thirty_days_ago
            ))
        )
        num_days = days_result.scalar() or 1

        hourly_data = {}
        for hour, sales, bills in rows:
            hour = int(hour)
            label = f"{hour:02d}:00-{(hour + 1) % 24:02d}:00"
            hourly_data[label] = {
                "hour": hour,
                "avg_sales": round((sales or 0) / num_days, 2),
                "avg_bills": round((bills or 0) / num_days, 2)
            }

        sorted_hours = sorted(hourly_data.items(), key=lambda x: x[1]["avg_sales"], reverse=True)
        peak_hours = [h for h, _ in sorted_hours[:3]]
        slow_hours = [h for h, _ in sorted_hours[-3:]]

        return {
            "status": "success",
            "hourly_breakdown": dict(sorted(hourly_data.items(), key=lambda x: x[1]["hour"])),
            "peak_hours": {
                "hours": peak_hours,
                "recommendation": "Ensure adequate staffing during these hours"
            },
            "slow_hours": {
                "hours": slow_hours,
                "recommendation": "Good time for restocking and inventory tasks"
            }
        }
