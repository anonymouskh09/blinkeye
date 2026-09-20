"""Rule-based candidate↔job matching (no LLM).

Scores use structured ATS fields only: must-have / nice-to-have skills,
experience band, title overlap, location, and salary range.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from sqlalchemy.orm import Session, joinedload

from app.models.candidate import Candidate
from app.models.candidate_job import CandidateJobAssignment
from app.models.enums import JobStatus, PipelineStage
from app.models.job import Job

# Weights sum to 100
W_MUST_HAVE = 40
W_NICE_TO_HAVE = 10
W_EXPERIENCE = 20
W_TITLE = 15
W_LOCATION = 10
W_SALARY = 5

SKILL_ALIASES: dict[str, str] = {
    "js": "javascript",
    "ts": "typescript",
    "react.js": "react",
    "reactjs": "react",
    "vue.js": "vue",
    "vuejs": "vue",
    "node.js": "node",
    "nodejs": "node",
    "next.js": "nextjs",
    "nuxt.js": "nuxt",
    "postgres": "postgresql",
    "psql": "postgresql",
    "k8s": "kubernetes",
    "gcp": "google cloud",
    "amazon web services": "aws",
    "ci/cd": "cicd",
    "ci-cd": "cicd",
    "rest api": "rest",
    "rest apis": "rest",
    "ml": "machine learning",
    "ai": "artificial intelligence",
    "py": "python",
    "c#": "csharp",
    "c++": "cpp",
    "golang": "go",
    "dotnet": ".net",
    "power bi": "powerbi",
    "ms excel": "excel",
    "microsoft excel": "excel",
}

STOP_TITLE_WORDS = {
    "senior", "junior", "sr", "jr", "lead", "principal", "staff",
    "the", "a", "an", "and", "or", "of", "for", "to", "in",
}


def normalize_skill(raw: str) -> str:
    s = (raw or "").strip().lower()
    s = re.sub(r"[^\w+#.\s/-]", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return SKILL_ALIASES.get(s, s)


def skill_set(values: list[str] | None) -> set[str]:
    return {normalize_skill(v) for v in (values or []) if (v or "").strip()}


def title_tokens(text: str | None) -> set[str]:
    if not text:
        return set()
    parts = re.split(r"[\s,/|+\-]+", text.lower())
    return {p for p in parts if len(p) > 1 and p not in STOP_TITLE_WORDS}


def location_compatible(job_loc: str | None, cand_loc: str | None) -> tuple[bool, str]:
    if not job_loc or not job_loc.strip():
        return True, "No location requirement"
    jl = job_loc.strip().lower()
    if "remote" in jl:
        return True, "Remote role"
    if not cand_loc or not cand_loc.strip():
        return False, "Candidate location unknown"
    cl = cand_loc.strip().lower()
    j_parts = {p.strip() for p in re.split(r"[,/|]", jl) if p.strip()}
    if any(p in cl for p in j_parts) or jl in cl or cl in jl:
        return True, "Location matches"
    return False, f"Job wants {job_loc}; candidate is in {cand_loc}"


def salary_fit(
    job_min: int | None,
    job_max: int | None,
    cand_min: int | None,
    cand_max: int | None,
    cand_expected: int | None,
) -> tuple[float, str]:
    """Return 0..1 fit and a note."""
    if job_min is None and job_max is None:
        return 1.0, "No salary range on job"
    c_lo = cand_min if cand_min is not None else cand_expected
    c_hi = cand_max if cand_max is not None else cand_expected
    if c_lo is None and c_hi is None:
        return 0.5, "Candidate salary expectation unknown"
    # Overlap of ranges
    j_lo = job_min if job_min is not None else 0
    j_hi = job_max if job_max is not None else 10**9
    c_lo_v = c_lo if c_lo is not None else c_hi or 0
    c_hi_v = c_hi if c_hi is not None else c_lo or 0
    if c_hi_v < j_lo:
        return 0.2, "Candidate expectation below job range"
    if c_lo_v > j_hi:
        return 0.15, "Candidate expectation above job range"
    return 1.0, "Salary ranges overlap"


def experience_fit(
    years: int | None,
    min_y: int | None,
    max_y: int | None,
) -> tuple[float, str]:
    if min_y is None and max_y is None:
        return 1.0, "No experience requirement"
    if years is None:
        return 0.4, "Candidate experience unknown"
    if min_y is not None and years < min_y:
        gap = min_y - years
        if gap <= 1:
            return 0.6, f"{years}y (job wants {min_y}+); close"
        return 0.2, f"{years}y below required {min_y}+"
    if max_y is not None and years > max_y:
        over = years - max_y
        if over <= 2:
            return 0.75, f"{years}y slightly above max {max_y}"
        return 0.45, f"{years}y above preferred max {max_y}"
    return 1.0, f"{years}y within required band"


@dataclass
class DimensionScore:
    key: str
    label: str
    score: int
    max_score: int
    matched: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    note: str = ""


@dataclass
class MatchResult:
    overall_score: int
    verdict: str
    dimensions: list[DimensionScore]
    flags: list[str]
    matched_skills: list[str]
    missing_skills: list[str]


def score_pair(job: Job, candidate: Candidate) -> MatchResult:
    must = skill_set(job.must_have_skills) or skill_set(
        re.split(r"[,;|\n]+", job.required_skills or "")
    )
    nice = skill_set(job.nice_to_have_skills)
    cand_skills = skill_set(candidate.skills)

    dims: list[DimensionScore] = []
    flags: list[str] = []

    # Must-have skills
    if must:
        hit = must & cand_skills
        miss = must - cand_skills
        ratio = len(hit) / len(must)
        pts = round(ratio * W_MUST_HAVE)
        dims.append(DimensionScore(
            key="must_have_skills",
            label="Must-have skills",
            score=pts,
            max_score=W_MUST_HAVE,
            matched=sorted(hit),
            missing=sorted(miss),
            note=f"{len(hit)} of {len(must)} required skills matched",
        ))
        if miss:
            flags.append(f"Missing required: {', '.join(sorted(miss)[:5])}")
    else:
        dims.append(DimensionScore(
            key="must_have_skills",
            label="Must-have skills",
            score=0,
            max_score=W_MUST_HAVE,
            note="Job has no must-have skills configured",
        ))
        flags.append("Job missing must-have skills")

    # Nice-to-have
    if nice:
        hit_n = nice & cand_skills
        ratio_n = len(hit_n) / len(nice)
        pts_n = round(ratio_n * W_NICE_TO_HAVE)
        dims.append(DimensionScore(
            key="nice_to_have_skills",
            label="Nice-to-have skills",
            score=pts_n,
            max_score=W_NICE_TO_HAVE,
            matched=sorted(hit_n),
            missing=sorted(nice - cand_skills),
            note=f"{len(hit_n)} of {len(nice)} nice-to-have matched",
        ))
    else:
        dims.append(DimensionScore(
            key="nice_to_have_skills",
            label="Nice-to-have skills",
            score=W_NICE_TO_HAVE,
            max_score=W_NICE_TO_HAVE,
            note="No nice-to-have skills listed",
        ))

    # Experience
    exp_ratio, exp_note = experience_fit(
        candidate.experience_years,
        job.min_experience_years,
        job.max_experience_years,
    )
    dims.append(DimensionScore(
        key="experience",
        label="Experience",
        score=round(exp_ratio * W_EXPERIENCE),
        max_score=W_EXPERIENCE,
        note=exp_note,
    ))
    if exp_ratio < 0.5:
        flags.append(exp_note)

    # Title
    job_tokens = title_tokens(job.title)
    cand_tokens = title_tokens(candidate.current_job_title) | title_tokens(candidate.headline)
    for exp in (candidate.experiences or [])[:5]:
        if isinstance(exp, dict):
            cand_tokens |= title_tokens(exp.get("title") or exp.get("role"))
    if job_tokens and cand_tokens:
        overlap = job_tokens & cand_tokens
        ratio_t = len(overlap) / len(job_tokens) if job_tokens else 0
        dims.append(DimensionScore(
            key="title",
            label="Title / role relevance",
            score=round(ratio_t * W_TITLE),
            max_score=W_TITLE,
            matched=sorted(overlap),
            note=f"Overlap: {', '.join(sorted(overlap)) or 'none'}",
        ))
    else:
        dims.append(DimensionScore(
            key="title",
            label="Title / role relevance",
            score=round(0.4 * W_TITLE),
            max_score=W_TITLE,
            note="Insufficient title data",
        ))

    # Location
    loc_ok, loc_note = location_compatible(job.location, candidate.location)
    dims.append(DimensionScore(
        key="location",
        label="Location",
        score=W_LOCATION if loc_ok else 0,
        max_score=W_LOCATION,
        note=loc_note,
    ))
    if not loc_ok:
        flags.append(loc_note)

    # Salary
    sal_ratio, sal_note = salary_fit(
        job.salary_min,
        job.salary_max,
        candidate.salary_min,
        candidate.salary_max,
        candidate.expected_salary,
    )
    dims.append(DimensionScore(
        key="salary",
        label="Salary fit",
        score=round(sal_ratio * W_SALARY),
        max_score=W_SALARY,
        note=sal_note,
    ))
    if sal_ratio < 0.4:
        flags.append(sal_note)

    overall = sum(d.score for d in dims)
    overall = max(0, min(100, overall))

    if overall >= 75:
        verdict = "strong_fit"
    elif overall >= 55:
        verdict = "good_fit"
    elif overall >= 35:
        verdict = "partial_fit"
    else:
        verdict = "weak_fit"

    matched_skills = sorted((must | nice) & cand_skills)
    missing_skills = sorted(must - cand_skills)

    return MatchResult(
        overall_score=overall,
        verdict=verdict,
        dimensions=dims,
        flags=flags,
        matched_skills=matched_skills,
        missing_skills=missing_skills,
    )


def result_to_dict(result: MatchResult) -> dict:
    return {
        "overall_score": result.overall_score,
        "verdict": result.verdict,
        "matched_skills": result.matched_skills,
        "missing_skills": result.missing_skills,
        "flags": result.flags,
        "dimensions": [
            {
                "key": d.key,
                "label": d.label,
                "score": d.score,
                "max_score": d.max_score,
                "matched": d.matched,
                "missing": d.missing,
                "note": d.note,
            }
            for d in result.dimensions
        ],
    }


def _assigned_pairs(db: Session) -> set[tuple[int, int]]:
    rows = db.query(
        CandidateJobAssignment.candidate_id,
        CandidateJobAssignment.job_id,
    ).all()
    return {(r[0], r[1]) for r in rows}


def _rejected_pairs(db: Session) -> set[tuple[int, int]]:
    rows = (
        db.query(CandidateJobAssignment.candidate_id, CandidateJobAssignment.job_id)
        .filter(CandidateJobAssignment.status == PipelineStage.REJECTED)
        .all()
    )
    return {(r[0], r[1]) for r in rows}


def match_jobs_for_candidate(
    db: Session,
    candidate: Candidate,
    *,
    min_score: int = 30,
    limit: int = 50,
    location: str | None = None,
    job_type: str | None = None,
    client_id: int | None = None,
    exclude_assigned: bool = True,
) -> dict:
    q = db.query(Job).options(joinedload(Job.client)).filter(Job.status == JobStatus.ACTIVE)
    if client_id:
        q = q.filter(Job.client_id == client_id)
    if job_type:
        q = q.filter(Job.job_type == job_type)
    if location:
        q = q.filter(Job.location.ilike(f"%{location}%"))

    jobs = q.all()
    assigned = _assigned_pairs(db) if exclude_assigned else set()
    rejected = _rejected_pairs(db)

    items = []
    scanned = 0
    for job in jobs:
        scanned += 1
        if exclude_assigned and (candidate.id, job.id) in assigned:
            continue
        if (candidate.id, job.id) in rejected:
            continue
        # Skip jobs with no matching signal at all
        if not (job.must_have_skills or job.required_skills or job.description):
            continue
        result = score_pair(job, candidate)
        if result.overall_score < min_score:
            continue
        items.append({
            "job_id": job.id,
            "job_title": job.title,
            "client_id": job.client_id,
            "client_name": job.client.company_name if job.client else None,
            "location": job.location,
            "job_type": job.job_type.value if hasattr(job.job_type, "value") else job.job_type,
            "min_experience_years": job.min_experience_years,
            "max_experience_years": job.max_experience_years,
            "salary_min": job.salary_min,
            "salary_max": job.salary_max,
            "screening_questions": job.screening_questions or [],
            "match_score": result.overall_score,
            "verdict": result.verdict,
            "matched_skills": result.matched_skills,
            "missing_skills": result.missing_skills,
            "flags": result.flags,
            "calibration": result_to_dict(result),
        })

    items.sort(key=lambda m: m["match_score"], reverse=True)
    return {
        "candidate_id": candidate.id,
        "scanned": scanned,
        "matched": len(items),
        "items": items[:limit],
    }


def match_candidates_for_job(
    db: Session,
    job: Job,
    *,
    min_score: int = 30,
    limit: int = 50,
    location: str | None = None,
    exclude_assigned: bool = True,
) -> dict:
    q = db.query(Candidate).filter(Candidate.is_archived.is_(False))
    if location:
        q = q.filter(Candidate.location.ilike(f"%{location}%"))

    candidates = q.all()
    assigned = _assigned_pairs(db) if exclude_assigned else set()
    rejected = _rejected_pairs(db)

    items = []
    scanned = 0
    for candidate in candidates:
        scanned += 1
        if exclude_assigned and (candidate.id, job.id) in assigned:
            continue
        if (candidate.id, job.id) in rejected:
            continue
        result = score_pair(job, candidate)
        if result.overall_score < min_score:
            continue
        items.append({
            "candidate_id": candidate.id,
            "candidate_name": candidate.name,
            "candidate_title": candidate.current_job_title,
            "candidate_email": candidate.email,
            "location": candidate.location,
            "experience_years": candidate.experience_years,
            "skills": candidate.skills or [],
            "match_score": result.overall_score,
            "verdict": result.verdict,
            "matched_skills": result.matched_skills,
            "missing_skills": result.missing_skills,
            "flags": result.flags,
            "calibration": result_to_dict(result),
        })

    items.sort(key=lambda m: m["match_score"], reverse=True)
    return {
        "job_id": job.id,
        "job_title": job.title,
        "screening_questions": job.screening_questions or [],
        "scanned": scanned,
        "matched": len(items),
        "items": items[:limit],
    }
