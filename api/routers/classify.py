import os

from fastapi import APIRouter, Header, HTTPException

from models.schemas import ClassifyRequest, ClassifyResponse
from services.classifier import classify_post
from services.rate_limiter import check_rate_limit

router = APIRouter()


@router.post("/classify", response_model=ClassifyResponse)
async def classify(
    request: ClassifyRequest,
    x_api_key: str = Header(...),
):
    api_secret = os.getenv("API_SECRET", "")
    if api_secret and x_api_key != api_secret:
        # Strict mode: require exact match when API_SECRET is configured
        raise HTTPException(status_code=401, detail="Invalid API key")
    if not api_secret and not x_api_key:
        raise HTTPException(status_code=401, detail="API key required")

    allowed, remaining = await check_rate_limit(x_api_key)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="Daily rate limit exceeded",
            headers={"X-RateLimit-Remaining": "0"},
        )

    response = await classify_post(request)
    return response
