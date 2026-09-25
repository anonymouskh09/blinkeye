"""Background refresh of the match score cache.

ORM session hooks watch for committed changes to jobs and candidates (from any
router, the Chrome extension, imports…) and queue a rescore of just that row.
A single daemon thread drains the queue, so a request never waits on scoring
and refreshes never race each other inside one process.

`MATCH_REFRESH_MODE` controls behaviour: "async" (default) uses the worker
thread, "sync" rescores inline right after commit (tests), "off" disables
automatic refresh (the nightly rebuild still runs).
"""
from __future__ import annotations

import logging
import threading
import time
from datetime import datetime, timezone

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.candidate import Candidate
from app.models.job import Job
from app.services import match_cache_service as cache

logger = logging.getLogger(__name__)

# Columns that feed score_pair (plus the flags that decide whether a row is
# scored at all). Edits to anything else do not trigger a rescore.
JOB_FIELDS = {
    "title", "status", "must_have_skills", "required_skills", "nice_to_have_skills",
    "min_experience_years", "max_experience_years", "location", "salary_min", "salary_max",
}
CANDIDATE_FIELDS = {
    "skills", "experience_years", "current_job_title", "headline", "experiences",
    "location", "salary_min", "salary_max", "expected_salary", "is_archived",
}

_DEBOUNCE_SECONDS = 1.0


class MatchRefreshWorker:
    def __init__(self) -> None:
        self._lock = threading.Condition()
        self._jobs: set[int] = set()
        self._candidates: set[int] = set()
        self._full = False
        self._thread: threading.Thread | None = None
        self._stop = False
        self.busy = False
        self.last_error: str | None = None
        self.last_full_rebuild_at: datetime | None = None

    # -- queueing ---------------------------------------------------------
    def enqueue(self, job_ids: set[int] = frozenset(), candidate_ids: set[int] = frozenset()) -> None:
        if not job_ids and not candidate_ids:
            return
        if settings.MATCH_REFRESH_MODE == "sync":
            self._run(set(job_ids), set(candidate_ids), full=False)
            return
        with self._lock:
            self._jobs |= set(job_ids)
            self._candidates |= set(candidate_ids)
            self._lock.notify()

    def enqueue_full(self) -> None:
        if settings.MATCH_REFRESH_MODE == "sync":
            self._run(set(), set(), full=True)
            return
        with self._lock:
            self._full = True
            self._lock.notify()

    @property
    def pending(self) -> dict:
        with self._lock:
            return {"jobs": len(self._jobs), "candidates": len(self._candidates), "full_rebuild": self._full}

    # -- lifecycle --------------------------------------------------------
    def start(self) -> None:
        if settings.MATCH_REFRESH_MODE != "async" or (self._thread and self._thread.is_alive()):
            return
        self._stop = False
        self._thread = threading.Thread(target=self._loop, name="match-refresh", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        with self._lock:
            self._stop = True
            self._lock.notify()

    def _loop(self) -> None:
        while True:
            with self._lock:
                while not (self._stop or self._full or self._jobs or self._candidates):
                    self._lock.wait()
                if self._stop:
                    return
            # Let a burst of edits (bulk import, a form saving twice) coalesce.
            time.sleep(_DEBOUNCE_SECONDS)
            with self._lock:
                full, jobs, cands = self._full, self._jobs, self._candidates
                self._full, self._jobs, self._candidates = False, set(), set()
            self._run(jobs, cands, full)

    def _run(self, job_ids: set[int], candidate_ids: set[int], full: bool) -> None:
        self.busy = True
        db = SessionLocal()
        try:
            if full:
                cache.rebuild_all(db)
                self.last_full_rebuild_at = datetime.now(timezone.utc)
                return
            for jid in sorted(job_ids):
                cache.refresh_for_job(db, jid)
            for cid in sorted(candidate_ids):
                cache.refresh_for_candidate(db, cid)
            self.last_error = None
        except Exception as exc:  # keep the worker alive; nightly rebuild heals
            db.rollback()
            self.last_error = str(exc)
            logger.exception("Match cache refresh failed")
        finally:
            db.close()
            self.busy = False


worker = MatchRefreshWorker()


# -- ORM hooks ------------------------------------------------------------
def _changed(obj, fields: set[str]) -> bool:
    state = inspect(obj)
    return any(state.attrs[f].history.has_changes() for f in fields if f in state.attrs)


@event.listens_for(Session, "after_flush")
def _collect_changes(session: Session, flush_context) -> None:
    if settings.MATCH_REFRESH_MODE == "off":
        return
    pending = session.info.setdefault("match_refresh", {"jobs": set(), "candidates": set()})
    for obj in session.new:
        if isinstance(obj, Job):
            pending["jobs"].add(obj.id)
        elif isinstance(obj, Candidate):
            pending["candidates"].add(obj.id)
    for obj in session.dirty:
        if isinstance(obj, Job) and _changed(obj, JOB_FIELDS):
            pending["jobs"].add(obj.id)
        elif isinstance(obj, Candidate) and _changed(obj, CANDIDATE_FIELDS):
            pending["candidates"].add(obj.id)
    # Deleted rows cascade out of match_scores at the database level.


@event.listens_for(Session, "after_commit")
def _dispatch_changes(session: Session) -> None:
    pending = session.info.pop("match_refresh", None)
    if pending:
        worker.enqueue(pending["jobs"], pending["candidates"])


@event.listens_for(Session, "after_rollback")
def _drop_changes(session: Session) -> None:
    session.info.pop("match_refresh", None)
