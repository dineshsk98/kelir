"""FastAPI app: the /v1 API plus the built web app from frontend/dist."""

from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse

from app.config import Settings, get_settings
from app.db import engine
from app.routes import auth, capsules


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(title="Birthday Capsule", lifespan=lifespan)
app.include_router(auth.router)
app.include_router(capsules.router)


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
    return FileResponse(index, headers={"Cache-Control": "no-cache"})
