"""
KadaiGPT - Inventory Intelligence Agent
Autonomous inventory management with ML predictions
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import asyncio
import math

from .base_agent import (
    BaseAgent, AgentTool, AgentGoal, AgentStatus,
    ActionType, logger
)


class InventoryAgent(BaseAgent):
    """
    Inventory Intelligence Agent - Autonomous inventory management
    
    Capabilities:
    - Predicts stock requirements using historical data
    - Auto-generates purchase orders when stock is low
    - Detects slow-moving items and suggests action
    - Optimizes pricing based on demand
    - Sends proactive alerts
    """
    
    def __init__(self, store_id: int, db_session=None):
        self.db_session = db_session
        
        super().__init__(
            name="InventoryAgent",
            description="Autonomous inventory management with predictive capabilities",
            store_id=store_id
        )
    
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
            description="Detect unusual patterns in inventory",
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
        """Comprehensive stock level analysis"""
        # In production, would query database
        # Here using mock data with intelligent analysis
        
        analysis = {
            "total_products": 150,
            "total_value": 485000,
            "categories": {
                "healthy": 120,  # Stock > min_stock * 2
                "adequate": 18,  # Stock > min_stock
                "low": 8,        # Stock <= min_stock
                "critical": 4    # Stock < min_stock / 2
            },
            "critical_items": [
                {"name": "Salt", "stock": 5, "min_stock": 20, "urgency": "immediate"},
                {"name": "Toor Dal", "stock": 8, "min_stock": 15, "urgency": "high"},
                {"name": "Milk", "stock": 15, "min_stock": 50, "urgency": "high"},
                {"name": "Butter", "stock": 8, "min_stock": 20, "urgency": "medium"}
            ],
            "recommendations": [
                "Immediately restock Salt - only 2 days of stock remaining",
                "Order Toor Dal within 2 days to avoid stockout",
                "Consider bulk purchase for dairy items - high turnover detected"
            ]
        }
        
        return {
            "status": "success",
            "analysis": analysis,
            "overall_health": "needs_attention" if analysis["categories"]["critical"] > 0 else "good"
        }
    
    async def _predict_stock_needs(self, days_ahead: int = 7) -> Dict:
        """Predict future stock requirements using simple ML"""
        
        # Simulated predictions based on historical patterns
        # In production, would use actual sales data + ML model
        predictions = [
            {
                "product": "Basmati Rice",
                "current_stock": 45,
                "daily_avg_sales": 5.2,
                "predicted_demand": round(5.2 * days_ahead * 1.1),  # 10% buffer
                "reorder_suggested": 45 < (5.2 * days_ahead * 1.1),
                "recommended_quantity": max(0, round(5.2 * days_ahead * 1.5) - 45)
            },
            {
                "product": "Toor Dal",
                "current_stock": 8,
                "daily_avg_sales": 3.1,
                "predicted_demand": round(3.1 * days_ahead * 1.1),
                "reorder_suggested": True,
                "recommended_quantity": 25
            },
            {
                "product": "Sugar",
                "current_stock": 120,
                "daily_avg_sales": 8.5,
                "predicted_demand": round(8.5 * days_ahead * 1.1),
                "reorder_suggested": False,
                "recommended_quantity": 0
            },
            {
                "product": "Milk",
                "current_stock": 15,
                "daily_avg_sales": 22.0,
                "predicted_demand": round(22.0 * days_ahead * 1.1),
                "reorder_suggested": True,
                "recommended_quantity": 150
            }
        ]
        
        items_needing_reorder = [p for p in predictions if p["reorder_suggested"]]
        
        return {
            "status": "success",
            "forecast_period": f"{days_ahead} days",
            "predictions": predictions,
            "items_needing_reorder": len(items_needing_reorder),
            "total_investment_needed": sum(p.get("recommended_quantity", 0) * 100 for p in items_needing_reorder),
            "confidence": 0.85,
            "model_used": "rolling_average_with_seasonality"
        }
    
    async def _identify_slow_movers(self, days: int = 30) -> Dict:
        """Identify slow-moving inventory"""
        
        slow_movers = [
            {
                "product": "Premium Olive Oil",
                "days_in_stock": 45,
                "units_sold_last_30_days": 2,
                "current_stock": 15,
                "value_locked": 3600,
                "suggestion": "Consider 15% discount or bundle offer"
            },
            {
                "product": "Organic Quinoa",
                "days_in_stock": 60,
                "units_sold_last_30_days": 3,
                "current_stock": 20,
                "value_locked": 2800,
                "suggestion": "Feature on counter or create recipe cards"
            },
            {
                "product": "Imported Pasta",
                "days_in_stock": 35,
                "units_sold_last_30_days": 5,
                "current_stock": 25,
                "value_locked": 1500,
                "suggestion": "Create combo with pasta sauce"
            }
        ]
        
        total_locked_value = sum(item["value_locked"] for item in slow_movers)
        
        return {
            "status": "success",
            "period_analyzed": f"{days} days",
            "slow_movers": slow_movers,
            "total_locked_value": total_locked_value,
            "action_items": [
                f"₹{total_locked_value:,} is locked in slow-moving inventory",
                "Consider promotional pricing for these items",
                "Avoid restocking until current stock clears"
            ]
        }
    
    async def _generate_reorder_list(self) -> Dict:
        """Generate optimized reorder list grouped by supplier"""
        
        reorder_list = {
            "Metro Wholesale": {
                "supplier_id": 1,
                "items": [
                    {"product": "Basmati Rice", "quantity": 50, "estimated_cost": 4250},
                    {"product": "Toor Dal", "quantity": 25, "estimated_cost": 3500},
                    {"product": "Sugar", "quantity": 30, "estimated_cost": 1350}
                ],
                "total_cost": 9100,
                "priority": "high"
            },
            "Fresh Dairy Suppliers": {
                "supplier_id": 2,
                "items": [
                    {"product": "Milk", "quantity": 150, "estimated_cost": 9000},
                    {"product": "Butter", "quantity": 30, "estimated_cost": 1650},
                    {"product": "Cheese", "quantity": 20, "estimated_cost": 2400}
                ],
                "total_cost": 13050,
                "priority": "high"
            },
            "FMCG Distributors": {
                "supplier_id": 3,
                "items": [
                    {"product": "Salt", "quantity": 30, "estimated_cost": 600},
                    {"product": "Soap", "quantity": 50, "estimated_cost": 1500}
                ],
                "total_cost": 2100,
                "priority": "medium"
            }
        }
        
        total_investment = sum(s["total_cost"] for s in reorder_list.values())
        
        return {
            "status": "success",
            "reorder_list": reorder_list,
            "total_suppliers": len(reorder_list),
            "total_investment": total_investment,
            "recommendation": f"Total investment needed: ₹{total_investment:,}. High priority orders should be placed within 24 hours."
        }
    
    async def _auto_create_po(self, supplier_id: int = None) -> Dict:
        """Automatically create purchase order"""
        
        po_number = f"PO-{datetime.now().strftime('%Y%m%d%H%M')}"
        
        return {
            "status": "pending_approval",
            "po_number": po_number,
            "message": "Purchase order created and awaiting approval",
            "supplier_id": supplier_id or "auto-selected",
            "items_count": 5,
            "total_value": 15000,
            "approval_required": True,
            "expires_in": "24 hours"
        }
    
    async def _suggest_price_optimization(self) -> Dict:
        """Suggest price optimizations based on demand"""
        
        suggestions = [
            {
                "product": "Premium Olive Oil",
                "current_price": 450,
                "suggested_price": 399,
                "reason": "Slow mover - 11% discount to clear stock",
                "expected_impact": "+40% sales velocity"
            },
            {
                "product": "Basmati Rice",
                "current_price": 85,
                "suggested_price": 89,
                "reason": "High demand, low stock - can increase margin",
                "expected_impact": "+5% revenue"
            },
            {
                "product": "Milk",
                "current_price": 60,
                "suggested_price": 58,
                "reason": "Competitive pressure - match local prices",
                "expected_impact": "+15% volume"
            }
        ]
        
        return {
            "status": "success",
            "suggestions": suggestions,
            "potential_revenue_impact": "+₹12,500/month",
            "note": "These are AI suggestions. Review before applying."
        }
    
    async def _detect_anomalies(self) -> Dict:
        """Detect unusual patterns in inventory"""
        
        anomalies = [
            {
                "type": "sudden_drop",
                "product": "Sunflower Oil",
                "description": "Stock dropped by 30 units without recorded sales",
                "timestamp": (datetime.now() - timedelta(hours=3)).isoformat(),
                "severity": "high",
                "possible_causes": ["Theft", "Recording error", "Spillage not logged"]
            },
            {
                "type": "unusual_sales_spike",
                "product": "Butter",
                "description": "Sales 5x higher than average on Sunday",
                "timestamp": (datetime.now() - timedelta(days=2)).isoformat(),
                "severity": "low",
                "possible_causes": ["Festival", "Promotion", "Competitor stockout"]
            }
        ]
        
        return {
            "status": "success",
            "anomalies_detected": len(anomalies),
            "anomalies": anomalies,
            "high_severity_count": len([a for a in anomalies if a["severity"] == "high"]),
            "recommendation": "Investigate the Sunflower Oil discrepancy immediately"
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
            "health_score": 100 - (critical_items * 10) - (anomalies * 15),
            "critical_alerts": critical_items,
            "requires_immediate_action": critical_items > 0 or anomalies > 0,
            "top_priority": "Restock critical items" if critical_items > 0 else "All good!"
        }
        
        return results
