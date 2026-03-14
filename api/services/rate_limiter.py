import os
from datetime import date

import redis.asyncio as redis


async def check_rate_limit(api_key: str) -> tuple[bool, int]:
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        return True, -1

    daily_limit = int(os.getenv("FREE_TIER_DAILY_LIMIT", "50"))
    today = date.today().isoformat()
    key = f"ds4:ratelimit:{api_key}:{today}"

    try:
        r = redis.from_url(redis_url)
        count = await r.get(key)
        current = int(count) if count else 0

        if current >= daily_limit:
            await r.aclose()
            return False, 0

        pipe = r.pipeline()
        pipe.incr(key)
        pipe.expire(key, 86400)
        await pipe.execute()
        await r.aclose()

        remaining = daily_limit - current - 1
        return True, remaining
    except (redis.ConnectionError, redis.RedisError, OSError):
        return True, -1
