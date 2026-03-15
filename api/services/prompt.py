from pathlib import Path

from models.schemas import UserProfile

CURRENT_PROMPT_VERSION = "v1"

PROJECT_ROOT = Path(__file__).resolve().parent.parent

GOAL_LABELS = {
    "learn": "learn new things and deepen their knowledge",
    "stay_informed": "stay informed about current events and trends",
    "network": "network with professionals and grow their career",
    "all": "balance learning, staying informed, and networking",
}


def load_prompt_template(version: str = CURRENT_PROMPT_VERSION) -> str:
    path = PROJECT_ROOT / "prompts" / f"{version}_classify.txt"
    return path.read_text()


def build_prompt(post_text: str, platform: str, profile: UserProfile) -> str:
    template = load_prompt_template()
    return template.format(
        platform=platform,
        interests=", ".join(profile.interests),
        avoids=", ".join(profile.avoids),
        goal=GOAL_LABELS.get(profile.goal, profile.goal),
        platform_intent=profile.platform_intent or "general browsing",
        post_text=post_text,
    )
