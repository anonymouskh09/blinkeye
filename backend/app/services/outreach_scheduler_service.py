import logging

from app.core.database import SessionLocal
from app.services.outreach_service import process_due_enrollments

logger = logging.getLogger(__name__)


def run_outreach_scheduler() -> None:
    db = SessionLocal()
    try:
        import asyncio
        asyncio.run(process_due_enrollments(db))
    except Exception:
        logger.exception("Outreach scheduler failed")
    finally:
        db.close()
