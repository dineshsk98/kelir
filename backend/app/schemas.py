"""Request and response bodies."""

import uuid

from pydantic import BaseModel


class GoogleSignIn(BaseModel):
    credential: str


class Me(BaseModel):
    id: uuid.UUID
    email: str
    name: str


class PublicConfig(BaseModel):
    google_client_id: str
