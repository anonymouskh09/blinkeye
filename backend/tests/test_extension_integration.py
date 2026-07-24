"""End-to-end extension flow tests.

These require a real (throwaway) PostgreSQL database because the models use
JSONB, ARRAY and native ENUM types. They are skipped unless TEST_DATABASE_URL
is set, e.g.:

    set TEST_DATABASE_URL=postgresql://postgres:password@localhost:5432/recruit_test
    pytest tests/test_extension_integration.py
"""
import os

import pytest

TEST_DB = os.getenv("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL not set")


@pytest.fixture
def db_session():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    from app.core.database import Base
    import app.models  # noqa: F401 ensure all models are registered

    engine = create_engine(TEST_DB)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


@pytest.fixture
def client(db_session):
    from fastapi.testclient import TestClient

    import main
    from app.core.database import get_db

    main.app.dependency_overrides[get_db] = lambda: db_session
    yield TestClient(main.app)
    main.app.dependency_overrides.pop(get_db, None)


def _make_user(db_session, role="recruiter"):
    from app.core.security import hash_password
    from app.models.enums import UserRole, UserStatus
    from app.models.user import User

    user = User(
        name="Rec",
        email=f"{role}@agency.com",
        password_hash=hash_password("x"),
        role=UserRole(role),
        status=UserStatus.ACTIVE,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _connect(client, db_session, user):
    from app.services.extension_auth_service import create_auth_code

    code = create_auth_code(db_session, user)
    db_session.commit()
    res = client.post("/api/v1/extension/auth/exchange", json={"code": code})
    assert res.status_code == 200
    return res.json()["data"]


def test_exchange_returns_tokens_and_user(client, db_session):
    user = _make_user(db_session)
    data = _connect(client, db_session, user)
    assert data["access_token"]
    assert data["refresh_token"]
    assert data["user"]["email"] == user.email


def test_import_then_duplicate(client, db_session):
    user = _make_user(db_session)
    tokens = _connect(client, db_session, user)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    payload = {
        "full_name": "Jane Doe",
        "linkedin_url": "https://www.linkedin.com/in/Jane-Doe/?trk=x",
        "email": "jane@example.com",
        "source": "linkedin_extension",
    }
    res = client.post("/api/v1/extension/candidates", json=payload, headers=headers)
    assert res.status_code == 200
    candidate_id = res.json()["data"]["id"]

    # candidate_imported audit entry exists
    from app.models.activity_log import ActivityLog
    from app.models.enums import ActivityAction

    log = (
        db_session.query(ActivityLog)
        .filter(ActivityLog.entity_id == candidate_id, ActivityLog.action == ActivityAction.CANDIDATE_IMPORTED)
        .first()
    )
    assert log is not None

    # Second import with the same (differently-formatted) URL is a duplicate.
    dup = client.post(
        "/api/v1/extension/candidates",
        json={**payload, "linkedin_url": "linkedin.com/in/jane-doe"},
        headers=headers,
    )
    assert dup.status_code == 409
    assert dup.json()["data"]["existing"]["id"] == candidate_id


def test_check_duplicate_endpoint(client, db_session):
    user = _make_user(db_session)
    tokens = _connect(client, db_session, user)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    client.post(
        "/api/v1/extension/candidates",
        json={
            "full_name": "Bob",
            "linkedin_url": "https://www.linkedin.com/in/bob",
            "source": "linkedin_extension",
        },
        headers=headers,
    )
    res = client.get(
        "/api/v1/extension/candidates/check-duplicate",
        params={"linkedin_url": "https://www.linkedin.com/in/bob/"},
        headers=headers,
    )
    assert res.json()["data"]["duplicate"] is True
