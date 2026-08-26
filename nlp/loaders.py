import json

from . import config


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_case_reports():
    return load_json(config.CASE_REPORTS_PATH)


class Gazetteer:
    def __init__(self):
        self.people = load_json(config.PEOPLE_PATH)
        self.vehicles = load_json(config.VEHICLES_PATH)
        self.locations = load_json(config.LOCATIONS_PATH)
        self._person_by_name = {p["name"]: p for p in self.people}
        self._vehicle_by_plate = {v["plate_number"]: v for v in self.vehicles}
        self._location_by_name = {l["name"]: l for l in self.locations}

    def get_person(self, name):
        return self._person_by_name.get(name)

    def get_vehicle(self, plate):
        return self._vehicle_by_plate.get(plate)

    def get_location(self, name):
        return self._location_by_name.get(name)
