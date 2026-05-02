"""
KadaiGPT - Products Router
Product and category management with inventory tracking
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from typing import List, Optional

from app.database import get_db
from app.models import Product, Category, User
from app.schemas import (
    ProductCreate, ProductUpdate, ProductResponse,
    CategoryCreate, CategoryResponse
)
from app.routers.auth import get_current_active_user
from app.agents import inventory_agent


router = APIRouter(prefix="/products", tags=["Products"])


# ==================== CATEGORIES ====================

@router.get("/categories", response_model=List[CategoryResponse])
async def list_categories(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all categories for the store"""
    result = await db.execute(
        select(Category).where(Category.store_id == current_user.store_id)
    )
    return result.scalars().all()


@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    category: CategoryCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new category"""
    db_category = Category(
        store_id=current_user.store_id,
        **category.model_dump()
    )
    db.add(db_category)
    await db.commit()
    await db.refresh(db_category)
    return db_category


@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a category"""
    result = await db.execute(
        select(Category).where(
            and_(
                Category.id == category_id,
                Category.store_id == current_user.store_id
            )
        )
    )
    category = result.scalar_one_or_none()
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    await db.delete(category)
    await db.commit()
    return {"message": "Category deleted"}


# ==================== PRODUCTS ====================

@router.get("", response_model=List[ProductResponse])
async def list_products(
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    low_stock_only: bool = False,
    active_only: bool = True,
    skip: int = 0,
    limit: int = Query(default=100, le=500),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all products with filtering options
    """
    try:
        # Check if user has a store
        if not current_user.store_id:
            return []
        
        query = select(Product).where(Product.store_id == current_user.store_id)
        
        if active_only:
            query = query.where(Product.is_active == True)
        
        if category_id:
            query = query.where(Product.category_id == category_id)
        
        if low_stock_only:
            query = query.where(Product.current_stock <= Product.min_stock_alert)
        
        if search:
            search_term = f"%{search}%"
            query = query.where(
                or_(
                    Product.name.ilike(search_term),
                    Product.sku.ilike(search_term),
                    Product.barcode.ilike(search_term)
                )
            )
        
        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        
        return result.scalars().all()
    except Exception as e:
        # Return empty list on error to prevent 422
        print(f"Error fetching products: {e}")
        return []


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific product by ID"""
    result = await db.execute(
        select(Product).where(
            and_(
                Product.id == product_id,
                Product.store_id == current_user.store_id
            )
        )
    )
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return product


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    product: ProductCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new product"""
    # Check for duplicate SKU/barcode
    if product.sku:
        result = await db.execute(
            select(Product).where(
                and_(
                    Product.sku == product.sku,
                    Product.store_id == current_user.store_id
                )
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="SKU already exists")
    
    if product.barcode:
        result = await db.execute(
            select(Product).where(
                and_(
                    Product.barcode == product.barcode,
                    Product.store_id == current_user.store_id
                )
            )
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Barcode already exists")
    
    db_product = Product(
        store_id=current_user.store_id,
        **product.model_dump()
    )
    db.add(db_product)
    await db.commit()
    await db.refresh(db_product)
    
    return db_product


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int,
    product_update: ProductUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a product"""
    result = await db.execute(
        select(Product).where(
            and_(
                Product.id == product_id,
                Product.store_id == current_user.store_id
            )
        )
    )
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Update fields
    update_data = product_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)
    
    await db.commit()
    await db.refresh(product)
    
    return product


@router.delete("/{product_id}")
async def delete_product(
    product_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a product (soft delete)"""
    result = await db.execute(
        select(Product).where(
            and_(
                Product.id == product_id,
                Product.store_id == current_user.store_id
            )
        )
    )
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product.is_active = False
    await db.commit()
    
    return {"message": "Product deleted"}


@router.post("/{product_id}/stock/adjust")
async def adjust_stock(
    product_id: int,
    quantity: int = Query(..., description="Positive to add, negative to subtract"),
    reason: str = Query(default="manual_adjustment"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Manually adjust product stock"""
    result = await db.execute(
        select(Product).where(
            and_(
                Product.id == product_id,
                Product.store_id == current_user.store_id
            )
        )
    )
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    new_stock = product.current_stock + quantity
    if new_stock < 0:
        raise HTTPException(status_code=400, detail="Stock cannot be negative")
    
    product.current_stock = new_stock
    await db.commit()
    
    return {
        "message": "Stock adjusted",
        "product_id": product_id,
        "previous_stock": product.current_stock - quantity,
        "adjustment": quantity,
        "new_stock": new_stock,
        "reason": reason
    }


# ==================== INVENTORY INSIGHTS ====================

@router.get("/inventory/insights")
async def get_inventory_insights(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    🧠 AI AGENT: Get intelligent inventory insights
    """
    result = await db.execute(
        select(Product).where(
            and_(
                Product.store_id == current_user.store_id,
                Product.is_active == True
            )
        )
    )
    products = result.scalars().all()
    
    # Convert to dicts for agent
    product_dicts = [
        {
            "id": p.id,
            "name": p.name,
            "current_stock": p.current_stock,
            "min_stock_alert": p.min_stock_alert,
            "cost_price": p.cost_price,
            "selling_price": p.selling_price,
            "expiry_date": p.expiry_date
        }
        for p in products
    ]
    
    insights = await inventory_agent.analyze_inventory(product_dicts)
    
    # Convert to serializable format
    return {
        "total_products": len(products),
        "insights": [
            {
                "product_id": i.product_id,
                "product_name": i.product_name,
                "current_stock": i.current_stock,
                "min_stock": i.min_stock,
                "alert_type": i.alert_type.value,
                "days_of_stock": i.days_of_stock,
                "recommendation": i.recommendation,
                "priority": i.priority
            }
            for i in insights[:20]  # Top 20 priority items
        ]
    }


@router.get("/inventory/reorder-list")
async def get_reorder_list(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    🧠 AI AGENT: Get smart reorder suggestions
    """
    result = await db.execute(
        select(Product).where(
            and_(
                Product.store_id == current_user.store_id,
                Product.is_active == True
            )
        )
    )
    products = result.scalars().all()
    
    product_dicts = [
        {
            "id": p.id,
            "name": p.name,
            "current_stock": p.current_stock,
            "min_stock_alert": p.min_stock_alert,
            "cost_price": p.cost_price
        }
        for p in products
    ]
    
    suggestions = await inventory_agent.generate_reorder_list(product_dicts)
    
    return {
        "total_items": len(suggestions),
        "estimated_total_cost": sum(s.estimated_cost for s in suggestions),
        "reorder_list": [
            {
                "product_id": s.product_id,
                "product_name": s.product_name,
                "current_stock": s.current_stock,
                "suggested_quantity": s.suggested_quantity,
                "reason": s.reason,
                "urgency": s.urgency,
                "estimated_cost": s.estimated_cost
            }
            for s in suggestions
        ]
    }


@router.get("/inventory/low-stock")
async def get_low_stock_products(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all products with low stock"""
    result = await db.execute(
        select(Product).where(
            and_(
                Product.store_id == current_user.store_id,
                Product.is_active == True,
                Product.current_stock <= Product.min_stock_alert
            )
        ).order_by(Product.current_stock)
    )
    products = result.scalars().all()
    
    return {
        "count": len(products),
        "products": [
            {
                "id": p.id,
                "name": p.name,
                "current_stock": p.current_stock,
                "min_stock_alert": p.min_stock_alert,
                "selling_price": p.selling_price
            }
            for p in products
        ]
    }
