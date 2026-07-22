import { LIVE_SITE_ORIGIN, LIVE_ASSET_PROXY_PREFIX, assets } from "../modules/mediaLibrary";
import { SITE_CHROME_CONFIGS } from "./portalRuntime";
import { slugify, normalizeIncomingPageType, escapeHtml, normalizePageForEditableImport, createSection, normalizeSection, normalizePage, emptyPage, getSiteChromeConfig, normalizeComparablePath, isTruthySiteChromeFlag, isMatchingSiteChromePage } from "./pageRuntime";

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

const getLinkedNavigationSlug = (item = {}) => {
  const candidate = String(
    item?.slug || normalizeNavigationHrefToSlug(item?.custom_url || item?.href || "") || ""
  ).trim();

  // `slugify("")` intentionally returns `new-page` for authored page forms.
  // Navigation headings such as "Admission" use href="#" and are not pages,
  // so they must stay empty here instead of becoming a synthetic nav record.
  return candidate ? slugify(candidate) : "";
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
  if (value.includes("research")) return "Research Page";
  if (value.includes("blog") || value.includes("news")) return "News Article";
  if (value.includes("contact") || value.includes("about") || value.includes("campus")) return "Campus Page";
  if (value.includes("home")) return "Home Section";
  return "Static Page";
};

const canonicalizeNewsSlug = (value = "") => {
  const slug = slugify(value);
  if (slug === "blog") return "news";
  return slug.replace(/^blog-details(?=-|$)/i, "news-details");
};

const canonicalizeNewsUrl = (value = "", fallbackSlug = "") => {
  const raw = String(value || `/${fallbackSlug}`).trim();
  return raw
    .replace(/(^|\/)blog-details(?=-|(?:\.html)?(?:[?#]|$))/i, "$1news-details")
    .replace(/(^|\/)blog(?=(?:\.html)?(?:[?#]|$))/i, "$1news");
};

const createPageFromNavigationItem = (item = {}, options = {}) => {
  const title = String(item?.title || item?.page_title || "Imported Page").trim() || "Imported Page";
  const slug = canonicalizeNewsSlug(item?.slug || normalizeNavigationHrefToSlug(item?.custom_url || item?.href || "") || title);
  const parentTitle = String(options.parentTitle || "").trim();
  const parentSlug = canonicalizeNewsSlug(options.parentSlug || "");
  const menuTitle = parentTitle || title;
  const canonicalUrl = canonicalizeNewsUrl(item?.custom_url || item?.href, slug);

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
    ctaUrl: canonicalUrl,
    seoTitle: `${title} | Madda Walabu University`,
    seoDescription: `Madda Walabu University ${title} page.`,
    sourceUrl: canonicalUrl,
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
    const parseChildren = (list, path) => Array.from(list?.children || []).map((child, childIndex) => {
      const childLink = Array.from(child.children || []).find((entry) => entry.tagName?.toLowerCase() === "a") || child.querySelector("a");
      const nested = Array.from(child.children || []).find((entry) => entry.tagName?.toLowerCase() === "ul");
      return { id: `${path}-child-${childIndex}`, title: String(childLink?.textContent || "").trim(), href: childLink?.getAttribute("href") || "#", children: parseChildren(nested, `${path}-child-${childIndex}`) };
    }).filter((child) => child.title || child.href || child.children.length);
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
            children: isMega || !subMenu ? [] : parseChildren(subMenu, `header-menu-${index}`)
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
        ${children.map((child) => buildVisualHeaderMenuItemHtml(child)).join("\n")}
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
    const itemSlug = getLinkedNavigationSlug(item);
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
      const childSlug = getLinkedNavigationSlug(child);
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

export {
  getSiteChromePageRank,
  findSiteChromePage,
  getSiteChromePageKind,
  looksLikeSiteChromeMarkup,
  getSiteChromeApiRecord,
  normalizeSiteChromeApiPage,
  getSiteChromeHtml,
  hasMeaningfulSiteChromeHtml,
  getAbsoluteLiveAssetUrl,
  getFetchableLiveAssetUrl,
  normalizeNavigationHrefToSlug,
  parseStaticHeaderNavigation,
  getNavigationPageType,
  createPageFromNavigationItem,
  createPagesFromNavigationSnapshot,
  parseHeaderVisualModel,
  buildVisualHeaderMenuItemHtml,
  updateHeaderHtmlFromVisualModel,
  applyNavigationSnapshotToPages,
  createSiteChromePage,
  getMenuReferenceLabel
};
