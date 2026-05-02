"""
KadaiGPT - Inventory Intelligence Agent
Predictive stock management and business insights
"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from enum import Enum
import asyncio


class StockAlert(Enum):
    CRITICAL = "critical"    # Below minimum
    LOW = "low"              # Approaching minimum
    NORMAL = "normal"        # Healthy stock
    OVERSTOCK = "overstock"  # Too much inventory
    EXPIRING = "expiring"    # Expiry date approaching


@dataclass
class ProductInsight:
    product_id: int
    product_name: str
    current_stock: int
    min_stock: int
    alert_type: StockAlert
    days_of_stock: Optional[int]  # Predicted days until stockout
    recommendation: str
    priority: int  # 1-10, higher = more urgent


@dataclass
class ReorderSuggestion:
    product_id: int
    product_name: str
    current_stock: int
    suggested_quantity: int
    reason: str
    urgency: str  # immediate, this_week, next_week
    estimated_cost: float


class InventoryAgent:
    """
    📦 INVENTORY INTELLIGENCE AGENT
    
    Responsibilities:
    - Auto-deduct stock on every sale
    - Predict stock-out dates using sales velocity
    - Generate smart reorder suggestions
    - Identify slow-moving and dead stock
    - Alert before product expiry
    - Optimize inventory turnover
    """
    
    def __init__(self):
        self.agent_name = "InventoryAgent"
        self.sales_history: Dict[int, List[Dict]] = {}  # product_id -> sales records
        self.insights_cache: Dict[int, ProductInsight] = {}
        self.last_analysis_time: Optional[datetime] = None
    
    async def deduct_stock_from_sale(
        self, 
        items: List[Dict[str, Any]],
        db_session: Any
    ) -> Dict[str, Any]:
        """
        🧠 AUTONOMOUS ACTION: Deduct inventory on sale
        
        Called automatically when a bill is created.
        Updates stock and triggers alerts if necessary.
        """
        results = {
            "success": True,
            "updated_products": [],
            "alerts": []
        }
        
        for item in items:
            product_id = item.get("product_id")
            quantity_sold = item.get("quantity", 0)
            
            if not product_id:
                continue
            
            # Update stock (would be actual DB operation in production)
            # For demo, we track in memory
            alert = self._check_stock_level(
                product_id, 
                item.get("product_name", "Unknown"),
                item.get("current_stock", 0) - quantity_sold,
                item.get("min_stock", 10)
            )
            
            results["updated_products"].append({
                "product_id": product_id,
                "quantity_deducted": quantity_sold,
                "new_stock": item.get("current_stock", 0) - quantity_sold
            })
            
            if alert:
                results["alerts"].append(alert)
            
            # Record sale for velocity calculation
            self._record_sale(product_id, quantity_sold)
        
        return results
    
    def _record_sale(self, product_id: int, quantity: float):
        """Record sale for analysis"""
        if product_id not in self.sales_history:
            self.sales_history[product_id] = []
        
        self.sales_history[product_id].append({
            "quantity": quantity,
            "timestamp": datetime.now().isoformat()
        })
        
        # Keep only last 90 days of data
        cutoff = (datetime.now() - timedelta(days=90)).isoformat()
        self.sales_history[product_id] = [
            s for s in self.sales_history[product_id]
            if s["timestamp"] > cutoff
        ]
    
    def _check_stock_level(
        self, 
        product_id: int,
        product_name: str,
        current_stock: int,
        min_stock: int
    ) -> Optional[Dict]:
        """Check if stock level triggers an alert"""
        
        if current_stock <= 0:
            return {
                "type": StockAlert.CRITICAL.value,
                "product_id": product_id,
                "product_name": product_name,
                "message": f"⚠️ OUT OF STOCK: {product_name}",
                "current_stock": current_stock
            }
        
        if current_stock <= min_stock * 0.5:
            return {
                "type": StockAlert.CRITICAL.value,
                "product_id": product_id,
                "product_name": product_name,
                "message": f"🔴 CRITICAL LOW: {product_name} ({current_stock} left)",
                "current_stock": current_stock
            }
        
        if current_stock <= min_stock:
            return {
                "type": StockAlert.LOW.value,
                "product_id": product_id,
                "product_name": product_name,
                "message": f"🟡 LOW STOCK: {product_name} ({current_stock} left)",
                "current_stock": current_stock
            }
        
        return None
    
    async def analyze_inventory(
        self, 
        products: List[Dict[str, Any]]
    ) -> List[ProductInsight]:
        """
        🧠 COMPREHENSIVE ANALYSIS: Analyze all inventory
        
        Returns insights for each product with recommendations.
        """
        insights = []
        
        for product in products:
            product_id = product.get("id")
            current_stock = product.get("current_stock", 0)
            min_stock = product.get("min_stock_alert", 10)
            expiry_date = product.get("expiry_date")
            
            # Calculate sales velocity
            velocity = self._calculate_velocity(product_id)
            days_of_stock = self._predict_stockout(current_stock, velocity)
            
            # Determine alert type
            alert_type = self._determine_alert_type(
                current_stock, 
                min_stock, 
                days_of_stock,
                expiry_date
            )
            
            # Generate recommendation
            recommendation = self._generate_recommendation(
                product.get("name", "Unknown"),
                current_stock,
                min_stock,
                velocity,
                days_of_stock,
                alert_type
            )
            
            # Calculate priority
            priority = self._calculate_priority(alert_type, days_of_stock)
            
            insight = ProductInsight(
                product_id=product_id,
                product_name=product.get("name", "Unknown"),
                current_stock=current_stock,
                min_stock=min_stock,
                alert_type=alert_type,
                days_of_stock=days_of_stock,
                recommendation=recommendation,
                priority=priority
            )
            
            insights.append(insight)
            self.insights_cache[product_id] = insight
        
        self.last_analysis_time = datetime.now()
        
        # Sort by priority (highest first)
        insights.sort(key=lambda x: x.priority, reverse=True)
        
        return insights
    
    def _calculate_velocity(self, product_id: int) -> float:
        """Calculate average daily sales velocity"""
        if product_id not in self.sales_history:
            return 0.0
        
        sales = self.sales_history[product_id]
        if not sales:
            return 0.0
        
        # Calculate total quantity sold
        total_qty = sum(s["quantity"] for s in sales)
        
        # Calculate days span
        if len(sales) < 2:
            return total_qty  # Assume 1 day
        
        first_sale = datetime.fromisoformat(sales[0]["timestamp"])
        last_sale = datetime.fromisoformat(sales[-1]["timestamp"])
        days = max(1, (last_sale - first_sale).days)
        
        return total_qty / days
    
    def _predict_stockout(
        self, 
        current_stock: int,
        velocity: float
    ) -> Optional[int]:
        """Predict days until stockout"""
        if velocity <= 0:
            return None  # Can't predict without sales data
        
        return int(current_stock / velocity)
    
    def _determine_alert_type(
        self,
        current_stock: int,
        min_stock: int,
        days_of_stock: Optional[int],
        expiry_date: Optional[datetime]
    ) -> StockAlert:
        """Determine the appropriate alert type"""
        
        # Check expiry first
        if expiry_date:
            days_to_expiry = (expiry_date - datetime.now()).days
            if days_to_expiry <= 7:
                return StockAlert.EXPIRING
        
        # Check stock levels
        if current_stock <= 0:
            return StockAlert.CRITICAL
        
        if current_stock <= min_stock * 0.5:
            return StockAlert.CRITICAL
        
        if current_stock <= min_stock:
            return StockAlert.LOW
        
        # Check overstocking (more than 3 months of stock based on velocity)
        if days_of_stock and days_of_stock > 90:
            return StockAlert.OVERSTOCK
        
        return StockAlert.NORMAL
    
    def _generate_recommendation(
        self,
        product_name: str,
        current_stock: int,
        min_stock: int,
        velocity: float,
        days_of_stock: Optional[int],
        alert_type: StockAlert
    ) -> str:
        """Generate actionable recommendation"""
        
        if alert_type == StockAlert.CRITICAL:
            if velocity > 0:
                reorder_qty = int(velocity * 14)  # 2 weeks stock
                return f"🚨 URGENT: Reorder {reorder_qty} units immediately"
            return "🚨 URGENT: Reorder immediately - out of stock!"
        
        if alert_type == StockAlert.LOW:
            if velocity > 0:
                reorder_qty = int(velocity * 21)  # 3 weeks stock
                return f"⚠️ Reorder {reorder_qty} units within 2-3 days"
            return "⚠️ Stock running low - plan reorder soon"
        
        if alert_type == StockAlert.EXPIRING:
            return f"⏰ Expiring soon - Consider 20% discount to clear stock"
        
        if alert_type == StockAlert.OVERSTOCK:
            return f"📦 Overstocked ({days_of_stock} days worth) - Consider promotions"
        
        return "✅ Stock level healthy"
    
    def _calculate_priority(
        self, 
        alert_type: StockAlert,
        days_of_stock: Optional[int]
    ) -> int:
        """Calculate priority score (1-10)"""
        
        priority_map = {
            StockAlert.CRITICAL: 10,
            StockAlert.EXPIRING: 9,
            StockAlert.LOW: 7,
            StockAlert.OVERSTOCK: 4,
            StockAlert.NORMAL: 1
        }
        
        base_priority = priority_map.get(alert_type, 1)
        
        # Adjust based on days of stock
        if days_of_stock is not None:
            if days_of_stock <= 1:
                base_priority = min(10, base_priority + 2)
            elif days_of_stock <= 3:
                base_priority = min(10, base_priority + 1)
        
        return base_priority
    
    async def generate_reorder_list(
        self, 
        products: List[Dict[str, Any]]
    ) -> List[ReorderSuggestion]:
        """
        📋 SMART REORDER LIST: Generate intelligent reorder suggestions
        """
        insights = await self.analyze_inventory(products)
        suggestions = []
        
        for insight in insights:
            if insight.alert_type in [StockAlert.CRITICAL, StockAlert.LOW]:
                product = next(
                    (p for p in products if p.get("id") == insight.product_id),
                    None
                )
                
                if not product:
                    continue
                
                # Calculate suggested quantity
                velocity = self._calculate_velocity(insight.product_id)
                if velocity > 0:
                    # Order for 3 weeks + buffer
                    suggested_qty = int(velocity * 21) + insight.min_stock
                else:
                    # Default to 2x min stock
                    suggested_qty = insight.min_stock * 2
                
                # Determine urgency
                if insight.alert_type == StockAlert.CRITICAL:
                    urgency = "immediate"
                elif insight.days_of_stock and insight.days_of_stock <= 3:
                    urgency = "immediate"
                elif insight.days_of_stock and insight.days_of_stock <= 7:
                    urgency = "this_week"
                else:
                    urgency = "next_week"
                
                suggestions.append(ReorderSuggestion(
                    product_id=insight.product_id,
                    product_name=insight.product_name,
                    current_stock=insight.current_stock,
                    suggested_quantity=suggested_qty,
                    reason=insight.recommendation,
                    urgency=urgency,
                    estimated_cost=suggested_qty * product.get("cost_price", 0)
                ))
        
        # Sort by urgency
        urgency_order = {"immediate": 0, "this_week": 1, "next_week": 2}
        suggestions.sort(key=lambda x: urgency_order.get(x.urgency, 3))
        
        return suggestions
    
    async def get_expiring_products(
        self, 
        products: List[Dict[str, Any]],
        days_threshold: int = 30
    ) -> List[Dict[str, Any]]:
        """Get products expiring within threshold days"""
        expiring = []
        cutoff = datetime.now() + timedelta(days=days_threshold)
        
        for product in products:
            expiry = product.get("expiry_date")
            if expiry and isinstance(expiry, datetime):
                days_remaining = (expiry - datetime.now()).days
                if days_remaining <= days_threshold:
                    expiring.append({
                        "product_id": product.get("id"),
                        "product_name": product.get("name"),
                        "expiry_date": expiry.isoformat(),
                        "days_remaining": days_remaining,
                        "current_stock": product.get("current_stock", 0),
                        "recommendation": "Consider 15-30% discount" if days_remaining > 7 else "Urgent clearance needed"
                    })
        
        expiring.sort(key=lambda x: x["days_remaining"])
        return expiring
    
    async def identify_dead_stock(
        self, 
        products: List[Dict[str, Any]],
        days_threshold: int = 45
    ) -> List[Dict[str, Any]]:
        """Identify products with no sales in threshold period"""
        dead_stock = []
        cutoff = (datetime.now() - timedelta(days=days_threshold)).isoformat()
        
        for product in products:
            product_id = product.get("id")
            
            # Check if there are recent sales
            sales = self.sales_history.get(product_id, [])
            recent_sales = [s for s in sales if s["timestamp"] > cutoff]
            
            if not recent_sales and product.get("current_stock", 0) > 0:
                dead_stock.append({
                    "product_id": product_id,
                    "product_name": product.get("name"),
                    "current_stock": product.get("current_stock", 0),
                    "days_without_sale": days_threshold,
                    "stock_value": product.get("current_stock", 0) * product.get("cost_price", 0),
                    "recommendation": "Consider 30-50% discount or bundle offer"
                })
        
        # Sort by stock value (highest first)
        dead_stock.sort(key=lambda x: x["stock_value"], reverse=True)
        return dead_stock
    
    def get_agent_stats(self) -> Dict[str, Any]:
        """Get agent statistics"""
        return {
            "agent_name": self.agent_name,
            "products_tracked": len(self.sales_history),
            "insights_cached": len(self.insights_cache),
            "last_analysis": self.last_analysis_time.isoformat() if self.last_analysis_time else None
        }


# Singleton instance
inventory_agent = InventoryAgent()
