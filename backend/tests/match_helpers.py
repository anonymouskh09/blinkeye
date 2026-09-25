"""Builders for the match cache and Matches API tests (fixtures live in conftest.py).

Like test_extension_integration, these need a throwaway PostgreSQL database
(JSONB, ARRAY, ON CONFLICT) and are skipped unless TEST_DATABASE_URL is set.
"""
import os
from itertools import count

import pytest

TEST_DB = os.getenv("TEST_DATABASE_URL")
requires_pg = pytest.mark.skipif(not TEST_DB, reason="TEST_DATABASE_URL not set")

_seq = count(1)


def make_user(db, role="admin", **perms):
    from app.core.security import hash_password
    from app.models.enums import UserRole, UserStatus
    from app.models.user import User

    n = next(_seq)
    user = User(
        name=f"{role.title()} {n}",
        email=f"{role}{n}@agency.com",
        password_hash=hash_password("x"),
        role=UserRole(role),
        status=UserStatus.ACTIVE,
        **perms,
    )
    db.add(user)
    db.commit()
    return user


def make_client(db, owner, visibility="public", name=None):
    from app.models.client import Client

    c = Client(company_name=name or f"Client {next(_seq)}", owner_id=owner.id, visibility=visibility)
    db.add(c)
    db.commit()
    return c


def make_job(db, client, skills=("python", "react"), title="Python Developer", **kw):
    from app.models.enums import JobStatus
    from app.models.job import Job

    job = Job(
        title=title,
        client_id=client.id,
        must_have_skills=list(skills),
        status=kw.pop("status", JobStatus.ACTIVE),
        number_of_positions=1,
        **kw,
    )
    db.add(job)
    db.commit()
    return job


def make_candidate(db, creator, skills=("python", "react"), name=None, **kw):
    from app.models.candidate import Candidate

    n = next(_seq)
    cand = Candidate(
        name=name or f"Candidate {n}",
        email=f"cand{n}@mail.com",
        skills=list(skills),
        created_by=creator.id,
        **kw,
    )
    db.add(cand)
    db.commit()
    return cand


def login(client, user):
    from app.core.config import settings
    from app.core.security import create_access_token

    client.cookies.set(settings.COOKIE_NAME, create_access_token({"sub": str(user.id)}))
    return client
