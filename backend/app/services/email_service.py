"""
KadaiGPT - Email Notifications Service
Send automated emails for reports, alerts, and reminders
"""

import os
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

# Optional SMTP support
try:
    import smtplib
    SMTP_AVAILABLE = True
except ImportError:
    SMTP_AVAILABLE = False

# Optional async email support
try:
    import aiosmtplib
    ASYNC_SMTP_AVAILABLE = True
except ImportError:
    ASYNC_SMTP_AVAILABLE = False

logger = logging.getLogger(__name__)


class EmailTemplate:
    """HTML email templates for various notification types"""
    
    @staticmethod
    def base_template(title: str, content: str, footer: str = "") -> str:
        """Base email template with KadaiGPT branding"""
        return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0f0f14; color: #f8fafc; margin: 0; padding: 20px; }}
        .container {{ max-width: 600px; margin: 0 auto; background: #1a1a24; border-radius: 16px; overflow: hidden; }}
        .header {{ background: linear-gradient(135deg, #f97316, #ea580c); padding: 32px; text-align: center; }}
        .header h1 {{ margin: 0; color: white; font-size: 24px; font-weight: 700; }}
        .header p {{ margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px; }}
        .content {{ padding: 32px; }}
        .stat-grid {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 24px 0; }}
        .stat-card {{ background: #252533; padding: 20px; border-radius: 12px; text-align: center; }}
        .stat-value {{ font-size: 28px; font-weight: 700; color: #f97316; display: block; }}
        .stat-label {{ font-size: 12px; color: #a3a3a3; margin-top: 4px; }}
        .alert {{ padding: 16px; border-radius: 8px; margin: 16px 0; }}
        .alert-warning {{ background: rgba(245, 158, 11, 0.15); border-left: 4px solid #f59e0b; }}
        .alert-success {{ background: rgba(34, 197, 94, 0.15); border-left: 4px solid #22c55e; }}
        .alert-error {{ background: rgba(239, 68, 68, 0.15); border-left: 4px solid #ef4444; }}
        .btn {{ display: inline-block; background: #f97316; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0; }}
        .footer {{ background: #0f0f14; padding: 24px; text-align: center; font-size: 12px; color: #737373; }}
        .footer a {{ color: #f97316; text-decoration: none; }}
        table {{ width: 100%; border-collapse: collapse; margin: 16px 0; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #252533; }}
        th {{ background: #252533; color: #f8fafc; font-weight: 600; }}
        td {{ color: #a3a3a3; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏪 KadaiGPT</h1>
            <p>Bill Karo, AI Sambhalo</p>
        </div>
        <div class="content">
            <h2 style="margin-top: 0;">{title}</h2>
            {content}
        </div>
        <div class="footer">
            {footer if footer else 'Powered by KadaiGPT • AI-Powered Retail Operations'}
            <br><br>
            <a href="https://kadaigpt.vercel.app">Visit Dashboard</a>
        </div>
    </div>
</body>
</html>
"""

    @staticmethod
    def daily_summary(data: Dict[str, Any]) -> str:
        """Daily business summary email"""
        content = f"""
        <p>Here's your daily business summary for <strong>{data.get('date', 'today')}</strong>:</p>
        
        <div class="stat-grid">
            <div class="stat-card">
                <span class="stat-value">₹{data.get('total_sales', 0):,.0f}</span>
                <span class="stat-label">Total Sales</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">{data.get('total_bills', 0)}</span>
                <span class="stat-label">Bills Created</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">{data.get('customers', 0)}</span>
                <span class="stat-label">Customers Served</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">₹{data.get('net_profit', 0):,.0f}</span>
                <span class="stat-label">Net Profit</span>
            </div>
        </div>
        
        {f'<div class="alert alert-warning">⚠️ {data.get("low_stock_count", 0)} products are running low on stock!</div>' if data.get('low_stock_count', 0) > 0 else ''}
        
        <h3>Top Selling Products</h3>
        <table>
            <tr><th>Product</th><th>Qty Sold</th><th>Revenue</th></tr>
            {''.join(f"<tr><td>{p.get('name', '')}</td><td>{p.get('qty', 0)}</td><td>₹{p.get('revenue', 0):,.0f}</td></tr>" for p in data.get('top_products', [])[:5])}
        </table>
        
        <a href="https://kadaigpt.vercel.app/daily-summary" class="btn">View Full Report →</a>
        """
        return EmailTemplate.base_template("📊 Daily Business Summary", content)

    @staticmethod
    def low_stock_alert(products: List[Dict]) -> str:
        """Low stock alert email"""
        content = f"""
        <div class="alert alert-warning">
            <strong>⚠️ Stock Alert!</strong>
            <p>{len(products)} products need immediate attention.</p>
        </div>
        
        <table>
            <tr><th>Product</th><th>Current Stock</th><th>Min Required</th><th>Status</th></tr>
            {''.join(f"<tr><td>{p.get('name', '')}</td><td>{p.get('stock', 0)}</td><td>{p.get('min_stock', 10)}</td><td style='color: #ef4444;'>Low</td></tr>" for p in products)}
        </table>
        
        <a href="https://kadaigpt.vercel.app/suppliers" class="btn">Order Now →</a>
        """
        return EmailTemplate.base_template("⚠️ Low Stock Alert", content)

    @staticmethod
    def payment_reminder(customer: Dict, amount: float) -> str:
        """Payment reminder email"""
        content = f"""
        <p>This is a friendly reminder about a pending payment from <strong>{customer.get('name', 'Customer')}</strong>.</p>
        
        <div class="stat-grid">
            <div class="stat-card">
                <span class="stat-value">₹{amount:,.0f}</span>
                <span class="stat-label">Amount Due</span>
            </div>
            <div class="stat-card">
                <span class="stat-value">{customer.get('days_overdue', 0)}</span>
                <span class="stat-label">Days Overdue</span>
            </div>
        </div>
        
        <p><strong>Customer Details:</strong></p>
        <ul>
            <li>Phone: {customer.get('phone', 'N/A')}</li>
            <li>Last Purchase: {customer.get('last_purchase', 'N/A')}</li>
        </ul>
        
        <a href="https://kadaigpt.vercel.app/customers" class="btn">View Customer →</a>
        """
        return EmailTemplate.base_template("💰 Payment Reminder", content)

    @staticmethod
    def welcome_email(store_name: str) -> str:
        """Welcome email for new users"""
        content = f"""
        <p>Welcome to <strong>KadaiGPT</strong> - Your AI-Powered Retail Operations Partner!</p>
        
        <p>You've successfully set up <strong>{store_name}</strong>. Here's what you can do:</p>
        
        <div class="alert alert-success">
            ✅ Create bills in seconds with voice & OCR<br>
            ✅ Track inventory with AI predictions<br>
            ✅ Manage customers and credit (Khata)<br>
            ✅ Generate GST-compliant reports<br>
            ✅ Get WhatsApp reminders
        </div>
        
        <h3>Quick Start Guide:</h3>
        <ol>
            <li>Add your products in the Inventory section</li>
            <li>Configure your store details in Settings</li>
            <li>Start creating bills!</li>
        </ol>
        
        <a href="https://kadaigpt.vercel.app" class="btn">Go to Dashboard →</a>
        """
        return EmailTemplate.base_template("🎉 Welcome to KadaiGPT!", content)


class EmailService:
    """Email sending service with multiple provider support"""
    
    def __init__(self):
        self.smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', '587'))
        self.smtp_user = os.getenv('SMTP_USER', '')
        self.smtp_password = os.getenv('SMTP_PASSWORD', '')
        self.from_email = os.getenv('FROM_EMAIL', 'noreply@kadaigpt.com')
        self.from_name = os.getenv('FROM_NAME', 'KadaiGPT')
        self.enabled = bool(self.smtp_user and self.smtp_password)
        
        if not self.enabled:
            logger.warning("[Email] SMTP credentials not configured. Email sending disabled.")
    
    def _create_message(
        self,
        to: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> MIMEMultipart:
        """Create MIME email message"""
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{self.from_name} <{self.from_email}>"
        msg['To'] = to
        
        # Plain text fallback
        if text_content:
            msg.attach(MIMEText(text_content, 'plain'))
        
        # HTML content
        msg.attach(MIMEText(html_content, 'html'))
        
        return msg
    
    def send_email(
        self,
        to: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """Send email synchronously"""
        if not self.enabled:
            logger.info(f"[Email] Would send to {to}: {subject}")
            return False
        
        if not SMTP_AVAILABLE:
            logger.error("[Email] smtplib not available")
            return False
        
        try:
            msg = self._create_message(to, subject, html_content, text_content)
            
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"[Email] Sent successfully to {to}")
            return True
        except Exception as e:
            logger.error(f"[Email] Failed to send: {e}")
            return False
    
    async def send_email_async(
        self,
        to: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """Send email asynchronously"""
        if not self.enabled:
            logger.info(f"[Email] Would send to {to}: {subject}")
            return False
        
        if not ASYNC_SMTP_AVAILABLE:
            # Fallback to sync
            return self.send_email(to, subject, html_content, text_content)
        
        try:
            msg = self._create_message(to, subject, html_content, text_content)
            
            await aiosmtplib.send(
                msg,
                hostname=self.smtp_host,
                port=self.smtp_port,
                username=self.smtp_user,
                password=self.smtp_password,
                start_tls=True
            )
            
            logger.info(f"[Email] Sent successfully to {to}")
            return True
        except Exception as e:
            logger.error(f"[Email] Failed to send: {e}")
            return False
    
    # Convenience methods
    def send_daily_summary(self, to: str, data: Dict[str, Any]) -> bool:
        """Send daily summary email"""
        html = EmailTemplate.daily_summary(data)
        return self.send_email(to, "📊 Your Daily Business Summary - KadaiGPT", html)
    
    def send_low_stock_alert(self, to: str, products: List[Dict]) -> bool:
        """Send low stock alert"""
        html = EmailTemplate.low_stock_alert(products)
        return self.send_email(to, "⚠️ Low Stock Alert - KadaiGPT", html)
    
    def send_payment_reminder(self, to: str, customer: Dict, amount: float) -> bool:
        """Send payment reminder"""
        html = EmailTemplate.payment_reminder(customer, amount)
        return self.send_email(to, "💰 Payment Reminder - KadaiGPT", html)
    
    def send_welcome_email(self, to: str, store_name: str) -> bool:
        """Send welcome email to new user"""
        html = EmailTemplate.welcome_email(store_name)
        return self.send_email(to, "🎉 Welcome to KadaiGPT!", html)


# Singleton instance
email_service = EmailService()
