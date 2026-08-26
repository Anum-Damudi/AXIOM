def test_case_crud_and_cross_case(client):
    # Register/login to get token
    client.post("/api/v1/auth/register", json={
        "username": "case_investigator",
        "email": "case_inv@police.gov.in",
        "password": "password123"
    })
    login_resp = client.post("/api/v1/auth/login", json={
        "username": "case_investigator",
        "password": "password123"
    })
    token = login_resp.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Case
    create_payload = {
        "title": "Test Cyber Heist Case",
        "date": "2026-08-25",
        "status": "open",
        "priority": "high",
        "case_type": "Cybercrime"
    }
    create_resp = client.post("/api/v1/cases", json=create_payload, headers=headers)
    assert create_resp.status_code == 201
    case_id = create_resp.json()["data"]["id"]

    # 2. Get Cases list
    list_resp = client.get("/api/v1/cases?status=open&page=1&limit=10")
    assert list_resp.status_code == 200
    assert list_resp.json()["success"] is True
    assert len(list_resp.json()["data"]) >= 1

    # 3. Get Case details
    detail_resp = client.get(f"/api/v1/cases/{case_id}")
    assert detail_resp.status_code == 200
    assert detail_resp.json()["data"]["title"] == "Test Cyber Heist Case"

    # 4. Update Case
    patch_resp = client.patch(f"/api/v1/cases/{case_id}", json={"status": "under investigation"}, headers=headers)
    assert patch_resp.status_code == 200
    assert patch_resp.json()["data"]["status"] == "under investigation"

    # 5. Related Cases (Cross-Case Correlation)
    rel_resp = client.get("/api/v1/cases/C001/related-cases")
    assert rel_resp.status_code == 200
    assert rel_resp.json()["success"] is True

    # 6. Delete Case
    del_resp = client.delete(f"/api/v1/cases/{case_id}", headers=headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True
