from __future__ import annotations

import os
import httpx
from typing import Optional


RESEND_API = "https://api.resend.com/emails"


class EmailService:
    def __init__(self, api_key: Optional[str] = None, from_address: Optional[str] = None):
        self.api_key = api_key or os.getenv("RESEND_API_KEY")
        self.from_address = from_address or os.getenv("EMAIL_FROM")
        if not self.api_key:
            raise RuntimeError("RESEND_API_KEY is not configured")
        if not self.from_address:
            raise RuntimeError("EMAIL_FROM is not configured")

    def send_email(self, to: str, subject: str, html: str) -> None:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {"from": self.from_address, "to": [to], "subject": subject, "html": html}
        with httpx.Client(timeout=20.0) as c:
            r = c.post(RESEND_API, headers=headers, json=payload)
            r.raise_for_status()


