"""FastAPI app: the /v1 API plus the built web app from frontend/dist."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

from app.config import get_settings
from app.db import engine
from app.routes import auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(title="Birthday Capsule", lifespan=lifespan)
app.include_router(auth.router)


@app.get("/{path:path}", include_in_schema=False)
async def web_app(path: str) -> FileResponse:
    """Serve the built web app; unknown non-API paths get index.html so client routes work."""
    if path == "v1" or path.startswith("v1/"):
        raise HTTPException(404, detail={"code": "NOT_FOUND"})
    dist = get_settings().frontend_dist.resolve()
    index = dist / "index.html"
    if not index.is_file():
        raise HTTPException(404, detail="Web app not built: run `npm run build` in frontend/")
    candidate = (dist / path).resolve()
    if path and candidate.is_file() and candidate.is_relative_to(dist):
        return FileResponse(candidate)
    return FileResponse(index)
