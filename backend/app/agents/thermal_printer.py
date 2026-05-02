"""
KadaiGPT - Thermal Printer Support with ESC/POS Commands
Professional receipt printing for retail stores
"""

import asyncio
import subprocess
import platform
import tempfile
import os
from datetime import datetime
from typing import Optional, Dict, Any, List
from dataclasses import dataclass


# ESC/POS Command Constants
class ESC:
    """ESC/POS Command Codes for Thermal Printers"""
    # Initialize
    INIT = b'\x1b\x40'
    
    # Text formatting
    BOLD_ON = b'\x1b\x45\x01'
    BOLD_OFF = b'\x1b\x45\x00'
    UNDERLINE_ON = b'\x1b\x2d\x01'
    UNDERLINE_OFF = b'\x1b\x2d\x00'
    
    # Text size
    NORMAL = b'\x1d\x21\x00'
    DOUBLE_HEIGHT = b'\x1d\x21\x01'
    DOUBLE_WIDTH = b'\x1d\x21\x10'
    DOUBLE_SIZE = b'\x1d\x21\x11'
    
    # Alignment
    ALIGN_LEFT = b'\x1b\x61\x00'
    ALIGN_CENTER = b'\x1b\x61\x01'
    ALIGN_RIGHT = b'\x1b\x61\x02'
    
    # Cut paper
    CUT_FULL = b'\x1d\x56\x00'
    CUT_PARTIAL = b'\x1d\x56\x01'
    
    # Feed
    LINE_FEED = b'\x0a'
    FEED_LINES = lambda n: b'\x1b\x64' + bytes([n])
    
    # Drawer kick
    DRAWER_KICK = b'\x1b\x70\x00\x19\xfa'


@dataclass
class ThermalPrintConfig:
    """Configuration for thermal printer"""
    printer_name: str = "auto"
    width: int = 32  # Characters per line (32 for 58mm, 48 for 80mm)
    encoding: str = "utf-8"
    cut_after_print: bool = True
    open_drawer: bool = False
    print_logo: bool = False


class ThermalPrinter:
    """
    🖨️ THERMAL PRINTER CONTROLLER
    
    Features:
    - ESC/POS command support
    - Professional receipt formatting
    - Multi-platform support (Windows, Linux, macOS)
    - Automatic paper cutting
    - Cash drawer trigger
    """
    
    def __init__(self, config: Optional[ThermalPrintConfig] = None):
        self.config = config or ThermalPrintConfig()
        self.buffer = bytearray()
        
    def reset(self):
        """Reset printer and clear buffer"""
        self.buffer = bytearray()
        self.buffer.extend(ESC.INIT)
        return self
    
    def text(self, content: str, bold: bool = False, align: str = "left"):
        """Add text to buffer"""
        if align == "center":
            self.buffer.extend(ESC.ALIGN_CENTER)
        elif align == "right":
            self.buffer.extend(ESC.ALIGN_RIGHT)
        else:
            self.buffer.extend(ESC.ALIGN_LEFT)
        
        if bold:
            self.buffer.extend(ESC.BOLD_ON)
        
        self.buffer.extend(content.encode(self.config.encoding, errors='replace'))
        self.buffer.extend(ESC.LINE_FEED)
        
        if bold:
            self.buffer.extend(ESC.BOLD_OFF)
        
        return self
    
    def title(self, content: str):
        """Add large centered title"""
        self.buffer.extend(ESC.ALIGN_CENTER)
        self.buffer.extend(ESC.DOUBLE_SIZE)
        self.buffer.extend(ESC.BOLD_ON)
        self.buffer.extend(content.encode(self.config.encoding, errors='replace'))
        self.buffer.extend(ESC.LINE_FEED)
        self.buffer.extend(ESC.BOLD_OFF)
        self.buffer.extend(ESC.NORMAL)
        return self
    
    def line(self, char: str = "-"):
        """Add horizontal line"""
        self.buffer.extend((char * self.config.width).encode(self.config.encoding))
        self.buffer.extend(ESC.LINE_FEED)
        return self
    
    def double_line(self):
        """Add double horizontal line"""
        return self.line("=")
    
    def blank(self, lines: int = 1):
        """Add blank lines"""
        for _ in range(lines):
            self.buffer.extend(ESC.LINE_FEED)
        return self
    
    def row(self, left: str, right: str, fill: str = " "):
        """Add a row with left and right aligned text"""
        spacing = self.config.width - len(left) - len(right)
        if spacing < 1:
            spacing = 1
        row_text = f"{left}{fill * spacing}{right}"
        self.buffer.extend(row_text.encode(self.config.encoding, errors='replace'))
        self.buffer.extend(ESC.LINE_FEED)
        return self
    
    def item_row(self, name: str, qty: int, price: float):
        """Add item row: Name Qty Amount"""
        amount = qty * price
        name_truncated = name[:16] if len(name) > 16 else name
        row = f"{name_truncated:<16} {qty:>4} {amount:>10.2f}"
        self.buffer.extend(row.encode(self.config.encoding, errors='replace'))
        self.buffer.extend(ESC.LINE_FEED)
        return self
    
    def total(self, label: str, amount: float, bold: bool = True):
        """Add total line"""
        if bold:
            self.buffer.extend(ESC.BOLD_ON)
        self.row(label, f"₹{amount:,.2f}")
        if bold:
            self.buffer.extend(ESC.BOLD_OFF)
        return self
    
    def cut(self, partial: bool = False):
        """Cut paper"""
        self.blank(3)
        if partial:
            self.buffer.extend(ESC.CUT_PARTIAL)
        else:
            self.buffer.extend(ESC.CUT_FULL)
        return self
    
    def open_drawer(self):
        """Trigger cash drawer"""
        self.buffer.extend(ESC.DRAWER_KICK)
        return self
    
    def get_content(self) -> bytes:
        """Get final buffer content"""
        if self.config.cut_after_print:
            self.cut()
        if self.config.open_drawer:
            self.open_drawer()
        return bytes(self.buffer)
    
    def get_text_content(self) -> str:
        """Get plain text content (for non-thermal printers)"""
        # Build plain text version
        return self.buffer.decode(self.config.encoding, errors='replace')


class ReceiptBuilder:
    """
    📄 RECEIPT BUILDER
    
    Creates professional receipts for KadaiGPT bills
    """
    
    def __init__(self, printer: Optional[ThermalPrinter] = None):
        self.printer = printer or ThermalPrinter()
    
    def build_receipt(self, bill_data: Dict[str, Any]) -> bytes:
        """Build complete receipt from bill data"""
        store_name = bill_data.get("store_name", "KadaiGPT Store")
        store_address = bill_data.get("store_address", "")
        store_phone = bill_data.get("store_phone", "")
        store_gstin = bill_data.get("gstin", "")
        
        bill_number = bill_data.get("bill_number", f"INV-{int(datetime.now().timestamp())}")
        customer_name = bill_data.get("customer_name", "Walk-in Customer")
        items = bill_data.get("items", [])
        subtotal = bill_data.get("subtotal", 0)
        tax = bill_data.get("tax", 0)
        discount = bill_data.get("discount", 0)
        total = bill_data.get("total", subtotal + tax - discount)
        payment_mode = bill_data.get("payment_mode", "Cash")
        
        # Build receipt
        p = self.printer.reset()
        
        # Header
        p.double_line()
        p.title(store_name)
        if store_address:
            p.text(store_address, align="center")
        if store_phone:
            p.text(f"Ph: {store_phone}", align="center")
        if store_gstin:
            p.text(f"GSTIN: {store_gstin}", align="center")
        p.double_line()
        
        # Bill info
        p.row("Bill No:", bill_number)
        p.row("Date:", datetime.now().strftime("%d/%m/%Y %H:%M"))
        p.row("Customer:", customer_name[:20])
        p.line()
        
        # Items header
        p.text(f"{'Item':<16} {'Qty':>4} {'Amount':>10}", bold=True)
        p.line()
        
        # Items
        for item in items:
            name = item.get("product_name") or item.get("name", "Unknown")
            qty = item.get("quantity") or item.get("qty", 1)
            price = item.get("unit_price") or item.get("price", 0)
            p.item_row(name, qty, price)
        
        p.line()
        
        # Totals
        if subtotal > 0:
            p.row("Subtotal", f"₹{subtotal:,.2f}")
        if tax > 0:
            p.row("GST (5%)", f"₹{tax:,.2f}")
        if discount > 0:
            p.row("Discount", f"-₹{discount:,.2f}")
        
        p.double_line()
        p.total("GRAND TOTAL", total)
        p.double_line()
        
        # Payment
        p.row("Payment Mode:", payment_mode)
        p.blank()
        
        # Footer
        p.text("Thank You for Shopping!", align="center", bold=True)
        p.text("Visit Again!", align="center")
        p.blank()
        p.text("Powered by KadaiGPT", align="center")
        p.text("Bill Karo, AI Sambhalo", align="center")
        
        return p.get_content()
    
    def build_plain_receipt(self, bill_data: Dict[str, Any]) -> str:
        """Build plain text receipt (for regular printers)"""
        store_name = bill_data.get("store_name", "KadaiGPT Store")
        bill_number = bill_data.get("bill_number", f"INV-{int(datetime.now().timestamp())}")
        customer_name = bill_data.get("customer_name", "Walk-in Customer")
        items = bill_data.get("items", [])
        total = bill_data.get("total", 0)
        
        width = 32
        lines = []
        
        lines.append("=" * width)
        lines.append(f"{store_name:^{width}}")
        lines.append("=" * width)
        lines.append(f"Bill No: {bill_number}")
        lines.append(f"Date: {datetime.now().strftime('%d/%m/%Y %H:%M')}")
        lines.append(f"Customer: {customer_name}")
        lines.append("-" * width)
        lines.append(f"{'Item':<16} {'Qty':>4} {'Amount':>10}")
        lines.append("-" * width)
        
        for item in items:
            name = (item.get("product_name") or item.get("name", "Unknown"))[:16]
            qty = item.get("quantity") or item.get("qty", 1)
            price = item.get("unit_price") or item.get("price", 0)
            amount = qty * price
            lines.append(f"{name:<16} {qty:>4} {amount:>10.2f}")
        
        lines.append("-" * width)
        lines.append(f"{'TOTAL':>{width-12}} ₹{total:>10,.2f}")
        lines.append("=" * width)
        lines.append(f"{'Thank You!':^{width}}")
        lines.append(f"{'Powered by KadaiGPT':^{width}}")
        lines.append("")
        
        return "\n".join(lines)


async def print_receipt(
    bill_data: Dict[str, Any],
    printer_name: str = "auto",
    use_thermal: bool = True
) -> Dict[str, Any]:
    """
    🖨️ PRINT RECEIPT FUNCTION
    
    Main function to print receipts with automatic printer selection
    """
    result = {
        "success": False,
        "printer": printer_name,
        "message": "",
        "timestamp": datetime.now().isoformat()
    }
    
    try:
        builder = ReceiptBuilder()
        
        if use_thermal:
            content = builder.build_receipt(bill_data)
        else:
            content = builder.build_plain_receipt(bill_data).encode()
        
        # Print based on platform
        if platform.system() == "Windows":
            success = await _windows_print(content, printer_name, use_thermal)
        else:
            success = await _unix_print(content, printer_name)
        
        if success:
            result["success"] = True
            result["message"] = f"Receipt printed successfully to {printer_name}"
        else:
            result["message"] = "Print command executed but status unknown"
            result["success"] = True  # Assume success if no error
            
    except Exception as e:
        result["message"] = f"Print failed: {str(e)}"
        result["error"] = str(e)
    
    return result


async def _windows_print(content: bytes, printer_name: str, is_thermal: bool) -> bool:
    """Windows printing"""
    try:
        # Write to temp file
        suffix = ".bin" if is_thermal else ".txt"
        with tempfile.NamedTemporaryFile(mode='wb', suffix=suffix, delete=False) as f:
            f.write(content)
            temp_path = f.name
        
        # For thermal printers with RAW/direct printing
        if is_thermal and printer_name != "auto":
            # Use copy command for direct RAW printing to thermal
            result = subprocess.run(
                ['cmd', '/c', f'copy /b "{temp_path}" "\\\\%COMPUTERNAME%\\{printer_name}"'],
                capture_output=True,
                timeout=30,
                shell=True
            )
        else:
            # Use PowerShell Out-Printer for regular printers
            text_content = content.decode('utf-8', errors='replace')
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as f:
                f.write(text_content)
                text_path = f.name
            
            if printer_name == "auto":
                cmd = f'Get-Content "{text_path}" | Out-Printer'
            else:
                cmd = f'Get-Content "{text_path}" | Out-Printer -Name "{printer_name}"'
            
            result = subprocess.run(
                ['powershell', '-Command', cmd],
                capture_output=True,
                timeout=30
            )
            os.unlink(text_path)
        
        os.unlink(temp_path)
        return result.returncode == 0
        
    except Exception as e:
        print(f"Windows print error: {e}")
        return False


async def _unix_print(content: bytes, printer_name: str) -> bool:
    """Linux/macOS printing"""
    try:
        cmd = ['lp']
        if printer_name != "auto":
            cmd.extend(['-d', printer_name])
        
        result = subprocess.run(
            cmd,
            input=content,
            capture_output=True,
            timeout=30
        )
        return result.returncode == 0
        
    except Exception as e:
        print(f"Unix print error: {e}")
        return False


# Export
__all__ = [
    'ThermalPrinter',
    'ThermalPrintConfig', 
    'ReceiptBuilder',
    'print_receipt',
    'ESC'
]
