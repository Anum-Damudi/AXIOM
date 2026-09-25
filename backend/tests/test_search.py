def test_unified_search(client, auth_headers):
    response = client.get("/api/v1/search?q=KA-28-EC-5040", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["query"] == "KA-28-EC-5040"
    assert "results" in data["data"]
    assert "vehicles" in data["data"]["results"]