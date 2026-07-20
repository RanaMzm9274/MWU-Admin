import { LIVE_SITE_ORIGIN, LIVE_ASSET_PROXY_PREFIX, assets } from "../modules/mediaLibrary";
import { makeId, todayIso, googleFontsHref, SITE_CHROME_CONFIGS } from "./portalRuntime";

const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "") || "new-page";

const normalizeSlugReference = (value = "") =>
  String(value || "")
    .trim()
    .replace(/^https?:\/\/[^/]+/i, "")
    .split(/[?#]/)[0]
    .replace(/^\/+/, "")
    .replace(/^legacy\//i, "")
    .replace(/\.html$/i, "")
    .replace(/\/+$/, "");

const rewriteSlugUrlReference = (value = "", previousSlug = "", nextSlug = "") => {
  const source = String(value || "");
  const oldSlug = normalizeSlugReference(previousSlug);
  const newSlug = normalizeSlugReference(nextSlug);
  if (!source || !oldSlug || !newSlug || oldSlug === newSlug) return source;

  const escapedSlug = escapeForRegExp(oldSlug);
  return source.replace(
    new RegExp(`(^|[\\/])${escapedSlug}(?=(?:\\.html)?(?:[\\/?#]|$))`, "gi"),
    (match, prefix) => `${prefix}${newSlug}`
  );
};

const rewriteSlugReferencesInMarkup = (markup = "", previousSlug = "", nextSlug = "") =>
  String(markup || "").replace(
    /(\b(?:href|action|formaction|data-href|data-url|data-link)\s*=\s*)(["'])([^"']*)(\2)/gi,
    (match, prefix, quote, url, closingQuote) =>
      `${prefix}${quote}${rewriteSlugUrlReference(url, previousSlug, nextSlug)}${closingQuote}`
  );

const migratePageSlugReferences = (page = {}, previousSlug = "", nextSlug = "", options = {}) => {
  const oldSlug = normalizeSlugReference(previousSlug);
  const newSlug = normalizeSlugReference(nextSlug);
  if (!oldSlug || !newSlug || oldSlug === newSlug) {
    return { page, changed: false };
  }

  let changed = false;
  const visit = (value, key = "", parentKey = "") => {
    if (Array.isArray(value)) {
      return value.map((item) => visit(item, "", key));
    }
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([childKey, childValue]) => [childKey, visit(childValue, childKey, key)])
      );
    }
    if (typeof value !== "string") return value;

    const normalizedKey = String(key || "").replace(/[^a-z]/gi, "").toLowerCase();
    const normalizedParentKey = String(parentKey || "").replace(/[^a-z]/gi, "").toLowerCase();
    let nextValue = value;

    if (
      ["bodyhtml", "rawhtml", "html", "markup", "code", "content", "body"].includes(normalizedKey) &&
      /<\w[\s>]/.test(value)
    ) {
      nextValue = rewriteSlugReferencesInMarkup(value, oldSlug, newSlug);
    } else if (normalizedKey === "parentslug" || normalizedKey === "pageslug") {
      nextValue = normalizeSlugReference(value) === oldSlug ? newSlug : rewriteSlugUrlReference(value, oldSlug, newSlug);
    } else if (
      normalizedKey !== "sourceurl" &&
      (normalizedKey.includes("href") || normalizedKey.endsWith("url") || normalizedKey.includes("link") || normalizedKey === "action")
    ) {
      nextValue = rewriteSlugUrlReference(value, oldSlug, newSlug);
    } else if (options.updateEmbeddedPageSlug && normalizedKey === "slug" && normalizedParentKey === "pagesettings") {
      nextValue = normalizeSlugReference(value) === oldSlug ? newSlug : value;
    }

    if (nextValue !== value) changed = true;
    return nextValue;
  };

  return { page: visit(page), changed };
};

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

export {
  slugify,
  normalizeSlugReference,
  rewriteSlugUrlReference,
  rewriteSlugReferencesInMarkup,
  migratePageSlugReferences,
  normalizeIncomingPageType,
  getApiPageType,
  defaultPageStyles,
  defaultSectionStyles,
  toCssUnit,
  stripDangerousHtml,
  isSkippableAssetUrl,
  escapeForRegExp,
  localSiteCssLinks,
  proxiedSiteCssLinks,
  normalizeStylesheetUrlForEditableCanvas,
  normalizeAssetUrlForEditableCanvas,
  rewriteHtmlForLocalEditing,
  injectLocalSiteCssLinks,
  restoreLiveAssetUrls,
  looksLikeUsableHtmlDocument,
  isImportedPlaceholderPage,
  getSectionStyles,
  getPageStyles,
  sectionCanvasStyle,
  escapeHtml,
  THUMBNAIL_PALETTE,
  GENERATED_THUMBNAIL_CACHE,
  hashString,
  clampText,
  splitTextLines,
  getGeneratedThumbnailForPage,
  VISUAL_BUILDER_COMMENT_PREFIX,
  HTML_VISUAL_BUILDER_COMMENT_PREFIX,
  serializeHtmlVisualBuilderSnapshot,
  extractHtmlVisualBuilderSnapshot,
  getHtmlVisualBuilderSnapshotFromPage,
  createHtmlBuilderElement,
  defaultHtmlBuilderBox,
  defaultHtmlBuilderAdvanced,
  buildHtmlBuilderPageSettings,
  htmlBuilderSpacingFromNode,
  htmlBuilderColorFromNode,
  extractHtmlBuilderSourceMarkup,
  createHtmlBuilderTextElement,
  createHtmlBuilderHeadingElement,
  createHtmlBuilderImageElement,
  createHtmlBuilderButtonElement,
  createHtmlBuilderListElement,
  createHtmlBuilderSpacerElement,
  createHtmlBuilderContainerElement,
  createHtmlBuilderImportedPageElement,
  convertDomNodeToHtmlBuilderElements,
  buildHtmlVisualBuilderFallbackElements,
  buildHtmlVisualBuilderInitPayload,
  extractInlineStylesFromHtmlDocument,
  extractStylesheetLinksFromHtmlDocument,
  resolveHtmlBuilderImportCssLinks,
  VISUAL_WIDGET_LIBRARY,
  createVisualWidget,
  createVisualContainer,
  createVisualBuilderContent,
  createDefaultVisualBuilderModel,
  cloneVisualBuilderModel,
  cloneVisualBuilderElement,
  normalizeVisualBuilderElement,
  normalizeVisualBuilderModel,
  serializeVisualBuilderModel,
  extractVisualBuilderModelFromMarkup,
  getVisualContainerInlineStyle,
  getVisualWidgetWrapperStyle,
  buildVisualWidgetMarkup,
  buildVisualBuilderElementsMarkup,
  buildVisualBuilderBodyMarkup,
  isVisualBuilderPage,
  getVisualBuilderModelFromPage,
  getVisualBuilderElementLabel,
  walkVisualBuilderElements,
  findVisualBuilderElementMeta,
  resolveVisualBuilderTargetContainerId,
  updateVisualBuilderElements,
  appendVisualBuilderElement,
  removeVisualBuilderElement,
  duplicateVisualBuilderElement,
  moveVisualBuilderElement,
  buildStructuredBodyMarkup,
  buildStructuredSectionMarkup,
  buildStructuredPageBodyMarkup,
  hasLegacyHtml,
  hasPersistedEditableMarkup,
  hasUsableHtmlBuilderSnapshot,
  getStoredEditableDocument,
  getLivePageUrl,
  getLiveRoutePath,
  extractBodyHtml,
  generatedEditableBaseCss,
  mergeBodyIntoHtml,
  ensureEditableDocumentShell,
  buildEditableLiveDocument,
  LEGACY_ROUTE_ALIASES,
  toLegacyHtmlPath,
  getLegacyRouteCandidates,
  getLiveFetchPath,
  getLegacyRoutePath,
  getLegacyFetchPath,
  getLegacyFetchPaths,
  getEditableFetchCandidates,
  getCanonicalEditableSourceUrl,
  normalizePageForEditableImport,
  buildPreviewDocument,
  buildSiteChromePreviewDocument,
  formatHtmlPreview,
  formatDate,
  sectionTemplates,
  createSection,
  makeRevision,
  normalizeSection,
  titleCaseStatus,
  normalizePage,
  getAutoThumbnailForPage,
  getPageBodyHtmlForSave,
  hasHtmlBackedPageMarkup,
  hasEmbeddedImageData,
  toApiPagePayload,
  readOptionalJson,
  uniqueValues,
  getPageApiIdentifiers,
  isLocalDraftPage,
  withPageApiIdentifiers,
  withPageDeleteIdentifiers,
  withoutLocalPageMarkers,
  shouldTryNextMutationRoute,
  createPage,
  initialPages,
  emptyPage,
  createBlankLocalDraftPage,
  getSiteChromeConfig,
  isSiteChromePage,
  normalizeComparablePath,
  isTruthySiteChromeFlag,
  isMatchingSiteChromePage
};
