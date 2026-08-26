import os

from . import config
from .loaders import Gazetteer, load_case_reports
from .entity_extractor import EntityExtractor
from .relation_extractor import RelationExtractor


class NLPPipeline:
    def __init__(self):
        self.gazetteer = Gazetteer()
        self.entity_extractor = EntityExtractor(self.gazetteer)
        self.relation_extractor = RelationExtractor()

    def process_report(self, report):
        text = report["report_text"]
        case_id = report["case_id"]
        entities = self.entity_extractor.extract(text)
        relations = self.relation_extractor.extract(text, entities, case_id)
        return {
            "case_id": case_id,
            "text": text,
            "entities": entities,
            "relations": relations,
        }

    def run(self):
        reports = load_case_reports()
        results = [self.process_report(r) for r in reports]
        return results

    @staticmethod
    def save(results, path=config.EXTRACTIONS_OUTPUT_PATH):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        import json

        with open(path, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
        return path
