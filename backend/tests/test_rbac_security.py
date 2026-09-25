"""Security / RBAC enforcement tests for the AXIOM backend."""

import pytest
import tempfile
import os
import uuid


def _register_and_login(client, role="INVESTIGATOR"):
    suffix = uuid.uuid4().hex[:8]
    username = f"rbac_{suffix}"
    client.post("/api/v1/auth/register", json={
        "username": username,
        "email": f"{username}@police.gov.in",
        "password": "rbac_password_123",
        "role": role,
    })
    resp = client.post("/api/v1/auth/login", json={
        "username": username,
        "password": "rbac_password_123",
    })
    token = resp.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_register_cannot_escalate_to_admin(client):
    resp = client.post("/api/v1/auth/register", json={
        "username": "wannabe_admin",
        "email": "wannabe_admin@police.gov.in",
        "password": "password_123",
        "role": "ADMIN",
    })
    assert resp.status_code == 422  # schema validation rejects ADMIN on public register


def test_officer_cannot_write(client):
    officer = _register_and_login(client, "OFFICER")
    investigator = _register_and_login(client, "INVESTIGATOR")

    # Read is allowed for officers
    resp = client.get("/api/v1/cases", headers=officer)
    assert resp.status_code == 200

    # Writes are forbidden
    resp = client.post("/api/v1/cases", json={
        "title": "Officer must not create", "status": "open", "date": "2026-01-01",
    }, headers=officer)
    assert resp.status_code == 403

    resp = client.post("/api/v1/people", json={"name": "Oscar Officer"}, headers=officer)
    assert resp.status_code == 403

    # Same operations succeed for investigators
    resp = client.post("/api/v1/cases", json={
        "title": "Investigator can create", "status": "open", "date": "2026-01-01",
    }, headers=investigator)
    assert resp.status_code == 201

    assert investigator is not None


def test_endpoints_require_authentication(client):
    assert client.get("/api/v1/cases").status_code == 401
    assert client.get("/api/v1/phones/+919876543210/profile").status_code == 401
    assert client.get("/api/v1/graph").status_code == 401
    assert client.get("/api/v1/audit-logs").status_code == 401


def test_user_management_admin_only(client):
    officer = _register_and_login(client, "OFFICER")
    admin = _register_and_login(client, "INVESTIGATOR")

    assert client.get("/api/v1/users", headers=officer).status_code == 403
    # Non-admin cannot list users even when authenticated
    assert client.get("/api/v1/users", headers=admin).status_code == 403


def test_cdr_import_requires_existing_case(client, auth_headers):
    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
        f.write("caller_number,called_number,start_time\n+919800000001,+919800000002,2026-01-01 10:00:00\n")
        path = f.name
    try:
        with open(path, "rb") as blob:
            resp = client.post(
                "/api/v1/cases/CASE-DOES-NOT-EXIST/cdr/import",
                files={"file": ("cdr.csv", blob, "text/csv")},
                headers=auth_headers,
            )
        assert resp.status_code == 404
        assert resp.json()["error"]["code"] == "CASE_NOT_FOUND"
    finally:
        os.unlink(path)


def test_person_photo_upload_validation(client, auth_headers):
    # Create a person
    resp = client.post("/api/v1/people", json={"name": "Photo Suspect", "role": "suspect"}, headers=auth_headers)
    assert resp.status_code == 201
    person_id = resp.json()["data"]["id"]

    # Plain text pseudo-photo must be rejected by magic-byte validation
    resp = client.post(
        f"/api/v1/people/{person_id}/photo",
        files={"file": ("photo.jpg", b"not really an image", "image/jpeg")},
        headers=auth_headers,
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "INVALID_PHOTO_TYPE"

    # A genuine JPEG head is accepted and served from the static mount
    jpeg = b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"\x00" * 64
    resp = client.post(
        f"/api/v1/people/{person_id}/photo",
        files={"file": ("photo.jpg", jpeg, "image/jpeg")},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    photo_path = resp.json()["data"]["photo_path"]
    assert photo_path and photo_path.startswith("photos/")

    served = client.get(f"/uploads/{photo_path}")
    assert served.status_code == 200
    assert served.content == jpeg