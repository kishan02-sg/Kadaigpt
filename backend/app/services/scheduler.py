"""
KadaiGPT - Scheduled Tasks & Automation
Background jobs for daily reports, reminders, and maintenance
"""

import asyncio
import logging
from datetime import datetime, time, timedelta
from typing import Dict, List, Optional, Callable
from functools import wraps
import threading

logger = logging.getLogger(__name__)


class Task:
    """Represents a scheduled task"""
    
    def __init__(
        self,
        name: str,
        func: Callable,
        schedule_type: str,  # 'daily', 'hourly', 'interval', 'weekly'
        run_at: Optional[time] = None,  # For daily/weekly
        interval_minutes: Optional[int] = None,  # For interval
        day_of_week: Optional[int] = None,  # For weekly (0=Monday)
        enabled: bool = True
    ):
        self.name = name
        self.func = func
        self.schedule_type = schedule_type
        self.run_at = run_at
        self.interval_minutes = interval_minutes
        self.day_of_week = day_of_week
        self.enabled = enabled
        self.last_run: Optional[datetime] = None
        self.next_run: Optional[datetime] = None
        self.run_count = 0
        self.error_count = 0
        self.last_error: Optional[str] = None
        
        self._calculate_next_run()
    
    def _calculate_next_run(self):
        """Calculate the next run time"""
        now = datetime.now()
        
        if self.schedule_type == 'daily':
            next_run = datetime.combine(now.date(), self.run_at)
            if next_run <= now:
                next_run += timedelta(days=1)
            self.next_run = next_run
        
        elif self.schedule_type == 'hourly':
            self.next_run = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
        
        elif self.schedule_type == 'interval':
            self.next_run = now + timedelta(minutes=self.interval_minutes)
        
        elif self.schedule_type == 'weekly':
            days_ahead = self.day_of_week - now.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            next_run = now + timedelta(days=days_ahead)
            next_run = datetime.combine(next_run.date(), self.run_at)
            self.next_run = next_run
    
    def should_run(self) -> bool:
        """Check if task should run now"""
        if not self.enabled:
            return False
        
        if self.next_run is None:
            return False
        
        return datetime.now() >= self.next_run
    
    async def run(self):
        """Execute the task"""
        try:
            logger.info(f"[Scheduler] Running task: {self.name}")
            
            if asyncio.iscoroutinefunction(self.func):
                await self.func()
            else:
                self.func()
            
            self.last_run = datetime.now()
            self.run_count += 1
            self._calculate_next_run()
            
            logger.info(f"[Scheduler] Task completed: {self.name}")
        
        except Exception as e:
            self.error_count += 1
            self.last_error = str(e)
            logger.error(f"[Scheduler] Task failed: {self.name} - {e}")
            self._calculate_next_run()


class TaskScheduler:
    """Background task scheduler"""
    
    def __init__(self):
        self.tasks: Dict[str, Task] = {}
        self.running = False
        self._loop_task: Optional[asyncio.Task] = None
    
    def add_task(self, task: Task):
        """Add a task to the scheduler"""
        self.tasks[task.name] = task
        logger.info(f"[Scheduler] Added task: {task.name}")
    
    def remove_task(self, name: str):
        """Remove a task"""
        if name in self.tasks:
            del self.tasks[name]
            logger.info(f"[Scheduler] Removed task: {name}")
    
    def enable_task(self, name: str):
        """Enable a task"""
        if name in self.tasks:
            self.tasks[name].enabled = True
    
    def disable_task(self, name: str):
        """Disable a task"""
        if name in self.tasks:
            self.tasks[name].enabled = False
    
    async def start(self):
        """Start the scheduler"""
        if self.running:
            return
        
        self.running = True
        self._loop_task = asyncio.create_task(self._run_loop())
        logger.info("[Scheduler] Started")
    
    async def stop(self):
        """Stop the scheduler"""
        self.running = False
        if self._loop_task:
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass
        logger.info("[Scheduler] Stopped")
    
    async def _run_loop(self):
        """Main scheduler loop"""
        while self.running:
            for task in self.tasks.values():
                if task.should_run():
                    await task.run()
            
            await asyncio.sleep(60)  # Check every minute
    
    def get_status(self) -> Dict:
        """Get scheduler status"""
        return {
            "running": self.running,
            "task_count": len(self.tasks),
            "tasks": [
                {
                    "name": t.name,
                    "enabled": t.enabled,
                    "schedule_type": t.schedule_type,
                    "last_run": t.last_run.isoformat() if t.last_run else None,
                    "next_run": t.next_run.isoformat() if t.next_run else None,
                    "run_count": t.run_count,
                    "error_count": t.error_count,
                    "last_error": t.last_error
                }
                for t in self.tasks.values()
            ]
        }


# Global scheduler instance
scheduler = TaskScheduler()


# ═══════════════════════════════════════════════════════════════════
# Pre-defined Tasks
# ═══════════════════════════════════════════════════════════════════

async def send_daily_summary_emails():
    """Send daily summary emails to all users"""
    logger.info("[Task] Sending daily summary emails...")
    # Would iterate through users and send emails
    # from app.services.email_service import email_service
    # await email_service.send_daily_summary(...)


async def check_low_stock():
    """Check for low stock products and send alerts"""
    logger.info("[Task] Checking low stock levels...")
    # Would check database and send alerts


async def send_payment_reminders():
    """Send payment reminders for overdue credit"""
    logger.info("[Task] Sending payment reminders...")
    # Would check customers with overdue payments


async def cleanup_old_sessions():
    """Clean up expired sessions and tokens"""
    logger.info("[Task] Cleaning up old sessions...")
    # Would delete expired tokens from database


async def generate_weekly_report():
    """Generate weekly business report"""
    logger.info("[Task] Generating weekly report...")
    # Would compile weekly statistics


async def backup_database():
    """Create automatic database backup to JSON file"""
    import json
    import os
    from pathlib import Path
    
    logger.info("[Task] Creating database backup...")
    
    try:
        from app.database import AsyncSessionLocal
        from app.models import Store, User, Product, Bill, BillItem
        from sqlalchemy import select
        
        backup_dir = Path(__file__).parent.parent.parent / "backups"
        backup_dir.mkdir(exist_ok=True)
        
        async with AsyncSessionLocal() as db:
            # Fetch all data
            stores = (await db.execute(select(Store))).scalars().all()
            users = (await db.execute(select(User))).scalars().all()
            products = (await db.execute(select(Product))).scalars().all()
            bills = (await db.execute(select(Bill))).scalars().all()
            
            backup_data = {
                "backup_timestamp": datetime.now().isoformat(),
                "version": "2.0.0",
                "stores": [{"id": s.id, "name": s.name, "phone": s.phone, "address": s.address} for s in stores],
                "users": [{"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role.value, "store_id": u.store_id} for u in users],
                "products_count": len(products),
                "bills_count": len(bills),
                "products": [{"id": p.id, "name": p.name, "sku": p.sku, "selling_price": p.selling_price, "current_stock": p.current_stock, "store_id": p.store_id} for p in products],
                "bills": [{"id": b.id, "bill_number": b.bill_number, "total_amount": b.total_amount, "status": b.status.value if b.status else "completed", "store_id": b.store_id} for b in bills],
            }
        
        filename = f"backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        filepath = backup_dir / filename
        with open(filepath, 'w') as f:
            json.dump(backup_data, f, indent=2, default=str)
        
        logger.info(f"[Task] Backup created: {filepath} ({len(products)} products, {len(bills)} bills)")
        
        # Clean up old backups (keep last 30 days)
        cutoff = datetime.now() - timedelta(days=30)
        for old_file in backup_dir.glob("backup_*.json"):
            try:
                file_time = datetime.fromtimestamp(old_file.stat().st_mtime)
                if file_time < cutoff:
                    old_file.unlink()
                    logger.info(f"[Task] Deleted old backup: {old_file.name}")
            except Exception:
                pass
                
    except Exception as e:
        logger.error(f"[Task] Backup failed: {e}")


async def sync_offline_data():
    """Sync any pending offline data"""
    logger.info("[Task] Syncing offline data...")
    # Would process offline queue


def register_default_tasks():
    """Register all default scheduled tasks"""
    
    # Daily summary at 9 PM
    scheduler.add_task(Task(
        name="daily_summary",
        func=send_daily_summary_emails,
        schedule_type="daily",
        run_at=time(21, 0),
        enabled=True
    ))
    
    # Low stock check every 4 hours
    scheduler.add_task(Task(
        name="low_stock_check",
        func=check_low_stock,
        schedule_type="interval",
        interval_minutes=240,
        enabled=True
    ))
    
    # Payment reminders at 10 AM
    scheduler.add_task(Task(
        name="payment_reminders",
        func=send_payment_reminders,
        schedule_type="daily",
        run_at=time(10, 0),
        enabled=True
    ))
    
    # Session cleanup every hour
    scheduler.add_task(Task(
        name="session_cleanup",
        func=cleanup_old_sessions,
        schedule_type="hourly",
        enabled=True
    ))
    
    # Weekly report on Sundays at 6 PM
    scheduler.add_task(Task(
        name="weekly_report",
        func=generate_weekly_report,
        schedule_type="weekly",
        run_at=time(18, 0),
        day_of_week=6,  # Sunday
        enabled=True
    ))
    
    # Daily backup at 2 AM
    scheduler.add_task(Task(
        name="database_backup",
        func=backup_database,
        schedule_type="daily",
        run_at=time(2, 0),
        enabled=True
    ))
    
    # Offline sync every 15 minutes
    scheduler.add_task(Task(
        name="offline_sync",
        func=sync_offline_data,
        schedule_type="interval",
        interval_minutes=15,
        enabled=True
    ))


# ═══════════════════════════════════════════════════════════════════
# API Router for Scheduler Management
# ═══════════════════════════════════════════════════════════════════

from fastapi import APIRouter, Depends, HTTPException
from app.routers.auth import get_current_user
from app.models import User

router = APIRouter(prefix="/scheduler", tags=["Scheduler"])


@router.get("/status")
async def get_scheduler_status(
    current_user: User = Depends(get_current_user)
):
    """Get scheduler status and all tasks"""
    return scheduler.get_status()


@router.post("/tasks/{task_name}/enable")
async def enable_task(
    task_name: str,
    current_user: User = Depends(get_current_user)
):
    """Enable a scheduled task"""
    if task_name not in scheduler.tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    scheduler.enable_task(task_name)
    return {"message": f"Task '{task_name}' enabled"}


@router.post("/tasks/{task_name}/disable")
async def disable_task(
    task_name: str,
    current_user: User = Depends(get_current_user)
):
    """Disable a scheduled task"""
    if task_name not in scheduler.tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    scheduler.disable_task(task_name)
    return {"message": f"Task '{task_name}' disabled"}


@router.post("/tasks/{task_name}/run")
async def run_task_now(
    task_name: str,
    current_user: User = Depends(get_current_user)
):
    """Run a task immediately"""
    if task_name not in scheduler.tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = scheduler.tasks[task_name]
    await task.run()
    
    return {
        "message": f"Task '{task_name}' executed",
        "last_run": task.last_run.isoformat() if task.last_run else None
    }
