# Hosting Kelir

One machine runs everything: Postgres, the app (the API, the delivery loop and the built web
app, in one process) and Caddy, which serves it over HTTPS. `docker compose` starts all three.

**Why a machine that is always on:** the delivery loop runs inside the app and checks every 30
seconds for capsules whose midnight has come. A host that puts the app to sleep when idle (the
free tier of most app platforms) would deliver late, so use a small always-on virtual machine.

## What you need

| Thing | Notes |
|---|---|
| A small Linux machine, always on | Any provider, or a spare computer, that runs Docker. 1 GB of memory is enough if you add a swap file (building the image is the heaviest part). |
| A domain name that points at it | Needed for HTTPS and for links in emails. A free subdomain from a dynamic-DNS service works: point it at the machine's public IP. |
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
- `SUPPORT_EMAIL` and `HOSTING_LOCATION` fill in the privacy page (`/privacy`): who to write to, and
  where the server runs (e.g. a provider and country). Set both before publishing the Google
  sign-in screen; empty, the page leaves those lines out.
- `SMTP_HOST` and `SMTP_PORT` default to Gmail (`smtp.gmail.com`, `587`, STARTTLS). Change them
  only to use another mail provider.
- `SESSION_SECRET` signs the session cookie: changing it signs everyone out.

## Automatic checks and updates (any CI service)

Any CI service can do this, because it is only commands. On every push and pull request, run:

1. **Backend tests** (Python 3.11, against a Postgres database; the tests create their own
   `<name>_test` database): `pip install -r backend/requirements.txt`, then `python -m pytest -q`
   from `backend/`, with `DATABASE_URL` (and `TEST_DATABASE_URL`) pointing at that Postgres.
2. **Web app build**: `npm ci` then `npm run build` in `frontend/` (this also type-checks).
3. **Image build**: `docker build .`

Then, on a push to the main branch, update the server with one command:

```bash
cd ~/kelir && git pull --ff-only && docker compose up -d --build
```

Run it over SSH with a key made for this and limited to that one command, so a leaked key can do
nothing else:

```bash
# on the server
ssh-keygen -t ed25519 -C "ci" -f ~/.ssh/ci_key -N ""
echo "command=\"cd ~/kelir && git pull --ff-only && docker compose up -d --build\",restrict $(cat ~/.ssh/ci_key.pub)" >> ~/.ssh/authorized_keys
```

Store four values as secrets in your CI service, never in the repository:
- the private key (`cat ~/.ssh/ci_key` on the server; then `rm ~/.ssh/ci_key` so the only copy is
  in the CI service),
- the server's address and the user name (`whoami`),
- the server's own host key, so a fake server can't take its place:
  `echo "<address> $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)"` on the server.

Connect with strict host-key checking against that host key. The server builds the image itself,
which is slow on 1 GB of memory (the swap file helps); the site keeps serving the old version until
the new one starts.

**GitHub Actions:** `.github/workflows/ci.yml` does all of the above. Add the four values as
repository secrets named `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER` and `DEPLOY_KNOWN_HOSTS`,
then set the repository variable `DEPLOY_ENABLED` to `true`. The deploy job stays off until you do.

## What has been tried

These files have been used to host Kelir on a small Ubuntu machine (1 GB of memory plus a 2 GB swap
file) with a free subdomain: the site came up over HTTPS and the sign-in email arrived. Things that
went wrong on the way are in `devpost/learnings.md`. Not covered here: Google sign-in needs your own
OAuth client (see "What you need"), and capsule emails that link to a free subdomain can land in
spam, so use a domain of your own for real use.
