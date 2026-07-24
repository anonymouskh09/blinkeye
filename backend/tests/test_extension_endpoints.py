import pytest
from fastapi.testclient import TestClient

import main
from app.core.deps import get_extension_user
from app.core.exceptions import BadRequestException
from app.models.enums import PipelineStage, UserRole
from app.models.user import User
from app.routers.extension import _resolve_owner, _validate_stage


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


def test_stages_are_ordered(auth_client):
    res = auth_client.get("/api/v1/extension/stages")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data[0]["id"] == PipelineStage.APPLIED.value
    assert [s["order"] for s in data] == list(range(len(data)))
    assert data[0]["name"] == "Applied"


def test_tags_returns_empty_list(auth_client):
    res = auth_client.get("/api/v1/extension/tags")
    assert res.status_code == 200
    assert res.json()["data"] == []


def test_me_returns_current_user(auth_client):
    res = auth_client.get("/api/v1/extension/auth/me")
    assert res.status_code == 200
    assert res.json()["data"]["email"] == "rec@agency.com"
    assert res.json()["data"]["role"] == "recruiter"


def test_me_requires_bearer_token(client):
    res = client.get("/api/v1/extension/auth/me")
    assert res.status_code == 401
    assert res.json()["success"] is False


def test_validate_stage():
    assert _validate_stage(None) == PipelineStage.APPLIED
    assert _validate_stage("shortlisted") == PipelineStage.SHORTLISTED
    with pytest.raises(BadRequestException):
        _validate_stage("not-a-stage")


def test_resolve_owner_forces_self_for_recruiter():
    recruiter = _fake_user(UserRole.RECRUITER)
    # owner_id is ignored for recruiters; db is never touched on this path.
    assert _resolve_owner(None, recruiter, owner_id=999) == recruiter.id
    assert _resolve_owner(None, recruiter, owner_id=None) == recruiter.id
