from app.models.activity_log import ActivityLog
from app.models.candidate_job import CandidateJobAssignment
from app.models.enums import PipelineStage
from app.models.match import MatchDismissal
from tests.match_helpers import (
    login,
    make_candidate,
    make_client,
    make_job,
    make_user,
    requires_pg,
)

pytestmark = requires_pg


def _world(db):
    """Admin, a public and a private client, two jobs each, a spread of candidates."""
    admin = make_user(db)
    pub = make_client(db, admin, name="Public Co")
    priv = make_client(db, admin, visibility="private", name="Private Co")
    py = make_job(db, pub, skills=("python", "django"), title="Python Developer")
    fe = make_job(db, pub, skills=("react", "typescript"), title="Frontend Developer")
    secret = make_job(db, priv, skills=("python", "django"), title="Python Lead")
    cands = {
        "ali": make_candidate(db, admin, skills=("python", "django"), name="Ali Raza", current_job_title="Python Developer"),
        "sara": make_candidate(db, admin, skills=("python",), name="Sara Khan"),
        "john": make_candidate(db, admin, skills=("react", "typescript"), name="John Smith"),
    }
    return admin, pub, priv, py, fe, secret, cands


def _items(res):
    assert res.status_code == 200, res.text
    return res.json()["data"]["items"]


def test_list_returns_breakdown_sorted_by_score(client, db_session):
    admin, _, _, py, _, _, c = _world(db_session)
    items = _items(login(client, admin).get("/matches", params={"min_score": 20}))
    scores = [m["match_score"] for m in items]
    assert scores == sorted(scores, reverse=True)
    top = next(m for m in items if m["job_id"] == py.id and m["candidate_id"] == c["ali"].id)
    assert top["verdict"] == "strong_fit"
    assert top["must_have_matched"] == top["must_have_total"] == 2
    assert {d["key"] for d in top["dimensions"]} == {
        "must_have_skills", "nice_to_have_skills", "experience", "title", "location", "salary",
    }
    assert top["is_new"] is True and top["dismissal"] is None


def test_filters_and_pagination(client, db_session):
    admin, _, priv, py, _, _, c = _world(db_session)
    login(client, admin)

    by_job = _items(client.get("/matches", params={"job_id": py.id, "min_score": 20}))
    assert by_job and {m["job_id"] for m in by_job} == {py.id}

    assert {m["client_id"] for m in _items(client.get("/matches", params={"client_id": priv.id, "min_score": 20}))} == {priv.id}

    strong = _items(client.get("/matches", params=[("verdict", "strong_fit"), ("min_score", 20)]))
    assert strong and all(m["verdict"] == "strong_fit" for m in strong)

    musts = _items(client.get("/matches", params={"must_have_only": True, "min_score": 20}))
    assert musts and all(m["must_have_matched"] == m["must_have_total"] for m in musts)
    assert c["sara"].id not in {m["candidate_id"] for m in musts if m["job_id"] == py.id}

    assert {m["candidate_id"] for m in _items(client.get("/matches", params={"q": "john", "min_score": 20}))} == {c["john"].id}

    all_ids = [m["id"] for m in _items(client.get("/matches", params={"min_score": 20, "page_size": 100}))]
    paged = []
    for page in (1, 2, 3, 4):
        res = client.get("/matches", params={"min_score": 20, "page_size": 2, "page": page})
        paged += [m["id"] for m in _items(res)]
    assert paged == all_ids[: len(paged)] and len(set(paged)) == len(paged)
    assert res.json()["data"]["total"] == len(all_ids)


def test_summary_and_by_job(client, db_session):
    admin, _, _, py, _, _, _ = _world(db_session)
    login(client, admin)
    items = _items(client.get("/matches", params={"min_score": 20, "page_size": 100}))
    summary = client.get("/matches/summary", params={"min_score": 20}).json()["data"]
    assert summary["total"] == len(items)
    assert summary["strong_fit"] == sum(m["verdict"] == "strong_fit" for m in items)
    assert summary["jobs_with_matches"] == len({m["job_id"] for m in items})

    grouped = client.get("/matches/by-job", params={"min_score": 20, "per_job": 1}).json()["data"]
    assert grouped["total"] == summary["jobs_with_matches"]
    assert all(len(g["items"]) == 1 for g in grouped["items"])
    py_group = next(g for g in grouped["items"] if g["job_id"] == py.id)
    assert py_group["items"][0]["match_score"] == py_group["top_score"]


def test_recruiter_scoping_and_permissions(client, db_session):
    admin, _, priv, _, _, secret, c = _world(db_session)
    rec = make_user(db_session, role="recruiter")
    login(client, rec)
    visible_jobs = {m["job_id"] for m in _items(client.get("/matches", params={"min_score": 20}))}
    assert secret.id not in visible_jobs and visible_jobs

    # Candidates tied to a hidden client's job are hidden too.
    db_session.add(CandidateJobAssignment(
        candidate_id=c["john"].id, job_id=secret.id, status=PipelineStage.APPLIED, assigned_recruiter_id=admin.id,
    ))
    db_session.commit()
    assert c["john"].id not in {m["candidate_id"] for m in _items(client.get("/matches", params={"min_score": 20}))}

    # Joining the private client's team reveals its job.
    from app.models.client_team import ClientTeamMember
    db_session.add(ClientTeamMember(client_id=priv.id, user_id=rec.id))
    db_session.commit()
    assert secret.id in {m["job_id"] for m in _items(client.get("/matches", params={"min_score": 20}))}

    # Acting on a job you cannot see is refused per pair.
    outsider = make_user(db_session, role="recruiter")
    res = login(client, outsider).post(
        "/matches/shortlist", json={"pairs": [{"job_id": secret.id, "candidate_id": c["ali"].id}]}
    )
    assert res.json()["data"]["skipped"][0]["reason"] == "no_access"

    blind = make_user(db_session, role="recruiter", can_view_candidates=False)
    assert login(client, blind).get("/matches").status_code == 403


def test_shortlist_moves_to_first_stage_once_and_logs(client, db_session):
    admin, _, _, py, _, _, c = _world(db_session)
    login(client, admin)
    pair = {"job_id": py.id, "candidate_id": c["ali"].id}

    res = client.post("/matches/shortlist", json={"pairs": [pair, pair]})
    data = res.json()["data"]
    assert len(data["added"]) == 1 and data["skipped"] == []
    assignment = db_session.query(CandidateJobAssignment).filter_by(**pair).one()
    assert assignment.status == PipelineStage.APPLIED

    again = client.post("/matches/shortlist", json={"pairs": [pair]}).json()["data"]
    assert again["skipped"] == [{**pair, "reason": "already_in_pipeline"}]
    listed = {(m["job_id"], m["candidate_id"]) for m in _items(client.get("/matches", params={"min_score": 20}))}
    assert (py.id, c["ali"].id) not in listed

    logs = db_session.query(ActivityLog).filter(ActivityLog.description.like("%shortlisted from Matches%")).all()
    logs += db_session.query(ActivityLog).filter(ActivityLog.description.like("Shortlisted from Matches%")).all()
    assert {(l.entity_type.value, l.entity_id) for l in logs} == {("candidate", c["ali"].id), ("job", py.id)}
    assert client.get("/matches/summary").json()["data"]["shortlisted_this_week"] == 1


def test_dismiss_undo_keeps_history(client, db_session):
    admin, _, _, py, _, _, c = _world(db_session)
    login(client, admin)
    pair = {"job_id": py.id, "candidate_id": c["sara"].id}

    assert client.post("/matches/dismiss", json={"pairs": [pair], "reason": "other"}).status_code == 422
    res = client.post("/matches/dismiss", json={"pairs": [pair], "reason": "salary_mismatch", "note": "wants 2x"})
    did = res.json()["data"]["dismissed"][0]["id"]
    dup = client.post("/matches/dismiss", json={"pairs": [pair], "reason": "not_a_fit"}).json()["data"]
    assert dup["skipped"][0]["reason"] == "already_dismissed"

    active = {(m["job_id"], m["candidate_id"]) for m in _items(client.get("/matches", params={"min_score": 20}))}
    assert (py.id, c["sara"].id) not in active
    dismissed = _items(client.get("/matches", params={"status": "dismissed", "min_score": 20}))
    assert dismissed[0]["dismissal"]["reason"] == "salary_mismatch"
    assert dismissed[0]["dismissal"]["dismissed_by_name"] == admin.name

    undo = client.post("/matches/dismissals/undo", json={"ids": [did, did]}).json()["data"]
    assert [r["id"] for r in undo["restored"]] == [did]
    assert (py.id, c["sara"].id) in {
        (m["job_id"], m["candidate_id"]) for m in _items(client.get("/matches", params={"min_score": 20}))
    }
    row = db_session.get(MatchDismissal, did)
    db_session.refresh(row)
    assert row.undone_by == admin.id and row.undone_at is not None
    # Can be dismissed again after undo (history keeps both rows).
    client.post("/matches/dismiss", json={"pairs": [pair], "reason": "not_a_fit"})
    assert db_session.query(MatchDismissal).filter_by(**pair).count() == 2
    descs = [l.description for l in db_session.query(ActivityLog).filter(ActivityLog.entity_id == c["sara"].id)]
    assert any("dismissed: Salary mismatch — wants 2x" in d for d in descs)
    assert any("restored" in d for d in descs)


def test_export_status_filters_and_legacy_endpoint(client, db_session):
    admin, _, _, py, _, _, _ = _world(db_session)
    login(client, admin)
    res = client.get("/matches/export.csv", params={"job_id": py.id, "min_score": 20})
    assert res.status_code == 200 and res.headers["content-type"].startswith("text/csv")
    lines = res.text.strip().splitlines()
    assert lines[0].startswith("Candidate,") and len(lines) >= 2

    status = client.get("/matches/status").json()["data"]
    assert status["jobs_with_skills"] == 3 and status["last_computed_at"]
    assert {r["value"] for r in status["dismiss_reasons"]} >= {"not_a_fit", "other"}

    opts = client.get("/matches/filter-options").json()["data"]
    assert {j["id"] for j in opts["jobs"]} >= {py.id} and opts["clients"]

    legacy = client.get("/recruitment/matches").json()["data"]["items"]
    assert legacy and {"candidate_name", "job_title", "match_score", "matched_skills"} <= set(legacy[0])

    assert client.post("/matches/recalculate").status_code == 200
    rec = make_user(db_session, role="recruiter")
    assert login(client, rec).post("/matches/recalculate").status_code == 403


def test_detail_tabs_read_cache_and_respect_dismissals(client, db_session):
    admin, _, _, py, _, secret, c = _world(db_session)
    login(client, admin)
    res = client.get(f"/matching/jobs/{py.id}/candidates", params={"min_score": 20}).json()["data"]
    ids = [m["candidate_id"] for m in res["items"]]
    assert c["ali"].id in ids and res["scanned"] == 3 and res["matched"] == len(ids)
    first = res["items"][0]
    assert first["calibration"]["overall_score"] == first["match_score"]

    client.post("/matches/dismiss", json={"pairs": [{"job_id": py.id, "candidate_id": c["ali"].id}], "reason": "not_a_fit"})
    ids = [m["candidate_id"] for m in client.get(f"/matching/jobs/{py.id}/candidates", params={"min_score": 20}).json()["data"]["items"]]
    assert c["ali"].id not in ids

    # Legacy per-job shortlist goes through the same audited action.
    res = client.post(f"/matching/jobs/{py.id}/shortlist", json={"candidate_ids": [c["sara"].id]})
    assert res.json()["data"]["added"] == [c["sara"].id]
    assert client.post(f"/matching/jobs/{py.id}/shortlist", json={"candidate_ids": [c["sara"].id]}).status_code == 400

    # Candidate tab hides jobs of clients the recruiter cannot see.
    rec = make_user(db_session, role="recruiter")
    jobs = login(client, rec).get(f"/matching/candidates/{c['ali'].id}/jobs", params={"min_score": 20}).json()["data"]
    assert secret.id not in {j["job_id"] for j in jobs["items"]} and jobs["items"]
    assert jobs["scanned"] == 2
