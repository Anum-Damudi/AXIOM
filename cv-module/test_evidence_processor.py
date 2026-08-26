"""
Test suite for evidence_processor.py.

Runs the processor against a set of images that cover every required scenario,
then verifies all 12 criteria without requiring manual filename edits between runs.

Usage (from cv-module/):
    python test_evidence_processor.py
"""

import hashlib
import json
import subprocess
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR   = Path(__file__).parent.resolve()
CV_PYTHON    = SCRIPT_DIR / ".venv" / "Scripts" / "python.exe"
PROCESSOR    = SCRIPT_DIR / "evidence_processor.py"
EVIDENCE_DIR = SCRIPT_DIR / "evidence"
OUTPUT_DIR   = SCRIPT_DIR / "outputs"

# Sibling ocr-test images (absolute so the processor can find them regardless of cwd)
OCR_IMAGES = (SCRIPT_DIR.parent / "ocr-test" / "images").resolve()

# Test matrix: (image_path, label)
# Covers: single object, multiple objects, OCR-heavy, no YOLO, no OCR, cross-folder
TEST_IMAGES = [
    # cv-module images — expected to have YOLO detections
    (SCRIPT_DIR / "images" / "B023-048.png",    "cv: single YOLO object + some OCR"),
    (SCRIPT_DIR / "images" / "B043-118.png",    "cv: YOLO detections"),
    (SCRIPT_DIR / "images" / "C005-005.png",    "cv: YOLO detections"),
    (SCRIPT_DIR / "images" / "test1.png",       "cv: test image"),
    # ocr-test images — smaller, varied content; YOLO may return 0 objects
    (OCR_IMAGES / "62.png",                     "ocr-folder: small image (503x465)"),
    (OCR_IMAGES / "Grandma'am Tbosas.jpg",      "ocr-folder: portrait JPG with apostrophe in name"),
    (OCR_IMAGES / "00067cfb-5adfaaa7.jpg",      "ocr-folder: 1280x720 JPG"),
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"
SKIP = "\033[33mSKIP\033[0m"

results: list[tuple[str, bool, str]] = []   # (check_name, passed, detail)


def check(name: str, condition: bool, detail: str = "") -> bool:
    tag = PASS if condition else FAIL
    print(f"    [{tag}] {name}" + (f" — {detail}" if detail else ""))
    results.append((name, condition, detail))
    return condition


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def image_size(path: Path) -> tuple[int, int]:
    from PIL import Image
    with Image.open(path) as img:
        return img.size  # (width, height)


def run_processor(image_path: Path, timeout: int = 300) -> tuple[int, str, str]:
    """Run evidence_processor.py on image_path. Returns (returncode, stdout, stderr)."""
    proc = subprocess.run(
        [str(CV_PYTHON), str(PROCESSOR), str(image_path)],
        cwd=str(SCRIPT_DIR),
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    return proc.returncode, proc.stdout, proc.stderr

# ---------------------------------------------------------------------------
# Section: invalid path produces clear error (criterion 11)
# ---------------------------------------------------------------------------

def test_invalid_path() -> None:
    print("\n=== [INVALID PATH] ===")
    rc, stdout, stderr = run_processor(Path("images/does_not_exist_xyz.png"))
    combined = stdout + stderr
    check("exits non-zero for missing image", rc != 0)
    check("prints 'Error' or 'not found' message",
          "error" in combined.lower() or "not found" in combined.lower(),
          repr(combined[:200]))

# ---------------------------------------------------------------------------
# Section: per-image verification (criteria 1–10, 12)
# ---------------------------------------------------------------------------

def test_image(image_path: Path, label: str) -> None:
    print(f"\n=== [{label}]  {image_path.name} ===")

    if not image_path.exists():
        print(f"    [{SKIP}] Image not found at {image_path} — skipping")
        return

    # Record original file hash and dimensions
    original_hash = file_sha256(image_path)
    orig_w, orig_h = image_size(image_path)
    print(f"    Original size: {orig_w}x{orig_h}")

    stem   = image_path.stem
    suffix = image_path.suffix

    expected_yolo     = OUTPUT_DIR  / f"{stem}_detected{suffix}"
    expected_ocr      = OUTPUT_DIR  / f"{stem}_annotated{suffix}"
    expected_combined = OUTPUT_DIR  / f"{stem}_combined{suffix}"
    expected_json     = EVIDENCE_DIR / f"{stem}.json"

    # Run the processor
    try:
        rc, stdout, stderr = run_processor(image_path)
    except subprocess.TimeoutExpired:
        check("processor completed within timeout", False, "timed out after 300 s")
        return

    if not check("processor exited 0", rc == 0,
                 f"rc={rc}\nSTDOUT:{stdout[-500:]}\nSTDERR:{stderr[-500:]}"):
        return   # no point checking outputs if it crashed

    # 1. Original image unchanged
    check("original image unchanged (hash)",
          file_sha256(image_path) == original_hash)

    # 2. YOLO annotated image exists and retains original dims
    yolo_ok = expected_yolo.exists()
    check("YOLO annotated image exists", yolo_ok)
    if yolo_ok:
        yw, yh = image_size(expected_yolo)
        check("YOLO output retains original width",  yw == orig_w, f"{yw} vs {orig_w}")
        check("YOLO output retains original height", yh == orig_h, f"{yh} vs {orig_h}")

    # 3. OCR annotated image exists and retains original dims
    ocr_ok = expected_ocr.exists()
    check("OCR annotated image exists", ocr_ok)
    if ocr_ok:
        ow, oh = image_size(expected_ocr)
        check("OCR output retains original width",  ow == orig_w, f"{ow} vs {orig_w}")
        check("OCR output retains original height", oh == orig_h, f"{oh} vs {orig_h}")

    # 4. Combined image exists and retains original dims
    comb_ok = expected_combined.exists()
    check("combined image exists", comb_ok)
    if comb_ok:
        cw, ch = image_size(expected_combined)
        check("combined output retains original width",  cw == orig_w, f"{cw} vs {orig_w}")
        check("combined output retains original height", ch == orig_h, f"{ch} vs {orig_h}")

    # 5. JSON exists
    json_ok = expected_json.exists()
    check("evidence JSON exists", json_ok)
    if not json_ok:
        return

    # 6. JSON is valid and parseable
    try:
        with open(expected_json, encoding="utf-8") as f:
            data = json.load(f)
        check("JSON is valid and parseable", True)
    except Exception as e:
        check("JSON is valid and parseable", False, str(e))
        return

    # 6. JSON top-level structure
    for field in ("evidence_id", "image", "objects", "text"):
        check(f"JSON has top-level field '{field}'", field in data)

    img_meta = data.get("image", {})
    check("image.filename present", "filename" in img_meta)
    check("image.width matches original",  img_meta.get("width")  == orig_w,
          f"{img_meta.get('width')} vs {orig_w}")
    check("image.height matches original", img_meta.get("height") == orig_h,
          f"{img_meta.get('height')} vs {orig_h}")

    # 7. YOLO detections structure
    objects = data.get("objects", [])
    check("objects is a list ([] when empty)", isinstance(objects, list))
    for i, obj in enumerate(objects):
        for field in ("source", "class", "confidence", "bbox"):
            check(f"objects[{i}] has '{field}'", field in obj)
        if "source" in obj:
            check(f"objects[{i}].source == 'YOLO26n'", obj["source"] == "YOLO26n",
                  obj.get("source"))
        if "bbox" in obj:
            bb = obj["bbox"]
            check(f"objects[{i}].bbox is [x1,y1,x2,y2] list of 4",
                  isinstance(bb, list) and len(bb) == 4)
            # 9. Coordinates relative to original image
            check(f"objects[{i}].bbox within image bounds",
                  0 <= bb[0] <= orig_w and 0 <= bb[2] <= orig_w and
                  0 <= bb[1] <= orig_h and 0 <= bb[3] <= orig_h,
                  str(bb))
        if "confidence" in obj:
            check(f"objects[{i}].confidence in [0,1]",
                  0.0 <= float(obj["confidence"]) <= 1.0)

    # 8. OCR detections structure
    texts = data.get("text", [])
    check("text is a list ([] when empty)", isinstance(texts, list))
    for i, t in enumerate(texts):
        for field in ("source", "text", "confidence", "bbox"):
            check(f"text[{i}] has '{field}'", field in t)
        if "source" in t:
            check(f"text[{i}].source == 'PaddleOCR'", t["source"] == "PaddleOCR",
                  t.get("source"))
        if "bbox" in t:
            bb = t["bbox"]
            check(f"text[{i}].bbox is [x1,y1,x2,y2] list of 4",
                  isinstance(bb, list) and len(bb) == 4)
            # 9. Coordinates relative to original image
            check(f"text[{i}].bbox within image bounds",
                  0 <= bb[0] <= orig_w and 0 <= bb[2] <= orig_w and
                  0 <= bb[1] <= orig_h and 0 <= bb[3] <= orig_h,
                  str(bb))
        if "confidence" in t:
            check(f"text[{i}].confidence in [0,1]",
                  0.0 <= float(t["confidence"]) <= 1.0)

    # 10. Empty detections produce [] not error (implicit from above list checks,
    #     but also verify the processor didn't crash when counts are zero)
    if len(objects) == 0:
        check("zero YOLO detections → objects == []", objects == [])
    if len(texts) == 0:
        check("zero OCR detections → text == []", texts == [])

    # 12. No backend/API/DB code introduced (static check on processor source)
    src = PROCESSOR.read_text(encoding="utf-8").lower()
    forbidden = ("flask", "fastapi", "django", "sqlalchemy", "psycopg",
                 "pymongo", "requests.post", "http.server", "socket.bind")
    for kw in forbidden:
        check(f"processor source does not contain '{kw}'", kw not in src)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("=" * 65)
    print("  CV Evidence Processor — Test Suite")
    print("=" * 65)

    test_invalid_path()

    for image_path, label in TEST_IMAGES:
        test_image(image_path, label)

    # Final summary
    total  = len(results)
    passed = sum(1 for _, ok, _ in results if ok)
    failed = total - passed

    print("\n" + "=" * 65)
    print(f"  RESULTS:  {passed}/{total} passed   |   {failed} failed")
    print("=" * 65)

    if failed:
        print("\nFailed checks:")
        for name, ok, detail in results:
            if not ok:
                print(f"  FAIL  {name}" + (f" — {detail}" if detail else ""))
        sys.exit(1)
    else:
        print("\nAll checks passed.")
        sys.exit(0)


if __name__ == "__main__":
    main()
