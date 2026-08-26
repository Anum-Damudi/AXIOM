def test_dashboard_endpoints(client):
    # Summary
    sum_resp = client.get("/api/v1/dashboard/summary")
    assert sum_resp.status_code == 200
    assert sum_resp.json()["success"] is True
    assert "total_cases" in sum_resp.json()["data"]

    # Recent cases
    rec_cases = client.get("/api/v1/dashboard/recent-cases")
    assert rec_cases.status_code == 200
    assert rec_cases.json()["success"] is True

    # Activity
    act_resp = client.get("/api/v1/dashboard/activity")
    assert act_resp.status_code == 200
    assert act_resp.json()["success"] is True

    # Health
    health_resp = client.get("/health")
    assert health_resp.status_code == 200
    assert health_resp.json()["data"]["status"] == "online"
