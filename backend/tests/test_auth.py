def test_register_and_login(client):
    # 1. Register new user
    reg_payload = {
        "username": "test_officer",
        "email": "test_officer@police.gov.in",
        "password": "secure_password_123",
        "role": "OFFICER"
    }
    response = client.post("/api/v1/auth/register", json=reg_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    assert "access_token" in data["data"]
    assert data["data"]["user"]["username"] == "test_officer"

    # 2. Login with credentials
    login_payload = {
        "username": "test_officer",
        "password": "secure_password_123"
    }
    login_resp = client.post("/api/v1/auth/login", json=login_payload)
    assert login_resp.status_code == 200
    token = login_resp.json()["data"]["access_token"]

    # 3. Access protected /me endpoint
    headers = {"Authorization": f"Bearer {token}"}
    me_resp = client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["data"]["username"] == "test_officer"

def test_invalid_login(client):
    login_payload = {
        "username": "non_existent_user",
        "password": "wrong_password"
    }
    resp = client.post("/api/v1/auth/login", json=login_payload)
    assert resp.status_code == 401
    assert resp.json()["success"] is False
    assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"
