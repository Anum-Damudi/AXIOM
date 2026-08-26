import argparse
import json

from nlp.pipeline import NLPPipeline


def main():
    parser = argparse.ArgumentParser(description="Run AXIOM NLP extraction pipeline")
    parser.add_argument(
        "--output",
        default=None,
        help="Path to write extraction results (default: nlp_output/extractions.json)",
    )
    args = parser.parse_args()

    pipeline = NLPPipeline()
    results = pipeline.run()

    out_path = args.output or pipeline.save(results)
    if args.output:
        pipeline.save(results, args.output)
        out_path = args.output

    total_entities = sum(len(r["entities"]) for r in results)
    total_relations = sum(len(r["relations"]) for r in results)
    print(f"Processed {len(results)} reports")
    print(f"Entities extracted: {total_entities}")
    print(f"Relations extracted: {total_relations}")
    print(f"Results saved to: {out_path}")

    print("\nSample (C001):")
    sample = next(r for r in results if r["case_id"] == "C001")
    print(json.dumps(sample, indent=2))


if __name__ == "__main__":
    main()
