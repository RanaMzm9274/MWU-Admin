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
app.use(express.json({ limit: "25mb" }));

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

const decryptSecret = (payload = "") => {
  if (!payload) return "";
  try {
    const [ivHex, tagHex, encryptedHex] = payload.split(":");
    const key = crypto.createHash("sha256").update(JWT_SECRET).digest();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedHex, "hex")), decipher.final()]).toString("utf8");
  } catch { return ""; }
};

const encryptSecret = (value = "") => {
  if (!value) return "";
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash("sha256").update(JWT_SECRET).digest();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${encrypted.toString("hex")}`;
};

const getMailSettings = async () => {
  const [rows] = await pool.execute("SELECT settings_json FROM portal_settings WHERE setting_key = 'smtp' LIMIT 1");
  if (rows[0]) return pageJson(rows[0].settings_json, {});
  return process.env.SMTP_HOST ? {
    enabled: true, host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
    encryption: String(process.env.SMTP_SECURE).toLowerCase() === "true" ? "ssl" : "tls",
    username: process.env.SMTP_USER || "", passwordEncrypted: encryptSecret(process.env.SMTP_PASSWORD || ""),
    fromEmail: process.env.SMTP_FROM || process.env.SMTP_USER || "", fromName: "Madda Walabu University", verified: true
  } : null;
};

const getTransporter = async () => {
  const config = await getMailSettings();
  if (!config?.enabled || !config?.verified || !config.host) return null;
  return nodemailer.createTransport({
    host: config.host, port: Number(config.port || 587), secure: config.encryption === "ssl",
    requireTLS: config.encryption === "tls",
    auth: config.username ? { user: config.username, pass: decryptSecret(config.passwordEncrypted) } : undefined
  });
};

const sendInviteEmail = async ({ user, temporaryPassword, actor }) => {
  const transporter = await getTransporter();
  if (!transporter) {
    return { sent: false, reason: "SMTP is not configured." };
  }

  const loginUrl = process.env.ADMIN_LOGIN_URL || APP_ORIGIN;
  const mailSettings = await getMailSettings();
  const from = mailSettings?.fromEmail || process.env.SMTP_FROM || process.env.SMTP_USER;
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

const slugify = (value = "") =>
  String(value || "untitled-page")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled-page";

const titleCaseStatus = (status = "Draft") => {
  const value = String(status || "Draft").toLowerCase();
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const pageJson = (value, fallback) => {
  if (value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value ?? fallback;
};

const normalizePagePayload = (body = {}, fallback = {}) => {
  const merged = { ...fallback, ...body };
  const title = String(merged.title || merged.page_title || merged.name || "Untitled Page").trim() || "Untitled Page";
  const slug = slugify(merged.slug || fallback.slug || title);
  const menu = String(merged.menu ?? merged.menu_group ?? merged.menuGroup ?? fallback.menu ?? "").trim();
  const menuOrder = Number(merged.menuOrder ?? merged.menu_order ?? merged.sort_order ?? fallback.menuOrder ?? fallback.menu_order ?? 1) || 1;
  const showInHeader = Number(merged.showInHeader ?? merged.show_in_header ?? (menu ? 1 : 0)) ? 1 : 0;
  const showInFooter = Number(merged.showInFooter ?? merged.show_in_footer ?? 1) ? 1 : 0;
  // API mutations use snake_case while older payload_json records can contain
  // camelCase copies as well. Always resolve one canonical value and emit it
  // through both aliases; otherwise an old rawHtml/visualBuilder value can win
  // over the freshly published raw_html/visual_builder value.
  const canonicalBuilderKind = body.builder_kind ?? body.builderKind ?? fallback.builder_kind ?? fallback.builderKind ?? "";
  const canonicalVisualBuilder = pageJson(
    body.visual_builder ?? body.visualBuilder,
    pageJson(fallback.visual_builder ?? fallback.visualBuilder, null)
  );
  const canonicalRawHtml = body.raw_html ?? body.rawHtml ?? fallback.raw_html ?? fallback.rawHtml ?? "";
  const canonicalBodyHtml = body.body_html ?? body.bodyHtml ?? fallback.body_html ?? fallback.bodyHtml ?? "";
  const canonicalCustomCss = body.custom_css ?? body.customCss ?? fallback.custom_css ?? fallback.customCss ?? "";

  return {
    ...merged,
    title,
    slug,
    type: merged.type || merged.page_type || fallback.type || "Static Page",
    page_type: merged.page_type || merged.type || fallback.page_type || "static",
    menu,
    menu_group: menu,
    status: titleCaseStatus(merged.status || fallback.status || "Draft"),
    template: merged.template || fallback.template || "Standard Page",
    visibility: merged.visibility || fallback.visibility || "Public",
    parentSlug: merged.parentSlug || merged.parent_slug || fallback.parentSlug || fallback.parent_slug || "",
    parent_slug: merged.parent_slug || merged.parentSlug || fallback.parent_slug || fallback.parentSlug || "",
    menuOrder,
    menu_order: menuOrder,
    sort_order: menuOrder,
    showInHeader,
    show_in_header: showInHeader,
    showInFooter,
    show_in_footer: showInFooter,
    heroHeadline: merged.heroHeadline || merged.hero_headline || fallback.heroHeadline || fallback.hero_headline || title,
    hero_headline: merged.hero_headline || merged.heroHeadline || fallback.hero_headline || fallback.heroHeadline || title,
    heroTag: merged.heroTag || merged.hero_tag || fallback.heroTag || fallback.hero_tag || "Website Page",
    hero_tag: merged.hero_tag || merged.heroTag || fallback.hero_tag || fallback.heroTag || "Website Page",
    summary: merged.summary || merged.excerpt || fallback.summary || "",
    heroImage: merged.heroImage || merged.hero_image || fallback.heroImage || fallback.hero_image || "",
    hero_image: merged.hero_image || merged.heroImage || fallback.hero_image || fallback.heroImage || "",
    ctaLabel: merged.ctaLabel || merged.cta_label || fallback.ctaLabel || fallback.cta_label || "Learn More",
    cta_label: merged.cta_label || merged.ctaLabel || fallback.cta_label || fallback.ctaLabel || "Learn More",
    ctaUrl: merged.ctaUrl || merged.cta_url || fallback.ctaUrl || fallback.cta_url || `/${slug}`,
    cta_url: merged.cta_url || merged.ctaUrl || fallback.cta_url || fallback.ctaUrl || `/${slug}`,
    seoTitle: merged.seoTitle || merged.seo_title || fallback.seoTitle || fallback.seo_title || title,
    seo_title: merged.seo_title || merged.seoTitle || fallback.seo_title || fallback.seoTitle || title,
    seoDescription: merged.seoDescription || merged.seo_description || fallback.seoDescription || fallback.seo_description || merged.summary || "",
    seo_description: merged.seo_description || merged.seoDescription || fallback.seo_description || fallback.seoDescription || merged.summary || "",
    sourceUrl: merged.sourceUrl || merged.source_url || fallback.sourceUrl || fallback.source_url || "",
    source_url: merged.source_url || merged.sourceUrl || fallback.source_url || fallback.sourceUrl || "",
    builderKind: canonicalBuilderKind,
    builder_kind: canonicalBuilderKind,
    visualBuilder: canonicalVisualBuilder,
    visual_builder: canonicalVisualBuilder,
    rawHtml: canonicalRawHtml,
    raw_html: canonicalRawHtml,
    bodyHtml: canonicalBodyHtml,
    body_html: canonicalBodyHtml,
    customCss: canonicalCustomCss,
    custom_css: canonicalCustomCss,
    styles: pageJson(merged.styles, pageJson(fallback.styles, {})),
    sections: Array.isArray(merged.sections) ? merged.sections : Array.isArray(fallback.sections) ? fallback.sections : [],
    revisions: Array.isArray(merged.revisions) ? merged.revisions : Array.isArray(fallback.revisions) ? fallback.revisions : [],
    owner: merged.owner || fallback.owner || "",
    priority: merged.priority || fallback.priority || "Medium",
    scheduledAt: merged.scheduledAt || merged.scheduled_at || fallback.scheduledAt || fallback.scheduled_at || null,
    scheduled_at: merged.scheduled_at || merged.scheduledAt || fallback.scheduled_at || fallback.scheduledAt || null
  };
};

const serializePage = (row) => {
  const payload = pageJson(row.payload_json, {});
  return normalizePagePayload(
    {
      ...payload,
      id: row.id,
      page_id: row.id,
      title: row.title,
      slug: row.slug,
      type: row.type,
      page_type: row.page_type,
      menu: row.menu_group,
      menu_group: row.menu_group,
      status: row.status,
      updatedAt: row.updated_at,
      updated_at: row.updated_at,
      createdAt: row.created_at,
      created_at: row.created_at,
      updatedBy: row.updated_by,
      updated_by: row.updated_by
    },
    payload
  );
};

const findPageByIdentifier = async (identifier) => {
  const [rows] = await pool.execute("SELECT * FROM admin_pages WHERE id = ? OR slug = ? LIMIT 1", [identifier, identifier]);
  return rows[0] || null;
};

const insertPage = async (payload, actorName = "Content Editor") => {
  const id = crypto.randomUUID();
  const page = normalizePagePayload({ ...payload, id, page_id: id, updatedBy: actorName, updated_by: actorName });
  await pool.execute(
    `INSERT INTO admin_pages
      (id, title, slug, type, page_type, menu_group, status, updated_by, payload_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, page.title, page.slug, page.type, page.page_type, page.menu, page.status, actorName, JSON.stringify(page)]
  );
  return serializePage(await findPageByIdentifier(id));
};

const updatePage = async (identifier, payload, actorName = "Content Editor") => {
  const existing = await findPageByIdentifier(identifier);
  if (!existing) return null;
  const existingPage = serializePage(existing);
  const page = normalizePagePayload({ ...payload, id: existing.id, page_id: existing.id, updatedBy: actorName, updated_by: actorName }, existingPage);
  await pool.execute(
    `UPDATE admin_pages
     SET title = ?, slug = ?, type = ?, page_type = ?, menu_group = ?, status = ?, updated_by = ?, payload_json = ?
     WHERE id = ?`,
    [page.title, page.slug, page.type, page.page_type, page.menu, page.status, actorName, JSON.stringify(page), existing.id]
  );
  return serializePage(await findPageByIdentifier(existing.id));
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
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS admin_pages (
      id CHAR(36) PRIMARY KEY,
      title VARCHAR(220) NOT NULL,
      slug VARCHAR(220) NOT NULL UNIQUE,
      type VARCHAR(80) NOT NULL DEFAULT 'Static Page',
      page_type VARCHAR(80) NOT NULL DEFAULT 'static',
      menu_group VARCHAR(160) NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'Draft',
      updated_by VARCHAR(160) NULL,
      payload_json LONGTEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_admin_pages_status (status),
      INDEX idx_admin_pages_type (type),
      INDEX idx_admin_pages_menu_group (menu_group),
      INDEX idx_admin_pages_updated_at (updated_at)
    )
  `);
  await pool.execute(`CREATE TABLE IF NOT EXISTS portal_settings (
    setting_key VARCHAR(80) PRIMARY KEY, settings_json JSON NOT NULL,
    updated_by CHAR(36) NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
  await pool.execute(`CREATE TABLE IF NOT EXISTS portal_email_templates (
    id CHAR(36) PRIMARY KEY, name VARCHAR(160) NOT NULL, subject VARCHAR(255) NOT NULL,
    html_body LONGTEXT NOT NULL, text_body LONGTEXT NULL, created_by CHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
  await pool.execute(`CREATE TABLE IF NOT EXISTS portal_forms (
    id CHAR(36) PRIMARY KEY, name VARCHAR(160) NOT NULL, shortcode VARCHAR(120) NOT NULL UNIQUE,
    recipient_email VARCHAR(190) NOT NULL, fields_json JSON NOT NULL, template_id CHAR(36) NULL,
    success_message VARCHAR(500) NULL, active TINYINT(1) NOT NULL DEFAULT 0, created_by CHAR(36) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
  await pool.execute(`CREATE TABLE IF NOT EXISTS portal_form_submissions (
    id CHAR(36) PRIMARY KEY, form_id CHAR(36) NOT NULL, payload_json JSON NOT NULL,
    email_status VARCHAR(40) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_form_submissions_form (form_id)
  )`);
  await pool.execute(`CREATE TABLE IF NOT EXISTS portal_backups (
    id CHAR(36) PRIMARY KEY, name VARCHAR(190) NOT NULL, backup_json LONGTEXT NOT NULL,
    created_by CHAR(36) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_portal_backups_created (created_at)
  )`);
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
  response.json({
    ok: true,
    service: "mwu-admin-api",
    apiVersion: 2,
    features: ["database-backups", "backup-import-export", "backup-restore", "smtp-settings", "shortcode-forms"]
  });
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

// Public website content feed. Only explicitly published pages are exposed;
// drafts, review content, users, and all mutation routes remain protected.
app.get(`${API_PREFIX}/pages/:identifier`, async (request, response, next) => {
  try {
    const row = await findPageByIdentifier(request.params.identifier);
    if (!row) {
      response.status(404).json({ error: "Published page not found." });
      return;
    }
    const page = serializePage(row);
    if (String(page.status || "").toLowerCase() !== "published") {
      response.status(404).json({ error: "Published page not found." });
      return;
    }
    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.json({ ok: true, page, data: { page } });
  } catch (error) {
    next(error);
  }
});

app.get(`${API_PREFIX}/admin/pages`, requireAuth, requireModule("pages"), async (request, response, next) => {
  try {
    const limit = Math.max(1, Math.min(Number(request.query.limit || 200), 500));
    const [rows] = await pool.query(
      "SELECT * FROM admin_pages ORDER BY updated_at DESC, created_at DESC LIMIT ?",
      [limit]
    );
    response.json({ pages: rows.map(serializePage), data: rows.map(serializePage) });
  } catch (error) {
    next(error);
  }
});

app.get(`${API_PREFIX}/admin/pages/:identifier`, requireAuth, requireModule("page-editor"), async (request, response, next) => {
  try {
    const row = await findPageByIdentifier(request.params.identifier);
    if (!row) {
      response.status(404).json({ error: "Page not found." });
      return;
    }
    const page = serializePage(row);
    response.json({ page, data: { page }, sections: page.sections || [] });
  } catch (error) {
    next(error);
  }
});

app.post(`${API_PREFIX}/admin/pages`, requireAuth, requireModule("page-editor"), async (request, response, next) => {
  try {
    if (String(request.body?.action || request.body?.operation || "").toLowerCase() === "delete") {
      const identifier = request.body?.id || request.body?.page_id || request.body?.pageId || request.body?.slug;
      if (!identifier) {
        response.status(400).json({ error: "Page identifier is required." });
        return;
      }
      const row = await findPageByIdentifier(identifier);
      if (!row) {
        response.status(404).json({ error: "Page not found." });
        return;
      }
      await pool.execute("DELETE FROM admin_pages WHERE id = ?", [row.id]);
      await audit({ actorId: request.adminUser.id, targetId: row.id, action: "admin_page_deleted", details: { slug: row.slug } });
      response.json({ ok: true });
      return;
    }

    const incomingIdentifier = request.body?.id || request.body?.page_id || request.body?.pageId || "";
    const existing = incomingIdentifier ? await findPageByIdentifier(incomingIdentifier) : null;
    const page = existing
      ? await updatePage(existing.id, request.body, request.adminUser.name)
      : await insertPage(request.body, request.adminUser.name);
    await audit({
      actorId: request.adminUser.id,
      targetId: page.id,
      action: existing ? "admin_page_updated" : "admin_page_created",
      details: { slug: page.slug, status: page.status }
    });
    response.status(existing ? 200 : 201).json({ page, data: page });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      response.status(409).json({ error: "A page with this slug already exists." });
      return;
    }
    next(error);
  }
});

app.put(`${API_PREFIX}/admin/pages`, requireAuth, requireModule("page-editor"), async (request, response, next) => {
  try {
    const page = await insertPage(request.body, request.adminUser.name);
    await audit({ actorId: request.adminUser.id, targetId: page.id, action: "admin_page_created", details: { slug: page.slug, status: page.status } });
    response.status(201).json({ page, data: page });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      response.status(409).json({ error: "A page with this slug already exists." });
      return;
    }
    next(error);
  }
});

app.put(`${API_PREFIX}/admin/pages/:identifier`, requireAuth, requireModule("page-editor"), async (request, response, next) => {
  try {
    const page = await updatePage(request.params.identifier, request.body, request.adminUser.name);
    if (!page) {
      response.status(404).json({ error: "Page not found." });
      return;
    }
    await audit({ actorId: request.adminUser.id, targetId: page.id, action: "admin_page_updated", details: { slug: page.slug, status: page.status } });
    response.json({ page, data: page });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      response.status(409).json({ error: "A page with this slug already exists." });
      return;
    }
    next(error);
  }
});

app.patch(`${API_PREFIX}/admin/pages/:identifier`, requireAuth, requireModule("page-editor"), async (request, response, next) => {
  try {
    const page = await updatePage(request.params.identifier, request.body, request.adminUser.name);
    if (!page) {
      response.status(404).json({ error: "Page not found." });
      return;
    }
    await audit({ actorId: request.adminUser.id, targetId: page.id, action: "admin_page_updated", details: { slug: page.slug, status: page.status } });
    response.json({ page, data: page });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      response.status(409).json({ error: "A page with this slug already exists." });
      return;
    }
    next(error);
  }
});

app.post(`${API_PREFIX}/admin/pages/:identifier/delete`, requireAuth, requireModule("page-editor"), async (request, response, next) => {
  try {
    const row = await findPageByIdentifier(request.params.identifier);
    if (!row) {
      response.status(404).json({ error: "Page not found." });
      return;
    }
    await pool.execute("DELETE FROM admin_pages WHERE id = ?", [row.id]);
    await audit({ actorId: request.adminUser.id, targetId: row.id, action: "admin_page_deleted", details: { slug: row.slug } });
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.delete(`${API_PREFIX}/admin/pages/:identifier`, requireAuth, requireModule("page-editor"), async (request, response, next) => {
  try {
    const row = await findPageByIdentifier(request.params.identifier);
    if (!row) {
      response.status(404).json({ error: "Page not found." });
      return;
    }
    await pool.execute("DELETE FROM admin_pages WHERE id = ?", [row.id]);
    await audit({ actorId: request.adminUser.id, targetId: row.id, action: "admin_page_deleted", details: { slug: row.slug } });
    response.json({ ok: true });
  } catch (error) {
    next(error);
  }
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

const publicSmtpSettings = (config) => {
  const safeConfig = config && typeof config === "object" ? config : {};
  return {
    enabled: Boolean(safeConfig.enabled), host: safeConfig.host || "", port: String(safeConfig.port || "587"),
    encryption: safeConfig.encryption || "tls", username: safeConfig.username || "", hasPassword: Boolean(safeConfig.passwordEncrypted),
    fromEmail: safeConfig.fromEmail || "", fromName: safeConfig.fromName || "", verified: Boolean(safeConfig.verified)
  };
};

app.get(`${API_PREFIX}/admin/settings`, requireAuth, requireModule("settings"), async (_request, response, next) => {
  try {
    const smtp = await getMailSettings();
    const [formRows] = await pool.execute("SELECT settings_json FROM portal_settings WHERE setting_key = 'forms' LIMIT 1");
    response.json({ smtp: publicSmtpSettings(smtp), forms: pageJson(formRows[0]?.settings_json, {}) });
  } catch (error) { next(error); }
});

app.put(`${API_PREFIX}/admin/settings/forms`, requireAuth, requireModule("settings"), async (request, response, next) => {
  try {
    await pool.execute("INSERT INTO portal_settings (setting_key, settings_json, updated_by) VALUES ('forms', ?, ?) ON DUPLICATE KEY UPDATE settings_json=VALUES(settings_json), updated_by=VALUES(updated_by)", [JSON.stringify(request.body || {}), request.adminUser.id]);
    response.json({ ok: true, forms: request.body || {} });
  } catch (error) { next(error); }
});

app.put(`${API_PREFIX}/admin/settings/smtp`, requireAuth, requireModule("settings"), async (request, response, next) => {
  try {
    const previous = await getMailSettings();
    const config = {
      enabled: Boolean(request.body.enabled), host: String(request.body.host || "").trim(),
      port: Number(request.body.port || 587), encryption: ["tls", "ssl", "none"].includes(request.body.encryption) ? request.body.encryption : "tls",
      username: String(request.body.username || "").trim(), fromEmail: normalizeEmail(request.body.fromEmail),
      fromName: String(request.body.fromName || "Madda Walabu University").trim(),
      passwordEncrypted: request.body.password ? encryptSecret(request.body.password) : previous?.passwordEncrypted || "",
      verified: false
    };
    if (config.enabled) {
      if (!config.host || !config.port || !config.fromEmail) return response.status(400).json({ error: "SMTP host, port, and from email are required." });
      const transporter = nodemailer.createTransport({ host: config.host, port: config.port, secure: config.encryption === "ssl", requireTLS: config.encryption === "tls", auth: config.username ? { user: config.username, pass: request.body.password || decryptSecret(config.passwordEncrypted) } : undefined });
      await transporter.verify();
      config.verified = true;
    }
    await pool.execute("INSERT INTO portal_settings (setting_key, settings_json, updated_by) VALUES ('smtp', ?, ?) ON DUPLICATE KEY UPDATE settings_json=VALUES(settings_json), updated_by=VALUES(updated_by)", [JSON.stringify(config), request.adminUser.id]);
    await audit({ actorId: request.adminUser.id, action: "smtp_settings_updated", details: { enabled: config.enabled, verified: config.verified, host: config.host } });
    response.json({ ok: true, smtp: publicSmtpSettings(config), message: config.enabled ? "SMTP verified and email delivery activated." : "SMTP disabled." });
  } catch (error) { response.status(400).json({ error: `SMTP verification failed: ${error.message}` }); }
});

app.get(`${API_PREFIX}/admin/forms`, requireAuth, requireModule("settings"), async (_request, response, next) => {
  try {
    const [rows] = await pool.execute("SELECT f.*, t.name template_name FROM portal_forms f LEFT JOIN portal_email_templates t ON t.id=f.template_id ORDER BY f.updated_at DESC");
    response.json({ forms: rows.map((row) => ({ ...row, fields: pageJson(row.fields_json, []), active: Boolean(row.active) })) });
  } catch (error) { next(error); }
});

app.post(`${API_PREFIX}/admin/forms`, requireAuth, requireModule("settings"), async (request, response, next) => {
  try {
    const smtp = await getMailSettings();
    if (request.body.active && (!smtp?.enabled || !smtp?.verified)) return response.status(409).json({ error: "SMTP not configured. Save and verify SMTP settings before activating forms." });
    const id = crypto.randomUUID();
    const shortcode = slugify(request.body.shortcode || request.body.name);
    const templateId = crypto.randomUUID();
    await pool.execute("INSERT INTO portal_email_templates (id,name,subject,html_body,text_body,created_by) VALUES (?,?,?,?,?,?)", [templateId, `${request.body.name} notification`, request.body.subject || "New {{form_name}} submission", request.body.htmlBody || "<h2>New submission</h2><p>{{all_fields}}</p>", request.body.textBody || "{{all_fields}}", request.adminUser.id]);
    await pool.execute("INSERT INTO portal_forms (id,name,shortcode,recipient_email,fields_json,template_id,success_message,active,created_by) VALUES (?,?,?,?,?,?,?,?,?)", [id, String(request.body.name || "New Form").trim(), shortcode, normalizeEmail(request.body.recipientEmail), JSON.stringify(request.body.fields || []), templateId, request.body.successMessage || "Thank you. Your submission has been received.", request.body.active ? 1 : 0, request.adminUser.id]);
    response.status(201).json({ id, shortcode: `[mwu_form id="${shortcode}"]`, active: Boolean(request.body.active) });
  } catch (error) { next(error); }
});

const renderTemplate = (template, values) => String(template || "").replace(/{{\s*([\w-]+)\s*}}/g, (_match, key) => escapeHtml(values[key] ?? ""));

app.post(`${API_PREFIX}/forms/:shortcode/submit`, async (request, response, next) => {
  try {
    const [rows] = await pool.execute("SELECT f.*, t.subject, t.html_body, t.text_body FROM portal_forms f LEFT JOIN portal_email_templates t ON t.id=f.template_id WHERE f.shortcode=? AND f.active=1 LIMIT 1", [request.params.shortcode]);
    const form = rows[0];
    if (!form) return response.status(404).json({ error: "Form not found or inactive." });
    const smtp = await getMailSettings();
    const transporter = await getTransporter();
    if (!smtp?.verified || !transporter) return response.status(503).json({ error: "SMTP not configured. This form cannot send email." });
    const allFields = Object.entries(request.body || {}).map(([key, value]) => `${key}: ${value}`).join("\n");
    const values = { ...request.body, form_name: form.name, all_fields: allFields };
    let emailStatus = "sent";
    try { await transporter.sendMail({ from: { name: smtp.fromName, address: smtp.fromEmail }, to: form.recipient_email, replyTo: request.body.email || undefined, subject: renderTemplate(form.subject, values), html: renderTemplate(form.html_body, values).replace(/\n/g, "<br>"), text: renderTemplate(form.text_body || allFields, values) }); }
    catch (error) { emailStatus = "failed"; throw error; }
    finally { await pool.execute("INSERT INTO portal_form_submissions (id,form_id,payload_json,email_status) VALUES (?,?,?,?)", [crypto.randomUUID(), form.id, JSON.stringify(request.body || {}), emailStatus]); }
    response.json({ ok: true, message: form.success_message });
  } catch (error) { next(error); }
});

const BACKUP_TABLES = ["admin_pages", "portal_settings", "portal_email_templates", "portal_forms", "portal_form_submissions"];
const restoreRow = (row = {}) => Object.fromEntries(
  Object.entries(row).map(([key, value]) => [key, value && typeof value === "object" && !(value instanceof Date) ? JSON.stringify(value) : value])
);
const createDatabaseSnapshot = async () => {
  const tables = {};
  for (const table of BACKUP_TABLES) { const [rows] = await pool.query(`SELECT * FROM \`${table}\``); tables[table] = rows; }
  return { format: "mwu-database-backup", version: 1, createdAt: new Date().toISOString(), tables };
};

app.get(`${API_PREFIX}/admin/backups`, requireAuth, requireModule("settings"), async (_request, response, next) => {
  try { const [rows] = await pool.execute("SELECT id,name,created_by,created_at,OCTET_LENGTH(backup_json) size_bytes FROM portal_backups ORDER BY created_at DESC"); response.json({ backups: rows }); } catch (error) { next(error); }
});

app.post(`${API_PREFIX}/admin/backups`, requireAuth, requireModule("settings"), async (request, response, next) => {
  try { const id = crypto.randomUUID(); const backup = await createDatabaseSnapshot(); const name = String(request.body.name || `MWU Backup ${new Date().toLocaleString()}`).slice(0, 190); await pool.execute("INSERT INTO portal_backups (id,name,backup_json,created_by) VALUES (?,?,?,?)", [id, name, JSON.stringify(backup), request.adminUser.id]); await audit({ actorId: request.adminUser.id, action: "database_backup_created", details: { backupId: id } }); response.status(201).json({ id, name, created_at: backup.createdAt }); } catch (error) { next(error); }
});

app.post(`${API_PREFIX}/admin/backups/import`, requireAuth, requireModule("settings"), async (request, response, next) => {
  try {
    const snapshot = request.body?.backup;
    if (snapshot?.format !== "mwu-database-backup" || snapshot?.version !== 1 || !snapshot.tables) return response.status(400).json({ error: "Invalid or unsupported MWU database backup." });
    const id = crypto.randomUUID();
    const name = String(request.body.name || `Imported Backup ${new Date().toLocaleString()}`).slice(0, 190);
    await pool.execute("INSERT INTO portal_backups (id,name,backup_json,created_by) VALUES (?,?,?,?)", [id, name, JSON.stringify(snapshot), request.adminUser.id]);
    await audit({ actorId: request.adminUser.id, action: "database_backup_imported", details: { backupId: id } });
    response.status(201).json({ id, name });
  } catch (error) { next(error); }
});

app.get(`${API_PREFIX}/admin/backups/:id/export`, requireAuth, requireModule("settings"), async (request, response, next) => {
  try { const [rows] = await pool.execute("SELECT name,backup_json FROM portal_backups WHERE id=?", [request.params.id]); if (!rows[0]) return response.status(404).json({ error: "Backup not found." }); response.setHeader("Content-Disposition", `attachment; filename="${slugify(rows[0].name)}.json"`); response.type("json").send(rows[0].backup_json); } catch (error) { next(error); }
});

app.post(`${API_PREFIX}/admin/backups/:id/restore`, requireAuth, requireModule("settings"), async (request, response, next) => {
  const connection = await pool.getConnection();
  try { const [rows] = await connection.execute("SELECT backup_json FROM portal_backups WHERE id=?", [request.params.id]); if (!rows[0]) return response.status(404).json({ error: "Backup not found." }); const snapshot = pageJson(rows[0].backup_json, null); if (snapshot?.format !== "mwu-database-backup" || snapshot?.version !== 1 || !snapshot.tables) return response.status(400).json({ error: "Invalid or unsupported backup." }); await connection.beginTransaction(); for (const table of BACKUP_TABLES) { await connection.query(`DELETE FROM \`${table}\``); for (const row of snapshot.tables[table] || []) { await connection.query(`INSERT INTO \`${table}\` SET ?`, restoreRow(row)); } } await connection.commit(); await audit({ actorId: request.adminUser.id, action: "database_backup_restored", details: { backupId: request.params.id } }); response.json({ ok: true, message: "Database backup restored successfully." }); } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
});

app.delete(`${API_PREFIX}/admin/backups/:id`, requireAuth, requireModule("settings"), async (request, response, next) => {
  try { const user = await findUserById(request.adminUser.id); const passwordOk = await bcrypt.compare(String(request.body.password || ""), user.password_hash); if (!passwordOk) return response.status(403).json({ error: "Password verification failed." }); if (request.body.confirmation !== `DELETE ${request.params.id}`) return response.status(400).json({ error: `Type DELETE ${request.params.id} to confirm.` }); const [result] = await pool.execute("DELETE FROM portal_backups WHERE id=?", [request.params.id]); if (!result.affectedRows) return response.status(404).json({ error: "Backup not found." }); await audit({ actorId: request.adminUser.id, action: "database_backup_deleted", details: { backupId: request.params.id, dualVerification: true } }); response.json({ ok: true }); } catch (error) { next(error); }
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
