const MEDIA_LIBRARY_KEY = "mwu-crm-media-library-v1";
const LIVE_SITE_ORIGIN = "https://maddauni.online";
const DEV_MEDIA_PROXY_PREFIX = "/__live_media";
const LIVE_ASSET_PROXY_PREFIX = "/__live_asset";
const MEDIA_API_PATH = "/admin/media";

const normalizeDevProxyBaseUrl = (value, devPrefix) => {
  const raw = String(value || "").replace(/\/$/, "");
  if (!raw) return "";
  if (!import.meta.env.DEV) return raw;
  try {
    const url = new URL(raw);
    return `${devPrefix}${url.pathname}`.replace(/\/$/, "");
  } catch {
    return raw;
  }
};

const MEDIA_API_BASE_URL = normalizeDevProxyBaseUrl(
  import.meta.env.VITE_MEDIA_API_BASE_URL || "",
  DEV_MEDIA_PROXY_PREFIX
);

const mediaApiUrl = (path = MEDIA_API_PATH) =>
  MEDIA_API_BASE_URL ? `${MEDIA_API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}` : "";

const assets = {
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

const loadMediaLibrary = () => {
  try {
    const stored = window.localStorage.getItem(MEDIA_LIBRARY_KEY);
    const parsed = stored ? JSON.parse(stored) : initialMediaLibrary;
    const normalized = Array.isArray(parsed)
      ? parsed.map(normalizeMediaItem)
      : initialMediaLibrary.map(normalizeMediaItem);
    const existingIds = new Set(normalized.map((item) => item.id));
    const missingSeedItems = initialMediaLibrary
      .map(normalizeMediaItem)
      .filter((item) => !existingIds.has(item.id));
    return [...normalized, ...missingSeedItems];
  } catch {
    return initialMediaLibrary.map(normalizeMediaItem);
  }
};

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

export {
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
  loadMediaLibrary,
  readFileAsDataUrl,
  readImageDimensions,
  normalizeLiveAssetUrl,
  canLoadRemoteImage
};
