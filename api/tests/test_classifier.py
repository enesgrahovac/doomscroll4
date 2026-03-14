import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from main import app
from models.schemas import ClassifyRequest, UserProfile
from services.classifier import classify_post, derive_action, parse_json_response


# --- derive_action tests ---


class TestDeriveAction:
    def test_show_high_score_high_confidence(self):
        assert derive_action(0.8, 0.9) == "show"

    def test_hide_low_score_high_confidence(self):
        assert derive_action(0.1, 0.9) == "hide"

    def test_blur_medium_score(self):
        assert derive_action(0.4, 0.8) == "blur"

    def test_blur_high_score_low_confidence(self):
        assert derive_action(0.8, 0.5) == "blur"

    def test_blur_low_score_low_confidence(self):
        assert derive_action(0.1, 0.5) == "blur"

    def test_show_boundary(self):
        assert derive_action(0.7, 0.75) == "show"

    def test_hide_boundary(self):
        assert derive_action(0.15, 0.75) == "hide"

    def test_blur_just_below_show(self):
        assert derive_action(0.69, 0.9) == "blur"

    def test_blur_just_above_hide(self):
        assert derive_action(0.16, 0.9) == "blur"


# --- parse_json_response tests ---


class TestParseJsonResponse:
    def test_plain_json(self):
        text = '{"score": 0.8, "confidence": 0.9, "reason": "relevant"}'
        result = parse_json_response(text)
        assert result["score"] == 0.8

    def test_json_code_block(self):
        text = '```json\n{"score": 0.8, "confidence": 0.9, "reason": "relevant"}\n```'
        result = parse_json_response(text)
        assert result["score"] == 0.8

    def test_code_block_no_language(self):
        text = '```\n{"score": 0.5, "confidence": 0.6, "reason": "maybe"}\n```'
        result = parse_json_response(text)
        assert result["score"] == 0.5


# --- classify_post tests ---


def make_request(score_val=0.8, platform="twitter"):
    return ClassifyRequest(
        post_text="Test post about AI",
        platform=platform,
        user_profile=UserProfile(
            interests=["AI", "machine learning"],
            goal="learn",
            avoids=["politics"],
        ),
    )


def mock_anthropic_response(score: float, confidence: float, reason: str) -> MagicMock:
    response_json = json.dumps(
        {"score": score, "confidence": confidence, "reason": reason}
    )
    content_block = MagicMock()
    content_block.text = response_json
    response = MagicMock()
    response.content = [content_block]
    return response


@pytest.mark.asyncio
async def test_classify_post_show():
    mock_response = mock_anthropic_response(0.85, 0.9, "Highly relevant AI content")
    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    with patch("services.classifier.anthropic.AsyncAnthropic", return_value=mock_client):
        result = await classify_post(make_request())

    assert result.action == "show"
    assert result.score == 0.85
    assert result.confidence == 0.9
    assert result.prompt_version == "v1"


@pytest.mark.asyncio
async def test_classify_post_hide():
    mock_response = mock_anthropic_response(0.05, 0.95, "Obvious spam")
    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    with patch("services.classifier.anthropic.AsyncAnthropic", return_value=mock_client):
        result = await classify_post(make_request())

    assert result.action == "hide"
    assert result.score == 0.05


@pytest.mark.asyncio
async def test_classify_post_blur():
    mock_response = mock_anthropic_response(0.4, 0.6, "Tangentially related")
    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    with patch("services.classifier.anthropic.AsyncAnthropic", return_value=mock_client):
        result = await classify_post(make_request())

    assert result.action == "blur"


@pytest.mark.asyncio
async def test_classify_post_json_code_block():
    content_block = MagicMock()
    content_block.text = '```json\n{"score": 0.9, "confidence": 0.95, "reason": "Perfect match"}\n```'
    response = MagicMock()
    response.content = [content_block]

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=response)

    with patch("services.classifier.anthropic.AsyncAnthropic", return_value=mock_client):
        result = await classify_post(make_request())

    assert result.action == "show"
    assert result.score == 0.9


# --- health endpoint test ---


@pytest.mark.asyncio
async def test_health_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["prompt_version"] == "v1"
    assert "version" in data
