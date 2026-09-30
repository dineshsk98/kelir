"""The current time as a dependency, so tests can pin it."""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import Depends


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


Now = Annotated[datetime, Depends(utcnow)]
