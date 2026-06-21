import re

from app.models.candidate import Candidate
from app.models.job import Job
from app.models.user import User

VARIABLE_PATTERN = re.compile(r"\{\{\s*([a-z_]+)\s*\}\}")


def _split_name(full_name: str) -> tuple[str, str]:
    parts = (full_name or "").strip().split(None, 1)
    first = parts[0] if parts else ""
    last = parts[1] if len(parts) > 1 else ""
    return first, last


def build_template_context(
    candidate: Candidate,
    sender: User,
    job: Job | None = None,
) -> dict[str, str]:
    extras = candidate.profile_extras or {}
    first_name, last_name = _split_name(candidate.name)
    first_name = str(extras.get("first_name") or first_name)
    last_name = str(extras.get("last_name") or last_name)
    sender_first, sender_last = _split_name(sender.name)

    return {
        "first_name": first_name,
        "last_name": last_name,
        "full_name": candidate.name or "",
        "company": candidate.current_company or "",
        "current_title": candidate.current_job_title or "",
        "job_title": job.title if job else "",
        "location": candidate.location or "",
        "sender_name": sender.name or "",
        "sender_first_name": sender_first or "",
    }


def render_template(text: str, context: dict[str, str]) -> str:
    def replace(match: re.Match) -> str:
        key = match.group(1)
        return context.get(key, "")

    return VARIABLE_PATTERN.sub(replace, text or "")


def find_missing_variables(text: str, context: dict[str, str]) -> list[str]:
    keys = set(VARIABLE_PATTERN.findall(text or ""))
    return sorted([k for k in keys if not context.get(k)])
