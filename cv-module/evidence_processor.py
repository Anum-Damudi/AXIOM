"""
NEXUS-CRIME CV module — evidence processor.

Runs YOLO26n object detection and PaddleOCR on the same original image,
then saves:
  - outputs/<name>_detected.<ext>      YOLO annotated image  (existing behaviour)
  - outputs/<name>_annotated.<ext>     OCR annotated image   (existing behaviour)
  - outputs/<name>_combined.<ext>      combined overlay       (optional, always at original dims)
  - evidence/<name>.json               machine-readable results

Usage:
    python evidence_processor.py images/B023-048.png
"""

import json
import os
import subprocess
import sys
from pathlib import Path

from PIL import Image
from ultralytics import YOLO


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_image_dimensions(image_path: Path) -> tuple[int, int]:
    """Return (width, height) without modifying the image."""
    with Image.open(image_path) as img:
        return img.size  # (width, height)


def _run_yolo(model: YOLO, image_path: Path, output_folder: Path) -> list[dict]:
    """
    Run YOLO26n on image_path.
    Saves the annotated copy to output_folder/<stem>_detected<suffix>.
    Returns a list of detection dicts:
        {"source": "YOLO26n", "class": ..., "confidence": ..., "bbox": [x1,y1,x2,y2]}
    """
    results = model(str(image_path))
    result = results[0]

    # Save annotated image (preserves original dims — existing behaviour)
    yolo_output = output_folder / f"{image_path.stem}_detected{image_path.suffix}"
    result.save(filename=str(yolo_output))
    print(f"[YOLO]  Annotated image saved → {yolo_output}")

    detections = []
    if result.boxes is not None:
        for box in result.boxes:
            class_id  = int(box.cls[0])
            class_name = result.names[class_id]
            confidence = float(box.conf[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            detections.append({
                "source":     "YOLO26n",
                "class":      class_name,
                "confidence": round(confidence, 4),
                "bbox":       [round(x1), round(y1), round(x2), round(y2)],
            })

    print(f"[YOLO]  {len(detections)} object(s) detected.")
    return detections


def _run_ocr(image_path: Path, ocr_script: Path, ocr_python: Path) -> list[dict]:
    """
    Invoke ocr.py in a subprocess using the PaddleOCR venv Python.
    ocr.py resolves "outputs/" relative to its cwd, which we set to cv-module/
    so annotated images land directly in cv-module/outputs/.
    Returns a list of text dicts:
        {"source": "PaddleOCR", "text": ..., "confidence": ..., "bbox": [x1,y1,x2,y2]}
    """
    cmd = [str(ocr_python), str(ocr_script), str(image_path.resolve()), "--json"]
    proc = subprocess.run(
        cmd,
        cwd=str(ocr_script.parent),   # cv-module/ — outputs/ resolves here directly
        capture_output=True,
        text=True,
    )

    if proc.returncode != 0:
        print(f"[OCR]   WARNING — ocr.py exited with code {proc.returncode}")
        print(proc.stderr[-2000:] if proc.stderr else "(no stderr)")
        return []

    # ocr.py may emit log lines before the JSON; find the JSON array line
    json_line = ""
    for line in reversed(proc.stdout.splitlines()):
        line = line.strip()
        if line.startswith("["):
            json_line = line
            break

    if not json_line:
        print("[OCR]   No JSON output from ocr.py — no text detected.")
        return []

    raw = json.loads(json_line)
    detections = [
        {
            "source":     "PaddleOCR",
            "text":       entry["text"],
            "confidence": round(float(entry["confidence"]), 4),
            "bbox":       entry["bbox"],
        }
        for entry in raw
    ]
    print(f"[OCR]   {len(detections)} text region(s) detected.")
    return detections


def _build_combined(image_path: Path, output_path: Path,
                    yolo_output: Path, ocr_output: Path) -> None:
    """
    Overlay YOLO and OCR annotations onto a single copy of the original image.
    Falls back gracefully if either annotated image is missing.
    Always writes at original dimensions.
    """
    with Image.open(image_path) as src:
        original_size = src.size
        base = src.convert("RGBA")

    def _blend(annotated_path: Path) -> None:
        if not annotated_path.exists():
            return
        with Image.open(annotated_path) as ann:
            layer = ann.convert("RGBA").resize(original_size, Image.LANCZOS)
        # Composite: use the annotated layer where it differs from the original
        nonlocal base
        base = Image.alpha_composite(base, layer)

    _blend(yolo_output)
    _blend(ocr_output)

    combined = base.convert("RGB")
    if combined.size != original_size:
        raise RuntimeError(
            f"Combined image size mismatch: {combined.size} != {original_size}"
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    combined.save(output_path)
    print(f"[COMB]  Combined image saved    → {output_path}")


# ---------------------------------------------------------------------------
# Paths — all components now live inside cv-module/
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).parent.resolve()            # cv-module/
OCR_SCRIPT = SCRIPT_DIR / "ocr.py"                      # cv-module/ocr.py

# PaddleOCR lives in the ocr-test venv; use it to run ocr.py.
# Fall back to the current Python if that venv is not present.
_ocr_venv_python = SCRIPT_DIR.parent / "ocr-test" / ".venv" / "Scripts" / "python.exe"
OCR_PYTHON = _ocr_venv_python if _ocr_venv_python.exists() else Path(sys.executable)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: python evidence_processor.py <image_path>")
        print("Example: python evidence_processor.py images/B023-048.png")
        sys.exit(1)

    image_path = Path(sys.argv[1])
    if not image_path.exists():
        print(f"Error: Image not found: {image_path}")
        sys.exit(1)

    if not OCR_SCRIPT.exists():
        print(f"Error: OCR script not found: {OCR_SCRIPT}")
        sys.exit(1)

    # ---- folders -----------------------------------------------------------
    output_folder  = SCRIPT_DIR / "outputs"
    evidence_folder = SCRIPT_DIR / "evidence"
    output_folder.mkdir(parents=True, exist_ok=True)
    evidence_folder.mkdir(parents=True, exist_ok=True)

    # ---- image metadata ----------------------------------------------------
    width, height = _get_image_dimensions(image_path)
    print(f"\n[INFO]  Image: {image_path.name}  ({width}x{height})")

    # ---- YOLO --------------------------------------------------------------
    print("\n--- YOLO26n ---")
    model = YOLO(str(SCRIPT_DIR / "yolo26n.pt"))
    yolo_output = output_folder / f"{image_path.stem}_detected{image_path.suffix}"
    object_detections = _run_yolo(model, image_path, output_folder)

    # ---- OCR ---------------------------------------------------------------
    print("\n--- PaddleOCR ---")
    text_detections = _run_ocr(image_path, OCR_SCRIPT, OCR_PYTHON)

    # ocr.py writes its annotated image to cv-module/outputs/ directly
    # (cwd is set to SCRIPT_DIR in _run_ocr)
    ocr_dst = output_folder / f"{image_path.stem}_annotated{image_path.suffix}"
    if ocr_dst.exists():
        print(f"[OCR]   Annotated image saved   → {ocr_dst}")

    # ---- combined image ----------------------------------------------------
    print("\n--- Combined image ---")
    combined_output = output_folder / f"{image_path.stem}_combined{image_path.suffix}"
    _build_combined(image_path, combined_output, yolo_output, ocr_dst)

    # ---- evidence JSON -----------------------------------------------------
    evidence = {
        "evidence_id": image_path.stem,
        "image": {
            "filename": image_path.name,
            "width":    width,
            "height":   height,
        },
        "objects": object_detections,
        "text":    text_detections,
    }

    json_path = evidence_folder / f"{image_path.stem}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(evidence, f, indent=2, ensure_ascii=False)

    print(f"\n[JSON]  Evidence saved          → {json_path}")

    # ---- summary -----------------------------------------------------------
    print("\n=== Summary ===")
    print(f"  Objects detected : {len(object_detections)}")
    print(f"  Text regions     : {len(text_detections)}")
    print(f"  Evidence JSON    : {json_path}")
    print(f"  YOLO output      : {yolo_output}")
    print(f"  OCR output       : {ocr_dst}")
    print(f"  Combined output  : {combined_output}")


if __name__ == "__main__":
    main()
