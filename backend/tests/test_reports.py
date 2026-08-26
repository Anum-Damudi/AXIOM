def test_report_pipeline(client):
    report_text = "Sandra Perkins met David Ward near Keithmouth on 2026-08-20 using vehicle KA-28-EC-5040."
    resp = client.post("/api/v1/cases/C001/reports", json={"report_text": report_text})
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["processing_status"] == "COMPLETED"
    assert data["nlp_output"] is not None
    assert "people" in data["nlp_output"]
