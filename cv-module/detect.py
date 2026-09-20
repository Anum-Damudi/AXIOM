"""
NEXUS-CRIME CV module — simple object detection.

This script loads a pretrained YOLO26n model, runs it on an image
provided through the terminal, prints each detected object's class
name and confidence, saves an annotated copy in the outputs folder,
and prints every detection as a structured JSON object.
"""

import json
import os
import sys
from pathlib import Path
from ultralytics import YOLO


# ---------------------------------------------------------------------------
# 1. Get image path from the terminal
# ---------------------------------------------------------------------------

if len(sys.argv) != 2:
    print("Usage: python detect.py <image_path>")
    print("Example: python detect.py images/test1.png")
    sys.exit(1)

image_path = Path(sys.argv[1])

# Check that the image exists
if not image_path.exists():
    print(f"Error: Image not found: {image_path}")
    sys.exit(1)

# ---------------------------------------------------------------------------
# 2. Set up output folder
# ---------------------------------------------------------------------------

output_folder = "outputs"
os.makedirs(output_folder, exist_ok=True)

# Create output filename automatically
# Example:
# test1.png → test1_detected.png
output_path = os.path.join(
    output_folder,
    f"{image_path.stem}_detected{image_path.suffix}"
)

# ---------------------------------------------------------------------------
# 3. Load the pretrained YOLO26n model
# ---------------------------------------------------------------------------

# YOLO downloads yolo26n.pt automatically the first time you run it.
model = YOLO("yolo26n.pt")

# ---------------------------------------------------------------------------
# 4. Run object detection
# ---------------------------------------------------------------------------

results = model(str(image_path))

result = results[0]

# ---------------------------------------------------------------------------
# 5. Print every detected object's class name, confidence, and bbox
# ---------------------------------------------------------------------------

print("\nDetected objects:")

detections = []

if result.boxes is None or len(result.boxes) == 0:
    print("  (none)")
else:
    for box in result.boxes:
        class_id = int(box.cls[0])
        class_name = result.names[class_id]
        confidence = float(box.conf[0])

        # xyxy coordinates in original image space (float → rounded int)
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        bbox = [round(x1), round(y1), round(x2), round(y2)]

        detection = {
            "class": class_name,
            "confidence": round(confidence, 2),
            "bbox": bbox,
        }
        detections.append(detection)

        print(f"  {class_name}: {confidence:.2f}")

print("\nStructured detections:")
print(json.dumps(detections, indent=2))

# ---------------------------------------------------------------------------
# 6. Save annotated image
# ---------------------------------------------------------------------------

result.save(filename=output_path)

print(f"\nSaved annotated image to: {output_path}")