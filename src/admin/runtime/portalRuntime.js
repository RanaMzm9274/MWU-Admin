import { CalendarDays, FileText, GraduationCap, Image, LayoutDashboard, LayoutTemplate, MessageSquare, Pencil, Plus, Settings, Upload, UserPlus, Users } from "lucide-react";
import { LIVE_SITE_ORIGIN } from "../modules/mediaLibrary";

const PROGRAM_CATEGORIES_KEY = "mwu-crm-program-categories-v1";
const PROGRAMS_KEY = "mwu-crm-programs-v1";
const ADMIN_TOKEN_KEY = "mwu_admin_token";
const ADMIN_ACTIVITY_KEY = "mwu_admin_last_activity";
const ADMIN_PROFILE_KEY = "mwu_admin_profile";
const ADMIN_USERS_KEY = "mwu_admin_users_v1";
const ADMIN_PAGES_LOADED_NOTICE_KEY = "mwu_admin_pages_loaded_notice_dismissed";
const CRM_UI_STATE_KEY = "mwu_admin_ui_state_v1";
const INACTIVITY_LIMIT_MS = 15 * 60 * 1000;
const DEV_API_PROXY_PREFIX = "/__live_api";
const LIVE_API_ORIGIN = "https://admin.maddauni.online";
const LIVE_PROGRAMS_API_URL = `${LIVE_API_ORIGIN}/api/programs`;
const normalizeDevProxyBaseUrl = (value, devPrefix) => {
  const raw = String(value || "").replace(/\/$/, "");
  if (!raw) return "";
  if (!import.meta.env.DEV) return raw;
  try {
    const url = new URL(raw);
    const liveApiHost = new URL(LIVE_API_ORIGIN).hostname.replace(/^www\./, "");
    const apiHost = url.hostname.replace(/^www\./, "");
    if (apiHost === liveApiHost) {
      return `${devPrefix}${url.pathname}`.replace(/\/$/, "");
    }
    return raw;
  } catch {
    return raw;
  }
};
const API_BASE_URL = normalizeDevProxyBaseUrl(import.meta.env.VITE_API_BASE_URL || "", DEV_API_PROXY_PREFIX);
const apiUrl = (path) => `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
const DEFAULT_SITE_CHROME_PUBLISH_URL = import.meta.env.DEV
  ? "/__live_site_chrome"
  : `${LIVE_SITE_ORIGIN}/api/site-chrome`;
const SITE_CHROME_PUBLISH_URL = String(
  import.meta.env.VITE_SITE_CHROME_PUBLISH_URL || DEFAULT_SITE_CHROME_PUBLISH_URL
).trim();

const getAuthHeaders = (token) => {
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const readApiError = async (response, fallback) => {
  const prefix = `HTTP ${response.status}`;

  try {
    const payload = await response.json();
    return `${prefix}: ${payload.error || payload.message || fallback}`;
  } catch {
    try {
      const text = await response.text();
      const message = text
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      return message ? `${prefix}: ${message}` : `${prefix}: ${fallback}`;
    } catch {
      return `${prefix}: ${fallback}`;
    }
  }
};

const dismissNoticeMessage = (notice, setNotice) => {
  if (/^Loaded \d+ pages from Admin API\.$/i.test(String(notice || "").trim())) {
    window.sessionStorage.setItem(ADMIN_PAGES_LOADED_NOTICE_KEY, "1");
  }
  setNotice("");
};

const EDITOR_DEBUG_ENABLED = true;

const editorDebugLog = (stage, details = {}) => {
  if (!EDITOR_DEBUG_ENABLED) return;
  console.info(`[MWU editor debug] ${stage}`, details);
};

const extractToken = (payload) =>
  payload?.token ||
  payload?.accessToken ||
  payload?.access_token ||
  payload?.data?.token ||
  payload?.data?.accessToken ||
  payload?.data?.access_token ||
  "";

const normalizeAccessMap = (value = {}, fallback = fullAccess) => {
  const source = value && typeof value === "object" ? value : {};
  const nextAccess = {};
  accessModules.forEach((module) => {
    nextAccess[module.id] = Boolean(source[module.id] ?? source[module.label] ?? fallback?.[module.id]);
  });
  return nextAccess;
};

const getRolePreset = (roleId = "") =>
  rolePresets.find((role) => role.id === roleId || role.label.toLowerCase() === String(roleId).toLowerCase()) ||
  rolePresets[1];

const normalizeAdminUser = (user = {}, fallbackAccess = null) => {
  const role = getRolePreset(user.role || user.role_id || user.roleId || "content-manager");
  const id = String(user.id || user.user_id || user.userId || user.email || makeId());
  const email = String(user.email || user.username || "").trim();
  const name = String(user.name || user.full_name || user.fullName || email || "Portal User").trim();
  return {
    id,
    name,
    email,
    role: role.id,
    status: String(user.status || (user.active === false ? "Suspended" : "Active")),
    department: String(user.department || user.team || ""),
    createdAt: user.createdAt || user.created_at || todayIso(),
    updatedAt: user.updatedAt || user.updated_at || todayIso(),
    lastActive: user.lastActive || user.last_active || "",
    access: normalizeAccessMap(user.access || user.permissions || user.modules, fallbackAccess || role.access)
  };
};

const extractAdminProfile = (payload = {}, email = "") => {
  const profile =
    payload?.user ||
    payload?.profile ||
    payload?.admin ||
    payload?.data?.user ||
    payload?.data?.profile ||
    payload?.data?.admin ||
    null;

  if (!profile || typeof profile !== "object") {
    return normalizeAdminUser({
      id: email || "current-admin",
      name: email || "Current Admin",
      email,
      role: "super-admin",
      access: fullAccess
    }, fullAccess);
  }

  const roleValue = profile.role || profile.role_id || profile.roleId || "super-admin";
  const fallbackRole = getRolePreset(roleValue);
  return normalizeAdminUser(
    {
      ...profile,
      email: profile.email || email,
      role: roleValue,
      access: profile.access || profile.permissions || profile.modules || fallbackRole.access
    },
    fallbackRole.access
  );
};

const getStoredAdminProfile = () => {
  try {
    const raw = window.localStorage.getItem(ADMIN_PROFILE_KEY);
    if (!raw) return null;
    return normalizeAdminUser(JSON.parse(raw), fullAccess);
  } catch {
    window.localStorage.removeItem(ADMIN_PROFILE_KEY);
    return null;
  }
};

const storeAdminProfile = (profile) => {
  window.localStorage.setItem(ADMIN_PROFILE_KEY, JSON.stringify(normalizeAdminUser(profile, fullAccess)));
};

const loadAdminUsers = () => {
  try {
    const raw = window.localStorage.getItem(ADMIN_USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((user) => normalizeAdminUser(user)) : [];
  } catch {
    window.localStorage.removeItem(ADMIN_USERS_KEY);
    return [];
  }
};

const storeAdminUsers = (users = []) => {
  window.localStorage.setItem(ADMIN_USERS_KEY, JSON.stringify(users.map((user) => normalizeAdminUser(user))));
};

const hasPortalAccess = (profile, viewId) => {
  if (!accessModuleIds.has(viewId)) return true;
  if (!profile) return true;
  return Boolean(profile.access?.[viewId]);
};

const getFirstAccessibleView = (profile) =>
  navItems.find((item) => hasPortalAccess(profile, item.id))?.id || "dashboard";

const getStoredAdminToken = () => {
  const token = window.localStorage.getItem(ADMIN_TOKEN_KEY) || "";
  const lastActivity = Number(window.localStorage.getItem(ADMIN_ACTIVITY_KEY) || 0);
  if (!token || !lastActivity || Date.now() - lastActivity > INACTIVITY_LIMIT_MS) {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    window.localStorage.removeItem(ADMIN_ACTIVITY_KEY);
    window.localStorage.removeItem(ADMIN_PROFILE_KEY);
    return "";
  }

  return token;
};

const rememberAdminSession = (token, profile = null) => {
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
  window.localStorage.setItem(ADMIN_ACTIVITY_KEY, String(Date.now()));
  if (profile) {
    storeAdminProfile(profile);
  }
};

const clearAdminSession = () => {
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  window.localStorage.removeItem(ADMIN_ACTIVITY_KEY);
  window.localStorage.removeItem(ADMIN_PROFILE_KEY);
};

const touchAdminSession = () => {
  if (window.localStorage.getItem(ADMIN_TOKEN_KEY)) {
    window.localStorage.setItem(ADMIN_ACTIVITY_KEY, String(Date.now()));
  }
};

const getStandaloneEditorPageId = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("editor") === "page" ? params.get("pageId") || "" : "";
};

const getStoredCrmUiState = () => {
  try {
    const raw = window.sessionStorage.getItem(CRM_UI_STATE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const getCrmUrl = () => {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  return url.toString();
};

const openStandalonePageEditorTab = (pageId) => {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("editor", "page");
  url.searchParams.set("pageId", String(pageId));
  window.open(url.toString(), "_blank", "noopener,noreferrer");
};

const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const todayIso = () => new Date().toISOString();

const pageTypes = [
  "Static Page",
  "Home Section",
  "Academic Program",
  "Admission Page",
  "News Article",
  "Event",
  "Research Page",
  "Campus Page",
  "Site Header",
  "Site Footer"
];

const menuGroups = [
  "Home",
  "About Us",
  "Programs",
  "Admissions",
  "Events",
  "Blogs",
  "Contact Us",
  "Layout"
];

const statusOptions = ["Draft", "Review", "Scheduled", "Published", "Archived"];
const pageStatusFilters = ["Published", "Draft", "Archived"];

const googleFontOptions = [
  { label: "Theme Default", value: "" },
  { label: "Inter", value: "'Inter', sans-serif", family: "Inter" },
  { label: "Plus Jakarta Sans", value: "'Plus Jakarta Sans', sans-serif", family: "Plus Jakarta Sans" },
  { label: "Roboto", value: "'Roboto', sans-serif", family: "Roboto" },
  { label: "Open Sans", value: "'Open Sans', sans-serif", family: "Open Sans" },
  { label: "Lato", value: "'Lato', sans-serif", family: "Lato" },
  { label: "Montserrat", value: "'Montserrat', sans-serif", family: "Montserrat" },
  { label: "Poppins", value: "'Poppins', sans-serif", family: "Poppins" },
  { label: "Nunito Sans", value: "'Nunito Sans', sans-serif", family: "Nunito Sans" },
  { label: "Source Sans 3", value: "'Source Sans 3', sans-serif", family: "Source Sans 3" },
  { label: "Merriweather", value: "'Merriweather', serif", family: "Merriweather" },
  { label: "Lora", value: "'Lora', serif", family: "Lora" },
  { label: "Playfair Display", value: "'Playfair Display', serif", family: "Playfair Display" },
  { label: "Noto Serif", value: "'Noto Serif', serif", family: "Noto Serif" },
  { label: "Oswald", value: "'Oswald', sans-serif", family: "Oswald" },
  { label: "Raleway", value: "'Raleway', sans-serif", family: "Raleway" },
  { label: "Ubuntu", value: "'Ubuntu', sans-serif", family: "Ubuntu" },
  { label: "Work Sans", value: "'Work Sans', sans-serif", family: "Work Sans" },
  { label: "Noto Sans Ethiopic", value: "'Noto Sans Ethiopic', sans-serif", family: "Noto Sans Ethiopic" }
];

const googleFontsHref = `https://fonts.googleapis.com/css2?${googleFontOptions
  .filter((font) => font.family)
  .map((font) => `family=${encodeURIComponent(font.family).replace(/%20/g, "+")}:wght@300;400;500;600;700;800;900`)
  .join("&")}&display=swap`;

const sectionTypes = [
  "Hero Banner",
  "Feature Cards",
  "Text Block",
  "Program Grid",
  "Image Gallery",
  "FAQ",
  "CTA Banner",
  "Stats Strip",
  "Testimonials",
  "Events List",
  "Raw HTML"
];

const layoutOptions = [
  "Full width",
  "Text first",
  "Image first",
  "Split media",
  "Three columns",
  "Card grid",
  "Accordion",
  "Banner",
  "Timeline",
  "Horizontal metrics",
  "Gallery",
  "CTA",
  "Legacy HTML",
  "Boxed",
  "Wide"
];

const layoutPresets = [
  {
    id: "landing",
    title: "Landing Page",
    detail: "Hero, features, stats, CTA",
    sections: ["Hero Banner", "Feature Cards", "Stats Strip", "CTA Banner"]
  },
  {
    id: "content",
    title: "Content Page",
    detail: "Text, media, FAQ, CTA",
    sections: ["Text Block", "Image Gallery", "FAQ", "CTA Banner"]
  },
  {
    id: "program",
    title: "Program Detail",
    detail: "Hero, overview, program grid, CTA",
    sections: ["Hero Banner", "Text Block", "Program Grid", "CTA Banner"]
  },
  {
    id: "news",
    title: "News/Event Detail",
    detail: "Hero, story, gallery, timeline",
    sections: ["Hero Banner", "Text Block", "Image Gallery", "Events List"]
  }
];

const templateOptions = [
  "Standard Page",
  "Home Landing",
  "Program Detail",
  "Admission Guide",
  "News Article",
  "Event Detail",
  "Research Profile",
  "Site Chrome"
];

const visibilityOptions = ["Public", "Private", "Password Protected"];
const getMenuGroupChoices = (pages = []) => {
  const dynamicGroups = pages
    .map((page) => String(page?.menu || page?.menu_group || page?.menuGroup || "").trim())
    .filter(Boolean);
  const mergedGroups = Array.from(new Set([...menuGroups, ...dynamicGroups, ...Object.values(SITE_CHROME_CONFIGS).map((config) => config.menu)]));
  return [{ label: "Not in menu", value: "" }, ...mergedGroups.map((group) => ({ label: group, value: group }))];
};

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "pages", label: "Pages", icon: FileText },
  { id: "page-editor", label: "Page Editor", icon: Pencil },
  { id: "site-chrome", label: "Header & Footer", icon: LayoutTemplate },
  { id: "programs", label: "Programs", icon: GraduationCap },
  { id: "blogs", label: "Blogs", icon: MessageSquare },
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "media", label: "Media", icon: Image },
  { id: "crm", label: "CRM Leads", icon: Users },
  { id: "users", label: "Users", icon: UserPlus },
  { id: "settings", label: "Settings", icon: Settings }
];

const accessModules = [
  { id: "dashboard", label: "Dashboard", description: "Overview metrics, recent content, and quick actions." },
  { id: "pages", label: "Pages", description: "Create, edit, publish, import, export, and delete website pages." },
  { id: "page-editor", label: "Page Editor", description: "Open the visual page editor and save page content." },
  { id: "site-chrome", label: "Header & Footer", description: "Edit global header and footer markup." },
  { id: "programs", label: "Programs", description: "Manage program categories, details, and programs mega menu." },
  { id: "blogs", label: "Blogs", description: "Manage blog listing and article pages." },
  { id: "events", label: "Events", description: "Manage event listing and event detail pages." },
  { id: "media", label: "Media", description: "Upload, select, copy, and remove media assets." },
  { id: "crm", label: "CRM Leads", description: "Review and manage admission or inquiry leads." },
  { id: "users", label: "Users", description: "Create portal users and assign personalized access." },
  { id: "settings", label: "Settings", description: "View brand identity and publishing configuration." }
];

const fullAccess = accessModules.reduce((permissions, module) => {
  permissions[module.id] = true;
  return permissions;
}, {});

const rolePresets = [
  { id: "super-admin", label: "Super Admin", access: fullAccess },
  {
    id: "content-manager",
    label: "Content Manager",
    access: {
      dashboard: true,
      pages: true,
      "page-editor": true,
      "site-chrome": true,
      programs: true,
      blogs: true,
      events: true,
      media: true
    }
  },
  {
    id: "admissions-crm",
    label: "Admissions / CRM",
    access: {
      dashboard: true,
      pages: true,
      "page-editor": true,
      crm: true,
      media: true
    }
  },
  {
    id: "media-publisher",
    label: "Media Publisher",
    access: {
      dashboard: true,
      media: true,
      pages: true,
      "page-editor": true
    }
  },
  {
    id: "viewer",
    label: "Viewer",
    access: {
      dashboard: true,
      pages: true,
      blogs: true,
      events: true,
      programs: true
    }
  }
];

const accessModuleIds = new Set(accessModules.map((module) => module.id));

const SITE_CHROME_CONFIGS = {
  header: {
    kind: "header",
    slug: "site-header",
    title: "Website Header",
    type: "Site Header",
    menu: "Layout",
    sourceUrl: "/assets/partials/inner-header.html",
    summary: "Global website header markup used across the public site."
  },
  footer: {
    kind: "footer",
    slug: "site-footer",
    title: "Website Footer",
    type: "Site Footer",
    menu: "Layout",
    sourceUrl: "/assets/partials/universal-footer.html",
    summary: "Global website footer markup used across the public site."
  }
};

export {
  PROGRAM_CATEGORIES_KEY,
  PROGRAMS_KEY,
  ADMIN_TOKEN_KEY,
  ADMIN_ACTIVITY_KEY,
  ADMIN_PROFILE_KEY,
  ADMIN_USERS_KEY,
  ADMIN_PAGES_LOADED_NOTICE_KEY,
  CRM_UI_STATE_KEY,
  INACTIVITY_LIMIT_MS,
  DEV_API_PROXY_PREFIX,
  LIVE_API_ORIGIN,
  LIVE_PROGRAMS_API_URL,
  normalizeDevProxyBaseUrl,
  API_BASE_URL,
  apiUrl,
  DEFAULT_SITE_CHROME_PUBLISH_URL,
  SITE_CHROME_PUBLISH_URL,
  getAuthHeaders,
  readApiError,
  dismissNoticeMessage,
  EDITOR_DEBUG_ENABLED,
  editorDebugLog,
  extractToken,
  normalizeAccessMap,
  getRolePreset,
  normalizeAdminUser,
  extractAdminProfile,
  getStoredAdminProfile,
  storeAdminProfile,
  loadAdminUsers,
  storeAdminUsers,
  hasPortalAccess,
  getFirstAccessibleView,
  getStoredAdminToken,
  rememberAdminSession,
  clearAdminSession,
  touchAdminSession,
  getStandaloneEditorPageId,
  getStoredCrmUiState,
  getCrmUrl,
  openStandalonePageEditorTab,
  makeId,
  todayIso,
  pageTypes,
  menuGroups,
  statusOptions,
  pageStatusFilters,
  googleFontOptions,
  googleFontsHref,
  sectionTypes,
  layoutOptions,
  layoutPresets,
  templateOptions,
  visibilityOptions,
  getMenuGroupChoices,
  navItems,
  accessModules,
  fullAccess,
  rolePresets,
  accessModuleIds,
  SITE_CHROME_CONFIGS
};
