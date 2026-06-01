import asyncio
import json
import os
import re

import anthropic
from google import genai
from google.genai import errors as genai_errors

from models.schemas import ClassifyRequest, ClassifyResponse
from services.prompt import CURRENT_PROMPT_VERSION, build_prompt

# gemini-3.5-flash can fail transiently two ways: a 503 UNAVAILABLE ("high
# demand") under load spikes, or an empty/blank candidate (no text to parse).
# Both are non-deterministic, so retry a few times before surfacing the error.
_GEMINI_MAX_ATTEMPTS = 4
_GEMINI_BACKOFF_SECONDS = 0.6


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

    last_err = None
    for attempt in range(_GEMINI_MAX_ATTEMPTS):
        try:
            response = await client.aio.models.generate_content(
                model=model,
                contents=prompt,
                config={
                    # Generous cap so any stray thinking can't truncate the JSON
                    # output to empty; the body is only ~60 tokens, so this costs
                    # nothing in the normal case (you pay per token generated).
                    "max_output_tokens": 2048,
                    # Disable thinking ("minimal") for this high-volume,
                    # latency-sensitive per-post call: the prompt already mandates
                    # JSON-only output. Mirrors the no-thinking Haiku path.
                    "thinking_config": {"thinking_level": "minimal"},
                },
            )
            text = response.text
            if not text or not text.strip():
                raise ValueError("empty response text from gemini")
            return parse_json_response(text)
        except (genai_errors.ServerError, ValueError) as e:
            # ServerError -> capacity blip (back off); ValueError/JSONDecodeError
            # -> empty or unparseable candidate (retry immediately). JSONDecodeError
            # subclasses ValueError, so both are caught here.
            last_err = e
            if attempt < _GEMINI_MAX_ATTEMPTS - 1 and isinstance(e, genai_errors.ServerError):
                await asyncio.sleep(_GEMINI_BACKOFF_SECONDS * (attempt + 1))
    raise last_err


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
