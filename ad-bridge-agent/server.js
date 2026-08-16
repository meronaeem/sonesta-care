/**
 * Hotel IT Operations — On-premises Active Directory Bridge
 * ---------------------------------------------------------
 * Runs INSIDE the hotel network, on a server that can reach a Domain
 * Controller. Speaks LDAP/LDAPS to Active Directory and exposes a small
 * HTTPS/JSON API to the web application.
 *
 * Security model:
 *   - Every request must carry `Authorization: Bearer <AD_BRIDGE_TOKEN>`.
 *   - The AD service-account (bind) password NEVER leaves this machine:
 *     it lives in this agent's .env file only.
 *   - End-user passwords are used for a single LDAP bind and are never
 *     logged, cached or persisted.
 *   - The Domain Controller is never exposed to the public internet;
 *     only this agent talks to it.
 */
import express from "express";
import { Client } from "ldapts";

const PORT = Number(process.env.PORT || 8443);
const BRIDGE_TOKEN = process.env.AD_BRIDGE_TOKEN || "";
const BIND_PASSWORD = process.env.AD_BIND_PASSWORD || "";

if (!BRIDGE_TOKEN) {
  console.error("FATAL: AD_BRIDGE_TOKEN is not set. Refusing to start.");
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  if (req.path === "/health") return next();
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || token !== BRIDGE_TOKEN) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  next();
});

// ---------------------------------------------------------------- helpers

const USER_ATTRS = [
  "sAMAccountName",
  "userPrincipalName",
  "displayName",
  "givenName",
  "sn",
  "mail",
  "employeeID",
  "department",
  "title",
  "company",
  "telephoneNumber",
  "mobile",
  "physicalDeliveryOfficeName",
  "manager",
  "memberOf",
  "userAccountControl",
  "lastLogonTimestamp",
  "distinguishedName",
  "objectGUID",
];

function ldapUrl(cfg) {
  const useSsl = cfg.sslEnabled !== false;
  const host = cfg.ldapHost;
  const port = useSsl ? cfg.ldapsPort || 636 : cfg.ldapPort || 389;
  return `${useSsl ? "ldaps" : "ldap"}://${host}:${port}`;
}

function makeClient(cfg) {
  const useSsl = cfg.sslEnabled !== false;
  return new Client({
    url: ldapUrl(cfg),
    timeout: 15000,
    connectTimeout: 15000,
    tlsOptions: useSsl
      ? { rejectUnauthorized: cfg.validateCertificate !== false, servername: cfg.ldapHost }
      : undefined,
  });
}

/** Escapes a value for safe use inside an LDAP search filter (RFC 4515). */
function esc(value) {
  return String(value ?? "").replace(/[\\*()\u0000]/g, (c) => "\\" + c.charCodeAt(0).toString(16).padStart(2, "0"));
}

/** Accepts `user`, `DOMAIN\user` and `user@domain.local`. */
function parseUsername(raw, cfg) {
  const input = String(raw || "").trim();
  let sam = input;
  if (input.includes("\\")) sam = input.split("\\").pop();
  else if (input.includes("@")) sam = input.split("@")[0];
  const domain = cfg.domainName || "";
  return {
    sam,
    upn: input.includes("@") ? input : domain ? `${sam}@${domain}` : sam,
    down: domain ? `${domain.split(".")[0].toUpperCase()}\\${sam}` : sam,
  };
}

function first(v) {
  if (Array.isArray(v)) return v.length ? String(v[0]) : null;
  if (v === undefined || v === null || v === "") return null;
  return String(v);
}

function many(v) {
  if (!v) return [];
  return (Array.isArray(v) ? v : [v]).map(String);
}

/** `CN=IT-Admins,OU=Groups,DC=hotel,DC=local` -> `IT-Admins` */
function cnOf(dn) {
  if (!dn) return null;
  const m = /^CN=([^,]+)/i.exec(String(dn));
  return m ? m[1].replace(/\\,/g, ",") : String(dn);
}

/** Windows FILETIME (100ns since 1601) -> ISO string */
function fileTimeToIso(value) {
  const n = Number(value);
  if (!n || Number.isNaN(n)) return null;
  const ms = n / 10000 - 11644473600000;
  if (ms <= 0) return null;
  return new Date(ms).toISOString();
}

const UAC = { DISABLED: 0x0002, LOCKOUT: 0x0010, PWD_EXPIRED: 0x800000 };

function mapUser(entry) {
  const uac = Number(first(entry.userAccountControl) || 0);
  return {
    samAccountName: first(entry.sAMAccountName),
    userPrincipalName: first(entry.userPrincipalName),
    displayName: first(entry.displayName),
    givenName: first(entry.givenName),
    surname: first(entry.sn),
    mail: first(entry.mail),
    employeeId: first(entry.employeeID),
    department: first(entry.department),
    title: first(entry.title),
    company: first(entry.company),
    telephoneNumber: first(entry.telephoneNumber),
    mobile: first(entry.mobile),
    office: first(entry.physicalDeliveryOfficeName),
    managerDn: first(entry.manager),
    managerName: cnOf(first(entry.manager)),
    memberOf: many(entry.memberOf).map(cnOf).filter(Boolean),
    memberOfDn: many(entry.memberOf),
    userAccountControl: uac,
    accountEnabled: (uac & UAC.DISABLED) === 0,
    accountLocked: (uac & UAC.LOCKOUT) !== 0,
    lastLogonTimestamp: fileTimeToIso(first(entry.lastLogonTimestamp)),
    dn: first(entry.dn) || first(entry.distinguishedName),
  };
}

/** Translates raw AD bind errors into safe, user-meaningful reasons. */
function bindFailureReason(err) {
  const msg = String(err?.message || "");
  if (/data 775/.test(msg)) return { code: "account_locked", message: "Account is locked out in Active Directory." };
  if (/data 533/.test(msg)) return { code: "account_disabled", message: "Account is disabled in Active Directory." };
  if (/data 701/.test(msg)) return { code: "account_expired", message: "Account has expired." };
  if (/data 773/.test(msg)) return { code: "password_must_change", message: "Password must be changed before signing in." };
  if (/data 532/.test(msg)) return { code: "password_expired", message: "Password has expired." };
  if (/data 52e/.test(msg)) return { code: "invalid_credentials", message: "Invalid username or password." };
  if (/data 525/.test(msg)) return { code: "invalid_credentials", message: "Invalid username or password." };
  if (/InvalidCredentials/i.test(msg)) return { code: "invalid_credentials", message: "Invalid username or password." };
  return { code: "ldap_error", message: msg || "LDAP error" };
}

async function withServiceBind(cfg, fn) {
  const client = makeClient(cfg);
  const password = cfg.bindPasswordOverride || BIND_PASSWORD;
  if (!cfg.bindUsername) throw new Error("Bind username is not configured.");
  if (!password) throw new Error("Bind password is not configured on the AD bridge agent (.env AD_BIND_PASSWORD).");
  try {
    await client.bind(cfg.bindUsername, password);
    return await fn(client);
  } finally {
    try { await client.unbind(); } catch { /* ignore */ }
  }
}

async function findUser(client, cfg, sam) {
  const base = cfg.usersSearchBase || cfg.baseDn;
  const { searchEntries } = await client.search(base, {
    scope: "sub",
    filter: `(&(objectCategory=person)(objectClass=user)(|(sAMAccountName=${esc(sam)})(userPrincipalName=${esc(sam)})))`,
    attributes: USER_ATTRS,
  });
  return searchEntries.length ? mapUser(searchEntries[0]) : null;
}

// ---------------------------------------------------------------- routes

app.get("/health", (_req, res) => res.json({ ok: true, service: "ad-bridge", version: "1.0.0" }));

/** Verifies the service account can bind and read the directory. */
app.post("/test-connection", async (req, res) => {
  const cfg = req.body?.config || {};
  const started = Date.now();
  try {
    const info = await withServiceBind(cfg, async (client) => {
      const { searchEntries } = await client.search(cfg.usersSearchBase || cfg.baseDn, {
        scope: "sub",
        filter: "(&(objectCategory=person)(objectClass=user))",
        attributes: ["sAMAccountName"],
        sizeLimit: 1,
      });
      return { readable: searchEntries.length > 0 };
    });
    res.json({ ok: true, url: ldapUrl(cfg), tookMs: Date.now() - started, ...info });
  } catch (err) {
    res.status(200).json({ ok: false, url: ldapUrl(cfg), error: String(err?.message || err) });
  }
});

/** Verifies a real user's credentials without creating a session. */
app.post("/test-authentication", async (req, res) => {
  const cfg = req.body?.config || {};
  const { username, password } = req.body || {};
  const client = makeClient(cfg);
  const names = parseUsername(username, cfg);
  try {
    if (!password) throw new Error("Password required");
    try {
      await client.bind(names.upn, password);
    } catch (e) {
      await client.bind(names.down, password);
    }
    res.json({ ok: true, username: names.sam });
  } catch (err) {
    res.status(200).json({ ok: false, ...bindFailureReason(err) });
  } finally {
    try { await client.unbind(); } catch { /* ignore */ }
  }
});

/** Authenticates a user and returns their directory record + group membership. */
app.post("/authenticate", async (req, res) => {
  const cfg = req.body?.config || {};
  const { username, password } = req.body || {};
  const names = parseUsername(username, cfg);
  const client = makeClient(cfg);
  try {
    if (!username || !password) throw new Error("Username and password are required");
    try {
      await client.bind(names.upn, password);
    } catch (e) {
      await client.bind(names.down, password);
    }
    try { await client.unbind(); } catch { /* ignore */ }

    // Read attributes with the service account (users often cannot read their own memberOf tree).
    const user = await withServiceBind(cfg, (c) => findUser(c, cfg, names.sam));
    if (!user) return res.status(200).json({ ok: false, code: "not_found", message: "Directory entry not found." });
    if (!user.accountEnabled) return res.status(200).json({ ok: false, code: "account_disabled", message: "Account is disabled in Active Directory." });
    res.json({ ok: true, user });
  } catch (err) {
    try { await client.unbind(); } catch { /* ignore */ }
    res.status(200).json({ ok: false, ...bindFailureReason(err) });
  }
});

/** Returns every user in the configured search base for synchronization. */
app.post("/sync", async (req, res) => {
  const cfg = req.body?.config || {};
  try {
    const users = await withServiceBind(cfg, async (client) => {
      const { searchEntries } = await client.search(cfg.usersSearchBase || cfg.baseDn, {
        scope: "sub",
        filter: "(&(objectCategory=person)(objectClass=user)(!(objectClass=computer)))",
        attributes: USER_ATTRS,
        paged: { pageSize: 500 },
      });
      return searchEntries.map(mapUser).filter((u) => u.samAccountName);
    });
    res.json({ ok: true, count: users.length, users });
  } catch (err) {
    res.status(200).json({ ok: false, error: String(err?.message || err) });
  }
});

/** Lists AD security groups so administrators can map them to app roles. */
app.post("/groups", async (req, res) => {
  const cfg = req.body?.config || {};
  try {
    const groups = await withServiceBind(cfg, async (client) => {
      const { searchEntries } = await client.search(cfg.groupsSearchBase || cfg.baseDn, {
        scope: "sub",
        filter: "(objectClass=group)",
        attributes: ["cn", "distinguishedName", "description"],
        paged: { pageSize: 500 },
      });
      return searchEntries.map((g) => ({
        name: first(g.cn),
        dn: first(g.dn) || first(g.distinguishedName),
        description: first(g.description),
      }));
    });
    res.json({ ok: true, count: groups.length, groups });
  } catch (err) {
    res.status(200).json({ ok: false, error: String(err?.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`[ad-bridge] listening on port ${PORT}`);
  console.log(`[ad-bridge] bind password configured: ${BIND_PASSWORD ? "yes" : "NO — set AD_BIND_PASSWORD"}`);
});