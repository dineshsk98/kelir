# Kelir

Kelir (கேளிர், Tamil for "kin and friends") delivers a birthday capsule (a written message, photos,
voice notes or videos, and an optional gift link or code) by email at 00:00 in the recipient's own
time zone. The recipient signs in with that email address and opens it as a 3D gift box.

Built for the Devpost *Build With AI: Basics* hackathon. The planning documents (scope, PRD,
technical spec, build checklist and build learnings) are in [`devpost/`](devpost/).

## Stack

- **Backend:** Python 3.11, FastAPI, SQLAlchemy 2 (async), Alembic, PostgreSQL. The delivery loop
  runs inside the API process and checks every 30 seconds for capsules whose midnight has come.
- **Frontend:** React 18, TypeScript, Vite, three.js (via `@react-three/fiber`) for the opening.
- **Email:** Gmail SMTP with an app password, or printed to the backend's console for local use.
- **Sign-in:** a one-time code by email, or Google sign-in if a Google OAuth client is configured.

## Run it locally

### 1. Prerequisites

- Python 3.11
- Node.js 22 (with npm)
- PostgreSQL (CI uses 16), with a user that can create databases (the tests make their own)

### 2. Get the code and the dependencies

```bash
git clone https://github.com/dineshsk98/kelir.git
cd kelir
```

Backend (from `backend/`):

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

Frontend (from `frontend/`):

```bash
cd frontend
npm ci
cd ..
```

### 3. Create the database and the settings

Create an empty database, for example:

```bash
createdb kelir
```

Copy `.env.example` to `.env` in the repository root and fill it in. `.env` is gitignored: never
commit it.

| Setting | What to put |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://<user>:<password>@localhost:5432/kelir` |
| `SESSION_SECRET` | any long random string, e.g. from `python -c "import secrets; print(secrets.token_hex(24))"` |
| `MAILER` | `console` to print emails (sign-in codes included) in the backend's terminal; `smtp` to send real ones |
| `SMTP_USER`, `SMTP_APP_PASSWORD` | only with `MAILER=smtp`: a Gmail address and its [app password](https://myaccount.google.com/apppasswords) (needs 2-Step Verification) |
| `APP_BASE_URL` | `http://localhost:8000`: the address the links in emails point at |
| `DEMO_MODE` | `true` shows a "Simulate their midnight" button, so a capsule can be delivered without waiting for a birthday |
| `GOOGLE_CLIENT_ID` | optional. Empty = sign in by emailed code only. To add Google sign-in, create a Web OAuth client in the Google Cloud console with `http://localhost:8000` and `http://localhost:5173` as Authorized JavaScript origins |

Then create the tables (from `backend/`, with the virtual environment active):

```bash
alembic upgrade head
```

### 4. Start it

**Development** (two terminals, hot reload):

```bash
# terminal 1, in backend/
uvicorn app.main:app --reload
```

```bash
# terminal 2, in frontend/
npm run dev
```

Open <http://localhost:5173>. Vite forwards `/v1` requests to the API on port 8000.

**One server** (as for a demo):

```bash
# in frontend/
npm run build
# in backend/
uvicorn app.main:app --host 0.0.0.0
```

Open <http://localhost:8000>: the API serves the built web app too.

### 5. Try it

1. Sign in: enter your email, then the code (with `MAILER=console` it is printed in the backend's
   terminal).
2. Make a capsule for yourself: your own email, a city, a message, maybe a photo or a voice note.
   Choose "Send now", or keep the birthday and, with `DEMO_MODE=true`, press "Simulate their
   midnight" in the Sent list or on the capsule's page.
3. Open the link from the email (printed in the terminal with `MAILER=console`) and open the gift.

`/dev/reveal` shows the opening with sample data, without signing in (development server only).

## Tests

From `backend/`, with the virtual environment active and `.env` in place:

```bash
python -m pytest
```

The tests create and migrate their own database, `<your database>_test`, next to the one in
`DATABASE_URL` (or the one in `TEST_DATABASE_URL`, if set). The web app is type-checked by its
build: `npm run build` in `frontend/`.

GitHub Actions runs both, plus a Docker image build, on every push and pull request
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Hosting

[`DEPLOY.md`](DEPLOY.md) runs the whole app on one Linux machine with Docker Compose: PostgreSQL,
the app, and Caddy for HTTPS. It also covers optional automatic updates from CI.

## Project layout

```
backend/    FastAPI app (app/), Alembic migrations (alembic/), tests (tests/)
frontend/   React web app (src/), static files and city data (public/)
scripts/    build_cities.py: regenerates frontend/public/cities.json from GeoNames
devpost/    hackathon planning documents and build learnings
```

## Credits and license

City data from [GeoNames](https://www.geonames.org/) (CC BY 4.0); fonts under the SIL Open Font
License; CC0 photos. Details in [`ATTRIBUTION.md`](ATTRIBUTION.md).

The code is licensed under the GNU Affero General Public License v3.0 ([`LICENSE`](LICENSE)). The
name "Kelir" and its logo are not licensed for reuse.
