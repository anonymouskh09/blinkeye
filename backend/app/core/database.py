from sqlalchemy import create_engine, ARRAY as SA_ARRAY
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB, ARRAY as PG_ARRAY

from app.core.config import settings


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@compiles(PG_ARRAY, "sqlite")
@compiles(SA_ARRAY, "sqlite")
def compile_array_sqlite(type_, compiler, **kw):
    return "JSON"


connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

