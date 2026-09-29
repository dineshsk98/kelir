"""Test setup: a real Postgres test database (<dev db>_test), migrated with Alembic.

The database login comes from DATABASE_URL in .env; TEST_DATABASE_URL overrides.
"""

import asyncio
import os
from argparse import Namespace
from pathlib import Path

# Must be set before the app (and its cached settings) are imported.
os.environ["SESSION_SECRET"] = "test-session-secret"
os.environ["GOOGLE_CLIENT_ID"] = ""
os.environ["MAILER"] = "console"

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import make_url, text  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

from app.config import Settings, get_settings  # noqa: E402
from app.db import get_session  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402

BACKEND = Path(__file__).resolve().parents[1]


def _test_db_url() -> str:
    if url := os.environ.get("TEST_DATABASE_URL"):
        return url
    url = make_url(get_settings().database_url)
    return url.set(database=f"{url.database}_test").render_as_string(hide_password=False)


TEST_DB_URL = _test_db_url()


async def _create_database_if_missing() -> None:
    url = make_url(TEST_DB_URL)
    admin = create_async_engine(
        url.set(database="postgres"), isolation_level="AUTOCOMMIT", poolclass=NullPool
    )
    async with admin.connect() as conn:
        exists = await conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": url.database}
        )
        if not exists:
            await conn.execute(text(f'CREATE DATABASE "{url.database}"'))
    await admin.dispose()


@pytest.fixture(scope="session")
def migrated_db() -> str:
    asyncio.run(_create_database_if_missing())
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "alembic"))
    cfg.cmd_opts = Namespace(x=[f"url={TEST_DB_URL}"])
    command.upgrade(cfg, "head")
    return TEST_DB_URL


@pytest.fixture
async def sessionmaker(migrated_db):
    engine = create_async_engine(migrated_db, poolclass=NullPool)
    yield async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        tables = ", ".join(t.name for t in reversed(Base.metadata.sorted_tables))
        await conn.execute(text(f"TRUNCATE {tables} CASCADE"))
    await engine.dispose()


@pytest.fixture
def settings() -> Settings:
    return Settings(google_client_id="test-client-id.apps.googleusercontent.com")


@pytest.fixture
async def client(sessionmaker, settings):
    async def override_session():
        async with sessionmaker() as session:
            yield session

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_settings] = lambda: settings
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as c:
        yield c
    app.dependency_overrides.clear()
