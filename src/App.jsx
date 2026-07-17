import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronsLeft,
  ChevronRight,
  ChevronsRight,
  CircleDot,
  ClipboardList,
  Copy,
  Download,
  Eye,
  FileText,
  Filter,
  FolderOpen,
  Globe2,
  GraduationCap,
  GripVertical,
  Image,
  Layers,
  LayoutDashboard,
  LayoutTemplate,
  Link as LinkIcon,
  ListChecks,
  ListTree,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRight,
  Pencil,
  Plus,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  Undo2,
  Upload,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { CheckItem, Field, StatusPill, ViewModeToggle } from "./admin/components/Common";
import DangerConfirmDialog from "./admin/components/DangerConfirmDialog";
import CrmView from "./admin/views/CrmView";
import Dashboard from "./admin/views/Dashboard";
import EventPagesView from "./admin/views/EventPagesView";
import LoginView from "./admin/views/LoginView";
import MediaView from "./admin/views/MediaView";
import PageEditor from "./admin/views/PageEditor";
import PagesView from "./admin/views/PagesView";
import BlogPagesView from "./admin/views/BlogPagesView";
import ProgramsManagementView from "./admin/views/ProgramsView";
import SettingsView from "./admin/views/SettingsView";
import SiteChromeView, { updateProgramsMegaMenuMarkup } from "./admin/views/SiteChromeView";
import UserManagementView from "./admin/views/UserManagementView";
import {
  MEDIA_LIBRARY_KEY,
  LIVE_SITE_ORIGIN,
  LIVE_ASSET_PROXY_PREFIX,
  assets,
  initialMediaLibrary,
  mediaApiUrl,
  buildMediaDimensions,
  normalizeMediaItem,
  normalizeMediaApiItem,
  mergeMediaLibraries,
  getStoredMediaApiCredentials,
  storeMediaApiCredentials,
  getMediaApiAuthHeaders,
  loadMediaLibrary,
  readFileAsDataUrl,
  readImageDimensions,
  normalizeLiveAssetUrl,
  canLoadRemoteImage
} from "./admin/modules/mediaLibrary";

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
const LIVE_API_ORIGIN = "https://api.maddauni.online";
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

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "") || "new-page";

const normalizeIncomingPageType = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "Static Page";
  if (raw.toLowerCase() === "static") return "Static Page";
  return raw;
};

const getApiPageType = (value = "") => {
  const normalized = normalizeIncomingPageType(value).toLowerCase();

  if (normalized === "static page") return "static";
  if (normalized === "home section") return "home";
  if (normalized === "academic program") return "program";
  if (normalized === "admission page") return "admission";
  if (normalized === "news article") return "blog";
  if (normalized === "event") return "event";
  if (normalized === "research page") return "research";
  if (normalized === "campus page") return "campus";
  if (normalized === "site header") return "header";
  if (normalized === "site footer") return "footer";

  return normalized.replace(/\s+/g, "_").slice(0, 32) || "static";
};

const defaultPageStyles = {
  canvasWidth: "1200",
  backgroundColor: "#ffffff",
  accentColor: "#d6a128",
  textColor: "#18212f",
  fontFamily: "Inter, Segoe UI, Arial, sans-serif"
};

const defaultSectionStyles = {
  paddingTop: "56",
  paddingBottom: "56",
  paddingLeft: "32",
  paddingRight: "32",
  marginTop: "0",
  marginBottom: "0",
  backgroundColor: "#ffffff",
  textColor: "#667085",
  headingColor: "#081933",
  accentColor: "#d6a128",
  align: "left",
  gap: "24",
  borderRadius: "8",
  maxWidth: "1200",
  imageRadius: "8",
  shadow: false
};

const toCssUnit = (value, fallback = "0") => {
  const safeValue = value ?? fallback;
  if (safeValue === "") return `${fallback}px`;
  const stringValue = String(safeValue).trim();
  return /^-?\d+(\.\d+)?$/.test(stringValue) ? `${stringValue}px` : stringValue;
};

const stripDangerousHtml = (html = "") =>
  String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+=(['"]).*?\1/gi, "")
    .replace(/javascript:/gi, "");

const isSkippableAssetUrl = (value = "") =>
  !value || /^(data:|blob:|mailto:|tel:|#|javascript:)/i.test(String(value).trim());

const escapeForRegExp = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const localSiteCssLinks = [
  "/assets/css/bootstrap.min.css",
  "/assets/css/fontawesome.min.css",
  "/assets/css/magnific-popup.min.css",
  "/assets/css/swiper-bundle.min.css",
  "/assets/css/style.css"
];

const proxiedSiteCssLinks = localSiteCssLinks.map((href) => `${LIVE_ASSET_PROXY_PREFIX}${href}`);

const normalizeStylesheetUrlForEditableCanvas = (value = "") => {
  if (String(value || "").startsWith(LIVE_ASSET_PROXY_PREFIX)) {
    return String(value || "");
  }
  const rewrittenValue = normalizeAssetUrlForEditableCanvas(value);
  if (/^\/assets\/css\//i.test(rewrittenValue)) {
    return `${LIVE_ASSET_PROXY_PREFIX}${rewrittenValue}`;
  }
  return rewrittenValue;
};

const normalizeAssetUrlForEditableCanvas = (value = "") => {
  const rawValue = String(value || "").trim();
  if (isSkippableAssetUrl(rawValue)) {
    return rawValue;
  }

  if (rawValue.startsWith(LIVE_ASSET_PROXY_PREFIX)) {
    return rawValue;
  }

  if (/^\/assets\//i.test(rawValue)) {
    return `${LIVE_ASSET_PROXY_PREFIX}${rawValue}`;
  }

  if (/^(assets\/|\.\/assets\/)/i.test(rawValue)) {
    return `${LIVE_ASSET_PROXY_PREFIX}/${rawValue.replace(/^\.\//, "")}`;
  }

  if (/^\.\.\/assets\//i.test(rawValue)) {
    return `${LIVE_ASSET_PROXY_PREFIX}/${rawValue.replace(/^(\.\.\/)+/, "")}`;
  }

  if (/^\/legacy\/assets\//i.test(rawValue)) {
    return `${LIVE_ASSET_PROXY_PREFIX}${rawValue.replace(/^\/legacy/, "")}`;
  }

  if (/^\/legacy\//i.test(rawValue) && /\/assets\//i.test(rawValue)) {
    return `${LIVE_ASSET_PROXY_PREFIX}${rawValue.replace(/^\/legacy[^/]*\//i, "/")}`;
  }

  if (/^\/\//.test(rawValue)) {
    try {
      const protocolRelative = new URL(`https:${rawValue}`);
      if (protocolRelative.hostname.replace(/^www\./, "") === "maddauni.online" && protocolRelative.pathname.startsWith("/assets/")) {
        return `${LIVE_ASSET_PROXY_PREFIX}${protocolRelative.pathname}${protocolRelative.search}${protocolRelative.hash}`;
      }
    } catch {
      return rawValue;
    }
  }

  try {
    const absoluteUrl = new URL(rawValue, LIVE_SITE_ORIGIN);
    const liveOrigin = new URL(LIVE_SITE_ORIGIN).origin;

    if (absoluteUrl.origin === liveOrigin && absoluteUrl.pathname.startsWith("/assets/")) {
      return `${LIVE_ASSET_PROXY_PREFIX}${absoluteUrl.pathname}${absoluteUrl.search}${absoluteUrl.hash}`;
    }

    if (absoluteUrl.origin === liveOrigin) {
      return `${LIVE_ASSET_PROXY_PREFIX}${absoluteUrl.pathname}${absoluteUrl.search}${absoluteUrl.hash}`;
    }
  } catch {
    return rawValue;
  }

  return rawValue;
};

const rewriteHtmlForLocalEditing = (html = "") => {
  let nextHtml = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\s+crossorigin(?:=(["']).*?\1|=[^\s>]+)?/gi, "")
    .replace(/\s+integrity=(["']).*?\1/gi, "");

  nextHtml = nextHtml.replace(/<link\b([^>]*?)\bhref=(['"])([^"']+)\2([^>]*)>/gi, (match, beforeHref, quote, value, afterHref) => {
    if (!/\brel=(['"])[^"']*stylesheet[^"']*\1/i.test(match)) {
      const rewrittenValue = normalizeAssetUrlForEditableCanvas(value);
      return `<link${beforeHref}href=${quote}${rewrittenValue}${quote}${afterHref}>`;
    }
    const rewrittenValue = normalizeStylesheetUrlForEditableCanvas(value);
    return `<link${beforeHref}href=${quote}${rewrittenValue}${quote}${afterHref}>`;
  });

  nextHtml = nextHtml.replace(/\b(src|href)=(['"])([^"']+)\2/gi, (_match, attr, quote, value) => {
    const rewrittenValue = attr.toLowerCase() === "href" && /\.css(?:[?#].*)?$/i.test(value)
      ? normalizeStylesheetUrlForEditableCanvas(value)
      : normalizeAssetUrlForEditableCanvas(value);
    return `${attr}=${quote}${rewrittenValue}${quote}`;
  });

  nextHtml = nextHtml.replace(/\bsrcset=(['"])([^"']+)\1/gi, (_match, quote, value) => {
    const rewrittenValue = String(value || "")
      .split(",")
      .map((part) => {
        const bits = part.trim().split(/\s+/);
        if (!bits[0]) return part;
        bits[0] = normalizeAssetUrlForEditableCanvas(bits[0]);
        return bits.join(" ");
      })
      .join(", ");
    return `srcset=${quote}${rewrittenValue}${quote}`;
  });

  nextHtml = nextHtml.replace(/url\((["']?)([^"')]+)(["']?)\)/gi, (_match, openQuote, value, closeQuote) => {
    const trimmed = String(value || "").trim();
    if (isSkippableAssetUrl(trimmed)) {
      return `url(${openQuote || ""}${trimmed}${closeQuote || ""})`;
    }
    return `url(${openQuote || ""}${normalizeAssetUrlForEditableCanvas(trimmed)}${closeQuote || ""})`;
  });

  return nextHtml;
};

const injectLocalSiteCssLinks = (html = "") => {
  let nextHtml = String(html || "");
  const links = proxiedSiteCssLinks
    .filter((href) => !new RegExp(`href=["']${escapeForRegExp(href)}["']`, "i").test(nextHtml))
    .map((href) => `<link rel="stylesheet" href="${href}" data-mwu-local-style="true" />`)
    .join("\n");

  if (!links) {
    return nextHtml;
  }

  if (/<\/head>/i.test(nextHtml)) {
    return nextHtml.replace(/<\/head>/i, `${links}\n</head>`);
  }

  if (/<html[^>]*>/i.test(nextHtml)) {
    return nextHtml.replace(/<html[^>]*>/i, (match) => `${match}<head>${links}</head>`);
  }

  return `<!doctype html><html><head>${links}</head><body>${nextHtml}</body></html>`;
};

const restoreLiveAssetUrls = (html = "") => {
  const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
  return String(html || "")
    .replace(new RegExp(`${escapeForRegExp(currentOrigin)}${escapeForRegExp(LIVE_ASSET_PROXY_PREFIX)}`, "g"), LIVE_SITE_ORIGIN)
    .replace(new RegExp(escapeForRegExp(LIVE_ASSET_PROXY_PREFIX), "g"), LIVE_SITE_ORIGIN);
};

const looksLikeUsableHtmlDocument = (html = "") => {
  const bodyHtml = extractBodyHtml(html || "");
  const plainText = bodyHtml
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const hasOnlyAppRoot = /<div[^>]+id=["']root["'][^>]*>\s*<\/div>/i.test(bodyHtml) && plainText.length < 80;
  const scriptHeavy = (bodyHtml.match(/<script\b/gi) || []).length >= 2 && plainText.length < 120;
  const looksLikeJsBundle =
    /\bfunction\s+[A-Za-z_$][\w$]*\s*\(|=>\s*\{|\bconst\s+[A-Za-z_$][\w$]*\s*=|\bwindow\./.test(plainText) &&
    !/<(main|section|article|header|footer|nav|h1|h2|p|img)\b/i.test(bodyHtml);
  const looksLikeNotFoundPage =
    /\b404\b/i.test(plainText) &&
    /page\s+you\s+are\s+looking\s+for\s+doesn'?t\s+exist|page\s+not\s+found|has\s+been\s+moved/i.test(plainText);
  return bodyHtml.length > 600 && plainText.length > 80 && !hasOnlyAppRoot && !scriptHeavy && !looksLikeJsBundle && !looksLikeNotFoundPage;
};

const isImportedPlaceholderPage = (page = {}) => {
  const updatedBy = String(page.updatedBy || page.updated_by || "").toLowerCase();
  const summary = String(page.summary || "").toLowerCase();
  return (
    updatedBy.includes("navigation import") ||
    updatedBy.includes("program") ||
    summary.includes("imported from the header navigation") ||
    summary.includes("program at madda walabu university")
  );
};

const getSectionStyles = (section = {}) => ({
  ...defaultSectionStyles,
  ...(section.styles || section.style || {})
});

const getPageStyles = (page = {}) => ({
  ...defaultPageStyles,
  ...(page.styles || page.pageStyles || {})
});

const sectionCanvasStyle = (section = {}) => {
  const styles = getSectionStyles(section);
  return {
    paddingTop: toCssUnit(styles.paddingTop, defaultSectionStyles.paddingTop),
    paddingBottom: toCssUnit(styles.paddingBottom, defaultSectionStyles.paddingBottom),
    paddingLeft: toCssUnit(styles.paddingLeft, defaultSectionStyles.paddingLeft),
    paddingRight: toCssUnit(styles.paddingRight, defaultSectionStyles.paddingRight),
    marginTop: toCssUnit(styles.marginTop, defaultSectionStyles.marginTop),
    marginBottom: toCssUnit(styles.marginBottom, defaultSectionStyles.marginBottom),
    background: styles.backgroundColor || defaultSectionStyles.backgroundColor,
    color: styles.textColor || defaultSectionStyles.textColor,
    textAlign: styles.align || "left",
    borderRadius: toCssUnit(styles.borderRadius, defaultSectionStyles.borderRadius),
    boxShadow: styles.shadow ? "0 22px 48px rgba(8, 25, 51, 0.12)" : "none"
  };
};

const escapeHtml = (value = "") =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const THUMBNAIL_PALETTE = [
  ["#081933", "#1a4b96", "#d6a128"],
  ["#0f2749", "#2b6cb0", "#f3c969"],
  ["#12325d", "#2563eb", "#f6ad55"],
  ["#11243f", "#1d4ed8", "#facc15"],
  ["#1b2b4f", "#0f766e", "#f4b942"],
  ["#1f2937", "#7c3aed", "#f59e0b"]
];

const GENERATED_THUMBNAIL_CACHE = new Map();

const hashString = (value = "") => {
  let hash = 0;
  const input = String(value || "");
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const clampText = (value = "", maxLength = 40) => {
  const text = String(value || "").trim().replace(/\s+/g, " ");
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
};

const splitTextLines = (value = "", maxCharsPerLine = 20, maxLines = 2) => {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    if (lines.length >= maxLines) return;

    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length <= maxCharsPerLine || !currentLine) {
      currentLine = nextLine;
      return;
    }

    lines.push(currentLine);
    currentLine = word;
  });

  if (lines.length < maxLines && currentLine) {
    lines.push(currentLine);
  }

  if (words.length && lines.length === maxLines) {
    const consumedCharacters = lines.join(" ").length;
    const originalText = words.join(" ");
    if (originalText.length > consumedCharacters) {
      lines[maxLines - 1] = clampText(lines[maxLines - 1], maxCharsPerLine);
    }
  }

  return lines.slice(0, maxLines);
};

const getGeneratedThumbnailForPage = (page = {}) => {
  const title = String(page?.title || "Untitled Page").trim() || "Untitled Page";
  const slug = `/${String(page?.slug || slugify(title) || "untitled-page").replace(/^\/+/, "")}`;
  const type = String(page?.type || "Static Page").trim() || "Static Page";
  const menu = String(page?.menu || "Website Page").trim() || "Website Page";
  const status = titleCaseStatus(page?.status || "Draft");
  const cacheKey = JSON.stringify([
    page?.id || "",
    title,
    slug,
    type,
    menu,
    status
  ]);

  if (GENERATED_THUMBNAIL_CACHE.has(cacheKey)) {
    return GENERATED_THUMBNAIL_CACHE.get(cacheKey);
  }

  const palette = THUMBNAIL_PALETTE[hashString(`${menu}:${type}:${slug}`) % THUMBNAIL_PALETTE.length];
  const [baseColor, accentColor, highlightColor] = palette;
  const titleLines = splitTextLines(title, 18, 2);
  const metaLabel = clampText(menu, 22).toUpperCase();
  const detailLabel = clampText(type, 26);
  const safeSlug = clampText(slug, 26);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" role="img" aria-label="${escapeHtml(title)}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${baseColor}" />
          <stop offset="100%" stop-color="${accentColor}" />
        </linearGradient>
        <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${highlightColor}" stop-opacity="0.95" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.22" />
        </linearGradient>
      </defs>
      <rect width="640" height="360" fill="url(#bg)" rx="28" />
      <circle cx="560" cy="82" r="112" fill="#ffffff" opacity="0.08" />
      <circle cx="504" cy="312" r="160" fill="#ffffff" opacity="0.06" />
      <path d="M0 286 C132 220 248 340 394 274 C490 232 566 162 640 176 L640 360 L0 360 Z" fill="#ffffff" opacity="0.08" />
      <rect x="34" y="32" width="132" height="28" rx="14" fill="#ffffff" fill-opacity="0.14" />
      <text x="52" y="51" fill="${highlightColor}" font-size="18" font-family="Arial, Helvetica, sans-serif" font-weight="700" letter-spacing="1.2">${escapeHtml(metaLabel)}</text>
      <rect x="34" y="282" width="572" height="1" fill="#ffffff" fill-opacity="0.2" />
      <text x="36" y="116" fill="#ffffff" font-size="44" font-family="Georgia, Times New Roman, serif" font-weight="700">${escapeHtml(titleLines[0] || "Untitled Page")}</text>
      <text x="36" y="164" fill="#ffffff" font-size="44" font-family="Georgia, Times New Roman, serif" font-weight="700">${escapeHtml(titleLines[1] || "")}</text>
      <text x="36" y="222" fill="#e7eefb" font-size="20" font-family="Arial, Helvetica, sans-serif">${escapeHtml(detailLabel)}</text>
      <text x="36" y="252" fill="#d7e5ff" font-size="18" font-family="Arial, Helvetica, sans-serif">${escapeHtml(safeSlug)}</text>
      <rect x="474" y="38" width="132" height="34" rx="17" fill="#ffffff" fill-opacity="0.16" />
      <text x="540" y="60" text-anchor="middle" fill="#ffffff" font-size="18" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeHtml(status)}</text>
      <rect x="36" y="300" width="152" height="10" rx="5" fill="url(#glow)" />
      <rect x="36" y="322" width="88" height="8" rx="4" fill="#ffffff" fill-opacity="0.22" />
      <rect x="132" y="322" width="118" height="8" rx="4" fill="#ffffff" fill-opacity="0.14" />
    </svg>
  `.trim();

  const dataUri = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  GENERATED_THUMBNAIL_CACHE.set(cacheKey, dataUri);
  return dataUri;
};

const VISUAL_BUILDER_COMMENT_PREFIX = "MWU_VISUAL_BUILDER:";
const HTML_VISUAL_BUILDER_COMMENT_PREFIX = "MWU_HTML_VISUAL_BUILDER:";

const serializeHtmlVisualBuilderSnapshot = (snapshot = {}) => {
  try {
    return `<!--${HTML_VISUAL_BUILDER_COMMENT_PREFIX}${encodeURIComponent(JSON.stringify(snapshot))}-->`;
  } catch {
    return "";
  }
};

const extractHtmlVisualBuilderSnapshot = (markup = "") => {
  const match = String(markup || "").match(/<!--MWU_HTML_VISUAL_BUILDER:([\s\S]*?)-->/i);
  if (!match?.[1]) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
};

const getHtmlVisualBuilderSnapshotFromPage = (page = {}) =>
  extractHtmlVisualBuilderSnapshot(page?.bodyHtml || page?.body_html || page?.rawHtml || page?.raw_html || "");

const createHtmlBuilderElement = (type, overrides = {}) => ({
  id: overrides.id || makeId(),
  type,
  ...overrides
});

const defaultHtmlBuilderBox = (overrides = {}) => ({
  bg: "transparent",
  bgImage: "",
  bgSize: "cover",
  bgPosition: "center center",
  borderWidth: 0,
  borderStyle: "solid",
  borderColor: "#E4E7ED",
  borderRadius: 0,
  width: 0,
  widthUnit: "px",
  height: 0,
  heightUnit: "px",
  minHeight: 0,
  minHeightUnit: "px",
  displayMode: "block",
  flexGrow: 0,
  shadow: false,
  shadowBlur: 18,
  shadowSpread: 0,
  shadowTop: 0,
  shadowRight: 0,
  shadowBottom: 0,
  shadowLeft: 0,
  shadowColor: "#0f172a",
  ...overrides
});

const defaultHtmlBuilderAdvanced = (overrides = {}) => ({
  marginTop: 0,
  marginRight: 0,
  marginBottom: 0,
  marginLeft: 0,
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  opacity: 100,
  hideDesktop: false,
  hideTablet: false,
  hideMobile: false,
  animation: "none",
  cssClasses: "",
  customCss: "",
  ...overrides
});

const buildHtmlBuilderPageSettings = (page = {}, storedPageSettings = {}) => ({
  title: page?.title || storedPageSettings.title || "Untitled Page",
  slug: page?.slug || storedPageSettings.slug || "untitled-page",
  status: String(page?.status || storedPageSettings.status || "Draft").toLowerCase(),
  seoTitle: page?.seoTitle || storedPageSettings.seoTitle || page?.title || "Untitled Page",
  seoDescription: page?.seoDescription || storedPageSettings.seoDescription || page?.summary || "",
  canvasBg: storedPageSettings.canvasBg || "#ffffff",
  bodyBg: storedPageSettings.bodyBg || "#f4f6fb",
  fontFamily: storedPageSettings.fontFamily || "Inter"
});

const htmlBuilderSpacingFromNode = (node, key) => {
  const inlineStyle = node?.style?.[key];
  if (!inlineStyle) return 0;
  const match = String(inlineStyle).match(/-?\d+(\.\d+)?/);
  return match ? Math.round(Number(match[0])) : 0;
};

const htmlBuilderColorFromNode = (node, key) => {
  const value = String(node?.style?.[key] || "").trim();
  return value || "";
};

const extractHtmlBuilderSourceMarkup = (page = {}) => {
  if (isImportedPlaceholderPage(page) && !(page.rawHtml || page.raw_html || page.bodyHtml || page.body_html)) {
    return "";
  }

  const storedDocument = getStoredEditableDocument(page);
  if (storedDocument?.bodyHtml) {
    return storedDocument.bodyHtml;
  }

  const sectionMarkup = (page.sections || [])
    .map((section) => section?.html || section?.rawHtml || section?.raw_html || section?.body || section?.content || "")
    .filter(Boolean)
    .join("\n");

  return sectionMarkup || "";
};

const createHtmlBuilderTextElement = (text = "") =>
  createHtmlBuilderElement("text", {
    content: { text },
    style: { fontSize: 15, lineHeight: 1.7, color: "#4B5468", align: "left", letterSpacing: 0 },
    box: defaultHtmlBuilderBox(),
    advanced: defaultHtmlBuilderAdvanced()
  });

const createHtmlBuilderHeadingElement = (text = "", tag = "h2") =>
  createHtmlBuilderElement("heading", {
    content: { text, tag },
    style: { fontSize: tag === "h1" ? 40 : tag === "h2" ? 32 : 24, fontWeight: "700", color: "#161D2B", align: "left", letterSpacing: 0, transform: "none" },
    box: defaultHtmlBuilderBox(),
    advanced: defaultHtmlBuilderAdvanced()
  });

const createHtmlBuilderImageElement = (src = "", alt = "") =>
  createHtmlBuilderElement("image", {
    content: { src: src || assets.hero, alt: alt || "Image" },
    style: { width: 100, widthUnit: "%", height: 0, heightUnit: "px", fit: "cover", radius: 12, align: "left" },
    box: defaultHtmlBuilderBox({ displayMode: "fullwidth" }),
    advanced: defaultHtmlBuilderAdvanced()
  });

const createHtmlBuilderButtonElement = (text = "Learn More", link = "#") =>
  createHtmlBuilderElement("button", {
    content: { text, link },
    style: { bg: "#C99A3B", color: "#0B1830", radius: 8, size: "md", align: "left", borderWidth: 0, borderColor: "#0B1830" },
    box: defaultHtmlBuilderBox(),
    advanced: defaultHtmlBuilderAdvanced()
  });

const createHtmlBuilderListElement = (items = []) =>
  createHtmlBuilderElement("list", {
    content: { items: items.join("\n") },
    style: { color: "#161D2B", fontSize: 14, markerColor: "#C99A3B", gap: 9 },
    box: defaultHtmlBuilderBox(),
    advanced: defaultHtmlBuilderAdvanced()
  });

const createHtmlBuilderSpacerElement = (height = 32) =>
  createHtmlBuilderElement("spacer", {
    content: {},
    style: { height },
    box: defaultHtmlBuilderBox(),
    advanced: defaultHtmlBuilderAdvanced()
  });

const createHtmlBuilderContainerElement = (children = [], overrides = {}) =>
  createHtmlBuilderElement("container", {
    content: { name: overrides.name || "Container" },
    style: {
      flow: overrides.flow || "column",
      gap: overrides.gap ?? 0,
      justify: overrides.justify || "flex-start",
      alignItems: overrides.alignItems || "stretch"
    },
    box: defaultHtmlBuilderBox(overrides.box || {}),
    advanced: defaultHtmlBuilderAdvanced(overrides.advanced || {}),
    children
  });

const createHtmlBuilderImportedPageElement = (page = {}) => {
  const storedDocument = getStoredEditableDocument(page);
  const importedBodyHtml =
    storedDocument?.bodyHtml ||
    page?.bodyHtml ||
    page?.body_html ||
    extractBodyHtml(page?.rawHtml || page?.raw_html || "") ||
    "";

  return createHtmlBuilderElement("html", {
    content: { code: importedBodyHtml },
    style: {},
    box: defaultHtmlBuilderBox({
      displayMode: "fullwidth",
      width: 100,
      widthUnit: "%",
      bg: "transparent",
      borderWidth: 0,
      borderRadius: 0,
      shadow: false
    }),
    advanced: defaultHtmlBuilderAdvanced({
      marginTop: 0,
      marginRight: 0,
      marginBottom: 0,
      marginLeft: 0,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0
    })
  });
};

const convertDomNodeToHtmlBuilderElements = (node) => {
  if (!node) return [];

  if (node.nodeType === 3) {
    const text = String(node.textContent || "").replace(/\s+/g, " ").trim();
    return text ? [createHtmlBuilderTextElement(text)] : [];
  }

  if (node.nodeType !== 1) {
    return [];
  }

  const tag = String(node.tagName || "").toLowerCase();
  if (["script", "style", "noscript"].includes(tag)) {
    return [];
  }

  const text = String(node.textContent || "").replace(/\s+/g, " ").trim();
  const children = Array.from(node.childNodes || []).flatMap(convertDomNodeToHtmlBuilderElements);

  if (/^h[1-6]$/.test(tag) && text) {
    return [createHtmlBuilderHeadingElement(text, tag)];
  }

  if (tag === "p" && text) {
    return [createHtmlBuilderTextElement(text)];
  }

  if (tag === "img") {
    return [createHtmlBuilderImageElement(node.getAttribute("src") || "", node.getAttribute("alt") || "")];
  }

  if ((tag === "a" || tag === "button") && text && text.length <= 80) {
    return [createHtmlBuilderButtonElement(text, node.getAttribute("href") || "#")];
  }

  if ((tag === "ul" || tag === "ol")) {
    const items = Array.from(node.querySelectorAll(":scope > li"))
      .map((item) => String(item.textContent || "").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    return items.length ? [createHtmlBuilderListElement(items)] : children;
  }

  if (tag === "hr") {
    return [createHtmlBuilderElement("divider", {
      content: {},
      style: { color: "#E4E7ED", thickness: 1, width: 100, align: "center", lineStyle: "solid" },
      box: defaultHtmlBuilderBox(),
      advanced: defaultHtmlBuilderAdvanced()
    })];
  }

  if (!children.length) {
    if (text && ["div", "span", "article", "section"].includes(tag)) {
      return [createHtmlBuilderTextElement(text)];
    }
    return [];
  }

  const isRowLike = /(^|\s)(row|columns?|grid|d-flex|flex-row)(\s|$)/i.test(node.className || "") ||
    /flex-direction\s*:\s*row/i.test(node.getAttribute("style") || "");

  const backgroundColor = htmlBuilderColorFromNode(node, "backgroundColor");
  const borderColor = htmlBuilderColorFromNode(node, "borderColor");

  return [createHtmlBuilderContainerElement(children, {
    name: tag === "section" ? "Section" : "Container",
    flow: isRowLike ? "row" : "column",
    gap: 0,
    box: {
      bg: backgroundColor || "transparent",
      borderColor: borderColor || "#E4E7ED",
      borderWidth: borderColor ? 1 : 0,
      borderRadius: htmlBuilderSpacingFromNode(node, "borderRadius"),
      displayMode: "fullwidth"
    },
    advanced: {
      marginTop: htmlBuilderSpacingFromNode(node, "marginTop"),
      marginRight: htmlBuilderSpacingFromNode(node, "marginRight"),
      marginBottom: htmlBuilderSpacingFromNode(node, "marginBottom"),
      marginLeft: htmlBuilderSpacingFromNode(node, "marginLeft"),
      paddingTop: htmlBuilderSpacingFromNode(node, "paddingTop"),
      paddingRight: htmlBuilderSpacingFromNode(node, "paddingRight"),
      paddingBottom: htmlBuilderSpacingFromNode(node, "paddingBottom"),
      paddingLeft: htmlBuilderSpacingFromNode(node, "paddingLeft")
    }
  })];
};

const buildHtmlVisualBuilderFallbackElements = (page = {}) => {
  if (isLocalDraftPage(page) && !hasPersistedEditableMarkup(page)) {
    return [];
  }

  const markup = extractHtmlBuilderSourceMarkup(page);
  if (markup && typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<body>${markup}</body>`, "text/html");
      const bodyChildren = Array.from(doc.body.childNodes || []);
      const elements = bodyChildren.flatMap(convertDomNodeToHtmlBuilderElements).filter(Boolean);
      if (elements.length) {
        return elements;
      }
    } catch {
      // Fall through to structured/data defaults.
    }
  }

  const sectionElements = (page.sections || [])
    .flatMap((section) => {
      const parts = [];
      if (section?.title) {
        parts.push(createHtmlBuilderHeadingElement(section.title, "h2"));
      }
      if (section?.body || section?.content) {
        parts.push(createHtmlBuilderTextElement(section.body || section.content));
      }
      return parts.length ? [createHtmlBuilderContainerElement(parts, { name: section?.type || "Section", box: { displayMode: "fullwidth" } })] : [];
    });

  if (sectionElements.length) {
    return sectionElements;
  }

  const hasMeaningfulPageContent = Boolean(
    String(page?.title || "").trim() ||
    String(page?.summary || "").trim() ||
    String(page?.heroHeadline || "").trim() ||
    String(page?.bodyHtml || page?.body_html || page?.rawHtml || page?.raw_html || "").trim()
  );

  if (!hasMeaningfulPageContent || String(page?.slug || "").trim() === "untitled-page") {
    return [];
  }

  const fallbackCopy = String(
    page?.summary ||
    page?.seoDescription ||
    page?.seo_description ||
    "This saved page does not have imported HTML yet. Add or edit its content here."
  ).trim();

  return [
    createHtmlBuilderContainerElement(
      [
        createHtmlBuilderHeadingElement(page?.heroHeadline || page?.title || "Untitled Page", "h1"),
        ...(fallbackCopy ? [createHtmlBuilderTextElement(fallbackCopy)] : [])
      ],
      {
        name: page?.type || "Page content",
        box: { displayMode: "boxed", width: 1180, widthUnit: "px" },
        advanced: { paddingTop: 64, paddingRight: 24, paddingBottom: 64, paddingLeft: 24 }
      }
    )
  ];
};

const buildHtmlVisualBuilderInitPayload = (page = {}) => {
  const embeddedSnapshot = getHtmlVisualBuilderSnapshotFromPage(page) || {};
  const directSnapshot = page?.visualBuilder || page?.visual_builder || {};
  const storedSnapshot = Array.isArray(directSnapshot?.elements) ? directSnapshot : embeddedSnapshot;
  const storedPageSettings = storedSnapshot?.pageSettings || {};
  const storedElements = Array.isArray(storedSnapshot?.elements) ? storedSnapshot.elements : [];
  const hasImportedHtml = hasPersistedEditableMarkup(page);
  const shouldStartBlank =
    !hasImportedHtml &&
    !storedElements.length &&
    Boolean(
      page?.isLocalDraft ||
      page?._isLocalDraft ||
      page?.localOnly
    );
  const storedDocument = getStoredEditableDocument(page);
  const sourceImportHtml =
    storedDocument?.fullHtml ||
    page?.rawHtml ||
    page?.raw_html ||
    mergeBodyIntoHtml(
      "",
      storedDocument?.bodyHtml ||
        page?.bodyHtml ||
        page?.body_html ||
        extractBodyHtml(page?.rawHtml || page?.raw_html || "") ||
        ""
    );
  const isImportedSnapshot =
    hasImportedHtml &&
    (
      storedPageSettings?.exactImport ||
      (storedElements.length === 1 && String(storedElements?.[0]?.type || "").toLowerCase() === "html")
    );
  const nextPageSettings = buildHtmlBuilderPageSettings(page, storedPageSettings);
  const exactImport = Boolean(hasImportedHtml && (isImportedSnapshot || !storedElements.length));
  const importCssLinks = exactImport ? resolveHtmlBuilderImportCssLinks(sourceImportHtml) : [];
  const importInlineCss = exactImport ? extractInlineStylesFromHtmlDocument(sourceImportHtml) : "";

  return {
    ...(storedSnapshot || {}),
    pageSettings: {
      ...nextPageSettings,
      exactImport,
      canvasBg: exactImport ? "#ffffff" : nextPageSettings.canvasBg,
      bodyBg: exactImport ? "#eef0f3" : nextPageSettings.bodyBg
    },
    importCssLinks,
    importInlineCss,
    liveAssetProxyPrefix: LIVE_ASSET_PROXY_PREFIX,
    liveSiteOrigin: LIVE_SITE_ORIGIN,
    elements: storedElements.length
      ? storedElements
      : hasImportedHtml
        ? [createHtmlBuilderImportedPageElement(page)]
        : shouldStartBlank
          ? []
          : buildHtmlVisualBuilderFallbackElements(page)
  };
};

const extractInlineStylesFromHtmlDocument = (html = "") =>
  Array.from(String(html || "").matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi))
    .map((match) => String(match?.[1] || "").trim())
    .filter(Boolean)
    .join("\n\n");

const extractStylesheetLinksFromHtmlDocument = (html = "") => {
  const rawHtml = String(html || "");
  const discoveredLinks = [];

  if (typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawHtml, "text/html");
      doc.querySelectorAll('link[rel~="stylesheet"][href]').forEach((node) => {
        const href = String(node.getAttribute("href") || "").trim();
        if (href) {
          discoveredLinks.push(href);
        }
      });
    } catch {
      // Fall back to regex extraction below.
    }
  }

  if (!discoveredLinks.length) {
    Array.from(rawHtml.matchAll(/<link\b[^>]*href=(['"])([^"']+)\1[^>]*>/gi)).forEach((match) => {
      const markup = String(match?.[0] || "");
      if (!/\brel=(['"])[^"']*stylesheet[^"']*\1/i.test(markup)) {
        return;
      }
      const href = String(match?.[2] || "").trim();
      if (href) {
        discoveredLinks.push(href);
      }
    });
  }

  return Array.from(
    new Set(
      discoveredLinks
        .map((href) => normalizeStylesheetUrlForEditableCanvas(href))
        .filter(Boolean)
    )
  );
};

const resolveHtmlBuilderImportCssLinks = (html = "") => {
  const discoveredLinks = extractStylesheetLinksFromHtmlDocument(html);
  if (!discoveredLinks.length) {
    return proxiedSiteCssLinks;
  }
  return Array.from(new Set([...discoveredLinks, ...proxiedSiteCssLinks]));
};

const VISUAL_WIDGET_LIBRARY = {
  heading: {
    label: "Heading",
    settings: {
      text: "Add a compelling heading",
      tag: "h2",
      color: "#081933",
      fontSize: "42px",
      fontWeight: "700",
      align: "left",
      maxWidth: "820px"
    }
  },
  text: {
    label: "Text",
    settings: {
      text: "Write supporting page copy here. Use this widget for paragraphs, explanations, and narrative content.",
      color: "#667085",
      fontSize: "18px",
      lineHeight: "1.7",
      align: "left",
      maxWidth: "820px"
    }
  },
  button: {
    label: "Button",
    settings: {
      label: "Primary Action",
      url: "#",
      color: "#ffffff",
      backgroundColor: "#1a4b96",
      borderRadius: "10px",
      paddingY: "14px",
      paddingX: "20px",
      fontSize: "16px",
      fontWeight: "800",
      align: "left"
    }
  },
  image: {
    label: "Image",
    settings: {
      src: assets.hero,
      alt: "Visual content",
      height: "320px",
      objectFit: "cover",
      borderRadius: "18px",
      boxShadow: true
    }
  },
  divider: {
    label: "Divider",
    settings: {
      color: "#d9e2dc",
      thickness: "1px",
      width: "100%"
    }
  },
  spacer: {
    label: "Spacer",
    settings: {
      height: "32px"
    }
  }
};

const createVisualWidget = (widgetType = "heading", overrides = {}) => {
  const definition = VISUAL_WIDGET_LIBRARY[widgetType] || VISUAL_WIDGET_LIBRARY.heading;
  return {
    id: overrides.id || makeId(),
    elType: "widget",
    widgetType,
    isInner: Boolean(overrides.isInner),
    settings: {
      ...definition.settings,
      ...(overrides.settings || {})
    },
    elements: [],
    ...overrides
  };
};

const createVisualContainer = (overrides = {}) => ({
  id: overrides.id || makeId(),
  elType: "container",
  isInner: Boolean(overrides.isInner),
  settings: {
    direction: "column",
    gap: "24px",
    padding: "28px",
    backgroundColor: "#ffffff",
    textColor: "#18212f",
    borderRadius: "20px",
    borderColor: "rgba(8,25,51,0.08)",
    borderWidth: "1px",
    contentWidth: "boxed",
    maxWidth: "1180px",
    justifyContent: "flex-start",
    alignItems: "stretch",
    minHeight: "",
    boxShadow: false,
    ...(overrides.settings || {})
  },
  elements: Array.isArray(overrides.elements) ? overrides.elements : [],
  ...overrides
});

const createVisualBuilderContent = (page = {}) => {
  const heroCopy = createVisualContainer({
    isInner: true,
    settings: {
      backgroundColor: "transparent",
      borderWidth: "0px",
      borderRadius: "0px",
      boxShadow: false,
      padding: "0px",
      gap: "18px",
      justifyContent: "center",
      alignItems: "flex-start"
    },
    elements: [
      createVisualWidget("heading", {
        settings: {
          text: page.heroHeadline || "Create pages visually with a modern builder",
          tag: "h1",
          color: "#ffffff",
          fontSize: "56px",
          maxWidth: "680px"
        }
      }),
      createVisualWidget("text", {
        settings: {
          text: page.summary || "Build full layouts using containers and widgets instead of editing raw HTML.",
          color: "#eaf1f7",
          maxWidth: "640px"
        }
      }),
      createVisualWidget("button", {
        settings: {
          label: page.ctaLabel || "Learn More",
          url: page.ctaUrl || "#",
          backgroundColor: "#d6a128",
          color: "#081933"
        }
      })
    ]
  });

  const heroImage = createVisualContainer({
    isInner: true,
    settings: {
      backgroundColor: "transparent",
      borderWidth: "0px",
      borderRadius: "0px",
      boxShadow: false,
      padding: "0px",
      justifyContent: "center",
      alignItems: "stretch"
    },
    elements: [
      createVisualWidget("image", {
        settings: {
          src: page.heroImage || assets.hero,
          alt: page.title || "Page preview image",
          height: "420px",
          objectFit: "cover"
        }
      })
    ]
  });

  const card = (title, body) =>
    createVisualContainer({
      isInner: true,
      settings: {
        backgroundColor: "#ffffff",
        borderColor: "#d7e3f2",
        borderWidth: "1px",
        borderRadius: "18px",
        padding: "24px",
        gap: "12px",
        boxShadow: true
      },
      elements: [
        createVisualWidget("heading", {
          settings: {
            text: title,
            tag: "h3",
            fontSize: "28px"
          }
        }),
        createVisualWidget("text", {
          settings: {
            text: body,
            fontSize: "16px"
          }
        })
      ]
    });

  return [
    createVisualContainer({
      settings: {
        direction: "row",
        gap: "32px",
        padding: "72px",
        backgroundColor: "#081933",
        textColor: "#ffffff",
        borderWidth: "0px",
        contentWidth: "boxed",
        alignItems: "center"
      },
      elements: [heroCopy, heroImage]
    }),
    createVisualContainer({
      settings: {
        direction: "column",
        gap: "16px",
        padding: "48px",
        backgroundColor: "#ffffff",
        borderColor: "#d7e3f2",
        borderWidth: "1px",
        boxShadow: true
      },
      elements: [
        createVisualWidget("heading", {
          settings: {
            text: page.title || "New Visual Page",
            tag: "h2",
            fontSize: "38px"
          }
        }),
        createVisualWidget("text", {
          settings: {
            text: "Use the widget palette to add headings, copy, buttons, images, spacers, and more. Use containers to build full-width hero areas, boxed sections, columns, and feature layouts."
          }
        })
      ]
    }),
    createVisualContainer({
      settings: {
        direction: "row",
        gap: "20px",
        padding: "0px",
        backgroundColor: "transparent",
        borderWidth: "0px",
        boxShadow: false,
        alignItems: "stretch"
      },
      elements: [
        card("Container-first layout", "Build rows, columns, and nested structures visually."),
        card("Widget-driven content", "Each widget stores its own settings like text, image, button, and spacing controls."),
        card("Design controls", "Style and advanced settings update the live preview without writing raw code.")
      ]
    })
  ];
};

const createDefaultVisualBuilderModel = (page = {}) => ({
  version: "1.0",
  content: createVisualBuilderContent(page)
});

const cloneVisualBuilderModel = (model = {}, regenerateIds = false) => ({
  version: model?.version || "1.0",
  content: Array.isArray(model?.content)
    ? model.content.map((element) => cloneVisualBuilderElement(element, regenerateIds))
    : []
});

const cloneVisualBuilderElement = (element = {}, regenerateIds = false) => {
  if (!element || typeof element !== "object") return element;
  const cloned = {
    ...element,
    id: regenerateIds ? makeId() : element.id,
    settings: { ...(element.settings || {}) },
    elements: Array.isArray(element.elements)
      ? element.elements.map((child) => cloneVisualBuilderElement(child, regenerateIds))
      : []
  };
  return cloned;
};

const normalizeVisualBuilderElement = (element = {}) => {
  if (element?.elType === "widget") {
    return createVisualWidget(element.widgetType || "heading", {
      ...element,
      settings: { ...((VISUAL_WIDGET_LIBRARY[element.widgetType || "heading"] || VISUAL_WIDGET_LIBRARY.heading).settings), ...(element.settings || {}) },
      elements: []
    });
  }

  return createVisualContainer({
    ...element,
    elements: Array.isArray(element?.elements) ? element.elements.map(normalizeVisualBuilderElement) : []
  });
};

const normalizeVisualBuilderModel = (model = {}, page = {}) => {
  const content = Array.isArray(model?.content)
    ? model.content.map(normalizeVisualBuilderElement)
    : Array.isArray(model?.elements)
      ? model.elements.map(normalizeVisualBuilderElement)
      : [];

  return {
    version: model?.version || "1.0",
    content: content.length ? content : createVisualBuilderContent(page)
  };
};

const serializeVisualBuilderModel = (model = {}) => {
  try {
    return `<!--${VISUAL_BUILDER_COMMENT_PREFIX}${encodeURIComponent(JSON.stringify(model))}-->`;
  } catch {
    return "";
  }
};

const extractVisualBuilderModelFromMarkup = (html = "") => {
  const match = String(html || "").match(/<!--MWU_VISUAL_BUILDER:([\s\S]*?)-->/i);
  if (!match?.[1]) return null;

  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
};

const getVisualContainerInlineStyle = (container = {}, isRoot = false) => {
  const settings = container.settings || {};
  const borderWidth = toCssUnit(settings.borderWidth || "0px", "0px");
  const hasBorder = String(borderWidth || "0").replace(/[^0-9.]/g, "") !== "0";
  return [
    "display:flex",
    `flex-direction:${settings.direction || "column"}`,
    `gap:${toCssUnit(settings.gap || "24px", "24px")}`,
    `padding:${toCssUnit(settings.padding || "0px", "0px")}`,
    `justify-content:${settings.justifyContent || "flex-start"}`,
    `align-items:${settings.alignItems || "stretch"}`,
    `background:${settings.backgroundColor || "transparent"}`,
    `color:${settings.textColor || "inherit"}`,
    `border-radius:${toCssUnit(settings.borderRadius || "0px", "0px")}`,
    `border:${hasBorder ? `${borderWidth} solid ${settings.borderColor || "transparent"}` : "0"}`,
    `box-shadow:${settings.boxShadow ? "0 20px 52px rgba(8,25,51,0.10)" : "none"}`,
    `width:${settings.contentWidth === "full" ? "100%" : "min(100%, " + (settings.maxWidth || "1180px") + ")"}`,
    `${isRoot ? "margin:0 auto" : ""}`,
    settings.minHeight ? `min-height:${toCssUnit(settings.minHeight, settings.minHeight)}` : ""
  ].filter(Boolean).join(";");
};

const getVisualWidgetWrapperStyle = (widget = {}) => {
  const settings = widget.settings || {};
  return [
    settings.width ? `width:${toCssUnit(settings.width, settings.width)}` : "",
    settings.maxWidth ? `max-width:${toCssUnit(settings.maxWidth, settings.maxWidth)}` : "",
    settings.padding ? `padding:${toCssUnit(settings.padding, settings.padding)}` : "",
    settings.marginTop ? `margin-top:${toCssUnit(settings.marginTop, settings.marginTop)}` : "",
    settings.marginBottom ? `margin-bottom:${toCssUnit(settings.marginBottom, settings.marginBottom)}` : "",
    settings.align ? `text-align:${settings.align}` : "",
    settings.backgroundColor ? `background:${settings.backgroundColor}` : "",
    settings.borderRadius ? `border-radius:${toCssUnit(settings.borderRadius, settings.borderRadius)}` : ""
  ].filter(Boolean).join(";");
};

const buildVisualWidgetMarkup = (widget = {}) => {
  const settings = widget.settings || {};
  const wrapperStyle = getVisualWidgetWrapperStyle(widget);

  if (widget.widgetType === "heading") {
    const tag = settings.tag || "h2";
    return `<div class="mwu-vb-widget-wrap mwu-vb-widget-heading" style="${wrapperStyle}"><${tag} style="margin:0;color:${settings.color || "#081933"};font-size:${toCssUnit(settings.fontSize || "42px", "42px")};font-weight:${settings.fontWeight || "700"};line-height:1.12;">${escapeHtml(settings.text || "Heading")}</${tag}></div>`;
  }

  if (widget.widgetType === "text") {
    const paragraphs = String(settings.text || "")
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => `<p style="margin:0 0 14px;color:${settings.color || "#667085"};font-size:${toCssUnit(settings.fontSize || "18px", "18px")};line-height:${settings.lineHeight || "1.7"};">${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
      .join("");
    return `<div class="mwu-vb-widget-wrap mwu-vb-widget-text" style="${wrapperStyle}">${paragraphs || `<p style="margin:0;color:${settings.color || "#667085"};">Text widget</p>`}</div>`;
  }

  if (widget.widgetType === "button") {
    return `<div class="mwu-vb-widget-wrap mwu-vb-widget-button" style="${wrapperStyle}"><a href="${escapeHtml(settings.url || "#")}" style="display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:${toCssUnit(settings.paddingY || "14px", "14px")} ${toCssUnit(settings.paddingX || "20px", "20px")};border-radius:${toCssUnit(settings.borderRadius || "10px", "10px")};background:${settings.backgroundColor || "#1a4b96"};color:${settings.color || "#ffffff"};font-size:${toCssUnit(settings.fontSize || "16px", "16px")};font-weight:${settings.fontWeight || "800"};text-decoration:none;">${escapeHtml(settings.label || "Button")}</a></div>`;
  }

  if (widget.widgetType === "image") {
    return `<div class="mwu-vb-widget-wrap mwu-vb-widget-image" style="${wrapperStyle}"><img src="${escapeHtml(settings.src || assets.hero)}" alt="${escapeHtml(settings.alt || "")}" style="width:100%;height:${toCssUnit(settings.height || "320px", "320px")};object-fit:${settings.objectFit || "cover"};border-radius:${toCssUnit(settings.borderRadius || "18px", "18px")};box-shadow:${settings.boxShadow ? "0 20px 45px rgba(8,25,51,0.12)" : "none"};" /></div>`;
  }

  if (widget.widgetType === "divider") {
    return `<div class="mwu-vb-widget-wrap mwu-vb-widget-divider" style="${wrapperStyle}"><hr style="margin:0;border:0;border-top:${toCssUnit(settings.thickness || "1px", "1px")} solid ${settings.color || "#d9e2dc"};width:${toCssUnit(settings.width || "100%", "100%")};" /></div>`;
  }

  if (widget.widgetType === "spacer") {
    return `<div class="mwu-vb-widget-wrap mwu-vb-widget-spacer" style="${wrapperStyle}"><div style="height:${toCssUnit(settings.height || "32px", "32px")};"></div></div>`;
  }

  return "";
};

const buildVisualBuilderElementsMarkup = (elements = [], isRoot = false) =>
  (elements || []).map((element) => {
    if (element?.elType === "widget") {
      return buildVisualWidgetMarkup(element);
    }

    const tagName = isRoot ? "section" : "div";
    return `<${tagName} class="mwu-vb-container${element?.isInner ? " is-inner" : ""}" style="${getVisualContainerInlineStyle(element, isRoot)}">${buildVisualBuilderElementsMarkup(element?.elements || [], false)}</${tagName}>`;
  }).join("");

const buildVisualBuilderBodyMarkup = (page = {}) => {
  const pageStyles = getPageStyles(page);
  const model = normalizeVisualBuilderModel(page.visualBuilder || page.visual_builder || {}, page);
  const metadata = serializeVisualBuilderModel(model);
  return `${metadata}<main class="mwu-visual-builder-page" style="background:${pageStyles.backgroundColor};color:${pageStyles.textColor};font-family:${pageStyles.fontFamily};padding:24px 0 56px;">${buildVisualBuilderElementsMarkup(model.content, true)}</main>`;
};

const isVisualBuilderPage = (page = {}) =>
  String(page?.builderKind || page?.builder_kind || "").toLowerCase() === "visual";

const getVisualBuilderModelFromPage = (page = {}) =>
  normalizeVisualBuilderModel(
    page?.visualBuilder ||
      page?.visual_builder ||
      extractVisualBuilderModelFromMarkup(page?.bodyHtml || page?.body_html || page?.rawHtml || page?.raw_html || "") ||
      {},
    page
  );

const getVisualBuilderElementLabel = (element = {}) => {
  if (element?.elType === "widget") {
    return VISUAL_WIDGET_LIBRARY[element.widgetType]?.label || "Widget";
  }

  return element?.settings?.name || (element?.isInner ? "Inner Container" : "Container");
};

const walkVisualBuilderElements = (elements = [], visitor, depth = 0, parent = null) => {
  (elements || []).forEach((element, index) => {
    visitor({
      element,
      index,
      depth,
      parent,
      parentId: parent?.id || null,
      siblings: elements
    });

    if (element?.elType === "container" && Array.isArray(element?.elements) && element.elements.length) {
      walkVisualBuilderElements(element.elements, visitor, depth + 1, element);
    }
  });
};

const findVisualBuilderElementMeta = (elements = [], targetId = "") => {
  if (!targetId) {
    return null;
  }

  let found = null;
  walkVisualBuilderElements(elements, (meta) => {
    if (!found && String(meta.element?.id) === String(targetId)) {
      found = meta;
    }
  });
  return found;
};

const resolveVisualBuilderTargetContainerId = (model = {}, selectedId = "") => {
  const content = Array.isArray(model?.content) ? model.content : [];
  const selectedMeta = findVisualBuilderElementMeta(content, selectedId);
  if (selectedMeta?.element?.elType === "container") {
    return selectedMeta.element.id;
  }
  if (selectedMeta?.parent?.elType === "container") {
    return selectedMeta.parent.id;
  }
  return content.find((element) => element?.elType === "container")?.id || null;
};

const updateVisualBuilderElements = (elements = [], targetId = "", updater) =>
  (elements || []).map((element) => {
    if (String(element?.id) === String(targetId)) {
      return updater(element);
    }

    if (element?.elType === "container" && Array.isArray(element?.elements)) {
      return {
        ...element,
        elements: updateVisualBuilderElements(element.elements, targetId, updater)
      };
    }

    return element;
  });

const appendVisualBuilderElement = (elements = [], parentId = null, nextElement = null) => {
  if (!nextElement) {
    return Array.isArray(elements) ? elements : [];
  }

  if (!parentId) {
    return [...(Array.isArray(elements) ? elements : []), nextElement];
  }

  const appendToLevel = (level = []) => {
    let inserted = false;
    const nextLevel = level.map((element) => {
      if (String(element?.id) === String(parentId) && element?.elType === "container") {
        inserted = true;
        return {
          ...element,
          elements: [...(element.elements || []), nextElement]
        };
      }

      if (element?.elType === "container" && Array.isArray(element?.elements)) {
        const result = appendToLevel(element.elements);
        if (result.inserted) {
          inserted = true;
          return {
            ...element,
            elements: result.level
          };
        }
      }

      return element;
    });

    return {
      inserted,
      level: inserted ? nextLevel : level
    };
  };

  const result = appendToLevel(elements);
  return result.inserted ? result.level : [...(elements || []), nextElement];
};

const removeVisualBuilderElement = (elements = [], targetId = "") => {
  let removed = false;
  const nextElements = (elements || [])
    .filter((element) => {
      const shouldKeep = String(element?.id) !== String(targetId);
      removed = removed || !shouldKeep;
      return shouldKeep;
    })
    .map((element) => {
      if (element?.elType === "container" && Array.isArray(element?.elements)) {
        const nextChildren = removeVisualBuilderElement(element.elements, targetId);
        if (nextChildren !== element.elements) {
          removed = true;
          return {
            ...element,
            elements: nextChildren
          };
        }
      }

      return element;
    });

  return removed ? nextElements : elements;
};

const duplicateVisualBuilderElement = (elements = [], targetId = "") => {
  let duplicatedId = "";
  const duplicateInLevel = (level = []) => {
    let changed = false;
    const nextLevel = [];

    level.forEach((element) => {
      if (String(element?.id) === String(targetId)) {
        const duplicate = cloneVisualBuilderElement(element, true);
        duplicatedId = duplicate.id;
        nextLevel.push(element, duplicate);
        changed = true;
        return;
      }

      if (element?.elType === "container" && Array.isArray(element?.elements)) {
        const nextChildren = duplicateInLevel(element.elements);
        if (nextChildren !== element.elements) {
          nextLevel.push({
            ...element,
            elements: nextChildren
          });
          changed = true;
          return;
        }
      }

      nextLevel.push(element);
    });

    return changed ? nextLevel : level;
  };

  return {
    elements: duplicateInLevel(elements),
    duplicatedId
  };
};

const moveVisualBuilderElement = (elements = [], targetId = "", direction = "down") => {
  const moveInLevel = (level = []) => {
    const index = level.findIndex((element) => String(element?.id) === String(targetId));
    if (index >= 0) {
      const destination = direction === "up" ? index - 1 : index + 1;
      if (destination < 0 || destination >= level.length) {
        return level;
      }

      const nextLevel = [...level];
      const [moved] = nextLevel.splice(index, 1);
      nextLevel.splice(destination, 0, moved);
      return nextLevel;
    }

    let changed = false;
    const nextLevel = level.map((element) => {
      if (element?.elType === "container" && Array.isArray(element?.elements)) {
        const nextChildren = moveInLevel(element.elements);
        if (nextChildren !== element.elements) {
          changed = true;
          return {
            ...element,
            elements: nextChildren
          };
        }
      }

      return element;
    });

    return changed ? nextLevel : level;
  };

  return moveInLevel(elements);
};

const buildStructuredBodyMarkup = (value = "") => {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  const listItems = text
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);

  if (listItems.length > 1) {
    return `<ul class="mwu-generated-chip-list">${listItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
};

const buildStructuredSectionMarkup = (section = {}, page = {}) => {
  const sectionStyles = getSectionStyles(section);
  const imageUrl = section.image || page.heroImage || "";
  const sectionHtml = section.html || section.rawHtml || section.raw_html || "";
  const sectionBody = section.body || section.content || "";
  const isRawHtmlSection = section.type === "Raw HTML" || section.layout === "Legacy HTML" || Boolean(sectionHtml);
  const sectionTitle = section.title || "Section";
  const sectionEyebrow = section.eyebrow || "";
  const sectionUrl = section.ctaUrl || "#";
  const sectionLabel = section.ctaLabel || "";
  const textHtml = buildStructuredBodyMarkup(sectionBody);

  if (isRawHtmlSection) {
    const safeHtml = stripDangerousHtml(sectionHtml || sectionBody);
    if (safeHtml.trim()) {
      return `<section class="mwu-generated-section mwu-generated-raw">${safeHtml}</section>`;
    }
  }

  return `
    <section
      class="mwu-generated-section"
      style="
        background:${sectionStyles.backgroundColor};
        color:${sectionStyles.textColor};
        padding:${toCssUnit(sectionStyles.paddingTop, defaultSectionStyles.paddingTop)} ${toCssUnit(sectionStyles.paddingRight, defaultSectionStyles.paddingRight)} ${toCssUnit(sectionStyles.paddingBottom, defaultSectionStyles.paddingBottom)} ${toCssUnit(sectionStyles.paddingLeft, defaultSectionStyles.paddingLeft)};
        margin:${toCssUnit(sectionStyles.marginTop, defaultSectionStyles.marginTop)} auto ${toCssUnit(sectionStyles.marginBottom, defaultSectionStyles.marginBottom)};
        border-radius:${toCssUnit(sectionStyles.borderRadius, defaultSectionStyles.borderRadius)};
        border:1px solid rgba(8,25,51,0.08);
        box-shadow:${sectionStyles.shadow ? "0 22px 48px rgba(8, 25, 51, 0.12)" : "none"};
      "
    >
      <div class="mwu-generated-section-grid ${section.layout === "Image first" || section.layout === "Split media" ? "image-first" : ""}">
        <div class="mwu-generated-copy" style="text-align:${sectionStyles.align || "left"};">
          ${sectionEyebrow ? `<span class="mwu-generated-eyebrow" style="color:${sectionStyles.accentColor};">${escapeHtml(sectionEyebrow)}</span>` : ""}
          <h2 style="color:${sectionStyles.headingColor};">${escapeHtml(sectionTitle)}</h2>
          ${textHtml || `<p>${escapeHtml(page.summary || "This section is managed from the admin editor.")}</p>`}
          ${sectionLabel ? `<a class="mwu-generated-button" href="${escapeHtml(sectionUrl)}">${escapeHtml(sectionLabel)}</a>` : ""}
        </div>
        ${imageUrl ? `<div class="mwu-generated-media"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(sectionTitle)}" style="border-radius:${toCssUnit(sectionStyles.imageRadius, defaultSectionStyles.imageRadius)};" /></div>` : ""}
      </div>
    </section>
  `;
};

const buildStructuredPageBodyMarkup = (page = {}) => {
  const pageStyles = getPageStyles(page);
  const visibleSections = (page.sections || []).filter((section) => section.visible !== false);
  const heroImage = page.heroImage || assets.hero;

  return `
    <main class="mwu-generated-page" style="background:${pageStyles.backgroundColor};color:${pageStyles.textColor};font-family:${pageStyles.fontFamily};">
      <section class="mwu-generated-hero" style="background-image:linear-gradient(90deg, rgba(8, 25, 51, 0.92), rgba(26, 75, 150, 0.68)), url('${escapeHtml(heroImage)}');">
        <div class="mwu-generated-hero-copy">
          <span>${escapeHtml(page.heroTag || "Website Page")}</span>
          <h1>${escapeHtml(page.heroHeadline || page.title || "Untitled Page")}</h1>
          <p>${escapeHtml(page.summary || "This page is managed from the admin editor.")}</p>
          ${page.ctaLabel ? `<a class="mwu-generated-button" href="${escapeHtml(page.ctaUrl || "#")}">${escapeHtml(page.ctaLabel)}</a>` : ""}
        </div>
      </section>
      <div class="mwu-generated-sections">
        ${visibleSections.length
          ? visibleSections.map((section) => buildStructuredSectionMarkup(section, page)).join("")
          : `<section class="mwu-generated-section"><div class="mwu-generated-copy"><h2>${escapeHtml(page.title || "Untitled Page")}</h2><p>${escapeHtml(page.summary || "No sections are saved for this page yet.")}</p></div></section>`}
      </div>
    </main>
  `;
};

const hasLegacyHtml = (page = {}) =>
  Boolean(
    page.rawHtml ||
    page.bodyHtml ||
    page.body_html ||
    (page.sections || []).some((section) => section.html || section.rawHtml || section.body || section.content)
  );

const hasPersistedEditableMarkup = (page = {}) =>
  Boolean(
    page.rawHtml ||
    page.raw_html ||
    page.bodyHtml ||
    page.body_html ||
    (page.sections || []).some((section) => section.html || section.rawHtml || section.raw_html)
  );

const hasUsableHtmlBuilderSnapshot = (page = {}) => {
  const directSnapshot = page?.visualBuilder || page?.visual_builder || {};
  const embeddedSnapshot = getHtmlVisualBuilderSnapshotFromPage(page) || {};
  const snapshot = Array.isArray(directSnapshot?.elements) ? directSnapshot : embeddedSnapshot;
  const elements = Array.isArray(snapshot?.elements) ? snapshot.elements : [];
  if (elements.length > 0) {
    return true;
  }

  return Boolean(snapshot?.pageSettings?.exactImport && hasPersistedEditableMarkup(page));
};

const getStoredEditableDocument = (page = {}) => {
  if (isImportedPlaceholderPage(page) && !(page.rawHtml || page.raw_html || page.bodyHtml || page.body_html)) {
    return {
      fullHtml: "",
      bodyHtml: ""
    };
  }

  const storedHtml = page.rawHtml || page.raw_html || "";
  const storedBody = page.bodyHtml || page.body_html || "";
  const sectionHtml = (page.sections || [])
    .map((section) => section?.html || section?.rawHtml || section?.raw_html || "")
    .filter(Boolean)
    .join("\n");
  const generatedBody =
    sectionHtml ||
    ((page.sections || []).some((section) => section?.body || section?.content || section?.title) ? buildStructuredPageBodyMarkup(page) : "");
  const fallbackBody = storedBody || generatedBody;

  if (storedHtml && looksLikeUsableHtmlDocument(storedHtml)) {
    return {
      fullHtml: storedHtml,
      bodyHtml: extractBodyHtml(storedHtml)
    };
  }

  if (fallbackBody) {
    return {
      fullHtml: mergeBodyIntoHtml("", fallbackBody),
      bodyHtml: fallbackBody
    };
  }

  return {
    fullHtml: "",
    bodyHtml: ""
  };
};

const getLivePageUrl = (page = {}) => {
  const explicitUrl = page.sourceUrl || page.source_url || page.url || page.liveUrl || page.live_url || "";
  if (/^https?:\/\//i.test(explicitUrl)) {
    return explicitUrl;
  }

  const route = explicitUrl || page.slug || "";
  const normalizedRoute = String(route || "").trim().replace(/^\/+/, "");
  if (!normalizedRoute || normalizedRoute === "home" || normalizedRoute === "index") {
    return `${LIVE_SITE_ORIGIN}/`;
  }

  try {
    return new URL(`/${normalizedRoute}`, LIVE_SITE_ORIGIN).toString();
  } catch {
    return `${LIVE_SITE_ORIGIN}/${normalizedRoute}`;
  }
};



const getLiveRoutePath = (page = {}) => {
  try {
    const liveUrl = new URL(getLivePageUrl(page));
    return `${liveUrl.pathname}${liveUrl.search}` || "/";
  } catch {
    const slug = String(page.slug || "").trim().replace(/^\/+/, "");
    return slug && !["home", "index"].includes(slug) ? `/${slug}` : "/";
  }
};

const extractBodyHtml = (html = "") => {
  const bodyMatch = String(html).match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch ? bodyMatch[1] : String(html || "");
};

const generatedEditableBaseCss = `
  body { margin: 0; background: #f4f8fb; color: #18212f; font-family: Inter, "Segoe UI", Arial, sans-serif; }
  img { max-width: 100%; height: auto; display: block; }
  .mwu-generated-page { min-height: 100vh; }
  .mwu-generated-hero { padding: 72px 24px; background-size: cover; background-position: center; color: #ffffff; }
  .mwu-generated-hero-copy,
  .mwu-generated-sections { width: min(1180px, calc(100% - 32px)); margin: 0 auto; }
  .mwu-generated-hero-copy span,
  .mwu-generated-eyebrow { color: #d6a128; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0; }
  .mwu-generated-hero-copy h1 { margin: 10px 0 14px; color: #ffffff; font-family: Georgia, "Times New Roman", serif; font-size: clamp(2rem, 4vw, 3.5rem); line-height: 1.08; }
  .mwu-generated-hero-copy p { max-width: 780px; margin: 0; color: #edf4ff; line-height: 1.7; }
  .mwu-generated-sections { padding: 28px 0 48px; display: grid; gap: 20px; }
  .mwu-generated-section-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(220px, 0.48fr); gap: 24px; align-items: center; }
  .mwu-generated-section-grid.image-first .mwu-generated-copy { order: 2; }
  .mwu-generated-section-grid.image-first .mwu-generated-media { order: 1; }
  .mwu-generated-copy h2 { margin: 8px 0 14px; font-family: Georgia, "Times New Roman", serif; font-size: clamp(1.6rem, 2vw, 2.4rem); line-height: 1.12; }
  .mwu-generated-copy p { margin: 0 0 14px; line-height: 1.7; }
  .mwu-generated-chip-list { display: flex; flex-wrap: wrap; gap: 10px; margin: 0; padding: 0; list-style: none; }
  .mwu-generated-chip-list li { padding: 10px 14px; border-radius: 999px; background: rgba(26, 75, 150, 0.08); color: #1a4b96; font-weight: 700; }
  .mwu-generated-button { display: inline-flex; align-items: center; justify-content: center; min-height: 42px; padding: 0 18px; border-radius: 8px; background: #1a4b96; color: #ffffff; font-weight: 800; text-decoration: none; }
  .mwu-generated-media img { width: 100%; object-fit: cover; box-shadow: 0 20px 45px rgba(8, 25, 51, 0.12); }
  @media (max-width: 820px) {
    .mwu-generated-section-grid { grid-template-columns: 1fr; }
    .mwu-generated-hero { padding: 56px 18px; }
    .mwu-generated-hero-copy,
    .mwu-generated-sections { width: min(100%, calc(100% - 20px)); }
  }
`;

const mergeBodyIntoHtml = (html = "", bodyHtml = "") => {
  const safeBody = bodyHtml || "";
  if (/<body[\s>]/i.test(html)) {
    return String(html).replace(/<body([^>]*)>[\s\S]*?<\/body>/i, `<body$1>${safeBody}</body>`);
  }

  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1" />\n<base href="/" />\n<link rel="stylesheet" href="/assets/css/bootstrap.min.css" />\n<link rel="stylesheet" href="/assets/css/main.css" />\n<link rel="stylesheet" href="/assets/css/style.css" />\n<style>${generatedEditableBaseCss}</style>\n</head>\n<body>${safeBody}</body>\n</html>`;
};

const ensureEditableDocumentShell = (html = "", page = {}) => {
  const rawHtml = String(html || "").trim();
  if (/<html[\s>]/i.test(rawHtml)) {
    return rawHtml;
  }

  const bodyHtml = rawHtml || page.bodyHtml || page.body_html || page.sections?.find((section) => section.html)?.html || "";
  return mergeBodyIntoHtml("", bodyHtml);
};

const buildEditableLiveDocument = (page = {}, sourceHtml = "") => {
  const customCss = page.customCss || page.custom_css || "";
  const routePath = getLiveRoutePath(page);
  let html = rewriteHtmlForLocalEditing(ensureEditableDocumentShell(sourceHtml || page.rawHtml || page.raw_html || page.bodyHtml || page.body_html, page));
  html = injectLocalSiteCssLinks(html);

  // For fetched SPA HTML, make the iframe think it is on the real page route before the live bundle runs.
  // This lets the existing React/Vite website render /robe-integrated-research-center instead of a blank root.
  const routeBootstrap = `<script id="mwu-route-bootstrap">try{history.replaceState(null, document.title || '', ${JSON.stringify(routePath)});}catch(e){}</script>`;

  // Use the local dev/admin origin as the base. All live assets are rewritten to /__live_asset or /assets proxies.
  if (/<base[\s>]/i.test(html)) {
    html = html.replace(/<base[^>]*>/i, '<base href="/" />');
  } else {
    html = /<head[^>]*>/i.test(html)
      ? html.replace(/<head[^>]*>/i, (match) => `${match}<base href="/" />`)
      : html.replace(/<html[^>]*>/i, (match) => `${match}<head><base href="/" /></head>`);
  }

  if (!/id=["']mwu-route-bootstrap["']/i.test(html)) {
    html = /<head[^>]*>/i.test(html)
      ? html.replace(/<head[^>]*>/i, (match) => `${match}${routeBootstrap}`)
      : `${routeBootstrap}${html}`;
  }

  if (!/id=["']mwu-google-fonts["']/i.test(html)) {
    const fontsLink = `<link id="mwu-google-fonts" rel="stylesheet" href="${googleFontsHref}" />`;
    html = /<head[^>]*>/i.test(html)
      ? html.replace(/<head[^>]*>/i, (match) => `${match}${fontsLink}`)
      : `${fontsLink}${html}`;
  }

  const editorCss = `
    <style id="mwu-visual-editor-css">
      html, body { min-height: 100%; }
      @font-face { font-family: 'Font Awesome 6 Pro'; src: url('${LIVE_ASSET_PROXY_PREFIX}/assets/fonts/fontawesome/fa-solid-900.woff2') format('woff2'); font-weight: 900; font-style: normal; font-display: block; }
      @font-face { font-family: 'Font Awesome 6 Brands'; src: url('${LIVE_ASSET_PROXY_PREFIX}/assets/fonts/fontawesome/fa-brands-400.woff2') format('woff2'); font-weight: 400; font-style: normal; font-display: block; }
      :root { --icon-font: 'Font Awesome 6 Pro'; --fa-style-family: 'Font Awesome 6 Pro'; --fa-font-solid: normal 900 1em/1 'Font Awesome 6 Pro'; --fa-font-brands: normal 400 1em/1 'Font Awesome 6 Brands'; }
      .fa, .fas, .fa-solid { font-family: 'Font Awesome 6 Pro' !important; font-weight: 900 !important; }
      .fab, .fa-brands { font-family: 'Font Awesome 6 Brands' !important; font-weight: 400 !important; }
      [class^='fa-']::before, [class*=' fa-']::before, .icon-btn::before, .th-icon::after { font-family: 'Font Awesome 6 Pro' !important; font-weight: 900 !important; }
      body.mwu-live-editing { cursor: text; }
      body.mwu-live-editing input, body.mwu-live-editing select, body.mwu-live-editing textarea { pointer-events: none !important; }
      body.mwu-live-editing img, body.mwu-live-editing [data-mwu-background-editable="true"] { cursor: pointer; pointer-events: auto !important; }
      body.mwu-live-editing [data-mwu-edit-skip="true"],
      body.mwu-live-editing [data-mwu-edit-skip="true"] *,
      body.mwu-live-editing .breadcumb-shape,
      body.mwu-live-editing .shape-mockup,
      body.mwu-live-editing .shape,
      body.mwu-live-editing .jump,
      body.mwu-live-editing .ripple-animation,
      body.mwu-live-editing .moving,
      body.mwu-live-editing .spin,
      body.mwu-live-editing .th-ani {
        cursor: default !important;
        pointer-events: none !important;
        outline: none !important;
        animation: none !important;
        transition: none !important;
        transform: none !important;
        opacity: 0 !important;
        visibility: hidden !important;
      }
      body.mwu-live-editing [data-overlay]::before,
      body.mwu-live-editing [data-overlay]::after,
      body.mwu-live-editing .breadcumb-wrapper::before,
      body.mwu-live-editing .breadcumb-wrapper::after,
      body.mwu-live-editing .breadcumb-banner::before,
      body.mwu-live-editing .breadcumb-banner::after,
      body.mwu-live-editing .overlay::before,
      body.mwu-live-editing .overlay::after {
        content: none !important;
        display: none !important;
        pointer-events: none !important;
      }
      body.mwu-live-editing *:hover { outline: 1px dashed rgba(26,75,150,.34); outline-offset: 2px; }
      body.mwu-live-editing .mwu-edit-selected { outline: 2px solid #1a4b96 !important; outline-offset: 3px !important; box-shadow: 0 0 0 4px rgba(26,75,150,.14) !important; }
      .mwu-editor-help { position: fixed; right: 18px; bottom: 18px; z-index: 2147483647; max-width: 330px; padding: 10px 12px; border-radius: 12px; background: rgba(8,25,51,.92); color: #fff; font: 700 12px/1.45 Arial, sans-serif; box-shadow: 0 16px 40px rgba(0,0,0,.2); pointer-events: auto !important; }
      .mwu-editor-help strong { display: block; color: #d6a128; margin-bottom: 2px; }
      .mwu-image-toolbar { position: fixed; z-index: 2147483647; display: none; width: min(360px, calc(100vw - 24px)); max-height: min(520px, calc(100vh - 24px)); overflow: auto; padding: 12px; border: 1px solid rgba(207,224,243,.96); border-radius: 14px; background: rgba(255,255,255,.98); color: #081933; font: 700 12px/1.35 Arial, sans-serif; box-shadow: 0 18px 48px rgba(8,25,51,.22); }
      .mwu-image-toolbar.open { display: grid; gap: 10px; }
      .mwu-image-toolbar, .mwu-image-toolbar * { box-sizing: border-box; pointer-events: auto !important; }
      body.mwu-live-editing .mwu-image-toolbar,
      body.mwu-live-editing .mwu-image-toolbar *,
      body.mwu-live-editing .mwu-image-toolbar button,
      body.mwu-live-editing .mwu-image-toolbar input,
      body.mwu-live-editing .mwu-image-toolbar select,
      body.mwu-live-editing .mwu-image-toolbar label { pointer-events: auto !important; user-select: auto !important; }
      .mwu-image-toolbar strong { display: block; color: #081933; font-size: 13px; }
      .mwu-image-toolbar small { display: block; color: #667085; font-weight: 700; }
      .mwu-image-toolbar label { display: grid; gap: 5px; color: #0f3674; }
      .mwu-image-toolbar .mwu-control-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .mwu-image-toolbar .mwu-control-value { min-width: 42px; padding: 2px 7px; border-radius: 999px; background: #edf5ff; color: #1a4b96; font-size: 11px; text-align: center; }
      .mwu-image-toolbar .mwu-range-wrap { display: grid; gap: 2px; }
      .mwu-image-toolbar .mwu-range-marks { display: grid; grid-template-columns: repeat(3, 1fr); color: #667085; font-size: 10px; font-weight: 800; }
      .mwu-image-toolbar .mwu-range-marks span:nth-child(2) { text-align: center; }
      .mwu-image-toolbar .mwu-range-marks span:nth-child(3) { text-align: right; }
      .mwu-image-toolbar input[type='range'], .mwu-image-toolbar select { width: 100%; }
      .mwu-image-toolbar button { min-height: 34px; border: 1px solid #cfe0f3; border-radius: 9px; padding: 7px 10px; background: #fff; color: #1a4b96; font-weight: 900; cursor: pointer; }
      .mwu-image-toolbar button.primary { color: #fff; background: #1a4b96; border-color: #1a4b96; }
      .mwu-image-toolbar .mwu-toolbar-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .mwu-image-toolbar .mwu-toolbar-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .mwu-image-toolbar .mwu-toolbar-close { position: absolute; right: 8px; top: 8px; min-height: 26px; width: 26px; padding: 0; border-radius: 50%; }
      [data-mwu-crop-frame="true"] { overflow: hidden; position: relative; }
      [data-mwu-crop-frame="true"] > img { display: block; min-width: 100%; min-height: 100%; }
      body.mwu-live-editing img.mwu-edit-selected { outline: 3px solid #1a4b96 !important; outline-offset: 4px !important; box-shadow: 0 0 0 6px rgba(26,75,150,.16) !important; }
      ${customCss}
    </style>`;

  const editorBridge = `
    <script id="mwu-visual-editor-bridge">
      (function () {
        var sendTimer = null;
        var activeImage = null;
        var imageToolbar = null;
        var imageClickTimer = null;
        var fileInput = null;
        var selectedElement = null;
        var selectedElementIdCounter = 1;
        var LIVE_ASSET_PROXY_PREFIX = ${JSON.stringify(LIVE_ASSET_PROXY_PREFIX)};
        var LIVE_SITE_ORIGIN = ${JSON.stringify(LIVE_SITE_ORIGIN)};

        function cleanEditorUi() {
          var selected = document.querySelectorAll('.mwu-edit-selected');
          for (var i = 0; i < selected.length; i += 1) selected[i].classList.remove('mwu-edit-selected');
        }

        function removeEditorUiFromClone(htmlClone) {
          var helperClone = htmlClone.querySelector('.mwu-editor-help');
          var toolbarClone = htmlClone.querySelector('.mwu-image-toolbar');
          var fileClone = htmlClone.querySelector('#mwu-image-file-input');
          var bridgeClone = htmlClone.querySelector('#mwu-visual-editor-bridge');
          var editorCssClone = htmlClone.querySelector('#mwu-visual-editor-css');
          var backgroundEditableClones = htmlClone.querySelectorAll('[data-mwu-background-editable]');
          for (var b = 0; b < backgroundEditableClones.length; b += 1) backgroundEditableClones[b].removeAttribute('data-mwu-background-editable');
          var skipClones = htmlClone.querySelectorAll('[data-mwu-edit-skip]');
          for (var k = 0; k < skipClones.length; k += 1) skipClones[k].removeAttribute('data-mwu-edit-skip');
          var editorDataClones = htmlClone.querySelectorAll('[data-mwu-editor-id], [data-mwu-fallback-applied], [data-mwu-local-fallback], [data-mwu-selected-kind], [data-mwu-error-listener]');
          for (var d = 0; d < editorDataClones.length; d += 1) {
            editorDataClones[d].removeAttribute('data-mwu-editor-id');
            editorDataClones[d].removeAttribute('data-mwu-fallback-applied');
            editorDataClones[d].removeAttribute('data-mwu-local-fallback');
            editorDataClones[d].removeAttribute('data-mwu-selected-kind');
            editorDataClones[d].removeAttribute('data-mwu-error-listener');
          }
          var selectedClones = htmlClone.querySelectorAll('.mwu-edit-selected');
          for (var s = 0; s < selectedClones.length; s += 1) selectedClones[s].classList.remove('mwu-edit-selected');
          if (helperClone) helperClone.remove();
          if (toolbarClone) toolbarClone.remove();
          if (fileClone) fileClone.remove();
          if (bridgeClone) bridgeClone.remove();
          if (editorCssClone) editorCssClone.remove();
        }

        function sendUpdate(reason) {
          clearTimeout(sendTimer);
          sendTimer = setTimeout(function () {
            var htmlClone = document.documentElement.cloneNode(true);
            removeEditorUiFromClone(htmlClone);
            var bodyClone = htmlClone.querySelector('body');
            if (bodyClone) {
              bodyClone.classList.remove('mwu-live-editing');
              bodyClone.removeAttribute('contenteditable');
              bodyClone.removeAttribute('spellcheck');
            }
            window.parent.postMessage({
              type: 'MWU_LIVE_HTML_UPDATED',
              reason: reason || 'input',
              title: document.title || '',
              bodyHtml: bodyClone ? bodyClone.innerHTML : '',
              fullHtml: '<!doctype html>\\n' + htmlClone.outerHTML
            }, '*');
          }, 350);
        }

        function getNumber(value, fallback) {
          var parsed = parseFloat(value);
          return Number.isFinite(parsed) ? parsed : fallback;
        }

        function getFilterValue(name, fallback) {
          if (!activeImage) return fallback;
          var stored = activeImage.getAttribute('data-mwu-' + name);
          return stored || fallback;
        }

        function applyImageFilter() {
          if (!activeImage) return;
          var brightness = Math.max(0, Math.min(200, 100 + getNumber(getFilterValue('brightness', '0'), 0)));
          var contrast = Math.max(0, Math.min(200, 100 + getNumber(getFilterValue('contrast', '0'), 0)));
          activeImage.style.filter = 'brightness(' + brightness + '%) contrast(' + contrast + '%)';
        }

        function isSkippableEditorAsset(value) {
          return !value || /^(data:|blob:|mailto:|tel:|#|javascript:)/i.test(String(value).trim());
        }

        function getCssUrl(value) {
          var match = String(value || '').match(/url\\((?:['"]?)(.*?)(?:['"]?)\\)/i);
          return match ? match[2] : '';
        }

        function getFallbackAssetUrl(value) {
          var rawValue = String(value || '').trim();
          if (isSkippableEditorAsset(rawValue)) return '';
          try {
            var url = new URL(rawValue, window.location.origin);
            if (url.pathname && url.pathname.indexOf('/assets/') === 0) {
              return LIVE_ASSET_PROXY_PREFIX + url.pathname + url.search + url.hash;
            }
            if (url.origin === LIVE_SITE_ORIGIN) {
              return LIVE_ASSET_PROXY_PREFIX + url.pathname + url.search + url.hash;
            }
          } catch (error) {
            if (/^\\/assets\\//i.test(rawValue)) return LIVE_ASSET_PROXY_PREFIX + rawValue;
          }
          return '';
        }

        function useFallbackImage(img) {
          if (!img || img.getAttribute('data-mwu-fallback-applied') === 'true') return;
          var fallbackUrl = getFallbackAssetUrl(img.getAttribute('src') || img.currentSrc || '');
          if (!fallbackUrl) return;
          img.setAttribute('data-mwu-fallback-applied', 'true');
          img.setAttribute('data-mwu-local-fallback', 'image');
          img.removeAttribute('srcset');
          img.removeAttribute('data-srcset');
          img.setAttribute('src', fallbackUrl);
        }

        function prepareImageFallbacks() {
          markSkippedEditorLayers();
          var images = document.querySelectorAll('img');
          for (var i = 0; i < images.length; i += 1) {
            (function (img) {
              if (isEditorSkippedLayer(img)) return;
              if (!img || img.closest('.mwu-image-toolbar') || img.closest('.mwu-editor-help')) return;
              if (img.getAttribute('data-mwu-error-listener') !== 'true') {
                img.setAttribute('data-mwu-error-listener', 'true');
                img.addEventListener('error', function () { useFallbackImage(img); }, { once: true });
              }
              if (img.complete && img.naturalWidth === 0) useFallbackImage(img);
            })(images[i]);
          }

          var elements = document.body ? document.body.querySelectorAll('*') : [];
          for (var b = 0; b < elements.length; b += 1) {
            prepareBackgroundFallback(elements[b]);
          }
        }

        function prepareBackgroundFallback(element) {
          if (!element || element.getAttribute('data-mwu-fallback-applied') === 'background') return;
          if (element.classList && (element.classList.contains('mwu-image-toolbar') || element.classList.contains('mwu-editor-help'))) return;
          var backgroundValue = getBackgroundImage(element);
          var rawUrl = getCssUrl(backgroundValue);
          var fallbackUrl = getFallbackAssetUrl(rawUrl);
          if (!fallbackUrl) return;
          var tester = new Image();
          tester.onerror = function () {
            element.style.backgroundImage = 'url("' + fallbackUrl + '")';
            element.style.backgroundRepeat = element.style.backgroundRepeat || 'no-repeat';
            element.style.backgroundPosition = element.style.backgroundPosition || 'center center';
            element.style.backgroundSize = element.style.backgroundSize || 'cover';
            element.setAttribute('data-mwu-fallback-applied', 'background');
            element.setAttribute('data-mwu-local-fallback', 'background');
            element.setAttribute('data-mwu-background-editable', 'true');
          };
          tester.src = rawUrl;
        }

        function isImageElement(element) {
          return element && element.tagName === 'IMG';
        }

        function getElementMarkerText(element) {
          if (!element || element.nodeType !== 1) return '';
          return [
            element.className && typeof element.className === 'string' ? element.className : '',
            element.id || '',
            element.getAttribute('data-animation') || '',
            element.getAttribute('data-ani') || '',
            element.getAttribute('data-overlay') || '',
            element.getAttribute('aria-hidden') || '',
            element.getAttribute('role') || '',
            element.getAttribute('alt') || ''
          ].join(' ');
        }

        function hasDecorativeLayerMarker(element) {
          return /(overlay|shape|shap|anim|motion|particle|pattern|decor|decoration|ornament|cursor|preloader|line-|icon-|icon_|mask|marquee|scroll)/i.test(getElementMarkerText(element));
        }

        function isEditorSkippedLayer(element) {
          if (!element || element.nodeType !== 1) return false;
          if (element.classList && (element.classList.contains('mwu-image-toolbar') || element.classList.contains('mwu-editor-help'))) return true;
          if (element.getAttribute('data-mwu-edit-skip') === 'true') return true;
          var computed = window.getComputedStyle(element);
          var rect = element.getBoundingClientRect();
          var area = Math.max(0, rect.width) * Math.max(0, rect.height);
          var marker = hasDecorativeLayerMarker(element);
          var hasMedia = isImageElement(element) || isBackgroundMediaElement(element);
          var hasMeaningfulText = (element.textContent || '').replace(/\\s+/g, ' ').trim().length > 16;
          var src = isImageElement(element) ? (element.getAttribute('src') || element.currentSrc || '') : getCssUrl(getBackgroundImage(element));
          var isAnimatedAsset = /\\.(gif|svg)(?:[?#].*)?$/i.test(src) || /animation/i.test(computed.animationName || '');
          var isLayered = /^(absolute|fixed|sticky)$/i.test(computed.position || '') || Number.parseInt(computed.zIndex || '0', 10) > 1;

          if (element.getAttribute('aria-hidden') === 'true' && hasMedia) return true;
          if (isAnimatedAsset && (marker || isLayered || area < 90000)) return true;
          if (marker && hasMedia) return true;
          if (marker && isLayered && !hasMeaningfulText) return true;
          if (hasMedia && isLayered && area > 0 && area < 3600) return true;
          return false;
        }

        function markSkippedEditorLayers() {
          if (!document.body) return;
          var elements = document.body.querySelectorAll('img, [style*="background"], [class*="overlay"], [class*="shape"], [class*="anim"], [class*="decor"], [data-overlay], [data-animation], [aria-hidden="true"]');
          for (var i = 0; i < elements.length; i += 1) {
            var element = elements[i];
            if (isEditorSkippedLayer(element)) {
              element.setAttribute('data-mwu-edit-skip', 'true');
              element.removeAttribute('data-mwu-background-editable');
            }
          }
        }

        function getBackgroundImage(element) {
          if (!element || element.nodeType !== 1) return '';
          var inlineValue = element.style && element.style.backgroundImage;
          var computedValue = '';
          try {
            computedValue = window.getComputedStyle(element).backgroundImage;
          } catch (error) {
            computedValue = '';
          }
          var value = inlineValue || computedValue || '';
          return /url\\(/i.test(value) ? value : '';
        }

        function isBackgroundMediaElement(element) {
          return Boolean(element && !isImageElement(element) && getBackgroundImage(element));
        }

        function getImageCropFrame(img) {
          if (!isImageElement(img)) return null;
          var parent = img.parentElement;
          if (!parent || parent === document.body || parent === document.documentElement) return null;
          if (parent.getAttribute('data-mwu-crop-frame') === 'true') return parent;
          var className = String(parent.className || '');
          var singleUsefulChild = parent.children && parent.children.length === 1;
          if (/(banner|image|img|photo|thumb|media|figure|box-img|global-img|breadcumb-banner)/i.test(className) || singleUsefulChild) {
            return parent;
          }
          return null;
        }

        function ensureImageCropFrame(img) {
          if (!isImageElement(img)) return null;
          var frame = getImageCropFrame(img);
          if (!frame) {
            frame = document.createElement('span');
            frame.setAttribute('data-mwu-crop-frame', 'true');
            frame.style.display = 'block';
            frame.style.maxWidth = img.style.maxWidth || '100%';
            img.parentNode.insertBefore(frame, img);
            frame.appendChild(img);
          }
          frame.setAttribute('data-mwu-crop-frame', 'true');
          frame.style.overflow = 'hidden';
          frame.style.position = frame.style.position || 'relative';
          return frame;
        }

        function getMediaStyleTarget(element, field) {
          if (!isImageElement(element)) return element;
          if (/^(width|height|maxWidth|margin|marginTop|marginRight|marginBottom|marginLeft|padding|paddingTop|paddingRight|paddingBottom|paddingLeft|borderWidth|borderTopWidth|borderRightWidth|borderBottomWidth|borderLeftWidth|borderStyle|borderColor|borderRadius|borderTopLeftRadius|borderTopRightRadius|borderBottomRightRadius|borderBottomLeftRadius|backgroundColor|zIndex|display|position|top|right|bottom|left|opacity)$/i.test(field)) {
            return ensureImageCropFrame(element) || element;
          }
          return element;
        }

        function markEditableBackgroundImages() {
          if (!document.body) return;
          markSkippedEditorLayers();
          var elements = document.body.querySelectorAll('*');
          for (var i = 0; i < elements.length; i += 1) {
            var element = elements[i];
            if (element.classList && (element.classList.contains('mwu-image-toolbar') || element.classList.contains('mwu-editor-help'))) continue;
            if (isEditorSkippedLayer(element)) {
              element.removeAttribute('data-mwu-background-editable');
              continue;
            }
            if (isBackgroundMediaElement(element)) {
              element.setAttribute('data-mwu-background-editable', 'true');
            }
          }
        }

        function getEditableMediaTarget(target) {
          var current = target && target.nodeType === 1 ? target : null;
          while (current && current !== document.body && current !== document.documentElement) {
            if (isEditorSkippedLayer(current)) {
              current = current.parentElement;
              continue;
            }
            if (isImageElement(current) || isBackgroundMediaElement(current)) {
              return current;
            }
            current = current.parentElement;
          }
          return null;
        }

        function getEditableMediaTargetFromPoint(event) {
          if (!event || !document.elementsFromPoint) return null;
          var stack = document.elementsFromPoint(event.clientX, event.clientY) || [];
          for (var i = 0; i < stack.length; i += 1) {
            var candidate = getEditableMediaTarget(stack[i]);
            if (candidate) return candidate;
          }
          return null;
        }

        function getSelectableElement(target, preferParent) {
          if (!target || target.nodeType !== 1) return null;
          if (target === document.body || target === document.documentElement) return null;
          if (target.closest && target.closest('.mwu-image-toolbar, .mwu-editor-help')) return null;
          var buttonTarget = target.closest && target.closest('a, button, .th-btn, .btn, [role="button"], input[type="button"], input[type="submit"]');

          if (!preferParent) {
            if (buttonTarget && buttonTarget !== document.body && buttonTarget !== document.documentElement) {
              return buttonTarget;
            }
            return target;
          }

          return (target.closest && target.closest('section, article, header, footer, main, aside, nav, .container, .row, [class*="col-"], div')) || target;
        }

        function getMediaPosition(element, fallback) {
          if (!element) return fallback || '50% 50%';
          var computed = window.getComputedStyle(element);
          return isImageElement(element)
            ? (element.style.objectPosition || computed.objectPosition || fallback || '50% 50%')
            : (element.style.backgroundPosition || computed.backgroundPosition || fallback || '50% 50%');
        }

        function getMediaFit(element, fallback) {
          if (!element) return fallback || 'cover';
          var computed = window.getComputedStyle(element);
          if (isImageElement(element)) {
            return element.style.objectFit || computed.objectFit || fallback || 'cover';
          }
          var size = element.style.backgroundSize || computed.backgroundSize || fallback || 'cover';
          return /contain/i.test(size) ? 'contain' : 'cover';
        }

        function setMediaFit(element, value) {
          if (!element) return;
          if (isImageElement(element)) {
            ensureImageCropFrame(element);
            element.style.display = 'block';
            element.style.width = '100%';
            element.style.height = '100%';
            element.style.objectFit = value;
          } else {
            element.style.backgroundSize = value;
            element.style.backgroundRepeat = 'no-repeat';
          }
        }

        function setMediaPosition(element, x, y) {
          if (!element) return;
          var mappedX = Math.max(0, Math.min(100, 50 + getNumber(x, 0) / 2));
          var mappedY = Math.max(0, Math.min(100, 50 + getNumber(y, 0) / 2));
          if (isImageElement(element)) {
            ensureImageCropFrame(element);
            element.style.objectPosition = mappedX + '% ' + mappedY + '%';
            element.style.objectFit = element.style.objectFit || 'cover';
            element.style.transformOrigin = mappedX + '% ' + mappedY + '%';
            element.style.width = '100%';
            element.style.height = '100%';
          } else {
            element.style.backgroundPosition = mappedX + '% ' + mappedY + '%';
            element.style.backgroundRepeat = 'no-repeat';
            element.style.backgroundSize = element.style.backgroundSize || 'cover';
          }
        }

        function setMediaSource(element, value) {
          if (!element || !value) return;
          if (isImageElement(element)) {
            element.setAttribute('src', value);
            element.setAttribute('data-mwu-admin-image-url', value);
            element.setAttribute('data-mwu-image-updated', 'true');
            element.removeAttribute('srcset');
            element.removeAttribute('data-src');
            element.removeAttribute('data-srcset');
            ensureImageCropFrame(element);
            element.style.display = 'block';
            element.style.width = element.style.width || '100%';
            element.style.height = element.style.height || '100%';
            element.style.maxWidth = element.style.maxWidth || '100%';
          } else {
            element.style.backgroundImage = 'url("' + value + '")';
            element.style.backgroundRepeat = 'no-repeat';
            element.style.backgroundPosition = element.style.backgroundPosition || '50% 50%';
            element.style.backgroundSize = element.style.backgroundSize || 'cover';
            element.setAttribute('data-mwu-background-editable', 'true');
            element.setAttribute('data-mwu-admin-image-url', value);
            element.setAttribute('data-mwu-image-updated', 'true');
          }
        }

        function ensureEditorElementId(element) {
          if (!element || element.nodeType !== 1) return '';
          var existing = element.getAttribute('data-mwu-editor-id');
          if (existing) return existing;
          var nextId = 'mwu-live-el-' + selectedElementIdCounter;
          selectedElementIdCounter += 1;
          element.setAttribute('data-mwu-editor-id', nextId);
          return nextId;
        }

        function getElementKind(element) {
          if (!element) return 'widget';
          var tag = String(element.tagName || '').toLowerCase();
          if (isImageElement(element) || isBackgroundMediaElement(element)) return 'image';
          if (tag === 'a' || tag === 'button' || (element.classList && (element.classList.contains('th-btn') || element.classList.contains('btn')))) return 'button';
          if (/^(section|header|footer|main|article|aside|nav)$/i.test(tag)) return 'section';
          if (/^(h1|h2|h3|h4|h5|h6|p|span|a|li|label|strong|em|small|blockquote)$/i.test(tag)) return 'text';
          return 'widget';
        }

        function getLinkElement(element) {
          if (!element || element.nodeType !== 1) return null;
          if (String(element.tagName || '').toLowerCase() === 'a') return element;
          return element.closest ? element.closest('a') : null;
        }

        function getElementUrl(element) {
          var link = getLinkElement(element);
          if (link) return link.getAttribute('href') || '#';
          return element.getAttribute('data-mwu-url') || element.getAttribute('formaction') || '#';
        }

        function applyElementUrl(element, value) {
          if (!element) return;
          var nextUrl = String(value || '').trim() || '#';
          var link = getLinkElement(element);
          if (link) {
            link.setAttribute('href', nextUrl);
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
            return;
          }

          if (String(element.tagName || '').toLowerCase() === 'button') {
            element.setAttribute('type', 'button');
            element.setAttribute('data-mwu-url', nextUrl);
            element.setAttribute('onclick', "window.open(this.getAttribute('data-mwu-url') || '#', '_blank', 'noopener,noreferrer'); return false;");
            return;
          }

          element.setAttribute('data-mwu-url', nextUrl);
          element.setAttribute('role', 'link');
          element.setAttribute('tabindex', '0');
          element.setAttribute('onclick', "window.open(this.getAttribute('data-mwu-url') || '#', '_blank', 'noopener,noreferrer'); return false;");
        }

        function getElementLabel(element) {
          if (!element) return 'No element';
          var tag = String(element.tagName || 'element').toLowerCase();
          var text = '';
          if (isImageElement(element)) text = element.getAttribute('alt') || element.getAttribute('title') || element.getAttribute('src') || '';
          else text = (element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent || '').replace(/\\s+/g, ' ').trim();
          if (text.length > 70) text = text.slice(0, 67) + '...';
          return text ? tag + ' — ' + text : tag;
        }

        function readElementInspector(element) {
          var computed = window.getComputedStyle(element);
          var imageFrame = isImageElement(element) ? getImageCropFrame(element) : null;
          var boxElement = imageFrame || element;
          var boxComputed = window.getComputedStyle(boxElement);
          var rect = boxElement.getBoundingClientRect();
          var kind = getElementKind(element);
          var backgroundValue = getBackgroundImage(element);
          return {
            id: ensureEditorElementId(element),
            tagName: String(element.tagName || '').toLowerCase(),
            type: kind,
            label: getElementLabel(element),
            src: isImageElement(element) ? (element.getAttribute('src') || '') : getCssUrl(backgroundValue),
            url: getElementUrl(element),
            styles: {
              fontFamily: element.style.fontFamily || computed.fontFamily || '',
              fontSize: element.style.fontSize || computed.fontSize || '',
              fontWeight: element.style.fontWeight || computed.fontWeight || '',
              color: element.style.color || computed.color || '',
              lineHeight: element.style.lineHeight || computed.lineHeight || '',
              textAlign: element.style.textAlign || computed.textAlign || '',
              width: boxElement.style.width || Math.round(rect.width) + 'px',
              height: boxElement.style.height || Math.round(rect.height) + 'px',
              maxWidth: boxElement.style.maxWidth || boxComputed.maxWidth || '',
              margin: boxElement.style.margin || boxComputed.margin || '',
              marginTop: boxElement.style.marginTop || boxComputed.marginTop || '',
              marginRight: boxElement.style.marginRight || boxComputed.marginRight || '',
              marginBottom: boxElement.style.marginBottom || boxComputed.marginBottom || '',
              marginLeft: boxElement.style.marginLeft || boxComputed.marginLeft || '',
              padding: boxElement.style.padding || boxComputed.padding || '',
              paddingTop: boxElement.style.paddingTop || boxComputed.paddingTop || '',
              paddingRight: boxElement.style.paddingRight || boxComputed.paddingRight || '',
              paddingBottom: boxElement.style.paddingBottom || boxComputed.paddingBottom || '',
              paddingLeft: boxElement.style.paddingLeft || boxComputed.paddingLeft || '',
              zIndex: boxElement.style.zIndex || boxComputed.zIndex || '',
              display: boxElement.style.display || boxComputed.display || '',
              position: boxElement.style.position || boxComputed.position || '',
              top: boxElement.style.top || boxComputed.top || '',
              right: boxElement.style.right || boxComputed.right || '',
              bottom: boxElement.style.bottom || boxComputed.bottom || '',
              left: boxElement.style.left || boxComputed.left || '',
              opacity: boxElement.style.opacity || boxComputed.opacity || '',
              borderWidth: boxElement.style.borderWidth || boxComputed.borderWidth || '',
              borderTopWidth: boxElement.style.borderTopWidth || boxComputed.borderTopWidth || '',
              borderRightWidth: boxElement.style.borderRightWidth || boxComputed.borderRightWidth || '',
              borderBottomWidth: boxElement.style.borderBottomWidth || boxComputed.borderBottomWidth || '',
              borderLeftWidth: boxElement.style.borderLeftWidth || boxComputed.borderLeftWidth || '',
              borderStyle: boxElement.style.borderStyle || boxComputed.borderStyle || '',
              borderColor: boxElement.style.borderColor || boxComputed.borderColor || '',
              borderRadius: boxElement.style.borderRadius || boxComputed.borderRadius || '',
              borderTopLeftRadius: boxElement.style.borderTopLeftRadius || boxComputed.borderTopLeftRadius || '',
              borderTopRightRadius: boxElement.style.borderTopRightRadius || boxComputed.borderTopRightRadius || '',
              borderBottomRightRadius: boxElement.style.borderBottomRightRadius || boxComputed.borderBottomRightRadius || '',
              borderBottomLeftRadius: boxElement.style.borderBottomLeftRadius || boxComputed.borderBottomLeftRadius || '',
              backgroundColor: boxElement.style.backgroundColor || boxComputed.backgroundColor || '',
              objectFit: getMediaFit(element, 'cover'),
              objectPosition: getMediaPosition(element, '50% 50%')
            }
          };
        }

        function notifyElementSelected(element) {
          if (!element || element === document.body || element === document.documentElement) return;
          selectedElement = element;
          ensureEditorElementId(element);
          element.setAttribute('data-mwu-selected-kind', getElementKind(element));
          window.parent.postMessage({
            type: 'MWU_ELEMENT_SELECTED',
            element: readElementInspector(element)
          }, '*');
        }

        function duplicateSelectedElement() {
          if (!selectedElement || selectedElement === document.body || selectedElement === document.documentElement) return;
          var clone = selectedElement.cloneNode(true);
          clone.classList.remove('mwu-edit-selected');
          clone.removeAttribute('data-mwu-editor-id');
          clone.removeAttribute('data-mwu-selected-kind');
          var clonedEditorNodes = clone.querySelectorAll('[data-mwu-editor-id], [data-mwu-selected-kind]');
          for (var i = 0; i < clonedEditorNodes.length; i += 1) {
            clonedEditorNodes[i].removeAttribute('data-mwu-editor-id');
            clonedEditorNodes[i].removeAttribute('data-mwu-selected-kind');
            clonedEditorNodes[i].classList.remove('mwu-edit-selected');
          }
          selectedElement.insertAdjacentElement('afterend', clone);
          cleanEditorUi();
          selectedElement = clone;
          clone.classList.add('mwu-edit-selected');
          notifyElementSelected(clone);
          sendUpdate('duplicate-live-element');
        }

        function deleteSelectedElement() {
          if (!selectedElement || selectedElement === document.body || selectedElement === document.documentElement) return;
          var removalTarget = selectedElement;
          var parent = selectedElement.parentElement;
          if (
            selectedElement.tagName &&
            selectedElement.tagName.toLowerCase() === 'img' &&
            parent &&
            parent.getAttribute('data-mwu-crop-frame') === 'true' &&
            parent.querySelectorAll('img').length === 1 &&
            parent.children.length === 1
          ) {
            removalTarget = parent;
          }

          var nextSelection = removalTarget.nextElementSibling || removalTarget.previousElementSibling || removalTarget.parentElement;
          if (!removalTarget.parentElement || removalTarget === document.body || removalTarget === document.documentElement) return;

          removalTarget.remove();
          cleanEditorUi();
          activeImage = null;
          selectedElement = null;
          hideImageToolbar();
          if (nextSelection && nextSelection !== document.body && nextSelection !== document.documentElement && document.contains(nextSelection)) {
            notifyElementSelected(nextSelection);
          } else {
            window.parent.postMessage({ type: 'MWU_ELEMENT_SELECTED', element: null }, '*');
          }
          sendUpdate('delete-live-element');
        }

        function normalizeStyleValue(field, value) {
          var rawValue = String(value == null ? '' : value).trim();
          if (rawValue === '') return '';
          if (/^(fontWeight|lineHeight|zIndex|opacity|objectFit|objectPosition|borderStyle|textAlign)$/i.test(field)) return rawValue;
          if (/^-?\\d+(\\.\\d+)?$/.test(rawValue) && /(?:width|height|size|radius|padding|margin|top|right|bottom|left)$/i.test(field)) {
            return rawValue + 'px';
          }
          return rawValue;
        }

        function applyInspectorStyle(element, field, value) {
          if (!element || !field) return;
          var safeValue = normalizeStyleValue(field, value);
          if (field === 'fontColor') field = 'color';
          if (field === 'imageWidth') field = 'width';
          if (field === 'imageHeight') field = 'height';
          if (field === 'objectFit') { setMediaFit(element, safeValue || 'cover'); return; }
          if (field === 'objectPosition') {
            if (isImageElement(element)) element.style.objectPosition = safeValue;
            else element.style.backgroundPosition = safeValue;
            return;
          }
          if (field === 'src') { setMediaSource(element, safeValue); return; }
          if (field === 'url') { applyElementUrl(element, safeValue || '#'); return; }
          var styleTarget = getMediaStyleTarget(element, field);
          var allowed = {
            fontFamily: true, fontSize: true, fontWeight: true, color: true, lineHeight: true, textAlign: true,
            width: true, height: true, maxWidth: true,
            margin: true, marginTop: true, marginRight: true, marginBottom: true, marginLeft: true,
            padding: true, paddingTop: true, paddingRight: true, paddingBottom: true, paddingLeft: true,
            zIndex: true,
            borderWidth: true, borderTopWidth: true, borderRightWidth: true, borderBottomWidth: true, borderLeftWidth: true,
            borderStyle: true, borderColor: true,
            borderRadius: true, borderTopLeftRadius: true, borderTopRightRadius: true, borderBottomRightRadius: true, borderBottomLeftRadius: true,
            backgroundColor: true,
            display: true, position: true, top: true, right: true, bottom: true, left: true, opacity: true
          };
          if (allowed[field]) {
            styleTarget.style[field] = safeValue;
            if (isImageElement(element) && styleTarget !== element) {
              if (field === 'height') {
                element.style.height = '100%';
                element.style.width = '100%';
                element.style.objectFit = element.style.objectFit || 'cover';
              }
              if (field === 'width') {
                element.style.width = '100%';
                element.style.maxWidth = '100%';
              }
            }
          }
        }

        window.addEventListener('message', function (event) {
          var data = event.data || {};
          if (data.type === 'MWU_DUPLICATE_SELECTED_ELEMENT') {
            duplicateSelectedElement();
            return;
          }

          if (data.type === 'MWU_DELETE_SELECTED_ELEMENT') {
            deleteSelectedElement();
            return;
          }

          if (data.type === 'MWU_REPLACE_IMAGE_SOURCE') {
            var imageElement = null;
            if (data.elementId) {
              var imageCandidates = document.querySelectorAll('[data-mwu-editor-id]');
              for (var ic = 0; ic < imageCandidates.length; ic += 1) {
                if (imageCandidates[ic].getAttribute('data-mwu-editor-id') === String(data.elementId)) {
                  imageElement = imageCandidates[ic];
                  break;
                }
              }
            }
            imageElement = imageElement || selectedElement || activeImage;
            if (!imageElement || !data.src) return;
            activeImage = imageElement;
            selectedElement = imageElement;
            setMediaSource(imageElement, data.src);
            showImageToolbar(imageElement);
            notifyElementSelected(imageElement);
            sendUpdate('image-file-replace');
            return;
          }

          if (data.type !== 'MWU_APPLY_ELEMENT_STYLE') return;
          var element = null;
          if (data.elementId) {
            var candidates = document.querySelectorAll('[data-mwu-editor-id]');
            for (var c = 0; c < candidates.length; c += 1) {
              if (candidates[c].getAttribute('data-mwu-editor-id') === String(data.elementId)) {
                element = candidates[c];
                break;
              }
            }
          }
          element = element || selectedElement;
          if (!element) return;
          selectedElement = element;
          if (data.styles && typeof data.styles === 'object') {
            Object.keys(data.styles).forEach(function (field) { applyInspectorStyle(element, field, data.styles[field]); });
          } else {
            applyInspectorStyle(element, data.field, data.value);
          }
          cleanEditorUi();
          element.classList.add('mwu-edit-selected');
          notifyElementSelected(element);
          sendUpdate('elementor-sidebar-style');
        });

        function setToolbarValues(img) {
          if (!imageToolbar || !img) return;
          var computed = window.getComputedStyle(img);
          var frame = isImageElement(img) ? ensureImageCropFrame(img) : img;
          var frameComputed = window.getComputedStyle(frame);
          var naturalHeight = isImageElement(img) ? (frame.offsetHeight || img.naturalHeight || img.offsetHeight || 320) : (img.offsetHeight || 320);
          var currentHeight = parseFloat(frame.style.height || frameComputed.height || naturalHeight) || naturalHeight;
          var fit = getMediaFit(img, 'cover');
          var position = getMediaPosition(img, '50% 50%').match(/([0-9.]+)%?\\s+([0-9.]+)%?/);
          var scaleMatch = (img.style.transform || '').match(/scale\\(([^)]+)\\)/);
          var backgroundSizeMatch = !isImageElement(img) ? String(img.style.backgroundSize || computed.backgroundSize || '').match(/^([0-9.]+)%/) : null;
          imageToolbar.querySelector('[data-img-control="fit"]').value = fit === 'contain' ? 'contain' : 'cover';
          imageToolbar.querySelector('[data-img-control="height"]').value = Math.max(80, Math.min(900, Math.round(currentHeight)));
          imageToolbar.querySelector('[data-img-control="posX"]').value = position ? Math.round((getNumber(position[1], 50) - 50) * 2) : 0;
          imageToolbar.querySelector('[data-img-control="posY"]').value = position ? Math.round((getNumber(position[2], 50) - 50) * 2) : 0;
          imageToolbar.querySelector('[data-img-control="zoom"]').value = scaleMatch ? Math.round((getNumber(scaleMatch[1], 1) - 1) * 100) : backgroundSizeMatch ? Math.round(getNumber(backgroundSizeMatch[1], 100) - 100) : 0;
          imageToolbar.querySelector('[data-img-control="radius"]').value = parseInt(img.style.borderRadius || computed.borderRadius || '0', 10) || 0;
          imageToolbar.querySelector('[data-img-control="brightness"]').value = getFilterValue('brightness', '0');
          imageToolbar.querySelector('[data-img-control="contrast"]').value = getFilterValue('contrast', '0');
          updateToolbarValueBadges();
        }

        function updateToolbarValueBadges() {
          if (!imageToolbar) return;
          var controls = imageToolbar.querySelectorAll('[data-img-control]');
          for (var i = 0; i < controls.length; i += 1) {
            var control = controls[i];
            var name = control.getAttribute('data-img-control');
            var badge = imageToolbar.querySelector('[data-img-value="' + name + '"]');
            if (!badge) continue;
            var suffix = name === 'height' || name === 'radius' ? 'px' : '';
            badge.textContent = (control.value || '0') + suffix;
          }
        }

        function rangeControl(label, control, min, max, value, marks, suffix) {
          return '<label><span class="mwu-control-head"><span>' + label + '</span><span class="mwu-control-value" data-img-value="' + control + '">' + value + (suffix || '') + '</span></span><span class="mwu-range-wrap"><input type="range" min="' + min + '" max="' + max + '" value="' + value + '" data-img-control="' + control + '" /><span class="mwu-range-marks"><span>' + marks[0] + '</span><span>' + marks[1] + '</span><span>' + marks[2] + '</span></span></span></label>';
        }

        function createImageToolbar() {
          if (imageToolbar) return imageToolbar;
          imageToolbar = document.createElement('div');
          imageToolbar.className = 'mwu-image-toolbar';
          imageToolbar.setAttribute('contenteditable', 'false');
          imageToolbar.innerHTML = '' +
            '<button type="button" class="mwu-toolbar-close" data-img-action="close">×</button>' +
            '<strong>Image crop & adjustment</strong>' +
            '<small>Single-click an image to adjust it. Double-click any image to replace it from Media Library.</small>' +
            '<div class="mwu-toolbar-actions"><button type="button" class="primary" data-img-action="replace">Replace Image</button><button type="button" data-img-action="reset">Reset</button></div>' +
            '<div class="mwu-toolbar-row"><label><span class="mwu-control-head"><span>Crop mode</span></span><select data-img-control="fit"><option value="cover">Crop / Cover</option><option value="contain">Fit / Contain</option></select></label>' + rangeControl('Height', 'height', 80, 900, 320, ['80', '490', '900'], 'px') + '</div>' +
            '<div class="mwu-toolbar-row">' + rangeControl('Position X', 'posX', -100, 100, 0, ['-100', '0', '100'], '') + rangeControl('Position Y', 'posY', -100, 100, 0, ['-100', '0', '100'], '') + '</div>' +
            '<div class="mwu-toolbar-row">' + rangeControl('Zoom', 'zoom', -100, 100, 0, ['-100', '0', '100'], '') + rangeControl('Radius', 'radius', -100, 100, 0, ['-100', '0', '100'], 'px') + '</div>' +
            '<div class="mwu-toolbar-row">' + rangeControl('Brightness', 'brightness', -100, 100, 0, ['-100', '0', '100'], '') + rangeControl('Contrast', 'contrast', -100, 100, 0, ['-100', '0', '100'], '') + '</div>';
          document.body.appendChild(imageToolbar);
          ['pointerdown', 'mousedown', 'mouseup', 'touchstart', 'touchend'].forEach(function (eventName) {
            imageToolbar.addEventListener(eventName, function (event) {
              event.stopPropagation();
            }, true);
          });
          imageToolbar.addEventListener('click', function (event) {
            event.stopPropagation();
            var action = event.target && event.target.getAttribute('data-img-action');
            if (action === 'close') hideImageToolbar();
            if (action === 'replace') openImageFilePicker(activeImage);
            if (action === 'reset' && activeImage) {
              activeImage.style.objectFit = '';
              activeImage.style.objectPosition = '';
              activeImage.style.backgroundSize = '';
              activeImage.style.backgroundPosition = '';
              activeImage.style.backgroundRepeat = '';
              var resetFrame = isImageElement(activeImage) ? (getImageCropFrame(activeImage) || ensureImageCropFrame(activeImage)) : activeImage;
              resetFrame.style.height = '';
              resetFrame.style.width = '';
              resetFrame.style.maxWidth = '';
              resetFrame.style.overflow = '';
              resetFrame.style.borderRadius = '';
              activeImage.style.maxWidth = '';
              activeImage.style.height = '';
              activeImage.style.width = '';
              activeImage.style.transform = '';
              activeImage.style.transformOrigin = '';
              activeImage.style.borderRadius = '';
              activeImage.style.filter = '';
              activeImage.removeAttribute('data-mwu-brightness');
              activeImage.removeAttribute('data-mwu-contrast');
              setToolbarValues(activeImage);
              notifyElementSelected(activeImage);
              sendUpdate('image-reset');
            }
          }, true);
          var handleToolbarControlChange = function (event) {
            if (!activeImage) return;
            var control = event.target && event.target.getAttribute('data-img-control');
            if (!control) return;
            event.preventDefault();
            event.stopPropagation();
            var value = event.target.value;
            updateToolbarValueBadges();
            if (control === 'fit') setMediaFit(activeImage, value);
            if (control === 'height') {
              var heightFrame = isImageElement(activeImage) ? ensureImageCropFrame(activeImage) : activeImage;
              heightFrame.style.height = value + 'px';
              heightFrame.style.overflow = 'hidden';
              if (isImageElement(activeImage)) {
                activeImage.style.display = 'block';
                activeImage.style.width = '100%';
                activeImage.style.height = '100%';
                activeImage.style.maxWidth = '100%';
                activeImage.style.objectFit = activeImage.style.objectFit || 'cover';
              } else {
                activeImage.style.backgroundSize = activeImage.style.backgroundSize || 'cover';
                activeImage.style.backgroundRepeat = 'no-repeat';
              }
            }
            if (control === 'posX' || control === 'posY') {
              var x = imageToolbar.querySelector('[data-img-control="posX"]').value || '50';
              var y = imageToolbar.querySelector('[data-img-control="posY"]').value || '50';
              setMediaPosition(activeImage, x, y);
            }
            if (control === 'zoom') {
              var zoomPercent = Math.max(10, 100 + getNumber(value, 0));
              if (isImageElement(activeImage)) {
                ensureImageCropFrame(activeImage);
                var zoomX = imageToolbar.querySelector('[data-img-control="posX"]').value || '0';
                var zoomY = imageToolbar.querySelector('[data-img-control="posY"]').value || '0';
                activeImage.style.transform = 'scale(' + (zoomPercent / 100) + ')';
                activeImage.style.transformOrigin = (50 + getNumber(zoomX, 0) / 2) + '% ' + (50 + getNumber(zoomY, 0) / 2) + '%';
              } else {
                activeImage.style.backgroundSize = zoomPercent + '% auto';
                activeImage.style.backgroundRepeat = 'no-repeat';
              }
            }
            if (control === 'radius') {
              var radiusTarget = isImageElement(activeImage) ? ensureImageCropFrame(activeImage) : activeImage;
              radiusTarget.style.borderRadius = Math.max(0, getNumber(value, 0)) + 'px';
              radiusTarget.style.overflow = 'hidden';
            }
            if (control === 'brightness') {
              activeImage.setAttribute('data-mwu-brightness', value);
              applyImageFilter();
            }
            if (control === 'contrast') {
              activeImage.setAttribute('data-mwu-contrast', value);
              applyImageFilter();
            }
            notifyElementSelected(activeImage);
            sendUpdate('image-adjust');
          };
          imageToolbar.addEventListener('input', handleToolbarControlChange, true);
          imageToolbar.addEventListener('change', handleToolbarControlChange, true);
          return imageToolbar;
        }

        function hideImageToolbar() {
          if (imageToolbar) imageToolbar.classList.remove('open');
          activeImage = null;
          cleanEditorUi();
        }

        function showImageToolbar(img) {
          if (!img || isEditorSkippedLayer(img)) return;
          activeImage = img;
          cleanEditorUi();
          img.classList.add('mwu-edit-selected');
          notifyElementSelected(img);
          createImageToolbar();
          setToolbarValues(img);
          imageToolbar.classList.add('open');
          var rect = img.getBoundingClientRect();
          var left = Math.max(12, Math.min(rect.left + 12, window.innerWidth - imageToolbar.offsetWidth - 12));
          var top = Math.max(12, Math.min(rect.top + 12, window.innerHeight - imageToolbar.offsetHeight - 12));
          imageToolbar.style.left = left + 'px';
          imageToolbar.style.top = top + 'px';
        }

        function openImageFilePicker(img) {
          if (!img) return;
          activeImage = img;
          ensureEditorElementId(img);
          window.parent.postMessage({
            type: 'MWU_REQUEST_IMAGE_PICKER',
            elementId: img.getAttribute('data-mwu-editor-id')
          }, '*');
        }

        function bootEditor() {
          if (!document.body) return;
          document.body.classList.add('mwu-live-editing');
          document.body.setAttribute('contenteditable', 'true');
          document.body.setAttribute('spellcheck', 'true');
          markEditableBackgroundImages();
          prepareImageFallbacks();
          var helper = document.createElement('div');
          helper.className = 'mwu-editor-help';
          helper.setAttribute('contenteditable', 'false');
          helper.innerHTML = '<strong>Editable live page</strong>Click a child element to edit it. Shift-click to select its parent section/container. Single-click images for crop/adjustments. Double-click images to replace them from Media Library.';
          document.body.appendChild(helper);
          document.addEventListener('input', function () { sendUpdate('input'); }, true);
          document.addEventListener('click', function (event) {
            var target = event.target;
            if (!target || target === helper || helper.contains(target)) return;
            if (imageToolbar && (target === imageToolbar || imageToolbar.contains(target))) return;
            var mediaTarget = getEditableMediaTarget(target) || getEditableMediaTargetFromPoint(event);
            if (mediaTarget) {
              event.preventDefault();
              event.stopPropagation();
              clearTimeout(imageClickTimer);
              imageClickTimer = setTimeout(function () { showImageToolbar(mediaTarget); }, 180);
              return;
            }
            if (target.closest && target.closest('a, button, .th-btn, .btn, [role="button"], input[type="button"], input[type="submit"]')) {
              event.preventDefault();
              event.stopPropagation();
            }
            hideImageToolbar();
            cleanEditorUi();
            var selectableTarget = getSelectableElement(target, event.shiftKey);
            if (selectableTarget && selectableTarget.classList) {
              selectableTarget.classList.add('mwu-edit-selected');
              notifyElementSelected(selectableTarget);
            }
          }, true);
          document.addEventListener('dblclick', function (event) {
            var target = event.target;
            if (!target || target === helper || helper.contains(target)) return;
            if (imageToolbar && (target === imageToolbar || imageToolbar.contains(target))) return;
            var mediaTarget = getEditableMediaTarget(target) || getEditableMediaTargetFromPoint(event);
            if (mediaTarget) {
              event.preventDefault();
              event.stopPropagation();
              clearTimeout(imageClickTimer);
              showImageToolbar(mediaTarget);
              openImageFilePicker(mediaTarget);
            }
          }, true);
          window.setTimeout(function () { markEditableBackgroundImages(); prepareImageFallbacks(); }, 500);
          window.setTimeout(function () { markEditableBackgroundImages(); prepareImageFallbacks(); }, 1500);
          window.addEventListener('resize', function () { markEditableBackgroundImages(); prepareImageFallbacks(); if (activeImage) showImageToolbar(activeImage); });
          window.addEventListener('scroll', function () { if (activeImage) showImageToolbar(activeImage); }, true);
          if (window.MutationObserver) {
            var observer = new MutationObserver(function () { markEditableBackgroundImages(); prepareImageFallbacks(); });
            observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'style', 'class'] });
          }
          window.parent.postMessage({ type: 'MWU_LIVE_HTML_READY' }, '*');
        }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootEditor);
        else bootEditor();
      })();
    </script>`;

  if (/<\/head>/i.test(html)) {
    html = html.replace(/<\/head>/i, `${editorCss}</head>`);
  } else {
    html = html.replace(/<html[^>]*>/i, (match) => `${match}<head>${editorCss}</head>`);
  }

  if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, `${editorBridge}</body>`);
  } else {
    html += editorBridge;
  }

  return html;
};

const LEGACY_ROUTE_ALIASES = {
  "": "index",
  "home": "index",
  "index": "index",
  "about": "about",
  "about-us": "about",
  "about-mwu": "about",
  "program": "program",
  "programs": "program",
  "academic-programs": "program",
  "graduate-programs": "programs-graduate",
  "phd-programs": "programs-phd",
  "undergraduate-programs": "programs-undergraduate",
  "admission": "admission",
  "admissions": "admission",
  "contact": "contact",
  "contact-us": "contact",
  "event": "event",
  "events": "event",
  "blog": "blog",
  "blogs": "blog",
  "news": "blog",
  "research": "research",
  "research-centers": "research",
  "research-center": "research",
  "campus": "campus",
  "campuses": "campus"
};

const toLegacyHtmlPath = (candidate = "") => {
  const clean = String(candidate || "index")
    .trim()
    .replace(/^\/+/, "")
    .replace(/^legacy\//i, "")
    .replace(/\/$/, "")
    .replace(/\.html$/i, "") || "index";
  return `/legacy/${clean}.html`;
};

const getLegacyRouteCandidates = (routePath = "", page = {}) => {
  const explicitUrl = String(page?.sourceUrl || page?.source_url || page?.url || "").trim();
  const explicitPath = explicitUrl && !/^https?:\/\//i.test(explicitUrl)
    ? explicitUrl
    : (() => {
        try {
          return explicitUrl ? new URL(explicitUrl).pathname : "";
        } catch {
          return "";
        }
      })();
  const sourcePath = explicitPath || routePath || "";
  const normalizedPath = String(sourcePath || "").split("?")[0].replace(/^\/+/, "").replace(/\/$/, "");
  const fileName = normalizedPath.split("/").filter(Boolean).pop() || "";
  const slug = String(page?.slug || "").trim().replace(/^\/+/, "").replace(/\/$/, "");
  const routeSlug = normalizedPath.replace(/^legacy\//i, "").replace(/\.html$/i, "");
  const isAcademicProgram = String(page?.type || page?.page_type || "").toLowerCase().includes("program");
  const programPrefix = /^phd(?:-|\s)/i.test(slug)
    ? "program-phd-"
    : /^(?:ma|msc|mba|specialty)(?:-|\s)/i.test(slug)
      ? "program-pg-"
      : "program-ug-";
  const candidates = [
    LEGACY_ROUTE_ALIASES[slug],
    LEGACY_ROUTE_ALIASES[routeSlug],
    LEGACY_ROUTE_ALIASES[fileName.replace(/\.html$/i, "")],
    isAcademicProgram && slug ? `${programPrefix}${slug}` : "",
    fileName,
    routeSlug,
    slug
  ].filter(Boolean);

  return Array.from(new Set(candidates.map(toLegacyHtmlPath)));
};

const getLiveFetchPath = (page = {}) => `/__live_page${getLiveRoutePath(page)}`;

const getLegacyRoutePath = (page = {}) => {
  const routePath = getLiveRoutePath(page).split("?")[0].replace(/\/$/, "");
  if (!routePath || routePath === "/") {
    return "/legacy/index.html";
  }
  if (/^\/legacy\//i.test(routePath)) {
    return routePath;
  }
  return getLegacyRouteCandidates(routePath, page)[0] || "/legacy/index.html";
};

const getLegacyFetchPath = (page = {}) => getLegacyRoutePath(page);
const getLegacyFetchPaths = (page = {}) => {
  const routePath = getLiveRoutePath(page).split("?")[0].replace(/\/$/, "");
  if (!routePath || routePath === "/") {
    return ["/legacy/index.html"];
  }
  if (/^\/legacy\//i.test(routePath)) {
    return [routePath];
  }
  return getLegacyRouteCandidates(routePath, page);
};

const getEditableFetchCandidates = (page = {}) =>
  // Editable mode needs a real HTML document, not the Vite/React SPA shell.
  // Use the static legacy HTML first; if the live route is server-rendered, it can be used as a fallback.
  Array.from(new Set([...getLegacyFetchPaths(page), getLiveFetchPath(page)].filter(Boolean)));

const getCanonicalEditableSourceUrl = (page = {}) => getLegacyFetchPaths(page)[0] || getLiveRoutePath(page) || "/";

const normalizePageForEditableImport = (page = {}) => {
  const normalized = normalizePage(page);
  const hasSavedHtml = hasPersistedEditableMarkup(normalized);
  const hasUsableSnapshot = hasUsableHtmlBuilderSnapshot(normalized);
  return normalizePage({
    ...normalized,
    sourceUrl: getCanonicalEditableSourceUrl(normalized),
    source_url: getCanonicalEditableSourceUrl(normalized),
    visualBuilder: hasUsableSnapshot ? normalized.visualBuilder || normalized.visual_builder : null,
    visual_builder: hasUsableSnapshot ? normalized.visual_builder || normalized.visualBuilder : null,
    rawHtml: hasSavedHtml ? normalized.rawHtml || normalized.raw_html : "",
    raw_html: hasSavedHtml ? normalized.raw_html || normalized.rawHtml : "",
    bodyHtml: hasSavedHtml ? normalized.bodyHtml || normalized.body_html : "",
    body_html: hasSavedHtml ? normalized.body_html || normalized.bodyHtml : "",
    sections: hasSavedHtml || hasUsableSnapshot ? normalized.sections : []
  });
};

const buildPreviewDocument = (page = {}) => {
  const storedDocument = getStoredEditableDocument(page);
  const fullHtml = storedDocument.fullHtml || page.rawHtml || page.raw_html || "";
  if (fullHtml && /<html[\s>]/i.test(fullHtml)) {
    const customCss = page.customCss || page.custom_css || "";
    const safeFullHtml = rewriteHtmlForLocalEditing(fullHtml);
    const withBase = /<base[\s>]/i.test(safeFullHtml)
      ? safeFullHtml
      : safeFullHtml.replace(/<head[^>]*>/i, (match) => `${match}<base href="/" />`);
    return customCss
      ? withBase.replace(/<\/head>/i, `<style>${customCss}</style></head>`)
      : withBase;
  }

  const bodyHtml = storedDocument.bodyHtml || page.bodyHtml || page.body_html || "";
  const styles = getPageStyles(page);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${page.title || "Preview"}</title>
<base href="${LIVE_ASSET_PROXY_PREFIX}/" />
<link rel="stylesheet" href="${LIVE_ASSET_PROXY_PREFIX}/assets/css/bootstrap.min.css" />
<link rel="stylesheet" href="${LIVE_ASSET_PROXY_PREFIX}/assets/css/main.css" />
<link rel="stylesheet" href="${LIVE_ASSET_PROXY_PREFIX}/assets/css/style.css" />
<style>
  body { margin: 0; background: ${styles.backgroundColor}; font-family: ${styles.fontFamily}; }
  img { max-width: 100%; height: auto; }
  a { pointer-events: none; }
  ${page.customCss || page.custom_css || ""}
</style>
</head>
<body>${stripDangerousHtml(bodyHtml)}</body>
</html>`;
};

const buildSiteChromePreviewDocument = (kind = "header", snippetHtml = "") => {
  const config = getSiteChromeConfig(kind);
  const trimmedHtml = String(snippetHtml || "").trim();
  const previewBody =
    kind === "header"
      ? `
        ${trimmedHtml}
        <main class="mwu-snippet-preview-main">
          <section>
            <span>Preview Content</span>
            <h1>Header preview context</h1>
            <p>This canvas shows how the saved global header sits above website content.</p>
          </section>
        </main>
      `
      : `
        <main class="mwu-snippet-preview-main">
          <section>
            <span>Preview Content</span>
            <h1>Footer preview context</h1>
            <p>This canvas shows how the saved global footer sits below website content.</p>
          </section>
        </main>
        ${trimmedHtml}
      `;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${config.title}</title>
<base href="${LIVE_SITE_ORIGIN}/" />
<link rel="stylesheet" href="${LIVE_SITE_ORIGIN}/assets/css/bootstrap.min.css" />
<link rel="stylesheet" href="${LIVE_SITE_ORIGIN}/assets/css/style.css" />
<style>
  body {
    margin: 0;
    background: #f4f8fb;
    color: #18212f;
    font-family: Inter, Segoe UI, Arial, sans-serif;
  }
  .mwu-snippet-preview-main {
    padding: 56px 24px 80px;
  }
  .mwu-snippet-preview-main section {
    max-width: 1180px;
    margin: 0 auto;
    padding: 32px;
    border: 1px solid #d9e2dc;
    border-radius: 8px;
    background: #ffffff;
    box-shadow: 0 18px 40px rgba(8, 25, 51, 0.06);
  }
  .mwu-snippet-preview-main span {
    color: #d6a128;
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
  }
  .mwu-snippet-preview-main h1 {
    margin: 8px 0 12px;
    color: #081933;
    font-size: 34px;
  }
  .mwu-snippet-preview-main p {
    margin: 0;
    color: #667085;
    line-height: 1.7;
  }
</style>
</head>
<body>${trimmedHtml ? stripDangerousHtml(previewBody) : `<main class="mwu-snippet-preview-main"><section><span>${config.title}</span><h1>No markup saved yet</h1><p>Paste or edit the HTML in the CRM, then save to create the global ${kind} content.</p></section></main>`}
<script>
  document.addEventListener("click", function (event) {
    var category = event.target.closest(".mwu-mega-category-link");
    if (!category) return;
    event.preventDefault();
    var menu = category.closest(".mwu-mega-programs");
    if (!menu) return;
    var target = category.getAttribute("data-target");
    menu.querySelectorAll(".mwu-mega-category-link").forEach(function (item) {
      item.classList.toggle("active", item === category);
      item.setAttribute("aria-selected", item === category ? "true" : "false");
    });
    menu.querySelectorAll(".mwu-mega-panel").forEach(function (panel) {
      panel.classList.toggle("active", panel.getAttribute("data-panel") === target);
    });
  });
</script>
</body>
</html>`;
};

const formatHtmlPreview = (html = "") => {
  const safeHtml = rewriteHtmlForLocalEditing(stripDangerousHtml(html));
  if (!safeHtml.trim()) {
    return "<div class=\"legacy-empty\">No legacy HTML stored for this block yet.</div>";
  }
  return safeHtml;
};

const formatDate = (value) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric"
  }).format(new Date(value));

const sectionTemplates = {
  "Hero Banner": {
    title: "Hero Banner",
    eyebrow: "Madda Walabu University",
    body: "Lead visitors into the page with a clear headline, proof points, and one primary action.",
    image: assets.hero,
    ctaLabel: "Apply Now",
    ctaUrl: "/admission-apply",
    layout: "Full width"
  },
  "Feature Cards": {
    title: "Academic Excellence",
    eyebrow: "Core Services",
    body: "Networked learning | Integrated research | Community service | Quality academics",
    image: assets.about,
    ctaLabel: "Learn More",
    ctaUrl: "/about",
    layout: "Three columns"
  },
  "Text Block": {
    title: "Section Title",
    eyebrow: "Overview",
    body: "Write focused website copy for this section.",
    image: assets.about,
    ctaLabel: "Read More",
    ctaUrl: "/",
    layout: "Text first"
  },
  "Program Grid": {
    title: "Relevant Programs",
    eyebrow: "Academic Programs",
    body: "Crop and livestock management | Clinical and public health sciences | Sustainable tourism and heritage",
    image: assets.agriculture,
    ctaLabel: "Explore Programs",
    ctaUrl: "/programs",
    layout: "Card grid"
  },
  "Image Gallery": {
    title: "Campus Life",
    eyebrow: "Gallery",
    body: "Mentor lecture | Group study | Art and culture",
    image: assets.campus,
    ctaLabel: "View Gallery",
    ctaUrl: "/campus",
    layout: "Masonry"
  },
  FAQ: {
    title: "Frequently Asked Questions",
    eyebrow: "FAQ",
    body: "What is Madda Walabu University known for? | Where is MWU located? | How many programs are offered?",
    image: assets.stories,
    ctaLabel: "Contact Admissions",
    ctaUrl: "/contact",
    layout: "Accordion"
  },
  "CTA Banner": {
    title: "Join Madda Walabu University",
    eyebrow: "Admissions and Partnerships",
    body: "Apply to MWU or partner with the university on education, research, and community transformation.",
    image: assets.blog,
    ctaLabel: "Apply Now",
    ctaUrl: "/admission-apply",
    layout: "Banner"
  },
  "Stats Strip": {
    title: "University Numbers",
    eyebrow: "At a Glance",
    body: "4 Departments | 11 Colleges and Schools | 3 Campuses | 653 Ranked Students",
    image: assets.hero,
    ctaLabel: "View Profile",
    ctaUrl: "/about",
    layout: "Horizontal metrics"
  },
  Testimonials: {
    title: "What People Say About MWU",
    eyebrow: "Community Voices",
    body: "Student, staff, and community testimonials managed as repeatable content cards.",
    image: assets.stories,
    ctaLabel: "Read Stories",
    ctaUrl: "/students",
    layout: "Carousel"
  },
  "Events List": {
    title: "University Events",
    eyebrow: "Latest Events",
    body: "Graduation ceremonies, conferences, workshops, and campus programs.",
    image: assets.blog,
    ctaLabel: "View Events",
    ctaUrl: "/event",
    layout: "Timeline"
  },
  "Raw HTML": {
    title: "Legacy HTML Section",
    eyebrow: "Imported Layout",
    body: "This block keeps the original HTML so the page can be previewed closer to the live website.",
    html: "<section class=\"legacy-section\"><div class=\"container\"><h2>Legacy HTML Section</h2><p>Edit this HTML from the Elementor-style sidebar.</p></div></section>",
    image: assets.hero,
    ctaLabel: "",
    ctaUrl: "",
    layout: "Legacy HTML"
  }
};

const createSection = (type = "Text Block") => {
  const template = sectionTemplates[type] || sectionTemplates["Text Block"];

  return {
    id: makeId(),
    type,
    title: template.title,
    eyebrow: template.eyebrow,
    body: template.body,
    html: template.html || "",
    image: template.image,
    ctaLabel: template.ctaLabel,
    ctaUrl: template.ctaUrl,
    layout: template.layout,
    className: "",
    styles: { ...defaultSectionStyles },
    visible: true
  };
};

const makeRevision = (page, label = "Saved version") => ({
  id: makeId(),
  label,
  savedAt: todayIso(),
  status: page.status,
  title: page.title,
  snapshot: {
    title: page.title,
    slug: page.slug,
    type: page.type,
    menu: page.menu,
    status: page.status,
    heroHeadline: page.heroHeadline,
    heroTag: page.heroTag,
    summary: page.summary,
    heroImage: page.heroImage,
    ctaLabel: page.ctaLabel,
    ctaUrl: page.ctaUrl,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    sourceUrl: page.sourceUrl,
    rawHtml: page.rawHtml,
    bodyHtml: page.bodyHtml,
    customCss: page.customCss,
    styles: page.styles,
    owner: page.owner,
    priority: page.priority,
    scheduledAt: page.scheduledAt,
    template: page.template,
    visibility: page.visibility,
    parentSlug: page.parentSlug,
    menuOrder: page.menuOrder,
    sections: page.sections
  }
});

const normalizeSection = (section) => {
  const html = section?.html || section?.rawHtml || section?.raw_html || "";
  const normalizedSection = {
    ...section,
    type: section?.type || section?.section_type || section?.sectionType || (html ? "Raw HTML" : "Text Block"),
    title: section?.title || section?.heading || section?.name || "Section Title",
    eyebrow: section?.eyebrow || section?.subtitle || "",
    body: section?.body || section?.content || "",
    html,
    image: section?.image || section?.image_url || section?.imageUrl || "",
    layout: section?.layout || (html ? "Legacy HTML" : "Text first"),
    ctaLabel: section?.ctaLabel || section?.cta_label || "",
    ctaUrl: section?.ctaUrl || section?.cta_url || "",
    className: section?.className || section?.class_name || "",
    styles: {
      ...defaultSectionStyles,
      ...(section?.styles || section?.style || {})
    },
    visible: section?.visible !== false && section?.visible !== 0
  };
  const base = createSection(normalizedSection.type);

  return {
    ...base,
    ...normalizedSection,
    id: section?.id || makeId(),
    visible: normalizedSection.visible
  };
};

const titleCaseStatus = (status = "Draft") => {
  const value = String(status || "Draft").toLowerCase();
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const normalizePage = (page) => {
  const pageTitle = page?.title || page?.page_title || page?.name || "Untitled Page";
  const pageType = normalizeIncomingPageType(page?.type || page?.page_type || page?.pageType || "Static Page");
  const rawMenuGroup = page?.menu ?? page?.menu_group ?? page?.menuGroup ?? "";
  const menuGroup = rawMenuGroup == null ? "" : String(rawMenuGroup).trim();
  const explicitSections =
    Array.isArray(page?.sections) ? page.sections
      : Array.isArray(page?.page_sections) ? page.page_sections
        : Array.isArray(page?.pageSections) ? page.pageSections
          : null;

  return {
    ...emptyPage(),
    ...page,
    id: page?.id || page?.page_id || makeId(),
    title: pageTitle,
    slug: slugify(page?.slug || pageTitle),
    type: pageType,
    menu: menuGroup,
    status: titleCaseStatus(page?.status),
    template: page?.template || page?.page_template || page?.pageTemplate || "Standard Page",
    visibility: page?.visibility || "Public",
    parentSlug: page?.parentSlug || page?.parent_slug || page?.parent || "",
    menuOrder: Number.isFinite(Number(page?.menuOrder ?? page?.menu_order)) ? Number(page?.menuOrder ?? page?.menu_order) : 1,
    showInHeader: Number(page?.showInHeader ?? page?.show_in_header ?? (menuGroup ? 1 : 0)) ? 1 : 0,
    showInFooter: Number(page?.showInFooter ?? page?.show_in_footer ?? 1) ? 1 : 0,
    heroHeadline: page?.heroHeadline || page?.hero_headline || pageTitle,
    heroTag: page?.heroTag || page?.hero_tag || "Website Page",
    summary: page?.summary || page?.excerpt || page?.seo_description || "Website page imported from the live database.",
    heroImage: page?.heroImage || page?.hero_image || assets.hero,
    ctaLabel: page?.ctaLabel || page?.cta_label || "Learn More",
    ctaUrl: page?.ctaUrl || page?.cta_url || `/${page?.slug || slugify(pageTitle)}`,
    seoTitle: page?.seoTitle || page?.seo_title || pageTitle,
    seoDescription: page?.seoDescription || page?.seo_description || page?.summary || "",
    sourceUrl: page?.sourceUrl || page?.source_url || page?.url || "",
    builderKind: page?.builderKind || page?.builder_kind || "",
    visualBuilder: page?.visualBuilder || page?.visual_builder || null,
    rawHtml: page?.rawHtml || page?.raw_html || "",
    bodyHtml: page?.bodyHtml || page?.body_html || "",
    customCss: page?.customCss || page?.custom_css || "",
    styles: { ...defaultPageStyles, ...(page?.styles || page?.pageStyles || {}) },
    updatedAt: page?.updatedAt || page?.updated_at || todayIso(),
    createdAt: page?.createdAt || page?.created_at || page?.updatedAt || page?.updated_at || todayIso(),
    updatedBy: page?.updatedBy || page?.updated_by || "Content Editor",
    revisions: Array.isArray(page?.revisions) ? page.revisions : [],
    sections: explicitSections
      ? explicitSections.map(normalizeSection)
      : page?.bodyHtml || page?.body_html || page?.rawHtml || page?.raw_html
        ? [normalizeSection({ type: "Raw HTML", title: pageTitle, html: page?.bodyHtml || page?.body_html || page?.rawHtml || page?.raw_html, layout: "Legacy HTML" })]
        : [createSection()]
  };
};

const getAutoThumbnailForPage = (page = {}) => {
  return getGeneratedThumbnailForPage(page);
};

const getPageBodyHtmlForSave = (page = {}) =>
  page.bodyHtml ||
  page.body_html ||
  extractBodyHtml(page.rawHtml || page.raw_html || "") ||
  "";

const hasHtmlBackedPageMarkup = (page = {}) =>
  Boolean(
    String(getPageBodyHtmlForSave(page) || "").trim() ||
    String(page.rawHtml || page.raw_html || "").trim()
  );

const hasEmbeddedImageData = (html = "") =>
  /(?:src|href)=["']data:image\/|url\(\s*["']?data:image\//i.test(String(html || ""));

const toApiPagePayload = (page) => {
  const bodyHtml = getPageBodyHtmlForSave(page);
  const isHtmlBacked = hasHtmlBackedPageMarkup(page);

  return {
    title: page.title,
    slug: page.slug,
    type: page.type,
    page_type: isSiteChromePage(page) ? "static" : getApiPageType(page.type),
    menu: page.menu,
    menu_group: page.menu,
    status: page.status,
    template: page.template,
    visibility: page.visibility,
    parent_slug: page.parentSlug,
    menu_order: page.menuOrder,
    sort_order: page.menuOrder,
    show_in_header: page.showInHeader ?? (page.menu ? 1 : 0),
    show_in_footer: page.showInFooter ?? 1,
    hero_headline: page.heroHeadline,
    hero_tag: page.heroTag,
    summary: page.summary,
    hero_image: page.heroImage,
    cta_label: page.ctaLabel,
    cta_url: page.ctaUrl,
    seo_title: page.seoTitle,
    seo_description: page.seoDescription,
    source_url: page.sourceUrl,
    builder_kind: page.builderKind || page.builder_kind || "",
    visual_builder: page.visualBuilder || page.visual_builder || null,
    raw_html: page.rawHtml || page.raw_html || "",
    body_html: bodyHtml,
    custom_css: page.customCss,
    styles: page.styles || defaultPageStyles,
    owner: page.owner,
    priority: page.priority,
    scheduled_at: page.scheduledAt || null,
    sections: isHtmlBacked
      ? []
      : (page.sections || []).map((section, index) => ({
          id: section.id,
          sort_order: index + 1,
          type: section.type,
          section_type: section.type,
          title: section.title,
          eyebrow: section.eyebrow,
          body: section.body,
          html: section.html || "",
          image: section.image,
          cta_label: section.ctaLabel,
          cta_url: section.ctaUrl,
          layout: section.layout,
          class_name: section.className || "",
          styles: section.styles || defaultSectionStyles,
          visible: section.visible !== false
        }))
  };
};

const readOptionalJson = async (response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const uniqueValues = (values) =>
  Array.from(
    new Set(
      values
        .filter((value) => value !== undefined && value !== null && String(value).trim() !== "")
        .map((value) => String(value).trim())
    )
  );

const getPageApiIdentifiers = (page = {}) =>
  uniqueValues([page.id, page.page_id, page.pageId, page.slug]);

const isLocalDraftPage = (page = {}) =>
  Boolean(page.isLocalDraft || page._isLocalDraft || page.localOnly);

const withPageApiIdentifiers = (page = {}, payload = {}) => ({
  ...payload,
  id: page.id,
  page_id: page.page_id || page.pageId || page.id,
  slug: page.slug
});

const withPageDeleteIdentifiers = (page = {}) => ({
  id: page.id,
  page_id: page.page_id || page.pageId || page.id,
  pageId: page.pageId || page.page_id || page.id,
  slug: page.slug
});

const withoutLocalPageMarkers = (page = {}) => {
  const { isLocalDraft, _isLocalDraft, localOnly, ...cleanPage } = page;
  return cleanPage;
};

const shouldTryNextMutationRoute = (status) => [400, 404, 405, 409, 415, 422].includes(Number(status));

const createPage = ({
  title,
  type,
  menu,
  status,
  heroHeadline,
  summary,
  heroImage,
  sections,
  owner,
  priority,
  template = "Standard Page",
  menuOrder = 1
}) => ({
  id: makeId(),
  title,
  slug: slugify(title),
  type,
  menu,
  status,
  template,
  visibility: "Public",
  parentSlug: "",
  menuOrder,
  heroHeadline,
  heroTag: "Admissions are open",
  summary,
  heroImage,
  ctaLabel: "Apply Now",
  ctaUrl: "/admission-apply",
  seoTitle: `${title} | Madda Walabu University`,
  seoDescription: summary,
  owner,
  priority,
  updatedAt: todayIso(),
  createdAt: todayIso(),
  updatedBy: "Content Editor",
  scheduledAt: "",
  revisions: [],
  sections: sections.map(normalizeSection)
});

const initialPages = [
  createPage({
    title: "Cultivating Innovation in Ethiopia's Breadbasket",
    type: "Home Section",
    menu: "Home",
    status: "Published",
    heroHeadline: "Cultivating Innovation in Ethiopia's Breadbasket.",
    summary:
      "Located in Ethiopia's agricultural heartland, MWU advances practical research, sustainable farming, and food security for communities.",
    heroImage: assets.hero,
    owner: "Content Office",
    priority: "High",
    template: "Home Landing",
    menuOrder: 1,
    sections: [
      {
        id: makeId(),
        type: "Feature Cards",
        title: "Academic Excellence",
        body: "A homepage section for learning, research, community service, and quality academics."
      },
      {
        id: makeId(),
        type: "Program Grid",
        title: "Relevant Programs",
        body: "Crop and livestock management, clinical sciences, and tourism programs linked to regional priorities."
      }
    ]
  }),
  createPage({
    title: "Crop and Livestock Management",
    type: "Academic Program",
    menu: "Programs",
    status: "Published",
    heroHeadline: "Crop and Livestock Management",
    summary:
      "A practical academic program focused on sustainable production systems, field research, and rural development.",
    heroImage: assets.agriculture,
    owner: "College of Agriculture",
    priority: "Medium",
    template: "Program Detail",
    menuOrder: 2,
    sections: [
      {
        id: makeId(),
        type: "Text Block",
        title: "Program Overview",
        body: "Students learn integrated crop science, animal production, and applied community extension."
      }
    ]
  }),
  createPage({
    title: "Madda Walabu University Celebrates Graduation Ceremony",
    type: "News Article",
    menu: "Blogs",
    status: "Review",
    heroHeadline: "Madda Walabu University Celebrates Its 18th Graduation Ceremony",
    summary:
      "Graduation news coverage with ceremony highlights, leadership remarks, and university community updates.",
    heroImage: assets.blog,
    owner: "Public Relations",
    priority: "High",
    template: "News Article",
    menuOrder: 3,
    sections: [
      {
        id: makeId(),
        type: "Image Gallery",
        title: "Event Gallery",
        body: "Gallery block for ceremony images, captions, and related news links."
      }
    ]
  }),
  createPage({
    title: "Admission Requirements",
    type: "Admission Page",
    menu: "Admissions",
    status: "Scheduled",
    heroHeadline: "Admission Requirements",
    summary:
      "Admission criteria, documents, and program pathways for undergraduate and postgraduate applicants.",
    heroImage: assets.about,
    owner: "Admissions Office",
    priority: "High",
    template: "Admission Guide",
    menuOrder: 4,
    sections: [
      {
        id: makeId(),
        type: "FAQ",
        title: "Common Questions",
        body: "Document requirements, transfer admission, international applicant guidance, and deadlines."
      }
    ]
  }),
  createPage({
    title: "About Madda Walabu University",
    type: "Campus Page",
    menu: "About Us",
    status: "Published",
    heroHeadline: "A Leading Public University Advancing Ethiopian Education and Innovation",
    summary:
      "A public university profile page covering MWU's mission, leadership, academic excellence, research agenda, community service, and campus identity.",
    heroImage: assets.about,
    owner: "Content Office",
    priority: "High",
    template: "Standard Page",
    menuOrder: 2,
    sections: [createSection("Text Block"), createSection("Stats Strip"), createSection("Image Gallery")]
  }),
  createPage({
    title: "Admissions Overview",
    type: "Admission Page",
    menu: "Admissions",
    status: "Published",
    heroHeadline: "Start Your Journey at Madda Walabu University",
    summary:
      "Admissions overview for prospective undergraduate, postgraduate, continuing education, and international applicants.",
    heroImage: assets.about,
    owner: "Admissions Office",
    priority: "High",
    template: "Admission Guide",
    menuOrder: 1,
    sections: [createSection("Hero Banner"), createSection("Feature Cards"), createSection("FAQ")]
  }),
  createPage({
    title: "Programs for Local and Global Competence",
    type: "Academic Program",
    menu: "Programs",
    status: "Published",
    heroHeadline: "Relevant Programs for Local and Global Competence",
    summary:
      "A program listing page for MWU academic offerings across agriculture, health sciences, tourism, engineering, education, and research fields.",
    heroImage: assets.health,
    owner: "Academic Affairs",
    priority: "High",
    template: "Program Detail",
    menuOrder: 1,
    sections: [createSection("Program Grid"), createSection("Stats Strip"), createSection("CTA Banner")]
  }),
  createPage({
    title: "Campus Life",
    type: "Campus Page",
    menu: "About Us",
    status: "Review",
    heroHeadline: "Campus Life at MWU",
    summary:
      "A campus-life page for lectures, student stories, art and culture, clubs, campus services, and student community updates.",
    heroImage: assets.campus,
    owner: "Student Affairs",
    priority: "Medium",
    template: "Standard Page",
    menuOrder: 5,
    sections: [createSection("Image Gallery"), createSection("Testimonials"), createSection("CTA Banner")]
  }),
  createPage({
    title: "University Events",
    type: "Event",
    menu: "Events",
    status: "Published",
    heroHeadline: "University Events",
    summary:
      "Events listing and detail management for graduation ceremonies, research conferences, workshops, public lectures, and academic gatherings.",
    heroImage: assets.blog,
    owner: "Public Relations",
    priority: "Medium",
    template: "Event Detail",
    menuOrder: 1,
    sections: [createSection("Events List"), createSection("Image Gallery"), createSection("CTA Banner")]
  }),
  createPage({
    title: "Research, Innovation, and Community Impact",
    type: "Research Page",
    menu: "Blogs",
    status: "Published",
    heroHeadline: "MWU Research, Innovation, and Community Impact",
    summary:
      "Research and community impact page for grants, innovation stories, centers of excellence, field work, and university partnerships.",
    heroImage: assets.blog,
    owner: "Research Office",
    priority: "High",
    template: "Research Profile",
    menuOrder: 2,
    sections: [createSection("Text Block"), createSection("Program Grid"), createSection("CTA Banner")]
  }),
  createPage({
    title: "Frequently Asked Questions",
    type: "Admission Page",
    menu: "Admissions",
    status: "Published",
    heroHeadline: "Frequently Asked Questions",
    summary:
      "FAQ page for admissions, programs, campuses, scholarships, research centers, international students, and visitor enquiries.",
    heroImage: assets.stories,
    owner: "Admissions Office",
    priority: "Medium",
    template: "Admission Guide",
    menuOrder: 6,
    sections: [createSection("FAQ"), createSection("CTA Banner")]
  }),
  createPage({
    title: "Contact Madda Walabu University",
    type: "Campus Page",
    menu: "Contact Us",
    status: "Draft",
    heroHeadline: "Contact Madda Walabu University",
    summary:
      "Contact page for admissions enquiries, research partnerships, campus information, media requests, and community engagement.",
    heroImage: assets.hero,
    owner: "Content Office",
    priority: "Medium",
    template: "Standard Page",
    menuOrder: 1,
    sections: [createSection("Text Block"), createSection("Feature Cards"), createSection("CTA Banner")]
  })
];

const emptyPage = () => ({
  id: makeId(),
  title: "Untitled Page",
  slug: "untitled-page",
  type: "Static Page",
  menu: "",
  status: "Draft",
  template: "Standard Page",
  visibility: "Public",
  parentSlug: "",
  menuOrder: 1,
  heroHeadline: "New MWU Website Page",
  heroTag: "New page",
  summary: "Write a concise page summary for visitors and search engines.",
  heroImage: assets.hero,
  ctaLabel: "Learn More",
  ctaUrl: "/",
  seoTitle: "New MWU Website Page | Madda Walabu University",
  seoDescription: "Write a search summary for this page.",
  sourceUrl: "",
  builderKind: "",
  visualBuilder: null,
  rawHtml: "",
  bodyHtml: "",
  customCss: "",
  styles: { ...defaultPageStyles },
  owner: "Content Office",
  priority: "Medium",
  updatedAt: todayIso(),
  createdAt: todayIso(),
  updatedBy: "Content Editor",
  scheduledAt: "",
  revisions: [],
  sections: [createSection("Hero Banner"), createSection("Text Block"), createSection("CTA Banner")]
});

const createBlankLocalDraftPage = (overrides = {}) => ({
  ...emptyPage(),
  title: "Untitled Page",
  slug: "untitled-page",
  heroHeadline: "",
  heroTag: "",
  summary: "",
  heroImage: "",
  ctaLabel: "",
  ctaUrl: "",
  seoTitle: "",
  seoDescription: "",
  rawHtml: "",
  bodyHtml: "",
  customCss: "",
  visualBuilder: null,
  sections: [],
  isLocalDraft: true,
  localOnly: true,
  ...overrides
});

const getSiteChromeConfig = (kind = "header") => SITE_CHROME_CONFIGS[kind] || SITE_CHROME_CONFIGS.header;

const isSiteChromePage = (page = {}) =>
  Object.keys(SITE_CHROME_CONFIGS).some((kind) => isMatchingSiteChromePage(page, kind));

const normalizeComparablePath = (value = "") => String(value || "").trim().replace(/^https?:\/\/[^/]+/i, "");

const isTruthySiteChromeFlag = (value) => value === true || value === 1 || String(value || "").toLowerCase() === "true";

const isMatchingSiteChromePage = (page = {}, kind = "header") => {
  const config = getSiteChromeConfig(kind);
  const slug = String(page?.slug || "").trim();
  const title = String(page?.title || page?.page_title || page?.name || "").trim().toLowerCase();
  const type = normalizeIncomingPageType(page?.type || page?.page_type || page?.pageType || "").toLowerCase();
  const sourceUrl = normalizeComparablePath(page?.sourceUrl || page?.source_url || page?.url || "");
  const configSourceUrl = normalizeComparablePath(config.sourceUrl);

  return (
    slug === config.slug ||
    type === String(config.type || "").toLowerCase() ||
    title === String(config.title || "").toLowerCase() ||
    title === String(config.slug || "").replace(/-/g, " ").toLowerCase() ||
    sourceUrl === configSourceUrl
  );
};

const getSiteChromePageRank = (page = {}, kind = "header") => {
  const config = getSiteChromeConfig(kind);
  const slug = String(page?.slug || "").trim();
  const type = normalizeIncomingPageType(page?.type || page?.page_type || page?.pageType || "");
  const title = String(page?.title || page?.page_title || page?.name || "").trim();
  const sourceUrl = normalizeComparablePath(page?.sourceUrl || page?.source_url || page?.url || "");
  const configSourceUrl = normalizeComparablePath(config.sourceUrl);

  let score = 0;
  if (slug === config.slug) score += 100;
  if (type === config.type) score += 60;
  if (title.toLowerCase() === config.title.toLowerCase()) score += 30;
  if (sourceUrl === configSourceUrl) score += 15;
  if (isTruthySiteChromeFlag(page?.active) || isTruthySiteChromeFlag(page?.is_active) || isTruthySiteChromeFlag(page?.isActive)) {
    score += 120;
  }
  if (String(page?.status || "").toLowerCase() === "published") {
    score += 20;
  }
  return score;
};

const findSiteChromePage = (pages = [], kind = "header") =>
  [...pages]
    .filter((page) => isMatchingSiteChromePage(page, kind))
    .sort((a, b) => {
      const rankDiff = getSiteChromePageRank(b, kind) - getSiteChromePageRank(a, kind);
      if (rankDiff !== 0) return rankDiff;
      return new Date(b?.updatedAt || b?.updated_at || 0) - new Date(a?.updatedAt || a?.updated_at || 0);
    })[0] || null;

const getSiteChromePageKind = (page = {}) => {
  const match = Object.keys(SITE_CHROME_CONFIGS).find((kind) => isMatchingSiteChromePage(page, kind));
  return match?.[0] || "";
};

const looksLikeSiteChromeMarkup = (value = "") =>
  /<(?:header|footer|nav|div|section|aside|ul|style)\b/i.test(String(value || ""));

const getSiteChromeApiRecord = (payload = {}) => {
  if (!payload || Array.isArray(payload)) return {};
  if (payload.page && typeof payload.page === "object") return payload.page;
  if (payload.data?.page && typeof payload.data.page === "object") return payload.data.page;
  if (payload.data && !Array.isArray(payload.data) && typeof payload.data === "object") return payload.data;
  return payload;
};

const normalizeSiteChromeApiPage = (payload = {}, fallbackPage = {}) => {
  const record = getSiteChromeApiRecord(payload);
  const sections =
    payload?.sections ||
    payload?.data?.sections ||
    record?.sections ||
    record?.page_sections ||
    fallbackPage?.sections ||
    [];
  const apiMarkup = [
    record?.bodyHtml,
    record?.body_html,
    record?.rawHtml,
    record?.raw_html,
    record?.html,
    record?.markup,
    record?.content,
    payload?.html,
    payload?.markup,
    payload?.content
  ].find(looksLikeSiteChromeMarkup);

  return normalizePage({
    ...fallbackPage,
    ...record,
    bodyHtml: apiMarkup || record?.bodyHtml || record?.body_html || fallbackPage?.bodyHtml || "",
    rawHtml: apiMarkup ? "" : record?.rawHtml || record?.raw_html || fallbackPage?.rawHtml || "",
    sections
  });
};

const getSiteChromeHtml = (page = {}) => {
  const section = page?.sections?.find((item) =>
    [item?.html, item?.rawHtml, item?.raw_html, item?.body, item?.content].some(looksLikeSiteChromeMarkup)
  );
  const candidates = [
    page?.bodyHtml,
    page?.body_html,
    page?.rawHtml,
    page?.raw_html,
    section?.html,
    section?.rawHtml,
    section?.raw_html,
    section?.body,
    section?.content
  ];

  return candidates.find(looksLikeSiteChromeMarkup) || "";
};

const hasMeaningfulSiteChromeHtml = (page = {}) => Boolean(String(getSiteChromeHtml(page) || "").trim());

const getAbsoluteLiveAssetUrl = (path = "") => {
  const raw = String(path || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  try {
    return new URL(raw.startsWith("/") ? raw : `/${raw}`, LIVE_SITE_ORIGIN).toString();
  } catch {
    return `${LIVE_SITE_ORIGIN}/${raw.replace(/^\/+/, "")}`;
  }
};

const getFetchableLiveAssetUrl = (path = "") => {
  const raw = String(path || "").trim();
  if (!raw) return "";

  const liveOrigin = (() => {
    try {
      return new URL(LIVE_SITE_ORIGIN).origin;
    } catch {
      return LIVE_SITE_ORIGIN.replace(/\/$/, "");
    }
  })();

  try {
    const absoluteUrl = /^https?:\/\//i.test(raw)
      ? new URL(raw)
      : new URL(raw.startsWith("/") ? raw : `/${raw}`, liveOrigin);

    if (absoluteUrl.origin !== liveOrigin) {
      return absoluteUrl.toString();
    }

    const relativePath = `${absoluteUrl.pathname}${absoluteUrl.search}${absoluteUrl.hash}`;
    if (typeof window !== "undefined" && window.location?.origin && window.location.origin !== liveOrigin) {
      return `${LIVE_ASSET_PROXY_PREFIX}${relativePath}`;
    }
    return relativePath;
  } catch {
    return getAbsoluteLiveAssetUrl(raw);
  }
};

const normalizeNavigationHrefToSlug = (href = "") => {
  const value = String(href || "").trim();
  if (!value || value === "#") return "";

  let pathname = value;
  if (/^https?:\/\//i.test(value)) {
    try {
      pathname = new URL(value).pathname || "";
    } catch {
      return "";
    }
  }

  pathname = pathname.split("?")[0].split("#")[0].trim();
  if (!pathname) return "";
  if (pathname === "/") return "home";

  const fileName = pathname.split("/").filter(Boolean).pop() || "";
  const normalized = fileName.replace(/\.html$/i, "");
  if (!normalized) return "";
  if (normalized === "index" || normalized === "home-university") return "home";
  return slugify(normalized);
};

const parseStaticHeaderNavigation = (html = "") => {
  if (typeof DOMParser === "undefined" || !String(html || "").trim()) {
    return [];
  }

  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const root = doc.querySelector(".main-menu > ul");
    if (!root) return [];

    return Array.from(root.children)
      .map((item, index) => {
        const directLink = Array.from(item.children).find((child) => child.tagName?.toLowerCase() === "a");
        if (!directLink) return null;
        const subMenu = Array.from(item.children).find((child) => child.tagName?.toLowerCase() === "ul");
        const children = subMenu
          ? Array.from(subMenu.children)
              .map((child, childIndex) => {
                const childLink = child.querySelector("a");
                if (!childLink) return null;
                return {
                  id: `static-header-child-${index}-${childIndex}`,
                  title: String(childLink.textContent || "").trim(),
                  slug: normalizeNavigationHrefToSlug(childLink.getAttribute("href") || ""),
                  custom_url: childLink.getAttribute("href") || "",
                  sort_order: childIndex + 1,
                  parent_id: `static-header-parent-${index}`
                };
              })
              .filter(Boolean)
          : [];

        return {
          id: `static-header-parent-${index}`,
          title: String(directLink.textContent || "").trim(),
          slug: normalizeNavigationHrefToSlug(directLink.getAttribute("href") || ""),
          custom_url: directLink.getAttribute("href") || "",
          sort_order: index + 1,
          parent_id: null,
          children
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
};

const getNavigationPageType = (title = "", parentTitle = "") => {
  const value = `${title} ${parentTitle}`.toLowerCase();
  if (value.includes("program")) return "Academic Program";
  if (value.includes("admission")) return "Admission Page";
  if (value.includes("event")) return "Event";
  if (value.includes("blog") || value.includes("news") || value.includes("research")) return "News Article";
  if (value.includes("contact") || value.includes("about") || value.includes("campus")) return "Campus Page";
  if (value.includes("home")) return "Home Section";
  return "Static Page";
};

const createPageFromNavigationItem = (item = {}, options = {}) => {
  const title = String(item?.title || item?.page_title || "Imported Page").trim() || "Imported Page";
  const slug = slugify(item?.slug || normalizeNavigationHrefToSlug(item?.custom_url || item?.href || "") || title);
  const parentTitle = String(options.parentTitle || "").trim();
  const parentSlug = String(options.parentSlug || "").trim();
  const menuTitle = parentTitle || title;

  return normalizePageForEditableImport({
    id: `nav-${slug}`,
    title,
    slug,
    type: getNavigationPageType(title, parentTitle),
    menu: menuTitle,
    status: "Published",
    template: "Standard Page",
    visibility: "Public",
    parentSlug,
    menuOrder: Number(item?.sort_order || options.menuOrder || 1) || 1,
    showInHeader: 1,
    showInFooter: 1,
    heroHeadline: title,
    heroTag: menuTitle || "Website Page",
    summary: `Live website page imported from the ${options.sourceLabel || "header navigation"}.`,
    heroImage: assets.hero,
    ctaLabel: "Learn More",
    ctaUrl: item?.custom_url || item?.href || `/${slug}`,
    seoTitle: `${title} | Madda Walabu University`,
    seoDescription: `Madda Walabu University ${title} page.`,
    sourceUrl: item?.custom_url || item?.href || `/${slug}`,
    owner: "Content Office",
    priority: "Medium",
    updatedBy: "Header Navigation Import",
    sections: [createSection("Hero Banner"), createSection("Text Block")]
  });
};

const createPagesFromNavigationSnapshot = (menu = [], sourceLabel = "header navigation") => {
  const pagesBySlug = new Map();
  const addPage = (page) => {
    if (!page?.slug || pagesBySlug.has(page.slug)) return;
    pagesBySlug.set(page.slug, page);
  };

  (Array.isArray(menu) ? menu : []).forEach((item, menuIndex) => {
    const itemSlug = slugify(item?.slug || normalizeNavigationHrefToSlug(item?.custom_url || item?.href || "") || item?.title || "");
    if (itemSlug) {
      addPage(createPageFromNavigationItem(item, { menuOrder: Number(item?.sort_order || menuIndex + 1), sourceLabel }));
    }

    const parentTitle = String(item?.title || "").trim();
    const children = Array.isArray(item?.children) ? item.children : [];
    children.forEach((child, childIndex) => {
      const childSlug = slugify(child?.slug || normalizeNavigationHrefToSlug(child?.custom_url || child?.href || "") || child?.title || "");
      if (!childSlug) return;
      addPage(createPageFromNavigationItem(child, {
        parentTitle,
        parentSlug: itemSlug,
        menuOrder: Number(child?.sort_order || childIndex + 1),
        sourceLabel
      }));
    });
  });

  return Array.from(pagesBySlug.values());
};

const parseHeaderVisualModel = (html = "") => {
  if (typeof DOMParser === "undefined" || !String(html || "").trim()) {
    return { menuItems: [], ctaLabel: "", ctaUrl: "" };
  }

  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const menuRoot = doc.querySelector(".main-menu > ul");
    const cta = doc.querySelector(".header-action .th-btn");
    const menuItems = menuRoot
      ? Array.from(menuRoot.children).map((item, index) => {
          const directLink = Array.from(item.children).find((child) => child.tagName?.toLowerCase() === "a");
          const subMenu = Array.from(item.children).find((child) => child.tagName?.toLowerCase() === "ul" && child.classList.contains("sub-menu"));
          const isMega = item.classList.contains("mega-menu-wrap") || item.classList.contains("mwu-programs-mega") || item.querySelector(".mwu-mega-programs");
          return {
            id: `header-menu-${index}`,
            sourceIndex: index,
            title: String(directLink?.textContent || "").trim(),
            href: directLink?.getAttribute("href") || "#",
            isMega,
            children: isMega || !subMenu
              ? []
              : Array.from(subMenu.children).map((child, childIndex) => {
                  const childLink = child.querySelector("a");
                  return {
                    id: `header-menu-${index}-child-${childIndex}`,
                    title: String(childLink?.textContent || "").trim(),
                    href: childLink?.getAttribute("href") || "#"
                  };
                }).filter((child) => child.title || child.href)
          };
        }).filter((item) => item.title || item.href)
      : [];

    return {
      menuItems,
      ctaLabel: String(cta?.textContent || "").trim(),
      ctaUrl: cta?.getAttribute("href") || "#"
    };
  } catch {
    return { menuItems: [], ctaLabel: "", ctaUrl: "" };
  }
};

const buildVisualHeaderMenuItemHtml = (item = {}) => {
  const title = escapeHtml(item.title || "Menu Item");
  const href = escapeHtml(item.href || "#");
  const children = Array.isArray(item.children) ? item.children.filter((child) => child.title || child.href) : [];

  if (!children.length) {
    return `<li><a href="${href}">${title}</a></li>`;
  }

  return `
    <li class="menu-item-has-children">
      <a href="${href}">${title}</a>
      <ul class="sub-menu">
        ${children.map((child) => `<li><a href="${escapeHtml(child.href || "#")}">${escapeHtml(child.title || "Submenu Item")}</a></li>`).join("\n")}
      </ul>
    </li>
  `;
};

const updateHeaderHtmlFromVisualModel = (html = "", model = {}) => {
  if (typeof DOMParser === "undefined" || !String(html || "").trim()) {
    return String(html || "");
  }

  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const menuRoot = doc.querySelector(".main-menu > ul");
    const mobileMenuRoot = doc.querySelector(".th-mobile-menu > ul");
    const cta = doc.querySelector(".header-action .th-btn");
    const nextItems = Array.isArray(model.menuItems) ? model.menuItems : [];

    const buildUpdatedMenuHtml = (root, preserveMegaMarkup = false) => {
      if (!root) return "";
      const originalItems = Array.from(root.children);
      return nextItems.map((item, index) => {
        if (item.isMega) {
          const original =
            originalItems.find((candidate) => {
              const directLink = Array.from(candidate.children || []).find(
                (child) => child.tagName?.toLowerCase() === "a"
              );
              return String(directLink?.textContent || "").trim().toLowerCase() === String(item.title || "Programs").trim().toLowerCase();
            }) ||
            originalItems[item.sourceIndex] ||
            originalItems[index];
          if (!original) {
            return buildVisualHeaderMenuItemHtml(item);
          }
          const clone = original.cloneNode(true);
          const directLink = Array.from(clone.children).find((child) => child.tagName?.toLowerCase() === "a");
          if (directLink) {
            directLink.textContent = item.title || "Programs";
            directLink.setAttribute("href", item.href || "#");
          }
          if (!preserveMegaMarkup) {
            clone.classList.remove("mega-menu-wrap", "mwu-programs-mega");
          }
          return clone.outerHTML;
        }
        return buildVisualHeaderMenuItemHtml(item);
      }).join("\n");
    };

    if (menuRoot) {
      menuRoot.innerHTML = buildUpdatedMenuHtml(menuRoot, true);
    }
    if (mobileMenuRoot) {
      mobileMenuRoot.innerHTML = buildUpdatedMenuHtml(mobileMenuRoot, false);
    }

    if (cta) {
      cta.textContent = ` ${model.ctaLabel || "Apply Now"}`;
      cta.setAttribute("href", model.ctaUrl || "#");
    }

    return doc.body.innerHTML.trim();
  } catch {
    return String(html || "");
  }
};

const applyNavigationSnapshotToPages = (pages = [], menu = []) => {
  if (!Array.isArray(pages) || !Array.isArray(menu) || !menu.length) {
    return pages;
  }

  const nextPages = pages.map((page) => ({ ...page }));
  const indexBySlug = new Map(
    nextPages.map((page, index) => [slugify(page.slug || page.title || ""), index])
  );

  const applyToPage = (slug, updater) => {
    const index = indexBySlug.get(slugify(slug));
    if (index === undefined) return false;
    nextPages[index] = updater(nextPages[index]);
    return true;
  };

  menu.forEach((item, menuIndex) => {
    const itemTitle = String(item?.title || item?.page_title || "").trim();
    const itemSlug = slugify(item?.slug || normalizeNavigationHrefToSlug(item?.custom_url || ""));
    const children = Array.isArray(item?.children) ? item.children : [];

    if (itemSlug) {
      const applied = applyToPage(itemSlug, (page) => ({
        ...page,
        menu: itemTitle || page.menu,
        menuOrder: Number(item?.sort_order || menuIndex + 1) || page.menuOrder,
        parentSlug: ""
      }));
      if (!applied) {
        const newPage = createPageFromNavigationItem(item, { menuOrder: Number(item?.sort_order || menuIndex + 1) });
        indexBySlug.set(newPage.slug, nextPages.length);
        nextPages.push(newPage);
      }
    }

    children.forEach((child, childIndex) => {
      const childSlug = slugify(child?.slug || normalizeNavigationHrefToSlug(child?.custom_url || ""));
      if (!childSlug) return;
      const applied = applyToPage(childSlug, (page) => ({
        ...page,
        menu: itemTitle || page.menu,
        menuOrder: Number(child?.sort_order || childIndex + 1) || page.menuOrder,
        parentSlug: itemSlug || page.parentSlug || ""
      }));
      if (!applied) {
        const newPage = createPageFromNavigationItem(child, {
          parentTitle: itemTitle,
          parentSlug: itemSlug,
          menuOrder: Number(child?.sort_order || childIndex + 1)
        });
        indexBySlug.set(newPage.slug, nextPages.length);
        nextPages.push(newPage);
      }
    });
  });

  return nextPages;
};

const createSiteChromePage = (kind = "header", page = {}) => {
  const config = getSiteChromeConfig(kind);
  const snippetHtml = getSiteChromeHtml(page);

  return normalizePage({
    ...emptyPage(),
    ...page,
    title: page?.title || config.title,
    slug: config.slug,
    type: config.type,
    page_type: "static",
    menu: config.menu,
    menu_group: config.menu,
    template: page?.template || "Site Chrome",
    status: page?.status || "Published",
    heroHeadline: page?.heroHeadline || config.title,
    heroTag: page?.heroTag || "Global Layout",
    summary: page?.summary || config.summary,
    sourceUrl: page?.sourceUrl || page?.source_url || config.sourceUrl,
    ctaLabel: "",
    ctaUrl: "#",
    rawHtml: "",
    bodyHtml: snippetHtml,
    sections: [
      normalizeSection({
        id: page?.sections?.[0]?.id,
        type: "Raw HTML",
        title: `${config.title} Markup`,
        html: snippetHtml,
        body: snippetHtml,
        layout: "Legacy HTML",
        visible: true
      })
    ]
  });
};

const getMenuReferenceLabel = (page = {}, allPages = []) => {
  const group = String(page?.menu || "").trim();
  if (!group) {
    return "Not in menu";
  }

  const parentSlug = String(page?.parentSlug || page?.parent_slug || "").trim();
  const parentPage = parentSlug ? allPages.find((item) => item.slug === parentSlug) : null;
  const order = Number(page?.menuOrder || page?.menu_order || 0) || 0;
  const orderLabel = order > 0 ? `#${order}` : "";

  if (parentPage?.title) {
    return `${group} / ${parentPage.title}${orderLabel ? ` ${orderLabel}` : ""}`;
  }

  return `${group}${orderLabel ? ` ${orderLabel}` : ""}`;
};

const initialProgramCategories = [
  {
    id: makeId(),
    name: "Undergraduate Programs",
    slug: "undergraduate-programs",
    description: "Bachelor-level programs across agriculture, engineering, health sciences, business, education, and social sciences.",
    status: "Published",
    menuOrder: 1,
    featured: true,
    heroImage: assets.agriculture
  },
  {
    id: makeId(),
    name: "Postgraduate Programs",
    slug: "postgraduate-programs",
    description: "Master's, specialty, and advanced professional programs supporting research and leadership.",
    status: "Published",
    menuOrder: 2,
    featured: true,
    heroImage: assets.health
  },
  {
    id: makeId(),
    name: "Health Sciences",
    slug: "health-sciences",
    description: "Medicine, public health, nursing, pharmacy, medical laboratory science, and related health programs.",
    status: "Published",
    menuOrder: 3,
    featured: true,
    heroImage: assets.health
  },
  {
    id: makeId(),
    name: "Agriculture and Natural Resources",
    slug: "agriculture-natural-resources",
    description: "Crop, livestock, natural resources, rural development, forestry, and environmental science programs.",
    status: "Published",
    menuOrder: 4,
    featured: true,
    heroImage: assets.agriculture
  }
];

const normalizeProgramCategory = (category) => ({
  id: category?.id || makeId(),
  name: category?.name || "New Category",
  slug: slugify(category?.slug || category?.name || "new-category"),
  description: category?.description || "Describe this program category.",
  status: category?.status || "Draft",
  menuOrder: Number.isFinite(Number(category?.menuOrder)) ? Number(category.menuOrder) : 1,
  featured: Boolean(category?.featured),
  heroImage: category?.heroImage || assets.agriculture,
  programIds: Array.isArray(category?.programIds)
    ? Array.from(new Set(category.programIds.map(String).filter(Boolean)))
    : null,
  updatedAt: category?.updatedAt || todayIso()
});

const initialPrograms = [
  {
    id: makeId(),
    title: "Crop and Livestock Management",
    slug: "crop-and-livestock-management",
    categorySlug: "agriculture-natural-resources",
    level: "Undergraduate",
    college: "College of Agriculture",
    duration: "4 Years",
    delivery: "Regular",
    campus: "Main Campus",
    status: "Published",
    featured: true,
    applicationOpen: true,
    heroImage: assets.agriculture,
    summary: "Applied training in sustainable crop production, animal science, rural development, and agricultural field practice."
  },
  {
    id: makeId(),
    title: "Clinical and Public Health Sciences",
    slug: "clinical-and-public-health-sciences",
    categorySlug: "health-sciences",
    level: "Postgraduate",
    college: "College of Health Sciences",
    duration: "2 Years",
    delivery: "Regular",
    campus: "Goba Campus",
    status: "Published",
    featured: true,
    applicationOpen: true,
    heroImage: assets.health,
    summary: "Advanced study in clinical practice, community health, epidemiology, health systems, and public health research."
  },
  {
    id: makeId(),
    title: "Sustainable Tourism and Heritage",
    slug: "sustainable-tourism-and-heritage",
    categorySlug: "undergraduate-programs",
    level: "Undergraduate",
    college: "College of Business and Economics",
    duration: "3 Years",
    delivery: "Regular",
    campus: "Main Campus",
    status: "Review",
    featured: true,
    applicationOpen: false,
    heroImage: assets.campus,
    summary: "Tourism, cultural heritage, and destination management program focused on sustainable regional development."
  },
  {
    id: makeId(),
    title: "MSc in General Public Health",
    slug: "msc-in-general-public-health",
    categorySlug: "postgraduate-programs",
    level: "Postgraduate",
    college: "College of Health Sciences",
    duration: "2 Years",
    delivery: "Weekend",
    campus: "Goba Campus",
    status: "Published",
    featured: false,
    applicationOpen: true,
    heroImage: assets.health,
    summary: "Graduate public health program for health professionals working in research, policy, and community health leadership."
  }
];

const normalizeProgram = (program) => ({
  id: program?.id || makeId(),
  title: program?.title || "New Program",
  slug: slugify(program?.slug || program?.title || "new-program"),
  categorySlug: program?.categorySlug || "undergraduate-programs",
  pageSlug: program?.pageSlug || program?.page_slug || "",
  level: program?.level || "Undergraduate",
  college: program?.college || "Academic Affairs",
  duration: program?.duration || "4 Years",
  delivery: program?.delivery || "Regular",
  campus: program?.campus || "Main Campus",
  status: program?.status || "Draft",
  featured: Boolean(program?.featured),
  applicationOpen: program?.applicationOpen !== false,
  heroImage: program?.heroImage || assets.agriculture,
  summary: program?.summary || "Write a concise program summary for students.",
  updatedAt: program?.updatedAt || todayIso()
});

const normalizeProgramLevel = (program = {}) => {
  const raw = String(program.level || program.level_name || program.levelName || "").toLowerCase();
  if (raw.includes("phd") || raw.includes("doctor")) return "PhD";
  if (raw.includes("master") || raw.includes("msc") || raw.includes("ma ") || raw.includes("postgraduate")) return "Postgraduate";
  if (raw.includes("special")) return "Specialty";
  if (raw.includes("short")) return "Short Course";
  return "Undergraduate";
};

const normalizeImportedProgram = (program = {}) => {
  const title = String(program.title || "New Program").trim() || "New Program";
  const slug = slugify(program.slug || title);
  const departmentName = String(program.department_name || program.departmentName || program.college || "").trim();
  const levelName = String(program.level_name || program.levelName || program.level || "").trim();
  const categorySlug = slugify(program.department_slug || departmentName || program.level_slug || levelName || "undergraduate-programs");

  return normalizeProgram({
    id: program.id ? `live-program-${program.id}` : `live-program-${slug}`,
    title,
    slug,
    categorySlug,
    pageSlug: slug,
    level: normalizeProgramLevel(program),
    college: departmentName || "Academic Affairs",
    duration: program.duration || "See admission requirements",
    delivery: program.delivery || "Regular",
    campus: program.campus || "Main Campus",
    status: titleCaseStatus(program.status || "Published"),
    featured: Number(program.sort_order || 0) <= 12,
    applicationOpen: true,
    heroImage:
      categorySlug.includes("health") ? assets.health
        : categorySlug.includes("agric") || categorySlug.includes("natural") ? assets.agriculture
          : categorySlug.includes("tourism") || categorySlug.includes("environment") ? assets.campus
            : assets.hero,
    summary:
      program.short_description ||
      program.description ||
      program.seo_description ||
      `${title} program at Madda Walabu University.`,
    updatedAt: program.updated_at || program.updatedAt || todayIso()
  });
};

const createProgramCategoriesFromImportedPrograms = (importedPrograms = []) => {
  const categoryMap = new Map();
  importedPrograms.forEach((program, index) => {
    const categorySlug = slugify(program.department_slug || program.department_name || program.level_slug || program.level_name || "undergraduate-programs");
    if (!categorySlug || categoryMap.has(categorySlug)) return;
    const categoryName = program.department_name || program.level_name || "Academic Programs";
    categoryMap.set(categorySlug, normalizeProgramCategory({
      id: `live-category-${categorySlug}`,
      name: categoryName,
      slug: categorySlug,
      description: `${categoryName} programs imported from the live MWU website catalog.`,
      status: "Published",
      menuOrder: index + 1,
      featured: true,
      heroImage:
        categorySlug.includes("health") ? assets.health
          : categorySlug.includes("agric") || categorySlug.includes("natural") ? assets.agriculture
            : assets.hero
    }));
  });
  return Array.from(categoryMap.values());
};

const createProgramPageFromProgram = (program = {}) =>
  createBlankLocalDraftPage({
    title: program.title || "Academic Program",
    slug: program.slug || slugify(program.title || "academic-program"),
    type: "Academic Program",
    menu: "Programs",
    status: program.status || "Published",
    template: "Program Detail",
    visibility: "Public",
    parentSlug: "program",
    menuOrder: Number(program.menuOrder || 1) || 1,
    showInHeader: 1,
    showInFooter: 0,
    heroHeadline: program.title || "Academic Program",
    heroTag: program.level || "Academic Program",
    summary: program.summary || `${program.title || "Academic program"} at Madda Walabu University.`,
    heroImage: program.heroImage || assets.hero,
    ctaLabel: "Apply Now",
    ctaUrl: "/admission-apply",
    seoTitle: `${program.title || "Academic Program"} | Madda Walabu University`,
    seoDescription: program.summary || `${program.title || "Academic program"} at Madda Walabu University.`,
    owner: program.college || "Academic Affairs",
    priority: "Medium",
    sections: [
      createSection("Hero Banner"),
      normalizeSection({
        type: "Text Block",
        title: "Program Overview",
        body: program.summary || `${program.title || "This program"} is offered by Madda Walabu University.`
      }),
      normalizeSection({
        type: "Feature Cards",
        title: "Program Details",
        body: `Level: ${program.level || "Academic Program"} | College: ${program.college || "Academic Affairs"} | Duration: ${program.duration || "See admission requirements"} | Delivery: ${program.delivery || "Regular"}`
      }),
      createSection("CTA Banner")
    ]
  });

const loadProgramCategories = () => {
  try {
    const stored = window.localStorage.getItem(PROGRAM_CATEGORIES_KEY);
    const parsed = stored ? JSON.parse(stored) : initialProgramCategories;
    const normalized = Array.isArray(parsed) ? parsed.map(normalizeProgramCategory) : initialProgramCategories.map(normalizeProgramCategory);
    const existingSlugs = new Set(normalized.map((category) => category.slug));
    const missingSeedCategories = initialProgramCategories
      .map(normalizeProgramCategory)
      .filter((category) => !existingSlugs.has(category.slug));

    return [...normalized, ...missingSeedCategories];
  } catch {
    return initialProgramCategories.map(normalizeProgramCategory);
  }
};

const loadPrograms = () => {
  try {
    const stored = window.localStorage.getItem(PROGRAMS_KEY);
    const parsed = stored ? JSON.parse(stored) : initialPrograms;
    const normalized = Array.isArray(parsed) ? parsed.map(normalizeProgram) : initialPrograms.map(normalizeProgram);
    const existingSlugs = new Set(normalized.map((program) => program.slug));
    const missingSeedPrograms = initialPrograms
      .map(normalizeProgram)
      .filter((program) => !existingSlugs.has(program.slug));

    return [...normalized, ...missingSeedPrograms];
  } catch {
    return initialPrograms.map(normalizeProgram);
  }
};

const getSeoScore = (page) => {
  const checks = [
    (page.title || "").length >= 12,
    (page.slug || "").length >= 4,
    (page.summary || "").length >= 90,
    (page.seoTitle || "").length >= 25 && (page.seoTitle || "").length <= 70,
    (page.seoDescription || "").length >= 80 && (page.seoDescription || "").length <= 160,
    Array.isArray(page.sections) && page.sections.some((section) => section.visible !== false),
    Boolean(page.heroImage)
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
};

const isProgramPage = (page) =>
  [page?.title, page?.slug, page?.type, page?.menu]
    .join(" ")
    .toLowerCase()
    .includes("program");

const isBlogPage = (page) =>
  [page?.title, page?.slug, page?.type, page?.menu]
    .join(" ")
    .toLowerCase()
    .match(/\b(blog|blogs|news|article)\b/);

const isEventPage = (page) =>
  [page?.title, page?.slug, page?.type, page?.menu]
    .join(" ")
    .toLowerCase()
    .match(/\b(event|events)\b/);

const isDedicatedPage = (page) => isProgramPage(page) || isBlogPage(page) || isEventPage(page);

const isNormalWebsitePage = (page) => {
  if (isSiteChromePage(page)) {
    return false;
  }

  if (isDedicatedPage(page)) {
    return false;
  }

  const slug = page?.slug || "";
  const utilitySlugs = new Set([
    "cart",
    "checkout",
    "wishlist",
    "shop",
    "shop-details",
    "typography",
    "pricing",
    "error",
    "reviews",
    "students",
    "teacher",
    "teacher-details",
    "bysexual",
    "scrollship"
  ]);

  return !utilitySlugs.has(slug);
};

function App() {
  const standaloneEditorPageId = getStandaloneEditorPageId();
  const isStandaloneEditor = Boolean(standaloneEditorPageId);
  const storedUiState = getStoredCrmUiState();
  const [adminToken, setAdminToken] = useState(getStoredAdminToken);
  const [adminProfile, setAdminProfile] = useState(getStoredAdminProfile);
  const [adminUsers, setAdminUsers] = useState(loadAdminUsers);
  const [pages, setPages] = useState([]);
  const [programCategories, setProgramCategories] = useState(loadProgramCategories);
  const [programs, setPrograms] = useState(loadPrograms);
  const [activeView, setActiveView] = useState(
    isStandaloneEditor ? "page-editor" : String(storedUiState.activeView || "dashboard")
  );
  const [activePageId, setActivePageId] = useState(
    standaloneEditorPageId || String(storedUiState.activePageId || "")
  );
  const [formPage, setFormPage] = useState(emptyPage);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [menuFilter, setMenuFilter] = useState("All");
  const [sortKey, setSortKey] = useState("updatedAt");
  const [mediaLibrary, setMediaLibrary] = useState(loadMediaLibrary);
  const [mediaStorageMode, setMediaStorageMode] = useState("local");
  const [siteChromeTab, setSiteChromeTab] = useState("header");
  const [navigationSource, setNavigationSource] = useState("");
  const [selectedPageIds, setSelectedPageIds] = useState([]);
  const [editorTab, setEditorTab] = useState(String(storedUiState.editorTab || "builder"));
  const [notice, setNotice] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dangerDialog, setDangerDialog] = useState(null);
  const [pageEditorBuilderInitRevision, setPageEditorBuilderInitRevision] = useState(0);
  const importInputRef = useRef(null);
  const noticeTimeoutRef = useRef(null);
  const suppressInAppBuilderReinitRef = useRef(false);
  const pageEditorHydrationKeyRef = useRef("");
  const liveMenuGroupChoices = useMemo(() => getMenuGroupChoices(pages), [pages]);
  const accessibleNavItems = useMemo(
    () => navItems.filter((item) => hasPortalAccess(adminProfile, item.id)),
    [adminProfile]
  );
  const hasAnyPortalAccess = (...viewIds) => viewIds.some((viewId) => hasPortalAccess(adminProfile, viewId));
  const canCreatePages = hasAnyPortalAccess("page-editor");
  const requireAnyPortalAccess = (viewIds, actionLabel = "This action") => {
    if (viewIds.some((viewId) => hasPortalAccess(adminProfile, viewId))) {
      return true;
    }
    setNotice(`${actionLabel} is not enabled for this account.`);
    return false;
  };
  const currentAdminUser = useMemo(
    () => adminProfile || normalizeAdminUser({ id: "current-admin", name: "Current Admin", role: "super-admin", access: fullAccess }, fullAccess),
    [adminProfile]
  );
  const pageEditorBuilderSourceSignature = useMemo(() => JSON.stringify({
    id: formPage.id || "",
    title: formPage.title || "",
    slug: formPage.slug || "",
    status: formPage.status || "",
    bodyHtml: formPage.bodyHtml || formPage.body_html || "",
    rawHtml: formPage.rawHtml || formPage.raw_html || "",
    visualBuilder: formPage.visualBuilder || formPage.visual_builder || null
  }), [
    formPage.id,
    formPage.title,
    formPage.slug,
    formPage.status,
    formPage.bodyHtml,
    formPage.body_html,
    formPage.rawHtml,
    formPage.raw_html,
    formPage.visualBuilder,
    formPage.visual_builder
  ]);
  const pageEditorBuilderInitPayload = useMemo(() => buildHtmlVisualBuilderInitPayload(formPage), [
    formPage.id,
    formPage.title,
    formPage.slug,
    formPage.status,
    formPage.seoTitle,
    formPage.seoDescription,
    formPage.summary,
    formPage.bodyHtml,
    formPage.body_html,
    formPage.rawHtml,
    formPage.raw_html,
    formPage.visualBuilder,
    formPage.visual_builder
  ]);
  const pageEditorEditableSrcDoc = useMemo(() => {
    const storedDocument = getStoredEditableDocument(formPage);
    const sourceHtml = storedDocument.fullHtml || mergeBodyIntoHtml("", storedDocument.bodyHtml || formPage.bodyHtml || formPage.body_html || "");
    if (!sourceHtml) {
      return "";
    }
    return buildEditableLiveDocument(
      {
        ...formPage,
        title: formPage.title,
        customCss: formPage.customCss || formPage.custom_css || ""
      },
      sourceHtml
    );
  }, [
    formPage.id,
    formPage.title,
    formPage.bodyHtml,
    formPage.body_html,
    formPage.rawHtml,
    formPage.raw_html,
    formPage.customCss,
    formPage.custom_css
  ]);

  useEffect(() => {
    if (!adminToken || !adminProfile) {
      return;
    }

    setAdminUsers((current) => {
      const normalizedCurrent = current.map((user) => normalizeAdminUser(user));
      const currentId = String(adminProfile.id);
      const hasCurrentAdmin = normalizedCurrent.some((user) => String(user.id) === currentId || user.email === adminProfile.email);
      const nextUsers = hasCurrentAdmin
        ? normalizedCurrent.map((user) => (String(user.id) === currentId || user.email === adminProfile.email ? normalizeAdminUser({ ...user, ...adminProfile }, fullAccess) : user))
        : [normalizeAdminUser(adminProfile, fullAccess), ...normalizedCurrent];
      storeAdminUsers(nextUsers);
      return nextUsers;
    });
  }, [adminToken, adminProfile]);

  useEffect(() => {
    if (!adminToken) {
      return undefined;
    }

    let cancelled = false;

    const loadUsersFromApi = async () => {
      try {
        const response = await fetch(apiUrl("/admin/users"), {
          headers: getAuthHeaders(adminToken)
        });
        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        const incomingUsers = payload.users || payload.data?.users || payload.data || [];
        if (!Array.isArray(incomingUsers) || cancelled) {
          return;
        }

        const nextUsers = incomingUsers.map((user) => normalizeAdminUser(user));
        const withCurrentAdmin = adminProfile && !nextUsers.some((user) => user.id === adminProfile.id || user.email === adminProfile.email)
          ? [normalizeAdminUser(adminProfile, fullAccess), ...nextUsers]
          : nextUsers;
        setAdminUsers(withCurrentAdmin);
        storeAdminUsers(withCurrentAdmin);
      } catch {
        // The live API may not expose user management yet; local persistence remains available.
      }
    };

    loadUsersFromApi();

    return () => {
      cancelled = true;
    };
  }, [adminToken, adminProfile]);

  useEffect(() => {
    if (!adminToken || isStandaloneEditor || hasPortalAccess(adminProfile, activeView)) {
      return;
    }
    setActiveView(getFirstAccessibleView(adminProfile));
  }, [activeView, adminProfile, adminToken, isStandaloneEditor]);

  useEffect(() => {
    if (activeView !== "page-editor") {
      return;
    }
    if (suppressInAppBuilderReinitRef.current) {
      suppressInAppBuilderReinitRef.current = false;
      return;
    }
    setPageEditorBuilderInitRevision((current) => current + 1);
  }, [activeView, pageEditorBuilderSourceSignature]);

  const loadDetailedPageForEditor = async (pageId) => {
    const listPage = pages.find((page) => String(page.id) === String(pageId)) || null;
    if (listPage && isLocalDraftPage(listPage)) {
      return listPage;
    }
    let nextPage = listPage ? normalizePage(listPage) : null;
    editorDebugLog("page-editor-open:start", {
      pageId,
      listTitle: listPage?.title,
      listSlug: listPage?.slug,
      listSourceUrl: listPage?.sourceUrl || listPage?.source_url,
      listHasRawHtml: Boolean(listPage?.rawHtml || listPage?.raw_html),
      listHasBodyHtml: Boolean(listPage?.bodyHtml || listPage?.body_html),
      listVisualElements: Array.isArray(listPage?.visualBuilder?.elements || listPage?.visual_builder?.elements)
        ? (listPage?.visualBuilder?.elements || listPage?.visual_builder?.elements).length
        : null
    });
    setNotice(`Editor check: opening ${nextPage?.title || pageId}...`);

    const isNavigationOnlyPage = String(pageId || "").startsWith("nav-");
    try {
      if (isNavigationOnlyPage) {
        throw new Error("Navigation-only page uses its legacy source instead of an Admin API detail record.");
      }
      const detailResponse = await fetch(apiUrl(`/admin/pages/${encodeURIComponent(pageId)}`), {
        headers: getAuthHeaders(adminToken)
      });
      if (detailResponse.ok) {
        const detailPayload = await readOptionalJson(detailResponse);
        nextPage = normalizePage({
          ...(nextPage || {}),
          ...(detailPayload?.page || detailPayload?.data?.page || {}),
          sections: detailPayload?.sections || detailPayload?.data?.sections || detailPayload?.page?.sections || detailPayload?.data?.page?.sections || nextPage?.sections || []
        });
        editorDebugLog("page-editor-open:api-detail", {
          ok: true,
          title: nextPage.title,
          slug: nextPage.slug,
          sourceUrl: nextPage.sourceUrl || nextPage.source_url,
          rawHtmlBytes: String(nextPage.rawHtml || nextPage.raw_html || "").length,
          bodyHtmlBytes: String(nextPage.bodyHtml || nextPage.body_html || "").length,
          sections: nextPage.sections?.length || 0
        });
      }
    } catch {
      // Fall back to the list payload and live HTML fetch below.
      editorDebugLog("page-editor-open:api-detail", { ok: false, pageId });
    }

    if (!nextPage) {
      return null;
    }

    if (
      isNavigationOnlyPage ||
      (isImportedPlaceholderPage(nextPage) && !hasPersistedEditableMarkup(nextPage))
    ) {
      // Header-navigation pages are discovery records, not authored content.
      // Never let their generated one-widget fallback snapshot block loading
      // the real canonical legacy document (for example /legacy/program.html).
      nextPage = normalizePage({
        ...nextPage,
        sections: [],
        rawHtml: "",
        raw_html: "",
        bodyHtml: "",
        body_html: "",
        visualBuilder: null,
        visual_builder: null,
        builderKind: "",
        builder_kind: ""
      });
    }

    const hasHtmlBuilderSnapshot = hasUsableHtmlBuilderSnapshot(nextPage);

    if (!hasHtmlBuilderSnapshot && !hasPersistedEditableMarkup(nextPage)) {
      const candidates = getEditableFetchCandidates(nextPage);
      editorDebugLog("page-editor-open:fetch-candidates", {
        title: nextPage.title,
        slug: nextPage.slug,
        candidates
      });
      setNotice(`Editor check: fetching HTML for ${nextPage.title} (${candidates[0] || "no path"})`);
      for (const fetchPath of candidates) {
        try {
          const response = await fetch(fetchPath, { headers: { Accept: "text/html" } });
          if (!response.ok) {
            editorDebugLog("page-editor-open:fetch-result", { fetchPath, ok: false, status: response.status });
            continue;
          }
          const html = await response.text();
          if (!html || !/<body[\s>]/i.test(html) || !looksLikeUsableHtmlDocument(html)) {
            editorDebugLog("page-editor-open:fetch-result", {
              fetchPath,
              ok: false,
              reason: "not usable html",
              bytes: html?.length || 0,
              hasBody: /<body[\s>]/i.test(html || "")
            });
            continue;
          }
          editorDebugLog("page-editor-open:fetch-result", {
            fetchPath,
            ok: true,
            bytes: html.length,
            bodyBytes: extractBodyHtml(html).length
          });
          nextPage = normalizePage({
            ...nextPage,
            sourceUrl: fetchPath,
            rawHtml: html,
            bodyHtml: extractBodyHtml(html),
            sections: [
              normalizeSection({
                id: nextPage.sections?.[0]?.id,
                type: "Raw HTML",
                title: nextPage.title || "Page Markup",
                html: extractBodyHtml(html),
                body: extractBodyHtml(html),
                layout: "Legacy HTML",
                visible: true
              })
            ]
          });
          setNotice(`Editor check: HTML loaded for ${nextPage.title} (${html.length} bytes). Sending to editor...`);
          break;
        } catch {
          editorDebugLog("page-editor-open:fetch-result", { fetchPath, ok: false, reason: "exception" });
          // Try next candidate.
        }
      }
    }

    editorDebugLog("page-editor-open:final-page", {
      title: nextPage.title,
      slug: nextPage.slug,
      sourceUrl: nextPage.sourceUrl || nextPage.source_url,
      rawHtmlBytes: String(nextPage.rawHtml || nextPage.raw_html || "").length,
      bodyHtmlBytes: String(nextPage.bodyHtml || nextPage.body_html || "").length,
      hasPersistedEditableMarkup: hasPersistedEditableMarkup(nextPage),
      hasUsableHtmlBuilderSnapshot: hasUsableHtmlBuilderSnapshot(nextPage)
    });

    return nextPage;
  };

  const openPageEditorTab = async (pageId, tab = "content") => {
    if (!requireAnyPortalAccess(["page-editor"], "Page editor access")) {
      return;
    }
    pageEditorHydrationKeyRef.current = "";
    setActivePageId(pageId);
    const targetPage = await loadDetailedPageForEditor(pageId);
    if (targetPage) {
      setFormPage(targetPage);
      setPages((current) => current.map((page) => (String(page.id) === String(targetPage.id) ? targetPage : page)));
      setActivePageId(targetPage.id);
    }
    setEditorTab(tab);
    setActiveView("page-editor");
  };

  const persistInAppPageEditorBuilderState = async (builderState, saveMode = "draft") => {
    if (!requireAnyPortalAccess(["page-editor"], "Page editor saving")) {
      return;
    }
    const snapshot = builderState?.snapshot || {};
    const snapshotPageSettings = snapshot.pageSettings || {};
    const publishedHtml = String(builderState?.publishedHtml || "").trim();

    if (!publishedHtml) {
      setNotice("Visual builder returned no HTML to save.");
      return;
    }

    const persistedBodyHtml = `${serializeHtmlVisualBuilderSnapshot(snapshot)}${extractBodyHtml(publishedHtml)}`;
    const extractedCustomCss = extractInlineStylesFromHtmlDocument(publishedHtml);
    const nextTitle = snapshotPageSettings.title || formPage.title;
    const nextSlug = slugify(snapshotPageSettings.slug || formPage.slug || nextTitle);
    const requestedStatus = saveMode === "publish"
      ? "Published"
      : titleCaseStatus(snapshotPageSettings.status || "Draft");
    const nextStatus = requestedStatus === "Published" && saveMode !== "publish" ? "Draft" : requestedStatus;
    const pageOverride = {
      builderKind: "visual",
      visualBuilder: snapshot,
      title: nextTitle,
      slug: nextSlug,
      status: nextStatus,
      seoTitle: snapshotPageSettings.seoTitle || formPage.seoTitle || nextTitle,
      seoDescription: snapshotPageSettings.seoDescription || formPage.seoDescription || "",
      bodyHtml: persistedBodyHtml,
      rawHtml: publishedHtml,
      customCss: extractedCustomCss,
      sections: [
        normalizeSection({
          id: formPage.sections?.[0]?.id,
          type: "Raw HTML",
          title: nextTitle || "Page Markup",
          html: persistedBodyHtml,
          body: persistedBodyHtml,
          layout: "Legacy HTML",
          visible: true
        })
      ]
    };

    suppressInAppBuilderReinitRef.current = true;
    updateField("builderKind", pageOverride.builderKind);
    updateField("visualBuilder", pageOverride.visualBuilder);
    updateField("title", pageOverride.title);
    updateField("slug", pageOverride.slug);
    updateField("status", pageOverride.status);
    updateField("seoTitle", pageOverride.seoTitle);
    updateField("seoDescription", pageOverride.seoDescription);
    updateField("bodyHtml", persistedBodyHtml);
    updateField("rawHtml", publishedHtml);
    updateField("customCss", extractedCustomCss);
    await savePage(
      { preventDefault() {} },
      pageOverride,
      { suppressBuilderReinit: true }
    );
  };

  const handleInAppEditableHtmlUpdate = (data = {}) => {
    const bodyHtml = restoreLiveAssetUrls(data.bodyHtml || "");
    const fullHtml = restoreLiveAssetUrls(data.fullHtml || mergeBodyIntoHtml(formPage.rawHtml || formPage.raw_html || "", bodyHtml));
    suppressInAppBuilderReinitRef.current = true;
    updateField("bodyHtml", bodyHtml);
    updateField("rawHtml", fullHtml);
  };

  useEffect(() => {
    window.localStorage.removeItem("mwu-crm-pages-v1");
    window.localStorage.removeItem("mwu-admin-token");
    window.localStorage.removeItem("authToken");
    window.localStorage.removeItem("token");
  }, []);

  useEffect(() => {
    if (isStandaloneEditor) {
      return;
    }
    window.sessionStorage.setItem(
      CRM_UI_STATE_KEY,
      JSON.stringify({
        activeView,
        activePageId,
        editorTab
      })
    );
  }, [activePageId, activeView, editorTab, isStandaloneEditor]);

  useEffect(() => {
    if (noticeTimeoutRef.current) {
      window.clearTimeout(noticeTimeoutRef.current);
      noticeTimeoutRef.current = null;
    }

    if (!notice) {
      return undefined;
    }

    noticeTimeoutRef.current = window.setTimeout(() => {
      setNotice("");
      noticeTimeoutRef.current = null;
    }, 3000);

    return () => {
      if (noticeTimeoutRef.current) {
        window.clearTimeout(noticeTimeoutRef.current);
        noticeTimeoutRef.current = null;
      }
    };
  }, [notice]);

  useEffect(() => {
    if (!adminToken) {
      return undefined;
    }

    const activityEvents = ["click", "keydown", "mousemove", "scroll", "touchstart"];
    const markActivity = () => touchAdminSession();
    activityEvents.forEach((eventName) => window.addEventListener(eventName, markActivity, { passive: true }));

    const interval = window.setInterval(() => {
      const lastActivity = Number(window.localStorage.getItem(ADMIN_ACTIVITY_KEY) || 0);
      if (!lastActivity || Date.now() - lastActivity > INACTIVITY_LIMIT_MS) {
        clearAdminSession();
        setAdminToken("");
        setNotice("Session expired after 15 minutes of inactivity.");
      }
    }, 30000);

    touchAdminSession();

    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, markActivity));
      window.clearInterval(interval);
    };
  }, [adminToken]);

  useEffect(() => {
    if (!adminToken) {
      setPages([]);
      setActivePageId("");
      setFormPage(emptyPage());
      setSelectedPageIds([]);
      setNavigationSource("");
      return;
    }

    let cancelled = false;

    const loadAdminPages = async () => {
      try {
        const response = await fetch(apiUrl("/admin/pages?limit=200"), {
          headers: getAuthHeaders(adminToken)
        });
        if (!response.ok) {
          throw new Error(await readApiError(response, "Admin pages API is not available."));
        }

        const payload = await response.json();
        let apiPages = (payload.data || payload.pages || []).map(normalizePage);

        let resolvedNavigationSource = "";
        try {
          let menu = [];

          if (import.meta.env.DEV) {
            const staticHeaderResponse = await fetch(getFetchableLiveAssetUrl(SITE_CHROME_CONFIGS.header.sourceUrl), {
              headers: { Accept: "text/html" },
              cache: "no-store"
            });
            if (staticHeaderResponse.ok) {
              const staticHeaderHtml = await staticHeaderResponse.text();
              menu = parseStaticHeaderNavigation(staticHeaderHtml);
              if (menu.length) {
                resolvedNavigationSource = "static-header";
              }
            }
          }

          if (!menu.length) {
            const adminNavigationResponse = await fetch(apiUrl("/admin/navigation/header"), {
            headers: getAuthHeaders(adminToken)
          });

          if (adminNavigationResponse.ok) {
            const adminNavigationPayload = await readOptionalJson(adminNavigationResponse);
            menu = Array.isArray(adminNavigationPayload?.menu)
              ? adminNavigationPayload.menu
              : Array.isArray(adminNavigationPayload?.data?.menu)
                ? adminNavigationPayload.data.menu
                : [];
            if (menu.length) {
              resolvedNavigationSource = "api";
            }
          }
          }

          if (!menu.length && !import.meta.env.DEV) {
            const publicNavigationResponse = await fetch(apiUrl("/navigation/header"), {
              headers: { Accept: "application/json" }
            });
            if (publicNavigationResponse.ok) {
              const publicNavigationPayload = await readOptionalJson(publicNavigationResponse);
              menu = Array.isArray(publicNavigationPayload?.menu)
                ? publicNavigationPayload.menu
                : Array.isArray(publicNavigationPayload?.data?.menu)
                  ? publicNavigationPayload.data.menu
                  : [];
              if (menu.length) {
                resolvedNavigationSource = "public-api";
              }
            }
          }

          if (!menu.length) {
            const staticHeaderResponse = await fetch(getFetchableLiveAssetUrl(SITE_CHROME_CONFIGS.header.sourceUrl), {
              headers: { Accept: "text/html" },
              cache: "no-store"
            });
            if (staticHeaderResponse.ok) {
              const staticHeaderHtml = await staticHeaderResponse.text();
              menu = parseStaticHeaderNavigation(staticHeaderHtml);
              if (menu.length) {
                resolvedNavigationSource = "static-header";
              }
            }
          }

          if (menu.length) {
            apiPages = applyNavigationSnapshotToPages(apiPages, menu);
          }
        } catch {
          resolvedNavigationSource = "";
        }

        if (cancelled) {
          return;
        }

        const requestedPageId = String(activePageId || storedUiState.activePageId || "");
        const shouldRestoreBlankEditorDraft =
          !isStandaloneEditor &&
          String(activeView || storedUiState.activeView || "") === "page-editor" &&
          (!requestedPageId || !apiPages.some((page) => String(page.id) === requestedPageId));
        const blankDraft = shouldRestoreBlankEditorDraft ? createBlankLocalDraftPage() : null;
        const nextPages = blankDraft ? [blankDraft, ...apiPages] : apiPages;
        const firstNormalPage = nextPages.find(isNormalWebsitePage) || nextPages[0] || emptyPage();
        const requestedPage =
          requestedPageId
            ? nextPages.find((page) => String(page.id) === requestedPageId) || null
            : null;

        setPages(nextPages);
        setNavigationSource(resolvedNavigationSource);
        setActivePageId(requestedPage?.id || blankDraft?.id || firstNormalPage.id || "");
        setFormPage(requestedPage || blankDraft || firstNormalPage);
        if (window.sessionStorage.getItem(ADMIN_PAGES_LOADED_NOTICE_KEY) !== "1") {
          const sourceLabel =
            resolvedNavigationSource === "api"
              ? " Header navigation loaded from Admin API."
              : resolvedNavigationSource === "public-api"
                ? " Header navigation loaded from the public API."
                : resolvedNavigationSource === "static-header"
                  ? " Header navigation was inferred from the live header file because the API menu was empty."
                  : "";
          setNotice(`Loaded ${apiPages.length} pages from Admin API.${sourceLabel}`);
        }
      } catch (error) {
        if (!cancelled) {
          if (String(error.message || "").includes("HTTP 401")) {
            clearAdminSession();
            setAdminToken("");
          }

          setPages([]);
          setActivePageId("");
          setFormPage(emptyPage());
          setSelectedPageIds([]);
          setNotice(`${error.message || "Admin pages API failed."} No cached pages are shown.`);
        }
      }
    };

    loadAdminPages();

    return () => {
      cancelled = true;
    };
  }, [adminToken]);

  useEffect(() => {
    window.localStorage.setItem(PROGRAM_CATEGORIES_KEY, JSON.stringify(programCategories));
  }, [programCategories]);

  useEffect(() => {
    window.localStorage.setItem(PROGRAMS_KEY, JSON.stringify(programs));
  }, [programs]);

  useEffect(() => {
    window.localStorage.setItem(MEDIA_LIBRARY_KEY, JSON.stringify(mediaLibrary));
  }, [mediaLibrary]);

  useEffect(() => {
    let cancelled = false;

    const loadRemoteMediaLibrary = async () => {
      const remoteMediaUrl = mediaApiUrl();
      if (!remoteMediaUrl) {
        setMediaStorageMode("local");
        return;
      }
      try {
        const response = await fetch(remoteMediaUrl, {
          headers: { Accept: "application/json" },
          cache: "no-store"
        });
        if (!response.ok) {
          throw new Error(await readApiError(response, "Media API is not available."));
        }
        const payload = await readOptionalJson(response);
        const remoteItems = Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.data?.items)
            ? payload.data.items
            : [];
        if (cancelled) {
          return;
        }
        commitMediaLibrary(mergeMediaLibraries(remoteItems, initialMediaLibrary));
        setMediaStorageMode("api");
      } catch {
        if (!cancelled) {
          setMediaStorageMode("local");
        }
      }
    };

    loadRemoteMediaLibrary();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const selected = pages.find((page) => String(page.id) === String(activePageId));
    if (selected) {
      setFormPage((current) => {
        if (String(current?.id || "") === String(selected.id) && hasPersistedEditableMarkup(current)) {
          return current;
        }
        return selected;
      });
    }
  }, [activePageId, pages]);

  useEffect(() => {
    if (isStandaloneEditor || activeView !== "page-editor" || !activePageId || !pages.length) {
      return;
    }

    const activeListPage = pages.find((page) => String(page.id) === String(activePageId)) || null;
    if (isLocalDraftPage(activeListPage) || isLocalDraftPage(formPage)) {
      return;
    }

    const hydrationKey = [
      activePageId,
      activeListPage?.updatedAt || activeListPage?.updated_at || "",
      activeListPage?.sourceUrl || activeListPage?.source_url || "",
      String(activeListPage?.rawHtml || activeListPage?.raw_html || "").length,
      String(activeListPage?.bodyHtml || activeListPage?.body_html || "").length,
      Array.isArray(activeListPage?.visualBuilder?.elements || activeListPage?.visual_builder?.elements)
        ? (activeListPage?.visualBuilder?.elements || activeListPage?.visual_builder?.elements).length
        : ""
    ].join("|");

    if (pageEditorHydrationKeyRef.current === hydrationKey) {
      return;
    }
    pageEditorHydrationKeyRef.current = hydrationKey;

    let cancelled = false;
    editorDebugLog("page-editor-hydrate:effect", {
      activePageId,
      title: activeListPage?.title,
      slug: activeListPage?.slug,
      hydrationKey
    });
    loadDetailedPageForEditor(activePageId).then((targetPage) => {
      if (cancelled || !targetPage) return;
      setFormPage(targetPage);
      setPages((current) => current.map((page) => (String(page.id) === String(targetPage.id) ? targetPage : page)));
    });

    return () => {
      cancelled = true;
    };
  }, [activePageId, activeView, formPage?.id, isStandaloneEditor, pages]);

  const contentManagedPages = useMemo(() => pages.filter((page) => !isSiteChromePage(page)), [pages]);

  const activeSiteChromePage = useMemo(() => {
    const existing = findSiteChromePage(pages, siteChromeTab);
    if (isMatchingSiteChromePage(formPage, siteChromeTab)) {
      return createSiteChromePage(siteChromeTab, formPage);
    }
    return createSiteChromePage(siteChromeTab, existing || {});
  }, [formPage, pages, siteChromeTab]);

  const programPages = useMemo(
    () =>
      contentManagedPages
        .filter(isProgramPage)
        .sort((a, b) => {
          if (a.slug === "program" || a.slug?.startsWith("programs-")) return -1;
          if (b.slug === "program" || b.slug?.startsWith("programs-")) return 1;
          return a.title.localeCompare(b.title);
        }),
    [contentManagedPages]
  );
  const megaMenuPrograms = useMemo(() => {
    const catalogPrograms = programs.map((program) => ({
      ...program,
      id: String(program.id),
      pageSlug: program.pageSlug || program.slug
    }));
    const representedKeys = new Set(
      catalogPrograms.flatMap((program) => [
        String(program.pageSlug || "").toLowerCase(),
        String(program.slug || "").toLowerCase(),
        String(program.title || "").toLowerCase()
      ])
    );
    const pagePrograms = programPages
      .filter((page) => page.slug !== "program" && !String(page.slug || "").startsWith("programs-"))
      .filter(
        (page) =>
          !representedKeys.has(String(page.slug || "").toLowerCase()) &&
          !representedKeys.has(String(page.title || "").toLowerCase())
      )
      .map((page) => {
        const slug = String(page.slug || "");
        const level = slug.includes("-phd-")
          ? "PhD"
          : slug.includes("-pg-")
            ? "Postgraduate"
            : "Undergraduate";
        const categorySlug = level === "PhD"
          ? "phd-programs"
          : level === "Postgraduate"
            ? "postgraduate-programs"
            : "undergraduate-programs";
        return {
          id: `page:${page.id}`,
          title: page.title,
          slug,
          pageSlug: slug,
          categorySlug,
          level,
          college: page.owner || "Academic Affairs",
          status: page.status || "Published",
          heroImage: page.heroImage || "",
          summary: page.summary || "",
          source: "page"
        };
      });

    return [...catalogPrograms, ...pagePrograms].sort((a, b) => a.title.localeCompare(b.title));
  }, [programPages, programs]);

  const blogPages = useMemo(
    () =>
      contentManagedPages
        .filter(isBlogPage)
        .sort((a, b) => {
          if (a.slug === "blog") return -1;
          if (b.slug === "blog") return 1;
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        }),
    [contentManagedPages]
  );

  const eventPages = useMemo(
    () =>
      contentManagedPages
        .filter(isEventPage)
        .sort((a, b) => {
          if (a.slug === "event") return -1;
          if (b.slug === "event") return 1;
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        }),
    [contentManagedPages]
  );

  const standardPages = useMemo(() => contentManagedPages.filter(isNormalWebsitePage), [contentManagedPages]);

  const filteredPages = useMemo(() => {
    return standardPages.filter((page) => {
      const matchesQuery = [page.title, page.slug, page.type, page.menu, page.owner]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesStatus = statusFilter === "All" || (page.status || "").toLowerCase() === statusFilter.toLowerCase();
      const matchesType = typeFilter === "All" || page.type === typeFilter;
      const matchesMenu = menuFilter === "All" || page.menu === menuFilter;
      return matchesQuery && matchesStatus && matchesType && matchesMenu;
    }).sort((a, b) => {
      if (sortKey === "title") {
        return a.title.localeCompare(b.title);
      }

      if (sortKey === "menuOrder") {
        return Number(a.menuOrder || 0) - Number(b.menuOrder || 0);
      }

      if (sortKey === "status") {
        return a.status.localeCompare(b.status);
      }

      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  }, [standardPages, query, statusFilter, typeFilter, menuFilter, sortKey]);

  const stats = useMemo(() => {
    const published = contentManagedPages.filter((page) => page.status === "Published").length;
    const review = contentManagedPages.filter((page) => page.status === "Review").length;
    const scheduled = contentManagedPages.filter((page) => page.status === "Scheduled").length;
    const archived = contentManagedPages.filter((page) => page.status === "Archived").length;
    const averageSeo = Math.round(
      contentManagedPages.reduce((sum, page) => sum + getSeoScore(page), 0) / Math.max(contentManagedPages.length, 1)
    );

    return { published, review, scheduled, archived, averageSeo };
  }, [contentManagedPages]);

  const commitMediaLibrary = (nextLibrary) => {
    const normalizedLibrary = nextLibrary.map(normalizeMediaItem);
    setMediaLibrary(normalizedLibrary);
    return normalizedLibrary;
  };

  const requestDangerConfirmation = ({
    title,
    message,
    details = [],
    verificationText = "DELETE",
    continueLabel = "Continue",
    finalLabel = "Delete Permanently"
  }) => new Promise((resolve) => {
    setDangerDialog({
      title,
      message,
      details,
      verificationText,
      continueLabel,
      finalLabel,
      resolve
    });
  });

  const resolveDangerConfirmation = (accepted) => {
    setDangerDialog((current) => {
      current?.resolve?.(accepted);
      return null;
    });
  };

  const requestMediaApiCredentials = () => {
    const stored = getStoredMediaApiCredentials();
    const username = window.prompt("Website media username", stored.username || "");
    if (!username) {
      return null;
    }
    const password = window.prompt("Website media password", stored.password || "");
    if (!password) {
      return null;
    }
    const credentials = { username: username.trim(), password };
    storeMediaApiCredentials(credentials);
    return credentials;
  };

  const uploadMediaFilesLocally = async (files) => {
    const fileList = Array.from(files || []).filter(Boolean);
    if (!fileList.length) {
      return [];
    }

    const uploadedItems = [];
    for (const file of fileList) {
      const path = await readFileAsDataUrl(file);
      const { width, height } = await readImageDimensions(path);
      uploadedItems.push(normalizeMediaItem({
        title: file.name.replace(/\.[^.]+$/, "") || "Uploaded media",
        type: "Upload",
        path,
        bytes: file.size,
        width,
        height,
        mimeType: file.type || "image/jpeg"
      }));
    }

    commitMediaLibrary([...uploadedItems, ...mediaLibrary]);
    setMediaStorageMode("local");
    setNotice(`Uploaded ${uploadedItems.length} media item${uploadedItems.length === 1 ? "" : "s"} to the browser media library.`);
    return uploadedItems;
  };

  const uploadMediaFiles = async (files) => {
    const fileList = Array.from(files || []).filter(Boolean);
    if (!fileList.length) {
      return [];
    }
    if (!requireAnyPortalAccess(["media"], "Media uploads")) {
      return [];
    }

    if (mediaStorageMode === "api") {
      let credentials = getStoredMediaApiCredentials();
      if (!credentials.username || !credentials.password) {
        credentials = requestMediaApiCredentials() || {};
      }
      if (!credentials.username || !credentials.password) {
        setNotice("Website media credentials were not provided. Uploaded to the browser media library instead.");
        return uploadMediaFilesLocally(fileList);
      }

      try {
        const uploadedItems = [];
        for (const file of fileList) {
          const dataUrl = await readFileAsDataUrl(file);
          const { width, height } = await readImageDimensions(dataUrl);
          const response = await fetch(mediaApiUrl(), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              ...getMediaApiAuthHeaders(credentials)
            },
            body: JSON.stringify({
              title: file.name.replace(/\.[^.]+$/, "") || "Uploaded media",
              type: "Upload",
              width,
              height,
              dimensions: buildMediaDimensions(width, height),
              upload: {
                name: file.name,
                type: file.type,
                dataUrl
              }
            })
          });
          if (response.status === 401) {
            storeMediaApiCredentials({});
            throw new Error("Media API authorization failed. Re-enter website media credentials.");
          }
          if (!response.ok) {
            throw new Error(await readApiError(response, "Media upload failed."));
          }
          const payload = await readOptionalJson(response);
          const rawItem = payload?.item || payload?.data?.item || payload?.media || payload?.data?.media || payload?.data || payload || {};
          const item = normalizeMediaApiItem(rawItem);
          if (item.path) {
            uploadedItems.push(item);
          }
          const nextItems = Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload?.data?.items)
              ? payload.data.items
              : null;
          if (nextItems) {
            commitMediaLibrary(mergeMediaLibraries(nextItems, uploadedItems, initialMediaLibrary));
          }
        }
        if (uploadedItems.length) {
          if (!mediaLibrary.some((entry) => uploadedItems.some((uploaded) => uploaded.path === entry.path))) {
            commitMediaLibrary(mergeMediaLibraries(uploadedItems, mediaLibrary, initialMediaLibrary));
          }
          setNotice(`Uploaded ${uploadedItems.length} media item${uploadedItems.length === 1 ? "" : "s"} to the website media library.`);
          return uploadedItems;
        }

        setNotice("Media upload did not return a usable image URL. Uploaded to the browser media library instead.");
        return uploadMediaFilesLocally(fileList);
      } catch (error) {
        setNotice(`${error.message || "Media upload failed."} Uploaded to the browser media library instead.`);
        return uploadMediaFilesLocally(fileList);
      }
    }

    return uploadMediaFilesLocally(fileList);
  };

  const deleteMediaItem = async (mediaId) => {
    if (!requireAnyPortalAccess(["media"], "Media delete")) {
      return false;
    }
    const removedItem = mediaLibrary.find((item) => String(item.id) === String(mediaId)) || null;
    if (!removedItem) {
      return false;
    }

    const confirmed = await requestDangerConfirmation({
      title: "Delete media item?",
      message: "This permanently removes the selected media item and may affect pages that reference it.",
      details: [
        `Media: ${removedItem.title || "Untitled media"}`,
        `Path: ${removedItem.path || "No media path available"}`
      ],
      verificationText: removedItem.title || "DELETE MEDIA",
      finalLabel: "Delete Media"
    });
    if (!confirmed) {
      setNotice("Media delete cancelled.");
      return false;
    }

    if (mediaStorageMode === "api") {
      let credentials = getStoredMediaApiCredentials();
      if (!credentials.username || !credentials.password) {
        credentials = requestMediaApiCredentials() || {};
      }
      if (!credentials.username || !credentials.password) {
        setNotice("Delete cancelled. Website media credentials are required to remove stored images.");
        return false;
      }
    }
    const nextLibrary = mediaLibrary.filter((item) => String(item.id) !== String(mediaId));
    if (nextLibrary.length === mediaLibrary.length) {
      return false;
    }

    if (mediaStorageMode === "api") {
      return fetch(mediaApiUrl(`/admin/media/${encodeURIComponent(mediaId)}`), {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          ...getMediaApiAuthHeaders()
        }
      }).then(async (response) => {
        if (response.status === 401) {
          storeMediaApiCredentials({});
          setNotice("Website media credentials expired. Enter them again before deleting media.");
          return false;
        }
        if (!response.ok) {
          setNotice(await readApiError(response, "Media delete failed."));
          return false;
        }
        const payload = await readOptionalJson(response);
        const remoteItems = Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.data?.items)
            ? payload.data.items
            : [];
        commitMediaLibrary(mergeMediaLibraries(remoteItems, initialMediaLibrary));
        if (formPage.heroImage && removedItem?.path === formPage.heroImage) {
          updateField("heroImage", remoteItems[0]?.path || initialMediaLibrary[0]?.path || "");
        }
        setNotice("Media item deleted from the website media library.");
        return true;
      }).catch((error) => {
        setNotice(error.message || "Media delete failed.");
        return false;
      });
    }

    commitMediaLibrary(nextLibrary);
    if (formPage.heroImage && removedItem?.path === formPage.heroImage) {
      updateField("heroImage", nextLibrary[0]?.path || "");
    }
    setNotice("Media item deleted from the browser media library.");
    return true;
  };

  const copyMediaUrl = async (url) => {
    if (!url) return false;
    try {
      const copyValue = normalizeLiveAssetUrl(url) || url;
      await navigator.clipboard.writeText(copyValue);
      setNotice("Media URL copied.");
      return true;
    } catch {
      setNotice("Clipboard copy failed. Copy the media URL manually.");
      return false;
    }
  };

  const updateField = (field, value) => {
    setFormPage((current) => {
      if (field === "title") {
        const currentSlug = slugify(current.title);
        return {
          ...current,
          title: value,
          slug: current.slug === currentSlug ? slugify(value) : current.slug
        };
      }

      return { ...current, [field]: value };
    });
  };

  const updateSection = (sectionId, field, value) => {
    setFormPage((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === sectionId ? { ...section, [field]: value } : section
      )
    }));
  };

  const addSection = (type = "Text Block") => {
    setFormPage((current) => ({
      ...current,
      sections: [...current.sections, createSection(type)]
    }));
  };

  const duplicateSection = (sectionId) => {
    setFormPage((current) => {
      const sectionIndex = current.sections.findIndex((section) => section.id === sectionId);
      if (sectionIndex < 0) {
        return current;
      }

      const nextSections = [...current.sections];
      const original = nextSections[sectionIndex];
      nextSections.splice(sectionIndex + 1, 0, {
        ...original,
        id: makeId(),
        title: `${original.title} Copy`
      });

      return { ...current, sections: nextSections };
    });
  };

  const moveSection = (sectionId, direction) => {
    setFormPage((current) => {
      const fromIndex = current.sections.findIndex((section) => section.id === sectionId);
      const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;

      if (fromIndex < 0 || toIndex < 0 || toIndex >= current.sections.length) {
        return current;
      }

      const nextSections = [...current.sections];
      const [moved] = nextSections.splice(fromIndex, 1);
      nextSections.splice(toIndex, 0, moved);

      return { ...current, sections: nextSections };
    });
  };

  const removeSection = (sectionId) => {
    setFormPage((current) => ({
      ...current,
      sections: current.sections.filter((section) => section.id !== sectionId)
    }));
  };

  const openPageEditorView = (pageId, tab = "content") => {
    if (!requireAnyPortalAccess(["page-editor"], "Page editor access")) {
      return;
    }
    const targetPage = pages.find((page) => String(page.id) === String(pageId));
    if (targetPage) {
      setFormPage(targetPage);
      setActivePageId(targetPage.id);
    }
    setEditorTab(tab);
    setActiveView("page-editor");
  };

  const loadSiteChromeSnippet = async (kind, page, options = {}) => {
    const currentPage = createSiteChromePage(kind, page || {});
    if (!options.preferWebsite && hasMeaningfulSiteChromeHtml(currentPage)) {
      return currentPage;
    }

    const sourcePath = currentPage.sourceUrl || getSiteChromeConfig(kind).sourceUrl;
    const liveSourceUrl = getFetchableLiveAssetUrl(sourcePath);
    const sourceCandidates = import.meta.env.DEV
      ? Array.from(new Set([sourcePath, liveSourceUrl].filter(Boolean)))
      : [liveSourceUrl].filter(Boolean);
    if (!sourceCandidates.length) {
      return currentPage;
    }

    for (const sourceUrl of sourceCandidates) {
      try {
        const response = await fetch(sourceUrl, {
          headers: { Accept: "text/html" },
          cache: "no-store"
        });
        if (!response.ok) continue;
        const html = await response.text();
        if (!html.trim()) continue;
        return createSiteChromePage(kind, {
          ...currentPage,
          bodyHtml: html,
          rawHtml: "",
          sourceUrl: sourcePath,
          _siteChromeSource: sourceUrl === sourcePath ? "local-file" : "website"
        });
      } catch {
        // Try the next local or live source candidate.
      }
    }
    return currentPage;
  };

  const persistPageToApi = async (pageToSave, previousPageOverride = null) => {
    const previousPage = previousPageOverride || pages.find((page) => String(page.id) === String(pageToSave.id));
    const nextPage = {
      ...pageToSave,
      slug: slugify(pageToSave.slug || pageToSave.title),
      menuOrder: Number(pageToSave.menuOrder || 1),
      updatedAt: todayIso(),
      updatedBy: "Content Editor",
      revisions: previousPage
        ? [makeRevision(previousPage), ...(previousPage.revisions || [])].slice(0, 8)
        : pageToSave.revisions || []
    };

    const pageExistsInDatabase = previousPage && !isLocalDraftPage(previousPage) && !isLocalDraftPage(nextPage);
    const payload = toApiPagePayload(nextPage);
    const apiPayload = pageExistsInDatabase ? withPageApiIdentifiers(nextPage, payload) : payload;
    const body = JSON.stringify(apiPayload);
    const identifiers = getPageApiIdentifiers(nextPage);
    const updateAttempts = identifiers.flatMap((identifier) => [
      { method: "PUT", path: `/admin/pages/${encodeURIComponent(identifier)}` },
      { method: "PATCH", path: `/admin/pages/${encodeURIComponent(identifier)}` },
      { method: "POST", path: `/admin/pages/${encodeURIComponent(identifier)}` }
    ]);
    const createAttempts = [
      { method: "POST", path: "/admin/pages" },
      { method: "PUT", path: "/admin/pages" }
    ];
    const attempts = pageExistsInDatabase
      ? [...updateAttempts, { method: "POST", path: "/admin/pages", onlyAfterMissingRoute: true }]
      : createAttempts;
    let result = null;
    let finalError = "";
    let sawMissingMutationRoute = !pageExistsInDatabase;

    for (const attempt of attempts) {
      if (attempt.onlyAfterMissingRoute && !sawMissingMutationRoute) {
        continue;
      }

      const response = await fetch(apiUrl(attempt.path), {
        method: attempt.method,
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(adminToken)
        },
        body
      });

      if (response.ok) {
        result = await readOptionalJson(response);
        finalError = "";
        break;
      }

      finalError = await readApiError(response, "Page save failed.");
      if ([404, 405].includes(response.status)) {
        sawMissingMutationRoute = true;
      }
      if (response.status === 401 || !shouldTryNextMutationRoute(response.status)) {
        break;
      }
    }

    if (finalError) {
      throw new Error(finalError);
    }

    const savedPage = result?.data || result?.page
      ? normalizePage({ ...nextPage, ...(result.data || result.page) })
      : withoutLocalPageMarkers(nextPage);

    return { savedPage, pageExistsInDatabase };
  };

  const openSiteChromeView = async (kind = "header") => {
    if (!requireAnyPortalAccess(["site-chrome"], "Header and footer access")) {
      return;
    }
    const config = getSiteChromeConfig(kind);
    let existing = findSiteChromePage(pages, kind);
    if (existing?.id) {
      const detailIdentifiers = getPageApiIdentifiers(existing);
      for (const identifier of detailIdentifiers) {
        try {
          const detailResponse = await fetch(apiUrl(`/admin/pages/${encodeURIComponent(identifier)}`), {
            headers: getAuthHeaders(adminToken),
            cache: "no-store"
          });
          if (!detailResponse.ok) continue;
          const detailPayload = await readOptionalJson(detailResponse);
          const detailedPage = normalizeSiteChromeApiPage(detailPayload, existing);
          if (isMatchingSiteChromePage(detailedPage, kind)) {
            existing = {
              ...detailedPage,
              _siteChromeSource: hasMeaningfulSiteChromeHtml(detailedPage) ? "api" : detailedPage._siteChromeSource
            };
            break;
          }
        } catch {
          // Try the next database identifier before using the source-file fallback.
        }
      }
    }
    let nextPage =
      hasMeaningfulSiteChromeHtml(existing)
        ? createSiteChromePage(kind, {
            ...existing,
            _siteChromeSource: "api"
          })
        : await loadSiteChromeSnippet(kind, existing || {}, { preferWebsite: true });
    if (kind === "header" && hasMeaningfulSiteChromeHtml(nextPage)) {
      const syncedHtml = updateProgramsMegaMenuMarkup(getSiteChromeHtml(nextPage), programCategories, megaMenuPrograms);
      nextPage = createSiteChromePage("header", {
        ...nextPage,
        bodyHtml: syncedHtml,
        rawHtml: "",
        _siteChromeSource: nextPage._siteChromeSource
      });
    }
    const shouldImportSourceMarkup = !existing || !hasMeaningfulSiteChromeHtml(existing);
    let importPersisted = false;
    let importErrorMessage = "";

    if (shouldImportSourceMarkup && hasMeaningfulSiteChromeHtml(nextPage)) {
      try {
        const persisted = await persistPageToApi(nextPage, existing || null);
        nextPage = persisted.savedPage;
        importPersisted = true;
      } catch (error) {
        importErrorMessage = `${config.title} markup loaded from source file, but database import failed: ${error.message || "Unknown error."}`;
      }
    }

    setPages((current) => {
      const existingIndex = current.findIndex((page) => isMatchingSiteChromePage(page, kind));
      if (existingIndex >= 0) {
        return current.map((page, index) => (index === existingIndex ? nextPage : page));
      }
      return [nextPage, ...current];
    });

    setSiteChromeTab(kind);
    setActiveView("site-chrome");
    setActivePageId(nextPage.id);
    setFormPage(nextPage);
    if (importErrorMessage) {
      setNotice(importErrorMessage);
    } else if (importPersisted) {
      setNotice(`${config.title} markup imported from ${config.sourceUrl} and saved to Admin API.`);
    } else if (!hasMeaningfulSiteChromeHtml(nextPage)) {
      setNotice(`${config.title} is missing both database markup and source-file markup.`);
    } else if (nextPage._siteChromeSource === "local-file") {
      setNotice(`${config.title} loaded from the editable local HTML partial.`);
    } else if (nextPage._siteChromeSource === "website") {
      setNotice(`${config.title} and its complete menu hierarchy were refreshed from maddauni.online.`);
    } else if (nextPage._siteChromeSource === "api") {
      setNotice(`${config.title} and its complete menu hierarchy were loaded from the Admin API.`);
    } else {
      setNotice(`Editing ${config.title.toLowerCase()} content.`);
    }
  };

  const updateSiteChromeHtml = (kind, value) => {
    if (!requireAnyPortalAccess(["site-chrome"], "Header and footer editing")) {
      return;
    }
    setFormPage((current) => {
      const nextPage = createSiteChromePage(kind, current);
      const sectionId = nextPage.sections?.[0]?.id || makeId();

      return {
        ...nextPage,
        bodyHtml: value,
        rawHtml: "",
        sections: [
          normalizeSection({
            id: sectionId,
            type: "Raw HTML",
            title: `${getSiteChromeConfig(kind).title} Markup`,
            html: value,
            body: value,
            layout: "Legacy HTML",
            visible: true
          })
        ]
      };
    });
  };

  const saveSiteChromePage = (event, kind = siteChromeTab) => {
    if (!requireAnyPortalAccess(["site-chrome"], "Header and footer editing")) {
      event?.preventDefault?.();
      return null;
    }
    const chromePage = createSiteChromePage(kind, formPage);
    const html = getSiteChromeHtml(chromePage);
    const pageOverride = {
      ...chromePage,
      bodyHtml: html,
      rawHtml: "",
      sections: [
        normalizeSection({
          id: chromePage.sections?.[0]?.id,
          type: "Raw HTML",
          title: `${getSiteChromeConfig(kind).title} Markup`,
          html,
          body: html,
          layout: "Legacy HTML",
          visible: true
        })
      ]
    };

    return saveSiteChromeAndPublish(event, kind, pageOverride);
  };

  const publishSiteChromeFile = async (kind, html) => {
    const config = getSiteChromeConfig(kind);
    const fileName = kind === "footer" ? "universal-footer.html" : "inner-header.html";
    const targets = [];
    const expectedHtml = String(html || "");

    if (import.meta.env.DEV) {
      targets.push({ url: "/__site_chrome_publish", scope: "local", method: "POST" });
    }
    if (SITE_CHROME_PUBLISH_URL) {
      targets.push({ url: SITE_CHROME_PUBLISH_URL, scope: "live", method: "POST" });
    }

    const result = {
      local: false,
      live: false,
      liveConfigured: Boolean(SITE_CHROME_PUBLISH_URL),
      error: ""
    };
    for (const target of targets) {
      try {
        const response = await fetch(target.url, {
          method: target.method,
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(adminToken)
          },
          body: JSON.stringify({
            kind,
            slug: config.slug,
            path: config.sourceUrl,
            file_name: fileName,
            html: expectedHtml,
            content: expectedHtml
          })
        });

        if (response.ok) {
          result[target.scope] = true;
          if (target.scope === "live") {
            try {
              const verificationUrl = `${getFetchableLiveAssetUrl(config.sourceUrl)}${config.sourceUrl.includes("?") ? "&" : "?"}verify=${Date.now()}`;
              const verificationResponse = await fetch(verificationUrl, {
                headers: { Accept: "text/html" },
                cache: "no-store"
              });
              if (!verificationResponse.ok) {
                throw new Error(`deployed partial returned HTTP ${verificationResponse.status}`);
              }
              const deployedHtml = await verificationResponse.text();
              const normalizePublishedHtml = (value) => String(value || "").replace(/\r\n/g, "\n").trim();
              if (normalizePublishedHtml(deployedHtml) !== normalizePublishedHtml(expectedHtml)) {
                result.live = false;
                result.error = `${config.title} publish endpoint responded successfully, but the deployed HTML partial still contains different content.`;
              }
            } catch (error) {
              result.live = false;
              result.error = `${config.title} could not be verified after publishing: ${error.message || "verification failed."}`;
            }
            break;
          }
          continue;
        }
        if (target.scope === "live") {
          result.error =
            response.status === 404
              ? "The website publishing endpoint is not deployed yet (HTTP 404)."
              : await readApiError(response, `${config.title} file publish failed.`);
        } else if (![404, 405].includes(response.status)) {
          result.error = await readApiError(response, `${config.title} local file synchronization failed.`);
        }
      } catch (error) {
        result.error = error.message || `${config.title} file publish failed.`;
      }
    }
    return result;
  };

  const saveSiteChromeAndPublish = async (event, kind, pageOverride) => {
    if (!requireAnyPortalAccess(["site-chrome"], "Header and footer publishing")) {
      event?.preventDefault?.();
      return null;
    }
    const savedPage = await savePage(event, pageOverride);
    if (!savedPage) return null;

    // The editor state is authoritative for this publish. Some page API
    // responses omit content fields or can briefly return the previous body,
    // which must never be republished over the user's new header/footer.
    const html = getSiteChromeHtml(pageOverride) || getSiteChromeHtml(savedPage);
    const publishResult = await publishSiteChromeFile(kind, html);
    if (publishResult.live) {
      setNotice(`${getSiteChromeConfig(kind).title} saved and published to the live HTML partial.`);
    } else if (publishResult.liveConfigured && publishResult.error) {
      setNotice(
        `${getSiteChromeConfig(kind).title} was saved to the Admin API${publishResult.local ? " and local HTML partial" : ""}, ` +
        `but the public website was not updated. ${publishResult.error}`
      );
    } else if (publishResult.local) {
      setNotice(`${getSiteChromeConfig(kind).title} saved to the Admin API and the local HTML partial was synchronized.`);
    } else if (!publishResult.liveConfigured) {
      setNotice(`${getSiteChromeConfig(kind).title} saved successfully to the Admin API.`);
    } else {
      setNotice(
        publishResult.error ||
        `${getSiteChromeConfig(kind).title} saved to the Admin API, but the configured live publish endpoint did not accept the update.`
      );
    }
    return savedPage;
  };

  const createNewPage = () => {
    if (!canCreatePages) {
      setNotice("Page editor access is not enabled for this account.");
      return;
    }
    const draft = createBlankLocalDraftPage();
    setPages((current) => [draft, ...current]);
    setActivePageId(draft.id);
    setFormPage(draft);
    setEditorTab("content");
    setActiveView("page-editor");
    setNotice("Draft page created.");
  };

  const createProgramPage = (program = null) => {
    if (!requireAnyPortalAccess(["programs"], "Program page creation")) {
      return;
    }
    const nextMenuOrder =
      programPages.reduce((highestOrder, page) => Math.max(highestOrder, Number(page.menuOrder || 0)), 0) + 1;
    const draftNumber = programPages.length + 1;
    const programTitle = program?.title || "New Academic Program";
    const normalizedLevel = String(program?.level || "Undergraduate").toLowerCase();
    const levelPrefix = normalizedLevel.includes("phd")
      ? "phd"
      : normalizedLevel.includes("postgraduate") || normalizedLevel.includes("master")
        ? "pg"
        : "ug";
    const draftSlug = program
      ? `program-${levelPrefix}-${slugify(program.title)}`
      : `program-ug-new-academic-program-${draftNumber}`;
    const draft = createBlankLocalDraftPage({
      title: programTitle,
      slug: draftSlug,
      type: "Academic Program",
      menu: "Programs",
      status: "Draft",
      template: "Program Detail",
      visibility: "Public",
      parentSlug: "program",
      menuOrder: nextMenuOrder,
      showInHeader: 1,
      showInFooter: 0,
      heroHeadline: programTitle,
      heroTag: program?.level || "Academic Program",
      summary: program?.summary || "",
      heroImage: program?.heroImage || "",
      ctaLabel: "Apply Now",
      ctaUrl: "/admission-apply",
      owner: "Academic Affairs",
      priority: "Medium"
    });

    if (program?.id) {
      setPrograms((current) =>
        current.map((entry) =>
          entry.id === program.id
            ? { ...entry, pageSlug: draft.slug, updatedAt: todayIso() }
            : entry
        )
      );
    }

    setPages((current) => [draft, ...current]);
    setActivePageId(draft.id);
    setFormPage(draft);
    setEditorTab("content");
    setActiveView("page-editor");
    setNotice(
      program?.id
        ? `${programTitle} page created and linked to its program record.`
        : "Program page created and assigned to the Programs navigation group."
    );
  };

  const savePage = async (event, pageOverride = null, options = {}) => {
    event?.preventDefault?.();
    if (!requireAnyPortalAccess(["pages", "page-editor", "blogs", "events", "programs", "site-chrome"], "Page saving")) {
      return null;
    }
    const pageToSave = pageOverride ? { ...formPage, ...pageOverride } : formPage;

    try {
      const { savedPage, pageExistsInDatabase } = await persistPageToApi(pageToSave);

      const replacementIds = new Set(getPageApiIdentifiers(pageToSave).concat(savedPage.id).map(String));
      setPages((current) => {
        let replaced = false;
        const nextPages = current.map((page) => {
          if (replacementIds.has(String(page.id)) || replacementIds.has(String(page.page_id || "")) || replacementIds.has(String(page.slug || ""))) {
            replaced = true;
            return savedPage;
          }
          return page;
        });

        return replaced ? nextPages : [savedPage, ...nextPages];
      });
      if (options.suppressBuilderReinit) {
        // Saving first updates the controlled form fields and then updates them
        // again with the API response. Keep both renders from reinitializing the
        // iframe, otherwise the response render replaces the live edited DOM.
        suppressInAppBuilderReinitRef.current = true;
      }
      setActivePageId(savedPage.id);
      setFormPage(savedPage);
      setNotice(pageExistsInDatabase ? "Page updated in database." : "New page added to database.");
      return savedPage;
    } catch (error) {
      if (String(error.message || "").includes("HTTP 401")) {
        clearAdminSession();
        setAdminToken("");
      }

      setNotice(error.message || "Page save failed.");
      return null;
    }
  };

  const updateActiveStatus = (status) => {
    if (!requireAnyPortalAccess(["pages", "page-editor", "blogs", "events", "programs", "site-chrome"], "Page status updates")) {
      return;
    }
    const nextPage = {
      ...formPage,
      status,
      updatedAt: todayIso(),
      updatedBy: "Content Editor"
    };

    setFormPage(nextPage);
    setPages((current) => current.map((page) => (String(page.id) === String(nextPage.id) ? nextPage : page)));
    setNotice(`Page moved to ${status}.`);
  };

  const duplicatePage = () => {
    if (!requireAnyPortalAccess(["pages", "page-editor", "blogs", "events", "programs", "site-chrome"], "Page duplication")) {
      return;
    }
    const copyPage = {
      ...formPage,
      id: makeId(),
      isLocalDraft: true,
      title: `${formPage.title} Copy`,
      slug: `${formPage.slug}-copy`,
      status: "Draft",
      updatedAt: todayIso(),
      sections: formPage.sections.map((section) => ({ ...section, id: makeId() }))
    };

    setPages((current) => [copyPage, ...current]);
    setActivePageId(copyPage.id);
    setFormPage(copyPage);
    setNotice("Page duplicated as a draft.");
  };

  const performDeletePage = async (targetPage, options = {}) => {
    if (!requireAnyPortalAccess(["pages", "page-editor", "blogs", "events", "programs", "site-chrome"], "Page deletion")) {
      return false;
    }
    const { silentSuccess = false } = options;
    try {
      const identifiers = getPageApiIdentifiers(targetPage);
      if (isLocalDraftPage(targetPage)) {
        const removalIds = new Set(identifiers.map(String));
        setPages((current) => {
          const remaining = current.filter(
            (page) => !removalIds.has(String(page.id)) && !removalIds.has(String(page.page_id || "")) && !removalIds.has(String(page.slug || ""))
          );
          if (removalIds.has(String(activePageId))) {
            const nextPage = remaining[0] || emptyPage();
            setActivePageId(nextPage.id || "");
            setFormPage(nextPage);
          }
          return remaining;
        });
        setSelectedPageIds((current) => current.filter((id) => !removalIds.has(String(id))));
        if (!silentSuccess) {
          setNotice(`Removed unsaved draft "${targetPage.title}".`);
        }
        return true;
      }

      const deleteIdentifiers = withPageDeleteIdentifiers(targetPage);
      const deletePayload = JSON.stringify(deleteIdentifiers);
      const deleteActionPayload = JSON.stringify({
        ...deleteIdentifiers,
        action: "delete",
        operation: "delete",
        _method: "DELETE"
      });
      const attempts = [
        ...identifiers.map((identifier) => ({ method: "DELETE", path: `/admin/pages/${encodeURIComponent(identifier)}` })),
        ...identifiers.map((identifier) => ({ method: "POST", path: `/admin/pages/${encodeURIComponent(identifier)}/delete`, body: deletePayload })),
        ...identifiers.map((identifier) => ({ method: "POST", path: `/admin/pages/${encodeURIComponent(identifier)}`, body: deleteActionPayload })),
        { method: "POST", path: "/admin/pages/delete", body: deletePayload },
        { method: "POST", path: "/admin/pages", body: deleteActionPayload },
        { method: "DELETE", path: "/admin/pages", body: deletePayload },
        ...identifiers.map((identifier) => ({ method: "DELETE", path: `/pages/${encodeURIComponent(identifier)}` })),
        ...identifiers.map((identifier) => ({ method: "POST", path: `/pages/${encodeURIComponent(identifier)}/delete`, body: deletePayload })),
        ...identifiers.map((identifier) => ({ method: "POST", path: `/pages/${encodeURIComponent(identifier)}`, body: deleteActionPayload })),
        { method: "POST", path: "/pages/delete", body: deletePayload },
        { method: "POST", path: "/pages", body: deleteActionPayload },
        { method: "DELETE", path: "/pages", body: deletePayload }
      ];
      let finalError = "";
      const failedAttempts = [];

      for (const attempt of attempts) {
        const response = await fetch(apiUrl(attempt.path), {
          method: attempt.method,
          headers: {
            ...(attempt.body ? { "Content-Type": "application/json" } : {}),
            ...getAuthHeaders(adminToken)
          },
          body: attempt.body
        });

        if (response.ok) {
          finalError = "";
          break;
        }

        finalError = await readApiError(response, "Delete failed.");
        failedAttempts.push({ method: attempt.method, path: attempt.path, status: response.status });
        if (response.status === 401 || !shouldTryNextMutationRoute(response.status)) {
          break;
        }
      }

      if (finalError) {
        const routeSummary = failedAttempts
          .slice(0, 8)
          .map((attempt) => `${attempt.method} ${attempt.path} -> ${attempt.status}`)
          .join("; ");
        const allMissingRoutes = failedAttempts.length > 0 && failedAttempts.every((attempt) => Number(attempt.status) === 404);
        if (allMissingRoutes) {
          throw new Error(`Backend delete route is not deployed for pages. Tried: ${routeSummary}`);
        }
        throw new Error(`${finalError}${routeSummary ? ` Tried: ${routeSummary}` : ""}`);
      }

      const removalIds = new Set(identifiers.map(String));
      setPages((current) => {
        const remaining = current.filter(
          (page) => !removalIds.has(String(page.id)) && !removalIds.has(String(page.page_id || "")) && !removalIds.has(String(page.slug || ""))
        );
        if (removalIds.has(String(activePageId))) {
          const nextPage = remaining[0] || emptyPage();
          setActivePageId(nextPage.id || "");
          setFormPage(nextPage);
        }

        return remaining;
      });
      setSelectedPageIds((current) => current.filter((id) => !removalIds.has(String(id))));
      if (!silentSuccess) {
        setNotice(`Deleted "${targetPage.title}" from the database.`);
      }
      return true;
    } catch (error) {
      if (String(error.message || "").includes("HTTP 401")) {
        clearAdminSession();
        setAdminToken("");
      }
      throw error;
    }
  };

  const deletePageById = async (pageId) => {
    const targetPage = pages.find((page) => String(page.id) === String(pageId));
    if (!targetPage) {
      setNotice("Page not found.");
      return false;
    }

    const confirmed = await requestDangerConfirmation({
      title: "Delete page permanently?",
      message: "This permanently removes the selected page and all of its saved sections from the CRM.",
      details: [
        `Page: ${targetPage.title}`,
        `Slug: /${targetPage.slug}`,
        isLocalDraftPage(targetPage) ? "Source: Unsaved local draft" : "Source: Admin database"
      ],
      verificationText: targetPage.slug || targetPage.title || "DELETE PAGE",
      finalLabel: "Delete Page"
    });
    if (!confirmed) {
      setNotice("Page delete cancelled.");
      return false;
    }

    try {
      await performDeletePage(targetPage);
      return true;
    } catch (error) {
      setNotice(error.message || "Delete failed.");
      return false;
    }
  };

  const bulkDeletePages = async () => {
    if (!requireAnyPortalAccess(["pages"], "Bulk page deletion")) {
      return;
    }
    if (!selectedPageIds.length) {
      setNotice("Select pages first.");
      return;
    }

    const targets = pages.filter((page) => selectedPageIds.some((id) => String(id) === String(page.id)));
    if (!targets.length) {
      setNotice("Selected pages could not be found.");
      return;
    }

    const previewTitles = targets.slice(0, 4).map((page) => page.title);
    const remainingCount = targets.length - previewTitles.length;
    const confirmed = await requestDangerConfirmation({
      title: `Delete ${targets.length} selected page${targets.length === 1 ? "" : "s"}?`,
      message: "This permanently removes all selected pages from the CRM.",
      details: [
        ...previewTitles.map((title, index) => `${index + 1}. ${title}`),
        ...(remainingCount > 0 ? [`+ ${remainingCount} more selected page${remainingCount === 1 ? "" : "s"}`] : [])
      ],
      verificationText: `${targets.length} PAGES`,
      finalLabel: "Delete Selected Pages"
    });
    if (!confirmed) {
      setNotice("Bulk delete cancelled.");
      return;
    }

    let deletedCount = 0;
    let firstFailure = "";
    for (const targetPage of targets) {
      try {
        await performDeletePage(targetPage, { silentSuccess: true });
        deletedCount += 1;
      } catch (error) {
        if (!firstFailure) {
          firstFailure = `${targetPage.title}: ${error.message || "Delete failed."}`;
        }
      }
    }

    setSelectedPageIds([]);
    if (firstFailure) {
      setNotice(
        deletedCount
          ? `Deleted ${deletedCount} page${deletedCount === 1 ? "" : "s"}, but at least one delete failed. ${firstFailure}`
          : firstFailure
      );
      return;
    }

    setNotice(`Deleted ${deletedCount} selected page${deletedCount === 1 ? "" : "s"}.`);
  };

  const deletePage = () => {
    deletePageById(formPage.id);
  };

  const restoreRevision = (revisionId) => {
    if (!requireAnyPortalAccess(["page-editor"], "Revision restore")) {
      return;
    }
    const revision = formPage.revisions?.find((item) => item.id === revisionId);
    if (!revision) {
      return;
    }

    setFormPage((current) => ({
      ...current,
      ...revision.snapshot,
      sections: revision.snapshot.sections.map(normalizeSection),
      updatedAt: todayIso(),
      updatedBy: "Content Editor"
    }));
    setNotice("Revision restored in the editor. Save to keep it.");
  };

  const toggleSelectedPage = (pageId) => {
    setSelectedPageIds((current) =>
      current.some((id) => String(id) === String(pageId))
        ? current.filter((id) => String(id) !== String(pageId))
        : [...current, pageId]
    );
  };

  const toggleAllFiltered = (pageIds = filteredPages.map((page) => page.id)) => {
    const visibleIds = pageIds;
    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) => selectedPageIds.some((selectedId) => String(selectedId) === String(id)));
    setSelectedPageIds((current) =>
      allSelected
        ? current.filter((id) => !visibleIds.some((visibleId) => String(visibleId) === String(id)))
        : Array.from(new Set([...current, ...visibleIds]))
    );
  };

  const bulkUpdateStatus = (status) => {
    if (!requireAnyPortalAccess(["pages"], "Bulk page status updates")) {
      return;
    }
    if (!selectedPageIds.length) {
      setNotice("Select pages first.");
      return;
    }

    setPages((current) =>
      current.map((page) =>
        selectedPageIds.some((id) => String(id) === String(page.id))
          ? { ...page, status, updatedAt: todayIso(), updatedBy: "Content Editor" }
          : page
      )
    );

    if (selectedPageIds.some((id) => String(id) === String(formPage.id))) {
      setFormPage((current) => ({ ...current, status, updatedAt: todayIso(), updatedBy: "Content Editor" }));
    }

    setSelectedPageIds([]);
    setNotice(`Updated ${selectedPageIds.length} pages to ${status}.`);
  };

  const bulkDuplicate = () => {
    if (!requireAnyPortalAccess(["pages"], "Bulk page duplication")) {
      return;
    }
    if (!selectedPageIds.length) {
      setNotice("Select pages first.");
      return;
    }

    const copies = pages
      .filter((page) => selectedPageIds.some((id) => String(id) === String(page.id)))
      .map((page) => ({
        ...page,
        id: makeId(),
        title: `${page.title} Copy`,
        slug: `${page.slug}-copy-${Math.random().toString(36).slice(2, 5)}`,
        status: "Draft",
        updatedAt: todayIso(),
        createdAt: todayIso(),
        revisions: [],
        sections: page.sections.map((section) => ({ ...section, id: makeId() }))
      }));

    setPages((current) => [...copies, ...current]);
    setSelectedPageIds([]);
    setNotice(`Duplicated ${copies.length} pages.`);
  };

  const exportPage = () => {
    const blob = new Blob([JSON.stringify(formPage, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${formPage.slug || "mwu-page"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Page JSON exported.");
  };

  const exportAllPages = () => {
    const blob = new Blob([JSON.stringify(pages, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mwu-crm-pages.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("All pages exported.");
  };

  const importPages = async (event) => {
    if (!requireAnyPortalAccess(["pages"], "Page import")) {
      if (event?.target) {
        event.target.value = "";
      }
      return;
    }
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const sourcePages = Array.isArray(parsed?.pages) ? parsed.pages : Array.isArray(parsed) ? parsed : [parsed];
      const imported = sourcePages.map((page) =>
        normalizePage({
          ...page,
          id: page.id || page.page_id || makeId(),
          title: page.title || "Imported Page",
          slug: slugify(page.slug || page.title || "imported-page"),
          updatedAt: todayIso(),
          createdAt: page.createdAt || page.created_at || todayIso()
        })
      );

      setPages((current) => {
        const nextPages = [...current];
        imported.forEach((incomingPage) => {
          const existingIndex = nextPages.findIndex((page) => String(page.id) === String(incomingPage.id) || page.slug === incomingPage.slug);
          if (existingIndex >= 0) {
            nextPages[existingIndex] = { ...nextPages[existingIndex], ...incomingPage, id: nextPages[existingIndex].id };
          } else {
            nextPages.unshift(incomingPage);
          }
        });
        return nextPages;
      });
      setActivePageId(imported[0].id);
      setFormPage(imported[0]);
      setNotice(`Imported or updated ${imported.length} page${imported.length === 1 ? "" : "s"}.`);
    } catch {
      setNotice("Import failed. Use a valid page JSON export.");
    } finally {
      event.target.value = "";
    }
  };

  const importLivePublishedPages = async () => {
    if (!requireAnyPortalAccess(["pages"], "Admin page sync")) {
      return;
    }
    try {
      const response = await fetch(apiUrl("/admin/pages?limit=200"), {
        headers: getAuthHeaders(adminToken)
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Admin pages API is not available."));
      }

      const payload = await response.json();
      const incomingPages = (payload.data || payload.pages || []).map((page, index) =>
        normalizePageForEditableImport({
          ...page,
          id: page.id || makeId(),
          menuOrder: page.menuOrder || index + 1,
          updatedAt: todayIso(),
          updatedBy: "Editable Path Reimport"
        })
      );
      editorDebugLog("pages-import:api-pages", {
        count: incomingPages.length,
        sample: incomingPages.slice(0, 8).map((page) => ({
          title: page.title,
          slug: page.slug,
          sourceUrl: page.sourceUrl || page.source_url,
          rawHtmlBytes: String(page.rawHtml || page.raw_html || "").length,
          bodyHtmlBytes: String(page.bodyHtml || page.body_html || "").length
        }))
      });

      if (!incomingPages.length) {
        setNotice("No pages found in Admin API.");
        return;
      }

      const savedPages = [];
      for (const page of incomingPages) {
        try {
          editorDebugLog("pages-import:save-page", {
            title: page.title,
            slug: page.slug,
            sourceUrl: page.sourceUrl || page.source_url
          });
          const response = await fetch(apiUrl(`/admin/pages/${encodeURIComponent(page.id || page.slug)}`), {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...getAuthHeaders(adminToken)
            },
            body: JSON.stringify(toApiPagePayload(page))
          });
          if (response.ok) {
            const savedPayload = await readOptionalJson(response);
            savedPages.push(normalizePageForEditableImport(savedPayload?.page || savedPayload?.data?.page || savedPayload?.data || page));
          } else {
            savedPages.push(page);
          }
        } catch {
          savedPages.push(page);
        }
      }

      const selectedPage = savedPages.find(isNormalWebsitePage) || savedPages[0];

      setPages(savedPages);
      setActivePageId(selectedPage.id);
      setFormPage(selectedPage);
      setActiveView("pages");
      setNotice(`Reimported ${savedPages.length} pages with corrected editable HTML paths.`);
    } catch (error) {
      if (String(error.message || "").includes("HTTP 401")) {
        clearAdminSession();
        setAdminToken("");
      }

      setNotice(error.message || "Failed to load Admin API pages.");
    }
  };

  const mainProgramsPage =
    pages.find((page) => page.slug === "programs-for-local-and-global-competence") ||
    pages.find((page) => page.menu === "Programs") ||
    formPage;

  const updateMainProgramsPage = (field, value) => {
    if (!requireAnyPortalAccess(["programs"], "Program page updates")) {
      return;
    }
    const nextPage = {
      ...mainProgramsPage,
      [field]: field === "slug" ? slugify(value) : value,
      updatedAt: todayIso(),
      updatedBy: "Content Editor"
    };

    setPages((current) => current.map((page) => (String(page.id) === String(nextPage.id) ? nextPage : page)));
    if (String(formPage.id) === String(nextPage.id)) {
      setFormPage(nextPage);
    }
  };

  const addProgramCategory = () => {
    if (!requireAnyPortalAccess(["programs"], "Program category creation")) {
      return;
    }
    const category = normalizeProgramCategory({
      name: "New Program Category",
      slug: `new-program-category-${programCategories.length + 1}`,
      status: "Draft",
      menuOrder: programCategories.length + 1
    });

    setProgramCategories((current) => [category, ...current]);
    setNotice("Program category created.");
  };

  const updateProgramCategory = (categoryId, field, value) => {
    if (!requireAnyPortalAccess(["programs"], "Program category updates")) {
      return;
    }
    const previousCategory = programCategories.find((category) => category.id === categoryId);
    setProgramCategories((current) =>
      current.map((category) => {
        if (category.id !== categoryId) {
          return category;
        }

        const nextCategory = {
          ...category,
          [field]:
            field === "featured"
              ? Boolean(value)
              : field === "programIds"
                ? Array.from(new Set((Array.isArray(value) ? value : []).map(String).filter(Boolean)))
                : value,
          updatedAt: todayIso()
        };

        if (field === "name" && category.slug === slugify(category.name)) {
          nextCategory.slug = slugify(value);
        }

        if (field === "slug") {
          nextCategory.slug = slugify(value);
        }

        if (field === "menuOrder") {
          nextCategory.menuOrder = Number(value || 1);
        }

        return nextCategory;
      })
    );

    const nextCategorySlug =
      field === "slug"
        ? slugify(value)
        : field === "name" && previousCategory?.slug === slugify(previousCategory.name)
          ? slugify(value)
          : "";
    if (nextCategorySlug && previousCategory && nextCategorySlug !== previousCategory.slug) {
      setPrograms((current) =>
        current.map((program) =>
          program.categorySlug === previousCategory.slug
            ? { ...program, categorySlug: nextCategorySlug, updatedAt: todayIso() }
            : program
        )
      );
    }
  };

  const updateProgramMegaMenuCategory = (categoryId, programIds) => {
    if (!requireAnyPortalAccess(["programs", "site-chrome"], "Programs mega-menu updates")) {
      return;
    }
    const normalizedIds = Array.from(
      new Set((Array.isArray(programIds) ? programIds : []).map(String).filter(Boolean))
    );
    const nextCategories = programCategories.map((category) =>
      category.id === categoryId
        ? { ...category, programIds: normalizedIds, updatedAt: todayIso() }
        : category
    );
    const updateHeaderPage = (page) => {
      if (!isMatchingSiteChromePage(page, "header")) return page;
      const currentHtml = getSiteChromeHtml(page);
      if (!currentHtml) return page;
      const nextHtml = updateProgramsMegaMenuMarkup(currentHtml, nextCategories, megaMenuPrograms);
      return createSiteChromePage("header", {
        ...page,
        bodyHtml: nextHtml,
        rawHtml: "",
        sections: [
          normalizeSection({
            id: page.sections?.[0]?.id,
            type: "Raw HTML",
            title: "Website Header Markup",
            html: nextHtml,
            body: nextHtml,
            layout: "Legacy HTML",
            visible: true
          })
        ]
      });
    };

    setProgramCategories(nextCategories);
    setPages((current) => current.map(updateHeaderPage));
    setFormPage((current) => updateHeaderPage(current));
    setNotice("Programs mega-menu assignments updated. Save Header to publish the generated navigation.");
  };

  const importLivePrograms = async () => {
    if (!requireAnyPortalAccess(["programs"], "Live program import")) {
      return;
    }

    try {
      const response = await fetch(LIVE_PROGRAMS_API_URL, {
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Live programs API is not available."));
      }

      const payload = await readOptionalJson(response);
      const sourcePrograms = Array.isArray(payload?.programs)
        ? payload.programs
        : Array.isArray(payload?.data?.programs)
          ? payload.data.programs
          : Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload)
              ? payload
              : [];

      if (!sourcePrograms.length) {
        setNotice("No live programs were returned by the public API.");
        return;
      }

      const importedPrograms = sourcePrograms.map(normalizeImportedProgram);
      const importedCategories = createProgramCategoriesFromImportedPrograms(sourcePrograms);
      const importedProgramPages = importedPrograms.map((program, index) =>
        normalizePage({
          ...createProgramPageFromProgram({ ...program, menuOrder: index + 1 }),
          id: `program-page-${program.slug}`,
          isLocalDraft: false,
          localOnly: false,
          pageSlug: program.slug
        })
      );
      const savedProgramPages = [];
      for (const page of importedProgramPages) {
        try {
          const existingPage = pages.find((entry) => entry.slug === page.slug);
          const response = await fetch(apiUrl(existingPage ? `/admin/pages/${encodeURIComponent(existingPage.id || existingPage.slug)}` : "/admin/pages"), {
            method: existingPage ? "PUT" : "POST",
            headers: {
              "Content-Type": "application/json",
              ...getAuthHeaders(adminToken)
            },
            body: JSON.stringify(toApiPagePayload({ ...existingPage, ...page, id: existingPage?.id || page.id }))
          });
          if (response.ok) {
            const payload = await readOptionalJson(response);
            savedProgramPages.push(normalizePage(payload?.page || payload?.data?.page || payload?.data || page));
          } else {
            savedProgramPages.push(page);
          }
        } catch {
          savedProgramPages.push(page);
        }
      }

      setProgramCategories((current) => {
        const nextBySlug = new Map(current.map((category) => [category.slug, normalizeProgramCategory(category)]));
        importedCategories.forEach((category) => {
          nextBySlug.set(category.slug, {
            ...(nextBySlug.get(category.slug) || {}),
            ...category,
            updatedAt: todayIso()
          });
        });
        return Array.from(nextBySlug.values()).sort((a, b) => Number(a.menuOrder || 0) - Number(b.menuOrder || 0));
      });

      setPrograms((current) => {
        const nextBySlug = new Map(current.map((program) => [program.slug, normalizeProgram(program)]));
        importedPrograms.forEach((program) => {
          nextBySlug.set(program.slug, {
            ...(nextBySlug.get(program.slug) || {}),
            ...program,
            pageSlug: program.slug,
            updatedAt: todayIso()
          });
        });
        return Array.from(nextBySlug.values()).sort((a, b) => a.title.localeCompare(b.title));
      });

      setPages((current) => {
        const nextBySlug = new Map(current.map((page) => [page.slug, normalizePage(page)]));
        savedProgramPages.forEach((page) => {
          nextBySlug.set(page.slug, {
            ...(nextBySlug.get(page.slug) || {}),
            ...page,
            updatedAt: todayIso()
          });
        });
        return Array.from(nextBySlug.values());
      });

      setNotice(`Imported ${importedPrograms.length} programs, ${importedCategories.length} categories, and ${savedProgramPages.length} program pages from the live website API.`);
    } catch (error) {
      setNotice(error.message || "Live program import failed.");
    }
  };

  const deleteProgramCategory = async (categoryId) => {
    if (!requireAnyPortalAccess(["programs"], "Program category deletion")) {
      return;
    }
    const category = programCategories.find((item) => item.id === categoryId);
    if (!category) {
      return;
    }

    const movedPrograms = programs.filter((program) => program.categorySlug === category.slug).length;
    const confirmed = await requestDangerConfirmation({
      title: "Delete program category?",
      message: "The category will be removed and its related programs will be moved into the default category.",
      details: [
        `Category: ${category.name}`,
        `Programs to reassign: ${movedPrograms}`
      ],
      verificationText: category.slug || category.name || "DELETE CATEGORY",
      finalLabel: "Delete Category"
    });
    if (!confirmed) {
      setNotice("Category delete cancelled.");
      return;
    }

    const uncategorized = programCategories.find((item) => item.slug === "undergraduate-programs") || programCategories[0];
    setPrograms((current) =>
      current.map((program) =>
        program.categorySlug === category.slug ? { ...program, categorySlug: uncategorized.slug, updatedAt: todayIso() } : program
      )
    );
    setProgramCategories((current) => current.filter((item) => item.id !== categoryId));
    setNotice("Category removed. Programs were moved to the default category.");
  };

  const addProgram = (categorySlug = "") => {
    if (!requireAnyPortalAccess(["programs"], "Program creation")) {
      return;
    }
    const program = normalizeProgram({
      title: "New Academic Program",
      slug: `new-academic-program-${programs.length + 1}`,
      categorySlug: categorySlug || programCategories[0]?.slug || "undergraduate-programs",
      status: "Draft"
    });

    setPrograms((current) => [program, ...current]);
    setNotice("Program created.");
  };

  const updateProgram = (programId, field, value) => {
    if (!requireAnyPortalAccess(["programs"], "Program updates")) {
      return;
    }
    setPrograms((current) =>
      current.map((program) => {
        if (program.id !== programId) {
          return program;
        }

        const nextProgram = {
          ...program,
          [field]: ["featured", "applicationOpen"].includes(field) ? Boolean(value) : value,
          updatedAt: todayIso()
        };

        if (field === "title" && program.slug === slugify(program.title)) {
          nextProgram.slug = slugify(value);
        }

        if (field === "slug") {
          nextProgram.slug = slugify(value);
        }

        return nextProgram;
      })
    );
  };

  const deleteProgram = async (programId) => {
    if (!requireAnyPortalAccess(["programs"], "Program deletion")) {
      return;
    }
    const targetProgram = programs.find((program) => program.id === programId);
    if (!targetProgram) {
      return;
    }

    const confirmed = await requestDangerConfirmation({
      title: "Delete program?",
      message: "This permanently removes the selected academic program record.",
      details: [
        `Program: ${targetProgram.title}`,
        `Slug: /${targetProgram.slug}`
      ],
      verificationText: targetProgram.slug || targetProgram.title || "DELETE PROGRAM",
      finalLabel: "Delete Program"
    });
    if (!confirmed) {
      setNotice("Program delete cancelled.");
      return;
    }

    setPrograms((current) => current.filter((program) => program.id !== programId));
    setProgramCategories((current) =>
      current.map((category) =>
        Array.isArray(category.programIds) && category.programIds.includes(String(programId))
          ? { ...category, programIds: category.programIds.filter((id) => id !== String(programId)), updatedAt: todayIso() }
          : category
      )
    );
    setNotice("Program removed.");
  };

  const saveAdminUser = async (userInput) => {
    if (!requireAnyPortalAccess(["users"], "User management")) {
      return null;
    }
    const isExistingUser = Boolean(userInput.id) && adminUsers.some((user) => String(user.id) === String(userInput.id));
    const response = await fetch(apiUrl(isExistingUser ? `/admin/users/${encodeURIComponent(userInput.id)}` : "/admin/users"), {
      method: isExistingUser ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(adminToken)
      },
      body: JSON.stringify({
        name: userInput.name,
        email: userInput.email,
        role: userInput.role,
        status: userInput.status,
        department: userInput.department,
        access: userInput.access,
        temporaryPassword: userInput.temporaryPassword,
        sendInvite: Boolean(userInput.sendInvite)
      })
    });

    if (!response.ok) {
      throw new Error(await readApiError(response, "User save failed."));
    }

    const payload = await readOptionalJson(response);
    const savedUser = normalizeAdminUser(payload?.user || payload?.data?.user || payload?.data || payload);

    setAdminUsers((current) => {
      const exists = current.some((user) => String(user.id) === String(savedUser.id));
      const nextUsers = exists
        ? current.map((user) => (String(user.id) === String(savedUser.id) ? savedUser : user))
        : [savedUser, ...current];
      storeAdminUsers(nextUsers);
      return nextUsers;
    });

    if (adminProfile && (String(adminProfile.id) === String(savedUser.id) || adminProfile.email === savedUser.email)) {
      setAdminProfile(savedUser);
      storeAdminProfile(savedUser);
    }

    const temporaryPassword = payload?.temporaryPassword;
    const inviteSent = Boolean(payload?.invite?.sent);
    setNotice(
      inviteSent
        ? "User saved and invitation email sent."
        : temporaryPassword
          ? `User saved. SMTP is not configured, temporary password: ${temporaryPassword}`
          : "User saved to the database."
    );
    return savedUser;
  };

  const sendAdminUserInvite = async (userId) => {
    if (!requireAnyPortalAccess(["users"], "User invitations")) {
      return null;
    }
    const response = await fetch(apiUrl(`/admin/users/${encodeURIComponent(userId)}/invite`), {
      method: "POST",
      headers: getAuthHeaders(adminToken)
    });

    if (!response.ok) {
      throw new Error(await readApiError(response, "Invite email failed."));
    }

    const payload = await readOptionalJson(response);
    const savedUser = normalizeAdminUser(payload?.user || payload?.data?.user || payload?.data || payload);
    setAdminUsers((current) => {
      const nextUsers = current.map((user) => (String(user.id) === String(savedUser.id) ? savedUser : user));
      storeAdminUsers(nextUsers);
      return nextUsers;
    });

    const temporaryPassword = payload?.temporaryPassword;
    setNotice(
      payload?.invite?.sent
        ? "Invitation email sent."
        : temporaryPassword
          ? `SMTP is not configured, temporary password: ${temporaryPassword}`
          : "Invite request completed."
    );
    return savedUser;
  };

  const deleteAdminUser = async (userId) => {
    if (!requireAnyPortalAccess(["users"], "User deletion")) {
      return;
    }
    if (adminProfile && String(adminProfile.id) === String(userId)) {
      setNotice("You cannot delete the currently signed-in user.");
      return;
    }

    const response = await fetch(apiUrl(`/admin/users/${encodeURIComponent(userId)}`), {
      method: "DELETE",
      headers: getAuthHeaders(adminToken)
    });

    if (!response.ok) {
      throw new Error(await readApiError(response, "User delete failed."));
    }

    setAdminUsers((current) => {
      const nextUsers = current.filter((user) => String(user.id) !== String(userId));
      storeAdminUsers(nextUsers);
      return nextUsers;
    });
    setNotice("User removed.");
  };

  const handleLogin = async ({ email, password }) => {
    const response = await fetch(apiUrl("/admin/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error(await readApiError(response, "Login failed."));
    }

    const payload = await response.json();
    const token = extractToken(payload);
    if (!token) {
      throw new Error("Login succeeded but no token was returned.");
    }

    const profile = extractAdminProfile(payload, email);
    rememberAdminSession(token, profile);
    setAdminToken(token);
    setAdminProfile(profile);
    setNotice("Logged in successfully.");
    setActiveView(getFirstAccessibleView(profile));
  };

  const handleLogout = () => {
    clearAdminSession();
    window.sessionStorage.removeItem(CRM_UI_STATE_KEY);
    setAdminToken("");
    setAdminProfile(null);
    setPages([]);
    setActivePageId("");
    setFormPage(emptyPage());
    setSelectedPageIds([]);
    setNotice("");
  };

  if (!adminToken) {
    return <LoginView onLogin={handleLogin} logoSrc={assets.logoOfficial} />;
  }

  if (isStandaloneEditor && !hasPortalAccess(adminProfile, "page-editor")) {
    return (
      <main className="login-screen">
        <section className="login-panel">
          <div className="login-brand">
            <img src={assets.logoOfficial} alt="Madda Walabu University" />
            <div>
              <span className="eyebrow">Access Restricted</span>
              <h1>Page editor access is not enabled for this account.</h1>
            </div>
          </div>
          <button className="primary-button" type="button" onClick={handleLogout}>
            <LogOut size={17} />
            <span>Logout</span>
          </button>
        </section>
      </main>
    );
  }

  if (isStandaloneEditor) {
    const standalonePage =
      pages.find((page) => String(page.id) === String(standaloneEditorPageId)) ||
      pages.find((page) => String(page.id) === String(activePageId));
    const editableStandalonePage =
      standalonePage && String(formPage.id) === String(standalonePage.id) ? formPage : standalonePage || formPage;

    return (
      <StandalonePageEditor
        allPages={pages}
        menuGroupChoices={liveMenuGroupChoices}
        mediaItems={mediaLibrary}
        mediaStorageMode={mediaStorageMode}
        page={editableStandalonePage}
        isLoading={!pages.length}
        notFound={pages.length > 0 && !standalonePage}
        notice={notice}
        setNotice={setNotice}
        updateField={updateField}
        updateSection={updateSection}
        addSection={addSection}
        duplicateSection={duplicateSection}
        moveSection={moveSection}
        removeSection={removeSection}
        savePage={savePage}
        updateActiveStatus={updateActiveStatus}
        deletePage={deletePage}
        uploadMediaFiles={uploadMediaFiles}
        deleteMediaItem={deleteMediaItem}
        copyMediaUrl={copyMediaUrl}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className={`crm-app ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className={`sidebar ${mobileNavOpen ? "open" : ""} ${sidebarCollapsed ? "collapsed" : ""}`}>
        <div className="brand">
          <img src={assets.logoOfficial} alt="Madda Walabu University" />
          <button
            className="icon-button nav-close"
            type="button"
            onClick={() => {
              if (window.innerWidth <= 860) {
                setMobileNavOpen(false);
                return;
              }
              setSidebarCollapsed((current) => !current);
            }}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <nav className="main-nav" aria-label="CRM navigation">
          {accessibleNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={activeView === item.id ? "active" : ""}
                title={item.label}
                aria-label={item.label}
                onClick={() => {
                  if (item.id === "site-chrome") {
                    openSiteChromeView(siteChromeTab);
                  } else if (item.id === "page-editor") {
                    if (activeView === "page-editor" && isLocalDraftPage(formPage)) {
                      setEditorTab("content");
                      setActiveView("page-editor");
                    } else {
                      createNewPage();
                    }
                  } else {
                    setActiveView(item.id);
                  }
                  setMobileNavOpen(false);
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-panel">
            <span>Website Status</span>
            <strong>Live content sync</strong>
            <p>{stats.published} published pages, {stats.review} in review.</p>
            <div className="mini-meter">
              <i style={{ width: `${Math.min(stats.averageSeo, 100)}%` }} />
            </div>
          </div>
          <button
            className="sidebar-logout"
            type="button"
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="workspace">
        {activeView !== "page-editor" && (
          <header className="topbar">
            <button
              className="icon-button mobile-toggle"
              type="button"
              onClick={() => {
                setSidebarCollapsed(false);
                if (window.innerWidth <= 860) {
                  setMobileNavOpen(true);
                }
              }}
              aria-label="Open sidebar"
            >
              <PanelLeftOpen size={19} />
            </button>
            <div>
              <span className="eyebrow">Madda Walabu University</span>
              <h1>CRM Portal</h1>
            </div>
            <div className="topbar-actions">
              <button className="ghost-button" type="button">
                <Bell size={17} />
                <span>Alerts</span>
              </button>
              {canCreatePages && (
                <button className="primary-button" type="button" onClick={createNewPage}>
                  <Plus size={17} />
                  <span>Add Page</span>
                </button>
              )}
            </div>
          </header>
        )}

        {notice && (
          <div className="notice" role="status">
            <CheckCircle2 size={18} />
            <span>{notice}</span>
            <button className="icon-button" type="button" onClick={() => dismissNoticeMessage(notice, setNotice)}>
              <X size={16} />
            </button>
          </div>
        )}

        {dangerDialog && (
          <DangerConfirmDialog
            {...dangerDialog}
            onCancel={() => resolveDangerConfirmation(false)}
            onConfirm={() => resolveDangerConfirmation(true)}
          />
        )}

        {activeView === "dashboard" && hasPortalAccess(adminProfile, "dashboard") && (
          <Dashboard
            pages={contentManagedPages}
            stats={stats}
            getThumbnail={getAutoThumbnailForPage}
            onCreateNewPage={canCreatePages ? createNewPage : undefined}
            onOpenPages={hasPortalAccess(adminProfile, "pages") ? () => setActiveView("pages") : undefined}
            onOpenPrograms={hasPortalAccess(adminProfile, "programs") ? () => setActiveView("programs") : undefined}
            onOpenBlogs={hasPortalAccess(adminProfile, "blogs") ? () => setActiveView("blogs") : undefined}
            onOpenRecentPage={(page) => {
              if (!hasPortalAccess(adminProfile, "page-editor")) return;
              if (!page) return;
              if (!isLocalDraftPage(page)) {
                openPageEditorTab(page.id);
                return;
              }
              setActivePageId(page.id);
              setEditorTab("content");
              setActiveView("page-editor");
            }}
          />
        )}

        {activeView === "pages" && hasPortalAccess(adminProfile, "pages") && (
          <PagesView
            pages={filteredPages}
            allPages={standardPages}
            menuGroupChoices={liveMenuGroupChoices}
            activePageId={activePageId}
            setActivePageId={setActivePageId}
            formPage={formPage}
            query={query}
            setQuery={setQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            menuFilter={menuFilter}
            setMenuFilter={setMenuFilter}
            sortKey={sortKey}
            setSortKey={setSortKey}
            selectedPageIds={selectedPageIds}
            toggleSelectedPage={toggleSelectedPage}
            toggleAllFiltered={toggleAllFiltered}
            bulkUpdateStatus={bulkUpdateStatus}
            bulkDeletePages={bulkDeletePages}
            bulkDuplicate={bulkDuplicate}
            exportAllPages={exportAllPages}
            importLivePublishedPages={importLivePublishedPages}
            importInputRef={importInputRef}
            importPages={importPages}
            createNewPage={createNewPage}
            deletePageById={deletePageById}
            openPageEditorView={openPageEditorView}
            pageStatusFilters={pageStatusFilters}
            getThumbnail={getAutoThumbnailForPage}
            getMenuReferenceLabel={getMenuReferenceLabel}
            getSeoScore={getSeoScore}
            formatDate={formatDate}
            isLocalDraftPage={isLocalDraftPage}
            openPageEditorTab={openPageEditorTab}
          />
        )}

        {/* {activeView === "other-pages" && hasPortalAccess(adminProfile, "other-pages") && (
          <OtherPagesView
            pages={standardPages}
            pageStatusFilters={pageStatusFilters}
            getThumbnail={getAutoThumbnailForPage}
            isLocalDraftPage={isLocalDraftPage}
            openPageEditorTab={openPageEditorTab}
            setActivePageId={setActivePageId}
            setActiveView={setActiveView}
            setEditorTab={setEditorTab}
            deletePageById={deletePageById}
          />
        )} */}

        {activeView === "page-editor" && hasPortalAccess(adminProfile, "page-editor") && (
          <PageEditor
            page={formPage}
            editableSrcDoc={pageEditorEditableSrcDoc}
            builderInitPayload={pageEditorBuilderInitPayload}
            builderInitRevision={pageEditorBuilderInitRevision}
            onPersistBuilderState={persistInAppPageEditorBuilderState}
            onEditableHtmlUpdate={handleInAppEditableHtmlUpdate}
            mediaItems={mediaLibrary}
            onUploadMediaFiles={uploadMediaFiles}
            onDeleteMedia={deleteMediaItem}
            setNotice={setNotice}
          />
        )}

        {activeView === "programs" && hasPortalAccess(adminProfile, "programs") && (
          <ProgramsManagementView
            categories={programCategories}
            programs={programs}
            megaMenuPrograms={megaMenuPrograms}
            programPages={programPages}
            mainPage={mainProgramsPage}
            openPageEditorTab={openPageEditorTab}
            createProgramPage={createProgramPage}
            deletePageById={deletePageById}
            addCategory={addProgramCategory}
            updateCategory={updateProgramCategory}
            updateMegaMenuCategory={updateProgramMegaMenuCategory}
            deleteCategory={deleteProgramCategory}
            addProgram={addProgram}
            importLivePrograms={importLivePrograms}
            updateProgram={updateProgram}
            deleteProgram={deleteProgram}
            pageStatusFilters={pageStatusFilters}
            statusOptions={statusOptions}
            mediaItems={mediaLibrary}
            logoSrc={assets.logoOfficial}
            getThumbnail={getAutoThumbnailForPage}
          />
        )}

        {activeView === "blogs" && hasPortalAccess(adminProfile, "blogs") && (
          <BlogPagesView
            pages={blogPages}
            pageStatusFilters={pageStatusFilters}
            getThumbnail={getAutoThumbnailForPage}
            isLocalDraftPage={isLocalDraftPage}
            openPageEditorTab={openPageEditorTab}
            setActivePageId={setActivePageId}
            setActiveView={setActiveView}
            setEditorTab={setEditorTab}
            deletePageById={deletePageById}
          />
        )}

        {activeView === "events" && hasPortalAccess(adminProfile, "events") && (
          <EventPagesView
            pages={eventPages}
            pageStatusFilters={pageStatusFilters}
            getThumbnail={getAutoThumbnailForPage}
            isLocalDraftPage={isLocalDraftPage}
            openPageEditorTab={openPageEditorTab}
            setActivePageId={setActivePageId}
            setActiveView={setActiveView}
            setEditorTab={setEditorTab}
            deletePageById={deletePageById}
          />
        )}

        {activeView === "builder" && hasPortalAccess(adminProfile, "page-editor") && (
          <BuilderView
            page={formPage}
            setActiveView={setActiveView}
            updateField={updateField}
            updateSection={updateSection}
            addSection={addSection}
            duplicateSection={duplicateSection}
            moveSection={moveSection}
            removeSection={removeSection}
            savePage={savePage}
          />
        )}

        {activeView === "media" && hasPortalAccess(adminProfile, "media") && (
          <MediaView
            mediaItems={mediaLibrary}
            mediaStorageMode={mediaStorageMode}
            selectedImage={formPage.heroImage}
            onSelect={(path) => {
              updateField("heroImage", path);
              setNotice("Hero image selected for the active page.");
            }}
            onUploadMedia={uploadMediaFiles}
            onDeleteMedia={deleteMediaItem}
            onCopyUrl={copyMediaUrl}
          />
        )}

        {activeView === "crm" && hasPortalAccess(adminProfile, "crm") && <CrmView />}

        {activeView === "users" && hasPortalAccess(adminProfile, "users") && (
          <UserManagementView
            users={adminUsers}
            activeAdmin={currentAdminUser}
            accessModules={accessModules}
            rolePresets={rolePresets}
            onSaveUser={saveAdminUser}
            onDeleteUser={deleteAdminUser}
            onSendInvite={sendAdminUserInvite}
            onSetNotice={setNotice}
          />
        )}

        {activeView === "settings" && hasPortalAccess(adminProfile, "settings") && <SettingsView logoSrc={assets.logoOfficial} />}

        {activeView === "site-chrome" && hasPortalAccess(adminProfile, "site-chrome") && (
          <SiteChromeView
            kind={siteChromeTab}
            page={activeSiteChromePage}
            config={getSiteChromeConfig(siteChromeTab)}
            snippetHtml={getSiteChromeHtml(activeSiteChromePage)}
            statusOptions={statusOptions}
            openSiteChromeView={openSiteChromeView}
            updateField={updateField}
            updateHtml={updateSiteChromeHtml}
            savePage={saveSiteChromePage}
            parseHeaderVisualModel={parseHeaderVisualModel}
            updateHeaderHtmlFromVisualModel={updateHeaderHtmlFromVisualModel}
            programCategories={programCategories}
            programs={megaMenuPrograms}
            updateProgramCategory={updateProgramMegaMenuCategory}
            availableMenuPages={contentManagedPages
              .filter((entry) => entry.status !== "Archived" && !isProgramPage(entry))
              .sort((a, b) => a.title.localeCompare(b.title))
              .map((entry) => ({
                id: String(entry.id),
                title: entry.title,
                href: entry.sourceUrl || getLiveRoutePath(entry),
                type: entry.type,
                menu: entry.menu
              }))}
            linkablePages={contentManagedPages
              .filter((entry) => entry.status !== "Archived" && !isProgramPage(entry))
              .sort((a, b) => a.title.localeCompare(b.title))
              .map((entry) => ({
                id: String(entry.id),
                title: entry.title,
                href: entry.sourceUrl || getLiveRoutePath(entry),
                type: entry.type
              }))}
            previewSourceUrl={getFetchableLiveAssetUrl(getSiteChromeConfig(siteChromeTab).sourceUrl)}
            buildSiteChromePreviewDocument={buildSiteChromePreviewDocument}
          />
        )}
      </main>
    </div>
  );
}

function StandalonePageEditor({
  allPages = [],
  menuGroupChoices = [],
  mediaItems = [],
  mediaStorageMode = "local",
  page,
  isLoading,
  notFound,
  notice,
  setNotice,
  updateField,
  updateSection,
  addSection,
  duplicateSection,
  moveSection,
  removeSection,
  savePage,
  updateActiveStatus,
  deletePage,
  uploadMediaFiles,
  deleteMediaItem,
  copyMediaUrl,
  onLogout
}) {
  const safePage = page && typeof page === "object" ? { ...emptyPage(), ...page, sections: Array.isArray(page.sections) ? page.sections : emptyPage().sections } : emptyPage();
  const [activeSectionId, setActiveSectionId] = useState(safePage.sections?.[0]?.id || "");
  const [canvasMode, setCanvasMode] = useState("exact");
  const [devicePreview, setDevicePreview] = useState("desktop");
  const [editableSourceHtml, setEditableSourceHtml] = useState("");
  const [editableStatus, setEditableStatus] = useState("idle");
  const [editableError, setEditableError] = useState("");
  const [htmlBuilderReady, setHtmlBuilderReady] = useState(false);
  const [selectedLiveElement, setSelectedLiveElement] = useState(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerQuery, setMediaPickerQuery] = useState("");
  const [selectedMediaId, setSelectedMediaId] = useState("");
  const mediaUploadInputRef = useRef(null);
  const editableFrameRef = useRef(null);
  const editedBodyRef = useRef("");
  const editedFullHtmlRef = useRef("");
  const htmlBuilderStateRequestRef = useRef(null);
  const latestHtmlBuilderPayloadRef = useRef(null);
  const pendingImageReplaceIdRef = useRef("");
  const livePageUrl = getLivePageUrl(safePage);
  const htmlBuilderSrc = `/visual-page-builder.html?pageId=${encodeURIComponent(safePage.id || safePage.slug || "new-page")}`;
  const htmlBuilderInitPayload = useMemo(() => buildHtmlVisualBuilderInitPayload(safePage), [
    safePage.id,
    safePage.title,
    safePage.slug,
    safePage.status,
    safePage.seoTitle,
    safePage.seoDescription,
    safePage.summary,
    safePage.bodyHtml,
    safePage.body_html,
    safePage.rawHtml,
    safePage.raw_html
  ]);

  useEffect(() => {
    latestHtmlBuilderPayloadRef.current = htmlBuilderInitPayload;
  }, [htmlBuilderInitPayload]);
  const activeSection =
    (safePage.sections || []).find((section) => String(section.id) === String(activeSectionId)) ||
    safePage.sections?.[0];

  const editableSrcDoc = useMemo(() => {
    if (!editableSourceHtml) return "";
    return buildEditableLiveDocument(
      {
        ...safePage,
        title: safePage.title,
        customCss: safePage.customCss || safePage.custom_css || ""
      },
      editableSourceHtml
    );
  }, [editableSourceHtml, safePage.id, safePage.title, safePage.customCss, safePage.custom_css]);

  const editorMediaItems = useMemo(() => {
    const query = mediaPickerQuery.trim().toLowerCase();
    if (!query) {
      return mediaItems;
    }
    return mediaItems.filter((media) =>
      [media.title, media.type, media.path]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [mediaItems, mediaPickerQuery]);

  const selectedMediaItem = useMemo(
    () => mediaItems.find((media) => String(media.id) === String(selectedMediaId)) || null,
    [mediaItems, selectedMediaId]
  );

  const requestHtmlBuilderState = () => new Promise((resolve, reject) => {
    const frameWindow = editableFrameRef.current?.contentWindow;
    if (!frameWindow) {
      reject(new Error("Visual builder iframe is not available yet."));
      return;
    }

    if (htmlBuilderStateRequestRef.current?.timeoutId) {
      window.clearTimeout(htmlBuilderStateRequestRef.current.timeoutId);
    }

    const timeoutId = window.setTimeout(() => {
      htmlBuilderStateRequestRef.current = null;
      reject(new Error("Visual builder did not respond in time."));
    }, 4000);

    htmlBuilderStateRequestRef.current = { resolve, reject, timeoutId };
    frameWindow.postMessage({ type: "MWU_HTML_BUILDER_REQUEST_STATE" }, "*");
  });

  const loadEditableHtml = async ({ force = false } = {}) => {
    const storedDocument = getStoredEditableDocument(safePage);
    const hasSavedEditableMarkup = hasPersistedEditableMarkup(safePage);

    if (!force && hasSavedEditableMarkup && storedDocument.fullHtml) {
      setEditableSourceHtml(storedDocument.fullHtml);
      editedBodyRef.current = storedDocument.bodyHtml;
      editedFullHtmlRef.current = storedDocument.fullHtml;
      setEditableStatus("ready");
      setEditableError("");
      return;
    }

    setEditableStatus("loading");
    setEditableError("");

    const candidates = getEditableFetchCandidates(safePage);
    const errors = [];

    for (const fetchPath of candidates) {
      try {
        const proxyResponse = await fetch(fetchPath, {
          headers: { Accept: "text/html" }
        });

        if (!proxyResponse.ok) {
          throw new Error(`${fetchPath} returned HTTP ${proxyResponse.status}`);
        }

        const html = await proxyResponse.text();
        if (!html || !/<body[\s>]/i.test(html)) {
          throw new Error(`${fetchPath} did not return a full HTML document`);
        }

        if (!looksLikeUsableHtmlDocument(html)) {
          throw new Error(`${fetchPath} returned a React/Vite app shell instead of editable page HTML`);
        }

        const bodyHtml = extractBodyHtml(html);
        setEditableSourceHtml(html);
        editedBodyRef.current = bodyHtml;
        editedFullHtmlRef.current = html;
        updateField("sourceUrl", livePageUrl);
        updateField("rawHtml", html);
        updateField("bodyHtml", bodyHtml);
        setEditableStatus("ready");
        setEditableError("");
        setNotice(`Fetched editable HTML from ${fetchPath.includes("/legacy/") ? "the legacy static page" : "a server-rendered live route"}. Local /public/assets files are used for CSS/images. You can edit text/images directly and press Save.`);
        return;
      } catch (error) {
        errors.push(error.message || String(error));
      }
    }

    if (hasSavedEditableMarkup && storedDocument.fullHtml) {
      setEditableSourceHtml(storedDocument.fullHtml);
      editedBodyRef.current = storedDocument.bodyHtml;
      editedFullHtmlRef.current = storedDocument.fullHtml;
      setEditableStatus("ready");
      setEditableError(`Live/legacy fetch failed, using stored HTML. ${errors.join(" | ")}`);
      return;
    }

    setEditableStatus("error");
    setEditableError(
      `${errors.join(" | ")}. Make sure your original website files are present in public/assets, especially public/assets/css and public/assets/img. Local Vite should proxy /__live_page only for HTML fetch and /__live_asset only for non-assets fallback.`
    );
  };

  useEffect(() => {
    if (!safePage.sections?.some((section) => String(section.id) === String(activeSectionId))) {
      setActiveSectionId(safePage.sections?.[0]?.id || "");
    }
  }, [activeSectionId, safePage.id, safePage.sections]);

  useEffect(() => {
    const storedDocument = getStoredEditableDocument(safePage);
    setHtmlBuilderReady(false);
    setEditableSourceHtml("");
    setEditableStatus("idle");
    setEditableError("");
    setSelectedLiveElement(null);
    setMediaPickerOpen(false);
    setMediaPickerQuery("");
    setSelectedMediaId("");
    editedBodyRef.current = storedDocument.bodyHtml;
    editedFullHtmlRef.current = storedDocument.fullHtml;
    if (htmlBuilderStateRequestRef.current?.timeoutId) {
      window.clearTimeout(htmlBuilderStateRequestRef.current.timeoutId);
    }
    htmlBuilderStateRequestRef.current = null;
  }, [safePage.id]);

  const openMediaLibraryPicker = (elementId) => {
    const nextElementId = elementId || selectedLiveElement?.id || "";
    if (!nextElementId) {
      setNotice("Select an image inside Editable Blocks first.");
      return;
    }
    pendingImageReplaceIdRef.current = String(nextElementId);
    setMediaPickerQuery("");
    setSelectedMediaId(
      mediaItems.find((media) => media.path === (selectedLiveElement?.src || ""))?.id ||
      mediaItems[0]?.id ||
      ""
    );
    setMediaPickerOpen(true);
  };

  useEffect(() => {
    if (!selectedMediaId && editorMediaItems.length) {
      setSelectedMediaId(editorMediaItems[0].id);
      return;
    }
    if (selectedMediaId && !mediaItems.some((media) => String(media.id) === String(selectedMediaId))) {
      setSelectedMediaId(editorMediaItems[0]?.id || "");
    }
  }, [editorMediaItems, mediaItems, selectedMediaId]);

  const applyMediaLibraryImage = async (mediaPath) => {
    const elementId = pendingImageReplaceIdRef.current || selectedLiveElement?.id || "";
    if (!mediaPath || !elementId) {
      setNotice("Select an image inside Editable Blocks first.");
      return;
    }

    const liveAssetUrl = normalizeLiveAssetUrl(mediaPath);
    if (liveAssetUrl) {
      const isReachable = await canLoadRemoteImage(liveAssetUrl);
      if (!isReachable) {
        setNotice(`Image not applied: ${liveAssetUrl} is not available on the live website yet. Deploy the asset first or use an already hosted image URL.`);
        return;
      }
    }

    setSelectedLiveElement((current) => (current ? { ...current, src: mediaPath } : current));
    editableFrameRef.current?.contentWindow?.postMessage({
      type: "MWU_REPLACE_IMAGE_SOURCE",
      elementId,
      src: mediaPath
    }, "*");
    setMediaPickerOpen(false);
    setNotice("Image updated from Media Library. Press Save to store the selected media URL.");
  };

  const handleMediaUpload = async (event) => {
    const files = event.target.files;
    if (!files?.length) {
      return;
    }
    try {
      const uploaded = await uploadMediaFiles(files);
      if (uploaded[0]) {
        setSelectedMediaId(uploaded[0].id);
      }
    } finally {
      event.target.value = "";
    }
  };

  const handleDeleteSelectedMedia = async () => {
    if (!selectedMediaItem) {
      setNotice("Select a media item first.");
      return;
    }

    const deleted = await deleteMediaItem(selectedMediaItem.id);
    if (deleted) {
      setSelectedMediaId("");
    }
  };

  const applySelectedMedia = () => {
    if (!selectedMediaItem) {
      setNotice("Select a media item first.");
      return;
    }
    applyMediaLibraryImage(selectedMediaItem.path);
  };

  useEffect(() => {
    if (canvasMode !== "editable" || !htmlBuilderReady) {
      return;
    }

    editableFrameRef.current?.contentWindow?.postMessage({
      type: "MWU_HTML_BUILDER_INIT",
      payload: latestHtmlBuilderPayloadRef.current || htmlBuilderInitPayload
    }, "*");
  }, [canvasMode, htmlBuilderReady, safePage.id]);

  useEffect(() => {
    const handleMessage = (event) => {
      const data = event.data || {};
      if (data.type === "MWU_HTML_BUILDER_READY") {
        setHtmlBuilderReady(true);
        setEditableStatus("ready");
        setEditableError("");
        return;
      }

      if (data.type === "MWU_HTML_BUILDER_STATE") {
        const pendingRequest = htmlBuilderStateRequestRef.current;
        if (pendingRequest?.timeoutId) {
          window.clearTimeout(pendingRequest.timeoutId);
        }
        htmlBuilderStateRequestRef.current = null;
        pendingRequest?.resolve?.(data);
        if (data.saveMode === "draft" || data.saveMode === "publish") {
          persistHtmlBuilderState({ preventDefault() {} }, data, data.saveMode).catch((error) => {
            setNotice(error?.message || "Unable to save the visual builder page.");
          });
        }
        return;
      }

      if (data.type === "MWU_LIVE_HTML_READY") {
        setEditableStatus("ready");
        return;
      }

      if (data.type === "MWU_ELEMENT_SELECTED") {
        setSelectedLiveElement(data.element || null);
        return;
      }

      if (data.type === "MWU_REQUEST_IMAGE_PICKER") {
        const elementId = data.elementId || selectedLiveElement?.id || "";
        if (!elementId) {
          setNotice("Select an image inside Editable Blocks first.");
          return;
        }
        openMediaLibraryPicker(elementId);
        return;
      }

      if (data.type !== "MWU_LIVE_HTML_UPDATED") {
        return;
      }

      const bodyHtml = restoreLiveAssetUrls(data.bodyHtml || "");
      const fullHtml = restoreLiveAssetUrls(data.fullHtml || mergeBodyIntoHtml(editableSourceHtml || safePage.rawHtml || safePage.raw_html || "", bodyHtml));
      editedBodyRef.current = bodyHtml;
      editedFullHtmlRef.current = fullHtml;
      updateField("bodyHtml", bodyHtml);
      updateField("rawHtml", fullHtml);
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      if (htmlBuilderStateRequestRef.current?.timeoutId) {
        window.clearTimeout(htmlBuilderStateRequestRef.current.timeoutId);
      }
      htmlBuilderStateRequestRef.current = null;
    };
  }, [editableSourceHtml, openMediaLibraryPicker, safePage.rawHtml, safePage.raw_html, persistHtmlBuilderState, selectedLiveElement?.id, updateField]);

  const applyLiveElementStyle = (field, value) => {
    if (!selectedLiveElement?.id) {
      setNotice("Select an element inside Editable Blocks first.");
      return;
    }

    setSelectedLiveElement((current) => {
      if (!current) return current;
      return {
        ...current,
        src: field === "src" ? value : current.src,
        url: field === "url" ? (value || "#") : current.url,
        styles: {
          ...(current.styles || {}),
          [field]: value
        }
      };
    });

    editableFrameRef.current?.contentWindow?.postMessage({
      type: "MWU_APPLY_ELEMENT_STYLE",
      elementId: selectedLiveElement.id,
      field,
      value
    }, "*");
  };

  const duplicateLiveElement = () => {
    if (!selectedLiveElement?.id) {
      setNotice("Select a section, image, text block, or widget inside Editable Blocks first.");
      return;
    }

    editableFrameRef.current?.contentWindow?.postMessage({
      type: "MWU_DUPLICATE_SELECTED_ELEMENT",
      elementId: selectedLiveElement.id
    }, "*");
    setNotice("Duplicated selected live element.");
  };

  const deleteLiveElement = () => {
    if (!selectedLiveElement?.id) {
      setNotice("Select a duplicated section or any live element inside Editable Blocks first.");
      return;
    }

    editableFrameRef.current?.contentWindow?.postMessage({
      type: "MWU_DELETE_SELECTED_ELEMENT",
      elementId: selectedLiveElement.id
    }, "*");
    setSelectedLiveElement(null);
    setNotice("Deleted selected live element. Press Save to update the database.");
  };

  const openImageReplacePicker = () => {
    if (!selectedLiveElement?.id || selectedLiveElement?.type !== "image") {
      setNotice("Select an image inside Editable Blocks first.");
      return;
    }
    openMediaLibraryPicker(selectedLiveElement.id);
  };

  const addLayoutPreset = (preset) => {
    preset.sections.forEach((type) => addSection(type));
    setNotice(`Added ${preset.title} sections.`);
  };

  async function persistHtmlBuilderState(event, builderState, saveMode = "draft") {
    const snapshot = builderState?.snapshot || {};
    const snapshotPageSettings = snapshot.pageSettings || {};
    const publishedHtml = String(builderState?.publishedHtml || "").trim();

    if (!publishedHtml) {
      setNotice("Visual builder returned no HTML to save.");
      return;
    }

    const persistedBodyHtml = `${serializeHtmlVisualBuilderSnapshot(snapshot)}${extractBodyHtml(publishedHtml)}`;
    const extractedCustomCss = extractInlineStylesFromHtmlDocument(publishedHtml);
    const nextTitle = snapshotPageSettings.title || safePage.title;
    const nextSlug = slugify(snapshotPageSettings.slug || safePage.slug || nextTitle);
    const requestedStatus = saveMode === "publish"
      ? "Published"
      : titleCaseStatus(snapshotPageSettings.status || "Draft");
    const nextStatus = requestedStatus === "Published" && saveMode !== "publish" ? "Draft" : requestedStatus;
    const pageOverride = {
      builderKind: "visual",
      visualBuilder: snapshot,
      title: nextTitle,
      slug: nextSlug,
      status: nextStatus,
      seoTitle: snapshotPageSettings.seoTitle || safePage.seoTitle || nextTitle,
      seoDescription: snapshotPageSettings.seoDescription || safePage.seoDescription || "",
      bodyHtml: persistedBodyHtml,
      rawHtml: publishedHtml,
      customCss: extractedCustomCss,
      sections: [
        normalizeSection({
          id: safePage.sections?.[0]?.id,
          type: "Raw HTML",
          title: nextTitle || "Page Markup",
          html: persistedBodyHtml,
          body: persistedBodyHtml,
          layout: "Legacy HTML",
          visible: true
        })
      ]
    };

    editedBodyRef.current = persistedBodyHtml;
    editedFullHtmlRef.current = publishedHtml;
    updateField("builderKind", pageOverride.builderKind);
    updateField("visualBuilder", pageOverride.visualBuilder);
    updateField("title", pageOverride.title);
    updateField("slug", pageOverride.slug);
    updateField("status", pageOverride.status);
    updateField("seoTitle", pageOverride.seoTitle);
    updateField("seoDescription", pageOverride.seoDescription);
    updateField("bodyHtml", persistedBodyHtml);
    updateField("rawHtml", publishedHtml);
    updateField("customCss", extractedCustomCss);
    await savePage(event, pageOverride);
  }

  const saveEditablePage = async (event) => {
    if (canvasMode === "editable") {
      event?.preventDefault?.();
      if (!htmlBuilderReady) {
        setNotice("Visual builder is still loading. Wait a moment and try saving again.");
        return;
      }

      try {
        const builderState = await requestHtmlBuilderState();
        await persistHtmlBuilderState(event, builderState, "draft");
      } catch (error) {
        setNotice(error?.message || "Unable to read the visual builder state.");
      }
      return;
    }

    const pendingBodyHtml = editedBodyRef.current || safePage.bodyHtml || safePage.body_html || "";
    if (hasEmbeddedImageData(pendingBodyHtml)) {
      event?.preventDefault?.();
      setNotice("Save blocked: the page still contains embedded base64 image data. Replace it with a website media item or another hosted image URL first.");
      return;
    }

    const pageOverride = {};
    if (editedBodyRef.current) {
      pageOverride.bodyHtml = editedBodyRef.current;
      updateField("bodyHtml", editedBodyRef.current);
    }
    if (editedFullHtmlRef.current) {
      // Keep the full HTML in local editor state, but do not persist the full document back to the API.
      pageOverride.rawHtml = "";
      updateField("rawHtml", editedFullHtmlRef.current);
    }
    if (editedBodyRef.current) {
      pageOverride.sections = [
        normalizeSection({
          id: safePage.sections?.[0]?.id,
          type: "Raw HTML",
          title: safePage.title || "Page Markup",
          html: editedBodyRef.current,
          body: editedBodyRef.current,
          layout: "Legacy HTML",
          visible: true
        })
      ];
    }
    savePage(event, pageOverride);
  };

  if (isLoading) {
    return (
      <div className="standalone-editor loading">
        <div className="standalone-loading">
          <img src={assets.logoOfficial} alt="Madda Walabu University" />
          <strong>Loading page editor</strong>
          <span>Fetching live page content from Admin API.</span>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="standalone-editor loading">
        <div className="standalone-loading">
          <img src={assets.logoOfficial} alt="Madda Walabu University" />
          <strong>Page not found</strong>
          <span>The selected page was not returned by the Admin API.</span>
          <button className="primary-button" type="button" onClick={() => { window.location.href = getCrmUrl(); }}>
            <ChevronRight size={17} />
            <span>Back to CRM</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="standalone-editor" onSubmit={saveEditablePage}>
      <header className="standalone-topbar">
        <div className="standalone-brand">
          <div>
            <span className="eyebrow">Elementor Style Page Editor</span>
            <h1>{safePage.title}</h1>
          </div>
        </div>
        <div className="standalone-actions">
          <StatusPill status={safePage.status} />
          <button className="ghost-button" type="button" onClick={() => { window.location.href = getCrmUrl(); }}>
            <ChevronRight size={17} />
            <span>CRM</span>
          </button>
          <button className="ghost-button" type="button" onClick={onLogout}>
            <LogOut size={17} />
            <span>Logout</span>
          </button>
          <button className="primary-button" type="submit">
            <Save size={17} />
            <span>Save</span>
          </button>
        </div>
      </header>

      {notice && (
        <div className="standalone-notice" role="status">
          <CheckCircle2 size={17} />
          <span>{notice}</span>
          <button className="icon-button" type="button" onClick={() => dismissNoticeMessage(notice, setNotice)}>
            <X size={15} />
          </button>
        </div>
      )}

      <div className="standalone-shell">
        <main className="standalone-canvas">
          <div className="standalone-canvas-toolbar">
            <div>
              <span className="eyebrow">Canvas</span>
              <strong>{canvasMode === "exact" ? "Exact live website" : "Visual HTML Builder"}</strong>
              <small>{livePageUrl}</small>
            </div>
            <div className="standalone-canvas-tools">
              <div className="mode-switcher">
                <button type="button" className={canvasMode === "exact" ? "active" : ""} onClick={() => setCanvasMode("exact")}>Exact Live Design</button>
                <button type="button" className={canvasMode === "editable" ? "active" : ""} onClick={() => setCanvasMode("editable")}>Visual Builder</button>
              </div>
              <div className="device-switcher">
                {["desktop", "tablet", "mobile"].map((device) => (
                  <button key={device} type="button" className={devicePreview === device ? "active" : ""} onClick={() => setDevicePreview(device)}>{device}</button>
                ))}
              </div>
              <a className="ghost-button" href={livePageUrl} target="_blank" rel="noreferrer">Open Live Page</a>
            </div>
          </div>

          {canvasMode === "exact" && (
            <div className={`standalone-exact-frame device-${devicePreview}`}>
              <iframe
                title={`${safePage.title} exact live website`}
                src={livePageUrl}
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
              />
            </div>
          )}

          {canvasMode === "editable" && (
            <div className={`standalone-exact-frame standalone-editable-frame device-${devicePreview}`}>
              {!htmlBuilderReady && (
                <div className="editable-loading-overlay">
                  <strong>Loading visual builder...</strong>
                  <span>Opening your HTML page editor and syncing the saved builder state.</span>
                </div>
              )}
              <iframe
                ref={editableFrameRef}
                title={`${safePage.title} visual builder`}
                src={htmlBuilderSrc}
                sandbox="allow-same-origin allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox"
              />
            </div>
          )}
        </main>

        <aside className="standalone-inspector">
          <div className="inspector-card">
            <span className="eyebrow">Page Settings</span>
            <Field label="Page Title">
              <input value={safePage.title} onChange={(event) => updateField("title", event.target.value)} />
            </Field>
            <Field label="URL Slug">
              <input value={safePage.slug} onChange={(event) => updateField("slug", event.target.value)} />
            </Field>
            <Field label="Source URL">
              <input value={safePage.sourceUrl || safePage.source_url || livePageUrl} onChange={(event) => updateField("sourceUrl", event.target.value)} />
            </Field>
            <Field label="Navigation Group">
              <select value={safePage.menu || ""} onChange={(event) => updateField("menu", event.target.value)}>
                {menuGroupChoices.map((group) => (
                  <option key={group.value} value={group.value}>{group.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Main Page">
              <select value={safePage.parentSlug || ""} onChange={(event) => updateField("parentSlug", event.target.value)}>
                <option value="">Default - main page</option>
                {allPages
                  .filter((item) => String(item.id) !== String(safePage.id))
                  .filter((item) => !item.parentSlug)
                  .sort((a, b) => a.title.localeCompare(b.title))
                  .map((item) => (
                    <option key={item.id} value={item.slug}>{item.title}</option>
                  ))}
              </select>
            </Field>
            <Field label="Navigation Order">
              <input type="number" min="1" value={safePage.menuOrder || 1} onChange={(event) => updateField("menuOrder", event.target.value)} />
            </Field>
            <div className="field-grid one">
              <Field label="Status">
                <select value={safePage.status} onChange={(event) => updateField("status", event.target.value)}>
                  {statusOptions.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </Field>
              <Field label="Page Type">
                <select value={safePage.type} onChange={(event) => updateField("type", event.target.value)}>
                  {pageTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="block-actions">
              <button className="ghost-button" type="button" onClick={() => updateActiveStatus("Published")}>
                <Send size={16} />
                <span>Publish</span>
              </button>
              <button className="ghost-button" type="button" onClick={() => updateActiveStatus("Archived")}>
                <Archive size={16} />
                <span>Archive</span>
              </button>
            </div>
          </div>

          <div className="inspector-card">
            <span className="eyebrow">Visual Builder</span>
            <h3>HTML Editor Active</h3>
            <p className="inspector-note">
              Drag/drop, widget controls, and visual styling now run inside the standalone HTML builder. Use the Save button above to persist the builder output back through the existing React/API flow.
            </p>
            <div className="block-actions vertical">
              <button className="ghost-button" type="button" onClick={() => setCanvasMode("editable")}>
                <Pencil size={16} />
                <span>Open HTML Builder</span>
              </button>
              <button className="ghost-button" type="button" onClick={() => editableFrameRef.current?.contentWindow?.location.reload()}>
                <Download size={16} />
                <span>Reload Builder</span>
              </button>
            </div>
          </div>

          <div className="inspector-card">
            <span className="eyebrow">Saved Builder Output</span>
            <p className="inspector-note">
              The HTML builder saves rendered page markup into `bodyHtml` and its generated stylesheet into `customCss`. The embedded builder snapshot is preserved in the saved markup so the same page reopens in visual mode.
            </p>
            <div className="block-actions vertical">
              <button className="ghost-button" type="button" onClick={() => editableFrameRef.current?.contentWindow?.location.reload()}>
                <Download size={16} />
                <span>Reload HTML Builder</span>
              </button>
              <button className="ghost-button" type="button" onClick={() => setCanvasMode("editable")}>
                <Pencil size={16} />
                <span>Open Visual Editing</span>
              </button>
            </div>
            <Field label="Stored body HTML">
              <textarea rows="7" value={safePage.bodyHtml || ""} onChange={(event) => updateField("bodyHtml", event.target.value)} />
            </Field>
            <Field label="Custom CSS">
              <textarea rows="5" value={safePage.customCss || ""} onChange={(event) => updateField("customCss", event.target.value)} placeholder="CSS injected into this editable page" />
            </Field>
          </div>

          <div className="inspector-card">
            <span className="eyebrow">Optional CRM Blocks</span>
            <div className="elementor-button-grid compact">
              {sectionTypes.map((type) => (
                <button key={type} type="button" onClick={() => addSection(type)}>
                  <LayoutTemplate size={15} />
                  <span>{type}</span>
                </button>
              ))}
            </div>
            <div className="layout-preset-list compact">
              {layoutPresets.map((preset) => (
                <button key={preset.id} type="button" onClick={() => addLayoutPreset(preset)}>
                  <strong>{preset.title}</strong>
                  <small>{preset.detail}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="inspector-card">
            <span className="eyebrow">Active CRM Section</span>
            <h3>{activeSection?.title || "Select a section"}</h3>
            {activeSection && (
              <div className="inspector-fields">
                <Field label="Section Type">
                  <select value={activeSection.type} onChange={(event) => updateSection(activeSection.id, "type", event.target.value)}>
                    {sectionTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Section HTML">
                  <textarea rows="5" value={activeSection.html || ""} onChange={(event) => updateSection(activeSection.id, "html", event.target.value)} />
                </Field>
                <label className="toggle-field">
                  <input
                    type="checkbox"
                    checked={activeSection.visible !== false}
                    onChange={(event) => updateSection(activeSection.id, "visible", event.target.checked)}
                  />
                  <span>Visible in CRM blocks</span>
                </label>
                <div className="block-actions vertical">
                  <button className="ghost-button" type="button" onClick={() => duplicateSection(activeSection.id)}>
                    <Copy size={16} />
                    <span>Duplicate Section</span>
                  </button>
                  <button className="danger-button" type="button" onClick={() => removeSection(activeSection.id)}>
                    <Trash2 size={16} />
                    <span>Delete Section</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="inspector-card danger-zone compact">
            <span className="eyebrow">Database Page</span>
            <button className="danger-button" type="button" onClick={deletePage}>
              <Trash2 size={16} />
              <span>Delete Permanently</span>
            </button>
          </div>
        </aside>
      </div>
      {mediaPickerOpen && (
        <div className="standalone-media-picker" role="dialog" aria-modal="true" aria-label="Media library picker">
          <input
            ref={mediaUploadInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={handleMediaUpload}
          />
          <button
            className="standalone-media-picker-backdrop"
            type="button"
            aria-label="Close media picker"
            onClick={() => setMediaPickerOpen(false)}
          />
          <div className="standalone-media-picker-panel">
            <div className="standalone-media-picker-head">
              <div>
                <span className="eyebrow">Media Library</span>
                <h2>Select Existing Media URL</h2>
              </div>
              <div className="standalone-media-picker-head-actions">
                <button className="ghost-button" type="button" onClick={() => mediaUploadInputRef.current?.click()}>
                  <Upload size={16} />
                  <span>Upload</span>
                </button>
                <button
                  className="standalone-media-picker-close"
                  type="button"
                  onClick={() => setMediaPickerOpen(false)}
                  aria-label="Close media picker"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="standalone-media-picker-toolbar">
              <input
                type="search"
                value={mediaPickerQuery}
                onChange={(event) => setMediaPickerQuery(event.target.value)}
                placeholder="Search media by title, type, or URL"
              />
              <p>{mediaStorageMode === "api" ? "Choose a saved website media item. Uploaded files are stored on the website and written into the page markup as public URLs." : "Choose a saved media item. Uploaded browser-only images use data URLs and may still be blocked on save until a backend media endpoint exists."}</p>
            </div>
            <div className="standalone-media-picker-body">
              <div className="standalone-media-picker-grid">
                {editorMediaItems.map((media) => (
                  <button
                    key={media.id}
                    type="button"
                    className={selectedMediaId === media.id ? "media-card active" : "media-card"}
                    onClick={() => setSelectedMediaId(media.id)}
                  >
                    <img src={media.path} alt={media.title} />
                    <span>{media.type}</span>
                    <strong>{media.title}</strong>
                    <small>{media.dimensions || media.size}</small>
                  </button>
                ))}
                {!editorMediaItems.length && (
                  <div className="standalone-media-picker-empty">
                    <strong>No matching media found.</strong>
                    <span>Upload a new image or use the Media page to add more assets.</span>
                  </div>
                )}
              </div>
              <aside className="standalone-media-sidebar">
                {selectedMediaItem ? (
                  <>
                    <div className="standalone-media-sidebar-preview">
                      <img src={selectedMediaItem.path} alt={selectedMediaItem.title} />
                    </div>
                    <div className="standalone-media-sidebar-meta">
                      <span className="eyebrow">Image Details</span>
                      <h3>{selectedMediaItem.title}</h3>
                      <dl className="standalone-media-meta-list">
                        <div>
                          <dt>Upload date</dt>
                          <dd>{selectedMediaItem.uploadedAt || "Unknown"}</dd>
                        </div>
                        <div>
                          <dt>Name</dt>
                          <dd>{selectedMediaItem.title}</dd>
                        </div>
                        <div>
                          <dt>Size</dt>
                          <dd>{selectedMediaItem.size || "Unknown"}</dd>
                        </div>
                        <div>
                          <dt>Dimensions</dt>
                          <dd>{selectedMediaItem.dimensions || "Unknown"}</dd>
                        </div>
                        <div>
                          <dt>URL</dt>
                          <dd className="url">{selectedMediaItem.path}</dd>
                        </div>
                      </dl>
                      <div className="standalone-media-sidebar-actions">
                        <button className="ghost-button" type="button" onClick={() => copyMediaUrl(selectedMediaItem.path)}>
                          <Copy size={16} />
                          <span>Copy URL</span>
                        </button>
                        <button className="danger-button" type="button" onClick={handleDeleteSelectedMedia}>
                          <Trash2 size={16} />
                          <span>Delete</span>
                        </button>
                        <button className="primary-button" type="button" onClick={applySelectedMedia}>
                          <Image size={16} />
                          <span>Use Image</span>
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="standalone-media-picker-empty sidebar">
                    <strong>Select a media item</strong>
                    <span>Its upload date, size, dimensions, and URL will appear here.</span>
                  </div>
                )}
              </aside>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

const numericStyleDefaults = {
  fontSize: "16px",
  lineHeight: "1",
  width: "100%",
  height: "320px",
  maxWidth: "100%",
  margin: "0px",
  marginTop: "0px",
  marginRight: "0px",
  marginBottom: "0px",
  marginLeft: "0px",
  padding: "0px",
  paddingTop: "0px",
  paddingRight: "0px",
  paddingBottom: "0px",
  paddingLeft: "0px",
  zIndex: "0",
  top: "0px",
  right: "0px",
  bottom: "0px",
  left: "0px",
  opacity: "1",
  borderWidth: "0px",
  borderTopWidth: "0px",
  borderRightWidth: "0px",
  borderBottomWidth: "0px",
  borderLeftWidth: "0px",
  borderRadius: "0px",
  borderTopLeftRadius: "0px",
  borderTopRightRadius: "0px",
  borderBottomRightRadius: "0px",
  borderBottomLeftRadius: "0px",
  objectPosition: "50% 50%"
};

const adjustCssNumericValue = (value, delta, fallback = "0px") => {
  const source = String(value || "").trim() || fallback;
  const match = source.match(/-?\d+(\.\d+)?/);
  if (!match) {
    return fallback;
  }

  const number = Number(match[0]);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  const nextNumber = Number.isInteger(number) ? number + delta : Math.round((number + delta) * 100) / 100;
  return `${source.slice(0, match.index)}${nextNumber}${source.slice(match.index + match[0].length)}`;
};

const cssColorToHex = (value = "") => {
  const color = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }

  const rgb = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!rgb) return "#000000";

  return `#${[rgb[1], rgb[2], rgb[3]]
    .map((part) => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, "0"))
    .join("")}`;
};

function ColorStyleInput({ value, onChange, placeholder = "#000000" }) {
  return (
    <div className="color-style-input">
      <input
        className="color-style-swatch"
        type="color"
        value={cssColorToHex(value)}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Pick color"
      />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  );
}

function NumericStyleInput({ value, onChange, placeholder, fallback = "0px" }) {
  const step = (delta) => {
    onChange(adjustCssNumericValue(value, delta, fallback));
  };

  return (
    <div className="style-stepper">
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      <div className="style-stepper-buttons">
        <button type="button" aria-label="Increase value by 1" onClick={() => step(1)}>
          <ArrowUp size={13} />
        </button>
        <button type="button" aria-label="Decrease value by 1" onClick={() => step(-1)}>
          <ArrowDown size={13} />
        </button>
      </div>
    </div>
  );
}

function LiveElementInspector({ selectedElement, canvasMode, onStartEditing, onRefreshHtml, onApplyStyle, onDuplicateElement, onDeleteElement, onReplaceImage }) {
  const styles = selectedElement?.styles || {};
  const valueOf = (field) => styles[field] || "";
  const apply = (field) => (event) => onApplyStyle(field, event.target.value);
  const applyValue = (field) => (value) => onApplyStyle(field, value);
  const numericInput = (field, placeholder) => (
    <NumericStyleInput
      value={valueOf(field)}
      onChange={applyValue(field)}
      placeholder={placeholder}
      fallback={numericStyleDefaults[field] || "0px"}
    />
  );
  const colorInput = (field, placeholder) => (
    <ColorStyleInput value={valueOf(field)} onChange={applyValue(field)} placeholder={placeholder} />
  );
  const selectedFontValue = googleFontOptions.some((font) => font.value === valueOf("fontFamily")) ? valueOf("fontFamily") : "custom";

  if (canvasMode !== "editable") {
    return (
      <div className="inspector-card">
        <span className="eyebrow">Element Settings</span>
        <h3>Switch to Editable Blocks</h3>
        <p className="inspector-note">
          Elementor-style settings work inside Editable Blocks. Open it, then click any section, text, image, or widget.
        </p>
        <div className="block-actions vertical">
          <button className="primary-button" type="button" onClick={onStartEditing}>
            <Pencil size={16} />
            <span>Start Elementor Editing</span>
          </button>
          <button className="ghost-button" type="button" onClick={onRefreshHtml}>
            <Download size={16} />
            <span>Refresh Editable HTML</span>
          </button>
        </div>
      </div>
    );
  }

  if (!selectedElement) {
    return (
      <div className="inspector-card">
        <span className="eyebrow">Element Settings</span>
        <h3>No element selected</h3>
        <p className="inspector-note">
          Click any text, image, section, column, or widget on the canvas. Its typography, spacing, border, sizing, and image settings will appear here.
        </p>
      </div>
    );
  }

  const isImage = selectedElement.type === "image";
  const isButtonLike = selectedElement.type === "button" || ["a", "button"].includes(selectedElement.tagName);

  return (
    <div className="inspector-card">
      <span className="eyebrow">Element Settings</span>
      <h3>{selectedElement.label || selectedElement.tagName || "Selected element"}</h3>
      <StatusPill status={selectedElement.type || "Widget"} />
      <div className="block-actions">
        {isImage && (
          <button className="ghost-button" type="button" onClick={onReplaceImage}>
            <Image size={16} />
            <span>Replace Image</span>
          </button>
        )}
        <button className="ghost-button" type="button" onClick={onDuplicateElement}>
          <Copy size={16} />
          <span>Duplicate</span>
        </button>
        <button className="danger-button" type="button" onClick={onDeleteElement}>
          <Trash2 size={16} />
          <span>Delete</span>
        </button>
      </div>

      <div className="field-grid one">
        {isButtonLike && (
          <Field label="Button URL">
            <input value={selectedElement.url || "#"} onChange={apply("url")} placeholder="# or /page-slug or https://example.com" />
          </Field>
        )}
        <Field label="Font Family">
          <select
            value={selectedFontValue}
            onChange={(event) => {
              if (event.target.value !== "custom") {
                onApplyStyle("fontFamily", event.target.value);
              }
            }}
          >
            {googleFontOptions.map((font) => (
              <option key={font.label} value={font.value}>{font.label}</option>
            ))}
            <option value="custom">Custom</option>
          </select>
          {selectedFontValue === "custom" && (
            <input value={valueOf("fontFamily")} onChange={apply("fontFamily")} placeholder="'Inter', Arial, sans-serif" />
          )}
        </Field>
        <div className="field-grid">
          <Field label="Font Size">
            {numericInput("fontSize", "18px")}
          </Field>
          <Field label="Font Weight">
            <select value={valueOf("fontWeight")} onChange={apply("fontWeight")}>
              {["", "300", "400", "500", "600", "700", "800", "900"].map((weight) => (
                <option key={weight} value={weight}>{weight || "Default"}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="field-grid">
          <Field label="Font Color">
            {colorInput("color", "#081933 or rgb(...)")}
          </Field>
          <Field label="Line Height">
            {numericInput("lineHeight", "1.5 or 28px")}
          </Field>
        </div>
        <Field label="Text Align">
          <select value={valueOf("textAlign")} onChange={apply("textAlign")}>
            {["", "left", "center", "right", "justify"].map((align) => (
              <option key={align} value={align}>{align || "Default"}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="field-grid one">
        <span className="eyebrow">Layout</span>
        <div className="field-grid">
          <Field label="Width">
            {numericInput("width", "100% or 320px")}
          </Field>
          <Field label="Height">
            {numericInput("height", "auto or 320px")}
          </Field>
        </div>
        <Field label="Max Width">
          {numericInput("maxWidth", "100% or 960px")}
        </Field>
        <div className="box-side-grid">
          <Field label="Margin Top">
            {numericInput("marginTop", "0px")}
          </Field>
          <Field label="Margin Right">
            {numericInput("marginRight", "0px")}
          </Field>
          <Field label="Margin Bottom">
            {numericInput("marginBottom", "0px")}
          </Field>
          <Field label="Margin Left">
            {numericInput("marginLeft", "0px")}
          </Field>
        </div>
        <div className="box-side-grid">
          <Field label="Padding Top">
            {numericInput("paddingTop", "0px")}
          </Field>
          <Field label="Padding Right">
            {numericInput("paddingRight", "0px")}
          </Field>
          <Field label="Padding Bottom">
            {numericInput("paddingBottom", "0px")}
          </Field>
          <Field label="Padding Left">
            {numericInput("paddingLeft", "0px")}
          </Field>
        </div>
        <Field label="Z Index">
          {numericInput("zIndex", "10")}
        </Field>
      </div>

      <div className="field-grid one">
        <span className="eyebrow">Advanced</span>
        <div className="field-grid">
          <Field label="Display">
            <select value={valueOf("display")} onChange={apply("display")}>
              {["", "block", "inline-block", "flex", "grid", "none"].map((display) => (
                <option key={display} value={display}>{display || "Default"}</option>
              ))}
            </select>
          </Field>
          <Field label="Position">
            <select value={valueOf("position")} onChange={apply("position")}>
              {["", "static", "relative", "absolute", "fixed", "sticky"].map((position) => (
                <option key={position} value={position}>{position || "Default"}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="field-grid">
          <Field label="Top">
            {numericInput("top", "0px")}
          </Field>
          <Field label="Right">
            {numericInput("right", "0px")}
          </Field>
        </div>
        <div className="field-grid">
          <Field label="Bottom">
            {numericInput("bottom", "0px")}
          </Field>
          <Field label="Left">
            {numericInput("left", "0px")}
          </Field>
        </div>
        <Field label="Opacity">
          {numericInput("opacity", "1")}
        </Field>
      </div>

      <div className="field-grid one">
        <span className="eyebrow">Border</span>
        <div className="field-grid">
          <Field label="Border Style">
            <select value={valueOf("borderStyle")} onChange={apply("borderStyle")}>
              {["", "none", "solid", "dashed", "dotted", "double"].map((style) => (
                <option key={style} value={style}>{style || "Default"}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="box-side-grid">
          <Field label="Top Width">
            {numericInput("borderTopWidth", "0px")}
          </Field>
          <Field label="Right Width">
            {numericInput("borderRightWidth", "0px")}
          </Field>
          <Field label="Bottom Width">
            {numericInput("borderBottomWidth", "0px")}
          </Field>
          <Field label="Left Width">
            {numericInput("borderLeftWidth", "0px")}
          </Field>
        </div>
        <Field label="Border Color">
          {colorInput("borderColor", "#d7e3f2")}
        </Field>
        <div className="box-side-grid">
          <Field label="Top Left">
            {numericInput("borderTopLeftRadius", "0px")}
          </Field>
          <Field label="Top Right">
            {numericInput("borderTopRightRadius", "0px")}
          </Field>
          <Field label="Bottom Right">
            {numericInput("borderBottomRightRadius", "0px")}
          </Field>
          <Field label="Bottom Left">
            {numericInput("borderBottomLeftRadius", "0px")}
          </Field>
        </div>
        <Field label="Background Color">
          {colorInput("backgroundColor", "transparent or #ffffff")}
        </Field>
      </div>

      {isImage && (
        <div className="field-grid one">
          <span className="eyebrow">Image</span>
          <div className="field-grid">
            <Field label="Object Fit / Crop">
              <select value={valueOf("objectFit")} onChange={apply("objectFit")}>
                <option value="cover">Cover / Crop</option>
                <option value="contain">Contain / Fit</option>
              </select>
            </Field>
            <Field label="Position">
              {numericInput("objectPosition", "50% 50%")}
            </Field>
          </div>
          <Field label="Image Source">
            <input value={selectedElement.src || ""} onChange={apply("src")} placeholder="/assets/img/example.jpg" />
          </Field>
          <p className="inspector-note">Double-click the image on canvas to replace it from the Media Library.</p>
        </div>
      )}
    </div>
  );
}

function BuilderView({
  page,
  setActiveView,
  updateField,
  updateSection,
  addSection,
  duplicateSection,
  moveSection,
  removeSection,
  savePage
}) {
  const [activeBlockId, setActiveBlockId] = useState(page.sections[0]?.id || "");
  const [sidebarMode, setSidebarMode] = useState("elements");
  const [inspectorTab, setInspectorTab] = useState("content");
  const [devicePreview, setDevicePreview] = useState("desktop");
  const activeBlock = page.sections.find((section) => section.id === activeBlockId) || page.sections[0];
  const activeBlockStyles = getSectionStyles(activeBlock);
  const pageStyles = getPageStyles(page);

  const updateBlockStyle = (field, value) => {
    if (!activeBlock) return;
    updateSection(activeBlock.id, "styles", { ...activeBlockStyles, [field]: value });
  };

  const updatePageStyle = (field, value) => {
    updateField("styles", { ...pageStyles, [field]: value });
  };

  const applySectionPreset = (preset) => {
    if (!activeBlock) return;
    const presets = {
      clean: { backgroundColor: "#ffffff", textColor: "#667085", headingColor: "#081933", paddingTop: "56", paddingBottom: "56", shadow: false },
      spotlight: { backgroundColor: "#eff6ff", textColor: "#344054", headingColor: "#081933", paddingTop: "72", paddingBottom: "72", shadow: true },
      dark: { backgroundColor: "#081933", textColor: "#eaf1f7", headingColor: "#ffffff", paddingTop: "72", paddingBottom: "72", shadow: true },
      gold: { backgroundColor: "#fff8e6", textColor: "#4f3b12", headingColor: "#081933", accentColor: "#d6a128", paddingTop: "60", paddingBottom: "60", shadow: false }
    };
    updateSection(activeBlock.id, "styles", { ...activeBlockStyles, ...(presets[preset] || presets.clean) });
  };

  useEffect(() => {
    if (!page.sections.some((section) => section.id === activeBlockId)) {
      setActiveBlockId(page.sections[0]?.id || "");
    }
  }, [activeBlockId, page.id, page.sections]);

  useEffect(() => {
    setSidebarMode("elements");
    setInspectorTab("content");
    setDevicePreview("desktop");
  }, [page.id]);

  return (
    <form className="builder-pro builder-studio" onSubmit={savePage}>
      <section className="builder-ui-head">
        <div className="builder-ui-crumb">
          <div className="builder-ui-mark">MW</div>
          <div>
            <span className="eyebrow">CRM Portal / Page Builder</span>
            <h2>{page.title}</h2>
          </div>
        </div>
        <div className="builder-ui-actions">
          <button className="ghost-button" type="button" onClick={() => setActiveView("pages")}>
            <Pencil size={16} />
            <span>Open Full Editor</span>
          </button>
          <button className="primary-button" type="submit">
            <Save size={16} />
            <span>Save</span>
          </button>
        </div>
      </section>

      <section className="builder-ui-shell">
        <aside className="builder-ui-sidebar">
          {sidebarMode === "elements" ? (
            <>
              <div className="builder-ui-panel-head">
                <div>
                  <span className="eyebrow">Elements</span>
                  <h3>Page Builder</h3>
                  <p className="panel-help">Add blocks, then select one on canvas to edit content and styling.</p>
                </div>
                <button type="button" className="panel-mode-btn active" onClick={() => setSidebarMode("elements")} aria-label="Elements panel">
                  <LayoutTemplate size={15} />
                </button>
              </div>

              <div className="builder-ui-widget-grid">
                {sectionTypes.map((type) => (
                  <button type="button" className="builder-ui-widget-card" key={type} onClick={() => addSection(type)}>
                    <div className="builder-ui-widget-icon">
                      <LayoutTemplate size={16} />
                    </div>
                    <span>{type}</span>
                  </button>
                ))}
              </div>

              <div className="builder-ui-layers">
                <span className="eyebrow">Layers</span>
                <div className="navigator-panel">
                  {page.sections.map((section, index) => (
                    <button
                      key={section.id}
                      type="button"
                      className={activeBlock?.id === section.id ? "active" : ""}
                      onClick={() => {
                        setActiveBlockId(section.id);
                        setSidebarMode("style");
                      }}
                    >
                      <GripVertical size={14} />
                      <span>{index + 1}. {section.title || section.type}</span>
                      <small>{section.visible === false ? "Hidden" : section.type}</small>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="builder-ui-panel-head builder-ui-panel-head-style">
                <div>
                  <span className="eyebrow">{inspectorTab === "page" ? "Page Settings" : "Selected Block"}</span>
                  <h3>{inspectorTab === "page" ? page.title : (activeBlock?.title || "Select a block")}</h3>
                </div>
                <button
                  type="button"
                  className="panel-mode-btn"
                  onClick={() => setSidebarMode("elements")}
                  aria-label="Back to elements panel"
                >
                  <Plus size={15} />
                </button>
              </div>

              <div className="inspector-tabs builder-ui-tabs">
                {["content", "style", "advanced", "page"].map((tab) => (
                  <button key={tab} type="button" className={inspectorTab === tab ? "active" : ""} onClick={() => setInspectorTab(tab)}>
                    {tab}
                  </button>
                ))}
              </div>

              {activeBlock && inspectorTab === "content" && (
                <div className="inspector-fields builder-ui-fields">
                  <Field label="Block Title">
                    <input value={activeBlock.title || ""} onChange={(event) => updateSection(activeBlock.id, "title", event.target.value)} />
                  </Field>
                  <Field label="Section Type">
                    <select value={activeBlock.type} onChange={(event) => updateSection(activeBlock.id, "type", event.target.value)}>
                      {sectionTypes.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Layout">
                    <select value={activeBlock.layout || "Text first"} onChange={(event) => updateSection(activeBlock.id, "layout", event.target.value)}>
                      {layoutOptions.map((layout) => (
                        <option key={layout}>{layout}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Content">
                    <textarea rows="5" value={activeBlock.body || ""} onChange={(event) => updateSection(activeBlock.id, "body", event.target.value)} />
                  </Field>
                </div>
              )}

              {activeBlock && inspectorTab === "style" && (
                <div className="inspector-fields builder-ui-fields">
                  <div className="style-preset-grid">
                    {[
                      ["clean", "Clean"],
                      ["spotlight", "Spotlight"],
                      ["dark", "Dark"],
                      ["gold", "Gold"]
                    ].map(([id, label]) => (
                      <button key={id} type="button" onClick={() => applySectionPreset(id)}>{label}</button>
                    ))}
                  </div>
                  <div className="field-grid one color-grid">
                    <Field label="Background Color">
                      <input type="color" value={activeBlockStyles.backgroundColor || "#ffffff"} onChange={(event) => updateBlockStyle("backgroundColor", event.target.value)} />
                    </Field>
                    <Field label="Heading Color">
                      <input type="color" value={activeBlockStyles.headingColor || "#081933"} onChange={(event) => updateBlockStyle("headingColor", event.target.value)} />
                    </Field>
                    <Field label="Text Color">
                      <input type="color" value={activeBlockStyles.textColor || "#667085"} onChange={(event) => updateBlockStyle("textColor", event.target.value)} />
                    </Field>
                    <Field label="Accent Color">
                      <input type="color" value={activeBlockStyles.accentColor || "#d6a128"} onChange={(event) => updateBlockStyle("accentColor", event.target.value)} />
                    </Field>
                  </div>
                  <Field label="Text Alignment">
                    <select value={activeBlockStyles.align || "left"} onChange={(event) => updateBlockStyle("align", event.target.value)}>
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </Field>
                </div>
              )}

              {activeBlock && inspectorTab === "advanced" && (
                <div className="inspector-fields builder-ui-fields">
                  <div className="spacing-grid">
                    <Field label="Padding Top"><input value={activeBlockStyles.paddingTop || ""} onChange={(event) => updateBlockStyle("paddingTop", event.target.value)} /></Field>
                    <Field label="Padding Bottom"><input value={activeBlockStyles.paddingBottom || ""} onChange={(event) => updateBlockStyle("paddingBottom", event.target.value)} /></Field>
                    <Field label="Padding Left"><input value={activeBlockStyles.paddingLeft || ""} onChange={(event) => updateBlockStyle("paddingLeft", event.target.value)} /></Field>
                    <Field label="Padding Right"><input value={activeBlockStyles.paddingRight || ""} onChange={(event) => updateBlockStyle("paddingRight", event.target.value)} /></Field>
                    <Field label="Column Gap"><input value={activeBlockStyles.gap || ""} onChange={(event) => updateBlockStyle("gap", event.target.value)} /></Field>
                    <Field label="Border Radius"><input value={activeBlockStyles.borderRadius || ""} onChange={(event) => updateBlockStyle("borderRadius", event.target.value)} /></Field>
                  </div>
                  <label className="toggle-field">
                    <input type="checkbox" checked={activeBlock.visible !== false} onChange={(event) => updateSection(activeBlock.id, "visible", event.target.checked)} />
                    <span>Visible on website</span>
                  </label>
                </div>
              )}

              {inspectorTab === "page" && (
                <div className="inspector-fields builder-ui-fields">
                  <Field label="Page Title"><input value={page.title} onChange={(event) => updateField("title", event.target.value)} /></Field>
                  <Field label="Hero Headline"><textarea rows="4" value={page.heroHeadline || ""} onChange={(event) => updateField("heroHeadline", event.target.value)} /></Field>
                  <Field label="Page Background"><input type="color" value={pageStyles.backgroundColor || "#ffffff"} onChange={(event) => updatePageStyle("backgroundColor", event.target.value)} /></Field>
                  <Field label="Canvas Width"><input value={pageStyles.canvasWidth || ""} onChange={(event) => updatePageStyle("canvasWidth", event.target.value)} /></Field>
                </div>
              )}
            </>
          )}
        </aside>

        <section className="builder-ui-canvas">
          <div className="builder-ui-toolbar">
            <div>
              <span className="eyebrow">Canvas</span>
              <h3>{page.sections.length} Blocks</h3>
              <small>Use the style tab to update visual settings for the selected block.</small>
            </div>
            <div className="device-switcher" aria-label="Preview size">
              {["desktop", "tablet", "mobile"].map((device) => (
                <button
                  key={device}
                  type="button"
                  className={devicePreview === device ? "active" : ""}
                  onClick={() => setDevicePreview(device)}
                >
                  {device}
                </button>
              ))}
            </div>
          </div>

          <div className={`builder-ui-page device-${devicePreview}`} style={{ maxWidth: toCssUnit(pageStyles.canvasWidth, defaultPageStyles.canvasWidth) }}>
            <div className="builder-ui-page-meta">
              <Field label="Page Title">
                <input value={page.title} onChange={(event) => updateField("title", event.target.value)} />
              </Field>
              <Field label="Hero Headline">
                <textarea rows="2" value={page.heroHeadline || ""} onChange={(event) => updateField("heroHeadline", event.target.value)} />
              </Field>
            </div>

            <div className="builder-stack standalone builder-ui-stack">
              {page.sections.map((section, index) => (
                <article
                  className={`canvas-block builder-ui-block ${activeBlock?.id === section.id ? "active" : ""}`}
                  role="button"
                  tabIndex={0}
                  key={section.id}
                  onClick={() => {
                    setActiveBlockId(section.id);
                    setSidebarMode("style");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      setActiveBlockId(section.id);
                      setSidebarMode("style");
                    }
                  }}
                >
                  <div className="builder-ui-block-label">{index + 1}. {section.type}</div>
                  <span className="canvas-handle">
                    <GripVertical size={16} />
                    {index + 1}
                  </span>
                  <img src={section.image || page.heroImage} alt="" />
                  <span className="canvas-copy">
                    <small>{section.type}</small>
                    <strong>{section.title}</strong>
                    <em>{section.layout}</em>
                  </span>
                  <span className="canvas-actions">
                    <button type="button" onClick={(event) => { event.stopPropagation(); moveSection(section.id, "up"); }} disabled={index === 0}>
                      <ArrowUp size={15} />
                    </button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); moveSection(section.id, "down"); }} disabled={index === page.sections.length - 1}>
                      <ArrowDown size={15} />
                    </button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); duplicateSection(section.id); }}>
                      <Copy size={15} />
                    </button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); removeSection(section.id); }}>
                      <Trash2 size={15} />
                    </button>
                  </span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="panel builder-preview">
          <PagePreview page={page} />
        </section>
      </section>
    </form>
  );
}

function ProgramsView({
  categories,
  programs,
  programPages,
  mainPage,
  updateMainPage,
  setActivePageId,
  setActiveView,
  setEditorTab,
  deletePageById,
  addCategory,
  updateCategory,
  deleteCategory,
  addProgram,
  updateProgram,
  deleteProgram
}) {
  const [activeTab, setActiveTab] = useState("pages");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [programQuery, setProgramQuery] = useState("");
  const [pageQuery, setPageQuery] = useState("");
  const [pageStatusFilter, setPageStatusFilter] = useState("All");
  const [pageViewMode, setPageViewMode] = useState("grid");
  const sortedCategories = [...categories].sort((a, b) => Number(a.menuOrder) - Number(b.menuOrder));
  const filteredProgramPages = programPages
    .filter((page) => pageStatusFilter === "All" || (page.status || "").toLowerCase() === pageStatusFilter.toLowerCase())
    .filter((page) =>
      [page.title, page.slug, page.type, page.menu, page.summary]
        .join(" ")
        .toLowerCase()
        .includes(pageQuery.toLowerCase())
    );
  const filteredPrograms = programs
    .filter((program) => categoryFilter === "All" || program.categorySlug === categoryFilter)
    .filter((program) =>
      [program.title, program.slug, program.college, program.level, program.campus]
        .join(" ")
        .toLowerCase()
        .includes(programQuery.toLowerCase())
    )
    .sort((a, b) => a.title.localeCompare(b.title));
  const featuredPrograms = programs.filter((program) => program.featured && program.status !== "Archived");

  return (
    <section className="programs-view">
      {/* <div className="panel programs-hero-manager">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Main Program Page</span>
            <h2>{mainPage.title}</h2>
          </div>
          <StatusPill status={mainPage.status} />
        </div>

        <div className="program-page-grid">
          <div className="form-stack compact">
            <div className="field-grid">
              <Field label="Page Title">
                <input value={mainPage.title} onChange={(event) => updateMainPage("title", event.target.value)} />
              </Field>
              <Field label="Slug">
                <input value={mainPage.slug} onChange={(event) => updateMainPage("slug", event.target.value)} />
              </Field>
            </div>
            <Field label="Hero Headline">
              <textarea rows="2" value={mainPage.heroHeadline} onChange={(event) => updateMainPage("heroHeadline", event.target.value)} />
            </Field>
            <Field label="Summary">
              <textarea rows="3" value={mainPage.summary} onChange={(event) => updateMainPage("summary", event.target.value)} />
            </Field>
            <div className="field-grid">
              <Field label="Hero Image">
                <select value={mainPage.heroImage} onChange={(event) => updateMainPage("heroImage", event.target.value)}>
                  {mediaLibrary.map((media) => (
                    <option key={media.id} value={media.path}>{media.title}</option>
                  ))}
                </select>
              </Field>
              <Field label="Publish Status">
                <select value={mainPage.status} onChange={(event) => updateMainPage("status", event.target.value)}>
                  {statusOptions.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <div className="program-page-preview" style={{ backgroundImage: `linear-gradient(90deg, rgba(8, 25, 51, 0.9), rgba(26, 75, 150, 0.66)), url(${mainPage.heroImage})` }}>
            <span>{mainPage.heroTag}</span>
            <h3>{mainPage.heroHeadline}</h3>
            <p>{mainPage.summary}</p>
            <div>
              <strong>{programPages.length}</strong>
              <small>Program pages</small>
              <strong>{categories.length}</strong>
              <small>Categories</small>
            </div>
          </div>
        </div>
      </div> */}

      <div className="program-tabs" role="tablist" aria-label="Program management tabs">
        {[
          { id: "pages", label: "Program Pages", icon: FileText },
          // { id: "programs", label: "Programs", icon: GraduationCap },
          { id: "categories", label: "Categories", icon: Layers },
          { id: "preview", label: "Listing Preview", icon: Eye }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} type="button" className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>
              <Icon size={17} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === "pages" && (
        <section className="panel programs-manager">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Imported Program Pages</span>
              <h2>{filteredProgramPages.length} Program Pages</h2>
            </div>
          </div>

          <div className="manager-toolbar programs-toolbar programs-pages-toolbar">
            <label className="search-field">
              <Search size={17} />
              <input value={pageQuery} onChange={(event) => setPageQuery(event.target.value)} placeholder="Search program page title or slug" />
            </label>
            <label className="select-field">
              <Filter size={17} />
              <select value={pageStatusFilter} onChange={(event) => setPageStatusFilter(event.target.value)}>
                <option>All</option>
                {pageStatusFilters.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
            <ViewModeToggle value={pageViewMode} onChange={setPageViewMode} />
          </div>

          <div className={`program-pages-grid ${pageViewMode === "list" ? "list-mode" : ""}`}>
            {filteredProgramPages.map((page) => (
              <article className={`program-page-card ${pageViewMode === "list" ? "list-mode" : ""}`} key={page.id}>
                <img src={getAutoThumbnailForPage(page)} alt="" />
                <div className="program-page-card-body">
                  <StatusPill status={page.status} />
                  <h3>{page.title}</h3>
                  <small>/{page.slug}</small>
                  <p>{page.summary}</p>
                </div>
                <div className="program-page-actions">
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Edit page"
                    onClick={() => {
                      if (!isLocalDraftPage(page)) {
                        openPageEditorTab(page.id);
                        return;
                      }
                      setActivePageId(page.id);
                      setEditorTab("content");
                      setActiveView("page-editor");
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="View sections"
                    onClick={() => {
                      setActivePageId(page.id);
                      setEditorTab("builder");
                      setActiveView("page-editor");
                    }}
                  >
                    <ListTree size={16} />
                  </button>
                  <button
                    className="icon-button danger"
                    type="button"
                    aria-label="Delete page"
                    onClick={() => deletePageById(page.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
            {!filteredProgramPages.length && (
              <p className="program-empty">No program pages match the current filters.</p>
            )}
          </div>
        </section>
      )}

      {/* {activeTab === "programs" && (
        <section className="panel programs-manager">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Program Records</span>
              <h2>{filteredPrograms.length} Programs</h2>
            </div>
            <button className="primary-button" type="button" onClick={addProgram}>
              <Plus size={17} />
              <span>Add Program</span>
            </button>
          </div>

          <div className="manager-toolbar programs-toolbar">
            <label className="search-field">
              <Search size={17} />
              <input value={programQuery} onChange={(event) => setProgramQuery(event.target.value)} placeholder="Search programs" />
            </label>
            <label className="select-field">
              <Layers size={17} />
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option>All</option>
                {sortedCategories.map((category) => (
                  <option key={category.id} value={category.slug}>{category.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="program-editor-list">
            {filteredPrograms.map((program) => (
              <article className="program-editor-card" key={program.id}>
                <img src={program.heroImage} alt="" />
                <div className="program-editor-fields">
                  <div className="field-grid">
                    <Field label="Program Name">
                      <input value={program.title} onChange={(event) => updateProgram(program.id, "title", event.target.value)} />
                    </Field>
                    <Field label="Slug">
                      <input value={program.slug} onChange={(event) => updateProgram(program.id, "slug", event.target.value)} />
                    </Field>
                    <Field label="Category">
                      <select value={program.categorySlug} onChange={(event) => updateProgram(program.id, "categorySlug", event.target.value)}>
                        {sortedCategories.map((category) => (
                          <option key={category.id} value={category.slug}>{category.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Level">
                      <select value={program.level} onChange={(event) => updateProgram(program.id, "level", event.target.value)}>
                        <option>Undergraduate</option>
                        <option>Postgraduate</option>
                        <option>PhD</option>
                        <option>Specialty</option>
                        <option>Short Course</option>
                      </select>
                    </Field>
                    <Field label="College / School">
                      <input value={program.college} onChange={(event) => updateProgram(program.id, "college", event.target.value)} />
                    </Field>
                    <Field label="Duration">
                      <input value={program.duration} onChange={(event) => updateProgram(program.id, "duration", event.target.value)} />
                    </Field>
                    <Field label="Delivery">
                      <select value={program.delivery} onChange={(event) => updateProgram(program.id, "delivery", event.target.value)}>
                        <option>Regular</option>
                        <option>Weekend</option>
                        <option>Extension</option>
                        <option>Online</option>
                        <option>Hybrid</option>
                      </select>
                    </Field>
                    <Field label="Campus">
                      <input value={program.campus} onChange={(event) => updateProgram(program.id, "campus", event.target.value)} />
                    </Field>
                    <Field label="Image">
                      <select value={program.heroImage} onChange={(event) => updateProgram(program.id, "heroImage", event.target.value)}>
                        {mediaLibrary.map((media) => (
                          <option key={media.id} value={media.path}>{media.title}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Status">
                      <select value={program.status} onChange={(event) => updateProgram(program.id, "status", event.target.value)}>
                        {statusOptions.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label="Program Summary">
                    <textarea rows="3" value={program.summary} onChange={(event) => updateProgram(program.id, "summary", event.target.value)} />
                  </Field>
                  <div className="program-switches">
                    <label className="toggle-field">
                      <input type="checkbox" checked={program.featured} onChange={(event) => updateProgram(program.id, "featured", event.target.checked)} />
                      <span>Feature on main programs page</span>
                    </label>
                    <label className="toggle-field">
                      <input type="checkbox" checked={program.applicationOpen} onChange={(event) => updateProgram(program.id, "applicationOpen", event.target.checked)} />
                      <span>Applications open</span>
                    </label>
                    <button className="danger-button" type="button" onClick={() => deleteProgram(program.id)}>
                      <Trash2 size={17} />
                      <span>Delete Program</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )} */}

      {activeTab === "categories" && (
        <section className="panel category-manager">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Program Categories</span>
              <h2>{categories.length} Categories</h2>
            </div>
            <button className="primary-button" type="button" onClick={addCategory}>
              <Plus size={17} />
              <span>Add Category</span>
            </button>
          </div>

          <div className="category-grid">
            {sortedCategories.map((category) => (
              <article className="category-card" key={category.id}>
                <img src={category.heroImage} alt="" />
                <div className="category-card-fields">
                  <Field label="Category Name">
                    <input value={category.name} onChange={(event) => updateCategory(category.id, "name", event.target.value)} />
                  </Field>
                  <Field label="Slug">
                    <input value={category.slug} onChange={(event) => updateCategory(category.id, "slug", event.target.value)} />
                  </Field>
                  <Field label="Description">
                    <textarea rows="3" value={category.description} onChange={(event) => updateCategory(category.id, "description", event.target.value)} />
                  </Field>
                  <div className="field-grid">
                    <Field label="Menu Order">
                      <input type="number" min="1" value={category.menuOrder} onChange={(event) => updateCategory(category.id, "menuOrder", event.target.value)} />
                    </Field>
                    <Field label="Status">
                      <select value={category.status} onChange={(event) => updateCategory(category.id, "status", event.target.value)}>
                        {statusOptions.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Image">
                      <select value={category.heroImage} onChange={(event) => updateCategory(category.id, "heroImage", event.target.value)}>
                        {mediaLibrary.map((media) => (
                          <option key={media.id} value={media.path}>{media.title}</option>
                        ))}
                      </select>
                    </Field>
                    <label className="toggle-field">
                      <input type="checkbox" checked={category.featured} onChange={(event) => updateCategory(category.id, "featured", event.target.checked)} />
                      <span>Featured category</span>
                    </label>
                  </div>
                  <div className="category-footer">
                    <span>{programs.filter((program) => program.categorySlug === category.slug).length} programs listed</span>
                    <button className="danger-button" type="button" onClick={() => deleteCategory(category.id)} disabled={categories.length <= 1}>
                      <Trash2 size={17} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === "preview" && (
        <section className="program-listing-preview">
          <div className="program-listing-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(8, 25, 51, 0.9), rgba(26, 75, 150, 0.68)), url(${mainPage.heroImage})` }}>
            <img src={assets.logoOfficial} alt="Madda Walabu University" />
            <span>{mainPage.heroTag}</span>
            <h2>{mainPage.heroHeadline}</h2>
            <p>{mainPage.summary}</p>
          </div>

          <div className="program-category-preview">
            {sortedCategories
              .filter((category) => category.status !== "Archived")
              .map((category) => {
                const listedPrograms = programs.filter(
                  (program) => program.categorySlug === category.slug && program.status !== "Archived"
                );

                return (
                  <section className="program-category-section" key={category.id}>
                    <div className="panel-head compact">
                      <div>
                        <span className="eyebrow">{category.name}</span>
                        <h2>{category.description}</h2>
                      </div>
                      <StatusPill status={category.status} />
                    </div>
                    <div className="program-preview-grid">
                      {listedPrograms.map((program) => (
                        <article className="program-preview-card" key={program.id}>
                          <img src={program.heroImage} alt="" />
                          <div>
                            <span>{program.level} / {program.duration}</span>
                            <h3>{program.title}</h3>
                            <p>{program.summary}</p>
                            <small>{program.college} / {program.campus}</small>
                            <StatusPill status={program.applicationOpen ? "Published" : "Review"} />
                          </div>
                        </article>
                      ))}
                      {!listedPrograms.length && <p className="program-empty">No active programs in this category.</p>}
                    </div>
                  </section>
                );
              })}
          </div>

          <div className="featured-strip">
            <strong>{featuredPrograms.length}</strong>
            <span>featured programs will appear on the main programs page.</span>
          </div>
        </section>
      )}
    </section>
  );
}

function PagePreview({ page }) {
  const visibleSections = page.sections.filter((section) => section.visible !== false);
  const pageStyles = getPageStyles(page);
  const livePageUrl = getLivePageUrl(page);
  const storedDocument = getStoredEditableDocument(page);

  if (storedDocument.fullHtml) {
    return (
      <div className="website-preview website-preview-html">
        <div className="preview-html-head">
          <div>
            <span className="eyebrow">Saved Website Preview</span>
            <h3>{page.title}</h3>
          </div>
          {livePageUrl ? <a className="ghost-button" href={livePageUrl} target="_blank" rel="noreferrer">Open</a> : <small>Stored in database</small>}
        </div>
        <iframe title={`${page.title} full HTML preview`} srcDoc={buildPreviewDocument(page)} sandbox="" />
      </div>
    );
  }

  if (livePageUrl) {
    return (
      <div className="website-preview website-preview-html exact-preview-panel">
        <div className="preview-html-head">
          <div>
            <span className="eyebrow">Exact Website Preview</span>
            <h3>{page.title}</h3>
          </div>
          <a className="ghost-button" href={livePageUrl} target="_blank" rel="noreferrer">Open</a>
        </div>
        <iframe
          title={`${page.title} exact website preview`}
          src={livePageUrl}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    );
  }

  return (
    <div className="website-preview" style={{ background: pageStyles.backgroundColor }}>
      <header className="preview-header">
        <img src={assets.logoOfficial} alt="" />
        <nav>
          <span>Home</span>
          <span>About Us</span>
          <span>Programs</span>
          <span>Admissions</span>
        </nav>
      </header>

      <section className="preview-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(8, 25, 51, 0.88), rgba(26, 75, 150, 0.64)), url(${page.heroImage})` }}>
        <div>
          <span>{page.heroTag}</span>
          <h3>{page.heroHeadline}</h3>
          <p>{page.summary}</p>
          <button type="button">{page.ctaLabel}</button>
        </div>
        <div className="preview-hero-stats">
          <strong>16320+</strong>
          <span>Active Students</span>
          <strong>79</strong>
          <span>Programs</span>
        </div>
      </section>

      <section className="preview-feature-row">
        {["Networked Learning", "Integrated Research", "Community Service"].map((label, index) => (
          <article key={label}>
            <span>{index + 1}</span>
            <strong>{label}</strong>
            <p>{visibleSections[index]?.title || "Managed from CRM content blocks."}</p>
          </article>
        ))}
      </section>

      <section className="preview-about">
        <img src={page.heroImage} alt="" />
        <div>
          <span>About This Page</span>
          <h3>{page.title}</h3>
          <p>{visibleSections[0]?.body || page.summary}</p>
          <button type="button">Learn More</button>
        </div>
      </section>

      <section className="preview-sections">
        {visibleSections.map((section) => {
          const styles = getSectionStyles(section);
          const isRawHtml = section.type === "Raw HTML" || section.layout === "Legacy HTML" || Boolean(section.html);

          if (isRawHtml) {
            return (
              <article className="preview-section-card preview-raw-html" key={section.id}>
                <span>{section.type}</span>
                <h4>{section.title}</h4>
                <iframe title={`${section.title} raw HTML preview`} srcDoc={buildPreviewDocument({ title: section.title, bodyHtml: formatHtmlPreview(section.html), styles: pageStyles })} sandbox="" />
              </article>
            );
          }

          return (
            <article className={`preview-section-card ${slugify(section.type)}`} style={sectionCanvasStyle(section)} key={section.id}>
              {["Program Grid", "Image Gallery", "Testimonials", "Events List"].includes(section.type) && (
                <img style={{ borderRadius: toCssUnit(styles.imageRadius, defaultSectionStyles.imageRadius) }} src={section.image || page.heroImage} alt="" />
              )}
              <span style={{ color: styles.accentColor }}>{section.type}</span>
              <h4 style={{ color: styles.headingColor }}>{section.title}</h4>
              {["Feature Cards", "Program Grid", "Stats Strip", "FAQ"].includes(section.type) ? (
                <div className="preview-chip-grid">
                  {String(section.body)
                    .split("|")
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .map((item) => (
                      <small key={item}>{item}</small>
                    ))}
                </div>
              ) : (
                <p style={{ color: styles.textColor }}>{section.body}</p>
              )}
              {section.ctaLabel && <button type="button">{section.ctaLabel}</button>}
            </article>
          );
        })}
      </section>
    </div>
  );
}

export default App;
