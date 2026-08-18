# Hotel IT Operations — Active Directory Bridge Agent

This service is the only component that talks to your Domain Controller. It runs
**inside the hotel network**, binds to Active Directory over LDAP/LDAPS, and exposes a
small authenticated JSON API that the web application calls server-side.

```
Browser  ->  Web application  ->  AD Bridge Agent  ->  LDAPS  ->  Active Directory
```

The browser never talks to Active Directory. The Domain Controller is never exposed to
the internet. No Active Directory password is ever stored by the application.

## 1. Requirements

* A Windows or Linux server joined to (or able to reach) the domain
* Node.js 18 or newer
* Network access to the Domain Controller on TCP 636 (LDAPS) or 389 (LDAP)
* A **read-only AD service account** (e.g. `svc-hotelit@hotel.local`)

## 2. Install

```bash
cd ad-bridge-agent
npm install
cp .env.example .env
```

Edit `.env`:

| Variable | Description |
| --- | --- |
| `PORT` | Port the agent listens on (default `8443`) |
| `AD_BRIDGE_TOKEN` | Shared secret — must match the app's `AD_BRIDGE_TOKEN` secret |
| `AD_BIND_PASSWORD` | Password of the AD service account. Stays on this machine. |

Generate a strong token:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 3. Run

```bash
npm start
```

Run it as a service so it survives reboots:

* **Windows** — `npm i -g node-windows`, or use NSSM: `nssm install HotelADBridge "C:\Program Files\nodejs\node.exe" "C:\ad-bridge-agent\server.js"`
* **Linux** — create a `systemd` unit with `Restart=always`

Put the agent behind a TLS reverse proxy (IIS / nginx) so the application reaches it over
HTTPS. Restrict inbound access to the application server's IP only.

## 4. Point the application at the agent

In the web application, set two secrets:

| Secret | Example |
| --- | --- |
| `AD_BRIDGE_URL` | `https://ad-bridge.hotel.local:8443` |
| `AD_BRIDGE_TOKEN` | the same token as in the agent's `.env` |

Then open **Administration → Active Directory**, fill in the domain settings and press
**Test Connection**.

## 5. API (all routes require `Authorization: Bearer <AD_BRIDGE_TOKEN>`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness probe (unauthenticated) |
| POST | `/test-connection` | Service-account bind + directory read check |
| POST | `/test-authentication` | Validate a real user's credentials |
| POST | `/authenticate` | Validate credentials and return the directory record + groups |
| POST | `/sync` | Return all users in the users search base |
| POST | `/groups` | Return AD security groups for role mapping |

## 6. Security notes

* User passwords are used for a single LDAP bind and are never logged or stored.
* The service account password lives only in this agent's `.env`.
* Leave **Certificate Validation** enabled; install your domain CA certificate on this
  server rather than disabling it.
* AD lockout, disabled, expired and must-change-password states are detected and
  reported back to the application's authentication audit log.