"""
KadaiGPT - Inventory Intelligence Agent
Autonomous inventory management with real sales-data-driven predictions
"""

from typing import Dict, List
from datetime import datetime, timedelta

from sqlalchemy import select, func, and_

from app.models import Product, Bill, BillItem, BillStatus

from .base_agent import BaseAgent, AgentTool, ActionType


class InventoryAgent(BaseAgent):
    """
    Inventory Intelligence Agent - Autonomous inventory management

    Capabilities:
    - Predicts stock requirements using historical sales data
    - Detects slow-moving items and suggests action
    - Optimizes pricing based on demand and margin
    - Detects unusual sales patterns
    """

    def __init__(self, store_id: int, db_session=None):
        self.db_session = db_session

        super().__init__(
            name="InventoryAgent",
            description="Autonomous inventory management with predictive capabilities",
            store_id=store_id
        )

    @property
    def db(self):
        return self.db_session

    def _register_default_tools(self):
        """Register inventory-specific tools"""

        self.register_tool(AgentTool(
            name="analyze_stock_levels",
            description="Analyze current stock levels and identify issues",
            parameters={},
            action_type=ActionType.QUERY,
            handler=self._analyze_stock_levels
        ))

        self.register_tool(AgentTool(
            name="predict_stock_needs",
            description="Predict future stock requirements based on sales patterns",
            parameters={"days_ahead": "number of days to forecast"},
            action_type=ActionType.QUERY,
            handler=self._predict_stock_needs
        ))

        self.register_tool(AgentTool(
            name="identify_slow_movers",
            description="Find products that haven't sold well",
            parameters={"days": "look back period"},
            action_type=ActionType.QUERY,
            handler=self._identify_slow_movers
        ))

        self.register_tool(AgentTool(
            name="generate_reorder_list",
            description="Generate optimized reorder list",
            parameters={},
            action_type=ActionType.QUERY,
            handler=self._generate_reorder_list
        ))

        self.register_tool(AgentTool(
            name="auto_create_purchase_order",
            description="Automatically create purchase order for critical items",
            parameters={"supplier_id": "optional specific supplier"},
            action_type=ActionType.MUTATION,
            requires_approval=True,
            handler=self._auto_create_po
        ))

        self.register_tool(AgentTool(
            name="suggest_price_optimization",
            description="Suggest price changes based on demand",
            parameters={},
            action_type=ActionType.QUERY,
            handler=self._suggest_price_optimization
        ))

        self.register_tool(AgentTool(
            name="detect_anomalies",
            description="Detect unusual patterns in sales",
            parameters={},
            action_type=ActionType.QUERY,
            handler=self._detect_anomalies
        ))

    async def think(self, input_data: Dict) -> Dict:
        """
        Inventory-specific reasoning logic
        """
        goal = input_data.get('goal', '').lower()

        # Analyze keywords to determine action
        if 'predict' in goal or 'forecast' in goal or 'need' in goal:
            return {
                "action": "predict_stock_needs",
                "parameters": {"days_ahead": 7},
                "reasoning": "User wants stock predictions"
            }
        elif 'slow' in goal or 'not selling' in goal or 'dead stock' in goal:
            return {
                "action": "identify_slow_movers",
                "parameters": {"days": 30},
                "reasoning": "User wants to find slow-moving inventory"
            }
        elif 'reorder' in goal or 'buy' in goal or 'purchase' in goal:
            return {
                "action": "generate_reorder_list",
                "parameters": {},
                "reasoning": "User wants reorder recommendations"
            }
        elif 'price' in goal or 'discount' in goal or 'margin' in goal:
            return {
                "action": "suggest_price_optimization",
                "parameters": {},
                "reasoning": "User wants pricing suggestions"
            }
        elif 'anomal' in goal or 'unusual' in goal or 'strange' in goal:
            return {
                "action": "detect_anomalies",
                "parameters": {},
                "reasoning": "User wants anomaly detection"
            }
        else:
            return {
                "action": "analyze_stock_levels",
                "parameters": {},
                "reasoning": "Default to stock analysis"
            }

    # ==================== Tool Handlers ====================

    async def _analyze_stock_levels(self) -> Dict:
        """Comprehensive stock level analysis based on this store's real products"""
        result = await self.db.execute(
            select(Product).where(and_(
                Product.store_id == self.store_id,
                Product.is_active == True
            ))
        )
        products = result.scalars().all()

        categories = {"healthy": 0, "adequate": 0, "low": 0, "critical": 0}
        critical_items = []
        total_value = 0.0

        for p in products:
            stock = p.current_stock or 0
            min_stock = p.min_stock_alert or 10
            total_value += stock * (p.cost_price or p.selling_price or 0)

            if stock <= min_stock / 2:
                categories["critical"] += 1
                critical_items.append({
                    "name": p.name,
                    "stock": stock,
                    "min_stock": min_stock,
                    "urgency": "immediate" if stock <= 0 else "high"
                })
            elif stock <= min_stock:
                categories["low"] += 1
            elif stock <= min_stock * 2:
                categories["adequate"] += 1
            else:
                categories["healthy"] += 1

        critical_items.sort(key=lambda i: i["stock"])
        recommendations = [
            f"Restock {item['name']} immediately - {item['stock']} unit(s) left (minimum: {item['min_stock']})"
            for item in critical_items[:3]
        ]
        if not recommendations:
            recommendations.append("Stock levels look healthy across your catalog.")

        analysis = {
            "total_products": len(products),
            "total_value": round(total_value, 2),
            "categories": categories,
            "critical_items": critical_items[:10],
            "recommendations": recommendations
        }

        return {
            "status": "success",
            "analysis": analysis,
            "overall_health": "needs_attention" if categories["critical"] > 0 else "good"
        }

    async def _predict_stock_needs(self, days_ahead: int = 7) -> Dict:
        """Predict future stock requirements from this store's 30-day sales history"""
        thirty_days_ago = datetime.now() - timedelta(days=30)

        sales_result = await self.db.execute(
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
            .group_by(BillItem.product_id, BillItem.product_name)
            .order_by(func.sum(BillItem.quantity).desc())
            .limit(15)
        )
        sales_rows = sales_result.all()

        if not sales_rows:
            return {
                "status": "success",
                "forecast_period": f"{days_ahead} days",
                "predictions": [],
                "items_needing_reorder": 0,
                "total_investment_needed": 0,
                "confidence": 0.0,
                "note": "Not enough sales history yet to generate demand predictions. Record more bills to enable forecasting."
            }

        product_ids = [row[0] for row in sales_rows]
        products_result = await self.db.execute(
            select(Product).where(Product.id.in_(product_ids))
        )
        products_by_id = {p.id: p for p in products_result.scalars().all()}

        predictions = []
        investment_needed = 0.0
        for product_id, product_name, total_qty in sales_rows:
            daily_avg = (total_qty or 0) / 30
            product = products_by_id.get(product_id)
            current_stock = (product.current_stock or 0) if product else 0
            cost_price = (product.cost_price or product.selling_price or 0) if product else 0

            predicted_demand = round(daily_avg * days_ahead * 1.1, 1)
            reorder_suggested = current_stock < predicted_demand
            recommended_quantity = max(0, round(daily_avg * days_ahead * 1.5) - current_stock)

            if reorder_suggested:
                investment_needed += recommended_quantity * cost_price

            predictions.append({
                "product": product_name,
                "current_stock": current_stock,
                "daily_avg_sales": round(daily_avg, 2),
                "predicted_demand": predicted_demand,
                "reorder_suggested": reorder_suggested,
                "recommended_quantity": recommended_quantity
            })

        items_needing_reorder = [p for p in predictions if p["reorder_suggested"]]

        return {
            "status": "success",
            "forecast_period": f"{days_ahead} days",
            "predictions": predictions,
            "items_needing_reorder": len(items_needing_reorder),
            "total_investment_needed": round(investment_needed, 2),
            "confidence": 0.7,
            "model_used": "30_day_rolling_average"
        }

    async def _identify_slow_movers(self, days: int = 30) -> Dict:
        """Identify products that are sitting in stock with little to no recent sales"""
        period_start = datetime.now() - timedelta(days=days)

        products_result = await self.db.execute(
            select(Product).where(and_(
                Product.store_id == self.store_id,
                Product.is_active == True,
                Product.current_stock > 0
            ))
        )
        products = products_result.scalars().all()

        if not products:
            return {
                "status": "success",
                "period_analyzed": f"{days} days",
                "slow_movers": [],
                "total_locked_value": 0,
                "action_items": ["No products currently in stock."]
            }

        sales_result = await self.db.execute(
            select(BillItem.product_id, func.sum(BillItem.quantity))
            .join(Bill, Bill.id == BillItem.bill_id)
            .where(and_(
                Bill.store_id == self.store_id,
                Bill.status == BillStatus.COMPLETED,
                Bill.bill_date >= period_start,
                BillItem.product_id.isnot(None)
            ))
            .group_by(BillItem.product_id)
        )
        sold_by_product = {row[0]: row[1] or 0 for row in sales_result.all()}

        now = datetime.now()
        slow_movers = []
        for p in products:
            units_sold = sold_by_product.get(p.id, 0)
            stock = p.current_stock or 0
            threshold = max(2, stock * 0.1)
            if units_sold <= threshold:
                value_locked = round(stock * (p.cost_price or p.selling_price or 0), 2)
                created_at = p.created_at.replace(tzinfo=None) if p.created_at else None
                slow_movers.append({
                    "product": p.name,
                    "days_in_stock": (now - created_at).days if created_at else None,
                    "units_sold": int(units_sold),
                    "current_stock": stock,
                    "value_locked": value_locked,
                    "suggestion": (
                        "Consider a discount or bundle offer to clear this stock"
                        if units_sold > 0 else
                        "No sales recorded in this period - consider discounting or discontinuing"
                    )
                })

        slow_movers.sort(key=lambda i: i["value_locked"], reverse=True)
        slow_movers = slow_movers[:10]
        total_locked_value = sum(i["value_locked"] for i in slow_movers)

        if slow_movers:
            action_items = [
                f"₹{total_locked_value:,.0f} is locked in slow-moving inventory",
                "Consider promotional pricing for these items",
                "Avoid restocking until current stock clears"
            ]
        else:
            action_items = ["No significant slow-moving inventory detected"]

        return {
            "status": "success",
            "period_analyzed": f"{days} days",
            "slow_movers": slow_movers,
            "total_locked_value": round(total_locked_value, 2),
            "action_items": action_items
        }

    async def _generate_reorder_list(self) -> Dict:
        """Generate a reorder list for products at or below their minimum stock level"""
        result = await self.db.execute(
            select(Product).where(and_(
                Product.store_id == self.store_id,
                Product.is_active == True,
                Product.current_stock <= Product.min_stock_alert
            )).order_by(Product.current_stock.asc())
        )
        products = result.scalars().all()

        if not products:
            return {
                "status": "success",
                "items": [],
                "total_items": 0,
                "total_investment": 0,
                "recommendation": "No products are below their reorder threshold right now."
            }

        items = []
        total_investment = 0.0
        for p in products:
            stock = p.current_stock or 0
            min_stock = p.min_stock_alert or 10
            quantity = max(1, int(round(min_stock * 2 - stock)))
            cost = quantity * (p.cost_price or p.selling_price or 0)
            total_investment += cost
            items.append({
                "product": p.name,
                "current_stock": stock,
                "min_stock": min_stock,
                "quantity": quantity,
                "estimated_cost": round(cost, 2),
                "priority": "high" if stock <= min_stock / 2 else "medium"
            })

        return {
            "status": "success",
            "items": items,
            "total_items": len(items),
            "total_investment": round(total_investment, 2),
            "recommendation": f"Total investment needed: ₹{total_investment:,.0f}. High-priority items should be reordered within 24 hours."
        }

    async def _auto_create_po(self, supplier_id: int = None) -> Dict:
        """Automatic PO creation isn't wired up yet - point the user at the reorder list + Suppliers page"""
        return {
            "status": "not_supported",
            "message": "Automatic purchase order creation isn't available yet. Use the reorder list and the Suppliers page to place orders manually."
        }

    async def _suggest_price_optimization(self) -> Dict:
        """Suggest price changes based on this store's real stock levels, margins and sales"""
        products_result = await self.db.execute(
            select(Product).where(and_(
                Product.store_id == self.store_id,
                Product.is_active == True
            ))
        )
        products = products_result.scalars().all()
        if not products:
            return {
                "status": "success",
                "suggestions": [],
                "note": "Add products to your catalog to get pricing suggestions."
            }

        thirty_days_ago = datetime.now() - timedelta(days=30)
        sales_result = await self.db.execute(
            select(BillItem.product_id, func.sum(BillItem.quantity))
            .join(Bill, Bill.id == BillItem.bill_id)
            .where(and_(
                Bill.store_id == self.store_id,
                Bill.status == BillStatus.COMPLETED,
                Bill.bill_date >= thirty_days_ago,
                BillItem.product_id.isnot(None)
            ))
            .group_by(BillItem.product_id)
        )
        sold_by_product = {row[0]: row[1] or 0 for row in sales_result.all()}

        suggestions = []

        # Slow movers -> suggest a discount to clear stock
        slow_candidates = sorted(
            [p for p in products if (p.current_stock or 0) > 0
             and sold_by_product.get(p.id, 0) <= max(2, (p.current_stock or 0) * 0.1)
             and p.selling_price],
            key=lambda p: (p.current_stock or 0) * (p.cost_price or p.selling_price or 0),
            reverse=True
        )
        for p in slow_candidates[:3]:
            suggestions.append({
                "product": p.name,
                "current_price": p.selling_price,
                "suggested_price": round(p.selling_price * 0.9, 2),
                "reason": "Slow mover - discount to help clear stock",
                "expected_impact": "Faster stock turnover"
            })

        # Low-stock, thin-margin, in-demand products -> suggest a small price increase
        high_demand_candidates = sorted(
            [p for p in products if (p.current_stock or 0) <= (p.min_stock_alert or 10)
             and p.selling_price and p.cost_price
             and (p.selling_price - p.cost_price) / p.selling_price < 0.15
             and sold_by_product.get(p.id, 0) > 0],
            key=lambda p: sold_by_product.get(p.id, 0),
            reverse=True
        )
        for p in high_demand_candidates[:3]:
            suggestions.append({
                "product": p.name,
                "current_price": p.selling_price,
                "suggested_price": round(p.selling_price * 1.05, 2),
                "reason": "High demand, thin margin - small price increase recommended",
                "expected_impact": "Improved margin without affecting demand"
            })

        if not suggestions:
            return {
                "status": "success",
                "suggestions": [],
                "note": "No pricing changes recommended right now - your prices and stock levels look balanced."
            }

        return {
            "status": "success",
            "suggestions": suggestions,
            "note": "These are AI suggestions based on your stock and sales data. Review before applying."
        }

    async def _detect_anomalies(self) -> Dict:
        """Detect unusual sales patterns by comparing the last 7 days to the prior 23 days"""
        now = datetime.now()
        recent_start = now - timedelta(days=7)
        baseline_start = now - timedelta(days=30)

        sales_result = await self.db.execute(
            select(BillItem.product_id, BillItem.product_name, Bill.bill_date, BillItem.quantity)
            .join(Bill, Bill.id == BillItem.bill_id)
            .where(and_(
                Bill.store_id == self.store_id,
                Bill.status == BillStatus.COMPLETED,
                Bill.bill_date >= baseline_start,
                BillItem.product_id.isnot(None)
            ))
        )
        rows = sales_result.all()

        if not rows:
            return {
                "status": "success",
                "anomalies_detected": 0,
                "anomalies": [],
                "high_severity_count": 0,
                "recommendation": "Not enough sales history yet to detect anomalies."
            }

        recent_qty: Dict[int, float] = {}
        baseline_qty: Dict[int, float] = {}
        names: Dict[int, str] = {}
        for product_id, product_name, bill_date, qty in rows:
            names[product_id] = product_name
            bd = bill_date.replace(tzinfo=None) if bill_date and bill_date.tzinfo else bill_date
            if bd and bd >= recent_start:
                recent_qty[product_id] = recent_qty.get(product_id, 0) + (qty or 0)
            else:
                baseline_qty[product_id] = baseline_qty.get(product_id, 0) + (qty or 0)

        anomalies = []
        for product_id, recent_total in recent_qty.items():
            recent_daily = recent_total / 7
            baseline_total = baseline_qty.get(product_id, 0)
            baseline_daily = baseline_total / 23 if baseline_total else 0

            if baseline_daily > 0 and recent_daily > baseline_daily * 2:
                anomalies.append({
                    "type": "unusual_sales_spike",
                    "product": names[product_id],
                    "description": f"Sales in the last 7 days are {round(recent_daily / baseline_daily, 1)}x the prior average",
                    "severity": "medium",
                    "possible_causes": ["Festival", "Promotion", "Bulk order"]
                })
            elif baseline_daily > 1 and recent_daily < baseline_daily * 0.3:
                anomalies.append({
                    "type": "unusual_sales_drop",
                    "product": names[product_id],
                    "description": f"Sales in the last 7 days dropped to {round(recent_daily / baseline_daily * 100)}% of the prior average",
                    "severity": "medium",
                    "possible_causes": ["Stockout", "Demand shift", "Competitor pricing"]
                })

        anomalies = anomalies[:10]
        high_severity_count = len([a for a in anomalies if a["severity"] == "high"])

        return {
            "status": "success",
            "anomalies_detected": len(anomalies),
            "anomalies": anomalies,
            "high_severity_count": high_severity_count,
            "recommendation": (
                f"Review {anomalies[0]['product']} - {anomalies[0]['description'].lower()}"
                if anomalies else "No unusual sales patterns detected recently."
            )
        }

    # ==================== Proactive Methods ====================

    async def run_daily_analysis(self) -> Dict:
        """
        Run this daily as a scheduled task
        Returns proactive alerts and recommendations
        """
        results = {
            "timestamp": datetime.now().isoformat(),
            "stock_analysis": await self._analyze_stock_levels(),
            "predictions": await self._predict_stock_needs(days_ahead=7),
            "anomalies": await self._detect_anomalies(),
            "slow_movers": await self._identify_slow_movers(days=30)
        }

        # Generate summary
        critical_items = results["stock_analysis"]["analysis"]["categories"]["critical"]
        anomalies = results["anomalies"]["high_severity_count"]

        results["summary"] = {
            "health_score": max(0, 100 - (critical_items * 10) - (anomalies * 15)),
            "critical_alerts": critical_items,
            "requires_immediate_action": critical_items > 0 or anomalies > 0,
            "top_priority": "Restock critical items" if critical_items > 0 else "All good!"
        }

        return results
