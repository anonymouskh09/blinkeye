import re
import unicodedata
from urllib.parse import unquote, urlparse

from sqlalchemy.orm import Session

from app.models.candidate import Candidate

_IN_PATH_RE = re.compile(r"/in/([^/]+)", re.IGNORECASE)
_ZERO_WIDTH_RE = re.compile(r"[\u200b-\u200d\ufeff\u2060]")
_CONTROL_RE = re.compile(r"[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]")


def normalize_linkedin_url(raw: str | None) -> str | None:
    """Canonicalise a LinkedIn profile URL to https://www.linkedin.com/in/<slug>.

    Mirrors the extension's normaliser so duplicate detection is consistent on
    both sides. Returns None for anything that is not a member profile URL.
    """
    if not raw:
        return None
    value = raw.strip()
    if not value:
        return None
    if not re.match(r"^https?://", value, re.IGNORECASE):
        value = "https://" + value.lstrip("/")
    try:
        parsed = urlparse(value)
    except ValueError:
        return None
    host = (parsed.hostname or "").lower()
    if not host.endswith("linkedin.com"):
        return None
    match = _IN_PATH_RE.search(parsed.path or "")
    if not match:
        return None
    # Decode percent-encoding so Unicode slugs match the extension's canonical form.
    slug = unquote(match.group(1)).strip().lower()
    if not slug:
        return None
    return f"https://www.linkedin.com/in/{slug}"


def clean_text(value: str | None, max_length: int | None = None) -> str | None:
    """Unicode-safe cleaning: NFC-normalise, drop zero-width/control chars, and
    collapse whitespace while preserving legitimate non-ASCII letters."""
    if value is None:
        return None
    text = unicodedata.normalize("NFC", str(value))
    text = _ZERO_WIDTH_RE.sub("", text)
    text = _CONTROL_RE.sub(" ", text)
    text = re.sub(r"[\s\u00a0]+", " ", text).strip()
    if not text:
        return None
    if max_length and len(text) > max_length:
        text = text[:max_length].rstrip()
    return text


def clean_multiline(value: str | None, max_length: int | None = None) -> str | None:
    if value is None:
        return None
    text = unicodedata.normalize("NFC", str(value))
    text = _ZERO_WIDTH_RE.sub("", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _CONTROL_RE.sub(" ", text)
    lines = [re.sub(r"[\s\u00a0]+", " ", ln).strip() for ln in text.split("\n")]
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if not text:
        return None
    if max_length and len(text) > max_length:
        text = text[:max_length].rstrip()
    return text


def find_duplicate(db: Session, normalized_url: str | None, email: str | None) -> Candidate | None:
    """Locate an existing candidate matching the LinkedIn URL (preferred) or,
    failing that, an exact email match."""
    if normalized_url:
        existing = (
            db.query(Candidate)
            .filter(Candidate.linkedin_url == normalized_url)
            .first()
        )
        if existing:
            return existing
    if email:
        existing = (
            db.query(Candidate)
            .filter(Candidate.email.ilike(email.strip()))
            .first()
        )
        if existing:
            return existing
    return None


def duplicate_info(candidate: Candidate) -> dict:
    """Safe, minimal representation of an existing candidate for the extension."""
    return {
        "id": candidate.id,
        "name": candidate.name,
        "email": candidate.email,
        "linkedinUrl": candidate.linkedin_url,
        "createdAt": candidate.created_at.isoformat() if candidate.created_at else None,
    }


def _is_blank(value) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    if isinstance(value, (list, dict)) and len(value) == 0:
        return True
    return False


def fill_missing_fields(candidate: Candidate, data: dict) -> list[str]:
    """Set only blank fields on the candidate. Returns list of updated field names."""
    updated: list[str] = []
    scalar_map = {
        "name": "name",
        "email": "email",
        "phone": "phone",
        "location": "location",
        "headline": "headline",
        "summary": "summary",
        "current_job_title": "current_job_title",
        "current_company": "current_company",
    }
    for src, attr in scalar_map.items():
        if src not in data or data[src] is None:
            continue
        val = data[src]
        if isinstance(val, str):
            val = val.strip()
            if not val:
                continue
        if _is_blank(getattr(candidate, attr, None)):
            setattr(candidate, attr, val)
            updated.append(attr)

    if data.get("skills") and _is_blank(candidate.skills):
        skills = [s.strip() for s in data["skills"] if isinstance(s, str) and s.strip()]
        if skills:
            candidate.skills = skills
            candidate.skill_levels = [{"name": s, "level": 3} for s in skills]
            updated.append("skills")

    if data.get("experiences") and _is_blank(candidate.experiences):
        candidate.experiences = data["experiences"]
        updated.append("experiences")

    if data.get("educations") and _is_blank(candidate.educations):
        candidate.educations = data["educations"]
        updated.append("educations")

    extras = dict(candidate.profile_extras or {})
    extras_changed = False
    if data.get("certifications") and not extras.get("certifications"):
        extras["certifications"] = data["certifications"]
        extras_changed = True
        updated.append("certifications")
    if data.get("languages") and not extras.get("languages"):
        extras["languages"] = data["languages"]
        extras_changed = True
        updated.append("languages")
    if extras_changed:
        candidate.profile_extras = extras

    return updated


def apply_parsed_fill_missing(candidate: Candidate, parsed: dict) -> list[str]:
    """Map resume-parser output onto blank candidate fields only."""
    payload = {
        "name": parsed.get("name"),
        "email": parsed.get("email"),
        "phone": parsed.get("phone"),
        "location": parsed.get("location"),
        "current_job_title": parsed.get("current_job_title"),
        "current_company": parsed.get("current_company"),
        "skills": parsed.get("skills"),
        "experiences": parsed.get("experiences"),
        "educations": parsed.get("educations"),
    }
    extras = parsed.get("profile_extras") or {}
    if extras.get("certifications"):
        payload["certifications"] = extras["certifications"]
    if extras.get("languages"):
        payload["languages"] = extras["languages"]
    updated = fill_missing_fields(candidate, payload)
    # Merge other extras keys without overwriting.
    if extras:
        current = dict(candidate.profile_extras or {})
        changed = False
        for k, v in extras.items():
            if v and _is_blank(current.get(k)):
                current[k] = v
                changed = True
        if changed:
            candidate.profile_extras = current
    return updated
