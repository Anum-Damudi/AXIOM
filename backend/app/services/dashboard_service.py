import json
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models import Case, Person, Vehicle, Location, Relationship, Evidence, AuditLog
from app.schemas.dashboard import DashboardSummary, DashboardRecentActivity, NetworkSummary
from app.services.analytics_service import AnalyticsService

class DashboardService:
    @staticmethod
    def get_summary(db: Session) -> DashboardSummary:
        total_cases = db.query(Case).count()
        active_cases = db.query(Case).filter(Case.status.in_(["open", "under investigation"])).count()
        closed_cases = db.query(Case).filter(Case.status == "closed").count()
        high_priority = db.query(Case).filter(Case.priority == "high").count()

        total_people = db.query(Person).count()
        total_vehicles = db.query(Vehicle).count()
        total_locations = db.query(Location).count()
        total_relationships = db.query(Relationship).count()
        evidence_count = db.query(Evidence).count()

        return DashboardSummary(
            total_cases=total_cases,
            active_cases=active_cases,
            closed_cases=closed_cases,
            high_priority_cases=high_priority,
            total_people=total_people,
            total_vehicles=total_vehicles,
            total_locations=total_locations,
            total_relationships=total_relationships,
            evidence_count=evidence_count
        )

    @staticmethod
    def get_recent_activity(db: Session, limit: int = 10) -> List[DashboardRecentActivity]:
        logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()
        activities = []
        for log in logs:
            details_str = ""
            if log.details:
                try:
                    parsed = json.loads(log.details)
                    details_str = str(parsed)
                except Exception:
                    details_str = log.details

            activities.append(DashboardRecentActivity(
                id=log.id,
                action=log.action,
                resource_type=log.resource_type or "system",
                resource_id=log.resource_id or "-",
                details=details_str or f"Action {log.action} executed",
                timestamp=log.timestamp.isoformat() if log.timestamp else ""
            ))
        return activities

    @staticmethod
    def get_network_summary(db: Session) -> NetworkSummary:
        total_nodes = db.query(Person).count() + db.query(Vehicle).count() + db.query(Location).count() + db.query(Case).count()
        total_edges = db.query(Relationship).count()

        key_persons = AnalyticsService.get_key_persons(db, limit=5)
        clusters = AnalyticsService.get_communities(db)

        return NetworkSummary(
            total_nodes=total_nodes,
            total_edges=total_edges,
            key_central_persons=[kp.model_dump() for kp in key_persons],
            active_clusters_count=len(clusters)
        )
