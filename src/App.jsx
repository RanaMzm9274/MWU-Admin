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

const PROGRAM_CATEGORIES_KEY = "mwu-crm-program-categories-v1";
const PROGRAMS_KEY = "mwu-crm-programs-v1";
const MEDIA_LIBRARY_KEY = "mwu-crm-media-library-v1";
const MEDIA_API_USERNAME_KEY = "mwu_media_api_username";
const MEDIA_API_PASSWORD_KEY = "mwu_media_api_password";
const ADMIN_TOKEN_KEY = "mwu_admin_token";
const ADMIN_ACTIVITY_KEY = "mwu_admin_last_activity";
const ADMIN_PAGES_LOADED_NOTICE_KEY = "mwu_admin_pages_loaded_notice_dismissed";
const INACTIVITY_LIMIT_MS = 15 * 60 * 1000;
const LIVE_SITE_ORIGIN = "https://maddauni.online";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const MEDIA_API_BASE_URL = (import.meta.env.VITE_MEDIA_API_BASE_URL || `${LIVE_SITE_ORIGIN}/api`).replace(/\/$/, "");
const LIVE_ASSET_PROXY_PREFIX = "/__live_asset";
const apiUrl = (path) => `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
const MEDIA_API_PATH = "/admin/media";
const mediaApiUrl = (path = MEDIA_API_PATH) => `${MEDIA_API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

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

const extractToken = (payload) =>
  payload?.token ||
  payload?.accessToken ||
  payload?.access_token ||
  payload?.data?.token ||
  payload?.data?.accessToken ||
  payload?.data?.access_token ||
  "";

const getStoredAdminToken = () => {
  const token = window.localStorage.getItem(ADMIN_TOKEN_KEY) || "";
  const lastActivity = Number(window.localStorage.getItem(ADMIN_ACTIVITY_KEY) || 0);
  if (!token || !lastActivity || Date.now() - lastActivity > INACTIVITY_LIMIT_MS) {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    window.localStorage.removeItem(ADMIN_ACTIVITY_KEY);
    return "";
  }

  return token;
};

const rememberAdminSession = (token) => {
  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
  window.localStorage.setItem(ADMIN_ACTIVITY_KEY, String(Date.now()));
};

const clearAdminSession = () => {
  window.localStorage.removeItem(ADMIN_TOKEN_KEY);
  window.localStorage.removeItem(ADMIN_ACTIVITY_KEY);
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

const getCrmUrl = () => {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  return url.toString();
};

const openPageEditorTab = (pageId) => {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("editor", "page");
  url.searchParams.set("pageId", String(pageId));
  window.open(url.toString(), "_blank", "noopener,noreferrer");
};

const assets = {
  // All CRM/static assets should come from public/assets, not from the live-site proxy.
  logoOfficial: "/assets/img/madda-logo.png",
  logoWhite: "/assets/img/logo-white.svg",
  logoBlack: "/assets/img/logo-black.svg",
  hero: "/assets/img/hero-home.webp",
  about: "/assets/img/about-mwu.jpg",
  agriculture: "/assets/img/program-agriculture.jpg",
  health: "/assets/img/program-health.jpg",
  campus: "/assets/img/campus-mentor.webp",
  blog: "/assets/img/blog-mou.jpg",
  stories: "/assets/img/student-stories.jpg"
};

const initialMediaLibrary = [
  {
    id: "hero",
    title: "Main Campus Hero",
    type: "Hero",
    path: assets.hero,
    size: "1920 x 900",
    uploadedAt: "2026-07-01",
    dimensions: "1920 x 900",
    mimeType: "image/webp"
  },
  {
    id: "about",
    title: "About MWU",
    type: "About",
    path: assets.about,
    size: "1280 x 820",
    uploadedAt: "2026-07-01",
    dimensions: "1280 x 820",
    mimeType: "image/jpeg"
  },
  {
    id: "agriculture",
    title: "Crop and Livestock",
    type: "Program",
    path: assets.agriculture,
    size: "1200 x 780",
    uploadedAt: "2026-07-01",
    dimensions: "1200 x 780",
    mimeType: "image/jpeg"
  },
  {
    id: "health",
    title: "Public Health Sciences",
    type: "Program",
    path: assets.health,
    size: "1200 x 780",
    uploadedAt: "2026-07-01",
    dimensions: "1200 x 780",
    mimeType: "image/jpeg"
  },
  {
    id: "campus",
    title: "Mentor Lecture",
    type: "Campus",
    path: assets.campus,
    size: "1200 x 780",
    uploadedAt: "2026-07-01",
    dimensions: "1200 x 780",
    mimeType: "image/webp"
  },
  {
    id: "blog",
    title: "Research and Community Impact",
    type: "News",
    path: assets.blog,
    size: "1200 x 780",
    uploadedAt: "2026-07-01",
    dimensions: "1200 x 780",
    mimeType: "image/jpeg"
  },
  {
    id: "stories",
    title: "Student Stories",
    type: "Story",
    path: assets.stories,
    size: "1200 x 780",
    uploadedAt: "2026-07-01",
    dimensions: "1200 x 780",
    mimeType: "image/jpeg"
  }
];

const formatMediaByteSize = (bytes) => {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10 * 1024 ? 1 : 0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(value < 10 * 1024 * 1024 ? 1 : 0)} MB`;
};

const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const todayIso = () => new Date().toISOString();

const estimateDataUrlBytes = (value = "") => {
  const match = String(value || "").match(/^data:.*?;base64,(.+)$/);
  if (!match?.[1]) return 0;
  return Math.floor((match[1].length * 3) / 4);
};

const buildMediaDimensions = (width, height, fallback = "") => {
  const parsedWidth = Number(width || 0);
  const parsedHeight = Number(height || 0);
  if (parsedWidth > 0 && parsedHeight > 0) {
    return `${parsedWidth} x ${parsedHeight}`;
  }
  return fallback;
};

const normalizeMediaItem = (media) => {
  const path = String(media?.path || "");
  const size = String(media?.size || "").trim();
  const derivedByteSize = estimateDataUrlBytes(path);
  return {
    id: media?.id || makeId(),
    title: media?.title || "Untitled media",
    type: media?.type || "Image",
    path,
    size: size || formatMediaByteSize(media?.bytes || derivedByteSize),
    bytes: Number(media?.bytes || derivedByteSize || 0),
    uploadedAt: media?.uploadedAt || todayIso(),
    dimensions: media?.dimensions || buildMediaDimensions(media?.width, media?.height, size),
    width: Number(media?.width || 0),
    height: Number(media?.height || 0),
    mimeType: media?.mimeType || (path.startsWith("data:") ? path.slice(5, path.indexOf(";")) : "image/jpeg")
  };
};

const normalizeMediaApiItem = (media = {}) =>
  normalizeMediaItem({
    id: media.id || media.media_id || media.file_id || media.uuid,
    title: media.title || media.name || media.filename || media.original_name,
    type: media.type || media.media_type || media.kind || "Image",
    path: media.path || media.url || media.file_url || media.public_url || media.src,
    size: media.size_label || media.size,
    bytes: media.bytes || media.file_size || media.size_bytes,
    uploadedAt: media.uploaded_at || media.created_at || media.updated_at,
    dimensions: media.dimensions,
    width: media.width,
    height: media.height,
    mimeType: media.mime_type || media.mimeType || media.content_type
  });

const mergeMediaLibraries = (...collections) => {
  const seen = new Set();
  const merged = [];
  collections.flat().forEach((item) => {
    const normalized = normalizeMediaItem(item);
    const key = normalized.path || normalized.id;
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(normalized);
  });
  return merged;
};

const getStoredMediaApiCredentials = () => ({
  username: window.sessionStorage.getItem(MEDIA_API_USERNAME_KEY) || "",
  password: window.sessionStorage.getItem(MEDIA_API_PASSWORD_KEY) || ""
});

const storeMediaApiCredentials = ({ username = "", password = "" } = {}) => {
  if (username) {
    window.sessionStorage.setItem(MEDIA_API_USERNAME_KEY, username);
  } else {
    window.sessionStorage.removeItem(MEDIA_API_USERNAME_KEY);
  }
  if (password) {
    window.sessionStorage.setItem(MEDIA_API_PASSWORD_KEY, password);
  } else {
    window.sessionStorage.removeItem(MEDIA_API_PASSWORD_KEY);
  }
};

const getMediaApiAuthHeaders = (credentials = getStoredMediaApiCredentials()) => {
  if (!credentials.username || !credentials.password) {
    return {};
  }
  const basicToken = window.btoa(`${credentials.username}:${credentials.password}`);
  return { Authorization: `Basic ${basicToken}` };
};

const loadMediaLibrary = () => {
  try {
    const stored = window.localStorage.getItem(MEDIA_LIBRARY_KEY);
    const parsed = stored ? JSON.parse(stored) : initialMediaLibrary;
    const normalized = Array.isArray(parsed) ? parsed.map(normalizeMediaItem) : initialMediaLibrary.map(normalizeMediaItem);
    const existingIds = new Set(normalized.map((item) => item.id));
    const missingSeedItems = initialMediaLibrary
      .map(normalizeMediaItem)
      .filter((item) => !existingIds.has(item.id));
    return [...normalized, ...missingSeedItems];
  } catch {
    return initialMediaLibrary.map(normalizeMediaItem);
  }
};

let mediaLibrary = loadMediaLibrary();

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read file."));
    reader.readAsDataURL(file);
  });

const readImageDimensions = (src) =>
  new Promise((resolve) => {
    const image = new window.Image();
    image.onload = () => resolve({ width: image.naturalWidth || 0, height: image.naturalHeight || 0 });
    image.onerror = () => resolve({ width: 0, height: 0 });
    image.src = src;
  });

const normalizeLiveAssetUrl = (value = "") => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${LIVE_SITE_ORIGIN}${raw}`;
  if (raw.startsWith("assets/")) return `${LIVE_SITE_ORIGIN}/${raw}`;
  return "";
};

const canLoadRemoteImage = (url) =>
  new Promise((resolve) => {
    if (!url) {
      resolve(false);
      return;
    }
    const image = new window.Image();
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    image.src = `${url}${url.includes("?") ? "&" : "?"}mwu_asset_check=${Date.now()}`;
    window.setTimeout(() => finish(false), 5000);
  });

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
  { id: "menus", label: "Menus", icon: ListChecks },
  { id: "site-chrome", label: "Header & Footer", icon: LayoutTemplate },
  { id: "programs", label: "Programs", icon: GraduationCap },
  { id: "blogs", label: "Blogs", icon: MessageSquare },
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "media", label: "Media", icon: Image },
  { id: "crm", label: "CRM Leads", icon: Users },
  { id: "settings", label: "Settings", icon: Settings }
];

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

  if (/^\/assets\//i.test(rawValue)) {
    return rawValue;
  }

  if (/^(assets\/|\.\/assets\/)/i.test(rawValue)) {
    return `/${rawValue.replace(/^\.\//, "")}`;
  }

  if (/^\.\.\/assets\//i.test(rawValue)) {
    return `/${rawValue.replace(/^(\.\.\/)+/, "")}`;
  }

  if (/^\/legacy\/assets\//i.test(rawValue)) {
    return rawValue.replace(/^\/legacy/, "");
  }

  if (/^\/legacy\//i.test(rawValue) && /\/assets\//i.test(rawValue)) {
    return rawValue.replace(/^\/legacy[^/]*\//i, "/");
  }

  if (/^\/\//.test(rawValue)) {
    try {
      const protocolRelative = new URL(`https:${rawValue}`);
      if (protocolRelative.hostname.replace(/^www\./, "") === "maddauni.online" && protocolRelative.pathname.startsWith("/assets/")) {
        return `${protocolRelative.pathname}${protocolRelative.search}${protocolRelative.hash}`;
      }
    } catch {
      return rawValue;
    }
  }

  try {
    const absoluteUrl = new URL(rawValue, LIVE_SITE_ORIGIN);
    const liveOrigin = new URL(LIVE_SITE_ORIGIN).origin;

    if (absoluteUrl.origin === liveOrigin && absoluteUrl.pathname.startsWith("/assets/")) {
      // User has the existing website assets in /public/assets, so keep them local.
      return `${absoluteUrl.pathname}${absoluteUrl.search}${absoluteUrl.hash}`;
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
  return bodyHtml.length > 600 && plainText.length > 80 && !hasOnlyAppRoot;
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

const getStoredEditableDocument = (page = {}) => {
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

const getLiveFetchPath = (page = {}) => `/__live_page${getLiveRoutePath(page)}`;

const getLegacyRoutePath = (page = {}) => {
  const routePath = getLiveRoutePath(page).split("?")[0].replace(/\/$/, "");
  if (!routePath || routePath === "/") {
    return "/legacy/index.html";
  }
  if (/^\/legacy\//i.test(routePath)) {
    return routePath;
  }
  if (/\.html$/i.test(routePath)) {
    return routePath;
  }
  return `/legacy${routePath}.html`;
};

const getLegacyFetchPath = (page = {}) => `/__live_page${getLegacyRoutePath(page)}`;

const getEditableFetchCandidates = (page = {}) =>
  // Editable mode needs a real HTML document, not the Vite/React SPA shell.
  // Use the static legacy HTML first; if the live route is server-rendered, it can be used as a fallback.
  Array.from(new Set([getLegacyFetchPath(page), getLiveFetchPath(page)].filter(Boolean)));

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
<base href="/" />
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
<base href="/" />
<link rel="stylesheet" href="${LIVE_ASSET_PROXY_PREFIX}/assets/css/bootstrap.min.css" />
<link rel="stylesheet" href="${LIVE_ASSET_PROXY_PREFIX}/assets/css/style.css" />
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
<body>${trimmedHtml ? stripDangerousHtml(previewBody) : `<main class="mwu-snippet-preview-main"><section><span>${config.title}</span><h1>No markup saved yet</h1><p>Paste or edit the HTML in the CRM, then save to create the global ${kind} content.</p></section></main>`}</body>
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
  const pageSections = page?.sections || page?.page_sections || page?.pageSections || [];

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
    rawHtml: page?.rawHtml || page?.raw_html || "",
    bodyHtml: page?.bodyHtml || page?.body_html || "",
    customCss: page?.customCss || page?.custom_css || "",
    styles: { ...defaultPageStyles, ...(page?.styles || page?.pageStyles || {}) },
    updatedAt: page?.updatedAt || page?.updated_at || todayIso(),
    createdAt: page?.createdAt || page?.created_at || page?.updatedAt || page?.updated_at || todayIso(),
    updatedBy: page?.updatedBy || page?.updated_by || "Content Editor",
    revisions: Array.isArray(page?.revisions) ? page.revisions : [],
    sections: Array.isArray(pageSections) && pageSections.length
      ? pageSections.map(normalizeSection)
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
    page_type: getApiPageType(page.type),
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
    // Avoid sending the same large document multiple times; body_html is enough to rebuild editable pages locally.
    raw_html: isHtmlBacked ? "" : page.rawHtml,
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

const looksLikeLocalPageId = (value = "") => /^[a-z0-9]+-[a-z0-9]+$/i.test(String(value || ""));

const isLocalDraftPage = (page = {}) =>
  Boolean(page.isLocalDraft || page._isLocalDraft || page.localOnly || looksLikeLocalPageId(page.id));

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

const getSiteChromeHtml = (page = {}) =>
  page?.bodyHtml ||
  page?.body_html ||
  page?.rawHtml ||
  page?.raw_html ||
  page?.sections?.find((section) => section?.html || section?.body || section?.content)?.html ||
  page?.sections?.find((section) => section?.html || section?.body || section?.content)?.body ||
  page?.sections?.find((section) => section?.html || section?.body || section?.content)?.content ||
  "";

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
    const cta = doc.querySelector(".header-action .th-btn");
    const nextItems = Array.isArray(model.menuItems) ? model.menuItems : [];

    if (menuRoot) {
      const originalItems = Array.from(menuRoot.children);
      const nextHtml = nextItems.map((item) => {
        if (item.isMega) {
          const original = originalItems[item.sourceIndex];
          if (!original) {
            return buildVisualHeaderMenuItemHtml(item);
          }
          const clone = original.cloneNode(true);
          const directLink = Array.from(clone.children).find((child) => child.tagName?.toLowerCase() === "a");
          if (directLink) {
            directLink.textContent = item.title || "Programs";
            directLink.setAttribute("href", item.href || "#");
          }
          return clone.outerHTML;
        }
        return buildVisualHeaderMenuItemHtml(item);
      }).join("\n");

      menuRoot.innerHTML = nextHtml;
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
  if (!Array.isArray(pages) || !pages.length || !Array.isArray(menu) || !menu.length) {
    return pages;
  }

  const nextPages = pages.map((page) => ({ ...page }));
  const indexBySlug = new Map(
    nextPages.map((page, index) => [slugify(page.slug || page.title || ""), index])
  );

  const applyToPage = (slug, updater) => {
    const index = indexBySlug.get(slugify(slug));
    if (index === undefined) return;
    nextPages[index] = updater(nextPages[index]);
  };

  menu.forEach((item, menuIndex) => {
    const itemTitle = String(item?.title || item?.page_title || "").trim();
    const itemSlug = slugify(item?.slug || normalizeNavigationHrefToSlug(item?.custom_url || ""));
    const children = Array.isArray(item?.children) ? item.children : [];

    if (itemSlug) {
      applyToPage(itemSlug, (page) => ({
        ...page,
        menu: itemTitle || page.menu,
        menuOrder: Number(item?.sort_order || menuIndex + 1) || page.menuOrder,
        parentSlug: ""
      }));
    }

    children.forEach((child, childIndex) => {
      const childSlug = slugify(child?.slug || normalizeNavigationHrefToSlug(child?.custom_url || ""));
      if (!childSlug) return;
      applyToPage(childSlug, (page) => ({
        ...page,
        menu: itemTitle || page.menu,
        menuOrder: Number(child?.sort_order || childIndex + 1) || page.menuOrder,
        parentSlug: itemSlug || page.parentSlug || ""
      }));
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
    page_type: config.type,
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
  const [adminToken, setAdminToken] = useState(getStoredAdminToken);
  const [pages, setPages] = useState([]);
  const [programCategories, setProgramCategories] = useState(loadProgramCategories);
  const [programs, setPrograms] = useState(loadPrograms);
  const [activeView, setActiveView] = useState("dashboard");
  const [activePageId, setActivePageId] = useState(standaloneEditorPageId);
  const [formPage, setFormPage] = useState(emptyPage);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [menuFilter, setMenuFilter] = useState("All");
  const [sortKey, setSortKey] = useState("updatedAt");
  const [mediaLibraryVersion, setMediaLibraryVersion] = useState(0);
  const [mediaStorageMode, setMediaStorageMode] = useState("local");
  const [siteChromeTab, setSiteChromeTab] = useState("header");
  const [navigationSource, setNavigationSource] = useState("");
  const [selectedPageIds, setSelectedPageIds] = useState([]);
  const [editorTab, setEditorTab] = useState("builder");
  const [notice, setNotice] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dangerDialog, setDangerDialog] = useState(null);
  const importInputRef = useRef(null);
  const liveMenuGroupChoices = useMemo(() => getMenuGroupChoices(pages), [pages]);

  useEffect(() => {
    window.localStorage.removeItem("mwu-crm-pages-v1");
    window.localStorage.removeItem("mwu-admin-token");
    window.localStorage.removeItem("authToken");
    window.localStorage.removeItem("token");
  }, []);

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

          if (!menu.length) {
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

        const firstNormalPage = apiPages.find(isNormalWebsitePage) || apiPages[0] || emptyPage();
        setPages(apiPages);
        setNavigationSource(resolvedNavigationSource);
        setActivePageId((currentId) =>
          apiPages.some((page) => String(page.id) === String(currentId)) ? currentId : firstNormalPage.id || ""
        );
        setFormPage((currentPage) =>
          apiPages.find((page) => String(page.id) === String(currentPage.id)) || firstNormalPage
        );
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
  }, [mediaLibraryVersion]);

  useEffect(() => {
    let cancelled = false;

    const loadRemoteMediaLibrary = async () => {
      try {
        const response = await fetch(mediaApiUrl(), {
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
      setFormPage(selected);
    }
  }, [activePageId, pages]);

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
    mediaLibrary = nextLibrary.map(normalizeMediaItem);
    setMediaLibraryVersion((current) => current + 1);
    return mediaLibrary;
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
        id: makeId(),
        title: file.name.replace(/\.[^.]+$/, "") || "Uploaded media",
        type: "Upload",
        path,
        bytes: file.size,
        size: formatMediaByteSize(file.size),
        uploadedAt: todayIso(),
        dimensions: buildMediaDimensions(width, height),
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

    if (mediaStorageMode === "api") {
      let credentials = getStoredMediaApiCredentials();
      if (!credentials.username || !credentials.password) {
        credentials = requestMediaApiCredentials() || {};
      }
      if (!credentials.username || !credentials.password) {
        setNotice("Upload cancelled. Website media credentials are required to store images on the live website.");
        return [];
      }

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
        const item = normalizeMediaApiItem(payload?.item || payload?.data?.item || {});
        uploadedItems.push(item);
        const nextItems = Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.data?.items)
            ? payload.data.items
            : null;
        if (nextItems) {
          commitMediaLibrary(mergeMediaLibraries(nextItems, initialMediaLibrary));
        }
      }
      if (uploadedItems.length) {
        if (!mediaLibrary.some((entry) => uploadedItems.some((uploaded) => uploaded.path === entry.path))) {
          commitMediaLibrary(mergeMediaLibraries(uploadedItems, mediaLibrary, initialMediaLibrary));
        }
        setNotice(`Uploaded ${uploadedItems.length} media item${uploadedItems.length === 1 ? "" : "s"} to the website media library.`);
        return uploadedItems;
      }

      return [];
    }

    return uploadMediaFilesLocally(fileList);
  };

  const deleteMediaItem = async (mediaId) => {
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
    const targetPage = pages.find((page) => String(page.id) === String(pageId));
    if (targetPage) {
      setFormPage(targetPage);
      setActivePageId(targetPage.id);
    }
    setEditorTab(tab);
    setActiveView("page-editor");
  };

  const loadSiteChromeSnippet = async (kind, page) => {
    const currentPage = createSiteChromePage(kind, page || {});
    if (hasMeaningfulSiteChromeHtml(currentPage)) {
      return currentPage;
    }

    const sourcePath = currentPage.sourceUrl || getSiteChromeConfig(kind).sourceUrl;
    const sourceUrl = getFetchableLiveAssetUrl(sourcePath);
    if (!sourceUrl) {
      return currentPage;
    }

    try {
      const response = await fetch(sourceUrl, { headers: { Accept: "text/html" } });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const html = await response.text();
      return createSiteChromePage(kind, {
        ...currentPage,
        bodyHtml: html,
        rawHtml: "",
        sourceUrl: sourcePath
      });
    } catch {
      return currentPage;
    }
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
      ? normalizePage(result.data || result.page)
      : withoutLocalPageMarkers(nextPage);

    return { savedPage, pageExistsInDatabase };
  };

  const openSiteChromeView = async (kind = "header") => {
    const config = getSiteChromeConfig(kind);
    let existing = findSiteChromePage(pages, kind);
    if (existing?.id && !hasMeaningfulSiteChromeHtml(existing)) {
      try {
        const detailResponse = await fetch(apiUrl(`/admin/pages/${encodeURIComponent(existing.id)}`), {
          headers: getAuthHeaders(adminToken)
        });
        if (detailResponse.ok) {
          const detailPayload = await readOptionalJson(detailResponse);
          const detailedPage = normalizePage({
            ...(detailPayload?.page || detailPayload?.data?.page || {}),
            sections: detailPayload?.sections || detailPayload?.data?.sections || []
          });
          if (isMatchingSiteChromePage(detailedPage, kind)) {
            existing = detailedPage;
          }
        }
      } catch {
        // Fall back to source-file import below if the detailed page lookup fails.
      }
    }
    let nextPage = await loadSiteChromeSnippet(kind, existing || {});
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
    } else {
      setNotice(`Editing ${config.title.toLowerCase()} content.`);
    }
  };

  const updateSiteChromeHtml = (kind, value) => {
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

    savePage(event, pageOverride);
  };

  const createNewPage = () => {
    const draft = { ...emptyPage(), isLocalDraft: true };
    setPages((current) => [draft, ...current]);
    setActivePageId(draft.id);
    setFormPage(draft);
    setEditorTab("content");
    setActiveView("page-editor");
    setNotice("Draft page created.");
  };

  const savePage = async (event, pageOverride = null) => {
    event?.preventDefault?.();
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
      setActivePageId(savedPage.id);
      setFormPage(savedPage);
      setNotice(pageExistsInDatabase ? "Page updated in database." : "New page added to database.");
    } catch (error) {
      if (String(error.message || "").includes("HTTP 401")) {
        clearAdminSession();
        setAdminToken("");
      }

      setNotice(error.message || "Page save failed.");
    }
  };

  const updateActiveStatus = (status) => {
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
    try {
      const response = await fetch(apiUrl("/admin/pages?limit=200"), {
        headers: getAuthHeaders(adminToken)
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, "Admin pages API is not available."));
      }

      const payload = await response.json();
      const incomingPages = (payload.data || payload.pages || []).map((page, index) =>
        normalizePage({
          ...page,
          id: page.id || makeId(),
          menuOrder: page.menuOrder || index + 1,
          updatedAt: todayIso(),
          updatedBy: page.updatedBy || "Admin API"
        })
      );

      if (!incomingPages.length) {
        setNotice("No pages found in Admin API.");
        return;
      }

      const selectedPage = incomingPages.find(isNormalWebsitePage) || incomingPages[0];

      setPages(incomingPages);
      setActivePageId(selectedPage.id);
      setFormPage(selectedPage);
      setActiveView("pages");
      setNotice(`Loaded ${incomingPages.length} pages from Admin API.`);
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
    setProgramCategories((current) =>
      current.map((category) => {
        if (category.id !== categoryId) {
          return category;
        }

        const nextCategory = {
          ...category,
          [field]: field === "featured" ? Boolean(value) : value,
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
  };

  const deleteProgramCategory = async (categoryId) => {
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

  const addProgram = () => {
    const program = normalizeProgram({
      title: "New Academic Program",
      slug: `new-academic-program-${programs.length + 1}`,
      categorySlug: programCategories[0]?.slug || "undergraduate-programs",
      status: "Draft"
    });

    setPrograms((current) => [program, ...current]);
    setNotice("Program created.");
  };

  const updateProgram = (programId, field, value) => {
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
    setNotice("Program removed.");
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

    rememberAdminSession(token);
    setAdminToken(token);
    setNotice("Logged in successfully.");
    setActiveView("dashboard");
  };

  const handleLogout = () => {
    clearAdminSession();
    setAdminToken("");
    setPages([]);
    setActivePageId("");
    setFormPage(emptyPage());
    setSelectedPageIds([]);
    setNotice("");
  };

  if (!adminToken) {
    return <LoginView onLogin={handleLogin} />;
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
              setMobileNavOpen(false);
              setSidebarCollapsed(true);
            }}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="main-nav" aria-label="CRM navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={activeView === item.id ? "active" : ""}
                onClick={() => {
                  if (item.id === "site-chrome") {
                    openSiteChromeView(siteChromeTab);
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

        <div className="sidebar-panel">
          <span>Website Status</span>
          <strong>Live content sync</strong>
          <p>{stats.published} published pages, {stats.review} in review.</p>
          <div className="mini-meter">
            <i style={{ width: `${Math.min(stats.averageSeo, 100)}%` }} />
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <button
            className={`icon-button mobile-toggle ${sidebarCollapsed ? "force-visible" : ""}`}
            type="button"
            onClick={() => {
              setSidebarCollapsed(false);
              if (window.innerWidth <= 860) {
                setMobileNavOpen(true);
              }
            }}
            aria-label="Open sidebar"
          >
            <ListTree size={19} />
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
            <button className="primary-button" type="button" onClick={createNewPage}>
              <Plus size={17} />
              <span>Add Page</span>
            </button>
            <button className="icon-button" type="button" onClick={handleLogout} aria-label="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </header>

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

        {activeView === "dashboard" && (
          <Dashboard
            pages={contentManagedPages}
            stats={stats}
            setActiveView={setActiveView}
            setActivePageId={setActivePageId}
            setEditorTab={setEditorTab}
            createNewPage={createNewPage}
          />
        )}

        {activeView === "pages" && (
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
            editorTab={editorTab}
            setEditorTab={setEditorTab}
            updateField={updateField}
            updateSection={updateSection}
            addSection={addSection}
            duplicateSection={duplicateSection}
            moveSection={moveSection}
            removeSection={removeSection}
            savePage={savePage}
            updateActiveStatus={updateActiveStatus}
            duplicatePage={duplicatePage}
            deletePage={deletePage}
            deletePageById={deletePageById}
            restoreRevision={restoreRevision}
            exportPage={exportPage}
            openPageEditorView={openPageEditorView}
          />
        )}

        {activeView === "page-editor" && (
          <PageEditor
            page={formPage}
            menuGroupChoices={liveMenuGroupChoices}
            editorTab={editorTab}
            setEditorTab={setEditorTab}
            updateField={updateField}
            updateSection={updateSection}
            addSection={addSection}
            duplicateSection={duplicateSection}
            moveSection={moveSection}
            removeSection={removeSection}
            savePage={savePage}
            updateActiveStatus={updateActiveStatus}
            duplicatePage={duplicatePage}
            deletePage={deletePage}
            restoreRevision={restoreRevision}
            exportPage={exportPage}
          />
        )}

        {activeView === "programs" && (
          <ProgramsView
            categories={programCategories}
            programs={programs}
            programPages={programPages}
            mainPage={mainProgramsPage}
            updateMainPage={updateMainProgramsPage}
            setActivePageId={setActivePageId}
            setActiveView={setActiveView}
            setEditorTab={setEditorTab}
            deletePageById={deletePageById}
            addCategory={addProgramCategory}
            updateCategory={updateProgramCategory}
            deleteCategory={deleteProgramCategory}
            addProgram={addProgram}
            updateProgram={updateProgram}
            deleteProgram={deleteProgram}
          />
        )}

        {activeView === "blogs" && (
          <ContentPagesView
            title="Blog Pages"
            eyebrow="Blog and News Pages"
            description="Review imported blog listing and article pages separately from standard website pages."
            pages={blogPages}
            emptyLabel="No blog pages match the current filters."
            icon={MessageSquare}
            setActivePageId={setActivePageId}
            setActiveView={setActiveView}
            setEditorTab={setEditorTab}
            deletePageById={deletePageById}
          />
        )}

        {activeView === "events" && (
          <ContentPagesView
            title="Event Pages"
            eyebrow="Event Listing and Detail Pages"
            description="Review imported event listing and event detail pages separately from standard website pages."
            pages={eventPages}
            emptyLabel="No event pages match the current filters."
            icon={CalendarDays}
            setActivePageId={setActivePageId}
            setActiveView={setActiveView}
            setEditorTab={setEditorTab}
            deletePageById={deletePageById}
          />
        )}

        {activeView === "builder" && (
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

        {activeView === "media" && (
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

        {activeView === "crm" && <CrmView />}

        {activeView === "settings" && <SettingsView />}

        {activeView === "menus" && (
          <MenusView
            pages={standardPages}
            menuGroupChoices={liveMenuGroupChoices}
            savePage={savePage}
            setPages={setPages}
            setFormPage={setFormPage}
            setActivePageId={setActivePageId}
            setActiveView={setActiveView}
            setEditorTab={setEditorTab}
          />
        )}

        {activeView === "site-chrome" && (
          <SiteChromeView
            kind={siteChromeTab}
            page={activeSiteChromePage}
            openSiteChromeView={openSiteChromeView}
            updateField={updateField}
            updateHtml={updateSiteChromeHtml}
            savePage={saveSiteChromePage}
          />
        )}
      </main>
    </div>
  );
}

function DangerConfirmDialog({
  title,
  message,
  details = [],
  verificationText = "DELETE",
  continueLabel = "Continue",
  finalLabel = "Delete Permanently",
  onCancel,
  onConfirm
}) {
  const [step, setStep] = useState(1);
  const [typedValue, setTypedValue] = useState("");
  const normalizedVerification = String(verificationText || "DELETE").trim();

  useEffect(() => {
    setStep(1);
    setTypedValue("");
  }, [title, message, normalizedVerification]);

  const canConfirm = typedValue.trim() === normalizedVerification;

  return (
    <div className="danger-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="danger-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="danger-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="danger-dialog-head">
          <div>
            <span className="eyebrow">Double Verification</span>
            <h2 id="danger-dialog-title">{title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Close confirmation dialog">
            <X size={16} />
          </button>
        </div>

        <div className="danger-dialog-body">
          <p>{message}</p>
          {details.length > 0 && (
            <div className="danger-dialog-details">
              {details.map((detail) => (
                <div key={detail} className="danger-dialog-detail-row">
                  <span>{detail}</span>
                </div>
              ))}
            </div>
          )}

          <div className="danger-dialog-steps">
            <div className={`danger-step ${step >= 1 ? "active" : ""}`}>
              <strong>1</strong>
              <span>Review the deletion details</span>
            </div>
            <div className={`danger-step ${step >= 2 ? "active" : ""}`}>
              <strong>2</strong>
              <span>Type <code>{normalizedVerification}</code> to confirm</span>
            </div>
          </div>

          {step === 2 && (
            <label className="danger-dialog-input">
              <span>Verification text</span>
              <input
                value={typedValue}
                onChange={(event) => setTypedValue(event.target.value)}
                placeholder={normalizedVerification}
                autoFocus
              />
              <small>This action cannot be undone.</small>
            </label>
          )}
        </div>

        <div className="danger-dialog-actions">
          <button className="ghost-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          {step === 1 ? (
            <button className="danger-button" type="button" onClick={() => setStep(2)}>
              {continueLabel}
            </button>
          ) : (
            <button className="danger-button" type="button" onClick={onConfirm} disabled={!canConfirm}>
              {finalLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LoginView({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submitLogin = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await onLogin({ email, password });
    } catch (loginError) {
      setError(loginError.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="login-brand">
          <img src={assets.logoOfficial} alt="Madda Walabu University" />
          <div>
            <span className="eyebrow">Madda Walabu University</span>
            <h1>Admin CRM Login</h1>
          </div>
        </div>

        <form className="login-form" onSubmit={submitLogin}>
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
            />
          </Field>

          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button className="primary-button" type="submit" disabled={loading}>
            <ShieldCheck size={17} />
            <span>{loading ? "Signing in..." : "Sign in"}</span>
          </button>
        </form>
      </section>
    </main>
  );
}

function Dashboard({ pages, stats, setActiveView, setActivePageId, setEditorTab, createNewPage }) {
  const recentPages = [...pages]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 4);

  const contentHealth = [
    { label: "Published Pages", value: stats.published, icon: Globe2, tone: "blue" },
    { label: "Review Queue", value: stats.review, icon: ClipboardList, tone: "gold" },
    { label: "Scheduled", value: stats.scheduled, icon: CalendarDays, tone: "green" },
    { label: "SEO Score", value: `${stats.averageSeo}%`, icon: BarChart3, tone: "navy" }
  ];
  const openRecentPage = (page) => {
    if (!page) return;
    if (!isLocalDraftPage(page)) {
      openPageEditorTab(page.id);
      return;
    }
    setActivePageId(page.id);
    setEditorTab("content");
    setActiveView("page-editor");
  };

  const moduleActions = [
    { icon: GraduationCap, label: "Programs", value: "Undergraduate, graduate, PhD", onClick: () => setActiveView("programs") },
    { icon: BookOpen, label: "Admissions", value: "Requirements, forms, scholarships", onClick: () => setActiveView("pages") },
    { icon: MessageSquare, label: "Blog and Events", value: "Announcements and research updates", onClick: () => setActiveView("blogs") },
    { icon: ShieldCheck, label: "Approvals", value: "Draft, review, scheduled, publish", onClick: () => setActiveView("pages") }
  ];

  return (
    <section className="dashboard-grid">
      <div className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Website Control Center</span>
          <h2>Manage MWU pages with the same academic, blue, gold, and green visual language.</h2>
          <p>
            Create pages, prepare homepage sections, review content quality, and preview how each page will appear on the public website.
          </p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={createNewPage}>
              <Plus size={17} />
              <span>Add Page</span>
            </button>
            <button className="ghost-button light" type="button" onClick={() => setActiveView("pages")}>
              <FileText size={17} />
              <span>Manage Pages</span>
            </button>
          </div>
        </div>
        <div className="hero-stat-stack">
          <span>16320+</span>
          <strong>Students signal from the public site</strong>
          <i />
          <span>79</span>
          <strong>Programs and departments managed</strong>
        </div>
      </div>

      <div className="metric-grid">
        {contentHealth.map((item) => {
          const Icon = item.icon;
          return (
            <button className={`metric-card ${item.tone}`} key={item.label} type="button" onClick={() => setActiveView("pages")}>
              <Icon size={20} />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </button>
          );
        })}
      </div>

      <section className="panel span-two">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Content Pipeline</span>
            <h2>Recent Website Pages</h2>
          </div>
          <button className="ghost-button" type="button" onClick={() => setActiveView("pages")}>
            <Eye size={17} />
            <span>Open Pages</span>
          </button>
        </div>

        <div className="recent-grid">
          {recentPages.map((page) => (
            <button
              className="recent-card"
              type="button"
              key={page.id}
              onClick={() => openRecentPage(page)}
            >
              <img src={getAutoThumbnailForPage(page)} alt="" />
              <span className={`status-badge ${page.status.toLowerCase()}`}>{page.status}</span>
              <strong>{page.title}</strong>
              <small>{page.menu} / {page.type}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head compact">
          <div>
            <span className="eyebrow">Modules</span>
            <h2>Website Sections</h2>
          </div>
        </div>
        <div className="module-list">
          {moduleActions.map((item) => (
            <button className="module-row button-row" key={item.label} type="button" onClick={item.onClick}>
              <item.icon size={18} />
              <div>
                <strong>{item.label}</strong>
                <span>{item.value}</span>
              </div>
              <ChevronRight size={17} />
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head compact">
          <div>
            <span className="eyebrow">Publishing</span>
            <h2>Queue</h2>
          </div>
        </div>
        <div className="timeline">
          <TimelineItem label="Review homepage hero" detail="Content Office" status="Today" />
          <TimelineItem label="Publish admission requirements" detail="Admissions Office" status="Scheduled" />
          <TimelineItem label="Update program media" detail="College of Agriculture" status="Pending" />
        </div>
      </section>
    </section>
  );
}

function PagesView({
  pages,
  allPages,
  menuGroupChoices,
  activePageId,
  setActivePageId,
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  menuFilter,
  setMenuFilter,
  sortKey,
  setSortKey,
  selectedPageIds,
  toggleSelectedPage,
  toggleAllFiltered,
  bulkUpdateStatus,
  bulkDeletePages,
  bulkDuplicate,
  exportAllPages,
  importLivePublishedPages,
  importInputRef,
  importPages,
  createNewPage,
  deletePageById,
  openPageEditorView
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [viewMode, setViewMode] = useState("list");
  const pageTypeOptions = useMemo(
    () => Array.from(new Set(allPages.map((page) => page.type).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [allPages]
  );
  const totalPages = Math.max(Math.ceil(pages.length / pageSize), 1);
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = pages.length ? (safePage - 1) * pageSize : 0;
  const paginatedPages = pages.slice(pageStart, pageStart + pageSize);
  const pageEnd = Math.min(pageStart + paginatedPages.length, pages.length);
  const visibleSelected =
    paginatedPages.length > 0 &&
    paginatedPages.every((page) => selectedPageIds.some((id) => String(id) === String(page.id)));

  useEffect(() => {
    setCurrentPage(1);
  }, [query, statusFilter, typeFilter, menuFilter, sortKey, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const selectPageRow = (pageId) => {
    setActivePageId(pageId);
  };

  const openPageForEdit = (page) => {
    if (!page) return;
    if (!isLocalDraftPage(page)) {
      openPageEditorTab(page.id);
      return;
    }
    openPageEditorView(page.id, "content");
  };

  const openPageSections = (pageId) => {
    openPageEditorView(pageId, "builder");
  };

  return (
    <section className="admin-view pages-redesign">
      <div className="view-header">
        <div>
          <span className="eyebrow">All Website Pages</span>
          <h2>Editing and Management</h2>
        </div>
        <div className="header-actions">
          <button className="ghost-button" type="button" onClick={importLivePublishedPages}>
            <Globe2 size={17} />
            <span>Import Live Published</span>
          </button>
          <button className="ghost-button" type="button" onClick={() => importInputRef.current?.click()}>
            <FolderOpen size={17} />
            <span>Import</span>
          </button>
          <input ref={importInputRef} className="hidden-input" type="file" accept="application/json" onChange={importPages} />
          <button className="ghost-button" type="button" onClick={exportAllPages}>
            <Download size={17} />
            <span>Export All</span>
          </button>
          <button className="primary-button" type="button" onClick={createNewPage}>
            <Plus size={17} />
            <span>Add Page</span>
          </button>
        </div>
      </div>

      <div className="view-content">
        <div className="filter-bar manager-toolbar pages-toolbar">
          <label className="search-field">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or slug" />
          </label>

          <label className="select-field">
            <Filter size={17} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option>All</option>
              {pageStatusFilters.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>

          <label className="select-field">
            <Layers size={17} />
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option>All</option>
              {pageTypeOptions.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>

          <label className="select-field">
            <ListChecks size={17} />
            <select value={menuFilter} onChange={(event) => setMenuFilter(event.target.value)}>
              <option>All</option>
              {menuGroupChoices.map((group) => (
                <option key={group.value || "not-in-menu"} value={group.value}>
                  {group.label}
                </option>
              ))}
            </select>
          </label>

          <label className="select-field">
            <BarChart3 size={17} />
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
              <option value="updatedAt">Latest Updated</option>
              <option value="title">Title A-Z</option>
              <option value="menuOrder">Menu Order</option>
              <option value="status">Status</option>
            </select>
          </label>

          <label className="select-field">
            <ListTree size={17} />
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              {[25, 50, 100].map((size) => (
                <option value={size} key={size}>{size} per page</option>
              ))}
            </select>
          </label>

          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>

        <div className={`bulk-bar ${selectedPageIds.length ? "show" : ""}`}>
          <span className="count"><span>{selectedPageIds.length}</span> selected</span>
          <button className="ghost-button" type="button" onClick={() => bulkUpdateStatus("Published")}>
            <Send size={17} />
            <span>Publish</span>
          </button>
          <button className="ghost-button" type="button" onClick={() => bulkUpdateStatus("Review")}>
            <ShieldCheck size={17} />
            <span>Review</span>
          </button>
          <button className="ghost-button" type="button" onClick={() => bulkUpdateStatus("Archived")}>
            <Archive size={17} />
            <span>Archive</span>
          </button>
          <button className="danger-button" type="button" onClick={bulkDeletePages}>
            <Trash2 size={17} />
            <span>Delete</span>
          </button>
          <button className="ghost-button" type="button" onClick={bulkDuplicate}>
            <Copy size={17} />
            <span>Duplicate</span>
          </button>
        </div>

        <div className="table-panel panel">
          {viewMode === "list" ? (
            <div className="pages-table" role="table" aria-label="All website pages">
              <div className="pages-row table-head" role="row">
                <label className="check-cell">
                  <input
                    type="checkbox"
                    checked={visibleSelected}
                    onChange={() => toggleAllFiltered(paginatedPages.map((page) => page.id))}
                  />
                </label>
                <span>Page</span>
                <span>Type</span>
                <span>Menu</span>
                <span>Status</span>
                <span>SEO</span>
                <span>Updated</span>
                <span>Actions</span>
              </div>

              {paginatedPages.map((page) => (
                <div className={`pages-row ${String(page.id) === String(activePageId) ? "active" : ""}`} role="row" key={page.id}>
                  <label className="check-cell">
                    <input
                      type="checkbox"
                      checked={selectedPageIds.some((id) => String(id) === String(page.id))}
                      onChange={() => toggleSelectedPage(page.id)}
                    />
                  </label>
                  <button className="page-title-cell" type="button" onClick={() => selectPageRow(page.id)}>
                    <img src={getAutoThumbnailForPage(page)} alt="" />
                    <span>
                      <strong>{page.title}</strong>
                      <small>/{page.slug}</small>
                    </span>
                  </button>
                  <span>{page.type}</span>
                  <span>{getMenuReferenceLabel(page, allPages)}</span>
                  <StatusPill status={page.status} />
                  <span>{getSeoScore(page)}%</span>
                  <span>{formatDate(page.updatedAt)}</span>
                  <div className="table-actions">
                    <button className="icon-button" type="button" aria-label="Edit page" onClick={() => openPageForEdit(page)}>
                      <Pencil size={16} />
                    </button>
                    <button className="icon-button" type="button" aria-label="View sections" onClick={() => openPageSections(page.id)}>
                      <ListTree size={16} />
                    </button>
                    <button className="icon-button danger" type="button" aria-label="Delete page" onClick={() => deletePageById(page.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="pages-grid" role="list" aria-label="All website pages grid">
              {paginatedPages.map((page) => (
                <article className={`page-grid-card ${String(page.id) === String(activePageId) ? "active" : ""}`} key={page.id}>
                  <div className="page-grid-card-top">
                    <label className="check-cell">
                      <input
                        type="checkbox"
                        checked={selectedPageIds.some((id) => String(id) === String(page.id))}
                        onChange={() => toggleSelectedPage(page.id)}
                      />
                    </label>
                    <StatusPill status={page.status} />
                  </div>
                  <button className="page-grid-thumb" type="button" onClick={() => selectPageRow(page.id)}>
                    <img src={getAutoThumbnailForPage(page)} alt="" />
                  </button>
                  <div className="page-grid-card-body">
                    <strong>{page.title}</strong>
                    <small>/{page.slug}</small>
                    <p>{page.summary}</p>
                  </div>
                  <div className="page-grid-card-meta">
                    <span>{page.type}</span>
                    <span>{getMenuReferenceLabel(page, allPages)}</span>
                    <span>SEO {getSeoScore(page)}%</span>
                    <span>{formatDate(page.updatedAt)}</span>
                  </div>
                  <div className="page-grid-card-actions">
                    <button className="icon-button" type="button" aria-label="Edit page" onClick={() => openPageForEdit(page)}>
                      <Pencil size={16} />
                    </button>
                    <button className="icon-button" type="button" aria-label="View sections" onClick={() => openPageSections(page.id)}>
                      <ListTree size={16} />
                    </button>
                    <button className="icon-button danger" type="button" aria-label="Delete page" onClick={() => deletePageById(page.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
              {!paginatedPages.length && <p className="content-pages-empty">No pages match the current filters.</p>}
            </div>
          )}

          <div className="pagination-bar">
            <span>
              Showing {pages.length ? pageStart + 1 : 0}-{pageEnd} of {pages.length} pages
            </span>
            <div className="pagination-actions">
              <button className="ghost-button" type="button" aria-label="First page" disabled={safePage <= 1} onClick={() => setCurrentPage(1)}>
                <ChevronsLeft size={16} />
              </button>
              <button className="ghost-button" type="button" aria-label="Previous page" disabled={safePage <= 1} onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}>
                <ArrowUp size={16} />
              </button>
              <strong>Page {safePage} of {totalPages}</strong>
              <button className="ghost-button" type="button" aria-label="Next page" disabled={safePage >= totalPages} onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}>
                <ArrowDown size={16} />
              </button>
              <button className="ghost-button" type="button" aria-label="Last page" disabled={safePage >= totalPages} onClick={() => setCurrentPage(totalPages)}>
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ViewModeToggle({ value = "grid", onChange }) {
  return (
    <div className="view-mode-toggle" role="group" aria-label="View mode toggle">
      <button
        type="button"
        className={value === "list" ? "active" : ""}
        onClick={() => onChange("list")}
        aria-pressed={value === "list"}
      >
        <ListChecks size={16} />
        <span>List</span>
      </button>
      <button
        type="button"
        className={value === "grid" ? "active" : ""}
        onClick={() => onChange("grid")}
        aria-pressed={value === "grid"}
      >
        <LayoutDashboard size={16} />
        <span>Grid</span>
      </button>
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
  const [activeSectionId, setActiveSectionId] = useState(page.sections?.[0]?.id || "");
  const [canvasMode, setCanvasMode] = useState("exact");
  const [devicePreview, setDevicePreview] = useState("desktop");
  const [editableSourceHtml, setEditableSourceHtml] = useState("");
  const [editableStatus, setEditableStatus] = useState("idle");
  const [editableError, setEditableError] = useState("");
  const [selectedLiveElement, setSelectedLiveElement] = useState(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerQuery, setMediaPickerQuery] = useState("");
  const [selectedMediaId, setSelectedMediaId] = useState("");
  const mediaUploadInputRef = useRef(null);
  const editableFrameRef = useRef(null);
  const editedBodyRef = useRef("");
  const editedFullHtmlRef = useRef("");
  const pendingImageReplaceIdRef = useRef("");
  const livePageUrl = getLivePageUrl(page);
  const activeSection =
    (page.sections || []).find((section) => String(section.id) === String(activeSectionId)) ||
    page.sections?.[0];

  const editableSrcDoc = useMemo(() => {
    if (!editableSourceHtml) return "";
    return buildEditableLiveDocument(
      {
        ...page,
        title: page.title,
        customCss: page.customCss || page.custom_css || ""
      },
      editableSourceHtml
    );
  }, [editableSourceHtml, page.id, page.title, page.customCss, page.custom_css]);

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

  const loadEditableHtml = async ({ force = false } = {}) => {
    const storedDocument = getStoredEditableDocument(page);
    const hasSavedEditableMarkup = hasPersistedEditableMarkup(page);

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

    const candidates = getEditableFetchCandidates(page);
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
    if (!page.sections?.some((section) => String(section.id) === String(activeSectionId))) {
      setActiveSectionId(page.sections?.[0]?.id || "");
    }
  }, [activeSectionId, page.id, page.sections]);

  useEffect(() => {
    const storedDocument = getStoredEditableDocument(page);
    setEditableSourceHtml("");
    setEditableStatus("idle");
    setEditableError("");
    setSelectedLiveElement(null);
    setMediaPickerOpen(false);
    setMediaPickerQuery("");
    setSelectedMediaId("");
    editedBodyRef.current = storedDocument.bodyHtml;
    editedFullHtmlRef.current = storedDocument.fullHtml;
  }, [page.id]);

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
    if (canvasMode === "editable" && !editableSourceHtml && editableStatus !== "loading") {
      loadEditableHtml();
    }
  }, [canvasMode, editableSourceHtml, editableStatus, page.id]);

  useEffect(() => {
    const handleMessage = (event) => {
      const data = event.data || {};
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
      const fullHtml = restoreLiveAssetUrls(data.fullHtml || mergeBodyIntoHtml(editableSourceHtml || page.rawHtml || page.raw_html || "", bodyHtml));
      editedBodyRef.current = bodyHtml;
      editedFullHtmlRef.current = fullHtml;
      updateField("bodyHtml", bodyHtml);
      updateField("rawHtml", fullHtml);
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [editableSourceHtml, openMediaLibraryPicker, page.rawHtml, page.raw_html, selectedLiveElement?.id, updateField]);

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

  const saveEditablePage = (event) => {
    const pendingBodyHtml = editedBodyRef.current || page.bodyHtml || page.body_html || "";
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
          id: page.sections?.[0]?.id,
          type: "Raw HTML",
          title: page.title || "Page Markup",
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
            <h1>{page.title}</h1>
          </div>
        </div>
        <div className="standalone-actions">
          <StatusPill status={page.status} />
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
              <strong>{canvasMode === "exact" ? "Exact live website" : "Editable live HTML"}</strong>
              <small>{livePageUrl}</small>
            </div>
            <div className="standalone-canvas-tools">
              <div className="mode-switcher">
                <button type="button" className={canvasMode === "exact" ? "active" : ""} onClick={() => setCanvasMode("exact")}>Exact Live Design</button>
                <button type="button" className={canvasMode === "editable" ? "active" : ""} onClick={() => setCanvasMode("editable")}>Editable Blocks</button>
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
                title={`${page.title} exact live website`}
                src={livePageUrl}
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
              />
            </div>
          )}

          {canvasMode === "editable" && (
            <div className={`standalone-exact-frame standalone-editable-frame device-${devicePreview}`}>
              {editableStatus === "loading" && (
                <div className="editable-loading-overlay">
                  <strong>Fetching real page HTML...</strong>
                  <span>{getEditableFetchCandidates(page).join(" → ")}</span>
                </div>
              )}
              {editableError && (
                <div className="editable-error-bar">
                  <strong>Editable HTML warning:</strong>
                  <span>{editableError}</span>
                  <button type="button" onClick={() => loadEditableHtml({ force: true })}>Retry live fetch</button>
                </div>
              )}
              {editableSrcDoc ? (
                <iframe
                  ref={editableFrameRef}
                  title={`${page.title} editable live HTML`}
                  srcDoc={editableSrcDoc}
                  sandbox="allow-same-origin allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox"
                />
              ) : (
                <div className="editable-empty-state">
                  <LayoutTemplate size={34} />
                  <strong>No editable HTML loaded yet</strong>
                  <span>Click below to fetch the exact live website HTML into the editable canvas.</span>
                  <button className="primary-button" type="button" onClick={() => loadEditableHtml({ force: true })}>Fetch Real HTML</button>
                </div>
              )}
            </div>
          )}
        </main>

        <aside className="standalone-inspector">
          <div className="inspector-card">
            <span className="eyebrow">Page Settings</span>
            <Field label="Page Title">
              <input value={page.title} onChange={(event) => updateField("title", event.target.value)} />
            </Field>
            <Field label="URL Slug">
              <input value={page.slug} onChange={(event) => updateField("slug", event.target.value)} />
            </Field>
            <Field label="Source URL">
              <input value={page.sourceUrl || page.source_url || livePageUrl} onChange={(event) => updateField("sourceUrl", event.target.value)} />
            </Field>
            <Field label="Navigation Group">
              <select value={page.menu || ""} onChange={(event) => updateField("menu", event.target.value)}>
                {menuGroupChoices.map((group) => (
                  <option key={group.value} value={group.value}>{group.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Main Page">
              <select value={page.parentSlug || ""} onChange={(event) => updateField("parentSlug", event.target.value)}>
                <option value="">Default - main page</option>
                {allPages
                  .filter((item) => String(item.id) !== String(page.id))
                  .filter((item) => !item.parentSlug)
                  .sort((a, b) => a.title.localeCompare(b.title))
                  .map((item) => (
                    <option key={item.id} value={item.slug}>{item.title}</option>
                  ))}
              </select>
            </Field>
            <Field label="Navigation Order">
              <input type="number" min="1" value={page.menuOrder || 1} onChange={(event) => updateField("menuOrder", event.target.value)} />
            </Field>
            <div className="field-grid one">
              <Field label="Status">
                <select value={page.status} onChange={(event) => updateField("status", event.target.value)}>
                  {statusOptions.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </Field>
              <Field label="Page Type">
                <select value={page.type} onChange={(event) => updateField("type", event.target.value)}>
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

          <LiveElementInspector
            selectedElement={selectedLiveElement}
            canvasMode={canvasMode}
            onStartEditing={() => setCanvasMode("editable")}
            onRefreshHtml={() => loadEditableHtml({ force: true })}
            onApplyStyle={applyLiveElementStyle}
            onDuplicateElement={duplicateLiveElement}
            onDeleteElement={deleteLiveElement}
            onReplaceImage={openImageReplacePicker}
          />

          <div className="inspector-card">
            <span className="eyebrow">Live HTML Editor</span>
            <p className="inspector-note">
              Editable Blocks uses the static legacy HTML for editable markup and loads CSS/images from your local public/assets folder. Click text to edit, single-click images for crop/adjustments, and double-click images to replace them from the Media Library.
            </p>
            <div className="block-actions vertical">
              <button className="ghost-button" type="button" onClick={() => loadEditableHtml({ force: true })}>
                <Download size={16} />
                <span>Fetch / Refresh Real HTML</span>
              </button>
              <button className="ghost-button" type="button" onClick={() => setCanvasMode("editable")}>
                <Pencil size={16} />
                <span>Start Visual Editing</span>
              </button>
            </div>
            <Field label="Stored body HTML">
              <textarea rows="7" value={page.bodyHtml || ""} onChange={(event) => updateField("bodyHtml", event.target.value)} />
            </Field>
            <Field label="Custom CSS">
              <textarea rows="5" value={page.customCss || ""} onChange={(event) => updateField("customCss", event.target.value)} placeholder="CSS injected into this editable page" />
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

function PageEditor({
  page,
  menuGroupChoices = [],
  editorTab,
  setEditorTab,
  updateField,
  updateSection,
  addSection,
  duplicateSection,
  moveSection,
  removeSection,
  savePage,
  updateActiveStatus,
  duplicatePage,
  deletePage,
  restoreRevision,
  exportPage
}) {
  const seoScore = getSeoScore(page);
  const [activeBlockId, setActiveBlockId] = useState(page.sections[0]?.id || "");
  const [inspectorTab, setInspectorTab] = useState("content");
  const [devicePreview, setDevicePreview] = useState("desktop");
  const [canvasMode, setCanvasMode] = useState("exact");
  const [builderSidebarMode, setBuilderSidebarMode] = useState("elements");
  const activeBlock = page.sections.find((section) => section.id === activeBlockId) || page.sections[0];
  const activeBlockStyles = getSectionStyles(activeBlock);
  const pageStyles = getPageStyles(page);
  const livePageUrl = getLivePageUrl(page);

  const updatePageStyle = (field, value) => {
    updateField("styles", { ...pageStyles, [field]: value });
  };

  const updateBlockStyle = (field, value) => {
    if (!activeBlock) return;
    updateSection(activeBlock.id, "styles", { ...activeBlockStyles, [field]: value });
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
    setCanvasMode("exact");
  }, [page.id]);

  useEffect(() => {
    setBuilderSidebarMode("elements");
  }, [page.id]);

  useEffect(() => {
    if (editorTab === "content") {
      setEditorTab("builder");
    }
  }, [editorTab, setEditorTab]);

  const selectBuilderSection = (sectionId, nextInspectorTab = inspectorTab) => {
    setActiveBlockId(sectionId);
    setInspectorTab(nextInspectorTab);
    setBuilderSidebarMode("style");
  };

  const addLayoutPreset = (preset) => {
    preset.sections.forEach((type) => addSection(type));
  };

  return (
    <form className="editor-shell editor-redesign" onSubmit={savePage}>
      <div className="editor-main panel editor-surface">
        <div className="panel-head editor-head">
          <div>
            <span className="eyebrow">Editing</span>
            <h2>{page.title}</h2>
          </div>
          <div className="editor-actions">
            <button className="ghost-button" type="button" onClick={() => updateActiveStatus("Review")}>
              <ShieldCheck size={17} />
              <span>Send Review</span>
            </button>
            <button className="ghost-button" type="button" onClick={() => updateActiveStatus("Published")}>
              <Send size={17} />
              <span>Publish</span>
            </button>
            <button className="ghost-button" type="button" onClick={duplicatePage}>
              <Copy size={17} />
              <span>Duplicate</span>
            </button>
            <button className="ghost-button" type="button" onClick={exportPage}>
              <Upload size={17} />
              <span>Export</span>
            </button>
            <button className="primary-button" type="submit">
              <Save size={17} />
              <span>Save</span>
            </button>
          </div>
        </div>

        <div className="editor-tabs redesign-tabs" role="tablist" aria-label="Page editor tabs">
          {[
            { id: "builder", label: "Builder", icon: LayoutTemplate },
            { id: "seo", label: "SEO", icon: BarChart3 },
            { id: "settings", label: "Settings", icon: Settings },
            { id: "revisions", label: "Revisions", icon: Undo2 }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                className={editorTab === tab.id ? "active" : ""}
                onClick={() => setEditorTab(tab.id)}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {editorTab === "content" && (
          <div className="form-stack">
            <div className="field-grid">
              <Field label="Page Title">
                <input value={page.title} onChange={(event) => updateField("title", event.target.value)} />
              </Field>
              <Field label="URL Slug">
                <div className="slug-control">
                  <span>/</span>
                  <input value={page.slug} onChange={(event) => updateField("slug", event.target.value)} />
                  <button type="button" onClick={() => updateField("slug", slugify(page.title))}>
                    <LinkIcon size={16} />
                  </button>
                </div>
              </Field>
              <Field label="Page Type">
                <select value={page.type} onChange={(event) => updateField("type", event.target.value)}>
                  {pageTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </Field>
              <Field label="Menu Group">
                <select value={page.menu} onChange={(event) => updateField("menu", event.target.value)}>
                  {menuGroupChoices.map((group) => (
                    <option key={group.value} value={group.value}>{group.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Hero Headline">
              <textarea
                rows="2"
                value={page.heroHeadline}
                onChange={(event) => updateField("heroHeadline", event.target.value)}
              />
            </Field>

            <Field label="Summary">
              <textarea
                rows="3"
                value={page.summary}
                onChange={(event) => updateField("summary", event.target.value)}
              />
            </Field>

            <div className="field-grid">
              <Field label="Hero Tag">
                <input value={page.heroTag} onChange={(event) => updateField("heroTag", event.target.value)} />
              </Field>
              <Field label="Hero Image">
                <select value={page.heroImage} onChange={(event) => updateField("heroImage", event.target.value)}>
                  {mediaLibrary.map((media) => (
                    <option key={media.id} value={media.path}>
                      {media.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="CTA Label">
                <input value={page.ctaLabel} onChange={(event) => updateField("ctaLabel", event.target.value)} />
              </Field>
              <Field label="CTA URL">
                <input value={page.ctaUrl} onChange={(event) => updateField("ctaUrl", event.target.value)} />
              </Field>
            </div>

            <div className="section-editor">
              <div className="section-toolbar">
                <div>
                  <span className="eyebrow">Page Sections</span>
                  <h3>{page.sections.length} Blocks</h3>
                </div>
                <div className="section-add-menu">
                  <select aria-label="Add block type" onChange={(event) => addSection(event.target.value)} defaultValue="">
                    <option value="" disabled>Add Block</option>
                    {sectionTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <button className="ghost-button" type="button" onClick={() => addSection("Text Block")}>
                    <Plus size={17} />
                    <span>Add Text</span>
                  </button>
                </div>
              </div>

              {page.sections.map((section, index) => (
                <div className="section-row" key={section.id}>
                  <div className="section-count">
                    <GripVertical size={16} />
                    <span>{index + 1}</span>
                  </div>
                  <div className="section-fields">
                    <div className="field-grid">
                      <Field label="Block Type">
                        <select
                          value={section.type}
                          onChange={(event) => updateSection(section.id, "type", event.target.value)}
                        >
                          {sectionTypes.map((type) => (
                            <option key={type}>{type}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Eyebrow">
                        <input
                          value={section.eyebrow || ""}
                          onChange={(event) => updateSection(section.id, "eyebrow", event.target.value)}
                        />
                      </Field>
                      <Field label="Block Title">
                        <input
                          value={section.title}
                          onChange={(event) => updateSection(section.id, "title", event.target.value)}
                        />
                      </Field>
                      <Field label="Layout">
                        <select
                          value={section.layout || "Text first"}
                          onChange={(event) => updateSection(section.id, "layout", event.target.value)}
                        >
                          {layoutOptions.map((layout) => (
                            <option key={layout}>{layout}</option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <Field label="Block Content">
                      <textarea
                        rows="3"
                        value={section.body}
                        onChange={(event) => updateSection(section.id, "body", event.target.value)}
                      />
                    </Field>
                    <div className="field-grid">
                      <Field label="Image">
                        <select
                          value={section.image || page.heroImage}
                          onChange={(event) => updateSection(section.id, "image", event.target.value)}
                        >
                          {mediaLibrary.map((media) => (
                            <option key={media.id} value={media.path}>
                              {media.title}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="CTA Label">
                        <input
                          value={section.ctaLabel || ""}
                          onChange={(event) => updateSection(section.id, "ctaLabel", event.target.value)}
                        />
                      </Field>
                      <Field label="CTA URL">
                        <input
                          value={section.ctaUrl || ""}
                          onChange={(event) => updateSection(section.id, "ctaUrl", event.target.value)}
                        />
                      </Field>
                      <label className="toggle-field">
                        <input
                          type="checkbox"
                          checked={section.visible !== false}
                          onChange={(event) => updateSection(section.id, "visible", event.target.checked)}
                        />
                        <span>Visible on website</span>
                      </label>
                    </div>
                    <div className="block-actions">
                      <button className="ghost-button" type="button" onClick={() => moveSection(section.id, "up")} disabled={index === 0}>
                        <ArrowUp size={16} />
                        <span>Move Up</span>
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => moveSection(section.id, "down")}
                        disabled={index === page.sections.length - 1}
                      >
                        <ArrowDown size={16} />
                        <span>Move Down</span>
                      </button>
                      <button className="ghost-button" type="button" onClick={() => duplicateSection(section.id)}>
                        <Copy size={16} />
                        <span>Duplicate</span>
                      </button>
                    </div>
                  </div>
                  <button className="icon-button danger" type="button" onClick={() => removeSection(section.id)}>
                    <Trash2 size={17} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {editorTab === "builder" && (
          <div className="elementor-workspace elementor-workspace-pro redesign-workspace">
            <aside className={`elementor-panel builder-sidebar-panel ${builderSidebarMode === "style" ? "style-mode" : "elements-mode"}`}>
              {builderSidebarMode === "elements" ? (
                <>
                  <div className="builder-sidebar-head">
                    <div>
                      <span className="eyebrow">Elements</span>
                      <h3>Drag-style blocks</h3>
                      <p className="panel-help">Add blocks, then click any section on canvas to open its styling and content controls.</p>
                    </div>
                  </div>
                  <div className="elementor-button-grid compact">
                    {sectionTypes.map((type) => (
                      <button key={type} type="button" onClick={() => addSection(type)}>
                        <LayoutTemplate size={15} />
                        <span>{type}</span>
                      </button>
                    ))}
                  </div>

                  <div>
                    <span className="eyebrow">Layout Presets</span>
                    <div className="layout-preset-list compact">
                      {layoutPresets.map((preset) => (
                        <button key={preset.id} type="button" onClick={() => addLayoutPreset(preset)}>
                          <strong>{preset.title}</strong>
                          <small>{preset.detail}</small>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="navigator-panel">
                    <span className="eyebrow">Navigator</span>
                    {page.sections.map((section, index) => (
                      <button
                        key={section.id}
                        type="button"
                        className={activeBlock?.id === section.id ? "active" : ""}
                        onClick={() => selectBuilderSection(section.id)}
                      >
                        <GripVertical size={14} />
                        <span>{index + 1}. {section.title || section.type}</span>
                        <small>{section.visible === false ? "Hidden" : section.type}</small>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="builder-sidebar-head builder-sidebar-style-head">
                    <div>
                      <span className="eyebrow">{inspectorTab === "page" ? "Page Settings" : "Selected Section"}</span>
                      <h3>{inspectorTab === "page" ? page.title : (activeBlock?.title || "Select a section")}</h3>
                    </div>
                    <button
                      className="icon-button builder-sidebar-toggle"
                      type="button"
                      aria-label="Show elements panel"
                      title="Show elements"
                      onClick={() => setBuilderSidebarMode("elements")}
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  <div className="inspector-tabs">
                    {["content", "style", "advanced", "page"].map((tab) => (
                      <button key={tab} type="button" className={inspectorTab === tab ? "active" : ""} onClick={() => setInspectorTab(tab)}>
                        {tab}
                      </button>
                    ))}
                  </div>

                  {activeBlock && inspectorTab === "content" && (
                    <div className="inspector-fields">
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
                      <Field label="Eyebrow / Label">
                        <input value={activeBlock.eyebrow || ""} onChange={(event) => updateSection(activeBlock.id, "eyebrow", event.target.value)} />
                      </Field>
                      <Field label="Heading">
                        <input value={activeBlock.title || ""} onChange={(event) => updateSection(activeBlock.id, "title", event.target.value)} />
                      </Field>
                      <Field label="Content">
                        <textarea rows="5" value={activeBlock.body || ""} onChange={(event) => updateSection(activeBlock.id, "body", event.target.value)} />
                      </Field>
                      <Field label="Raw HTML / Legacy Markup">
                        <textarea rows="8" value={activeBlock.html || ""} onChange={(event) => updateSection(activeBlock.id, "html", event.target.value)} placeholder="Paste the original section HTML here" />
                      </Field>
                      <div className="field-grid one">
                        <Field label="Image URL">
                          <input value={activeBlock.image || ""} onChange={(event) => updateSection(activeBlock.id, "image", event.target.value)} />
                        </Field>
                        <Field label="CTA Label">
                          <input value={activeBlock.ctaLabel || ""} onChange={(event) => updateSection(activeBlock.id, "ctaLabel", event.target.value)} />
                        </Field>
                        <Field label="CTA URL">
                          <input value={activeBlock.ctaUrl || ""} onChange={(event) => updateSection(activeBlock.id, "ctaUrl", event.target.value)} />
                        </Field>
                      </div>
                    </div>
                  )}

                  {activeBlock && inspectorTab === "style" && (
                    <div className="inspector-fields">
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
                      <label className="toggle-field">
                        <input type="checkbox" checked={Boolean(activeBlockStyles.shadow)} onChange={(event) => updateBlockStyle("shadow", event.target.checked)} />
                        <span>Box shadow</span>
                      </label>
                    </div>
                  )}

                  {activeBlock && inspectorTab === "advanced" && (
                    <div className="inspector-fields">
                      <div className="spacing-grid">
                        <Field label="Padding Top"><input value={activeBlockStyles.paddingTop} onChange={(event) => updateBlockStyle("paddingTop", event.target.value)} /></Field>
                        <Field label="Padding Bottom"><input value={activeBlockStyles.paddingBottom} onChange={(event) => updateBlockStyle("paddingBottom", event.target.value)} /></Field>
                        <Field label="Padding Left"><input value={activeBlockStyles.paddingLeft} onChange={(event) => updateBlockStyle("paddingLeft", event.target.value)} /></Field>
                        <Field label="Padding Right"><input value={activeBlockStyles.paddingRight} onChange={(event) => updateBlockStyle("paddingRight", event.target.value)} /></Field>
                        <Field label="Margin Top"><input value={activeBlockStyles.marginTop} onChange={(event) => updateBlockStyle("marginTop", event.target.value)} /></Field>
                        <Field label="Margin Bottom"><input value={activeBlockStyles.marginBottom} onChange={(event) => updateBlockStyle("marginBottom", event.target.value)} /></Field>
                        <Field label="Column Gap"><input value={activeBlockStyles.gap} onChange={(event) => updateBlockStyle("gap", event.target.value)} /></Field>
                        <Field label="Border Radius"><input value={activeBlockStyles.borderRadius} onChange={(event) => updateBlockStyle("borderRadius", event.target.value)} /></Field>
                        <Field label="Image Radius"><input value={activeBlockStyles.imageRadius} onChange={(event) => updateBlockStyle("imageRadius", event.target.value)} /></Field>
                      </div>
                      <Field label="CSS Class">
                        <input value={activeBlock.className || ""} onChange={(event) => updateSection(activeBlock.id, "className", event.target.value)} placeholder="custom-section-class" />
                      </Field>
                      <label className="toggle-field">
                        <input type="checkbox" checked={activeBlock.visible !== false} onChange={(event) => updateSection(activeBlock.id, "visible", event.target.checked)} />
                        <span>Visible on website</span>
                      </label>
                      <div className="block-actions vertical">
                        <button className="ghost-button" type="button" onClick={() => duplicateSection(activeBlock.id)}>
                          <Copy size={16} />
                          <span>Duplicate</span>
                        </button>
                        <button
                          className="danger-button"
                          type="button"
                          onClick={() => {
                            removeSection(activeBlock.id);
                            setActiveBlockId(page.sections.find((section) => section.id !== activeBlock.id)?.id || "");
                          }}
                        >
                          <Trash2 size={16} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {inspectorTab === "page" && (
                    <div className="inspector-fields">
                      <Field label="Page Title"><input value={page.title} onChange={(event) => updateField("title", event.target.value)} /></Field>
                      <Field label="Slug"><input value={page.slug} onChange={(event) => updateField("slug", event.target.value)} /></Field>
                      <Field label="Parent Slug"><input value={page.parentSlug || ""} onChange={(event) => updateField("parentSlug", event.target.value)} /></Field>
                      <Field label="Source URL"><input value={page.sourceUrl || ""} onChange={(event) => updateField("sourceUrl", event.target.value)} /></Field>
                      <Field label="Canvas Width"><input value={pageStyles.canvasWidth} onChange={(event) => updatePageStyle("canvasWidth", event.target.value)} /></Field>
                      <Field label="Page Background"><input type="color" value={pageStyles.backgroundColor || "#ffffff"} onChange={(event) => updatePageStyle("backgroundColor", event.target.value)} /></Field>
                      <Field label="Body HTML from legacy page">
                        <textarea rows="8" value={page.bodyHtml || ""} onChange={(event) => updateField("bodyHtml", event.target.value)} placeholder="Full <body> HTML imported from the existing website" />
                      </Field>
                      <Field label="Full Raw HTML document">
                        <textarea rows="8" value={page.rawHtml || ""} onChange={(event) => updateField("rawHtml", event.target.value)} placeholder="Optional full <!doctype html> document" />
                      </Field>
                      <Field label="Custom CSS">
                        <textarea rows="6" value={page.customCss || ""} onChange={(event) => updateField("customCss", event.target.value)} placeholder="CSS to save with this page" />
                      </Field>
                    </div>
                  )}
                </>
              )}
            </aside>

            <main className="elementor-canvas elementor-canvas-pro">
              <div className="elementor-toolbar pro-toolbar">
                <div className="elementor-toolbar-group">
                  <span className="eyebrow">Canvas</span>
                  <h3>{page.title}</h3>
                  <small>Slug: /{page.slug} · Exact URL: {livePageUrl}</small>
                </div>
                <div className="editor-mode-tools">
                  <div className="mode-switcher" aria-label="Canvas mode">
                    <button type="button" className={canvasMode === "exact" ? "active" : ""} onClick={() => setCanvasMode("exact")}>Exact Live Design</button>
                    <button type="button" className={canvasMode === "builder" ? "active" : ""} onClick={() => setCanvasMode("builder")}>Editable Blocks</button>
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
              </div>

              {canvasMode === "exact" && (
                <div className={`exact-live-frame-card device-${devicePreview}`}>
                  <div className="legacy-page-frame-head">
                    <div>
                      <span className="eyebrow">Exact website design</span>
                      <strong>{livePageUrl}</strong>
                    </div>
                    <a className="ghost-button" href={livePageUrl} target="_blank" rel="noreferrer">Open Live Page</a>
                  </div>
                  <iframe
                    title={`${page.title} exact live website preview`}
                    src={livePageUrl}
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
                  />
                  <div className="exact-live-note">
                    This is the real published website inside the editor. Use <strong>Editable Blocks</strong> when you want to modify the stored builder/HTML fields.
                  </div>
                </div>
              )}

              {canvasMode === "builder" && hasLegacyHtml(page) && (
                <div className="legacy-page-frame-card">
                  <div className="legacy-page-frame-head">
                    <div>
                      <span className="eyebrow">Exact live HTML preview</span>
                      <strong>{page.sourceUrl || `/${page.slug}`}</strong>
                    </div>
                    <button className="ghost-button" type="button" onClick={() => setInspectorTab("page")}>Edit stored HTML</button>
                  </div>
                  <iframe
                    title={`${page.title} legacy preview`}
                    srcDoc={buildPreviewDocument(page)}
                    sandbox=""
                  />
                </div>
              )}

              {canvasMode === "builder" && (
              <div
                className={`elementor-page-shell pro-page-shell device-${devicePreview}`}
                style={{ maxWidth: toCssUnit(pageStyles.canvasWidth, defaultPageStyles.canvasWidth), background: pageStyles.backgroundColor }}
              >
                <section
                  className="elementor-hero pro-hero"
                  style={{ backgroundImage: `linear-gradient(90deg, rgba(8, 25, 51, 0.92), rgba(26, 75, 150, 0.68)), url(${page.heroImage})` }}
                >
                  <div>
                    <input
                      className="hero-eyebrow-edit"
                      value={page.heroTag}
                      onChange={(event) => updateField("heroTag", event.target.value)}
                      aria-label="Hero tag"
                    />
                    <textarea value={page.heroHeadline} onChange={(event) => updateField("heroHeadline", event.target.value)} />
                    <input value={page.summary} onChange={(event) => updateField("summary", event.target.value)} />
                    <div className="elementor-cta-row">
                      <input value={page.ctaLabel} onChange={(event) => updateField("ctaLabel", event.target.value)} aria-label="Hero CTA label" />
                      <input value={page.ctaUrl} onChange={(event) => updateField("ctaUrl", event.target.value)} aria-label="Hero CTA URL" />
                    </div>
                  </div>
                  <label>
                    <Image size={16} />
                    <select value={page.heroImage} onChange={(event) => updateField("heroImage", event.target.value)}>
                      {mediaLibrary.map((media) => (
                        <option key={media.id} value={media.path}>{media.title}</option>
                      ))}
                    </select>
                  </label>
                </section>

                <div className="elementor-section-list pro-section-list">
                  {page.sections.map((section, index) => {
                    const styles = getSectionStyles(section);
                    const isRawHtml = section.type === "Raw HTML" || section.layout === "Legacy HTML" || Boolean(section.html);
                    return (
                      <article
                        className={`elementor-section elementor-section-pro ${slugify(section.layout || "text-first")} ${section.className || ""} ${activeBlock?.id === section.id ? "active" : ""} ${section.visible === false ? "hidden" : ""}`}
                        style={sectionCanvasStyle(section)}
                        key={section.id}
                        onClick={() => selectBuilderSection(section.id)}
                      >
                        <div className="elementor-section-bar floating">
                          <span>
                            <GripVertical size={15} />
                            {index + 1}. {section.type}
                          </span>
                          <div>
                            <button type="button" aria-label="Move section up" onClick={(event) => { event.stopPropagation(); moveSection(section.id, "up"); }} disabled={index === 0}>
                              <ArrowUp size={15} />
                            </button>
                            <button type="button" aria-label="Move section down" onClick={(event) => { event.stopPropagation(); moveSection(section.id, "down"); }} disabled={index === page.sections.length - 1}>
                              <ArrowDown size={15} />
                            </button>
                            <button type="button" aria-label="Duplicate section" onClick={(event) => { event.stopPropagation(); duplicateSection(section.id); }}>
                              <Copy size={15} />
                            </button>
                            <button type="button" aria-label="Delete section" onClick={(event) => { event.stopPropagation(); removeSection(section.id); }}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>

                        {isRawHtml ? (
                          <div className="legacy-section-shell">
                            <iframe
                              title={`${section.title || section.type} HTML preview`}
                              srcDoc={buildPreviewDocument({ title: section.title, bodyHtml: formatHtmlPreview(section.html), styles: pageStyles })}
                              sandbox=""
                            />
                          </div>
                        ) : (
                          <div className="elementor-section-body pro-section-body" style={{ gap: toCssUnit(styles.gap, defaultSectionStyles.gap) }}>
                            <div className="elementor-section-copy">
                              <input
                                className="elementor-eyebrow-input"
                                style={{ color: styles.accentColor, textAlign: styles.align }}
                                value={section.eyebrow || ""}
                                onChange={(event) => updateSection(section.id, "eyebrow", event.target.value)}
                              />
                              <input
                                className="elementor-title-input"
                                style={{ color: styles.headingColor, textAlign: styles.align }}
                                value={section.title || ""}
                                onChange={(event) => updateSection(section.id, "title", event.target.value)}
                              />
                              <textarea
                                style={{ color: styles.textColor, textAlign: styles.align }}
                                value={section.body || ""}
                                onChange={(event) => updateSection(section.id, "body", event.target.value)}
                              />
                              <div className="elementor-cta-row">
                                <input value={section.ctaLabel || ""} onChange={(event) => updateSection(section.id, "ctaLabel", event.target.value)} />
                                <input value={section.ctaUrl || ""} onChange={(event) => updateSection(section.id, "ctaUrl", event.target.value)} />
                              </div>
                            </div>

                            <div className="elementor-section-media">
                              <img style={{ borderRadius: toCssUnit(styles.imageRadius, defaultSectionStyles.imageRadius) }} src={section.image || page.heroImage} alt="" />
                              <select value={section.image || page.heroImage} onChange={(event) => updateSection(section.id, "image", event.target.value)}>
                                {mediaLibrary.map((media) => (
                                  <option key={media.id} value={media.path}>{media.title}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
              )}
            </main>

          </div>
        )}

        {editorTab === "seo" && (
          <div className="form-stack">
            <div className="seo-panel">
              <div>
                <span className="eyebrow">Content Health</span>
                <h3>{seoScore}% SEO Score</h3>
              </div>
              <div className="seo-meter">
                <i style={{ width: `${seoScore}%` }} />
              </div>
            </div>

            <Field label="SEO Title">
              <input value={page.seoTitle} onChange={(event) => updateField("seoTitle", event.target.value)} />
            </Field>
            <Field label="SEO Description">
              <textarea
                rows="4"
                value={page.seoDescription}
                onChange={(event) => updateField("seoDescription", event.target.value)}
              />
            </Field>

            <div className="seo-checklist">
              <CheckItem done={page.title.length >= 12} label="Title has enough context" />
              <CheckItem done={page.summary.length >= 90} label="Summary supports search snippets" />
              <CheckItem done={page.sections.length > 0} label="Page contains at least one section" />
              <CheckItem done={Boolean(page.heroImage)} label="Hero image selected" />
            </div>
          </div>
        )}

        {editorTab === "settings" && (
          <div className="form-stack">
            <div className="field-grid">
              <Field label="Template">
                <select value={page.template} onChange={(event) => updateField("template", event.target.value)}>
                  {templateOptions.map((template) => (
                    <option key={template}>{template}</option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select value={page.status} onChange={(event) => updateField("status", event.target.value)}>
                  {statusOptions.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </Field>
              <Field label="Priority">
                <select value={page.priority} onChange={(event) => updateField("priority", event.target.value)}>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </Field>
              <Field label="Visibility">
                <select value={page.visibility} onChange={(event) => updateField("visibility", event.target.value)}>
                  {visibilityOptions.map((visibility) => (
                    <option key={visibility}>{visibility}</option>
                  ))}
                </select>
              </Field>
              <Field label="Owner">
                <input value={page.owner} onChange={(event) => updateField("owner", event.target.value)} />
              </Field>
              <Field label="Parent Slug">
                <input value={page.parentSlug} onChange={(event) => updateField("parentSlug", event.target.value)} placeholder="Optional parent page" />
              </Field>
              <Field label="Menu Order">
                <input type="number" min="1" value={page.menuOrder} onChange={(event) => updateField("menuOrder", event.target.value)} />
              </Field>
              <Field label="Scheduled Date">
                <input
                  type="date"
                  value={page.scheduledAt}
                  onChange={(event) => updateField("scheduledAt", event.target.value)}
                />
              </Field>
            </div>

            <div className="publish-strip">
              <StatusPill status={page.status} />
              <span>Last updated {formatDate(page.updatedAt)}</span>
              <span>Created {formatDate(page.createdAt)}</span>
              <span>Owner: {page.owner}</span>
              <span>Visibility: {page.visibility}</span>
            </div>

            <div className="danger-zone">
              <div>
                <span className="eyebrow">Page Lifecycle</span>
                <h3>Archive, restore, or permanently remove this page</h3>
              </div>
              <div className="editor-actions">
                {page.status === "Archived" ? (
                  <button className="ghost-button" type="button" onClick={() => updateActiveStatus("Draft")}>
                    <Undo2 size={17} />
                    <span>Restore Draft</span>
                  </button>
                ) : (
                  <button className="ghost-button" type="button" onClick={() => updateActiveStatus("Archived")}>
                    <Archive size={17} />
                    <span>Archive</span>
                  </button>
                )}
                <button className="danger-button" type="button" onClick={deletePage}>
                  <Trash2 size={17} />
                  <span>Delete Permanently</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {editorTab === "revisions" && (
          <div className="form-stack">
            <div className="seo-panel">
              <div>
                <span className="eyebrow">Revision History</span>
                <h3>{page.revisions?.length || 0} Saved Versions</h3>
              </div>
              <p>Every save stores the previous version of this page. Restore a revision into the editor, then save to publish that version back into the CRM.</p>
            </div>

            <div className="revision-list">
              {(page.revisions || []).length === 0 && (
                <div className="empty-state">
                  <FileText size={24} />
                  <strong>No revisions yet</strong>
                  <span>Save this page after edits to start building a revision trail.</span>
                </div>
              )}

              {(page.revisions || []).map((revision) => (
                <div className="revision-row" key={revision.id}>
                  <div>
                    <strong>{revision.title}</strong>
                    <span>{revision.label} / {revision.status} / {formatDate(revision.savedAt)}</span>
                  </div>
                  <button className="ghost-button" type="button" onClick={() => restoreRevision(revision.id)}>
                    <Undo2 size={17} />
                    <span>Restore</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </form>
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
  const activeBlock = page.sections.find((section) => section.id === activeBlockId) || page.sections[0];

  useEffect(() => {
    if (!page.sections.some((section) => section.id === activeBlockId)) {
      setActiveBlockId(page.sections[0]?.id || "");
    }
  }, [activeBlockId, page.id, page.sections]);

  return (
    <form className="builder-pro" onSubmit={savePage}>
      <section className="panel builder-tools">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Professional Page Builder</span>
            <h2>{page.title}</h2>
          </div>
          <button className="primary-button" type="submit">
            <Save size={17} />
            <span>Save</span>
          </button>
        </div>

        <div className="builder-fields">
          <Field label="Page Title">
            <input value={page.title} onChange={(event) => updateField("title", event.target.value)} />
          </Field>
          <Field label="Hero Headline">
            <textarea rows="3" value={page.heroHeadline} onChange={(event) => updateField("heroHeadline", event.target.value)} />
          </Field>
          <Field label="Hero Image">
            <select value={page.heroImage} onChange={(event) => updateField("heroImage", event.target.value)}>
              {mediaLibrary.map((media) => (
                <option value={media.path} key={media.id}>
                  {media.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Template">
            <select value={page.template} onChange={(event) => updateField("template", event.target.value)}>
              {templateOptions.map((template) => (
                <option key={template}>{template}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="builder-template-grid">
          {sectionTypes.map((type) => (
            <button type="button" key={type} onClick={() => addSection(type)}>
              <Plus size={15} />
              <span>{type}</span>
            </button>
          ))}
        </div>

        {activeBlock && (
          <div className="builder-fields inspector-fields">
            <span className="eyebrow">Selected Block</span>
            <Field label="Block Title">
              <input value={activeBlock.title} onChange={(event) => updateSection(activeBlock.id, "title", event.target.value)} />
            </Field>
            <Field label="Block Content">
              <textarea rows="4" value={activeBlock.body} onChange={(event) => updateSection(activeBlock.id, "body", event.target.value)} />
            </Field>
            <div className="block-actions vertical">
              <button className="ghost-button" type="button" onClick={() => duplicateSection(activeBlock.id)}>
                <Copy size={16} />
                <span>Duplicate</span>
              </button>
              <button className="danger-button" type="button" onClick={() => removeSection(activeBlock.id)}>
                <Trash2 size={16} />
                <span>Delete</span>
              </button>
            </div>
          </div>
        )}

        <button className="ghost-button" type="button" onClick={() => setActiveView("pages")}>
          <Pencil size={17} />
          <span>Open Full Editor</span>
        </button>
      </section>

      <section className="panel builder-structure">
        <div className="panel-head compact">
          <div>
            <span className="eyebrow">Structure</span>
            <h2>{page.sections.length} Blocks</h2>
          </div>
        </div>
        <div className="builder-stack standalone">
          {page.sections.map((section, index) => (
            <article
              className={`canvas-block ${activeBlock?.id === section.id ? "active" : ""}`}
              role="button"
              tabIndex={0}
              key={section.id}
              onClick={() => setActiveBlockId(section.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  setActiveBlockId(section.id);
                }
              }}
            >
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
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); moveSection(section.id, "down"); }}
                  disabled={index === page.sections.length - 1}
                >
                  <ArrowDown size={15} />
                </button>
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="panel builder-preview">
        <PagePreview page={page} />
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

function ContentPagesView({
  title,
  eyebrow,
  description,
  pages,
  emptyLabel,
  icon: Icon,
  setActivePageId,
  setActiveView,
  setEditorTab,
  deletePageById
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [viewMode, setViewMode] = useState("grid");
  const filteredPages = pages
    .filter((page) => statusFilter === "All" || (page.status || "").toLowerCase() === statusFilter.toLowerCase())
    .filter((page) =>
      [page.title, page.slug, page.type, page.menu, page.summary]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase())
    );

  const openPage = (page, tab) => {
    if (tab === "content" && !isLocalDraftPage(page)) {
      openPageEditorTab(page.id);
      return;
    }
    setActivePageId(page.id);
    setEditorTab(tab);
    setActiveView("page-editor");
  };

  return (
    <section className="content-pages-view">
      <div className="content-pages-header">
        <div className="content-pages-copy">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="content-pages-count">
          <Icon size={22} />
          <strong>{pages.length}</strong>
          <span>Total pages</span>
        </div>
      </div>

      <section className="content-pages-shell">
        <div className="content-pages-head">
          <span className="eyebrow">Review Queue</span>
          <h2>{filteredPages.length} Pages</h2>
        </div>

        <div className="content-pages-toolbar">
          <label className="content-pages-search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or slug..." />
          </label>
          <label className="content-pages-filter">
            <Filter size={16} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option>All</option>
              {pageStatusFilters.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>

        <div className={`content-pages-grid ${viewMode === "list" ? "list-mode" : ""}`}>
          {filteredPages.map((page) => (
            <article className={`content-page-card ${viewMode === "list" ? "list-mode" : ""}`} key={page.id}>
              <img src={getAutoThumbnailForPage(page)} alt="" />
              <div className="content-page-card-body">
                <StatusPill status={page.status} />
                <h3>{page.title}</h3>
                <small>/{page.slug}</small>
                <p>{page.summary}</p>
              </div>
              <div className="content-page-actions">
                <button className="icon-button" type="button" aria-label="Edit page" onClick={() => openPage(page, "content")}>
                  <Pencil size={16} />
                </button>
                <button className="icon-button" type="button" aria-label="View sections" onClick={() => openPage(page, "builder")}>
                  <ListTree size={16} />
                </button>
                <button className="icon-button danger" type="button" aria-label="Delete page" onClick={() => deletePageById(page.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
          {!filteredPages.length && <p className="content-pages-empty">{emptyLabel}</p>}
        </div>
      </section>
    </section>
  );
}

function MenusView({
  pages,
  menuGroupChoices = [],
  savePage,
  setPages,
  setFormPage,
  setActivePageId,
  setActiveView,
  setEditorTab
}) {
  const selectableGroups = menuGroupChoices.filter((group) => group.value);
  const [activeGroup, setActiveGroup] = useState(selectableGroups[0]?.value || "");
  const [availableQuery, setAvailableQuery] = useState("");
  const sortedPages = useMemo(
    () =>
      [...pages].sort((a, b) => {
        const orderDiff = Number(a.menuOrder || 0) - Number(b.menuOrder || 0);
        if (orderDiff !== 0) return orderDiff;
        return a.title.localeCompare(b.title);
      }),
    [pages]
  );

  useEffect(() => {
    if (!selectableGroups.some((group) => group.value === activeGroup)) {
      setActiveGroup(selectableGroups[0]?.value || "");
    }
  }, [activeGroup, selectableGroups]);

  const activeMenuPages = useMemo(
    () => sortedPages.filter((page) => page.menu === activeGroup),
    [activeGroup, sortedPages]
  );

  const availablePages = useMemo(
    () =>
      sortedPages
        .filter((page) => page.menu !== activeGroup)
        .filter((page) => [page.title, page.slug].join(" ").toLowerCase().includes(availableQuery.toLowerCase()))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [activeGroup, availableQuery, sortedPages]
  );

  const rootPages = useMemo(
    () => activeMenuPages.filter((page) => !page.parentSlug),
    [activeMenuPages]
  );

  const syncLocalPages = (nextPages) => {
    const updates = new Map(nextPages.map((page) => [String(page.id), normalizePage(page)]));
    setPages((current) =>
      current.map((page) => {
        const replacement = updates.get(String(page.id));
        return replacement || page;
      })
    );
    setFormPage((current) => updates.get(String(current.id)) || current);
  };

  const persistPages = async (nextPages) => {
    const normalizedPages = nextPages.map((page) => normalizePage(page));
    syncLocalPages(normalizedPages);
    for (const nextPage of normalizedPages) {
      await savePage({ preventDefault() {} }, nextPage);
    }
  };

  const openPageInEditor = (page, tab = "content") => {
    if (tab === "content" && !isLocalDraftPage(page)) {
      openPageEditorTab(page.id);
      return;
    }
    setActivePageId(page.id);
    setFormPage(page);
    setEditorTab(tab);
    setActiveView("page-editor");
  };

  const addPageToMenu = async (page) => {
    const nextOrder = activeMenuPages.reduce((maxOrder, item) => Math.max(maxOrder, Number(item.menuOrder || 0)), 0) + 1;
    await persistPages([
      {
        ...page,
        menu: activeGroup,
        parentSlug: "",
        menuOrder: nextOrder
      }
    ]);
  };

  const removeFromMenu = async (page) => {
    await persistPages([
      {
        ...page,
        menu: "",
        parentSlug: "",
        menuOrder: 1
      }
    ]);
  };

  const updateMenuField = async (page, field, value) => {
    if (field === "parentSlug" && value === page.slug) {
      return;
    }

    await persistPages([
      {
        ...page,
        [field]: field === "menuOrder" ? Math.max(1, Number(value || 1)) : value
      }
    ]);
  };

  const moveMenuPage = async (page, direction) => {
    const siblings = activeMenuPages
      .filter((item) => String(item.parentSlug || "") === String(page.parentSlug || ""))
      .sort((a, b) => Number(a.menuOrder || 0) - Number(b.menuOrder || 0));
    const pageIndex = siblings.findIndex((item) => String(item.id) === String(page.id));
    const swapIndex = direction === "up" ? pageIndex - 1 : pageIndex + 1;

    if (pageIndex < 0 || swapIndex < 0 || swapIndex >= siblings.length) {
      return;
    }

    const swapPage = siblings[swapIndex];
    await persistPages([
      {
        ...page,
        menuOrder: Number(swapPage.menuOrder || swapIndex + 1)
      },
      {
        ...swapPage,
        menuOrder: Number(page.menuOrder || pageIndex + 1)
      }
    ]);
  };

  return (
    <section className="admin-view menu-builder-view">
      <div className="view-header">
        <div>
          <span className="eyebrow">Navigation Builder</span>
          <h2>Manage Website Menus</h2>
          <p>Add pages into menus, set parent-child relationships, reorder items, and remove pages from navigation without touching their page content.</p>
        </div>
        <div className="view-stat-card">
          <ListChecks size={22} />
          <strong>{activeMenuPages.length}</strong>
          <span>Items in {activeGroup || "menu"}</span>
        </div>
      </div>

      <div className="view-content menu-builder-grid">
        <section className="panel menu-builder-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Menu Group</span>
              <h2>Current Navigation</h2>
            </div>
          </div>

          <div className="menu-select-row">
            <Field label="Select Menu">
              <select value={activeGroup} onChange={(event) => setActiveGroup(event.target.value)}>
                {selectableGroups.map((group) => (
                  <option key={group.value} value={group.value}>{group.label}</option>
                ))}
              </select>
            </Field>
            <span className="menu-builder-live-note">Changes save directly to the database.</span>
          </div>

          <div className="menu-builder-list">
            {activeMenuPages.map((page) => {
              const siblingPages = activeMenuPages
                .filter((item) => String(item.parentSlug || "") === String(page.parentSlug || ""))
                .sort((a, b) => Number(a.menuOrder || 0) - Number(b.menuOrder || 0));
              const siblingIndex = siblingPages.findIndex((item) => String(item.id) === String(page.id));

              return (
                <article className="menu-builder-item" key={page.id}>
                  <div className="menu-builder-item-head">
                    <div>
                      <strong>{page.title}</strong>
                      <small>/{page.slug}</small>
                    </div>
                    <div className="table-actions">
                      <button className="icon-button" type="button" aria-label="Edit page" onClick={() => openPageInEditor(page, "content")}>
                        <Pencil size={16} />
                      </button>
                      <button className="icon-button" type="button" aria-label="Open builder" onClick={() => openPageInEditor(page, "builder")}>
                        <ListTree size={16} />
                      </button>
                      <button className="icon-button danger" type="button" aria-label="Remove from menu" onClick={() => removeFromMenu(page)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="field-grid menu-builder-fields">
                    <Field label="Parent Page">
                      <select value={page.parentSlug || ""} onChange={(event) => updateMenuField(page, "parentSlug", event.target.value)}>
                        <option value="">Top level page</option>
                        {rootPages
                          .filter((item) => String(item.id) !== String(page.id))
                          .map((item) => (
                            <option key={item.id} value={item.slug}>{item.title}</option>
                          ))}
                      </select>
                    </Field>
                    <Field label="Menu Order">
                      <NumericStyleInput
                        value={String(page.menuOrder || 1)}
                        onChange={(value) => updateMenuField(page, "menuOrder", value)}
                        placeholder="1"
                        fallback="1"
                      />
                    </Field>
                  </div>

                  <div className="menu-builder-row-actions">
                    <button type="button" className="ghost-button" onClick={() => moveMenuPage(page, "up")} disabled={siblingIndex <= 0}>
                      <ArrowUp size={16} />
                      <span>Move Up</span>
                    </button>
                    <button type="button" className="ghost-button" onClick={() => moveMenuPage(page, "down")} disabled={siblingIndex === -1 || siblingIndex >= siblingPages.length - 1}>
                      <ArrowDown size={16} />
                      <span>Move Down</span>
                    </button>
                  </div>
                </article>
              );
            })}

            {!activeMenuPages.length && (
              <div className="empty-state">
                <ListChecks size={24} />
                <strong>No pages linked to this menu</strong>
                <span>Add pages from the right panel to start building this navigation group.</span>
              </div>
            )}
          </div>
        </section>

        <section className="panel menu-builder-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Available Pages</span>
              <h2>Add or Move Pages</h2>
            </div>
          </div>

          <div className="search-wrap">
            <label className="search-field no-margin">
              <Search size={16} />
              <input value={availableQuery} onChange={(event) => setAvailableQuery(event.target.value)} placeholder="Search pages to add" />
            </label>
          </div>

          <div className="menu-builder-list">
            {availablePages.map((page) => (
              <article className="menu-builder-item compact" key={page.id}>
                <div className="menu-builder-item-head">
                  <div>
                    <strong>{page.title}</strong>
                    <small>/{page.slug}</small>
                  </div>
                  <button className="ghost-button" type="button" onClick={() => addPageToMenu(page)}>
                    <Plus size={16} />
                    <span>{page.menu ? `Move to ${activeGroup}` : `Add to ${activeGroup}`}</span>
                  </button>
                </div>
                <span className="menu-builder-meta">{page.menu ? `Currently in ${getMenuReferenceLabel(page, pages)}` : "Not currently linked to any menu"}</span>
              </article>
            ))}

            {!availablePages.length && (
              <div className="empty-state">
                <FileText size={24} />
                <strong>All pages are already assigned</strong>
                <span>Use the left panel to reorder or remove menu items.</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

function MediaView({ mediaItems = [], mediaStorageMode = "local", selectedImage, onSelect, onUploadMedia, onDeleteMedia, onCopyUrl }) {
  const [selectedMediaId, setSelectedMediaId] = useState(
    mediaItems.find((media) => media.path === selectedImage)?.id || mediaItems[0]?.id || ""
  );
  const uploadInputRef = useRef(null);
  const selectedMedia = mediaItems.find((media) => String(media.id) === String(selectedMediaId)) || mediaItems[0] || null;

  useEffect(() => {
    if (selectedImage) {
      const match = mediaItems.find((media) => media.path === selectedImage);
      if (match) {
        setSelectedMediaId(match.id);
        return;
      }
    }
    if (selectedMediaId && !mediaItems.some((media) => String(media.id) === String(selectedMediaId))) {
      setSelectedMediaId(mediaItems[0]?.id || "");
    }
  }, [mediaItems, selectedImage, selectedMediaId]);

  const handleUpload = async (event) => {
    const files = event.target.files;
    if (!files?.length) {
      return;
    }
    try {
      const uploaded = await onUploadMedia(files);
      if (uploaded[0]) {
        setSelectedMediaId(uploaded[0].id);
      }
    } finally {
      event.target.value = "";
    }
  };

  return (
    <section className="panel media-view">
      <input ref={uploadInputRef} type="file" accept="image/*" multiple hidden onChange={handleUpload} />
      <div className="panel-head">
        <div>
          <span className="eyebrow">Media Library</span>
          <h2>Website Visual Assets</h2>
          <small className="media-library-mode">{mediaStorageMode === "api" ? "Connected to website media storage" : "Browser fallback storage only"}</small>
        </div>
        <button className="ghost-button" type="button" onClick={() => uploadInputRef.current?.click()}>
          <Upload size={17} />
          <span>Upload</span>
        </button>
      </div>

      <div className="media-library-layout">
        <div className="media-grid">
          {mediaItems.map((media) => (
            <button
              type="button"
              className={selectedMediaId === media.id ? "media-card active" : "media-card"}
              key={media.id}
              onClick={() => {
                setSelectedMediaId(media.id);
                onSelect(media.path);
              }}
            >
              <img src={media.path} alt="" />
              <span>{media.type}</span>
              <strong>{media.title}</strong>
              <small>{media.size || media.dimensions}</small>
            </button>
          ))}
        </div>
        <aside className="media-details-card">
          {selectedMedia ? (
            <>
              <img src={selectedMedia.path} alt={selectedMedia.title} />
              <div className="media-details-copy">
                <span className="eyebrow">Image Information</span>
                <h3>{selectedMedia.title}</h3>
                <dl className="standalone-media-meta-list">
                  <div>
                    <dt>Upload date</dt>
                    <dd>{selectedMedia.uploadedAt || "Unknown"}</dd>
                  </div>
                  <div>
                    <dt>Name</dt>
                    <dd>{selectedMedia.title}</dd>
                  </div>
                  <div>
                    <dt>Size</dt>
                    <dd>{selectedMedia.size || "Unknown"}</dd>
                  </div>
                  <div>
                    <dt>Dimensions</dt>
                    <dd>{selectedMedia.dimensions || "Unknown"}</dd>
                  </div>
                  <div>
                    <dt>URL</dt>
                    <dd className="url">{selectedMedia.path}</dd>
                  </div>
                </dl>
                <div className="standalone-media-sidebar-actions">
                  <button className="ghost-button" type="button" onClick={() => onCopyUrl(selectedMedia.path)}>
                    <Copy size={16} />
                    <span>Copy URL</span>
                  </button>
                  <button className="danger-button" type="button" onClick={() => onDeleteMedia(selectedMedia.id)}>
                    <Trash2 size={16} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="standalone-media-picker-empty sidebar">
              <strong>No media selected</strong>
              <span>Select any asset to review its stored details.</span>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function CrmView() {
  const leads = [
    {
      name: "Abdi Student",
      source: "Admission Apply",
      interest: "MSc in Public Health",
      status: "New"
    },
    {
      name: "Hana Applicant",
      source: "Program Page",
      interest: "Computer Science",
      status: "Contacted"
    },
    {
      name: "Community Partner",
      source: "Contact Form",
      interest: "Research Partnership",
      status: "Qualified"
    }
  ];

  return (
    <section className="panel crm-view">
      <div className="panel-head">
        <div>
          <span className="eyebrow">CRM Leads</span>
          <h2>Website Enquiries</h2>
        </div>
        <button className="primary-button" type="button">
          <UserPlus size={17} />
          <span>Add Lead</span>
        </button>
      </div>
      <div className="lead-table">
        <div className="lead-row head">
          <span>Name</span>
          <span>Source</span>
          <span>Interest</span>
          <span>Status</span>
        </div>
        {leads.map((lead) => (
          <div className="lead-row" key={lead.name}>
            <strong>{lead.name}</strong>
            <span>{lead.source}</span>
            <span>{lead.interest}</span>
            <StatusPill status={lead.status} />
          </div>
        ))}
      </div>
    </section>
  );
}

function SettingsView() {
  return (
    <section className="settings-grid">
      <div className="panel">
        <div className="panel-head compact">
          <div>
            <span className="eyebrow">Brand</span>
            <h2>Website Identity</h2>
          </div>
        </div>
        <div className="brand-preview">
          <img src={assets.logoOfficial} alt="Madda Walabu University" />
          <div className="swatches">
            <span style={{ background: "#081933" }} />
            <span style={{ background: "#1a4b96" }} />
            <span style={{ background: "#d6a128" }} />
            <span style={{ background: "#0b6b3a" }} />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head compact">
          <div>
            <span className="eyebrow">Publishing Rules</span>
            <h2>Approval Flow</h2>
          </div>
        </div>
        <div className="settings-list">
          <CheckItem done label="Draft pages require editor review" />
          <CheckItem done label="Published pages keep JSON export history" />
          <CheckItem done label="Scheduled pages show in the queue" />
          <CheckItem done={false} label="Backend sync endpoint not connected" />
        </div>
      </div>
    </section>
  );
}

function SiteChromeView({
  kind,
  page,
  openSiteChromeView,
  updateField,
  updateHtml,
  savePage
}) {
  const config = getSiteChromeConfig(kind);
  const snippetHtml = getSiteChromeHtml(page);
  const sourcePath = page.sourceUrl || page.source_url || config.sourceUrl;
  const statusLabel = page.status || "Draft";
  const isSavedStatus = String(statusLabel).toLowerCase() === "published";
  const visualHeaderModel = useMemo(() => parseHeaderVisualModel(snippetHtml), [snippetHtml]);

  const commitVisualHeaderModel = (updater) => {
    if (kind !== "header") {
      return;
    }
    const nextModel = typeof updater === "function" ? updater(visualHeaderModel) : updater;
    updateHtml(kind, updateHeaderHtmlFromVisualModel(snippetHtml, nextModel));
  };

  const updateHeaderMenuItem = (itemId, field, value) => {
    commitVisualHeaderModel((current) => ({
      ...current,
      menuItems: current.menuItems.map((item) => item.id === itemId ? { ...item, [field]: value } : item)
    }));
  };

  const moveHeaderMenuItem = (itemId, direction) => {
    commitVisualHeaderModel((current) => {
      const items = [...current.menuItems];
      const index = items.findIndex((item) => item.id === itemId);
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || targetIndex < 0 || targetIndex >= items.length) {
        return current;
      }
      const [moved] = items.splice(index, 1);
      items.splice(targetIndex, 0, moved);
      return { ...current, menuItems: items };
    });
  };

  const removeHeaderMenuItem = (itemId) => {
    commitVisualHeaderModel((current) => ({
      ...current,
      menuItems: current.menuItems.filter((item) => item.id !== itemId)
    }));
  };

  const addHeaderMenuItem = () => {
    commitVisualHeaderModel((current) => ({
      ...current,
      menuItems: [
        ...current.menuItems,
        {
          id: `header-menu-added-${Date.now()}`,
          sourceIndex: current.menuItems.length,
          title: "New Menu Item",
          href: "#",
          isMega: false,
          children: []
        }
      ]
    }));
  };

  const updateHeaderChildItem = (itemId, childId, field, value) => {
    commitVisualHeaderModel((current) => ({
      ...current,
      menuItems: current.menuItems.map((item) => item.id === itemId ? {
        ...item,
        children: item.children.map((child) => child.id === childId ? { ...child, [field]: value } : child)
      } : item)
    }));
  };

  const addHeaderChildItem = (itemId) => {
    commitVisualHeaderModel((current) => ({
      ...current,
      menuItems: current.menuItems.map((item) => item.id === itemId ? {
        ...item,
        children: [
          ...(item.children || []),
          {
            id: `header-child-added-${Date.now()}-${itemId}`,
            title: "New Dropdown Item",
            href: "#"
          }
        ]
      } : item)
    }));
  };

  const removeHeaderChildItem = (itemId, childId) => {
    commitVisualHeaderModel((current) => ({
      ...current,
      menuItems: current.menuItems.map((item) => item.id === itemId ? {
        ...item,
        children: item.children.filter((child) => child.id !== childId)
      } : item)
    }));
  };

  const moveHeaderChildItem = (itemId, childId, direction) => {
    commitVisualHeaderModel((current) => ({
      ...current,
      menuItems: current.menuItems.map((item) => {
        if (item.id !== itemId) return item;
        const children = [...(item.children || [])];
        const index = children.findIndex((child) => child.id === childId);
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (index < 0 || targetIndex < 0 || targetIndex >= children.length) {
          return item;
        }
        const [moved] = children.splice(index, 1);
        children.splice(targetIndex, 0, moved);
        return { ...item, children };
      })
    }));
  };

  const updateHeaderCta = (field, value) => {
    commitVisualHeaderModel((current) => ({
      ...current,
      [field]: value
    }));
  };

  return (
    <section className="site-chrome-shell">
      <div className="site-chrome-banner">
        <div className="site-chrome-banner-copy">
          <CheckCircle2 size={18} />
          <span>Editing website {kind} content.</span>
        </div>
        <div className="site-chrome-tabs">
          <button type="button" className={kind === "header" ? "active" : ""} onClick={() => openSiteChromeView("header")}>Header</button>
          <button type="button" className={kind === "footer" ? "active" : ""} onClick={() => openSiteChromeView("footer")}>Footer</button>
        </div>
      </div>

      <div className="site-chrome-grid">
        <form className="panel site-chrome-editor" onSubmit={(event) => savePage(event, kind)}>
          <div className="panel-head site-chrome-panel-head">
            <div>
              <span className="eyebrow">Global Layout</span>
              <h2>Header & Footer</h2>
            </div>
            <span className={`badge ${isSavedStatus ? "" : "draft"}`}>{statusLabel}</span>
          </div>

          <div className="site-chrome-fields">
            <p className="site-chrome-hint">
              Edit the global {kind} HTML here. Saving creates or updates the active CRM page with slug <code>{config.slug}</code>.
            </p>

            <div className="field-grid">
              <Field label="Title">
                <input value={page.title} onChange={(event) => updateField("title", event.target.value)} />
              </Field>
              <Field label="Status">
                <select value={page.status} onChange={(event) => updateField("status", event.target.value)}>
                  {statusOptions.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </Field>
              <Field label="Source Path">
                <input value={sourcePath} onChange={(event) => updateField("sourceUrl", event.target.value)} />
              </Field>
              <Field label="Slug">
                <input value={page.slug} readOnly />
              </Field>
            </div>

            <Field label="Summary">
              <textarea rows="3" value={page.summary} onChange={(event) => updateField("summary", event.target.value)} />
            </Field>

            {kind === "header" && (
              <div className="site-chrome-visual-editor">
                <div className="site-chrome-editor-label">
                  <strong>Visual Header Builder</strong>
                  <small>{visualHeaderModel.menuItems.length} main items</small>
                </div>
                <p className="site-chrome-hint">
                  Edit the live header menu visually. Special mega-menu items are preserved, while standard menu items and dropdowns can be changed directly.
                </p>

                <div className="site-chrome-cta-grid">
                  <Field label="Header CTA Label">
                    <input value={visualHeaderModel.ctaLabel} onChange={(event) => updateHeaderCta("ctaLabel", event.target.value)} />
                  </Field>
                  <Field label="Header CTA URL">
                    <input value={visualHeaderModel.ctaUrl} onChange={(event) => updateHeaderCta("ctaUrl", event.target.value)} />
                  </Field>
                </div>

                <div className="site-chrome-menu-list">
                  {visualHeaderModel.menuItems.map((item, index) => (
                    <div className="site-chrome-menu-card" key={item.id}>
                      <div className="site-chrome-menu-card-head">
                        <div>
                          <strong>{item.title || `Menu Item ${index + 1}`}</strong>
                          <small>{item.isMega ? "Mega menu preserved" : item.children.length ? "Dropdown menu" : "Single link"}</small>
                        </div>
                        <div className="site-chrome-menu-actions">
                          <button className="ghost-button" type="button" onClick={() => moveHeaderMenuItem(item.id, "up")} disabled={index === 0}>
                            <ChevronUp size={16} />
                            <span>Up</span>
                          </button>
                          <button className="ghost-button" type="button" onClick={() => moveHeaderMenuItem(item.id, "down")} disabled={index === visualHeaderModel.menuItems.length - 1}>
                            <ChevronDown size={16} />
                            <span>Down</span>
                          </button>
                          {!item.isMega && (
                            <button className="danger-button" type="button" onClick={() => removeHeaderMenuItem(item.id)}>
                              <Trash2 size={16} />
                              <span>Remove</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="field-grid">
                        <Field label="Label">
                          <input value={item.title} onChange={(event) => updateHeaderMenuItem(item.id, "title", event.target.value)} />
                        </Field>
                        <Field label="URL">
                          <input value={item.href} onChange={(event) => updateHeaderMenuItem(item.id, "href", event.target.value)} />
                        </Field>
                      </div>

                      {item.isMega ? (
                        <div className="site-chrome-locked-note">
                          <CheckCircle2 size={15} />
                          <span>This item keeps the existing Programs mega-menu structure. Only its label and URL are edited here.</span>
                        </div>
                      ) : (
                        <div className="site-chrome-children">
                          <div className="site-chrome-children-head">
                            <strong>Dropdown Items</strong>
                            <button className="ghost-button" type="button" onClick={() => addHeaderChildItem(item.id)}>
                              <Plus size={16} />
                              <span>Add Child</span>
                            </button>
                          </div>
                          {(item.children || []).map((child, childIndex) => (
                            <div className="site-chrome-child-row" key={child.id}>
                              <input value={child.title} onChange={(event) => updateHeaderChildItem(item.id, child.id, "title", event.target.value)} placeholder="Child label" />
                              <input value={child.href} onChange={(event) => updateHeaderChildItem(item.id, child.id, "href", event.target.value)} placeholder="Child URL" />
                              <button className="icon-button" type="button" aria-label="Move child up" onClick={() => moveHeaderChildItem(item.id, child.id, "up")} disabled={childIndex === 0}>
                                <ChevronUp size={16} />
                              </button>
                              <button className="icon-button" type="button" aria-label="Move child down" onClick={() => moveHeaderChildItem(item.id, child.id, "down")} disabled={childIndex === item.children.length - 1}>
                                <ChevronDown size={16} />
                              </button>
                              <button className="icon-button danger" type="button" aria-label="Remove child" onClick={() => removeHeaderChildItem(item.id, child.id)}>
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                          {!item.children.length && (
                            <div className="site-chrome-empty-note">This menu item currently has no dropdown children.</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="site-chrome-builder-footer">
                  <button className="ghost-button" type="button" onClick={addHeaderMenuItem}>
                    <Plus size={16} />
                    <span>Add Main Menu Item</span>
                  </button>
                </div>
              </div>
            )}

            <div className="site-chrome-editor-block">
              <div className="site-chrome-editor-label">
                <strong>{config.title} HTML</strong>
                <small>{snippetHtml.length} characters</small>
              </div>
              <textarea
                className="site-chrome-textarea"
                rows="22"
                value={snippetHtml}
                onChange={(event) => updateHtml(kind, event.target.value)}
                placeholder={`Paste ${config.title.toLowerCase()} markup here`}
              />
            </div>

            <div className="site-chrome-footer">
              <div className="site-chrome-save-note">
                {isSavedStatus ? <CheckCircle2 size={15} /> : <Save size={15} />}
                <span>{isSavedStatus ? "Published content loaded." : "Changes are in draft state until you save."}</span>
              </div>
              <button className="primary-button site-chrome-save" type="submit">
                <Save size={17} />
                <span>Save {kind === "header" ? "Header" : "Footer"}</span>
              </button>
            </div>
          </div>
        </form>

        <div className="site-chrome-preview-col">
          <div className="panel site-chrome-preview-panel">
            <div className="panel-head compact site-chrome-panel-head">
              <div>
                <span className="eyebrow">Live Preview</span>
                <h2>{config.title}</h2>
              </div>
              <span className={`badge ${isSavedStatus ? "" : "draft"}`}>{isSavedStatus ? "Published" : "Draft"}</span>
            </div>

            <div className="website-preview website-preview-html site-chrome-preview">
              <div className="preview-html-head site-chrome-preview-head">
                <div>
                  <span className="eyebrow">Snippet Canvas</span>
                  <h3>{config.title}</h3>
                </div>
                <small>{sourcePath}</small>
              </div>
              <iframe title={`${config.title} preview`} srcDoc={buildSiteChromePreviewDocument(kind, snippetHtml)} sandbox="" />
            </div>
          </div>
        </div>
      </div>
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

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function StatusPill({ status }) {
  return <span className={`status-badge ${status.toLowerCase()}`}>{status}</span>;
}

function CheckItem({ done, label }) {
  return (
    <div className={done ? "check-item done" : "check-item"}>
      {done ? <CheckCircle2 size={17} /> : <CircleDot size={17} />}
      <span>{label}</span>
    </div>
  );
}

function ModuleRow({ icon: Icon, label, value }) {
  return (
    <div className="module-row">
      <Icon size={18} />
      <div>
        <strong>{label}</strong>
        <span>{value}</span>
      </div>
      <ChevronRight size={17} />
    </div>
  );
}

function TimelineItem({ label, detail, status }) {
  return (
    <div className="timeline-item">
      <span />
      <div>
        <strong>{label}</strong>
        <small>{detail}</small>
      </div>
      <em>{status}</em>
    </div>
  );
}

export default App;
