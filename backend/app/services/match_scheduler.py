"""Starts the match refresh worker, the nightly rebuild, and the startup backfill."""
from __future__ import annotations

import logging
import threading

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.config import settings
from app.core.database import SessionLocal
from app.services import match_cache_service as cache
from app.services.match_refresh_worker import worker

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def _backfill_if_needed() -> None:
    db = SessionLocal()
    try:
        needed = cache.cache_needs_rebuild(db)
    except Exception:
        logger.exception("Could not check match cache state")
        return
    finally:
        db.close()
    if needed:
        logger.info("Match cache is empty or outdated; queueing full rebuild")
        worker.enqueue_full()


def start() -> None:
    global _scheduler
    worker.start()
    if not settings.MATCH_SCHEDULER_ENABLED:
        return
    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(
        worker.enqueue_full,
        "cron",
        hour=settings.MATCH_REBUILD_HOUR,
        minute=15,
        id="match-nightly-rebuild",
        replace_existing=True,
    )
    _scheduler.start()
    # Off the startup path so a large first backfill never delays boot.
    threading.Thread(target=_backfill_if_needed, name="match-backfill-check", daemon=True).start()


def shutdown() -> None:
    worker.stop()
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
