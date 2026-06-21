import re
from io import BytesIO
from pathlib import Path

from fastapi import UploadFile

from app.core.exceptions import BadRequestException

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3,4}[-.\s]?\d{3,4}")
LINKEDIN_RE = re.compile(r"(https?://(?:www\.)?linkedin\.com/in/[a-zA-Z0-9_-]+/?)", re.I)
LINKEDIN_LOOSE_RE = re.compile(r"(?:https?://)?(?:www\.)?linkedin\.com/in/([a-zA-Z0-9_-]+)/?", re.I)
GITHUB_LOOSE_RE = re.compile(r"(?:https?://)?(?:www\.)?github\.com/([a-zA-Z0-9_-]+)/?", re.I)
TWITTER_LOOSE_RE = re.compile(r"(?:https?://)?(?:www\.)?(?:twitter\.com|x\.com)/([a-zA-Z0-9_]+)/?", re.I)
YEAR_RE = re.compile(r"\b((?:19|20)\d{2})\b")

COMMON_SKILLS = [
    "JavaScript", "TypeScript", "Python", "Java", "React", "React.js", "Node.js", "Next.js",
    "HTML5", "HTML", "CSS3", "CSS", "Tailwind CSS", "Tailwind", "SQL", "PostgreSQL", "MongoDB",
    "Docker", "AWS", "Git", "REST API", "FastAPI", "Django", "Vue", "Angular", "PHP", "Laravel",
    "C++", "C#", ".NET", "Redis", "GraphQL", "Kubernetes", "Linux", "Figma", "UI/UX",
]

EXPERIENCE_SECTION_MARKERS = [
    "experience", "work experience", "employment", "professional experience", "career",
]
EDUCATION_SECTION_MARKERS = ["education", "academic", "qualification", "degree"]
SKILLS_SECTION_MARKERS = ["skills", "technical skills", "core competencies", "technologies"]


def _extract_pdf_text(content: bytes) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(BytesIO(content))
        parts = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                parts.append(text)
        return "\n".join(parts)
    except Exception as exc:
        raise BadRequestException(f"Could not read PDF: {exc}") from exc


def _extract_docx_text(content: bytes) -> str:
    try:
        from docx import Document
        doc = Document(BytesIO(content))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except Exception as exc:
        raise BadRequestException(f"Could not read DOCX: {exc}") from exc


async def extract_text_from_upload(file: UploadFile) -> str:
    if not file.filename:
        raise BadRequestException("No file provided")
    content = await file.read()
    ext = Path(file.filename).suffix.lower()
    if ext == ".pdf":
        return _extract_pdf_text(content)
    if ext == ".docx":
        return _extract_docx_text(content)
    if ext == ".doc":
        raise BadRequestException("Legacy .doc files are not supported for parsing. Please upload PDF or DOCX.")
    raise BadRequestException("Unsupported file type for parsing")


def _split_name(full_name: str) -> tuple[str, str]:
    parts = full_name.strip().split()
    if len(parts) >= 2:
        return parts[0], " ".join(parts[1:])
    return full_name, ""


def _guess_name(lines: list[str]) -> str | None:
    for line in lines[:8]:
        clean = line.strip()
        if not clean or len(clean) > 60:
            continue
        if EMAIL_RE.search(clean) or PHONE_RE.search(clean) or "http" in clean.lower():
            continue
        if sum(c.isdigit() for c in clean) > 3:
            continue
        if 2 <= len(clean.split()) <= 5:
            return clean
    return None


def _find_section_lines(text: str, markers: list[str]) -> list[str]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    start = None
    for i, line in enumerate(lines):
        lower = line.lower()
        if any(m in lower for m in markers) and len(line) < 40:
            start = i + 1
            break
    if start is None:
        return []
    section: list[str] = []
    for line in lines[start:]:
        lower = line.lower()
        if any(m in lower for m in EXPERIENCE_SECTION_MARKERS + EDUCATION_SECTION_MARKERS + SKILLS_SECTION_MARKERS):
            if line != lines[start - 1]:
                break
        section.append(line)
        if len(section) > 40:
            break
    return section


def _parse_experiences(text: str, current_title: str | None, current_company: str | None) -> list[dict]:
    section = _find_section_lines(text, EXPERIENCE_SECTION_MARKERS)
    experiences: list[dict] = []

    if current_title and current_company:
        experiences.append({
            "title": current_title,
            "company": current_company,
            "start_date": None,
            "end_date": None,
            "location": None,
            "description": "",
            "is_current": True,
        })

    block: list[str] = []
    for line in section:
        if YEAR_RE.search(line) and block:
            title_line = block[0]
            company_line = block[1] if len(block) > 1 else ""
            years = YEAR_RE.findall(line)
            desc = "\n".join(block[2:]) if len(block) > 2 else ""
            if " at " in title_line.lower():
                parts = re.split(r"\s+at\s+", title_line, flags=re.I, maxsplit=1)
                title, company = parts[0], parts[1] if len(parts) > 1 else company_line
            else:
                title, company = title_line, company_line or "Unknown"
            experiences.append({
                "title": title.strip(),
                "company": company.strip(),
                "start_date": years[0] if years else None,
                "end_date": "Present" if "present" in line.lower() else (years[-1] if len(years) > 1 else None),
                "location": None,
                "description": desc.strip(),
                "is_current": "present" in line.lower(),
            })
            block = []
        else:
            block.append(line)
    return experiences[:5]


def _parse_educations(text: str) -> list[dict]:
    section = _find_section_lines(text, EDUCATION_SECTION_MARKERS)
    educations: list[dict] = []
    for line in section[:10]:
        years = YEAR_RE.findall(line)
        if not years and "university" not in line.lower() and "bachelor" not in line.lower() and "master" not in line.lower():
            continue
        educations.append({
            "school": line.split(",")[0].strip() if "," in line else line.strip(),
            "degree": line.split(",")[1].strip() if "," in line else None,
            "start_date": years[0] if years else None,
            "end_date": years[-1] if len(years) > 1 else None,
            "location": None,
        })
    return educations[:3]


def _parse_skills(text: str) -> tuple[list[str], list[dict]]:
    lower = text.lower()
    found: list[str] = []
    levels: list[dict] = []
    for skill in COMMON_SKILLS:
        if skill.lower() in lower and skill not in found:
            found.append(skill)
            levels.append({"name": skill, "level": 8})
    section = _find_section_lines(text, SKILLS_SECTION_MARKERS)
    if section:
        joined = " ".join(section)
        for part in re.split(r"[,|•·\n]", joined):
            s = part.strip()
            if 2 <= len(s) <= 40 and s not in found:
                found.append(s)
                levels.append({"name": s, "level": 7})
    return found[:20], levels[:20]


def _normalize_social_url(url: str) -> str:
    clean = url.strip().rstrip(".,|)")
    if not clean.startswith("http"):
        clean = f"https://{clean.lstrip('/')}"
    return clean


def _extract_social_links(text: str) -> list[dict]:
    links: list[dict] = []
    seen: set[str] = set()

    def add(platform: str, url: str, username: str | None = None) -> None:
        key = f"{platform}:{url.lower()}"
        if key in seen:
            return
        seen.add(key)
        links.append({
            "id": f"{platform}-{len(links)}",
            "platform": platform,
            "url": url,
            "username": username or url.rstrip("/").split("/")[-1],
            "verified": False,
            "enriched": False,
            "source": "resume",
        })

    for match in LINKEDIN_LOOSE_RE.finditer(text):
        username = match.group(1)
        add("linkedin", f"https://www.linkedin.com/in/{username}", username)

    for match in GITHUB_LOOSE_RE.finditer(text):
        username = match.group(1)
        if username.lower() not in {"features", "topics", "trending", "explore", "settings"}:
            add("github", f"https://github.com/{username}", username)

    for match in TWITTER_LOOSE_RE.finditer(text):
        username = match.group(1)
        add("twitter", f"https://twitter.com/{username}", username)

    return links


def merge_social_links(existing: list, incoming: list, overwrite: bool = True) -> list:
    if not incoming:
        return existing
    by_platform = {item.get("platform"): item for item in existing if item.get("platform")}
    for link in incoming:
        platform = link.get("platform")
        if not platform:
            continue
        if platform not in by_platform or overwrite or not by_platform[platform].get("url"):
            by_platform[platform] = link
    order = ["linkedin", "github", "twitter"]
    merged = [by_platform[p] for p in order if p in by_platform]
    for p, item in by_platform.items():
        if p not in order:
            merged.append(item)
    return merged


def _estimate_experience_years(text: str) -> int | None:
    years = [int(y) for y in YEAR_RE.findall(text) if 1990 <= int(y) <= 2030]
    if len(years) >= 2:
        return max(0, max(years) - min(years))
    return None


def parse_resume_text(text: str) -> dict:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    full_text = "\n".join(lines)

    email_match = EMAIL_RE.search(full_text)
    phone_match = PHONE_RE.search(full_text)
    linkedin_match = LINKEDIN_RE.search(full_text)
    social_links = _extract_social_links(full_text)
    linkedin_url = linkedin_match.group(1) if linkedin_match else None
    if not linkedin_url:
        for link in social_links:
            if link["platform"] == "linkedin":
                linkedin_url = link["url"]
                break
    name = _guess_name(lines) or ""
    first_name, last_name = _split_name(name) if name else ("", "")

    skills, skill_levels = _parse_skills(full_text)
    exp_years = _estimate_experience_years(full_text)

    current_title = None
    current_company = None
    exp_section = _find_section_lines(full_text, EXPERIENCE_SECTION_MARKERS)
    if exp_section:
        first = exp_section[0]
        if " at " in first.lower():
            parts = re.split(r"\s+at\s+", first, flags=re.I, maxsplit=1)
            current_title = parts[0].strip()
            current_company = parts[1].strip() if len(parts) > 1 else None
        else:
            current_title = first

    experiences = _parse_experiences(full_text, current_title, current_company)
    educations = _parse_educations(full_text)

    university = None
    diploma = None
    for edu in educations:
        if edu.get("school"):
            university = edu["school"]
        if edu.get("degree"):
            diploma = edu["degree"]

    location = None
    for line in lines[:15]:
        if "," in line and len(line) < 60 and not EMAIL_RE.search(line):
            if any(w in line.lower() for w in ["pakistan", "lahore", "karachi", "usa", "uk", "india", "remote"]):
                location = line
                break

    return {
        "name": name or None,
        "first_name": first_name or None,
        "last_name": last_name or None,
        "email": email_match.group(0) if email_match else None,
        "phone": phone_match.group(0).strip() if phone_match else None,
        "location": location,
        "current_job_title": current_title,
        "current_company": current_company,
        "experience_years": exp_years,
        "skills": skills,
        "skill_levels": skill_levels,
        "experiences": experiences,
        "educations": educations,
        "linkedin_url": linkedin_url,
        "social_links": social_links,
        "profile_extras": {
            "source": "Sourced via Resume Upload",
            "university": university,
            "diploma": diploma,
            "nationality": "Pakistani" if location and "pakistan" in location.lower() else None,
            "social_links": social_links,
        },
        "raw_text_preview": full_text[:500],
    }


async def parse_resume_file(file: UploadFile) -> dict:
    text = await extract_text_from_upload(file)
    await file.seek(0)
    if not text.strip():
        raise BadRequestException("Could not extract text from resume")
    return parse_resume_text(text)
