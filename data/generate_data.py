import json
import random
from faker import Faker

fake = Faker()
random.seed(42)

NUM_PEOPLE = 50
NUM_VEHICLES = 20
NUM_LOCATIONS = 15
NUM_CASES = 20
NUM_RELATIONSHIPS = 100

# Generate People
people = []
for i in range(1, NUM_PEOPLE + 1):
    people.append({
        "id": f"P{i:03}",
        "name": fake.name(),
        "age": random.randint(18, 65),
        "role": random.choice(["suspect", "witness", "associate", "victim"])
    })

# Generate Vehicles
vehicles = []
for i in range(1, NUM_VEHICLES + 1):
    plate = f"KA-{random.randint(10,99)}-{random.choice('ABCDEFGH')}{random.choice('ABCDEFGH')}-{random.randint(1000,9999)}"
    vehicles.append({
        "id": f"V{i:03}",
        "plate_number": plate,
        "type": random.choice(["car", "bike", "van", "truck"])
    })

# Generate Locations
locations = []
for i in range(1, NUM_LOCATIONS + 1):
    locations.append({
        "id": f"L{i:03}",
        "name": fake.city(),
        "lat": float(fake.latitude()),
        "lng": float(fake.longitude())
    })

# Generate Cases
cases = []
for i in range(1, NUM_CASES + 1):
    cases.append({
        "id": f"C{i:03}",
        "title": f"Case {i}: " + fake.sentence(nb_words=4),
        "date": str(fake.date_this_year()),
        "status": random.choice(["open", "closed", "under investigation"])
    })

# Generate Relationships (connecting people to people, vehicles, locations, cases)
relationships = []
rel_types = ["MET", "CALLED", "USED", "LOCATED_AT", "INVOLVED_IN", "TRANSFERRED_MONEY_TO"]
for i in range(1, NUM_RELATIONSHIPS + 1):
    rel_type = random.choice(rel_types)
    source = random.choice(people)["id"]
    if rel_type in ["MET", "CALLED", "TRANSFERRED_MONEY_TO"]:
        target = random.choice(people)["id"]
    elif rel_type == "USED":
        target = random.choice(vehicles)["id"]
    elif rel_type == "LOCATED_AT":
        target = random.choice(locations)["id"]
    else:
        target = random.choice(cases)["id"]
    relationships.append({
        "id": f"R{i:03}",
        "source": source,
        "target": target,
        "type": rel_type,
        "date": str(fake.date_this_year())
    })

# Generate simple case report text (for NLP module to extract from)
case_reports = []
for c in cases[:10]:
    p1 = random.choice(people)
    p2 = random.choice(people)
    v = random.choice(vehicles)
    l = random.choice(locations)
    text = f"{p1['name']} met {p2['name']} near {l['name']} on {c['date']} using vehicle {v['plate_number']}."
    case_reports.append({"case_id": c["id"], "report_text": text})

# Save everything to JSON files
with open("people.json", "w") as f:
    json.dump(people, f, indent=2)
with open("vehicles.json", "w") as f:
    json.dump(vehicles, f, indent=2)
with open("locations.json", "w") as f:
    json.dump(locations, f, indent=2)
with open("cases.json", "w") as f:
    json.dump(cases, f, indent=2)
with open("relationships.json", "w") as f:
    json.dump(relationships, f, indent=2)
with open("case_reports.json", "w") as f:
    json.dump(case_reports, f, indent=2)

print("Dataset generated successfully!")
print(f"People: {len(people)}, Vehicles: {len(vehicles)}, Locations: {len(locations)}")
print(f"Cases: {len(cases)}, Relationships: {len(relationships)}, Reports: {len(case_reports)}")