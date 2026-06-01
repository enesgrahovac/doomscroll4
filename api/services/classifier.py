import json
import os
import re

import anthropic
from google import genai

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


async def _classify_anthropic(prompt: str) -> dict:
    model = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
    client = anthropic.AsyncAnthropic()

    response = await client.messages.create(
        model=model,
        max_tokens=256,
        messages=[{"role": "user", "content": prompt}],
    )
    return parse_json_response(response.content[0].text)


async def _classify_gemini(prompt: str) -> dict:
    model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
    client = genai.Client()  # reads GEMINI_API_KEY / GOOGLE_API_KEY from env

    response = await client.aio.models.generate_content(
        model=model,
        contents=prompt,
        config={
            "max_output_tokens": 512,
            # Disable thinking ("minimal") for this high-volume, latency-sensitive
            # per-post call: the prompt already mandates JSON-only output, and any
            # thinking budget risks consuming max_output_tokens and returning empty
            # text. This mirrors the no-thinking behavior of the Haiku path.
            "thinking_config": {"thinking_level": "minimal"},
        },
    )
    return parse_json_response(response.text)


_PROVIDERS = {
    "gemini": _classify_gemini,
    "anthropic": _classify_anthropic,
}


async def classify_post(request: ClassifyRequest) -> ClassifyResponse:
    provider = os.getenv("LLM_PROVIDER", "gemini").lower()
    classify = _PROVIDERS.get(provider, _classify_gemini)

    prompt = build_prompt(request.post_text, request.platform, request.user_profile)
    result = await classify(prompt)

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
