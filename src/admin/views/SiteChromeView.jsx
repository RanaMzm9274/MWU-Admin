import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  Globe2,
  Layers,
  Link2,
  ListTree,
  Plus,
  Save,
  Search,
  Trash2,
  X
} from "lucide-react";
import { Field } from "../components/Common";

const cleanMenuText = (value = "") => String(value || "").replace(/\s+/g, " ").trim();
const escapeMenuMarkup = (value = "") =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const getCategoryProgramIds = (category, programs = []) =>
  Array.isArray(category?.programIds)
    ? category.programIds.map(String)
    : programs.filter((program) => program.categorySlug === category?.slug).map((program) => String(program.id));

const getProgramMenuHref = (program = {}) => {
  const raw = String(program.pageSlug || program.slug || "").trim();
  if (!raw) return "";
  if (/^(https?:\/\/|\/|#)/i.test(raw) || /\.html?(?:[?#].*)?$/i.test(raw)) return raw;
  return `${raw}.html`;
};

const getProgramsMegaMenuSelection = (html = "", category = {}, programs = []) => {
  if (typeof DOMParser === "undefined" || !String(html || "").trim()) return null;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const target = `mwu-${String(category.slug || category.id).replace(/[^a-z0-9-]/gi, "-")}`;
    const panel = Array.from(doc.querySelectorAll(".mwu-mega-panel")).find(
      (entry) => entry.getAttribute("data-panel") === target
    );
    if (!panel) return null;
    const links = Array.from(panel.querySelectorAll("a[href]")).map((link) => ({
      href: String(link.getAttribute("href") || "").replace(/^\/+|\/+$/g, ""),
      title: cleanMenuText(link.textContent).toLowerCase()
    }));
    return programs
      .filter((program) => {
        const href = getProgramMenuHref(program).replace(/^\/+|\/+$/g, "");
        return links.some((link) => link.href === href || link.title === cleanMenuText(program.title).toLowerCase());
      })
      .map((program) => String(program.id));
  } catch {
    return null;
  }
};

export const updateProgramsMegaMenuMarkup = (html = "", categories = [], programs = []) => {
  if (typeof DOMParser === "undefined" || !String(html || "").trim()) return String(html || "");

  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const activeCategories = [...categories]
      .filter((category) => category.status !== "Archived")
      .sort((a, b) => Number(a.menuOrder || 0) - Number(b.menuOrder || 0));
    const getProgramsForCategory = (category) => {
      const selectedIds = getCategoryProgramIds(category, programs);
      return programs
        .filter((program) => selectedIds.includes(String(program.id)) && program.status !== "Archived")
        .sort((a, b) => a.title.localeCompare(b.title));
    };
    const findProgramsItem = (root) => {
      const items = Array.from(root?.children || []);
      const existingMegaMenuItem = items.find(
        (item) =>
          item.classList?.contains("mwu-programs-mega") ||
          item.classList?.contains("mega-menu-wrap") ||
          Boolean(item.querySelector(":scope > .mwu-mega-programs, :scope > .mega-menu"))
      );
      if (existingMegaMenuItem) return existingMegaMenuItem;
      return items.find((item) => {
        const anchor = getDirectAnchor(item);
        const label = cleanMenuText(anchor?.textContent).toLowerCase();
        return label === "programs" || label === "academics" || label.startsWith("academics ");
      });
    };

    const desktopProgramsItem = findProgramsItem(doc.querySelector(".main-menu > ul"));
    if (desktopProgramsItem) {
      desktopProgramsItem.classList.add("menu-item-has-children", "mega-menu-wrap", "mwu-programs-mega");
      let megaMenu = Array.from(desktopProgramsItem.children).find(
        (child) => child.tagName?.toLowerCase() === "ul"
      );
      if (!megaMenu) {
        megaMenu = doc.createElement("ul");
        desktopProgramsItem.appendChild(megaMenu);
      }
      megaMenu.className = "mega-menu mwu-mega-programs";
      megaMenu.setAttribute("aria-label", "Programs Mega Menu");
      megaMenu.innerHTML = `
        <li class="mwu-mega-layout">
          <div class="mwu-mega-categories" role="tablist" aria-label="Program Categories">
            ${activeCategories
              .map((category, index) => {
                const target = `mwu-${String(category.slug || category.id).replace(/[^a-z0-9-]/gi, "-")}`;
                return `<a href="#" class="mwu-mega-category-link${index === 0 ? " active" : ""}" data-target="${escapeMenuMarkup(target)}" role="tab" aria-selected="${index === 0 ? "true" : "false"}">${escapeMenuMarkup(category.name)}</a>`;
              })
              .join("")}
          </div>
          <div class="mwu-mega-panels">
            ${activeCategories
              .map((category, index) => {
                const target = `mwu-${String(category.slug || category.id).replace(/[^a-z0-9-]/gi, "-")}`;
                const links = getProgramsForCategory(category)
                  .map((program) => `<li><a href="${escapeMenuMarkup(getProgramMenuHref(program))}">${escapeMenuMarkup(program.title)}</a></li>`)
                  .join("");
                return `<div class="mwu-mega-panel${index === 0 ? " active" : ""}" data-panel="${escapeMenuMarkup(target)}" role="tabpanel"><ul class="mwu-mega-subgrid">${links}</ul></div>`;
              })
              .join("")}
          </div>
        </li>
      `.trim();
    }

    const mobileProgramsItem = findProgramsItem(doc.querySelector(".th-mobile-menu > ul"));
    if (mobileProgramsItem) {
      mobileProgramsItem.classList.add("menu-item-has-children");
      let mobileSubmenu = Array.from(mobileProgramsItem.children).find(
        (child) => child.tagName?.toLowerCase() === "ul"
      );
      if (!mobileSubmenu) {
        mobileSubmenu = doc.createElement("ul");
        mobileProgramsItem.appendChild(mobileSubmenu);
      }
      mobileSubmenu.className = "sub-menu";
      mobileSubmenu.innerHTML = activeCategories
        .map((category) => {
          const programLinks = getProgramsForCategory(category)
            .map((program) => `<li><a href="${escapeMenuMarkup(getProgramMenuHref(program))}">${escapeMenuMarkup(program.title)}</a></li>`)
            .join("");
          return `<li class="menu-item-has-children"><a href="#">${escapeMenuMarkup(category.name)}</a><ul class="sub-menu">${programLinks}</ul></li>`;
        })
        .join("");
    }

    return doc.body.innerHTML.trim();
  } catch {
    return String(html || "");
  }
};

const getDirectAnchor = (element) => {
  if (!element) return null;
  const directAnchor = Array.from(element.children || []).find((child) => child.tagName?.toLowerCase() === "a");
  return directAnchor || element.querySelector(":scope > .dropdown-link > a");
};

const parseMenuList = (list, path = "menu") => {
  if (!list) return [];

  return Array.from(list.children || [])
    .filter((child) => child.tagName?.toLowerCase() === "li")
    .map((item, index) => {
      const directAnchor = getDirectAnchor(item);
      const isProgramsMegaMenu =
        item.classList.contains("mwu-programs-mega") ||
        item.classList.contains("mega-menu-wrap") ||
        Boolean(item.querySelector(":scope > .mwu-mega-programs"));
      let children = [];

      if (isProgramsMegaMenu) {
        children = Array.from(item.querySelectorAll(".mwu-mega-category-link")).map((category, categoryIndex) => {
          const target = category.getAttribute("data-target") || "";
          const panel = target ? item.querySelector(`[data-panel="${target}"]`) : null;
          return {
            id: `${path}-${index}-category-${categoryIndex}`,
            title: cleanMenuText(category.textContent),
            href: category.getAttribute("href") || "",
            children: Array.from(panel?.querySelectorAll("a[href]") || []).map((link, linkIndex) => ({
              id: `${path}-${index}-category-${categoryIndex}-link-${linkIndex}`,
              title: cleanMenuText(link.textContent),
              href: link.getAttribute("href") || "",
              children: []
            }))
          };
        });
      } else {
        const childLists = [
          ...Array.from(item.children || []).filter((child) => child.tagName?.toLowerCase() === "ul"),
          ...Array.from(item.querySelectorAll(":scope > .dropdown-link > ul"))
        ];
        children = childLists.flatMap((childList, childListIndex) =>
          parseMenuList(childList, `${path}-${index}-${childListIndex}`)
        );
      }

      return {
        id: `${path}-${index}`,
        title: cleanMenuText(directAnchor?.textContent) || `Menu group ${index + 1}`,
        href: directAnchor?.getAttribute("href") || "",
        children
      };
    });
};

const linksToMenuItems = (links, path, getLabel = (link) => cleanMenuText(link.textContent)) =>
  Array.from(links || []).map((link, index) => ({
    id: `${path}-${index}`,
    title: getLabel(link) || link.getAttribute("href") || `Link ${index + 1}`,
    href: link.getAttribute("href") || "",
    children: []
  }));

const getFooterNavigationWidgets = (doc) => {
  let widgets = Array.from(
    doc?.querySelectorAll("footer .widget_nav_menu, .footer-widget.widget_nav_menu, .widget.widget_nav_menu.footer-widget") || []
  );
  if (!widgets.length) {
    widgets = Array.from(
      doc?.querySelectorAll("footer .footer-widget, footer [class*='footer-menu'], footer [class*='footer-link']") || []
    ).filter((widget) => widget.querySelector("ul"));
  }
  return widgets;
};

const parseWebsiteMenuHierarchy = (html = "", kind = "header") => {
  if (typeof DOMParser === "undefined" || !String(html || "").trim()) return [];

  try {
    const doc = new DOMParser().parseFromString(html, "text/html");

    if (kind === "header") {
      const groups = [
        {
          id: "header-primary",
          title: "Main Menu Hierarchy",
          items: parseMenuList(doc.querySelector(".main-menu > ul"), "header-primary")
        },
        {
          id: "header-utility-left",
          title: "Utility Navigation",
          items: parseMenuList(doc.querySelector(".header-left-wrap"), "header-utility-left")
        },
        {
          id: "header-utility-right",
          title: "Utility Actions",
          items: parseMenuList(doc.querySelector(".header-right-wrap"), "header-utility-right")
        },
        {
          id: "header-mobile",
          title: "Mobile Navigation",
          items: parseMenuList(doc.querySelector(".th-mobile-menu > ul"), "header-mobile")
        }
      ];
      const cta = doc.querySelector(".header-action .th-btn");
      if (cta) {
        groups.push({
          id: "header-cta",
          title: "Header Call to Action",
          items: linksToMenuItems([cta], "header-cta")
        });
      }
      return groups.filter((group) => group.items.length);
    }

    const groups = [];
    const contactLinks = doc.querySelectorAll(".footer-info a[href], footer .contact-info a[href], footer [class*='contact'] a[href]");
    if (contactLinks.length) {
      groups.push({
        id: "footer-contact",
        title: "Contact Information",
        items: linksToMenuItems(contactLinks, "footer-contact")
      });
    }

    getFooterNavigationWidgets(doc).forEach((widget, index) => {
      const title =
        cleanMenuText(widget.querySelector(".widget_title, .widget-title, h2, h3, h4")?.textContent) ||
        `Footer Menu ${index + 1}`;
      const list = widget.querySelector("ul.menu, ul");
      groups.push({
        id: `footer-nav-${index}`,
        title,
        items: parseMenuList(list, `footer-nav-${index}`)
      });
    });

    const instagramLinks = doc.querySelectorAll(".instagram-feeds a[href]");
    if (instagramLinks.length) {
      groups.push({
        id: "footer-instagram",
        title: "Instagram Links",
        items: linksToMenuItems(instagramLinks, "footer-instagram", (link) =>
          cleanMenuText(link.closest(".insta-thumb")?.querySelector("img")?.getAttribute("alt")) || "Instagram post"
        )
      });
    }

    const socialLinks = doc.querySelectorAll(".th-social a[href]");
    if (socialLinks.length) {
      groups.push({
        id: "footer-social",
        title: "Social Links",
        items: linksToMenuItems(socialLinks, "footer-social", (link) => {
          const iconClass = link.querySelector("i")?.className || "";
          const platform = iconClass.match(/fa-(facebook|telegram|linkedin|instagram|youtube|twitter|x-twitter)/i)?.[1];
          return cleanMenuText(link.getAttribute("aria-label") || link.getAttribute("title") || platform || "Social profile");
        })
      });
    }

    return groups.filter((group) => group.items.length);
  } catch {
    return [];
  }
};

const setAnchorLabel = (anchor, label = "") => {
  if (!anchor) return;
  const textNode = Array.from(anchor.childNodes || []).find((node) => node.nodeType === 3 && node.textContent.trim());
  if (textNode) {
    textNode.textContent = label;
    return;
  }
  const labelElement = anchor.querySelector("span");
  if (labelElement) {
    labelElement.textContent = label;
    return;
  }
  anchor.appendChild(anchor.ownerDocument.createTextNode(label));
};

const syncFooterMenuList = (list, items = []) => {
  if (!list) return;
  const renderItems = (entries = []) => entries.map((item) => {
    const children = Array.isArray(item.children) ? item.children : [];
    return `<li${children.length ? ' class="menu-item-has-children"' : ""}><a href="${escapeMenuMarkup(item.href || "#")}">${escapeMenuMarkup(item.title || "Footer Link")}</a>${children.length ? `<ul class="sub-menu">${renderItems(children)}</ul>` : ""}</li>`;
  }).join("");
  list.innerHTML = renderItems(items);
};

const updateFooterNavigationMarkup = (html = "", groups = []) => {
  if (typeof DOMParser === "undefined" || !String(html || "").trim()) return String(html || "");

  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    getFooterNavigationWidgets(doc).forEach((widget, index) => {
      const group = groups.find((item) => item.id === `footer-nav-${index}`);
      if (!group) return;
      syncFooterMenuList(widget.querySelector("ul.menu, ul"), group.items);
    });
    return doc.body.innerHTML.trim();
  } catch {
    return String(html || "");
  }
};

const updateMenuTreeItem = (items = [], itemId, updater) =>
  items.map((item) => {
    if (item.id === itemId) return updater(item);
    if (!item.children?.length) return item;
    return {
      ...item,
      children: updateMenuTreeItem(item.children, itemId, updater)
    };
  });

const removeMenuTreeItem = (items = [], itemId) =>
  items
    .filter((item) => item.id !== itemId)
    .map((item) => ({ ...item, children: removeMenuTreeItem(item.children || [], itemId) }));

const addMenuTreeChild = (items = [], parentId, child) =>
  updateMenuTreeItem(items, parentId, (item) => ({ ...item, children: [...(item.children || []), child] }));

const createHeaderChildItem = (parentId) => ({
  id: `header-child-added-${Date.now()}-${parentId}`,
  title: "New menu item",
  href: "#",
  children: []
});

const moveMenuTreeItem = (items = [], itemId, direction) => {
  const index = items.findIndex((item) => item.id === itemId);
  if (index >= 0) {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= items.length) return items;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    return next;
  }
  return items.map((item) => ({ ...item, children: moveMenuTreeItem(item.children || [], itemId, direction) }));
};

function MenuHierarchyItems({ items = [] }) {
  return (
    <ul className="site-chrome-hierarchy-list">
      {items.map((item) => (
        <li key={item.id}>
          <div className="site-chrome-hierarchy-row">
            <span>{item.title}</span>
            {item.href && <code>{item.href}</code>}
          </div>
          {!!item.children?.length && <MenuHierarchyItems items={item.children} />}
        </li>
      ))}
    </ul>
  );
}

const normalizeCustomMenuUrl = (value = "") => {
  const url = String(value || "").trim();
  if (!url || /\s/.test(url) || /^(?:javascript|data|vbscript):/i.test(url)) return "";
  return /^www\./i.test(url) ? `https://${url}` : url;
};

function PageLinkSelect({ value = "", pages = [], onChange, ariaLabel = "Select linked page" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const uniquePages = Array.from(
    new Map(
      pages
        .filter((page) => page?.href)
        .map((page) => [String(page.href), page])
    ).values()
  );
  const selectedPage = uniquePages.find((page) => String(page.href) === String(value)) || null;
  const filteredPages = uniquePages.filter((page) =>
    [page.title, page.type, page.href]
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase())
  );
  const customUrl = normalizeCustomMenuUrl(query);
  const customUrlMatchesPage = uniquePages.some((page) => String(page.href) === customUrl);

  const selectPage = (href, page = null) => {
    onChange(href, page);
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div
      className="site-chrome-page-link-select"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
          setQuery("");
        }
      }}
    >
      <button
        className={`site-chrome-page-link-trigger${isOpen ? " open" : ""}`}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <Link2 size={16} />
        <span>
          <strong>{selectedPage?.title || (value ? "Current website link" : "Select a website page")}</strong>
          <small>{selectedPage ? `${selectedPage.type || "Page"} · ${selectedPage.href}` : value || "Choose from published website pages"}</small>
        </span>
        <ChevronDown size={16} />
      </button>

      {isOpen && (
        <div className="site-chrome-page-link-popover">
          <label className="site-chrome-page-link-search">
            <Search size={16} />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setIsOpen(false);
                  setQuery("");
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  const firstPage = filteredPages[0];
                  if (firstPage) {
                    selectPage(firstPage.href, firstPage);
                  } else if (customUrl) {
                    selectPage(customUrl, null);
                  }
                }
              }}
              placeholder="Search pages or enter a custom URL"
            />
          </label>
          <div className="site-chrome-page-link-options" role="listbox" aria-label={ariaLabel}>
            {value && !selectedPage && (
              <button className="current" type="button" role="option" aria-selected="true" onClick={() => selectPage(value)}>
                <span>
                  <strong>Keep current link</strong>
                  <small>{value}</small>
                </span>
                <CheckCircle2 size={16} />
              </button>
            )}
            {filteredPages.map((page) => (
              <button
                className={String(page.href) === String(value) ? "selected" : ""}
                key={`${page.id}-${page.href}`}
                type="button"
                role="option"
                aria-selected={String(page.href) === String(value)}
                onClick={() => selectPage(page.href, page)}
              >
                <span>
                  <strong>{page.title}</strong>
                  <small>{page.type || "Page"} · {page.href}</small>
                </span>
                {String(page.href) === String(value) && <CheckCircle2 size={16} />}
              </button>
            ))}
            {customUrl && !customUrlMatchesPage && (
              <button
                className="site-chrome-page-link-custom"
                type="button"
                role="option"
                aria-selected="false"
                onClick={() => selectPage(customUrl, null)}
              >
                <span>
                  <strong>Use custom URL</strong>
                  <small>{customUrl}</small>
                </span>
                <Plus size={16} />
              </button>
            )}
            {!filteredPages.length && !customUrl && (
              <div className="site-chrome-page-link-empty">No matching website pages found. Enter a custom URL to use it directly.</div>
            )}
          </div>
          <button className="site-chrome-page-link-clear" type="button" onClick={() => selectPage("", null)}>
            Clear page selection
          </button>
        </div>
      )}
    </div>
  );
}

function PageLinkField({ label, children }) {
  return (
    <div className="field">
      <span>{label}</span>
      {children}
    </div>
  );
}

function FooterMenuItemEditor({ item, groupId, pages, depth = 0, onFieldChange, onPageSelect, onAddChild, onRemove, onMove }) {
  return (
    <div className="site-chrome-footer-link-wrap" style={{ "--footer-link-depth": depth }}>
      <div className="site-chrome-footer-link-row">
        <Field label="Navigation Label">
          <input value={item.title} onChange={(event) => onFieldChange(groupId, item.id, "title", event.target.value)} />
        </Field>
        <PageLinkField label="Linked Page">
          <PageLinkSelect
            value={item.href}
            pages={pages}
            ariaLabel={`Select footer page for ${item.title || "navigation item"}`}
            onChange={(href, selectedPage) => onPageSelect(groupId, item.id, href, selectedPage)}
          />
        </PageLinkField>
        <div className="site-chrome-menu-actions">
          <button className="ghost-button" type="button" onClick={() => onAddChild(groupId, item.id)}><Plus size={15} /><span>Add Child</span></button>
          <button className="icon-button" type="button" aria-label="Move item up" onClick={() => onMove(groupId, item.id, "up")}><ChevronUp size={15} /></button>
          <button className="icon-button" type="button" aria-label="Move item down" onClick={() => onMove(groupId, item.id, "down")}><ChevronDown size={15} /></button>
          <button className="icon-button danger" type="button" aria-label="Remove item" onClick={() => onRemove(groupId, item.id)}><Trash2 size={15} /></button>
        </div>
      </div>
      {(item.children || []).map((child) => (
        <FooterMenuItemEditor
          key={child.id}
          item={child}
          groupId={groupId}
          pages={pages}
          depth={depth + 1}
          onFieldChange={onFieldChange}
          onPageSelect={onPageSelect}
          onAddChild={onAddChild}
          onRemove={onRemove}
          onMove={onMove}
        />
      ))}
    </div>
  );
}

function HeaderChildItemEditor({ item, pages, depth = 1, onFieldChange, onPageSelect, onAddChild, onRemove, onMove }) {
  return (
    <div className="site-chrome-footer-link-wrap" style={{ "--footer-link-depth": depth }}>
      <div className="site-chrome-child-row">
        <input value={item.title} onChange={(event) => onFieldChange(item.id, "title", event.target.value)} placeholder={depth > 1 ? "Subchild label" : "Child label"} />
        <PageLinkSelect value={item.href} pages={pages} ariaLabel={`Select page for ${item.title || "menu item"}`} onChange={(href, page) => onPageSelect(item.id, href, page)} />
        <button className="icon-button" type="button" aria-label="Add child" title="Add child" onClick={() => onAddChild(item.id)}><Plus size={16} /></button>
        <button className="icon-button" type="button" aria-label="Move up" onClick={() => onMove(item.id, "up")}><ChevronUp size={16} /></button>
        <button className="icon-button" type="button" aria-label="Move down" onClick={() => onMove(item.id, "down")}><ChevronDown size={16} /></button>
        <button className="icon-button danger" type="button" aria-label="Remove item" onClick={() => onRemove(item.id)}><Trash2 size={16} /></button>
      </div>
      {(item.children || []).map((child) => <HeaderChildItemEditor key={child.id} item={child} pages={pages} depth={depth + 1} onFieldChange={onFieldChange} onPageSelect={onPageSelect} onAddChild={onAddChild} onRemove={onRemove} onMove={onMove} />)}
    </div>
  );
}

const hasExpectedSiteChromeMarkup = (html = "", kind = "header") => {
  if (typeof DOMParser === "undefined" || !String(html || "").trim()) return false;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return kind === "footer"
      ? Boolean(doc.querySelector("footer, .footer-wrapper, .footer-layout"))
      : Boolean(doc.querySelector("header, .th-header, .main-menu, .th-mobile-menu"));
  } catch {
    return false;
  }
};

export default function SiteChromeView({
  kind,
  page,
  config,
  snippetHtml,
  statusOptions = [],
  openSiteChromeView,
  updateField,
  updateHtml,
  savePage,
  parseHeaderVisualModel,
  updateHeaderHtmlFromVisualModel,
  programCategories = [],
  programs = [],
  updateProgramCategory,
  saveMegaMenu,
  availableMenuPages = [],
  linkablePages = [],
  previewSourceUrl = "",
  buildSiteChromePreviewDocument
}) {
  const sourcePath = page.sourceUrl || page.source_url || config.sourceUrl;
  const statusLabel = page.status || "Draft";
  const isSavedStatus = String(statusLabel).toLowerCase() === "published";
  const visualHeaderModel = useMemo(() => parseHeaderVisualModel(snippetHtml), [parseHeaderVisualModel, snippetHtml]);
  const websiteMenuGroups = useMemo(() => parseWebsiteMenuHierarchy(snippetHtml, kind), [kind, snippetHtml]);
  const importedMainMenuGroup = useMemo(
    () => websiteMenuGroups.find((group) => group.id === "header-primary") || null,
    [websiteMenuGroups]
  );
  const footerNavigationGroups = useMemo(
    () => websiteMenuGroups.filter((group) => group.id.startsWith("footer-nav-")),
    [websiteMenuGroups]
  );
  const hierarchyItemCount = useMemo(() => {
    const countItems = (items = []) => items.reduce((total, item) => total + 1 + countItems(item.children), 0);
    return websiteMenuGroups.reduce((total, group) => total + countItems(group.items), 0);
  }, [websiteMenuGroups]);
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const [megaMenuCategoryId, setMegaMenuCategoryId] = useState("");
  const [megaMenuProgramIds, setMegaMenuProgramIds] = useState([]);
  const [megaMenuQuery, setMegaMenuQuery] = useState("");
  const [megaMenuSaving, setMegaMenuSaving] = useState(false);
  const [mainMenuOpen, setMainMenuOpen] = useState(false);
  const [mainMenuItems, setMainMenuItems] = useState([]);
  const [mainMenuParentId, setMainMenuParentId] = useState("");
  const [mainMenuPageIds, setMainMenuPageIds] = useState([]);
  const [mainMenuQuery, setMainMenuQuery] = useState("");
  const sortedProgramCategories = useMemo(
    () =>
      [...programCategories]
        .filter((category) => category.status !== "Archived")
        .sort((a, b) => Number(a.menuOrder || 0) - Number(b.menuOrder || 0)),
    [programCategories]
  );
  const activeMegaMenuCategory =
    sortedProgramCategories.find((category) => String(category.id) === String(megaMenuCategoryId)) ||
    sortedProgramCategories[0] ||
    null;
  const filteredMegaMenuPrograms = useMemo(
    () =>
      [...programs]
        .filter((program) => program.status !== "Archived")
        .filter((program) =>
          [program.title, program.level, program.college, program.pageSlug]
            .join(" ")
            .toLowerCase()
            .includes(megaMenuQuery.toLowerCase())
        )
        .sort((a, b) => a.title.localeCompare(b.title)),
    [megaMenuQuery, programs]
  );
  const liveProgramCategories = useMemo(
    () => programCategories.map((category) => {
      const programIds = getProgramsMegaMenuSelection(snippetHtml, category, programs);
      return programIds === null ? category : { ...category, programIds };
    }),
    [programCategories, programs, snippetHtml]
  );
  const filteredMenuPages = useMemo(
    () =>
      availableMenuPages.filter((page) =>
        [page.title, page.href, page.type, page.menu]
          .join(" ")
          .toLowerCase()
          .includes(mainMenuQuery.toLowerCase())
      ),
    [availableMenuPages, mainMenuQuery]
  );
  const mainMenuParentOptions = useMemo(() => {
    const flatten = (items = [], depth = 0) => items.flatMap((item) => item.isMega ? [] : [{ item, depth }, ...flatten(item.children || [], depth + 1)]);
    return flatten(mainMenuItems);
  }, [mainMenuItems]);
  const selectedMainMenuParent = mainMenuParentOptions.find(({ item }) => item.id === mainMenuParentId)?.item || null;
  const previewSnippetHtml = useMemo(() => {
    if (kind !== "header") return snippetHtml;
    let nextHtml = snippetHtml;
    if (mainMenuOpen) {
      nextHtml = updateHeaderHtmlFromVisualModel(nextHtml, {
        ...visualHeaderModel,
        menuItems: mainMenuItems
      });
    }
    if (megaMenuOpen && activeMegaMenuCategory) {
      const pendingCategories = liveProgramCategories.map((category) =>
        String(category.id) === String(activeMegaMenuCategory.id)
          ? { ...category, programIds: megaMenuProgramIds }
          : category
      );
      nextHtml = updateProgramsMegaMenuMarkup(nextHtml, pendingCategories, programs);
    }
    return nextHtml;
  }, [
    activeMegaMenuCategory,
    kind,
    mainMenuItems,
    mainMenuOpen,
    megaMenuOpen,
    megaMenuProgramIds,
    liveProgramCategories,
    programs,
    snippetHtml,
    updateHeaderHtmlFromVisualModel,
    visualHeaderModel
  ]);

  useEffect(() => {
    if (!megaMenuCategoryId && sortedProgramCategories[0]?.id) {
      setMegaMenuCategoryId(String(sortedProgramCategories[0].id));
    }
  }, [megaMenuCategoryId, sortedProgramCategories]);

  useEffect(() => {
    if (!megaMenuOpen || !activeMegaMenuCategory) return;
    const liveSelection = getProgramsMegaMenuSelection(snippetHtml, activeMegaMenuCategory, programs);
    setMegaMenuProgramIds(
      liveSelection === null ? getCategoryProgramIds(activeMegaMenuCategory, programs) : liveSelection
    );
    // Initialize only when the popup opens or the user changes category.
    // Header/form updates during Save must not overwrite the pending choices.
  }, [megaMenuCategoryId, megaMenuOpen]);

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
      menuItems: current.menuItems.map((item) => (item.id === itemId ? { ...item, [field]: value } : item))
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
          title: "",
          href: "",
          isMega: false,
          children: []
        }
      ]
    }));
  };

  const updateHeaderChildItem = (itemId, field, value) => {
    commitVisualHeaderModel((current) => ({
      ...current,
      menuItems: updateMenuTreeItem(current.menuItems, itemId, (item) => ({ ...item, [field]: value }))
    }));
  };

  const addHeaderChildItem = (itemId) => {
    commitVisualHeaderModel((current) => ({
      ...current,
      // Header state is persisted through generated HTML. A completely blank
      // child is intentionally omitted by the serializer, so give new child
      // and sub-child rows editable defaults that survive that round trip.
      menuItems: addMenuTreeChild(current.menuItems, itemId, createHeaderChildItem(itemId))
    }));
  };

  const removeHeaderChildItem = (itemId) => {
    commitVisualHeaderModel((current) => ({
      ...current,
      menuItems: removeMenuTreeItem(current.menuItems, itemId)
    }));
  };

  const moveHeaderChildItem = (itemId, direction) => {
    commitVisualHeaderModel((current) => ({
      ...current,
      menuItems: moveMenuTreeItem(current.menuItems, itemId, direction)
    }));
  };

  const updateHeaderCta = (field, value) => {
    commitVisualHeaderModel((current) => ({
      ...current,
      [field]: value
    }));
  };

  const selectHeaderMenuPage = (itemId, href, selectedPage) => {
    commitVisualHeaderModel((current) => ({
      ...current,
      menuItems: current.menuItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              href,
              title: selectedPage?.title || item.title
            }
          : item
      )
    }));
  };

  const selectHeaderChildPage = (itemId, href, selectedPage) => {
    commitVisualHeaderModel((current) => ({
      ...current,
      menuItems: updateMenuTreeItem(current.menuItems, itemId, (item) => ({ ...item, href, title: selectedPage?.title || item.title }))
    }));
  };

  const toggleMegaMenuProgram = (programId) => {
    const normalizedId = String(programId);
    setMegaMenuProgramIds((current) =>
      current.includes(normalizedId)
        ? current.filter((id) => id !== normalizedId)
        : [...current, normalizedId]
    );
  };

  const cloneMainMenuItems = () => {
    const cloneItems = (items = []) => items.map((item) => ({ ...item, children: cloneItems(item.children || []) }));
    return cloneItems(visualHeaderModel.menuItems);
  };

  const openMainMenuEditor = () => {
    setMainMenuItems(cloneMainMenuItems());
    setMainMenuParentId("");
    setMainMenuPageIds([]);
    setMainMenuQuery("");
    setMainMenuOpen(true);
  };

  const toggleMainMenuPage = (pageId) => {
    const normalizedId = String(pageId);
    setMainMenuPageIds((current) =>
      current.includes(normalizedId)
        ? current.filter((id) => id !== normalizedId)
        : [...current, normalizedId]
    );
  };

  const addSelectedPagesToMainMenu = () => {
    const selectedPages = availableMenuPages.filter((page) => mainMenuPageIds.includes(String(page.id)));
    if (!selectedPages.length) return;
    const hasExistingPage = (items, page) =>
      items.some(
        (item) =>
          item.href === page.href ||
          item.title === page.title ||
          hasExistingPage(item.children || [], page)
      );

    setMainMenuItems((current) => {
      const pagesToAdd = selectedPages.filter((page) => !hasExistingPage(current, page));
      if (!pagesToAdd.length) return current;
      if (!mainMenuParentId) {
        return [
          ...current,
          ...pagesToAdd.map((page, index) => ({
            id: `header-page-${page.id}-${index}`,
            sourceIndex: current.length + index,
            title: page.title,
            href: page.href,
            isMega: false,
            children: []
          }))
        ];
      }
      return updateMenuTreeItem(current, mainMenuParentId, (item) => ({ ...item, children: [...(item.children || []), ...pagesToAdd.map((page, index) => ({ id: `header-page-child-${page.id}-${index}`, title: page.title, href: page.href, children: [] }))] }));
    });
    setMainMenuPageIds([]);
  };

  const addTopLevelMainMenuItem = () => {
    setMainMenuItems((current) => [
      ...current,
      {
        id: `header-menu-manual-${Date.now()}`,
        sourceIndex: current.length,
        title: "New menu item",
        href: "#",
        isMega: false,
        children: []
      }
    ]);
  };

  const removeMainMenuRoot = (itemId) => {
    setMainMenuItems((current) => current.filter((item) => item.id !== itemId || item.isMega));
  };

  const saveMainMenuChanges = () => {
    updateHtml("header", updateHeaderHtmlFromVisualModel(snippetHtml, {
      ...visualHeaderModel,
      menuItems: mainMenuItems
    }));
    setMainMenuOpen(false);
  };

  const saveProgramsMegaMenu = async () => {
    if (!activeMegaMenuCategory || typeof updateProgramCategory !== "function" || megaMenuSaving) return;
    setMegaMenuSaving(true);
    const nextCategories = liveProgramCategories.map((category) =>
      String(category.id) === String(activeMegaMenuCategory.id)
        ? { ...category, programIds: megaMenuProgramIds }
        : category
    );
    updateProgramCategory(activeMegaMenuCategory.id, megaMenuProgramIds);
    const nextHtml = updateProgramsMegaMenuMarkup(snippetHtml, nextCategories, programs);
    updateHtml("header", nextHtml);
    try {
      if (typeof saveMegaMenu === "function") {
        const saved = await saveMegaMenu({ categories: nextCategories, html: nextHtml });
        if (!saved) return;
      }
      setMegaMenuOpen(false);
    } finally {
      setMegaMenuSaving(false);
    }
  };

  const commitFooterNavigationGroups = (updater) => {
    if (kind !== "footer") return;
    const nextGroups = typeof updater === "function" ? updater(footerNavigationGroups) : updater;
    updateHtml("footer", updateFooterNavigationMarkup(snippetHtml, nextGroups));
  };

  const updateFooterMenuItem = (groupId, itemId, field, value) => {
    commitFooterNavigationGroups((groups) =>
      groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              items: updateMenuTreeItem(group.items, itemId, (item) => ({ ...item, [field]: value }))
            }
          : group
      )
    );
  };

  const selectFooterMenuPage = (groupId, itemId, href, selectedPage) => {
    commitFooterNavigationGroups((groups) =>
      groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              items: updateMenuTreeItem(group.items, itemId, (item) => ({
                ...item,
                href,
                title: selectedPage?.title || item.title
              }))
            }
          : group
      )
    );
  };

  const addFooterChildItem = (groupId, parentId) => commitFooterNavigationGroups((groups) => groups.map((group) => group.id === groupId ? { ...group, items: addMenuTreeChild(group.items, parentId, { id: `footer-child-${Date.now()}-${parentId}`, title: "", href: "", children: [] }) } : group));
  const removeFooterMenuItem = (groupId, itemId) => commitFooterNavigationGroups((groups) => groups.map((group) => group.id === groupId ? { ...group, items: removeMenuTreeItem(group.items, itemId) } : group));
  const moveFooterMenuItem = (groupId, itemId, direction) => commitFooterNavigationGroups((groups) => groups.map((group) => group.id === groupId ? { ...group, items: moveMenuTreeItem(group.items, itemId, direction) } : group));

  const openPreviewPage = async () => {
    const previewWindow = window.open("", "_blank");
    if (!previewWindow) return;
    previewWindow.opener = null;
    previewWindow.document.write(`<!doctype html><html><head><title>Loading ${kind} preview...</title></head><body style="margin:0;display:grid;min-height:100vh;place-items:center;font-family:Inter,Segoe UI,Arial,sans-serif;background:#f4f8fb;color:#081933;"><p>Loading live ${kind} preview...</p></body></html>`);
    previewWindow.document.close();

    let previewHtml = previewSnippetHtml;
    if (!hasExpectedSiteChromeMarkup(previewHtml, kind) && previewSourceUrl) {
      try {
        const response = await fetch(previewSourceUrl, {
          headers: { Accept: "text/html" },
          cache: "no-store"
        });
        if (response.ok) {
          const fetchedHtml = await response.text();
          if (hasExpectedSiteChromeMarkup(fetchedHtml, kind)) {
            previewHtml = fetchedHtml;
          }
        }
      } catch {
        // The generated preview below will show the saved markup fallback.
      }
    }

    previewWindow.document.open();
    previewWindow.document.write(buildSiteChromePreviewDocument(kind, previewHtml));
    previewWindow.document.close();
  };

  return (
    <section className="site-chrome-shell">
      <div className="site-chrome-banner">
        <div className="site-chrome-banner-copy">
          <CheckCircle2 size={18} />
          <span>Editing website {kind} content.</span>
        </div>
        <div className="site-chrome-tabs">
          <button type="button" className={kind === "header" ? "active" : ""} onClick={() => openSiteChromeView("header")}>
            Header
          </button>
          <button type="button" className={kind === "footer" ? "active" : ""} onClick={() => openSiteChromeView("footer")}>
            Footer
          </button>
        </div>
      </div>

      <div className="site-chrome-grid">
        <form className="panel site-chrome-editor" onSubmit={(event) => savePage(event, kind)}>
          <div className="panel-head site-chrome-panel-head">
            <div>
              <span className="eyebrow">Global Layout</span>
              <h2>Header & Footer</h2>
            </div>
            <div className="site-chrome-panel-actions">
              <span className={`badge ${isSavedStatus ? "" : "draft"}`}>{statusLabel}</span>
              <button className="ghost-button site-chrome-open-preview" type="button" onClick={openPreviewPage}>
                <Eye size={16} />
                <span>Preview {kind === "header" ? "Header" : "Footer"}</span>
                <ExternalLink size={14} />
              </button>
              <button className="primary-button site-chrome-top-save" type="submit">
                <Save size={16} />
                <span>Save Changes</span>
              </button>
            </div>
          </div>

          <div className="site-chrome-fields">
            <p className="site-chrome-hint">
              Edit the global {kind} HTML here. Saving updates the Admin API record and publishes the generated HTML partial when the live publish endpoint is available.
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
                  <div className="site-chrome-editor-actions">
                    <button className="ghost-button" type="button" onClick={openMainMenuEditor}>
                      <ListTree size={16} />
                      <span>Edit Main Menu</span>
                    </button>
                    <button className="ghost-button" type="button" onClick={() => setMegaMenuOpen(true)}>
                      <Layers size={16} />
                      <span>Edit Programs Mega Menu</span>
                    </button>
                  </div>
                </div>
                <p className="site-chrome-hint">
                  Edit the live header menu visually. Special mega-menu items are preserved, while standard menu items and dropdowns can be changed directly.
                </p>

                <div className="site-chrome-imported-main-menu">
                  <div>
                    <span className="eyebrow">Fetched from header HTML</span>
                    <strong>Main Menu Hierarchy</strong>
                    <small>
                      {importedMainMenuGroup?.items.length || 0} top-level items ·{" "}
                      {(importedMainMenuGroup?.items || []).reduce(
                        (total, item) => total + (item.children?.length || 0),
                        0
                      )} direct child groups
                    </small>
                  </div>
                  <button className="ghost-button" type="button" onClick={() => openSiteChromeView("header")}>
                    <Globe2 size={16} />
                    <span>Refresh from API</span>
                  </button>
                </div>

                <div className="site-chrome-cta-grid">
                  <Field label="Header CTA Label">
                    <input value={visualHeaderModel.ctaLabel} onChange={(event) => updateHeaderCta("ctaLabel", event.target.value)} />
                  </Field>
                  <PageLinkField label="Header CTA Page">
                    <PageLinkSelect
                      value={visualHeaderModel.ctaUrl}
                      pages={linkablePages}
                      ariaLabel="Select Header CTA page"
                      onChange={(href) => updateHeaderCta("ctaUrl", href)}
                    />
                  </PageLinkField>
                </div>

                {mainMenuOpen && (
                  <div className="site-chrome-mega-editor site-chrome-main-menu-editor">
                    <div className="site-chrome-mega-editor-head">
                      <div>
                        <span className="eyebrow">Primary navigation</span>
                        <h3>Edit Main Menu</h3>
                        <p>Choose a parent location, select multiple website pages, and add them to the imported hierarchy.</p>
                      </div>
                      <button className="icon-button" type="button" aria-label="Close main menu editor" onClick={() => setMainMenuOpen(false)}>
                        <X size={17} />
                      </button>
                    </div>

                    <div className="field-grid">
                      <Field label="Add Pages Under">
                        <select value={mainMenuParentId} onChange={(event) => setMainMenuParentId(event.target.value)}>
                          <option value="">Top-level menu — show in main navigation</option>
                          {mainMenuParentOptions.map(({ item, depth }) => (
                              <option key={item.id} value={item.id}>{`${"— ".repeat(depth + 1)}Under ${item.title}`}</option>
                            ))}
                        </select>
                      </Field>
                      <Field label="Search Website Pages">
                        <label className="search-field no-margin">
                          <Search size={16} />
                          <input value={mainMenuQuery} onChange={(event) => setMainMenuQuery(event.target.value)} placeholder="Search title, URL, or page type" />
                        </label>
                      </Field>
                    </div>

                    <div className="site-chrome-mega-select-actions">
                      <strong>{mainMenuPageIds.length} pages selected</strong>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => setMainMenuPageIds(filteredMenuPages.map((page) => String(page.id)))}
                      >
                        Select Visible
                      </button>
                      <button className="ghost-button" type="button" onClick={() => setMainMenuPageIds([])}>
                        Clear
                      </button>
                    </div>

                    <div className="site-chrome-mega-program-list">
                      {filteredMenuPages.map((page) => (
                        <label className="site-chrome-mega-program-option" key={page.id}>
                          <input
                            type="checkbox"
                            checked={mainMenuPageIds.includes(String(page.id))}
                            onChange={() => toggleMainMenuPage(page.id)}
                          />
                          <span>
                            <strong>{page.title}</strong>
                            <small>{page.type} · {page.href}</small>
                          </span>
                        </label>
                      ))}
                    </div>

                    <button className="ghost-button site-chrome-add-pages" type="button" onClick={addSelectedPagesToMainMenu} disabled={!mainMenuPageIds.length}>
                      <Plus size={16} />
                      <span>
                        {selectedMainMenuParent
                          ? `Add Selected Under ${selectedMainMenuParent.title}`
                          : "Add Selected to Top Level"}
                      </span>
                    </button>

                    <button className="ghost-button site-chrome-add-pages" type="button" onClick={addTopLevelMainMenuItem}>
                      <Plus size={16} />
                      <span>Add Top-Level Item</span>
                    </button>

                    <div className="site-chrome-main-hierarchy">
                      {mainMenuItems.map((item) => (
                        <article key={item.id}>
                          <div>
                            <strong>{item.title}</strong>
                            <small>{item.children?.length || 0} children · {item.href}</small>
                            {!!item.children?.length && (
                              <div className="site-chrome-main-child-list">
                                {item.children.map((child) => (
                                  <span key={child.id}>{child.title}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          {!item.isMega && (
                            <button className="icon-button danger" type="button" aria-label={`Remove ${item.title}`} onClick={() => removeMainMenuRoot(item.id)}>
                              <Trash2 size={15} />
                            </button>
                          )}
                        </article>
                      ))}
                    </div>

                    <div className="site-chrome-mega-editor-footer">
                      <span>The live header preview reflects this hierarchy before it is saved.</span>
                      <button className="primary-button" type="button" onClick={saveMainMenuChanges}>
                        <Save size={16} />
                        <span>Apply Main Menu</span>
                      </button>
                    </div>
                  </div>
                )}

                {megaMenuOpen && (
                  <div className="site-chrome-mega-modal" role="presentation" onMouseDown={() => setMegaMenuOpen(false)}>
                  <div className="site-chrome-mega-editor" role="dialog" aria-modal="true" aria-labelledby="mega-menu-editor-title" onMouseDown={(event) => event.stopPropagation()}>
                    <div className="site-chrome-mega-editor-head">
                      <div>
                        <span className="eyebrow">Programs navigation</span>
                        <h3 id="mega-menu-editor-title">Edit Programs Mega Menu</h3>
                        <p>Select a category, then choose every program that should appear below it.</p>
                      </div>
                      <button className="icon-button" type="button" aria-label="Close mega menu editor" onClick={() => setMegaMenuOpen(false)}>
                        <X size={17} />
                      </button>
                    </div>

                    <div className="field-grid">
                      <Field label="Program Category">
                        <select value={activeMegaMenuCategory?.id || ""} onChange={(event) => setMegaMenuCategoryId(event.target.value)}>
                          {sortedProgramCategories.map((category) => (
                            <option key={category.id} value={category.id}>{category.name}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Search Programs">
                        <label className="search-field no-margin">
                          <Search size={16} />
                          <input value={megaMenuQuery} onChange={(event) => setMegaMenuQuery(event.target.value)} placeholder="Search by title, level, or college" />
                        </label>
                      </Field>
                    </div>

                    <div className="site-chrome-mega-select-actions">
                      <strong>{megaMenuProgramIds.length} selected</strong>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => setMegaMenuProgramIds(filteredMegaMenuPrograms.map((program) => String(program.id)))}
                      >
                        Select Visible
                      </button>
                      <button className="ghost-button" type="button" onClick={() => setMegaMenuProgramIds([])}>
                        Clear
                      </button>
                    </div>

                    <div className="site-chrome-mega-program-list">
                      {filteredMegaMenuPrograms.map((program) => (
                        <label className="site-chrome-mega-program-option" key={program.id}>
                          <input
                            type="checkbox"
                            checked={megaMenuProgramIds.includes(String(program.id))}
                            onChange={() => toggleMegaMenuProgram(program.id)}
                          />
                          <span>
                            <strong>{program.title}</strong>
                            <small>{program.level} · {program.college}</small>
                          </span>
                        </label>
                      ))}
                    </div>

                    <div className="site-chrome-mega-editor-footer">
                      <span>Saving updates the Header database record and publishes the live website header.</span>
                      <button className="primary-button" type="button" onClick={saveProgramsMegaMenu} disabled={!activeMegaMenuCategory || megaMenuSaving}>
                        <Save size={16} />
                        <span>{megaMenuSaving ? "Saving & Publishing..." : "Save & Publish Mega Menu"}</span>
                      </button>
                    </div>
                  </div>
                  </div>
                )}

                <div className="site-chrome-menu-list">
                  {visualHeaderModel.menuItems.map((item, index) => (
                    <div className="site-chrome-menu-card" key={item.id}>
                      <div className="site-chrome-menu-card-head">
                        <div>
                          <strong>{item.title || `Menu Item ${index + 1}`}</strong>
                          <small>{item.isMega ? "Mega menu preserved" : item.children.length ? "Dropdown menu" : "Single link"}</small>
                        </div>
                        <div className="site-chrome-menu-actions">
                          {item.isMega && (
                            <button className="ghost-button" type="button" onClick={() => setMegaMenuOpen(true)}>
                              <Layers size={16} />
                              <span>Edit Mega Menu</span>
                            </button>
                          )}
                          <button className="ghost-button" type="button" onClick={() => moveHeaderMenuItem(item.id, "up")} disabled={index === 0}>
                            <ChevronUp size={16} />
                            <span>Up</span>
                          </button>
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => moveHeaderMenuItem(item.id, "down")}
                            disabled={index === visualHeaderModel.menuItems.length - 1}
                          >
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
                        <PageLinkField label="Linked Page">
                          <PageLinkSelect
                            value={item.href}
                            pages={linkablePages}
                            ariaLabel={`Select page for ${item.title || "menu item"}`}
                            onChange={(href, selectedPage) => selectHeaderMenuPage(item.id, href, selectedPage)}
                          />
                        </PageLinkField>
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
                          {(item.children || []).map((child) => (
                            <HeaderChildItemEditor key={child.id} item={child} pages={linkablePages} onFieldChange={updateHeaderChildItem} onPageSelect={selectHeaderChildPage} onAddChild={addHeaderChildItem} onRemove={removeHeaderChildItem} onMove={moveHeaderChildItem} />
                          ))}
                          {!item.children.length && <div className="site-chrome-empty-note">This menu item currently has no dropdown children.</div>}
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

            {kind === "footer" && (
              <div className="site-chrome-visual-editor site-chrome-footer-editor">
                <div className="site-chrome-editor-label">
                  <div>
                    <strong>Visual Footer Builder</strong>
                    <small>Edit the navigation groups fetched from the Admin API footer record.</small>
                  </div>
                  <button className="ghost-button" type="button" onClick={() => openSiteChromeView("footer")}>
                    <Globe2 size={16} />
                    <span>Refresh from API</span>
                  </button>
                </div>

                {footerNavigationGroups.map((group) => (
                  <section className="site-chrome-footer-menu-card" key={group.id}>
                    <div className="site-chrome-footer-menu-head">
                      <div>
                        <span className="eyebrow">Footer navigation</span>
                        <h3>{group.title}</h3>
                      </div>
                      <span>{group.items.length} links</span>
                    </div>
                    <div className="site-chrome-footer-menu-links">
                      {group.items.map((item) => (
                        <FooterMenuItemEditor
                          key={item.id}
                          item={item}
                          groupId={group.id}
                          pages={linkablePages}
                          onFieldChange={updateFooterMenuItem}
                          onPageSelect={selectFooterMenuPage}
                          onAddChild={addFooterChildItem}
                          onRemove={removeFooterMenuItem}
                          onMove={moveFooterMenuItem}
                        />
                      ))}
                    </div>
                  </section>
                ))}

                {!footerNavigationGroups.length && (
                  <div className="site-chrome-empty-note site-chrome-footer-empty">
                    No editable navigation groups were found in the footer API markup. Refresh the API record or check that it contains the saved footer HTML.
                  </div>
                )}
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
                <span>Save &amp; Publish {kind === "header" ? "Header" : "Footer"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
