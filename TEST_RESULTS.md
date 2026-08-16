# KadaiGPT — Test Results Report

**Generated:** 2026-06-14
**Backend:** `pytest` (117 tests, SQLite `local.db`)
**Frontend:** Playwright E2E (`tests/e2e/`)

---

## 1. Summary

| Suite | Total | Passed | Failed | Pass Rate |
|---|---|---|---|---|
| Backend `pytest` (`backend/tests/`) | 117 | **117** | **0** | 100% |
| Frontend `staff-rbac.spec.js` (NEW) | 4 | **4** | 0 | 100% |
| Frontend other specs (`auth`, `billing`, `navigation`, `manual-walkthrough`) | 19 | not executed this run | — | — |

---

## 2. Backend — `pytest tests/` (117 passed, 0 failed)

### ✅ `tests/test_analytics.py` — 17/17 PASSED
| # | Test | Result |
|---|---|---|
| 1 | TestSalesAnalytics::test_sales_overview_unauthorized | ✅ PASS |
| 2 | TestSalesAnalytics::test_sales_overview_default_period | ✅ PASS |
| 3 | TestSalesAnalytics::test_sales_overview_week_period | ✅ PASS |
| 4 | TestSalesAnalytics::test_sales_overview_day_period | ✅ PASS |
| 5 | TestSalesAnalytics::test_hourly_sales | ✅ PASS |
| 6 | TestSalesAnalytics::test_sales_by_payment | ✅ PASS |
| 7 | TestProductAnalytics::test_top_selling_products | ✅ PASS |
| 8 | TestProductAnalytics::test_top_selling_with_limit | ✅ PASS |
| 9 | TestProductAnalytics::test_slow_moving_products | ✅ PASS |
| 10 | TestProductAnalytics::test_category_performance | ✅ PASS |
| 11 | TestCustomerAnalytics::test_customer_overview | ✅ PASS |
| 12 | TestCustomerAnalytics::test_customer_retention | ✅ PASS |
| 13 | TestInventoryAnalytics::test_inventory_health | ✅ PASS |
| 14 | TestInventoryAnalytics::test_inventory_predictions | ✅ PASS |
| 15 | TestFinancialAnalytics::test_profit_loss | ✅ PASS |
| 16 | TestFinancialAnalytics::test_cashflow | ✅ PASS |
| 17 | TestReports::test_summary_report | ✅ PASS |

### ✅ `tests/test_auth.py` — 13/13 PASSED
| # | Test | Result |
|---|---|---|
| 1 | TestRegistration::test_register_success | ✅ PASS |
| 2 | TestRegistration::test_register_invalid_email | ✅ PASS |
| 3 | TestRegistration::test_register_weak_password | ✅ PASS |
| 4 | TestRegistration::test_register_duplicate_email | ✅ PASS |
| 5 | TestRegistration::test_register_missing_fields | ✅ PASS |
| 6 | TestLogin::test_login_success | ✅ PASS |
| 7 | TestLogin::test_login_wrong_password | ✅ PASS |
| 8 | TestLogin::test_login_nonexistent_user | ✅ PASS |
| 9 | TestLogin::test_login_missing_fields | ✅ PASS |
| 10 | TestCurrentUser::test_get_current_user_success | ✅ PASS |
| 11 | TestCurrentUser::test_get_current_user_no_token | ✅ PASS |
| 12 | TestCurrentUser::test_get_current_user_invalid_token | ✅ PASS |
| 13 | TestCurrentUser::test_get_current_user_malformed_header | ✅ PASS |

### ✅ `tests/test_bills.py` — 9/9 PASSED
| # | Test | Result | Reason |
|---|---|---|---|
| 1 | TestListBills::test_list_bills_unauthorized | ✅ PASS | — |
| 2 | TestListBills::test_list_bills_success | ✅ PASS | — |
| 3 | TestListBills::test_list_bills_with_date_filter | ✅ PASS | — |
| 4 | TestListBills::test_list_bills_with_payment_filter | ✅ PASS | — |
| 5 | TestCreateBill::test_create_bill_success | ✅ PASS | Fixed: test now asserts `201 Created` (the endpoint's correct status code) |
| 6 | TestCreateBill::test_create_bill_unauthorized | ✅ PASS | — |
| 7 | TestCreateBill::test_create_bill_empty_items | ✅ PASS | — |
| 8 | TestCreateBill::test_create_bill_with_discount | ✅ PASS | Fixed: test now asserts `201 Created` |
| 9 | TestCreateBill::test_create_bill_credit_payment | ✅ PASS | Fixed: test now asserts `201 Created` |
| 10 | TestGetBill::test_get_bill_success | ✅ PASS | Fixed: `GET /bills/{id}` now eager-loads `Bill.items` via `selectinload` instead of assigning to the relationship post-query, avoiding `MissingGreenlet` |
| 11 | TestGetBill::test_get_nonexistent_bill | ✅ PASS | — |
| 12 | TestBillStatistics::test_get_today_stats | ✅ PASS | Fixed: test now checks for the actual response key `todaySales` (camelCase API contract) |
| 13 | TestPrintBill::test_print_preview | ✅ PASS | — |

### ✅ `tests/test_integration.py` — 9/9 PASSED
| # | Test | Result | Reason |
|---|---|---|---|
| 1 | TestCompleteUserFlow::test_new_user_onboarding | ✅ PASS | Fixed: product-creation payload updated to real `ProductCreate` fields (`selling_price`, `current_stock`); bill-creation assertion updated to `201` |
| 2 | TestBillingFlow::test_create_cash_bill | ✅ PASS | Fixed: test now asserts `201 Created` |
| 3 | TestBillingFlow::test_create_upi_bill | ✅ PASS | Fixed: test now asserts `201 Created` |
| 4 | TestBillingFlow::test_create_credit_bill | ✅ PASS | Fixed: test now asserts `201 Created` (was a 201-vs-200 mismatch, not a validation error) |
| 5 | TestInventoryFlow::test_add_and_sell_product | ✅ PASS | Fixed: product-creation payload updated to real `ProductCreate` fields (`selling_price`, `current_stock`, `min_stock_alert`); assertion updated to `201` |
| 6 | TestCustomerFlow::test_customer_credit_cycle | ✅ PASS | Fixed: bill-creation assertion updated to `201` (customer-creation stays `200`, which matches the endpoint's actual default) |
| 7 | TestAnalyticsFlow::test_full_analytics_report | ✅ PASS | — |
| 8 | TestBulkOperationsFlow::test_export_import_cycle | ✅ PASS | — |
| 9 | TestBulkOperationsFlow::test_backup_restore | ✅ PASS | Fixed: `get_current_user` now LEFT JOINs `stores` and populates `store_name` on the `SimpleNamespace`, so `bulk.py:304` (`current_user.store_name`) no longer raises `AttributeError` |

### ✅ `tests/test_notifications.py` — 8/8 PASSED
| # | Test | Result | Reason |
|---|---|---|---|
| 1 | TestEmailSettings::test_get_email_settings_unauthorized | ✅ PASS | — |
| 2 | TestEmailSettings::test_get_email_settings | ✅ PASS | — |
| 3 | TestEmailSettings::test_update_email_settings | ✅ PASS | — |
| 4 | TestEmailSending::test_send_test_email | ✅ PASS | Fixed: same `get_current_user` / `store_name` fix as `test_backup_restore` — `notifications.py:108/126` (`current_user.store_name or "Your Store"`) no longer raises `AttributeError` |
| 5 | TestEmailSending::test_send_daily_summary_no_email | ✅ PASS | — |
| 6 | TestNotificationHistory::test_get_notification_history | ✅ PASS | — |
| 7 | TestNotificationHistory::test_get_notification_history_with_limit | ✅ PASS | — |
| 8 | TestNotificationStatus::test_get_notification_status | ✅ PASS | — |

### ✅ `tests/test_products.py` — 14/14 PASSED
| # | Test | Result | Reason |
|---|---|---|---|
| 1 | TestListProducts::test_list_products_unauthorized | ✅ PASS | — |
| 2 | TestListProducts::test_list_products_success | ✅ PASS | — |
| 3 | TestListProducts::test_list_products_with_category_filter | ✅ PASS | — |
| 4 | TestListProducts::test_list_products_with_search | ✅ PASS | — |
| 5 | TestCreateProduct::test_create_product_success | ✅ PASS | Fixed: payload updated to real `ProductCreate` fields (`selling_price`, `current_stock`, dropped string `category`); assertions updated to `201` and `data["selling_price"]` |
| 6 | TestCreateProduct::test_create_product_unauthorized | ✅ PASS | — |
| 7 | TestCreateProduct::test_create_product_invalid_price | ✅ PASS | — |
| 8 | TestCreateProduct::test_create_product_missing_name | ✅ PASS | — |
| 9 | TestUpdateProduct::test_update_product_success | ✅ PASS | — |
| 10 | TestUpdateProduct::test_update_nonexistent_product | ✅ PASS | — |
| 11 | TestDeleteProduct::test_delete_product_success | ✅ PASS | — |
| 12 | TestDeleteProduct::test_delete_nonexistent_product | ✅ PASS | — |
| 13 | TestProductCategories::test_get_categories | ✅ PASS | — |
| 14 | TestLowStockProducts::test_get_low_stock | ✅ PASS | — |

### ✅ `tests/test_rbac.py` — 19/19 PASSED *(NEW — this engagement)*
| # | Test | Result |
|---|---|---|
| 1 | TestCreateStaffAllRoles::test_create_staff_success[manager] | ✅ PASS |
| 2 | TestCreateStaffAllRoles::test_create_staff_success[cashier] | ✅ PASS |
| 3 | TestCreateStaffAllRoles::test_create_staff_success[inventory_manager] | ✅ PASS |
| 4 | TestCreateStaffAllRoles::test_create_staff_invalid_role | ✅ PASS |
| 5 | TestCreateStaffAllRoles::test_create_staff_unauthenticated | ✅ PASS |
| 6 | TestManagerCannotCreateManager::test_manager_cannot_create_manager | ✅ PASS |
| 7 | TestManagerCannotCreateManager::test_manager_can_create_cashier_and_inventory_manager | ✅ PASS |
| 8 | TestStaffLoginAllRoles::test_staff_login_success[manager] | ✅ PASS |
| 9 | TestStaffLoginAllRoles::test_staff_login_success[cashier] | ✅ PASS |
| 10 | TestStaffLoginAllRoles::test_staff_login_success[inventory_manager] | ✅ PASS |
| 11 | TestStaffLoginAllRoles::test_staff_login_wrong_password | ✅ PASS |
| 12 | TestStaffLoginAllRoles::test_staff_login_nonexistent_staff_id | ✅ PASS |
| 13 | TestRoleGatedEndpoints::test_cashier_cannot_create_category | ✅ PASS |
| 14 | TestRoleGatedEndpoints::test_inventory_manager_can_create_category | ✅ PASS |
| 15 | TestRoleGatedEndpoints::test_staff_below_manager_cannot_view_sales_overview[cashier] | ✅ PASS |
| 16 | TestRoleGatedEndpoints::test_staff_below_manager_cannot_view_sales_overview[inventory_manager] | ✅ PASS |
| 17 | TestRoleGatedEndpoints::test_manager_can_view_sales_overview | ✅ PASS |
| 18 | TestRoleGatedEndpoints::test_any_staff_can_view_hourly_sales[cashier] | ✅ PASS |
| 19 | TestRoleGatedEndpoints::test_any_staff_can_view_hourly_sales[inventory_manager] | ✅ PASS |

### ✅ `tests/test_security.py` — 24/24 PASSED
| # | Test | Result |
|---|---|---|
| 1 | TestRateLimiter::test_rate_limiter_allows_initial_requests | ✅ PASS |
| 2 | TestRateLimiter::test_rate_limiter_blocks_excess_requests | ✅ PASS |
| 3 | TestRateLimiter::test_rate_limiter_separate_keys | ✅ PASS |
| 4 | TestRateLimiter::test_block_and_unblock | ✅ PASS |
| 5 | TestInputSanitizer::test_sql_injection_detection | ✅ PASS |
| 6 | TestInputSanitizer::test_safe_input_passes_sql_check | ✅ PASS |
| 7 | TestInputSanitizer::test_xss_detection | ✅ PASS |
| 8 | TestInputSanitizer::test_safe_input_passes_xss_check | ✅ PASS |
| 9 | TestInputSanitizer::test_path_traversal_detection | ✅ PASS |
| 10 | TestInputSanitizer::test_sanitize_string | ✅ PASS |
| 11 | TestInputSanitizer::test_sanitize_truncates_long_strings | ✅ PASS |
| 12 | TestAuditLogger::test_log_event | ✅ PASS |
| 13 | TestAuditLogger::test_mask_sensitive_data | ✅ PASS |
| 14 | TestAuditLogger::test_filter_by_user_id | ✅ PASS |
| 15 | TestAuditLogger::test_filter_by_event_type | ✅ PASS |
| 16 | TestValidators::test_valid_gstin | ✅ PASS |
| 17 | TestValidators::test_invalid_gstin | ✅ PASS |
| 18 | TestValidators::test_valid_phone | ✅ PASS |
| 19 | TestValidators::test_invalid_phone | ✅ PASS |
| 20 | TestValidators::test_valid_email | ✅ PASS |
| 21 | TestValidators::test_invalid_email | ✅ PASS |
| 22 | TestSecureToken::test_token_generation | ✅ PASS |
| 23 | TestSecureToken::test_token_uniqueness | ✅ PASS |
| 24 | TestSecureToken::test_token_length | ✅ PASS |

---

## 3. Frontend — Playwright E2E

### ✅ `tests/e2e/staff-rbac.spec.js` — 4/4 PASSED *(NEW — this engagement, 6.5 min)*
| # | Test | Result | Notes |
|---|---|---|---|
| 1 | Owner registers and creates staff for all 3 roles | ✅ PASS | Created manager, cashier, inventory_manager staff accounts; verified `KDG-` staff IDs + temp passwords generated |
| 2 | Staff login as manager shows correct role-based nav | ✅ PASS | Nav shows: Dashboard, New Bill, Bills, Products, Customers, Staff; correctly hides Loyalty, Suppliers, Import/Export |
| 3 | Staff login as cashier shows correct role-based nav | ✅ PASS | Nav shows: New Bill, Bills, Products, Customers, Loyalty; correctly hides Dashboard, Staff, Suppliers, Import/Export, Analytics |
| 4 | Staff login as inventory_manager shows correct role-based nav | ✅ PASS | Nav shows: Dashboard, Products, Suppliers, Import/Export, Analytics; correctly hides Staff, New Bill, Bills, Customers, Loyalty |

### ⏸️ Other E2E specs — not executed in this run
These are existing specs with no regressions known from prior runs; not re-executed in this report cycle (each registers/logs in and would need rate-limit spacing similar to `staff-rbac.spec.js`). Listed here for completeness of the test inventory:

**`tests/e2e/auth.spec.js`** (4 tests)
1. should show login page when not authenticated
2. should login with demo mode
3. should show error for invalid credentials
4. should logout successfully

**`tests/e2e/billing.spec.js`** (3 tests)
1. should navigate to create bill page
2. should display bills list page
3. should navigate between pages without errors

**`tests/e2e/navigation.spec.js`** (10 tests)
1. should render dashboard on load
2. should navigate via hash routing
3. should show online/offline status indicator
4. should open command palette with Ctrl+K
5. should display notification bell
6. should handle all route transitions smoothly
7. should have manifest.json
8. should register service worker
9. should have focus-visible styles
10. should use semantic HTML headings

**`tests/e2e/manual-walkthrough.spec.js`** (2 tests)
1. Full shopkeeper walkthrough
2. Mobile viewport walkthrough

---

## 4. Root Causes — 14 Backend Failures (Pre-existing, unrelated to RBAC work) — ALL FIXED

| Root Cause | Affected Tests | Fix Applied |
|---|---|---|
| **Status code 201 vs 200** — bill/product creation endpoints correctly return `201 Created`, but tests asserted `200 OK` | `test_bills.py` (3), `test_integration.py` (4) | Updated test assertions to expect `201` (endpoints' status codes were left unchanged — they're correct REST semantics) |
| **Status code 422 vs 200** — request validation rejected payloads tests sent (schema mismatch) | `test_integration.py` (2), `test_products.py` (1) | Updated test payloads to match `ProductCreate`/`ProductBase` (`selling_price`, `current_stock`, `min_stock_alert`; dropped non-existent `price`/`stock`/`category` string field) and updated response-field assertions accordingly |
| **`MissingGreenlet` / async lazy-load** — `bill.items` relationship was reassigned after the initial query, triggering an unawaited lazy-load on the existing collection | `test_bills.py::test_get_bill_success` | `app/routers/bills.py::get_bill` now uses `select(Bill).options(selectinload(Bill.items))` and returns `bill` directly — no post-query relationship assignment |
| **camelCase vs snake_case** — stats endpoint returns `todaySales`/`todayBills`, test expected `today_sales`/`total_sales` | `test_bills.py::test_get_today_stats` | Updated test assertion to check for `"todaySales"` (the real, frontend-consumed API contract — left unchanged) |
| **`SimpleNamespace.store_name` AttributeError** — `get_current_user`'s lightweight raw-SQL user object had no `store_name`, but `bulk.py:304` and `notifications.py:108/126` read `current_user.store_name` | `test_integration.py::test_backup_restore`, `test_notifications.py::test_send_test_email` | `app/routers/auth.py::get_current_user` now does `LEFT JOIN stores s ON s.id = u.store_id` and adds `store_name=row.get("store_name")` to the `SimpleNamespace` — fixes both call sites (and any future ones) from a single change point |

---

## 5. Notes

- Backend suite run via: `DATABASE_URL=sqlite+aiosqlite:///./local.db python -m pytest tests/ -v` (with `PYTHONIOENCODING=utf-8` on Windows)
- `backend/tests/conftest.py` provides autouse fixtures for DB init and rate-limiter reset, ensuring RBAC tests don't collide with FastAPI's shared `TestClient` rate-limit bucket
- All 14 previously-failing backend tests were **pre-existing failures** (not introduced by the RBAC work). All 14 are now fixed; the full suite is **117/117 passing (100%)**, including all 19 `test_rbac.py` tests, with no regressions to the previously-passing 103 tests
- `staff-rbac.spec.js` discovered and worked around a real rate-limiting interaction (React `<StrictMode>` double-invoking `GET /auth/staff/list` on `StaffManagement` mount + post-create refresh) — documented in the spec's header comment
