# Hosting Kelir

One machine runs everything: Postgres, the app (the API, the delivery loop and the built web
app, in one process) and Caddy, which serves it over HTTPS. `docker compose` starts all three.

**Why a machine that is always on:** the delivery loop runs inside the app and checks every 30
seconds for capsules whose midnight has come. A host that puts the app to sleep when idle (the
free tier of most app platforms) would deliver late, so use a small always-on virtual machine.

## What you need

| Thing | Notes |
|---|---|
| A small Linux machine, always on | Free options: Oracle Cloud "Always Free" (needs a card to sign up, and a region with capacity), Google Cloud e2-micro (US regions). 1 GB of memory is enough. |
| A domain name that points at it | Needed for HTTPS and for links in emails. A free subdomain works (for example from duckdns.org): point it at the machine's public IP. |
| Ports 80 and 443 open | In the cloud firewall (security list) and on the machine. Caddy needs 80 to get its certificate. |
| A Gmail account for sending | Turn on 2-Step Verification, then make an App Password. About 500 emails a day. |
| (Optional) Google sign-in | Add the domain as an Authorized JavaScript origin in the Google Cloud console. Without it, people sign in with an emailed code. |

## Steps

On the machine:

```bash
# 1. Install Docker (Ubuntu): https://docs.docker.com/engine/install/ubuntu/
# 2. Get the code
git clone <your repo url> capsule && cd capsule

# 3. Fill in the settings (see the comments inside)
cp deploy.env.example deploy.env
nano deploy.env
ln -s deploy.env .env   # compose fills the ${...} values in docker-compose.yml only from .env

# 4. Start everything
docker compose up -d --build

# 5. Watch it come up
docker compose logs -f app
```

The first start builds the image (a few minutes), creates the database tables
(`alembic upgrade head` runs on every start) and starts the delivery loop. Open
`https://<your domain>`.

## Check it works

1. The welcome page loads over HTTPS.
2. Sign in by email: the code arrives in your inbox (if not: `docker compose logs app`, the
   mailer's error is there).
3. Make a capsule for yourself with "send now" and open the link in the email.
4. `docker compose logs app | grep "Delivery tick"` shows the loop delivering.

## Everyday

```bash
docker compose logs -f app          # what the app says
git pull && docker compose up -d --build   # update to the latest code
docker compose down                 # stop (data stays in the volumes)
```

Data lives in two Docker volumes: `dbdata` (Postgres) and `uploads` (photos, audio, video). Back
them up before you delete a machine: `docker compose exec db pg_dump -U capsule capsule > backup.sql`.

## Settings that matter

- `APP_BASE_URL` must be the public `https://` address. The links in emails use it, and the
  session cookie is only marked secure when it starts with `https://`.
- `DEMO_MODE=true` shows the "Simulate their midnight" button to every signed-in user. Fine for a
  judged demo, off for real use.
- `SESSION_SECRET` signs the session cookie: changing it signs everyone out.

## Not tested yet

The files here (`Dockerfile`, `docker-compose.yml`, `Caddyfile`, `deploy.env.example`) were
written on a machine without Docker, so the image has not been built from them. What was
checked: the web app's production build (`npm run build`) succeeds, and the API serves it.
Expect to fix small things on the first `docker compose up`, and add them to
`devpost/learnings.md`.
