"""Rebuild the whole match score cache synchronously.

    python -m app.core.rebuild_matches
"""
import app.models  # noqa: F401
from app.core.database import SessionLocal
from app.services.match_cache_service import rebuild_all


def main() -> None:
    db = SessionLocal()
    try:
        stored = rebuild_all(db)
    finally:
        db.close()
    if stored is None:
        print("Another rebuild is already running; nothing done.")
    else:
        print(f"Match cache rebuilt: {stored} rows stored.")


if __name__ == "__main__":
    main()
