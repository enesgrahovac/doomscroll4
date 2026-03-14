#!/usr/bin/env python3
"""
Doomscroll4 — Prompt classification test harness.

Loads tweet fixtures, runs them through the Anthropic API with the classification prompt,
and compares results against expected actions for each goal type.

Usage:
    python scripts/test_classify.py --prompt prompts/v1_classify.txt --fixtures scripts/fixtures/twitter_posts.csv
    python scripts/test_classify.py --prompt prompts/v1_classify.txt --fixtures scripts/fixtures/twitter_posts.csv --profile learn
    python scripts/test_classify.py --prompt prompts/v1_classify.txt --fixtures scripts/fixtures/twitter_posts.csv --profile all --verbose
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
from pathlib import Path

import anthropic
from dotenv import load_dotenv

# Load api/.env from project root
load_dotenv(Path(__file__).resolve().parent.parent / "api" / ".env")


# --- Test profiles ---

PROFILES = {
    "learn": {
        "interests": "AI research, machine learning, Python, systems programming, distributed systems",
        "goal": "learn new things and deepen technical knowledge",
        "avoids": "politics, celebrity gossip, sports, engagement bait",
        "platform_intent": "learn about technology and software engineering",
    },
    "stay_informed": {
        "interests": "tech industry news, AI policy, startups, global economics",
        "goal": "stay informed about current events and industry developments",
        "avoids": "celebrity gossip, engagement bait, self-help platitudes",
        "platform_intent": "stay current on news and industry trends",
    },
    "network": {
        "interests": "software engineering careers, hiring, tech industry, engineering management",
        "goal": "network and advance career in tech",
        "avoids": "politics, celebrity gossip, outrage bait, ads",
        "platform_intent": "network with other engineers and find career opportunities",
    },
}

EXPECTED_COL_MAP = {
    "learn": "expected_learn",
    "stay_informed": "expected_stay_informed",
    "network": "expected_network",
}


def load_prompt(prompt_path: str) -> str:
    return Path(prompt_path).read_text()


def load_fixtures(fixtures_path: str) -> list[dict]:
    rows = []
    with open(fixtures_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def build_prompt(template: str, profile: dict, post_text: str) -> str:
    return template.format(
        platform="Twitter/X",
        interests=profile["interests"],
        avoids=profile["avoids"],
        goal=profile["goal"],
        platform_intent=profile["platform_intent"],
        post_text=post_text,
    )


def derive_action(score: float, confidence: float) -> str:
    """Recompute action from score + confidence — don't trust the model's action."""
    if score >= 0.7 and confidence >= 0.75:
        return "show"
    if score <= 0.15 and confidence >= 0.75:
        return "hide"
    return "blur"


def classify_post(client: anthropic.Anthropic, model: str, prompt: str) -> dict:
    """Call Anthropic API and parse JSON response."""
    response = client.messages.create(
        model=model,
        max_tokens=256,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text.strip()

    # Handle markdown code blocks
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
        text = text.strip()

    result = json.loads(text)
    result["derived_action"] = derive_action(result["score"], result["confidence"])
    return result


def run_harness(
    prompt_path: str,
    fixtures_path: str,
    profile_name: str,
    verbose: bool = False,
    model: str | None = None,
) -> dict:
    """Run all fixtures against a profile, return accuracy stats."""

    template = load_prompt(prompt_path)
    fixtures = load_fixtures(fixtures_path)
    profile = PROFILES[profile_name]
    expected_col = EXPECTED_COL_MAP[profile_name]

    model = model or os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
    client = anthropic.Anthropic()

    correct = 0
    total = 0
    results = []
    errors = []

    print(f"\n{'='*60}")
    print(f"  Profile: {profile_name}")
    print(f"  Model: {model}")
    print(f"  Prompt: {prompt_path}")
    print(f"  Fixtures: {len(fixtures)} posts")
    print(f"{'='*60}\n")

    for i, row in enumerate(fixtures):
        post_text = row["post_text"]
        expected = row[expected_col]
        category = row["category"]

        prompt = build_prompt(template, profile, post_text)

        try:
            result = classify_post(client, model, prompt)
            action = result["derived_action"]
            match = action == expected

            if match:
                correct += 1
            total += 1

            status = "✓" if match else "✗"
            results.append({
                "id": row["id"],
                "category": category,
                "expected": expected,
                "got": action,
                "score": result["score"],
                "confidence": result["confidence"],
                "reason": result["reason"],
                "match": match,
            })

            if verbose or not match:
                print(f"  {status} [{category:>16}] expected={expected:>4} got={action:>4} "
                      f"(s={result['score']:.2f} c={result['confidence']:.2f})")
                if verbose:
                    preview = post_text[:80] + ("..." if len(post_text) > 80 else "")
                    print(f"    post: {preview}")
                    print(f"    reason: {result['reason']}")
                    print()

            # Rate limiting — small delay between calls
            time.sleep(0.1)

        except Exception as e:
            errors.append({"id": row["id"], "error": str(e)})
            print(f"  ! [{category:>16}] ERROR: {e}")
            total += 1

    accuracy = correct / total if total > 0 else 0

    # Category breakdown
    category_stats: dict[str, dict] = {}
    for r in results:
        cat = r["category"]
        if cat not in category_stats:
            category_stats[cat] = {"correct": 0, "total": 0}
        category_stats[cat]["total"] += 1
        if r["match"]:
            category_stats[cat]["correct"] += 1

    print(f"\n{'─'*60}")
    print(f"  RESULTS: {correct}/{total} correct ({accuracy:.1%})")
    print(f"{'─'*60}")
    print(f"  {'Category':<20} {'Accuracy':>10}")
    print(f"  {'─'*30}")
    for cat, stats in sorted(category_stats.items()):
        cat_acc = stats["correct"] / stats["total"] if stats["total"] > 0 else 0
        print(f"  {cat:<20} {stats['correct']}/{stats['total']:>2} ({cat_acc:.0%})")

    if errors:
        print(f"\n  ⚠ {len(errors)} errors occurred")

    # Misclassifications summary
    misses = [r for r in results if not r["match"]]
    if misses:
        print(f"\n  Misclassifications ({len(misses)}):")
        for m in misses:
            print(f"    id={m['id']} [{m['category']}] expected={m['expected']} got={m['got']} "
                  f"(s={m['score']:.2f} c={m['confidence']:.2f}) — {m['reason']}")

    return {
        "profile": profile_name,
        "accuracy": accuracy,
        "correct": correct,
        "total": total,
        "category_stats": category_stats,
        "misclassifications": misses,
        "errors": errors,
    }


def main():
    parser = argparse.ArgumentParser(description="Doomscroll4 classification test harness")
    parser.add_argument("--prompt", required=True, help="Path to prompt template file")
    parser.add_argument("--fixtures", required=True, help="Path to fixtures CSV")
    parser.add_argument("--profile", choices=["learn", "stay_informed", "network", "all"],
                        default="all", help="Goal profile to test (default: all)")
    parser.add_argument("--verbose", action="store_true", help="Print all results, not just misses")
    parser.add_argument("--model", help="Override Anthropic model (default: from env or claude-haiku-4-5-20251001)")

    args = parser.parse_args()

    profiles_to_test = list(PROFILES.keys()) if args.profile == "all" else [args.profile]

    all_results = []
    for profile_name in profiles_to_test:
        result = run_harness(
            prompt_path=args.prompt,
            fixtures_path=args.fixtures,
            profile_name=profile_name,
            verbose=args.verbose,
            model=args.model,
        )
        all_results.append(result)

    # Summary across all profiles
    if len(all_results) > 1:
        print(f"\n{'='*60}")
        print(f"  OVERALL SUMMARY")
        print(f"{'='*60}")
        accuracies = []
        for r in all_results:
            print(f"  {r['profile']:<20} {r['accuracy']:.1%}")
            accuracies.append(r["accuracy"])

        avg = sum(accuracies) / len(accuracies)
        variance = max(accuracies) - min(accuracies)
        print(f"  {'─'*30}")
        print(f"  {'Average':<20} {avg:.1%}")
        print(f"  {'Variance':<20} {variance:.1%}")

        passed = avg > 0.80 and variance < 0.10
        print(f"\n  Exit gate: {'PASS ✓' if passed else 'FAIL ✗'}")
        print(f"    Accuracy >80%: {'✓' if avg > 0.80 else '✗'} ({avg:.1%})")
        print(f"    Variance <10%: {'✓' if variance < 0.10 else '✗'} ({variance:.1%})")

        sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
