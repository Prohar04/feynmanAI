# Infrastructure Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a working deployed Feynman AI backend on infrastructure that does not expire, then attach the `feynmanai.com` domain and project email.

**Architecture:** The Render Blueprint stops owning the database. Postgres moves to Neon (no expiry); Render keeps the Docker web service and the Key Value instance. Secrets that used to be hardcoded or blueprint-managed become `sync: false` so they are entered in the dashboard. Phase 0a delivers a working API; phase 0b layers on DNS and email.

**Tech Stack:** Render Blueprint (`render.yaml`), Neon Postgres, Render Key Value (Redis), Prisma migrations, Cloudflare DNS + Email Routing, Resend.

**Spec:** `docs/superpowers/specs/2026-11-14-infrastructure-restore-design.md`

---

## Ownership legend

Infrastructure work splits between two actors. Each task says which.

- **[USER]** — requires a dashboard, a purchase, or a secret value. Claude cannot do these: the Render connector exposes no blueprint-creation tool, and secrets must never be pasted into chat.
- **[CLAUDE]** — repository edits and verification through the Render connector and HTTP.

---

# Phase 0a — Working API (no domain required)

## Task 1: Stop the blueprint managing the database and stale URLs [CLAUDE]

**Files:**
- Modify: `render.yaml:5-9` (remove `databases:` block)
- Modify: `render.yaml:35-38` (`DATABASE_URL`)
- Modify: `render.yaml:74-75` (`FRONTEND_URL`)
- Modify: `render.yaml:80-81` (`GOOGLE_CALLBACK_URL`)

**Why:** Re-creating from the current file would provision another free Postgres on a fresh 30-day deletion clock. `FRONTEND_URL` and `GOOGLE_CALLBACK_URL` point at deleted hosts; `FRONTEND_URL` drives the CORS allowlist and the Socket.IO origin check in `server/src/server.ts:25-29`, so a stale value blocks the real frontend.

- [ ] **Step 1: Remove the `databases:` block**

Delete these lines entirely (currently `render.yaml:5-10`, including the blank line after):

```yaml
databases:
  - name: feynman-postgres
    plan: free
    region: oregon
    postgresMajorVersion: "16"

```

The file now begins with the comment header followed directly by `services:`.

- [ ] **Step 2: Make `DATABASE_URL` dashboard-managed**

Replace:

```yaml
      - key: DATABASE_URL
        fromDatabase:
          name: feynman-postgres
          property: connectionString
```

with:

```yaml
      # Neon connection string, entered in the Render dashboard
      - key: DATABASE_URL
        sync: false
```

- [ ] **Step 3: Make `FRONTEND_URL` dashboard-managed**

Replace:

```yaml
      - key: FRONTEND_URL
        value: https://feynman-ai-six.vercel.app
```

with:

```yaml
      # Set once the new frontend is deployed (sub-project 1).
      # Drives CORS and the Socket.IO origin allowlist.
      # localhost:3000/3001/5173 are always allowed by server.ts.
      - key: FRONTEND_URL
        sync: false
```

- [ ] **Step 4: Make `GOOGLE_CALLBACK_URL` dashboard-managed**

Replace:

```yaml
      - key: GOOGLE_CALLBACK_URL
        value: https://feynman-api.onrender.com/api/auth/google/callback
```

with:

```yaml
      # Set after the service URL is known (Task 5), then changed to
      # https://api.feynmanai.com/api/auth/google/callback in Task 8.
      - key: GOOGLE_CALLBACK_URL
        sync: false
```

- [ ] **Step 5: Validate the YAML parses and the database block is gone**

Run:

```bash
cd /Users/prohorsaha/feynmanAI && python3 -c "
import yaml
d = yaml.safe_load(open('render.yaml'))
assert 'databases' not in d, 'databases block still present'
svc = [s for s in d['services'] if s['name'] == 'feynman-api'][0]
env = {e['key']: e for e in svc['envVars']}
for k in ['DATABASE_URL', 'FRONTEND_URL', 'GOOGLE_CALLBACK_URL']:
    assert env[k].get('sync') is False, f'{k} is not sync:false'
    assert 'value' not in env[k], f'{k} still has a hardcoded value'
print('OK: databases removed; DATABASE_URL, FRONTEND_URL, GOOGLE_CALLBACK_URL are sync:false')
"
```

Expected output:

```
OK: databases removed; DATABASE_URL, FRONTEND_URL, GOOGLE_CALLBACK_URL are sync:false
```

- [ ] **Step 6: Commit**

```bash
cd /Users/prohorsaha/feynmanAI && git add render.yaml && git commit -m "Move database and environment URLs out of the blueprint

Render no longer owns the Postgres database; it lives in Neon and the
connection string is entered in the dashboard. FRONTEND_URL and
GOOGLE_CALLBACK_URL pointed at deleted hosts, so both become sync:false
and are set once the new URLs exist." && git push origin main
```

---

## Task 2: Create the Neon database [USER]

**Why:** Neon's free tier does not expire. The previous free Render Postgres was deleted 30 days after creation and all data was lost.

- [ ] **Step 1: Create the project**

Go to https://console.neon.tech, sign up, and create a project. Name it `feynmanai`. Any region is acceptable; choosing one near Oregon keeps latency to the Render service low.

- [ ] **Step 2: Copy the pooled connection string**

From the project dashboard, copy the connection string. It looks like:

```
postgresql://<user>:<password>@<host>.neon.tech/<db>?sslmode=require
```

Prefer the **pooled** connection string if Neon offers both. Prisma opens a connection per request and the pooler handles that better.

- [ ] **Step 3: Keep it out of chat**

Paste it into the Render dashboard in Task 3. Do not paste it into this conversation — it contains a password.

---

## Task 3: Create the Render Blueprint [USER]

**Why:** The Render connector exposes `create_web_service` but no blueprint-creation tool, so this step is the dashboard's.

- [ ] **Step 1: Create the blueprint**

Go to https://dashboard.render.com → **New → Blueprint** → connect `Prohar04/feynmanAI` → branch `main` → **Deploy Blueprint**.

- [ ] **Step 2: Fill the prompted environment variables**

Render prompts for every `sync: false` key. Values come from `~/feynmanAI-env-backup/server.env`.

| Key | Value | Required? |
|---|---|---|
| `DATABASE_URL` | Neon string from Task 2 | **Yes** — server will not start without it |
| `GOOGLE_CLIENT_ID` | from backup | **Yes** — see warning below |
| `GOOGLE_CLIENT_SECRET` | from backup | **Yes** — see warning below |
| `OPEN_ROUTER_APIKEY` | from backup | Yes, for the LLM features to work |
| `UPLOADTHING_TOKEN` | from backup | Yes, for uploads to work |
| `GOOGLE_CALLBACK_URL` | leave blank for now | Set in Task 5 |
| `FRONTEND_URL` | leave blank for now | Set in sub-project 1 |
| `ARCJET_KEY` | leave blank | `src/config/arcjet.ts` has no importers — it is dead code |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` | leave blank for now | Set in Task 9 |

**Warning — `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` must not be blank.** `server/src/config/google.config.ts:12-16` throws at module load if either is missing, and that module is imported through `auth.controller.ts` → `auth.route.ts` → `app.ts`. A blank value crashes the server before it binds a port. Every other blank key is safe: `server/src/config/env.ts` converts empty strings to `undefined` and marks them optional.

`JWT_SECRET`, `REFRESH_JWT_SECRET` and `SESSION_SECRET` are not prompted — Render generates them via `generateValue: true`.

---

## Task 4: Verify the deploy [CLAUDE]

**Why:** Confirm the service is live and the schema was rebuilt, without asking the user to read dashboards.

- [ ] **Step 1: Confirm the service exists and capture its hostname**

Call `list_services` with `workspaceId: tea-darbqfp7lnhs73cp7e20`.

Expected: one service named `feynman-api`. Record `serviceDetails.url` — it may **not** be `https://feynman-api.onrender.com`, because Render appends a suffix when a name is taken. Every later task uses the actual value.

- [ ] **Step 2: Confirm the deploy reached `live`**

Call `list_deploys` with the service id from Step 1 and `limit: 3`.

Expected: the newest deploy has `"status":"live"`. If it is `update_in_progress`, wait and re-check — a cold build takes roughly 4–6 minutes. If it is `update_failed` or `canceled`, go to Step 3 and read the error before changing anything.

- [ ] **Step 3: Confirm migrations ran and the server bound its port**

Call `list_logs` with `resource: [<service id>]`, `type: ["app"]`, `limit: 60`, `direction: "backward"`.

Expected these lines:

```
Database migrations applied
{"level":"info","message":"API server listening on 0.0.0.0:8000",...}
{"level":"info","message":"Connected to Redis",...}
[BullMQ] URL ingest worker is running
[BullMQ] Audio processing worker is running
```

Treat `4 migrations found in prisma/migrations` followed by `No pending migrations to apply.` as wrong at this point — an empty Neon database should report applying all four. If it says none are pending, `DATABASE_URL` is pointing at a database that already has the schema.

- [ ] **Step 4: Confirm the API answers over HTTP**

Run, substituting the hostname from Step 1:

```bash
curl -s -o /dev/null -w "root  HTTP %{http_code}\n" --max-time 60 https://<service-host>/ && curl -s --max-time 60 https://<service-host>/api
```

Expected output:

```
root  HTTP 200
{"success":true,"message":"Tryora API is running!"}
```

The first request after idle may take ~60 s — the free instance sleeps after 15 minutes.

- [ ] **Step 5: Confirm the database is genuinely reachable**

Run, substituting the hostname:

```bash
curl -s --max-time 60 https://<service-host>/health | python3 -m json.tool | head -30
```

Expected: JSON including a `components.database` object with `"status": "ok"`. A 503 with `"error": "System health check timed out"` means the aggregate check exceeded its 8 s ceiling on the 0.1-CPU instance — known behaviour, not a database failure. In that case confirm the database another way: the logs from Step 3 showing migrations applied are sufficient proof.

---

## Task 5: Wire Google OAuth to the real hostname [USER + CLAUDE]

**Why:** `GOOGLE_CALLBACK_URL` was left blank in Task 3. Google rejects any callback whose URI is not registered exactly.

- [ ] **Step 1 [CLAUDE]: Compute the callback URL**

From `server/src/app.ts:98` the auth router mounts at `/api/auth`, and `server/src/routes/auth.route.ts:23` defines `/google/callback`. So the value is:

```
https://<service-host>/api/auth/google/callback
```

Report this exact string to the user.

- [ ] **Step 2 [USER]: Set it in Render**

Render dashboard → `feynman-api` → **Environment** → set `GOOGLE_CALLBACK_URL` to the string from Step 1 → **Save**. Saving triggers a redeploy.

- [ ] **Step 3 [USER]: Register the same URI with Google**

https://console.cloud.google.com → **APIs & Services → Credentials** → your OAuth 2.0 Client → **Authorized redirect URIs** → add the identical string. Also add, for local development:

```
http://localhost:8000/api/auth/google/callback
```

- [ ] **Step 4 [CLAUDE]: Confirm the redeploy went live**

Call `list_deploys` with `limit: 2`. Expected: newest deploy `"status":"live"`.

- [ ] **Step 5 [CLAUDE]: Fix the misleading local-dev fallback**

**Files:**
- Modify: `server/src/config/google.config.ts:8-10`

The fallback omits the `/api` prefix and therefore does not match the real route. Replace:

```ts
const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL ||
  'http://localhost:8000/auth/google/callback';
```

with:

```ts
const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL ||
  'http://localhost:8000/api/auth/google/callback';
```

- [ ] **Step 6 [CLAUDE]: Type-check and commit**

```bash
cd /Users/prohorsaha/feynmanAI/server && npx tsc --noEmit && cd /Users/prohorsaha/feynmanAI && git add server/src/config/google.config.ts && git commit -m "Fix Google callback fallback to include the /api prefix

The default omitted /api and did not match the route mounted at
/api/auth/google/callback, breaking local Google sign-in whenever
GOOGLE_CALLBACK_URL was unset." && git push origin main
```

Expected: `tsc --noEmit` exits 0 with no output.

**Phase 0a is complete.** A working API with a database that will not expire.

---

# Phase 0b — Domain and email

Blocked until the domain is purchased. Phase 0a is fully usable without it.

## Task 6: Buy the domain and move DNS to Cloudflare [USER]

- [ ] **Step 1: Check availability**

Search for `feynmanai.com` at any registrar. If taken, the spec's fallbacks are `feynmanai.study` or `feynman.ai`. **Do not proceed with a name you do not own** — every later task hardcodes it.

Before buying, settle the spelling. The project omits the "e" from *Feynman*. Buying locks that into URLs, email addresses and branding.

- [ ] **Step 2: Buy it**

Cloudflare Registrar sells at cost and keeps DNS in one place. Any registrar works.

- [ ] **Step 3: Add the domain to Cloudflare**

https://dash.cloudflare.com → **Add a site** → enter the domain → choose the **Free** plan → follow the instructions to point your registrar's nameservers at Cloudflare.

- [ ] **Step 4: Wait for activation**

Cloudflare shows "Active" when the nameservers have propagated — usually minutes, occasionally hours. Later tasks fail until this is done.

---

## Task 7: Point `api.feynmanai.com` at Render [USER + CLAUDE]

- [ ] **Step 1 [USER]: Add the custom domain in Render**

Render dashboard → `feynman-api` → **Settings → Custom Domains** → **Add Custom Domain** → `api.feynmanai.com`. Render displays a CNAME target such as `feynman-api.onrender.com`. Copy it.

- [ ] **Step 2 [USER]: Create the DNS record in Cloudflare**

Cloudflare → your domain → **DNS → Records → Add record**:

| Field | Value |
|---|---|
| Type | `CNAME` |
| Name | `api` |
| Target | the host Render showed in Step 1 |
| Proxy status | **DNS only** (grey cloud) |
| TTL | Auto |

**The proxy must be off.** Cloudflare's orange-cloud proxy interferes with Render's certificate issuance and with WebSocket upgrades, which this app needs for Socket.IO.

- [ ] **Step 3 [USER]: Wait for Render to issue the certificate**

Render's Custom Domains panel shows the domain as verified with a certificate issued. Usually a few minutes.

- [ ] **Step 4 [CLAUDE]: Verify the subdomain serves the API**

```bash
curl -s -o /dev/null -w "api.feynmanai.com  HTTP %{http_code}\n" --max-time 60 https://api.feynmanai.com/ && curl -s --max-time 60 https://api.feynmanai.com/api
```

Expected output:

```
api.feynmanai.com  HTTP 200
{"success":true,"message":"Tryora API is running!"}
```

---

## Task 8: Move Google OAuth to the custom domain [USER + CLAUDE]

- [ ] **Step 1 [USER]: Update Render**

Render dashboard → `feynman-api` → **Environment** → set:

```
GOOGLE_CALLBACK_URL = https://api.feynmanai.com/api/auth/google/callback
```

Save. This triggers a redeploy.

- [ ] **Step 2 [USER]: Add the URI in Google Cloud Console**

Add the identical string to **Authorized redirect URIs**. Keep the old `onrender.com` URI until you are confident the domain works, then remove it.

- [ ] **Step 3 [CLAUDE]: Confirm the redeploy went live**

Call `list_deploys` with `limit: 2`. Expected: newest deploy `"status":"live"`.

---

## Task 9: Email — receiving and sending [USER + CLAUDE]

Two independent concerns. Receiving is Cloudflare; sending is Resend.

- [ ] **Step 1 [USER]: Enable Cloudflare Email Routing**

Cloudflare → your domain → **Email → Email Routing** → **Get started**. Cloudflare adds the required MX records automatically. Create two addresses, each forwarding to a mailbox you already read:

```
info@feynmanai.com     → <your existing mailbox>
service@feynmanai.com  → <your existing mailbox>
```

Verify the destination address via the confirmation email Cloudflare sends, or forwarding silently fails.

- [ ] **Step 2 [USER]: Add the domain in Resend**

https://resend.com → sign up → **Domains → Add Domain** → `feynmanai.com`. Resend displays DNS records to add: a DKIM `TXT`, an SPF `TXT`, and optionally a DMARC `TXT`.

- [ ] **Step 3 [USER]: Add Resend's records in Cloudflare**

Add each record exactly as Resend shows it, all with **DNS only** (grey cloud). Then press **Verify** in Resend.

**SPF caution:** a domain may have only one SPF record. Cloudflare Email Routing may have added one in Step 1. If so, merge them into a single record rather than creating a second, for example:

```
v=spf1 include:_spf.mx.cloudflare.net include:amazonses.com ~all
```

Use the exact `include:` value Resend specifies.

- [ ] **Step 4 [USER]: Create a Resend API key**

Resend → **API Keys → Create API Key**, with send permission. Copy it; it is shown once.

- [ ] **Step 5 [USER]: Set the email variables in Render**

Render dashboard → `feynman-api` → **Environment**:

| Key | Value |
|---|---|
| `EMAIL_HOST` | `smtp.resend.com` |
| `EMAIL_PORT` | `465` |
| `EMAIL_SECURE` | `true` |
| `EMAIL_USER` | `resend` |
| `EMAIL_PASS` | the API key from Step 4 |
| `EMAIL_FROM` | `noreply@feynmanai.com` |

Save, which redeploys.

**`EMAIL_FROM` is mandatory here, not optional.** `sendMail.ts` prefers it and falls back to `EMAIL_USER`. With Resend, `EMAIL_USER` is the literal string `resend`, which is not an address — leaving `EMAIL_FROM` blank produces an invalid From header and Resend rejects the message. The address must also be on the domain verified in Step 2.

- [ ] **Step 6 [CLAUDE]: Confirm the redeploy went live**

Call `list_deploys` with `limit: 2`. Expected: newest deploy `"status":"live"`.

- [ ] **Step 7 [USER]: Send a real test**

Register a new account on the deployed app using an address you control, and confirm the verification email arrives. Check the raw headers for `spf=pass` and `dkim=pass`. If it lands in spam, SPF or DKIM is wrong — recheck Step 3.

---

## Task 10: Record the result [CLAUDE]

**Files:**
- Modify: `README.md` (the "Live" table and the Google OAuth section)

- [ ] **Step 1: Update the Live URLs**

Replace the Live table's URLs with the real ones: the frontend row stays as "not yet deployed (sub-project 1)", and the API row becomes `https://api.feynmanai.com`.

- [ ] **Step 2: Update the Google OAuth redirect URIs**

Replace the `onrender.com` URI with:

```
https://api.feynmanai.com/api/auth/google/callback
http://localhost:8000/api/auth/google/callback
```

- [ ] **Step 3: Replace the stale "Known limitations" entry**

The README claims the free Postgres is deleted after 30 days. That no longer applies — the database is Neon. Remove that bullet and leave the others (idle sleep, in-memory sessions, `volatile-lru`, slow `/health`), which are still true.

- [ ] **Step 4: Commit**

```bash
cd /Users/prohorsaha/feynmanAI && git add README.md && git commit -m "Update README for Neon database and feynmanai.com domain" && git push origin main
```

---

## Done when

- `list_services` shows `feynman-api` with a `live` deploy.
- `https://api.feynmanai.com/` returns 200 and `/api` returns the JSON success body.
- Logs show migrations applied, the server listening, Redis connected, and both BullMQ workers running.
- Mail to `info@feynmanai.com` reaches your mailbox.
- A registration email from the app arrives with `spf=pass` and `dkim=pass`.

## Not included

- Frontend build or deployment — sub-project 1. `FRONTEND_URL` stays blank until then. This is deliberate: an empty value means `server/src/server.ts` falls back to allowing only `localhost:3000`, `3001` and `5173`, which is correct while no production frontend exists. Setting it is the first infrastructure step of sub-project 1.
- Voice agent changes — sub-project 2.
- New product features — sub-project 3.
- Recovering the deleted data. It is gone; this restores schema only.
