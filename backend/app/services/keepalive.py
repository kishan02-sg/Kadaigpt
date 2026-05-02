"""
KadaiGPT - Keep-Alive Service
Prevents Render.com free tier from spinning down after 15 minutes of inactivity.

Strategy:
- Self-pings the /api/health endpoint every 10 minutes
- Runs as an asyncio background task inside the FastAPI process
- Zero external dependencies — works out of the box
- Logs uptime stats for monitoring
- Gracefully handles errors without crashing the app

This is the #1 solution used by production apps on free hosting tiers.
Works on: Render, Railway, Fly.io, Koyeb, etc.
"""

import asyncio
import logging
import os
from datetime import datetime, timedelta
from typing import Optional

import httpx

logger = logging.getLogger("kadaigpt.keepalive")


class KeepAliveService:
    """
    Self-ping background service to prevent Render free tier sleep.
    
    Render spins down free services after 15 minutes of inactivity.
    This service pings the health endpoint every PING_INTERVAL_SECONDS
    to keep the service alive 24/7.
    """

    PING_INTERVAL_SECONDS = 10 * 60  # 10 minutes (Render sleeps after 15)
    MAX_CONSECUTIVE_FAILURES = 5

    def __init__(self):
        self._task: Optional[asyncio.Task] = None
        self._running = False
        self._ping_count = 0
        self._fail_count = 0
        self._consecutive_failures = 0
        self._started_at: Optional[datetime] = None
        self._last_ping: Optional[datetime] = None
        self._last_status: Optional[str] = None
        self._ping_url: Optional[str] = None

    def _get_ping_url(self) -> str:
        """Build the self-ping URL from environment or defaults."""
        # Try to detect the service URL from Render's env
        render_url = os.environ.get("RENDER_EXTERNAL_URL")
        if render_url:
            return f"{render_url}/api/health"

        # Try manual override
        app_url = os.environ.get("APP_URL") or os.environ.get("KADAIGPT_URL")
        if app_url:
            return f"{app_url.rstrip('/')}/api/health"

        # Fallback to local (works for self-ping)
        port = os.environ.get("PORT", "8000")
        return f"http://localhost:{port}/api/health"

    async def start(self):
        """Start the keep-alive background loop."""
        if self._running:
            logger.info("[KeepAlive] Already running, skipping start")
            return

        # Only run in production (no need locally)
        app_env = os.environ.get("APP_ENV", "development")
        if app_env not in ("production", "staging"):
            logger.info(f"[KeepAlive] Skipping — not in production (APP_ENV={app_env})")
            return

        self._ping_url = self._get_ping_url()
        self._running = True
        self._started_at = datetime.now()
        self._task = asyncio.create_task(self._ping_loop())

        logger.info(f"🟢 [KeepAlive] Started! Pinging {self._ping_url} every {self.PING_INTERVAL_SECONDS // 60} minutes")
        logger.info(f"   This prevents Render from sleeping after 15 min of inactivity")

    async def stop(self):
        """Stop the keep-alive loop gracefully."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info(f"🔴 [KeepAlive] Stopped after {self._ping_count} pings")

    async def _ping_loop(self):
        """Main loop — pings health endpoint at regular intervals."""
        # Wait 60 seconds before first ping (let the app fully start)
        await asyncio.sleep(60)

        while self._running:
            try:
                await self._do_ping()
                self._consecutive_failures = 0
            except Exception as e:
                self._fail_count += 1
                self._consecutive_failures += 1
                self._last_status = f"ERROR: {str(e)[:100]}"
                logger.warning(f"[KeepAlive] Ping failed ({self._consecutive_failures}/{self.MAX_CONSECUTIVE_FAILURES}): {e}")

                if self._consecutive_failures >= self.MAX_CONSECUTIVE_FAILURES:
                    logger.error("[KeepAlive] Too many consecutive failures, but continuing...")
                    self._consecutive_failures = 0  # Reset and keep trying

            await asyncio.sleep(self.PING_INTERVAL_SECONDS)

    async def _do_ping(self):
        """Execute a single health ping."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(self._ping_url)
            self._ping_count += 1
            self._last_ping = datetime.now()
            self._last_status = f"HTTP {response.status_code}"

            if response.status_code == 200:
                # Log every 6th ping (every hour) to reduce noise
                if self._ping_count % 6 == 0:
                    uptime = self._get_uptime_str()
                    logger.info(f"💚 [KeepAlive] Ping #{self._ping_count} OK — Uptime: {uptime}")
            else:
                logger.warning(f"[KeepAlive] Ping #{self._ping_count} returned {response.status_code}")

    def _get_uptime_str(self) -> str:
        """Get human-readable uptime string."""
        if not self._started_at:
            return "N/A"
        delta = datetime.now() - self._started_at
        hours = int(delta.total_seconds() // 3600)
        minutes = int((delta.total_seconds() % 3600) // 60)
        if hours > 24:
            days = hours // 24
            hours = hours % 24
            return f"{days}d {hours}h {minutes}m"
        return f"{hours}h {minutes}m"

    def get_status(self) -> dict:
        """Get keep-alive service status for the health endpoint."""
        return {
            "running": self._running,
            "started_at": self._started_at.isoformat() if self._started_at else None,
            "uptime": self._get_uptime_str(),
            "total_pings": self._ping_count,
            "failed_pings": self._fail_count,
            "last_ping": self._last_ping.isoformat() if self._last_ping else None,
            "last_status": self._last_status,
            "ping_interval_minutes": self.PING_INTERVAL_SECONDS // 60,
            "ping_url": self._ping_url
        }


# Global singleton
keepalive = KeepAliveService()
