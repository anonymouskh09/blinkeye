"""Bearer-wrapped resume parse / attach / update-missing for the extension."""

from io import BytesIO
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

import main
from app.core.deps import get_extension_user
from app.models.enums import UserRole
from app.models.user import User
from app.services.candidate_import_service import fill_missing_fields, apply_parsed_fill_missing
from app.models.candidate import Candidate


def _fake_user(role: UserRole = UserRole.RECRUITER) -> User:
    user = User()
    user.id = 1
    user.name = "Rec Ruiter"
    user.email = "rec@agency.com"
    user.role = role
    return user


@pytest.fixture
def client():
    return TestClient(main.app)


@pytest.fixture
def auth_client(client):
    main.app.dependency_overrides[get_extension_user] = lambda: _fake_user()
    yield client
    main.app.dependency_overrides.pop(get_extension_user, None)


def test_parse_resume_requires_auth(client):
    res = client.post(
        "/api/v1/extension/resumes/parse",
        files={"cv_file": ("cv.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert res.status_code == 401


def test_parse_resume_reuses_parser(auth_client):
    parsed = {
        "name": "Jane Doe",
        "email": "jane@example.com",
        "skills": ["React"],
        "experiences": [],
        "educations": [],
    }

    async def _fake_parse(_file):
        return parsed

    with patch("app.routers.extension.parse_resume_file", new=AsyncMock(side_effect=_fake_parse)):
        res = auth_client.post(
            "/api/v1/extension/resumes/parse",
            files={"cv_file": ("cv.pdf", b"%PDF-1.4 fake", "application/pdf")},
        )
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["data"]["email"] == "jane@example.com"


def test_fill_missing_fields_does_not_overwrite():
    c = Candidate()
    c.name = "Existing"
    c.email = "keep@example.com"
    c.phone = None
    c.location = ""
    c.skills = ["Python"]
    c.experiences = [{"title": "Dev", "company": "A"}]
    c.educations = None
    c.profile_extras = {}

    updated = fill_missing_fields(
        c,
        {
            "name": "New Name",
            "email": "new@example.com",
            "phone": "+1 555",
            "location": "Berlin",
            "skills": ["React"],
            "experiences": [{"title": "Other", "company": "B"}],
            "educations": [{"school": "TU"}],
            "certifications": [{"name": "AWS"}],
            "languages": [{"language": "English"}],
        },
    )
    assert c.name == "Existing"
    assert c.email == "keep@example.com"
    assert c.phone == "+1 555"
    assert c.location == "Berlin"
    assert c.skills == ["Python"]
    assert c.experiences[0]["title"] == "Dev"
    assert c.educations[0]["school"] == "TU"
    assert c.profile_extras["certifications"][0]["name"] == "AWS"
    assert "phone" in updated
    assert "name" not in updated


def test_apply_parsed_fill_missing():
    c = Candidate()
    c.name = "X"
    c.email = ""
    c.phone = None
    c.skills = None
    c.experiences = None
    c.educations = None
    c.profile_extras = {}
    updated = apply_parsed_fill_missing(
        c,
        {
            "email": "a@b.co",
            "skills": ["Go"],
            "profile_extras": {"university": "MIT", "languages": [{"language": "French"}]},
        },
    )
    assert c.email == "a@b.co"
    assert c.skills == ["Go"]
    assert c.profile_extras.get("university") == "MIT"
    assert c.profile_extras.get("languages")[0]["language"] == "French"
    assert "email" in updated


def test_update_missing_fields_endpoint_mocked_db(auth_client):
    candidate = Candidate()
    candidate.id = 42
    candidate.name = "Dup"
    candidate.email = "dup@example.com"
    candidate.created_by = 1
    candidate.phone = None
    candidate.location = None
    candidate.skills = None
    candidate.experiences = None
    candidate.educations = None
    candidate.profile_extras = {}
    candidate.assigned_job_id = None

    class _Q:
        def filter(self, *a, **k):
            return self

        def first(self):
            return candidate

    class _DB:
        def query(self, model):
            return _Q()

        def add(self, *_a, **_k):
            return None

        def flush(self):
            return None

        def commit(self):
            return None

        def refresh(self, *_a, **_k):
            return None

    from app.core.database import get_db

    def _override_db():
        yield _DB()

    main.app.dependency_overrides[get_db] = _override_db
    try:
        res = auth_client.patch(
            "/api/v1/extension/candidates/42/update-missing-fields",
            json={"phone": "+49 1", "location": "Berlin"},
        )
        assert res.status_code == 200
        assert res.json()["data"]["id"] == 42
        assert "phone" in res.json()["data"]["updatedFields"]
        assert candidate.phone == "+49 1"
    finally:
        main.app.dependency_overrides.pop(get_db, None)
