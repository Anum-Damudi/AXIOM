def test_graph_endpoints(client, auth_headers):
    # Full Graph
    graph_resp = client.get("/api/v1/graph", headers=auth_headers)
    assert graph_resp.status_code == 200
    assert graph_resp.json()["success"] is True
    assert "nodes" in graph_resp.json()["data"]
    assert "edges" in graph_resp.json()["data"]

    # Case Subgraph
    subgraph_resp = client.get("/api/v1/cases/C001/network", headers=auth_headers)
    assert subgraph_resp.status_code == 200
    assert subgraph_resp.json()["success"] is True

def test_analytics_endpoints(client, auth_headers):
    # Key Persons
    kp_resp = client.get("/api/v1/analytics/key-persons", headers=auth_headers)
    assert kp_resp.status_code == 200
    assert kp_resp.json()["success"] is True

    # Communities
    comm_resp = client.get("/api/v1/analytics/communities", headers=auth_headers)
    assert comm_resp.status_code == 200
    assert comm_resp.json()["success"] is True

    # Hidden Links
    hl_resp = client.get("/api/v1/analytics/hidden-links", headers=auth_headers)
    assert hl_resp.status_code == 200
    assert hl_resp.json()["success"] is True