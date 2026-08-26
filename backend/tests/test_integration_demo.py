import json
import pytest
from app.models import CaseReport, Relationship, Vehicle

def test_end_to_end_demo_scenario(client, db_session):
    """
    INTEGRATION & END-TO-END DEMO TEST:
    Verifies the core AXIOM demonstration pipeline:
    Case C001 -> Report Upload -> NLP Extraction -> Entity Normalization (Vehicle KA-56-ED-1949)
    -> Case C005 -> Report Upload -> NLP Extraction -> Entity Resolution (Same Vehicle KA-56-ED-1949)
    -> Neo4j Graph Sync / Cross-Case Engine -> Discovery of C005 as related case -> Explainable Lead output.
    """
    # 1. Post Report for Case C001
    rep1_text = "Kelly Howard met Joshua Brown near Michaelberg on 2026-03-20 using vehicle KA-56-ED-1949."
    resp1 = client.post("/api/v1/cases/C001/reports", json={"report_text": rep1_text})
    assert resp1.status_code == 201
    data1 = resp1.json()["data"]
    assert data1["processing_status"] == "COMPLETED"

    # Verify vehicle KA-56-ED-1949 extracted for C001
    nlp_out1 = data1["nlp_output"]
    assert any(v["plate_number"] == "KA-56-ED-1949" for v in nlp_out1["vehicles"])

    # 2. Post Report for Case C005
    rep5_text = "Heather Taylor met Teresa Reed near New Richardville on 2026-02-20 using vehicle KA-56-ED-1949."
    resp5 = client.post("/api/v1/cases/C005/reports", json={"report_text": rep5_text})
    assert resp5.status_code == 201
    data5 = resp5.json()["data"]
    assert data5["processing_status"] == "COMPLETED"

    # 3. Call Cross-Case Intelligence Endpoint for Case C001
    related_resp = client.get("/api/v1/cases/C001/related-cases")
    assert related_resp.status_code == 200
    related_data = related_resp.json()
    assert related_data["success"] is True

    related_cases = related_data["data"]
    c005_connection = next((c for c in related_cases if c["case_id"] == "C005"), None)
    
    assert c005_connection is not None, "Case C005 must be detected as related to Case C001!"
    assert c005_connection["connection_type"] in ["shared_vehicle", "shared_entity"]
    assert "KA-56-ED-1949" in c005_connection["entity_name"] or "KA-56-ED-1949" in c005_connection["provenance"]
    assert "Investigative lead detected" in c005_connection["provenance"]

    # 4. Verify Cytoscape Subgraph Endpoint for Case C001
    subgraph_resp = client.get("/api/v1/cases/C001/network")
    assert subgraph_resp.status_code == 200
    nodes = subgraph_resp.json()["data"]["nodes"]
    edges = subgraph_resp.json()["data"]["edges"]
    assert len(nodes) > 0
    assert len(edges) > 0

    # 5. Verify Dashboard Recent Activity Log contains the NLP processing actions
    act_resp = client.get("/api/v1/dashboard/activity")
    assert act_resp.status_code == 200
    activities = act_resp.json()["data"]
    assert any("NLP_REPORT_PROCESSED" in a["action"] for a in activities)
