import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from paddleocr import PaddleOCR


def _as_points(box):
    return [[float(x), float(y)] for x, y in box]


def _load_font(size: int = 16):
    for name in ("arial.ttf", "Arial.ttf", "C:\\Windows\\Fonts\\arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def save_annotated_copy(image_path: Path, texts, boxes, output_path: Path):
    with Image.open(image_path) as src:
        original_size = src.size
        annotated = src.convert("RGB") if src.mode not in ("RGB", "RGBA") else src.copy()

    draw = ImageDraw.Draw(annotated)
    font = _load_font()

    for text, box in zip(texts, boxes):
        pts = [(int(round(x)), int(round(y))) for x, y in box]
        if len(pts) < 2:
            continue
        draw.polygon(pts, outline=(0, 220, 0), width=3)

        label = str(text)
        x, y = pts[0]
        bbox = draw.textbbox((x, y), label, font=font)
        label_h = bbox[3] - bbox[1]
        label_pos = (x, max(0, y - label_h - 2))
        bg = draw.textbbox(label_pos, label, font=font)
        draw.rectangle(bg, fill=(0, 0, 0))
        draw.text(label_pos, label, fill=(255, 255, 255), font=font)

    if annotated.size != original_size:
        raise RuntimeError(
            f"Annotation changed image size from {original_size} to {annotated.size}"
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    annotated.save(output_path)
    return original_size


def main() -> None:
    parser = argparse.ArgumentParser(description="Run PaddleOCR on an image.")
    parser.add_argument("image", help="Path to the input image")
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit detections as a JSON array to stdout instead of human-readable output",
    )
    args = parser.parse_args()

    image_path = Path(args.image)
    if not image_path.is_file():
        raise SystemExit(f"Image not found: {image_path}")

    ocr = PaddleOCR(
        lang="en",
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )
    results = ocr.predict(
        str(image_path),
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
        text_det_limit_type="max",
        text_det_limit_side_len=10**9,
    )

    if not results:
        if args.json:
            print(json.dumps([]))
        else:
            print("No OCR results.")
        return

    output_path = Path("outputs") / f"{image_path.stem}_annotated{image_path.suffix}"

    for result in results:
        texts = result.get("rec_texts") or []
        scores = result.get("rec_scores") or []
        boxes = result.get("rec_polys") or []

        original_size = save_annotated_copy(image_path, texts, boxes, output_path)

        if args.json:
            # Emit a JSON array to stdout; one entry per detected text region.
            # bbox is the bounding box as [x1, y1, x2, y2] derived from the polygon.
            detections = []
            for text, score, box in zip(texts, scores, boxes):
                pts = [[float(x), float(y)] for x, y in box]
                xs = [p[0] for p in pts]
                ys = [p[1] for p in pts]
                bbox = [round(min(xs)), round(min(ys)), round(max(xs)), round(max(ys))]
                detections.append({
                    "text": str(text),
                    "confidence": round(float(score), 4),
                    "bbox": bbox,
                })
            print(json.dumps(detections))
        else:
            if not texts:
                print("No text detected.")
            else:
                print(f"Detected {len(texts)} text region(s):\n")
                for i, (text, score, box) in enumerate(zip(texts, scores, boxes), start=1):
                    print(f"{i:3}. {text}")
                    print(f"     confidence: {float(score):.4f}")
                    print(f"     bbox: {_as_points(box)}")

            print(f"\nAnnotated image saved to: {output_path.resolve()}")
            print(f"Image size (width x height): {original_size[0]} x {original_size[1]}")


if __name__ == "__main__":
    main()
