"""Fixtures for tests that need a real PostgreSQL database (TEST_DATABASE_URL).

Modules that define their own `db_session`/`client` fixtures (e.g.
test_extension_integration) keep using theirs; pytest prefers the closest.
"""
import os

import pytest

TEST_DB = os.getenv("TEST_DATABASE_URL")


@pytest.fixture
def db_session(monkeypatch):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    import app.models  # noqa: F401
    import app.services.match_refresh_worker  # noqa: F401  (registers ORM hooks)
    from app.core import database
    from app.core.config import settings
    from app.core.database import Base

    engine = create_engine(TEST_DB)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    # Refresh worker opens its own sessions via SessionLocal.
    database.SessionLocal.configure(bind=engine)
    monkeypatch.setattr(settings, "MATCH_REFRESH_MODE", "sync")
    session = sessionmaker(bind=engine, autoflush=False, autocommit=False)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture
def client(db_session):
    from fastapi.testclient import TestClient

    import main
    from app.core.database import get_db

    main.app.dependency_overrides[get_db] = lambda: db_session
    yield TestClient(main.app)
    main.app.dependency_overrides.pop(get_db, None)
