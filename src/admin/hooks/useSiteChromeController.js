import { LIVE_SITE_ORIGIN } from "../modules/mediaLibrary";
import { apiUrl, SITE_CHROME_PUBLISH_URL, getAuthHeaders, readApiError, makeId, todayIso } from "../runtime/portalRuntime";
import { slugify, makeRevision, normalizeSection, normalizePage, toApiPagePayload, readOptionalJson, getPageApiIdentifiers, isLocalDraftPage, withPageApiIdentifiers, withoutLocalPageMarkers, shouldTryNextMutationRoute, getSiteChromeConfig, isMatchingSiteChromePage } from "../runtime/pageRuntime";
import { findSiteChromePage, normalizeSiteChromeApiPage, getSiteChromeHtml, hasMeaningfulSiteChromeHtml, getFetchableLiveAssetUrl, createSiteChromePage } from "../runtime/siteChromeRuntime";

export default function useSiteChromeController({
  requireAnyPortalAccess, pages, setPages, adminToken, siteChromeTab, setSiteChromeTab, formPage, setFormPage, setActivePageId, setActiveView, setNotice
}) {
  const loadSiteChromeSnippet = async (kind, page, options = {}) => {
    const currentPage = createSiteChromePage(kind, page || {});  
    if (!options.preferWebsite && hasMeaningfulSiteChromeHtml(currentPage)) {  
      return currentPage;  
    }  
    
    const sourcePath = currentPage.sourceUrl || getSiteChromeConfig(kind).sourceUrl;  
    const liveSourceUrl = getFetchableLiveAssetUrl(sourcePath);  
    // The admin deployment includes the partials under /assets/partials. Always
    // try that same-origin copy first; the public-site URL is only a fallback and
    // may intentionally reject cross-origin browser requests.
    const sourceCandidates = Array.from(new Set([sourcePath, liveSourceUrl].filter(Boolean)));
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
      // Recover an existing canonical header/footer row by slug when the
      // current list payload did not include its database marker. Try this
      // before POST so an existing slug does not generate a noisy 409 first.
      { method: "PATCH", path: `/admin/pages/${encodeURIComponent(nextPage.slug)}` },
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
      if (response.status === 409 && !pageExistsInDatabase) {
        continue;
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
              const verificationUrl = `${LIVE_SITE_ORIGIN}/api/site-chrome?kind=${encodeURIComponent(kind)}&verify=${Date.now()}`;
              const verificationResponse = await fetch(verificationUrl, {
                headers: { Accept: "application/json" },
                cache: "no-store"
              });
              if (!verificationResponse.ok) {
                throw new Error(`live site-chrome API returned HTTP ${verificationResponse.status}`);
              }
              const verificationPayload = await readOptionalJson(verificationResponse);
              const deployedHtml = String(verificationPayload?.html || "");
              if (!deployedHtml.trim()) {
                throw new Error("live site-chrome API returned no HTML");
              }
              const normalizePublishedHtml = (value) => String(value || "").replace(/\r\n/g, "\n").trim();
              if (normalizePublishedHtml(deployedHtml) !== normalizePublishedHtml(expectedHtml)) {
                result.live = false;
                result.error = `${config.title} publish endpoint responded successfully, but the live site-chrome API still contains different content.`;
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
    event?.preventDefault?.();
    let savedPage;
    try {
      const previousPage = findSiteChromePage(pages, kind) || formPage || null;
      const persisted = await persistPageToApi(pageOverride, previousPage);
      savedPage = persisted.savedPage;
      setPages((current) => {
        const existingIndex = current.findIndex((entry) => isMatchingSiteChromePage(entry, kind));
        if (existingIndex < 0) return [savedPage, ...current];
        return current.map((entry, index) => (index === existingIndex ? savedPage : entry));
      });
      setFormPage(savedPage);
      setActivePageId(savedPage.id);
    } catch (error) {
      setNotice(`${getSiteChromeConfig(kind).title} could not be saved. ${error.message || "Admin API rejected the update."}`);
      return null;
    }
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
    

  return { loadSiteChromeSnippet, persistPageToApi, openSiteChromeView, updateSiteChromeHtml, saveSiteChromePage, publishSiteChromeFile, saveSiteChromeAndPublish };
}
