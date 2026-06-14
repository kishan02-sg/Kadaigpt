"""
KadaiGPT - Tests for AI Agent endpoints (/agents/*)
Run with: pytest tests/test_agents.py -v
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app


@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)


@pytest.fixture
def auth_headers(client):
    """Get authentication headers"""
    register_data = {
        "email": f"agent_test_{datetime.now().timestamp()}@test.com",
        "password": "testpass123",
        "full_name": "Test Owner",
        "store_name": "Test Store"
    }

    response = client.post("/api/v1/auth/register", json=register_data)

    if response.status_code == 200:
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}

    login_data = {
        "username": register_data["email"],
        "password": register_data["password"]
    }
    response = client.post("/api/v1/auth/login", data=login_data)
    token = response.json().get("access_token")
    return {"Authorization": f"Bearer {token}"}


ALL_AGENTS = ["store_manager", "inventory", "analytics", "customer", "voice", "learning"]
DEMO_AGENTS = ["customer", "voice", "learning"]
LIVE_AGENTS = ["store_manager", "inventory", "analytics"]


class TestQueryAgent:
    """Tests for POST /agents/query"""

    def test_query_requires_auth(self, client):
        response = client.post("/api/v1/agents/query", json={"message": "hi"})
        assert response.status_code == 401

    def test_unknown_agent_type(self, client, auth_headers):
        response = client.post(
            "/api/v1/agents/query",
            json={"message": "hi", "agent_type": "not_a_real_agent"},
            headers=auth_headers
        )
        assert response.status_code == 404

    @pytest.mark.parametrize("agent_type", ALL_AGENTS)
    def test_query_completes_for_every_agent(self, client, auth_headers, agent_type):
        """Regression test for the BaseAgent.run() infinite-loop fix."""
        response = client.post(
            "/api/v1/agents/query",
            json={"message": "Give me today's update", "agent_type": agent_type},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["agent"] == agent_type
        assert isinstance(data["response"], dict)
        assert data["actions_taken"] >= 1

    @pytest.mark.parametrize("agent_type", DEMO_AGENTS)
    def test_demo_agents_are_labeled(self, client, auth_headers, agent_type):
        response = client.post(
            "/api/v1/agents/query",
            json={"message": "Give me today's update", "agent_type": agent_type},
            headers=auth_headers
        )
        assert response.status_code == 200
        result = response.json()["response"]
        assert result.get("is_demo") is True
        assert "demo_note" in result

    @pytest.mark.parametrize("agent_type", LIVE_AGENTS)
    def test_live_agents_are_not_labeled_demo(self, client, auth_headers, agent_type):
        response = client.post(
            "/api/v1/agents/query",
            json={"message": "Give me today's update", "agent_type": agent_type},
            headers=auth_headers
        )
        assert response.status_code == 200
        result = response.json()["response"]
        assert "is_demo" not in result


class TestSuggestions:
    """Tests for GET /agents/suggestions"""

    def test_suggestions_requires_auth(self, client):
        response = client.get("/api/v1/agents/suggestions")
        assert response.status_code == 401

    def test_suggestions_for_new_store(self, client, auth_headers):
        response = client.get("/api/v1/agents/suggestions", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["suggestions"], list)
        assert data["count"] == len(data["suggestions"])


class TestInventoryAnalysis:
    """Tests for GET /agents/inventory/analysis"""

    def test_inventory_analysis_requires_auth(self, client):
        response = client.get("/api/v1/agents/inventory/analysis")
        assert response.status_code == 401

    def test_inventory_analysis_empty_store(self, client, auth_headers):
        response = client.get("/api/v1/agents/inventory/analysis", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["stock_analysis"]["analysis"]["total_products"] == 0
        assert data["stock_analysis"]["overall_health"] == "good"
        assert data["summary"]["health_score"] == 100
        assert data["summary"]["requires_immediate_action"] is False

    def test_inventory_analysis_flags_low_stock(self, client, auth_headers):
        product = {
            "name": "Low Stock Item",
            "sku": f"LOW-{datetime.now().timestamp()}",
            "selling_price": 50,
            "current_stock": 1,
            "min_stock_alert": 10,
            "unit": "pieces"
        }
        create_response = client.post("/api/v1/products", json=product, headers=auth_headers)
        assert create_response.status_code == 201

        response = client.get("/api/v1/agents/inventory/analysis", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        analysis = data["stock_analysis"]["analysis"]
        assert analysis["categories"]["critical"] >= 1
        assert analysis["critical_items"][0]["urgency"] == "high"
        assert data["stock_analysis"]["overall_health"] == "needs_attention"
        assert data["summary"]["requires_immediate_action"] is True


class TestAnalyticsInsights:
    """Tests for GET /agents/analytics/insights"""

    def test_insights_requires_auth(self, client):
        response = client.get("/api/v1/agents/analytics/insights")
        assert response.status_code == 401

    def test_insights_empty_store(self, client, auth_headers):
        response = client.get("/api/v1/agents/analytics/insights", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["insights"], list)
        assert len(data["insights"]) >= 1


class TestAnalyticsForecast:
    """Tests for GET /agents/analytics/forecast"""

    def test_forecast_requires_auth(self, client):
        response = client.get("/api/v1/agents/analytics/forecast")
        assert response.status_code == 401

    def test_forecast_empty_store_returns_note(self, client, auth_headers):
        response = client.get("/api/v1/agents/analytics/forecast", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["predictions"] == []
        assert "note" in data


class TestAgentStatus:
    """Tests for GET /agents/status"""

    def test_status_requires_auth(self, client):
        response = client.get("/api/v1/agents/status")
        assert response.status_code == 401

    def test_status_lists_all_agents_with_demo_flags(self, client, auth_headers):
        response = client.get("/api/v1/agents/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["agent_count"] == len(data["agents"])
        for name in LIVE_AGENTS:
            assert data["agents"][name]["is_demo"] is False
        for name in DEMO_AGENTS + ["workflow"]:
            assert data["agents"][name]["is_demo"] is True


class TestAnalyticsTrends:
    """Tests for GET /agents/analytics/trends"""

    def test_trends_requires_auth(self, client):
        response = client.get("/api/v1/agents/analytics/trends")
        assert response.status_code == 401

    def test_trends_empty_store_returns_note(self, client, auth_headers):
        response = client.get("/api/v1/agents/analytics/trends", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["trend"] == {}
        assert data["weekly_pattern"] == {}
        assert "note" in data


class TestAnalyticsAnomalies:
    """Tests for GET /agents/analytics/anomalies"""

    def test_anomalies_requires_auth(self, client):
        response = client.get("/api/v1/agents/analytics/anomalies")
        assert response.status_code == 401

    def test_anomalies_empty_store_returns_note(self, client, auth_headers):
        response = client.get("/api/v1/agents/analytics/anomalies", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["anomalies_found"] == 0
        assert data["anomalies"] == []
        assert "recommendation" in data


class TestCustomerSegments:
    """Tests for GET /agents/analytics/customers/segments"""

    def test_segments_requires_auth(self, client):
        response = client.get("/api/v1/agents/analytics/customers/segments")
        assert response.status_code == 401

    def test_segments_empty_store(self, client, auth_headers):
        response = client.get("/api/v1/agents/analytics/customers/segments", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total_customers"] == 0
        assert data["segments"] == []
        assert "note" in data


class TestWhatIf:
    """Tests for POST /agents/analytics/what-if"""

    def test_what_if_requires_auth(self, client):
        response = client.post("/api/v1/agents/analytics/what-if", json={"scenario": "test"})
        assert response.status_code == 401

    def test_what_if_unrecognized_scenario_lists_options(self, client, auth_headers):
        response = client.post(
            "/api/v1/agents/analytics/what-if",
            json={"scenario": "what is the weather today"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "available_scenarios" in data
        assert "message" in data

    def test_what_if_discount_scenario(self, client, auth_headers):
        response = client.post(
            "/api/v1/agents/analytics/what-if",
            json={"scenario": "What if I give a 20% discount?"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_estimate"] is True
        assert "predictions" in data


class TestPeakHours:
    """Tests for GET /agents/analytics/peak-hours"""

    def test_peak_hours_requires_auth(self, client):
        response = client.get("/api/v1/agents/analytics/peak-hours")
        assert response.status_code == 401

    def test_peak_hours_empty_store_returns_note(self, client, auth_headers):
        response = client.get("/api/v1/agents/analytics/peak-hours", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["hourly_breakdown"] == {}
        assert "note" in data


class TestInventoryPredictions:
    """Tests for GET /agents/inventory/predictions"""

    def test_predictions_requires_auth(self, client):
        response = client.get("/api/v1/agents/inventory/predictions")
        assert response.status_code == 401

    def test_predictions_empty_store_returns_note(self, client, auth_headers):
        response = client.get("/api/v1/agents/inventory/predictions", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["predictions"] == []
        assert data["items_needing_reorder"] == 0
        assert "note" in data


class TestInventoryReorder:
    """Tests for GET /agents/inventory/reorder"""

    def test_reorder_requires_auth(self, client):
        response = client.get("/api/v1/agents/inventory/reorder")
        assert response.status_code == 401

    def test_reorder_empty_store(self, client, auth_headers):
        response = client.get("/api/v1/agents/inventory/reorder", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total_items"] == 0

    def test_reorder_flags_low_stock_product(self, client, auth_headers):
        product = {
            "name": "Reorder Item",
            "sku": f"REORDER-{datetime.now().timestamp()}",
            "selling_price": 100,
            "cost_price": 60,
            "current_stock": 2,
            "min_stock_alert": 10,
            "unit": "pieces"
        }
        create_response = client.post("/api/v1/products", json=product, headers=auth_headers)
        assert create_response.status_code == 201

        response = client.get("/api/v1/agents/inventory/reorder", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total_items"] >= 1
        item = next(i for i in data["items"] if i["product"] == "Reorder Item")
        assert item["priority"] == "high"


class TestSlowMovers:
    """Tests for GET /agents/inventory/slow-movers"""

    def test_slow_movers_requires_auth(self, client):
        response = client.get("/api/v1/agents/inventory/slow-movers")
        assert response.status_code == 401

    def test_slow_movers_empty_store(self, client, auth_headers):
        response = client.get("/api/v1/agents/inventory/slow-movers", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["slow_movers"] == []
        assert data["action_items"] == ["No products currently in stock."]


class TestPriceOptimization:
    """Tests for GET /agents/inventory/price-optimization"""

    def test_price_optimization_requires_auth(self, client):
        response = client.get("/api/v1/agents/inventory/price-optimization")
        assert response.status_code == 401

    def test_price_optimization_empty_store(self, client, auth_headers):
        response = client.get("/api/v1/agents/inventory/price-optimization", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["suggestions"] == []
        assert "note" in data
