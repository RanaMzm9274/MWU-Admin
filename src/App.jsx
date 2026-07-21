import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  LogOut,
  X
} from "lucide-react";
import AdminSidebar from "./admin/components/AdminSidebar";
import AdminTopbar from "./admin/components/AdminTopbar";
import DangerConfirmDialog from "./admin/components/DangerConfirmDialog";
import CrmView from "./admin/views/CrmView";
import Dashboard from "./admin/views/Dashboard";
import EventPagesView from "./admin/views/EventPagesView";
import LoginView from "./admin/views/LoginView";
import MediaView from "./admin/views/MediaView";
import PageEditor from "./admin/views/PageEditor";
import PagesView from "./admin/views/PagesView";
import BlogPagesView from "./admin/views/BlogPagesView";
import BuilderView from "./admin/views/BuilderView";
import ProgramsManagementView from "./admin/views/ProgramsView";
import StandalonePageEditor from "./admin/views/StandalonePageEditor";
import SettingsView from "./admin/views/SettingsView";
import SiteChromeView from "./admin/views/SiteChromeView";
import UserManagementView from "./admin/views/UserManagementView";
import PagePreview from "./admin/components/PagePreview";
import useAdminUserController from "./admin/hooks/useAdminUserController";
import useContentCollections from "./admin/hooks/useContentCollections";
import useMediaController from "./admin/hooks/useMediaController";
import usePageActionsController from "./admin/hooks/usePageActionsController";
import useProgramController from "./admin/hooks/useProgramController";
import useSiteChromeController from "./admin/hooks/useSiteChromeController";
import {
  PROGRAM_CATEGORIES_KEY,
  PROGRAMS_KEY,
  ADMIN_ACTIVITY_KEY,
  ADMIN_PAGES_LOADED_NOTICE_KEY,
  CRM_UI_STATE_KEY,
  INACTIVITY_LIMIT_MS,
  apiUrl,
  getAuthHeaders,
  readApiError,
  dismissNoticeMessage,
  editorDebugLog,
  extractToken,
  normalizeAdminUser,
  extractAdminProfile,
  getStoredAdminProfile,
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
  makeId,
  pageTypes,
  statusOptions,
  pageStatusFilters,
  sectionTypes,
  layoutOptions,
  layoutPresets,
  getMenuGroupChoices,
  navItems,
  accessModules,
  fullAccess,
  rolePresets,
  SITE_CHROME_CONFIGS
} from "./admin/runtime/portalRuntime";
import {
  slugify,
  defaultPageStyles,
  defaultSectionStyles,
  toCssUnit,
  restoreLiveAssetUrls,
  looksLikeUsableHtmlDocument,
  isImportedPlaceholderPage,
  getSectionStyles,
  getPageStyles,
  sectionCanvasStyle,
  serializeHtmlVisualBuilderSnapshot,
  buildHtmlVisualBuilderInitPayload,
  extractInlineStylesFromHtmlDocument,
  hasPersistedEditableMarkup,
  hasUsableHtmlBuilderSnapshot,
  getStoredEditableDocument,
  getLivePageUrl,
  getLiveRoutePath,
  extractBodyHtml,
  mergeBodyIntoHtml,
  buildEditableLiveDocument,
  getEditableFetchCandidates,
  buildPreviewDocument,
  buildSiteChromePreviewDocument,
  formatHtmlPreview,
  formatDate,
  createSection,
  normalizeSection,
  titleCaseStatus,
  normalizePage,
  getAutoThumbnailForPage,
  hasEmbeddedImageData,
  readOptionalJson,
  isLocalDraftPage,
  isSiteChromePage,
  emptyPage,
  createBlankLocalDraftPage,
  getSiteChromeConfig
} from "./admin/runtime/pageRuntime";
import {
  getSiteChromeHtml,
  getFetchableLiveAssetUrl,
  parseStaticHeaderNavigation,
  parseHeaderVisualModel,
  updateHeaderHtmlFromVisualModel,
  applyNavigationSnapshotToPages,
  getMenuReferenceLabel
} from "./admin/runtime/siteChromeRuntime";
import {
  loadProgramCategories,
  loadPrograms,
  getSeoScore,
  isProgramPage,
  isNormalWebsitePage
} from "./admin/runtime/programRuntime";
import {
  MEDIA_LIBRARY_KEY,
  assets,
  initialMediaLibrary,
  mediaApiUrl,
  mergeMediaLibraries,
  loadMediaLibrary,
  normalizeLiveAssetUrl,
  canLoadRemoteImage
} from "./admin/modules/mediaLibrary";

const standaloneEditorRuntime = {
  assets,
  buildEditableLiveDocument,
  buildHtmlVisualBuilderInitPayload,
  canLoadRemoteImage,
  dismissNoticeMessage,
  emptyPage,
  extractBodyHtml,
  extractInlineStylesFromHtmlDocument,
  getCrmUrl,
  getEditableFetchCandidates,
  getLivePageUrl,
  getStoredEditableDocument,
  hasEmbeddedImageData,
  hasPersistedEditableMarkup,
  layoutPresets,
  looksLikeUsableHtmlDocument,
  mergeBodyIntoHtml,
  normalizeLiveAssetUrl,
  normalizeSection,
  pageTypes,
  restoreLiveAssetUrls,
  sectionTypes,
  serializeHtmlVisualBuilderSnapshot,
  slugify,
  statusOptions,
  titleCaseStatus
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
  const [pageEditorLoading, setPageEditorLoading] = useState(false);
  const importInputRef = useRef(null);
  const noticeTimeoutRef = useRef(null);
  const suppressInAppBuilderReinitRef = useRef(false);
  const pageEditorHydrationKeyRef = useRef("");
  const pageEditorRequestRef = useRef(0);
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
    const requestId = pageEditorRequestRef.current + 1;
    pageEditorRequestRef.current = requestId;
    pageEditorHydrationKeyRef.current = "";
    setPageEditorLoading(true);
    setActivePageId(pageId);
    setEditorTab(tab);
    setActiveView("page-editor");
    try {
      const targetPage = await loadDetailedPageForEditor(pageId);
      if (pageEditorRequestRef.current !== requestId) {
        return;
      }
      if (targetPage) {
        setFormPage(targetPage);
        setPages((current) => current.map((page) => (String(page.id) === String(targetPage.id) ? targetPage : page)));
        setActivePageId(targetPage.id);
      }
    } finally {
      if (pageEditorRequestRef.current === requestId) {
        setPageEditorLoading(false);
      }
    }
  };

  const persistInAppPageEditorBuilderState = async (builderState, saveMode = "draft") => {
    if (!requireAnyPortalAccess(["page-editor"], "Page editor saving")) {
      return;
    }
    const sourceSnapshot = builderState?.snapshot || {};
    const snapshotPageSettings = sourceSnapshot.pageSettings || {};
    const publishedHtml = String(builderState?.publishedHtml || "").trim();

    if (!publishedHtml) {
      setNotice("Visual builder returned no HTML to save.");
      return;
    }

    const nextTitle = snapshotPageSettings.title || formPage.title;
    const titleChanged = String(nextTitle || "").trim() !== String(formPage.title || "").trim();
    const nextSlug = slugify(titleChanged ? nextTitle : snapshotPageSettings.slug || formPage.slug || nextTitle);
    const snapshot = {
      ...sourceSnapshot,
      pageSettings: { ...snapshotPageSettings, title: nextTitle, slug: nextSlug }
    };
    const persistedBodyHtml = `${serializeHtmlVisualBuilderSnapshot(snapshot)}${extractBodyHtml(publishedHtml)}`;
    const extractedCustomCss = extractInlineStylesFromHtmlDocument(publishedHtml);
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
    if (pageEditorLoading && activeView === "page-editor") {
      return;
    }
    const selected = pages.find((page) => String(page.id) === String(activePageId));
    if (selected) {
      setFormPage((current) => {
        if (String(current?.id || "") === String(selected.id) && hasPersistedEditableMarkup(current)) {
          return current;
        }
        return selected;
      });
    }
  }, [activePageId, activeView, pageEditorLoading, pages]);

  useEffect(() => {
    if (isStandaloneEditor || pageEditorLoading || activeView !== "page-editor" || !activePageId || !pages.length) {
      return;
    }

    const activeListPage = pages.find((page) => String(page.id) === String(activePageId)) || null;
    if (isLocalDraftPage(activeListPage) || isLocalDraftPage(formPage)) {
      return;
    }

    if (
      String(formPage?.id || "") === String(activePageId) &&
      (hasPersistedEditableMarkup(formPage) || hasUsableHtmlBuilderSnapshot(formPage))
    ) {
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
  }, [activePageId, activeView, formPage, isStandaloneEditor, pageEditorLoading, pages]);

  const {
    contentManagedPages,
    activeSiteChromePage,
    programPages,
    megaMenuPrograms,
    blogPages,
    eventPages,
    standardPages,
    filteredPages,
    stats
  } = useContentCollections({
    pages,
    siteChromeTab,
    formPage,
    programs,
    programCategories,
    query,
    statusFilter,
    typeFilter,
    menuFilter,
    sortKey
  });

  const updateField = (field, value) => {
    setFormPage((current) => {
      if (field === "title") {
        return {
          ...current,
          title: value,
          slug: isSiteChromePage(current) ? current.slug : slugify(value)
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

  const {
    commitMediaLibrary,
    requestDangerConfirmation,
    resolveDangerConfirmation,
    uploadMediaFiles,
    deleteMediaItem,
    copyMediaUrl
  } = useMediaController({
    requireAnyPortalAccess,
    mediaStorageMode,
    adminToken,
    mediaLibrary,
    setMediaLibrary,
    setMediaStorageMode,
    setNotice,
    setDangerDialog,
    updateField
  });

  const {
    loadSiteChromeSnippet,
    persistPageToApi,
    openSiteChromeView,
    updateSiteChromeHtml,
    saveSiteChromePage,
    publishSiteChromeFile,
    saveSiteChromeAndPublish
  } = useSiteChromeController({
    requireAnyPortalAccess,
    pages,
    setPages,
    adminToken,
    siteChromeTab,
    setSiteChromeTab,
    formPage,
    setFormPage,
    setActivePageId,
    setActiveView,
    setNotice
  });

  const {
    createNewPage,
    createProgramPage,
    savePage,
    updateActiveStatus,
    deletePageById,
    bulkDeletePages,
    deletePage,
    toggleSelectedPage,
    toggleAllFiltered,
    bulkUpdateStatus,
    bulkDuplicate,
    exportAllPages,
    importPages,
    importLivePublishedPages,
    pageImportProgress
  } = usePageActionsController({
    canCreatePages,
    requireAnyPortalAccess,
    pages,
    setPages,
    activePageId,
    setActivePageId,
    formPage,
    setFormPage,
    setEditorTab,
    setActiveView,
    adminToken,
    setAdminToken,
    setNotice,
    selectedPageIds,
    setSelectedPageIds,
    filteredPages,
    persistPageToApi,
    requestDangerConfirmation,
    programs,
    setPrograms,
    suppressInAppBuilderReinitRef,
    publishSiteChromeFile
  });

  const {
    addProgramCategory,
    updateProgramCategory,
    updateProgramMegaMenuCategory,
    saveProgramsMegaMenu,
    importLivePrograms,
    deleteProgramCategory,
    addProgram,
    updateProgram,
    deleteProgram
  } = useProgramController({
    requireAnyPortalAccess,
    megaMenuPrograms,
    requestDangerConfirmation,
    persistPageToApi,
    publishSiteChromeFile,
    adminToken,
    pages,
    setPages,
    programCategories,
    setProgramCategories,
    programs,
    setPrograms,
    formPage,
    setFormPage,
    setNotice
  });

  const { saveAdminUser, sendAdminUserInvite, deleteAdminUser } = useAdminUserController({
    requireAnyPortalAccess,
    adminToken,
    adminUsers,
    setAdminUsers,
    adminProfile,
    setAdminProfile,
    setNotice
  });

  const handleLogin = async ({ email, password }) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12_000);
    let response;

    try {
      response = await fetch(apiUrl("/admin/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        signal: controller.signal
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("Admin API request timed out. The API server is not responding.");
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }

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
        runtime={standaloneEditorRuntime}
      />
    );
  }

  return (
    <div className={`crm-app ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <AdminSidebar
        logoSrc={assets.logoOfficial}
        mobileOpen={mobileNavOpen}
        collapsed={sidebarCollapsed}
        navItems={accessibleNavItems}
        activeView={activeView}
        stats={stats}
        onToggle={() => {
          if (window.innerWidth <= 860) {
            setMobileNavOpen(false);
            return;
          }
          setSidebarCollapsed((current) => !current);
        }}
        onNavigate={(viewId) => {
          if (viewId === "site-chrome") {
            openSiteChromeView(siteChromeTab);
          } else if (viewId === "page-editor") {
            if (activeView === "page-editor" && isLocalDraftPage(formPage)) {
              setEditorTab("content");
              setActiveView("page-editor");
            } else {
              createNewPage();
            }
          } else {
            setActiveView(viewId);
          }
          setMobileNavOpen(false);
        }}
        onLogout={handleLogout}
      />

      <main className="workspace">
        {activeView !== "page-editor" && (
          <AdminTopbar
            canCreatePages={canCreatePages}
            onCreatePage={createNewPage}
            onOpenSidebar={() => {
              setSidebarCollapsed(false);
              if (window.innerWidth <= 860) {
                setMobileNavOpen(true);
              }
            }}
          />
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
            pageImportProgress={pageImportProgress}
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

        {activeView === "page-editor" && pageEditorLoading && hasPortalAccess(adminProfile, "page-editor") && (
          <div className="standalone-editor loading page-editor-route-loading" role="status" aria-live="polite">
            <div className="standalone-loading">
              <img src={assets.logoOfficial} alt="Madda Walabu University" />
              <strong>Loading the selected page</strong>
              <span>Fetching its saved content and live HTML before opening the editor.</span>
            </div>
          </div>
        )}

        {activeView === "page-editor" && !pageEditorLoading && hasPortalAccess(adminProfile, "page-editor") && (
          <PageEditor
            key={formPage.id || "page-editor"}
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
            programPages={programPages}
            openPageEditorTab={openPageEditorTab}
            createProgramPage={createProgramPage}
            deletePageById={deletePageById}
            addCategory={addProgramCategory}
            updateCategory={updateProgramCategory}
            deleteCategory={deleteProgramCategory}
            addProgram={addProgram}
            importLivePrograms={importLivePrograms}
            updateProgram={updateProgram}
            deleteProgram={deleteProgram}
            pageStatusFilters={pageStatusFilters}
            statusOptions={statusOptions}
            mediaItems={mediaLibrary}
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
            sectionTypes={sectionTypes}
            layoutOptions={layoutOptions}
            defaultPageStyles={defaultPageStyles}
            getSectionStyles={getSectionStyles}
            getPageStyles={getPageStyles}
            toCssUnit={toCssUnit}
            renderPreview={(page) => (
              <PagePreview
                page={page}
                logoSrc={assets.logoOfficial}
                getPageStyles={getPageStyles}
                getLivePageUrl={getLivePageUrl}
                getStoredEditableDocument={getStoredEditableDocument}
                buildPreviewDocument={buildPreviewDocument}
                getSectionStyles={getSectionStyles}
                formatHtmlPreview={formatHtmlPreview}
                sectionCanvasStyle={sectionCanvasStyle}
                slugify={slugify}
                toCssUnit={toCssUnit}
                defaultSectionStyles={defaultSectionStyles}
              />
            )}
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

        {activeView === "settings" && hasPortalAccess(adminProfile, "settings") && <SettingsView logoSrc={assets.logoOfficial} adminToken={adminToken} />}

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
            saveMegaMenu={saveProgramsMegaMenu}
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

export default App;
