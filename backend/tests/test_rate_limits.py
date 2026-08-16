"""Rate-limit classification tests.

Read-only profile/staff lookups (GET /auth/me, GET /auth/staff/list) are not
login attempts and must not consume the 5/min auth bucket — otherwise every
page load of the app throttles real registrations/logins.
"""

from app.middleware.security import get_rate_limit_type, AUTH_READ_PATHS


def test_auth_read_paths_use_api_bucket():
    for path in AUTH_READ_PATHS:
        assert get_rate_limit_type(path, "GET") == "api", path


def test_auth_writes_use_auth_bucket():
    assert get_rate_limit_type("/api/v1/auth/register", "POST") == "auth"
    assert get_rate_limit_type("/api/v1/auth/login", "POST") == "auth"
    assert get_rate_limit_type("/api/v1/auth/staff-login", "POST") == "auth"
    assert get_rate_limit_type("/api/v1/auth/create-staff", "POST") == "auth"


def test_auth_read_wrong_method_still_counts_as_auth():
    # A POST to /auth/me is not a plain profile read (defense in depth).
    assert get_rate_limit_type("/api/v1/auth/me", "POST") == "auth"


def test_other_rates():
    assert get_rate_limit_type("/api/v1/ocr/process", "POST") == "ocr"
    assert get_rate_limit_type("/api/v1/bulk/import", "POST") == "bulk"
    assert get_rate_limit_type("/api/v1/bills", "GET") == "api"
