from app.models.match import MatchScore
from tests.match_helpers import (  # noqa: F401  (fixtures)
    db_session,
    make_candidate,
    make_client,
    make_job,
    make_user,
    requires_pg,
)

pytestmark = requires_pg


def _scores(db):
    db.expire_all()
    return {(m.job_id, m.candidate_id): m for m in db.query(MatchScore).all()}


def test_new_job_and_candidate_are_scored_after_commit(db_session):
    admin = make_user(db_session)
    job = make_job(db_session, make_client(db_session, admin))
    cand = make_candidate(db_session, admin)

    scores = _scores(db_session)
    row = scores[(job.id, cand.id)]
    assert row.verdict in {"strong_fit", "good_fit"}
    assert row.must_have_total == 2 and row.must_have_matched == 2
    assert {d["key"] for d in row.dimensions} >= {"must_have_skills", "experience", "salary"}


def test_pairs_below_floor_are_not_stored(db_session):
    admin = make_user(db_session)
    make_job(
        db_session, make_client(db_session, admin), skills=("rust", "go"),
        location="Berlin", min_experience_years=8, title="Staff Rust Engineer",
        nice_to_have_skills=["docker"], salary_min=10000, salary_max=20000,
    )
    # 0 must + 0 nice + 4 exp + 6 title (no data) + 0 location + 1 salary = 11
    make_candidate(
        db_session, admin, skills=("excel",), location="Lahore", experience_years=1, expected_salary=90000,
    )
    assert _scores(db_session) == {}


def test_candidate_skill_edit_rescores_and_keeps_first_matched_at(db_session):
    admin = make_user(db_session)
    job = make_job(db_session, make_client(db_session, admin))
    cand = make_candidate(db_session, admin, skills=("python",))
    before = _scores(db_session)[(job.id, cand.id)]
    first_seen, old_score = before.first_matched_at, before.overall_score

    cand.skills = ["python", "react"]
    db_session.commit()

    after = _scores(db_session)[(job.id, cand.id)]
    assert after.overall_score > old_score
    assert after.first_matched_at == first_seen


def test_irrelevant_edit_does_not_rescore(db_session):
    admin = make_user(db_session)
    job = make_job(db_session, make_client(db_session, admin))
    cand = make_candidate(db_session, admin)
    computed = _scores(db_session)[(job.id, cand.id)].computed_at

    cand.notes = "called, left voicemail"
    db_session.commit()
    assert _scores(db_session)[(job.id, cand.id)].computed_at == computed


def test_archiving_removes_rows_and_unarchiving_restores(db_session):
    from app.models.enums import JobStatus

    admin = make_user(db_session)
    job = make_job(db_session, make_client(db_session, admin))
    cand = make_candidate(db_session, admin)

    cand.is_archived = True
    db_session.commit()
    assert _scores(db_session) == {}
    cand.is_archived = False
    db_session.commit()
    assert (job.id, cand.id) in _scores(db_session)

    job.status = JobStatus.ON_HOLD
    db_session.commit()
    assert _scores(db_session) == {}


def test_job_without_skills_is_not_scored(db_session):
    admin = make_user(db_session)
    make_job(db_session, make_client(db_session, admin), skills=())
    make_candidate(db_session, admin)
    assert _scores(db_session) == {}


def test_rebuild_all_matches_incremental_results_and_clears_stale_rows(db_session):
    from app.services.match_cache_service import cache_needs_rebuild, rebuild_all

    admin = make_user(db_session)
    client = make_client(db_session, admin)
    jobs = [make_job(db_session, client), make_job(db_session, client, skills=("react", "typescript"))]
    for skills in (("python",), ("react", "typescript"), ("python", "react")):
        make_candidate(db_session, admin, skills=skills)
    incremental = {k: v.overall_score for k, v in _scores(db_session).items()}

    # Simulate a stale row from an older formula.
    stale = next(iter(_scores(db_session).values()))
    stale.score_version = 0
    db_session.commit()
    assert cache_needs_rebuild(db_session)

    assert rebuild_all(db_session) == len(incremental)
    rebuilt = {k: v.overall_score for k, v in _scores(db_session).items()}
    assert rebuilt == incremental
    assert not cache_needs_rebuild(db_session)
    assert len(jobs) == 2


def test_permanent_job_delete_cascades(db_session):
    admin = make_user(db_session)
    job = make_job(db_session, make_client(db_session, admin))
    make_candidate(db_session, admin)
    assert _scores(db_session)
    db_session.delete(job)
    db_session.commit()
    assert _scores(db_session) == {}
