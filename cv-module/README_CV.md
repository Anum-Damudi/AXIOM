# CV Module — Backend Integration Guide

This module processes a image using:

- YOLO26n → detects objects
- PaddleOCR → detects and reads text
This JSON is the main output that the backend should use.**The backend's only job is to invoke the processor and read the JSON it writes.

The `evidence_processor.py` combines results into one JSON file.

## Structure

## Directory structure
cv-module/
├── evidence_processor.py
├── ocr.py
├── detect.py
├── yolo26n.pt
├── requirements.txt
├── evidence/
└── outputs/

Run-
From inside cv-module:
python evidence_processor.py <image_path>

Example:
python evidence_processor.py images/B023-048.png

Output-
The processor stores the result in the evidence folder-
evidence/<image_name>.json

Example:
evidence/B023-048.json

---------------

## Setup
### Prerequisites

- Python 3.10+
- PyTorch installed for your hardware (CPU or CUDA) — see step 2

### 1. Create and activate the virtual environment

```bash
cd cv-module
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate
```

### 2. Install dependencies

> **First**, install PyTorch for your hardware from
> https://pytorch.org/get-started/locally/ — the correct variant (CPU vs CUDA)
> cannot be auto-detected.

```bash
pip install -r requirements.txt
```

### 3. Verify setup

```bash
python evidence_processor.py images/B023-048.png
```
---------------
## Running the processor 
To input the image into pipeline-

```bash
python evidence_processor.py <image_path>
```

**Examples:**

```bash
python evidence_processor.py images/B023-048.png
python evidence_processor.py /absolute/path/to/scene.jpg
```
---------------------

## **Expected Output**

After successful processing, the terminal will show a summary similar to:

```text
=== Summary ===
  Objects detected : 1
  Text regions     : 6
  Evidence JSON    : .../cv-module/evidence/B023-048.json
------------------------------

How the Backend Gets the JSON

The backend should:

Pass the image path to evidence_processor.py.
Wait for processing to finish.
Read the JSON from the evidence/ folder.

----------------------------------
## Expected input
The processor accepts common image formats such as:

PNG
JPEG / JPG
BMP
TIFF
WebP

----------------------------
## Output — evidence JSON

**Location:** `cv-module/evidence/<image_stem>.json`

The stem is the filename without extension.
`images/B023-048.png` → `evidence/B023-048.json`

### Full schema

```json
{
  "evidence_id": "B023-048",
  "image": {
    "filename": "B023-048.png",
    "width": 2146,
    "height": 1308
  },
  "objects": [
    {
      "source": "YOLO26n",
      "class": "car",
      "confidence": 0.8027,
      "bbox": [662, 261, 1815, 696]
    }
  ],
  "text": [
    {
      "source": "PaddleOCR",
      "text": "KA05AB1234",
      "confidence": 0.9374,
      "bbox": [955, 55, 2097, 320]
    }
  ]
}
```