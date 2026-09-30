"""FastAPI app: the /v1 API, the delivery loop, and the built web app from frontend/dist."""

import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse

from app.config import Settings, get_settings
from app.db import SessionLocal, engine
from app.delivery.mailer import get_mailer
from app.delivery.scheduler import delivery_loop
from app.routes import auth, capsules, demo, recipient

logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    loop_task = None
    if settings.run_scheduler:
        loop_task = asyncio.create_task(delivery_loop(SessionLocal, get_mailer(), settings))
    yield
    if loop_task:
        loop_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await loop_task
    await engine.dispose()


app = FastAPI(title="Birthday Capsule", lifespan=lifespan)
app.include_router(auth.router)
app.include_router(capsules.router)
app.include_router(recipient.router)
app.include_router(demo.router)


@app.get("/{path:path}", include_in_schema=False)
async def web_app(path: str, settings: Annotated[Settings, Depends(get_settings)]) -> FileResponse:
    """Serve the built web app; unknown non-API paths get index.html so client routes work."""
    if path == "v1" or path.startswith("v1/"):
        raise HTTPException(404, detail={"code": "NOT_FOUND"})
    dist = settings.frontend_dist.resolve()
    index = dist / "index.html"
    if not index.is_file():
        raise HTTPException(404, detail="Web app not built: run `npm run build` in frontend/")
    candidate = (dist / path).resolve()
    if path and candidate.is_file() and candidate.is_relative_to(dist):
        # Vite puts a content hash in every file name under assets/, so those never change
        immutable = candidate.is_relative_to(dist / "assets")
        cache = "public, max-age=31536000, immutable" if immutable else "no-cache"
        return FileResponse(candidate, headers={"Cache-Control": cache})
    # index.html names the current build's assets: always revalidate so a new build is picked up
    headers = {"Cache-Control": "no-cache"}
    if path.startswith("c/"):
        # A private capsule page: keep it out of search engines, and never leak its
        # URL (the link secret) to sites it links to, such as a gift link.
        headers |= {"X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer"}
    return FileResponse(index, headers=headers)
