"""Settings, read from the repo-root .env (see .env.example)."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", extra="ignore")

    google_client_id: str = ""
    session_secret: str
    database_url: str

    smtp_user: str = ""
    smtp_app_password: str = ""
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587  # STARTTLS
    app_base_url: str = "http://localhost:8000"
    demo_mode: bool = False
    mailer: Literal["smtp", "console"] = "console"

    session_hours: int = 12  # from sign-in; the cookie itself also ends when the browser closes
    frontend_dist: Path = REPO_ROOT / "frontend" / "dist"
    uploads_dir: Path = REPO_ROOT / "uploads"

    # Shown on the privacy page; empty = the page leaves the contact line / the location out
    support_email: str = ""
    hosting_location: str = ""  # e.g. "Google Cloud, United States"

    # Shown in emails as "<Sender> via <app_name>"
    app_name: str = "Kelir"
    # The delivery loop inside the API process; tests turn it off and run ticks directly
    run_scheduler: bool = True
    scheduler_interval_seconds: float = 30


@lru_cache
def get_settings() -> Settings:
    return Settings()
