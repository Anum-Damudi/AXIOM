def test_evidence_upload_and_cv(client):
    client.post("/api/v1/auth/register", json={
        "username": "ev_officer",
        "email": "ev_officer@police.gov.in",
        "password": "password123"
    })
    login_resp = client.post("/api/v1/auth/login", json={
        "username": "ev_officer",
        "password": "password123"
    })
    token = login_resp.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Upload mock image evidence using standard tuple format (filename, bytes, mime)
    files = {"file": ("crime_scene.jpg", b"fake image bytes content", "image/jpeg")}
    response = client.post(
        "/api/v1/cases/C001/evidence",
        files=files,
        headers=headers
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["case_id"] == "C001"
    assert data["analysis_status"] == "COMPLETED"
    assert data["analysis_result"] is not None
    assert "objects" in data["analysis_result"]

def test_invalid_evidence_type(client):
    client.post("/api/v1/auth/register", json={
        "username": "ev_officer2",
        "email": "ev_officer2@police.gov.in",
        "password": "password123"
    })
    login_resp = client.post("/api/v1/auth/login", json={
        "username": "ev_officer2",
        "password": "password123"
    })
    token = login_resp.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    files = {"file": ("hack.exe", b"malicious script content", "application/x-msdownload")}
    response = client.post(
        "/api/v1/cases/C001/evidence",
        files=files,
        headers=headers
    )
    assert response.status_code == 400
    assert response.json()["success"] is False
    assert response.json()["error"]["code"] == "INVALID_FILE_TYPE"
