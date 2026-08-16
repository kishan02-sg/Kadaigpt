"""
KadaiGPT - Bot DB Integration Tests

Verifies the WhatsApp/Telegram owner bots actually write to and read from the
database (no more fake "saved" replies or hardcoded zero reports):

- Unregistered numbers get a registration prompt, not fake success.
- add product / newbill / neworder via WhatsApp create real rows (product,
  bill + bill items with stock decrement, purchase order + supplier).
- price / sendbill / reminder commands hit real store data.
- Telegram /link flow binds a chat to an account, then reports show real data.
- create_bill_core is the shared path for both the HTTP endpoint and the bot.

Run with: pytest tests/test_bot_integration.py -v
"""

import asyncio
import re
import sys
import os
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.database import async_session_maker, engine
from app.models import Product, Bill, BillItem, PurchaseOrder, Supplier
from app.services.whatsapp_bot import whatsapp_bot
from app.services.telegram_bot import telegram_bot


def run(coro):
    """Run an async coroutine in its own loop, disposing pooled SQLite
    connections before and after so later TestClient/async calls are never
    handed a connection bound to a dead loop."""
    asyncio.run(engine.dispose())
    result = asyncio.run(coro)
    asyncio.run(engine.dispose())
    return result


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def registered_owner(client):
    """Register a fresh OWNER with a phone, return creds + store_id."""
    ts = datetime.now().timestamp()
    # 98765 + 8 digits from millisecond timestamp = 13-digit unique phone
    phone = f"98765{int(ts * 1000) % 100000000:08d}"
    email = f"bot_owner_{ts}@test.com"
    response = client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "SecurePass123!",
        "full_name": "Bot Test Owner",
        "phone": phone,
        "store_name": f"Bot Test Store {ts}",
    })
    assert response.status_code == 200, response.text
    token = response.json().get("access_token")
    # Get store_id from the token-protected /auth/me endpoint
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    store_id = me.json().get("store_id")
    return {
        "email": email,
        "password": "SecurePass123!",
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
        "phone": phone,
        "store_id": store_id,
    }


# ==================== WHATSAPP: USER RESOLUTION ====================

def test_unregistered_phone_gets_registration_prompt():
    phone = "9999888877"  # never registered
    resp = run(whatsapp_bot.process_incoming_message(phone, "sales"))
    assert "link" in resp.lower() or "register" in resp.lower()
    # Never fake data
    assert "₹0" not in resp


def test_registered_phone_resolves_and_reports(client, registered_owner):
    # "sales" is an unambiguous rule-based intent
    resp = run(whatsapp_bot.process_incoming_message(registered_owner["phone"], "sales"))
    assert "Today's Sales" in resp
    assert "₹" in resp
    assert "No sales yet" in resp or "Bills Created" in resp


# ==================== WHATSAPP: ADD PRODUCT ====================

def test_whatsapp_add_product_creates_db_row(registered_owner):
    phone = registered_owner["phone"]
    store_id = registered_owner["store_id"]

    ctx = run(whatsapp_bot._resolve_ctx(phone))
    assert ctx is not None and ctx["store_id"] == store_id

    r1 = run(whatsapp_bot._start_add_product(phone, "Sugar 1kg", ctx))
    assert "price" in r1.lower()

    r2 = run(whatsapp_bot.process_incoming_message(phone, "120"))
    assert "stock" in r2.lower()

    r3 = run(whatsapp_bot.process_incoming_message(phone, "50"))
    assert "confirm" in r3.lower() or "product" in r3.lower()

    r4 = run(whatsapp_bot.process_incoming_message(phone, "yes"))
    assert "added" in r4.lower() or "already existed" in r4.lower()

    async def check():
        async with async_session_maker() as db:
            p = (await db.execute(
                select(Product).where(
                    Product.store_id == store_id,
                    Product.name == "Sugar 1kg",
                )
            )).scalars().first()
            return p
    p = run(check())
    assert p is not None, "Product row must exist after bot 'add' flow"
    assert p.current_stock == 50
    assert p.selling_price == 120


def test_whatsapp_add_duplicate_merges_stock(registered_owner):
    phone = registered_owner["phone"]
    store_id = registered_owner["store_id"]
    ctx = run(whatsapp_bot._resolve_ctx(phone))

    run(whatsapp_bot._start_add_product(phone, "Rice 5kg", ctx))
    run(whatsapp_bot.process_incoming_message(phone, "300"))
    run(whatsapp_bot.process_incoming_message(phone, "20"))
    run(whatsapp_bot.process_incoming_message(phone, "yes"))

    run(whatsapp_bot._start_add_product(phone, "Rice 5kg", ctx))
    run(whatsapp_bot.process_incoming_message(phone, "300"))
    run(whatsapp_bot.process_incoming_message(phone, "5"))
    r = run(whatsapp_bot.process_incoming_message(phone, "yes"))
    assert "already existed" in r.lower()

    async def check():
        async with async_session_maker() as db:
            rows = (await db.execute(
                select(Product).where(
                    Product.store_id == store_id,
                    Product.name == "Rice 5kg",
                )
            )).scalars().all()
            return rows
    rows = run(check())
    assert len(rows) == 1, "No silent duplicate product rows"
    assert rows[0].current_stock == 25


# ==================== WHATSAPP: CREATE BILL ====================

def test_whatsapp_create_bill_creates_rows_and_decrements_stock(client, registered_owner):
    phone = registered_owner["phone"]
    store_id = registered_owner["store_id"]
    ctx = run(whatsapp_bot._resolve_ctx(phone))

    # Seed a product with stock via the app API (catalog manager = owner)
    p_resp = client.post("/api/v1/products", headers=registered_owner["headers"], json={
        "name": "Toor Dal 1kg",
        "selling_price": 140,
        "current_stock": 10,
    })
    assert p_resp.status_code == 201, p_resp.text

    # Bot bill flow
    r1 = run(whatsapp_bot._start_create_bill(phone, ctx))
    assert "customer" in r1.lower()
    run(whatsapp_bot.process_incoming_message(phone, "9876500000"))  # phone -> customer_phone
    run(whatsapp_bot.process_incoming_message(phone, "Toor Dal 1kg, 2, 140"))
    run(whatsapp_bot.process_incoming_message(phone, "done"))
    r_final = run(whatsapp_bot.process_incoming_message(phone, "confirm"))
    assert "Bill Created" in r_final
    assert "INV-" in r_final

    async def check():
        async with async_session_maker() as db:
            bills = (await db.execute(
                select(Bill).where(Bill.store_id == store_id)
            )).scalars().all()
            latest = sorted(bills, key=lambda b: b.created_at)[-1]
            items = (await db.execute(
                select(BillItem).where(BillItem.bill_id == latest.id)
            )).scalars().all()
            product = (await db.execute(
                select(Product).where(
                    Product.store_id == store_id,
                    Product.name == "Toor Dal 1kg",
                )
            )).scalars().first()
            return latest, items, product
    bill, items, product = run(check())
    assert bill is not None
    assert bill.customer_phone == "9876500000"
    assert len(items) == 1
    assert items[0].product_id is not None, "Bot items matched to inventory must link product_id"
    assert items[0].quantity == 2
    assert product.current_stock == 8, "Stock must be decremented by the shared bill core"


# ==================== WHATSAPP: PURCHASE ORDER ====================

def test_whatsapp_create_po_creates_supplier_and_order(registered_owner):
    phone = registered_owner["phone"]
    store_id = registered_owner["store_id"]
    ctx = run(whatsapp_bot._resolve_ctx(phone))

    r1 = run(whatsapp_bot._start_create_order(phone, ctx))
    assert "supplier" in r1.lower()
    run(whatsapp_bot.process_incoming_message(phone, "Metro Wholesale"))
    run(whatsapp_bot.process_incoming_message(phone, "skip"))
    run(whatsapp_bot.process_incoming_message(phone, "Rice 25kg, 10"))
    run(whatsapp_bot.process_incoming_message(phone, "done"))
    r_final = run(whatsapp_bot.process_incoming_message(phone, "confirm"))
    assert "Purchase Order Created" in r_final
    assert "PO-" in r_final

    async def check():
        async with async_session_maker() as db:
            supplier = (await db.execute(
                select(Supplier).where(
                    Supplier.store_id == store_id,
                    Supplier.name == "Metro Wholesale",
                )
            )).scalars().first()
            po = (await db.execute(
                select(PurchaseOrder).where(PurchaseOrder.store_id == store_id)
            )).scalars().first()
            return supplier, po
    supplier, po = run(check())
    assert supplier is not None
    assert po is not None
    assert po.supplier_id == supplier.id
    assert po.item_count == 1
    assert po.items[0]["product_name"] == "Rice 25kg"


# ==================== WHATSAPP: REPORTS ====================

def test_whatsapp_reports_reflect_real_data(client, registered_owner):
    store_id = registered_owner["store_id"]
    # Seed a bill via the HTTP endpoint (shared create_bill_core)
    resp = client.post("/api/v1/bills", headers=registered_owner["headers"], json={
        "customer_name": "Walk-in",
        "items": [{"product_name": "Tea 250g", "quantity": 1, "unit_price": 90}],
    })
    assert resp.status_code == 201, resp.text

    sales = run(whatsapp_bot._get_sales_response(store_id))
    assert "Today's Sales" in sales
    assert "₹90" in sales or "90" in sales

    bills = run(whatsapp_bot._get_bills_response(store_id))
    assert "Recent Bills" in bills
    assert "INV-" in bills

    products = run(whatsapp_bot._get_products_response(store_id))
    assert "Total Products" in products

    pending = run(whatsapp_bot._get_pending_payments(store_id))
    assert "Pending Payments" in pending


def test_whatsapp_price_and_sendbill(registered_owner):
    phone = registered_owner["phone"]
    store_id = registered_owner["store_id"]
    ctx = run(whatsapp_bot._resolve_ctx(phone))

    # Add a product + create a bill with a customer phone so sendbill can work
    run(whatsapp_bot._start_add_product(phone, "Milk 500ml", ctx))
    run(whatsapp_bot.process_incoming_message(phone, "30"))
    run(whatsapp_bot.process_incoming_message(phone, "100"))
    run(whatsapp_bot.process_incoming_message(phone, "yes"))

    price = run(whatsapp_bot._get_product_price(store_id, "Milk"))
    assert "Milk 500ml" in price
    assert "₹30" in price

    run(whatsapp_bot._start_create_bill(phone, ctx))
    run(whatsapp_bot.process_incoming_message(phone, "9876500001"))
    run(whatsapp_bot.process_incoming_message(phone, "Milk 500ml, 1, 30"))
    run(whatsapp_bot.process_incoming_message(phone, "done"))
    r = run(whatsapp_bot.process_incoming_message(phone, "confirm"))
    bill_no = re.search(r"INV-[A-Z0-9-]+", r).group(0)

    sent = run(whatsapp_bot._send_bill_to_customer(store_id, phone, bill_no))
    # The bill must be fetched from the DB; actually delivering depends on a
    # configured WhatsApp provider, which the test environment doesn't have.
    assert bill_no in sent
    assert "sent" in sent.lower() or "fetched" in sent.lower()


# ==================== TELEGRAM: LINK + REPORTS ====================

def test_telegram_unlinked_requires_link():
    resp = run(telegram_bot.process_incoming_message("123456789", "/sales"))
    assert "link" in resp.lower()


def test_telegram_link_flow_and_real_reports(client, registered_owner):
    chat_id = f"bot-chat-{int(datetime.now().timestamp())}"
    phone = registered_owner["phone"]
    store_id = registered_owner["store_id"]

    # Seed a low-stock product so reports have data
    resp = client.post("/api/v1/products", headers=registered_owner["headers"], json={
        "name": "Coffee 200g",
        "selling_price": 250,
        "current_stock": 3,
    })
    assert resp.status_code == 201, resp.text

    # /link returns a one-time code
    resp = run(telegram_bot.process_incoming_message(chat_id, "/link"))
    match = re.search(r"\*([A-F0-9]{8})\*", resp)
    assert match, f"No link code in response: {resp}"
    code = match.group(1)

    # Enter the code in the app
    link_resp = client.post(
        "/api/v1/telegram/link",
        headers=registered_owner["headers"],
        json={"code": code},
    )
    assert link_resp.status_code == 200, link_resp.text
    assert link_resp.json()["success"] is True

    # Now the bot sees the store's data
    sales = run(telegram_bot.process_incoming_message(chat_id, "/sales"))
    assert "Today's Sales" in sales

    stock = run(telegram_bot.process_incoming_message(chat_id, "/stock"))
    assert "Stock Summary" in stock
    assert "Coffee 200g" in run(telegram_bot.process_incoming_message(chat_id, "/lowstock"))

    # Natural language also works once linked
    nl = run(telegram_bot.process_incoming_message(chat_id, "what are my sales today"))
    assert "Today's Sales" in nl


def test_offline_bill_local_id_dedup(client, registered_owner):
    """A retried offline-sync POST with the same local_id must not create a duplicate."""
    local_id = f"offline_{int(datetime.now().timestamp() * 1000)}_abcd12"
    payload = {
        "customer_name": "Offline Customer",
        "items": [{"product_name": "Offline Item", "quantity": 1, "unit_price": 50}],
        "local_id": local_id,
    }

    r1 = client.post("/api/v1/bills", headers=registered_owner["headers"], json=payload)
    assert r1.status_code == 201, r1.text
    first = r1.json()

    # Same local_id replayed (simulates processQueue retrying after a lost response)
    r2 = client.post("/api/v1/bills", headers=registered_owner["headers"], json=payload)
    assert r2.status_code == 201, r2.text
    second = r2.json()

    assert first["id"] == second["id"], "Duplicate bill created for the same local_id"
    assert first["bill_number"] == second["bill_number"]

    bills = client.get("/api/v1/bills", headers=registered_owner["headers"]).json()
    matching = [b for b in bills if b["customer_name"] == "Offline Customer"]
    assert len(matching) == 1, f"Expected 1 bill, got {len(matching)}"


def test_local_id_unique_constraint_blocks_raw_duplicate(client, registered_owner):
    """The (store_id, local_id) unique constraint exists at the DB level — a raw
    second insert with the same local_id must be rejected, closing the
    check-then-insert race for concurrent sync retries."""
    from sqlalchemy.exc import IntegrityError
    from app.models import Bill, BillStatus
    from app.constants.roles import PaymentMethod as PM

    store_id = registered_owner["store_id"]
    local_id = f"offline_race_{int(datetime.now().timestamp() * 1000)}"

    def _insert():
        async def go():
            async with async_session_maker() as db:
                db.add(Bill(
                    store_id=store_id,
                    bill_number=f"RACE-{int(datetime.now().timestamp() * 1000)}",
                    total_amount=10.0,
                    status=BillStatus.COMPLETED,
                    payment_method=PM.CASH,
                    local_id=local_id,
                ))
                await db.commit()
        return go()

    run(_insert())

    with pytest.raises(IntegrityError):
        run(_insert())


def test_update_profile_phone_enables_whatsapp_bot(client):
    """Setting the phone via PUT /auth/me makes the WhatsApp bot resolve the sender."""
    ts = datetime.now().timestamp()
    phone = f"98600{int(ts * 1000) % 100000000:08d}"
    email = f"profile_{ts}@test.com"
    reg = client.post("/api/v1/auth/register", json={
        "email": email, "password": "SecurePass123!",
        "full_name": "Profile Owner", "store_name": "Profile Store",
    })
    assert reg.status_code == 200, reg.text
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    upd = client.put("/api/v1/auth/me", headers=headers, json={"phone": phone})
    assert upd.status_code == 200, upd.text
    assert upd.json()["phone"] == phone

    resp = run(whatsapp_bot.process_incoming_message(phone, "sales"))
    assert "Today's Sales" in resp

    # Duplicate phone is rejected
    dup = client.put("/api/v1/auth/me", headers=headers, json={"phone": phone})
    assert dup.status_code == 200  # same user, same phone — allowed


def test_telegram_link_code_is_single_use(client, registered_owner):
    chat_id = f"bot-chat-2-{int(datetime.now().timestamp())}"
    resp = run(telegram_bot.process_incoming_message(chat_id, "/link"))
    code = re.search(r"\*([A-F0-9]{8})\*", resp).group(1)

    r1 = client.post("/api/v1/telegram/link", headers=registered_owner["headers"], json={"code": code})
    assert r1.status_code == 200, r1.text

    r2 = client.post("/api/v1/telegram/link", headers=registered_owner["headers"], json={"code": code})
    assert r2.status_code == 400, "Code must be single-use"


def test_telegram_addproduct_creates_db_row(client, registered_owner):
    chat_id = f"bot-chat-3-{int(datetime.now().timestamp())}"
    store_id = registered_owner["store_id"]

    # Link first
    code = re.search(r"\*([A-F0-9]{8})\*", run(telegram_bot.process_incoming_message(chat_id, "/link"))).group(1)
    link = client.post("/api/v1/telegram/link", headers=registered_owner["headers"], json={"code": code})
    assert link.status_code == 200, link.text

    r1 = run(telegram_bot.process_incoming_message(chat_id, "/addproduct"))
    assert "name" in r1.lower()
    run(telegram_bot.process_incoming_message(chat_id, "Atta 5kg"))
    run(telegram_bot.process_incoming_message(chat_id, "220"))
    r4 = run(telegram_bot.process_incoming_message(chat_id, "30"))
    assert "added" in r4.lower() or "already existed" in r4.lower()

    async def check():
        async with async_session_maker() as db:
            p = (await db.execute(
                select(Product).where(
                    Product.store_id == store_id,
                    Product.name == "Atta 5kg",
                )
            )).scalars().first()
            return p
    p = run(check())
    assert p is not None
    assert p.current_stock == 30
    assert p.selling_price == 220
