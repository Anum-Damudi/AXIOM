def test_evidence_upload_and_cv(client, auth_headers):
    # Valid JPEG magic bytes so the file-type gate passes; CV analysis runs
    # honestly (the tiny synthetic image will yield MODEL_UNAVAILABLE/FAILED,
    # never fabricated objects).
    jpeg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"\x00" * 256
    files = {"file": ("crime_scene.jpg", jpeg_bytes, "image/jpeg")}
    response = client.post(
        "/api/v1/cases/C001/evidence",
        files=files,
        headers=auth_headers
    )
    assert response.status_code == 201
    data = response.json()["data"]
    assert data["case_id"] == "C001"
    assert data["analysis_status"] in ("SKIPPED", "COMPLETED", "MODEL_UNAVAILABLE", "FAILED")
    assert data["analysis_result"] is not None

def test_invalid_evidence_type(client, auth_headers):
    files = {"file": ("hack.exe", b"malicious script content", "application/x-msdownload")}
    response = client.post(
        "/api/v1/cases/C001/evidence",
        files=files,
        headers=auth_headers
    )
    assert response.status_code == 400
    assert response.json()["success"] is False
    assert response.json()["error"]["code"] == "INVALID_FILE_TYPE"

def test_spoofed_extension_rejected(client, auth_headers):
    # Declared as image/png but magic bytes are a Windows PE header -> must be rejected.
    files = {"file": ("innocent.png", b"MZ\x90\x00" + b"\x00" * 64, "image/png")}
    response = client.post(
        "/api/v1/cases/C001/evidence",
        files=files,
        headers=auth_headers
    )
    assert response.status_code == 400
    assert response.json()["success"] is False
    assert response.json()["error"]["code"] == "INVALID_FILE_TYPE"