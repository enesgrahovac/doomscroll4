import json
import os
import re

import anthropic

from models.schemas import ClassifyRequest, ClassifyResponse
from services.prompt import CURRENT_PROMPT_VERSION, build_prompt


def derive_action(score: float, confidence: float) -> str:
    if score >= 0.7 and confidence >= 0.75:
        return "show"
    if score <= 0.15 and confidence >= 0.75:
        return "hide"
    return "blur"


def parse_json_response(text: str) -> dict:
    # Strip ```json code blocks if present
    match = re.search(r"```(?:json)?\s*(.*?)\s*```", text, re.DOTALL)
    if match:
        text = match.group(1)
    return json.loads(text.strip())


async def classify_post(request: ClassifyRequest) -> ClassifyResponse:
    model = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
    client = anthropic.AsyncAnthropic()

    prompt = build_prompt(request.post_text, request.platform, request.user_profile)

    response = await client.messages.create(
        model=model,
        max_tokens=256,
        messages=[{"role": "user", "content": prompt}],
    )

    result = parse_json_response(response.content[0].text)

    score = float(result["score"])
    confidence = float(result["confidence"])
    action = derive_action(score, confidence)

    return ClassifyResponse(
        action=action,
        score=score,
        confidence=confidence,
        reason=result["reason"],
        prompt_version=CURRENT_PROMPT_VERSION,
    )
