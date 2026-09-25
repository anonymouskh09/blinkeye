from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
ENV_FILE = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/recruitment_db"
    JWT_SECRET: str = "change-me-in-production"
    JWT_EXPIRE_MINUTES: int = 1440
    JWT_ALGORITHM: str = "HS256"
    UPLOAD_DIR: str = "./app/uploads"
    CORS_ORIGINS: str = "http://localhost:3000"
    ADMIN_EMAIL: str = "admin@agency.com"
    ADMIN_PASSWORD: str = "Admin123!"
    ENVIRONMENT: str = "development"
    COOKIE_NAME: str = "access_token"

    FRONTEND_URL: str = "http://localhost:3000"

    # Chrome extension auth flow
    EXTENSION_ACCESS_EXPIRE_MINUTES: int = 60
    EXTENSION_REFRESH_EXPIRE_DAYS: int = 30
    EXTENSION_CODE_EXPIRE_SECONDS: int = 300
    # Comma-separated extra CORS origins for the extension (e.g. chrome-extension://<id>).
    EXTENSION_CORS_ORIGINS: str = ""
    # Dev-only: allow the extension to connect with a pasted JWT access token.
    EXTENSION_ALLOW_DEV_TOKEN: bool = False

    # Match score cache (see app/services/match_refresh_worker.py)
    # "async": background thread, "sync": inline after commit (tests), "off".
    MATCH_REFRESH_MODE: str = "async"
    # Nightly full rebuild + startup backfill.
    MATCH_SCHEDULER_ENABLED: bool = True
    MATCH_REBUILD_HOUR: int = 2

    @property
    def cors_origins_list(self) -> list[str]:
        origins = [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        origins += [o.strip() for o in self.EXTENSION_CORS_ORIGINS.split(",") if o.strip()]
        return origins

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"


settings = Settings()
