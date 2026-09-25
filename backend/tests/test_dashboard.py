def test_dashboard_endpoints(client, auth_headers):
    # Summary
    sum_resp = client.get("/api/v1/dashboard/summary", headers=auth_headers)
    assert sum_resp.status_code == 200
    assert sum_resp.json()["success"] is True
    assert "total_cases" in sum_resp.json()["data"]

    # Recent cases
    rec_cases = client.get("/api/v1/dashboard/recent-cases", headers=auth_headers)
    assert rec_cases.status_code == 200
    assert rec_cases.json()["success"] is True

    # Activity
    act_resp = client.get("/api/v1/dashboard/activity", headers=auth_headers)
    assert act_resp.status_code == 200
    assert act_resp.json()["success"] is True

    # Health (public, Neo4j may be offline -> degraded)
    health_resp = client.get("/health")
    assert health_resp.status_code == 200
    assert health_resp.json()["data"]["status"] in ("ok", "degraded")