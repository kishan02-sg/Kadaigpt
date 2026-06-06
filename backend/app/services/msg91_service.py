"""
KadaiGPT - MSG91 email delivery (for OTP / transactional email)

Used to deliver one-time passwords by email. The OTP itself is generated and
verified by the app (see app.services.auth_state); MSG91 is only the transport.

Activates automatically when these env vars are set (otherwise `enabled` is False
and callers fall back to SMTP / logging):

  MSG91_AUTH_KEY          - your MSG91 auth key
  MSG91_EMAIL_FROM        - verified sender email, e.g. no-reply@yourdomain.com
  MSG91_EMAIL_DOMAIN      - the domain verified in MSG91, e.g. yourdomain.com
  MSG91_EMAIL_TEMPLATE_ID - an MSG91 email template containing an {{otp}} variable

MSG91 email requires a template (you create it in the MSG91 panel). The template
should reference the variables we send: otp, company_name.
"""

import os
import logging

import httpx

logger = logging.getLogger("KadaiGPT.MSG91")

MSG91_EMAIL_ENDPOINT = "https://control.msg91.com/api/v5/email/send"


class MSG91Service:
    def __init__(self):
        self.auth_key = os.getenv("MSG91_AUTH_KEY", "")
        self.email_from = os.getenv("MSG91_EMAIL_FROM", "")
        self.email_domain = os.getenv("MSG91_EMAIL_DOMAIN", "")
        self.email_template_id = os.getenv("MSG91_EMAIL_TEMPLATE_ID", "")
        self.from_name = os.getenv("MSG91_EMAIL_FROM_NAME", "KadaiGPT")

    @property
    def enabled(self) -> bool:
        """True only when everything needed to send MSG91 email is configured."""
        return bool(
            self.auth_key
            and self.email_from
            and self.email_domain
            and self.email_template_id
        )

    async def send_email_otp(self, to_email: str, otp: str, name: str = "") -> bool:
        """Send an OTP email via MSG91. Returns True on success, False otherwise."""
        if not self.enabled:
            return False

        payload = {
            "recipients": [
                {
                    "to": [{"email": to_email, "name": name or to_email}],
                    "variables": {
                        "otp": otp,
                        "company_name": self.from_name,
                        "name": name or "there",
                    },
                }
            ],
            "from": {"email": self.email_from, "name": self.from_name},
            "domain": self.email_domain,
            "template_id": self.email_template_id,
        }
        headers = {
            "authkey": self.auth_key,
            "accept": "application/json",
            "content-type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(MSG91_EMAIL_ENDPOINT, json=payload, headers=headers)
            if resp.status_code // 100 == 2:
                logger.info(f"[MSG91] OTP email sent to {to_email}")
                return True
            logger.warning(f"[MSG91] send failed ({resp.status_code}): {resp.text[:200]}")
            return False
        except Exception as e:
            logger.warning(f"[MSG91] send error: {type(e).__name__}: {e}")
            return False


# Singleton
msg91_service = MSG91Service()
