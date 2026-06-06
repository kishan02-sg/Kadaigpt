"""
KadaiGPT - Resend email delivery (developer-friendly transactional email)

Simplest option for sending OTP / transactional email. Free tier available.
Activates when RESEND_API_KEY is set; otherwise `enabled` is False and callers
fall back to the next provider.

Env vars:
  RESEND_API_KEY  - your Resend API key (starts with "re_")
  RESEND_FROM     - sender, e.g. "KadaiGPT <no-reply@yourdomain.com>"
                    (for quick testing Resend allows "onboarding@resend.dev",
                     which can only send to your own account email until you
                     verify a domain)

Docs: https://resend.com/docs/api-reference/emails/send-email
"""

import os
import logging

import httpx

logger = logging.getLogger("KadaiGPT.Resend")

RESEND_ENDPOINT = "https://api.resend.com/emails"


class ResendService:
    def __init__(self):
        self.api_key = os.getenv("RESEND_API_KEY", "")
        self.from_addr = os.getenv("RESEND_FROM", "KadaiGPT <onboarding@resend.dev>")

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    async def send_email(self, to_email: str, subject: str, html: str) -> bool:
        """Send an HTML email via Resend. Returns True on success."""
        if not self.enabled:
            return False
        payload = {
            "from": self.from_addr,
            "to": [to_email],
            "subject": subject,
            "html": html,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(RESEND_ENDPOINT, json=payload, headers=headers)
            if resp.status_code // 100 == 2:
                logger.info(f"[Resend] email sent to {to_email}")
                return True
            logger.warning(f"[Resend] send failed ({resp.status_code}): {resp.text[:200]}")
            return False
        except Exception as e:
            logger.warning(f"[Resend] send error: {type(e).__name__}: {e}")
            return False


# Singleton
resend_service = ResendService()
