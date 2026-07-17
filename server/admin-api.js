import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import mysql from "mysql2/promise";
import nodemailer from "nodemailer";
import crypto from "node:crypto";

const PORT = Number(process.env.ADMIN_API_PORT || process.env.PORT || 4000);
const API_PREFIX = process.env.ADMIN_API_PREFIX || "/api";
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || "";
const JWT_EXPIRES_IN = process.env.ADMIN_JWT_EXPIRES_IN || "8h";
const APP_ORIGIN = process.env.ADMIN_APP_ORIGIN || "http://localhost:5173";
const NODE_ENV = process.env.NODE_ENV || "development";

if (!JWT_SECRET) {
  throw new Error("ADMIN_JWT_SECRET is required.");
}

const accessModules = [
  "dashboard",
  "pages",
  "other-pages",
  "page-editor",
  "menus",
  "site-chrome",
  "programs",
  "blogs",
  "events",
  "media",
  "crm",
  "users",
  "settings"
];

const fullAccess = accessModules.reduce((next, key) => {
  next[key] = true;
  return next;
}, {});

const rolePresets = {
  "super-admin": fullAccess,
  "content-manager": {
    dashboard: true,
    pages: true,
    "other-pages": true,
    "page-editor": true,
    menus: true,
    "site-chrome": true,
    programs: true,
    blogs: true,
    events: true,
    media: true
  },
  "admissions-crm": {
    dashboard: true,
    pages: true,
    "page-editor": true,
    crm: true,
    media: true
  },
  "media-publisher": {
    dashboard: true,
    media: true,
    pages: true,
    "page-editor": true
  },
  viewer: {
    dashboard: true,
    pages: true,
    blogs: true,
    events: true,
    programs: true
  }
};

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL || undefined,
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  namedPlaceholders: true
});

const app = express();
app.use(cors({ origin: APP_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean), credentials: true }));
app.use(express.json({ limit: "1mb" }));

const normalizeEmail = (email = "") => String(email || "").trim().toLowerCase();

const normalizeAccess = (access = {}, role = "content-manager") => {
  const fallback = rolePresets[role] || rolePresets["content-manager"];
  return accessModules.reduce((next, key) => {
    next[key] = Boolean(access?.[key] ?? fallback?.[key]);
    return next;
  }, {});
};

const parseAccess = (raw, role) => {
  if (!raw) return normalizeAccess({}, role);
  if (typeof raw === "object") return normalizeAccess(raw, role);
  try {
    return normalizeAccess(JSON.parse(raw), role);
  } catch {
    return normalizeAccess({}, role);
  }
};

const serializeUser = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  status: row.status,
  department: row.department || "",
  access: parseAccess(row.access_json, row.role),
  passwordResetRequired: Boolean(row.password_reset_required),
  lastActive: row.last_login_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const makeTemporaryPassword = () =>
  crypto.randomBytes(12).toString("base64url").replace(/[-_]/g, "").slice(0, 14);

const createToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      access: user.access
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

const getTransporter = () => {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        }
      : undefined
  });
};

const sendInviteEmail = async ({ user, temporaryPassword, actor }) => {
  const transporter = getTransporter();
  if (!transporter) {
    return { sent: false, reason: "SMTP is not configured." };
  }

  const loginUrl = process.env.ADMIN_LOGIN_URL || APP_ORIGIN;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) {
    return { sent: false, reason: "SMTP_FROM or SMTP_USER is required." };
  }

  await transporter.sendMail({
    from,
    to: user.email,
    subject: "MWU Admin Portal access",
    text: [
      `Hello ${user.name},`,
      "",
      `${actor?.name || "An administrator"} created your MWU Admin Portal account.`,
      `Login: ${loginUrl}`,
      `Email: ${user.email}`,
      `Temporary password: ${temporaryPassword}`,
      "",
      "Sign in and change this password after your first login."
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#18212f">
        <h2 style="margin:0 0 12px;color:#081933">MWU Admin Portal access</h2>
        <p>Hello ${escapeHtml(user.name)},</p>
        <p>${escapeHtml(actor?.name || "An administrator")} created your portal account.</p>
        <p><strong>Login:</strong> <a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></p>
        <p><strong>Email:</strong> ${escapeHtml(user.email)}</p>
        <p><strong>Temporary password:</strong> ${escapeHtml(temporaryPassword)}</p>
        <p>Sign in and change this password after your first login.</p>
      </div>
    `
  });

  return { sent: true };
};

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const audit = async ({ actorId = null, targetId = null, action, details = null }) => {
  await pool.execute(
    "INSERT INTO admin_user_audit (actor_user_id, target_user_id, action, details_json) VALUES (?, ?, ?, ?)",
    [actorId, targetId, action, details ? JSON.stringify(details) : null]
  );
};

const ensureSchema = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id CHAR(36) PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      email VARCHAR(190) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(64) NOT NULL DEFAULT 'content-manager',
      status ENUM('Active', 'Suspended', 'Invited') NOT NULL DEFAULT 'Invited',
      department VARCHAR(160) NULL,
      access_json JSON NOT NULL,
      password_reset_required TINYINT(1) NOT NULL DEFAULT 1,
      invite_token_hash VARCHAR(255) NULL,
      invite_expires_at DATETIME NULL,
      last_login_at DATETIME NULL,
      created_by CHAR(36) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_admin_users_status (status),
      INDEX idx_admin_users_role (role)
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS admin_user_audit (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      actor_user_id CHAR(36) NULL,
      target_user_id CHAR(36) NULL,
      action VARCHAR(80) NOT NULL,
      details_json JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_admin_user_audit_target (target_user_id),
      INDEX idx_admin_user_audit_actor (actor_user_id)
    )
  `);
};

const bootstrapAdmin = async () => {
  const email = normalizeEmail(process.env.ADMIN_BOOTSTRAP_EMAIL);
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) return;

  const [existingRows] = await pool.execute("SELECT id FROM admin_users WHERE email = ? LIMIT 1", [email]);
  if (existingRows.length) return;

  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);
  await pool.execute(
    `INSERT INTO admin_users
      (id, name, email, password_hash, role, status, department, access_json, password_reset_required)
     VALUES (?, ?, ?, ?, 'super-admin', 'Active', ?, ?, 0)`,
    [
      id,
      process.env.ADMIN_BOOTSTRAP_NAME || "Super Admin",
      email,
      passwordHash,
      process.env.ADMIN_BOOTSTRAP_DEPARTMENT || "Administration",
      JSON.stringify(fullAccess)
    ]
  );
  await audit({ actorId: id, targetId: id, action: "bootstrap_admin_created" });
};

const findUserById = async (id) => {
  const [rows] = await pool.execute("SELECT * FROM admin_users WHERE id = ? LIMIT 1", [id]);
  return rows[0] || null;
};

const requireAuth = async (request, response, next) => {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    response.status(401).json({ error: "Authentication token is required." });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const row = await findUserById(decoded.sub);
    if (!row || row.status !== "Active") {
      response.status(401).json({ error: "User account is not active." });
      return;
    }
    request.adminUser = serializeUser(row);
    next();
  } catch {
    response.status(401).json({ error: "Invalid or expired token." });
  }
};

const requireModule = (moduleId) => (request, response, next) => {
  if (!request.adminUser?.access?.[moduleId]) {
    response.status(403).json({ error: `Access to ${moduleId} is not enabled for this account.` });
    return;
  }
  next();
};

const getUserPayload = (body = {}) => {
  const email = normalizeEmail(body.email);
  const name = String(body.name || "").trim();
  if (!name) throw new Error("Full name is required.");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("A valid email is required.");

  const role = rolePresets[body.role] ? body.role : "content-manager";
  const status = ["Active", "Suspended", "Invited"].includes(body.status) ? body.status : "Invited";
  return {
    name,
    email,
    role,
    status,
    department: String(body.department || "").trim(),
    access: normalizeAccess(body.access, role),
    password: String(body.password || body.temporaryPassword || "").trim()
  };
};

app.get(`${API_PREFIX}/health`, (_request, response) => {
  response.json({ ok: true, service: "mwu-admin-api" });
});

app.post(`${API_PREFIX}/admin/login`, async (request, response, next) => {
  try {
    const email = normalizeEmail(request.body?.email);
    const password = String(request.body?.password || "");
    const [rows] = await pool.execute("SELECT * FROM admin_users WHERE email = ? LIMIT 1", [email]);
    const row = rows[0];
    if (!row || row.status !== "Active") {
      response.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid) {
      response.status(401).json({ error: "Invalid email or password." });
      return;
    }

    await pool.execute("UPDATE admin_users SET last_login_at = NOW() WHERE id = ?", [row.id]);
    const user = serializeUser({ ...row, last_login_at: new Date() });
    response.json({ token: createToken(user), user });
  } catch (error) {
    next(error);
  }
});

app.get(`${API_PREFIX}/admin/me`, requireAuth, (request, response) => {
  response.json({ user: request.adminUser });
});

app.get(`${API_PREFIX}/admin/users`, requireAuth, requireModule("users"), async (_request, response, next) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM admin_users ORDER BY created_at DESC");
    response.json({ users: rows.map(serializeUser) });
  } catch (error) {
    next(error);
  }
});

app.post(`${API_PREFIX}/admin/users`, requireAuth, requireModule("users"), async (request, response, next) => {
  try {
    const payload = getUserPayload(request.body);
    const temporaryPassword = payload.password || makeTemporaryPassword();
    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    await pool.execute(
      `INSERT INTO admin_users
        (id, name, email, password_hash, role, status, department, access_json, password_reset_required, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        id,
        payload.name,
        payload.email,
        passwordHash,
        payload.role,
        payload.status,
        payload.department,
        JSON.stringify(payload.access),
        request.adminUser.id
      ]
    );

    const row = await findUserById(id);
    const user = serializeUser(row);
    const invite = request.body?.sendInvite ? await sendInviteEmail({ user, temporaryPassword, actor: request.adminUser }) : { sent: false };
    await audit({ actorId: request.adminUser.id, targetId: id, action: "admin_user_created", details: { inviteSent: invite.sent } });
    response.status(201).json({
      user,
      invite,
      temporaryPassword: invite.sent || NODE_ENV === "production" ? undefined : temporaryPassword
    });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      response.status(409).json({ error: "A user with this email already exists." });
      return;
    }
    next(error);
  }
});

app.put(`${API_PREFIX}/admin/users/:id`, requireAuth, requireModule("users"), async (request, response, next) => {
  try {
    const target = await findUserById(request.params.id);
    if (!target) {
      response.status(404).json({ error: "User not found." });
      return;
    }

    const payload = getUserPayload(request.body);
    const params = [
      payload.name,
      payload.email,
      payload.role,
      payload.status,
      payload.department,
      JSON.stringify(payload.access)
    ];
    let passwordClause = "";
    if (payload.password) {
      passwordClause = ", password_hash = ?, password_reset_required = 1";
      params.push(await bcrypt.hash(payload.password, 12));
    }
    params.push(request.params.id);

    await pool.execute(
      `UPDATE admin_users
       SET name = ?, email = ?, role = ?, status = ?, department = ?, access_json = ?${passwordClause}
       WHERE id = ?`,
      params
    );
    const row = await findUserById(request.params.id);
    const user = serializeUser(row);
    await audit({ actorId: request.adminUser.id, targetId: user.id, action: "admin_user_updated" });
    response.json({ user });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      response.status(409).json({ error: "A user with this email already exists." });
      return;
    }
    next(error);
  }
});

app.post(`${API_PREFIX}/admin/users/:id/invite`, requireAuth, requireModule("users"), async (request, response, next) => {
  try {
    const target = await findUserById(request.params.id);
    if (!target) {
      response.status(404).json({ error: "User not found." });
      return;
    }

    const temporaryPassword = makeTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    await pool.execute(
      "UPDATE admin_users SET password_hash = ?, password_reset_required = 1, status = 'Active' WHERE id = ?",
      [passwordHash, request.params.id]
    );
    const row = await findUserById(request.params.id);
    const user = serializeUser(row);
    const invite = await sendInviteEmail({ user, temporaryPassword, actor: request.adminUser });
    await audit({ actorId: request.adminUser.id, targetId: user.id, action: "admin_user_invite_sent", details: { inviteSent: invite.sent } });
    response.json({
      user,
      invite,
      temporaryPassword: invite.sent || NODE_ENV === "production" ? undefined : temporaryPassword
    });
  } catch (error) {
    next(error);
  }
});

app.delete(`${API_PREFIX}/admin/users/:id`, requireAuth, requireModule("users"), async (request, response, next) => {
  try {
    if (request.adminUser.id === request.params.id) {
      response.status(400).json({ error: "You cannot delete the currently signed-in user." });
      return;
    }

    const target = await findUserById(request.params.id);
    if (!target) {
      response.status(404).json({ error: "User not found." });
      return;
    }

    await pool.execute("DELETE FROM admin_users WHERE id = ?", [request.params.id]);
    await audit({ actorId: request.adminUser.id, targetId: request.params.id, action: "admin_user_deleted" });
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: error.message || "Server error." });
});

await ensureSchema();
await bootstrapAdmin();

app.listen(PORT, () => {
  console.log(`MWU Admin API listening on http://localhost:${PORT}${API_PREFIX}`);
});
