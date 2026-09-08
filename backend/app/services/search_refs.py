"""Parse UI reference codes used in the product.

Candidate ref: base36 uppercase, zero-padded to 9 chars (from id).
Job ref: 'Y' + base36 uppercase, zero-padded to 7 chars (from id).
"""


def parse_candidate_ref(term: str) -> int | None:
    raw = (term or "").strip().upper()
    if not raw:
        return None
    if raw.startswith("C-"):
        raw = raw[2:]
    try:
        value = int(raw, 36) if not raw.isdigit() else int(raw)
    except ValueError:
        return None
    return value if value > 0 else None


def parse_job_ref(term: str) -> int | None:
    raw = (term or "").strip().upper()
    if not raw:
        return None
    if raw.startswith("Y"):
        raw = raw[1:]
    elif raw.startswith("J-"):
        raw = raw[2:]
    if not raw:
        return None
    try:
        value = int(raw, 36)
    except ValueError:
        return None
    return value if value > 0 else None


def parse_numeric_id(term: str) -> int | None:
    raw = (term or "").strip()
    if raw.isdigit():
        value = int(raw)
        return value if value > 0 else None
    return None
