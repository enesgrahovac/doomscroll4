from typing import Literal

from pydantic import BaseModel


class UserProfile(BaseModel):
    interests: list[str]
    goal: Literal["learn", "stay_informed", "network", "all"]
    avoids: list[str]
    platform_intent: str = ""


class ClassifyRequest(BaseModel):
    post_text: str
    platform: str = "twitter"
    user_profile: UserProfile


class ClassifyResponse(BaseModel):
    action: Literal["show", "blur", "hide"]
    score: float
    confidence: float
    reason: str
    prompt_version: str


class HealthResponse(BaseModel):
    status: str
    version: str
    prompt_version: str
