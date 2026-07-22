import { useState } from "react";
import { apiUrl, getAuthHeaders, readApiError, editorDebugLog, clearAdminSession, makeId, todayIso } from "../runtime/portalRuntime";
import { slugify, normalizeSlugReference, migratePageSlugReferences, normalizePageForEditableImport, normalizeSection, normalizePage, toApiPagePayload, readOptionalJson, getPageApiIdentifiers, isLocalDraftPage, withPageDeleteIdentifiers, shouldTryNextMutationRoute, emptyPage, createBlankLocalDraftPage, isSiteChromePage, isMatchingSiteChromePage, extractBodyHtml } from "../runtime/pageRuntime";
import { getSiteChromeHtml } from "../runtime/siteChromeRuntime";
import { isNormalWebsitePage } from "../runtime/programRuntime";

const clonePageValue = (value) => {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

const createDuplicatePageDraft = (sourcePage = {}, slugSuffix = "") => {
  const clonedPage = clonePageValue(sourcePage);
  // A duplicate must never retain any database identity alias from its source.
  const {
    id: _sourceId,
    page_id: _sourcePageId,
    pageId: _sourcePageIdAlias,
    isLocalDraft: _sourceLocalDraft,
    _isLocalDraft: _sourcePrivateLocalDraft,
    localOnly: _sourceLocalOnly,
    ...pageContent
  } = clonedPage;
  const suffix = slugSuffix || Math.random().toString(36).slice(2, 7);

  return {
    ...pageContent,
    id: makeId(),
    title: `${sourcePage.title || "Untitled Page"} Copy`,
    slug: `${slugify(sourcePage.slug || sourcePage.title || "untitled-page")}-copy-${suffix}`,
    status: "Draft",
    updatedAt: todayIso(),
    createdAt: todayIso(),
    revisions: [],
    isLocalDraft: true,
    _isLocalDraft: true,
    localOnly: true,
    sections: (clonedPage.sections || []).map((section) => ({ ...section, id: makeId() }))
  };
};

export default function usePageActionsController({
  canCreatePages, requireAnyPortalAccess, pages, setPages, activePageId, setActivePageId, formPage, setFormPage, setEditorTab, setActiveView,
  adminToken, setAdminToken, setNotice, selectedPageIds, setSelectedPageIds, filteredPages, persistPageToApi,
  requestDangerConfirmation, programs, setPrograms, suppressInAppBuilderReinitRef, publishSiteChromeFile
}) {
  const [pageImportProgress, setPageImportProgress] = useState(null);
  const updateImportProgress = (label, progress, current = 0, total = 0) => {
    setPageImportProgress({ label, progress: Math.max(0, Math.min(100, Math.round(progress))), current, total });
  };
  const completeImportProgress = (label) => {
    setPageImportProgress((current) => ({ ...(current || {}), label, progress: 100 }));
    window.setTimeout(() => setPageImportProgress(null), 1400);
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
    
  const createContentPage = async (kind = "news") => {
    const isResearch = kind === "research";
    const requiredModule = isResearch ? "research" : "blogs";
    if (!requireAnyPortalAccess([requiredModule, "page-editor"], `${isResearch ? "Research" : "News"} creation`)) return;
    const count = pages.filter((page) => String(page.type || "").toLowerCase().includes(isResearch ? "research" : "news")).length;
    const title = isResearch ? "New Research Publication" : "New News Article";
    // Keep the content-type templates explicit. The version marker also prevents
    // an older cached blog template from being reused after navigating in the SPA.
    const templateUrl = isResearch
      ? "/templates/research-details.html?v=research-details-1"
      : "/templates/news-details.html?v=news-details-1";
    setNotice(`Loading the ${isResearch ? "Research" : "News"} website template...`);
    let templateHtml = "";
    try {
      const response = await fetch(templateUrl, { headers: { Accept: "text/html" }, cache: "no-store" });
      if (!response.ok) throw new Error(`Template request failed (${response.status}).`);
      templateHtml = await response.text();
      if (!/<body[\s>]/i.test(templateHtml)) throw new Error("The template is not a complete HTML document.");
      if (!isResearch && !/<title>[^<]*News Details[^<]*<\/title>/i.test(templateHtml)) {
        throw new Error("The News Details template could not be verified.");
      }
    } catch (error) {
      setNotice(`Could not load the ${isResearch ? "Research" : "News"} template: ${error.message}`);
      return;
    }
    const draft = createBlankLocalDraftPage({
      title,
      slug: `${isResearch ? "research" : "news"}-new-${count + 1}`,
      type: isResearch ? "Research Publication" : "News Article",
      menu: isResearch ? "Research" : "News",
      template: isResearch ? "Research Details" : "News Details",
      parentSlug: isResearch ? "research" : "news",
      heroHeadline: title,
      heroTag: isResearch ? "Research & Innovation" : "University News",
      owner: isResearch ? "Research Directorate" : "MWU Communications",
      ctaLabel: "Read More",
      ctaUrl: isResearch ? "/research-details" : "/news-details",
      builderKind: "html",
      rawHtml: templateHtml,
      bodyHtml: extractBodyHtml(templateHtml),
      sections: [normalizeSection({
        id: makeId(),
        type: "Raw HTML",
        title: isResearch ? "Research Detail Template" : "News Detail Template",
        html: extractBodyHtml(templateHtml),
        body: extractBodyHtml(templateHtml),
        layout: "Legacy HTML",
        visible: true
      })]
    });
    setPages((current) => [draft, ...current]);
    setActivePageId(draft.id);
    setFormPage(draft);
    setEditorTab("content");
    setActiveView("page-editor");
    setNotice(`${isResearch ? "Research publication" : "News article"} draft created from the website detail template.`);
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
    const draftPage = pageOverride ? { ...formPage, ...pageOverride } : formPage;
    const previousPage = pages.find((page) => String(page.id) === String(draftPage.id)) || null;
    const previousSlug = normalizeSlugReference(previousPage?.slug || "");
    const titleChanged = Boolean(
      previousPage && String(previousPage.title || "").trim() !== String(draftPage.title || "").trim()
    );
    const contentTypeMarker = [draftPage.type, draftPage.page_type, draftPage.menu, draftPage.menu_group, draftPage.template]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const usesNameBasedSlug = /\b(news|blog|research)\b/.test(contentTypeMarker);
    const requestedSlug = isSiteChromePage(draftPage)
      ? slugify(draftPage.slug || draftPage.title)
      : slugify(usesNameBasedSlug || titleChanged || !previousPage ? draftPage.title : draftPage.slug || draftPage.title);
    const slugChanged = Boolean(previousPage && previousSlug && previousSlug !== requestedSlug);
    const migratedDraft = slugChanged
      ? migratePageSlugReferences(
          { ...draftPage, slug: requestedSlug },
          previousSlug,
          requestedSlug,
          { updateEmbeddedPageSlug: true }
        ).page
      : { ...draftPage, slug: requestedSlug };
    const pageToSave = migratedDraft;
    
    try {  
      const { savedPage, pageExistsInDatabase } = await persistPageToApi(pageToSave, previousPage);

      const linkedPageUpdates = new Map();
      let linkedReferenceCount = 0;
      let linkedReferenceFailures = 0;

      if (slugChanged) {
        for (const linkedPage of pages) {
          if (
            String(linkedPage.id) === String(previousPage.id) ||
            isLocalDraftPage(linkedPage) ||
            String(linkedPage.id || "").startsWith("nav-")
          ) {
            continue;
          }

          const migration = migratePageSlugReferences(linkedPage, previousSlug, requestedSlug);
          if (!migration.changed) continue;

          try {
            const persistedReference = await persistPageToApi(migration.page, linkedPage);
            const updatedLinkedPage = persistedReference.savedPage;
            linkedPageUpdates.set(String(linkedPage.id), updatedLinkedPage);
            linkedReferenceCount += 1;

            const chromeKind = isMatchingSiteChromePage(updatedLinkedPage, "header")
              ? "header"
              : isMatchingSiteChromePage(updatedLinkedPage, "footer")
                ? "footer"
                : "";
            if (chromeKind && publishSiteChromeFile) {
              const chromeHtml = getSiteChromeHtml(updatedLinkedPage);
              if (chromeHtml) {
                await publishSiteChromeFile(chromeKind, chromeHtml);
              }
            }
          } catch {
            linkedReferenceFailures += 1;
          }
        }

        setPrograms((current) =>
          current.map((program) =>
            normalizeSlugReference(program.pageSlug || program.page_slug || "") === previousSlug
              ? { ...program, pageSlug: requestedSlug, page_slug: requestedSlug, updatedAt: todayIso() }
              : program
          )
        );
      }
    
      const pageIdentifiers = isLocalDraftPage(pageToSave)
        ? [pageToSave.id, pageToSave.slug]
        : getPageApiIdentifiers(pageToSave);
      const replacementIds = new Set(pageIdentifiers.concat(savedPage.id).filter(Boolean).map(String));
      setPages((current) => {  
        let replaced = false;  
        const nextPages = current.map((page) => {  
          if (replacementIds.has(String(page.id)) || replacementIds.has(String(page.page_id || "")) || replacementIds.has(String(page.slug || ""))) {  
            replaced = true;  
            return savedPage;  
          }  
          return linkedPageUpdates.get(String(page.id)) || page;
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
      if (slugChanged) {
        const migrationSummary = linkedReferenceCount
          ? ` Updated ${linkedReferenceCount} linked page${linkedReferenceCount === 1 ? "" : "s"}.`
          : " No stored links required changes.";
        const failureSummary = linkedReferenceFailures
          ? ` ${linkedReferenceFailures} linked record${linkedReferenceFailures === 1 ? "" : "s"} could not be updated.`
          : "";
        setNotice(`Page renamed to /${requestedSlug}.${migrationSummary}${failureSummary}`);
      } else {
        setNotice(pageExistsInDatabase ? "Page updated in database." : "New page added to database.");
      }
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
    const copyPage = createDuplicatePageDraft(formPage);
    /* const legacyCopyPage = {
      ...formPage,  
      id: makeId(),  
      isLocalDraft: true,  
      title: `${formPage.title} Copy`,  
      slug: `${formPage.slug}-copy`,  
      status: "Draft",  
      updatedAt: todayIso(),  
      sections: formPage.sections.map((section) => ({ ...section, id: makeId() }))  
    }; */
    
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
      // nav-* entries are virtual pages generated from the live header. They do
      // not exist in admin_pages, so deleting one is a local UI operation.
      if (isLocalDraftPage(targetPage) || String(targetPage.id || "").startsWith("nav-")) {
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
    
      // Only use the canonical DELETE /admin/pages/:id route. The remaining
      // entries are legacy compatibility definitions and must not be sprayed at
      // the API after a missing record response.
      for (const attempt of attempts.slice(0, 1)) {
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
        ...clonePageValue(page),
        id: makeId(),

        page_id: undefined,

        pageId: undefined,

        isLocalDraft: true,

        _isLocalDraft: true,

        localOnly: true,
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
      updateImportProgress("Reading page export…", 12);
      const text = await file.text();
      updateImportProgress("Validating imported pages…", 35);
      const parsed = JSON.parse(text);
      const sourcePages = Array.isArray(parsed?.pages) ? parsed.pages : Array.isArray(parsed) ? parsed : [parsed];
      updateImportProgress("Preparing page records…", 58, 0, sourcePages.length);
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
      updateImportProgress("Adding pages to the workspace…", 86, imported.length, imported.length);
    
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
      completeImportProgress(`Imported ${imported.length} page${imported.length === 1 ? "" : "s"}`);
    } catch {
      setPageImportProgress(null);
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
      updateImportProgress("Connecting to the Admin API…", 8);
      const response = await fetch(apiUrl("/admin/pages?limit=200"), {
        headers: getAuthHeaders(adminToken)  
      });  
      if (!response.ok) {  
        throw new Error(await readApiError(response, "Admin pages API is not available."));  
      }

      updateImportProgress("Downloading published page data…", 20);
      const payload = await response.json();
      updateImportProgress("Preparing editable pages…", 30);
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
        setPageImportProgress(null);
        setNotice("No pages found in Admin API.");
        return;
      }

      const savedPages = [];
      for (let pageIndex = 0; pageIndex < incomingPages.length; pageIndex += 1) {
        const page = incomingPages[pageIndex];
        updateImportProgress(
          `Importing ${page.title || "page"}…`,
          30 + ((pageIndex + 1) / incomingPages.length) * 62,
          pageIndex + 1,
          incomingPages.length
        );
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

      updateImportProgress("Refreshing the page library…", 96, savedPages.length, incomingPages.length);
      const selectedPage = savedPages.find(isNormalWebsitePage) || savedPages[0];
    
      setPages(savedPages);  
      setActivePageId(selectedPage.id);  
      setFormPage(selectedPage);  
      setActiveView("pages");
      setNotice(`Reimported ${savedPages.length} pages with corrected editable HTML paths.`);
      completeImportProgress(`Imported ${savedPages.length} page${savedPages.length === 1 ? "" : "s"}`);
    } catch (error) {
      setPageImportProgress(null);
      if (String(error.message || "").includes("HTTP 401")) {  
        clearAdminSession();  
        setAdminToken("");  
      }  
    
      setNotice(error.message || "Failed to load Admin API pages.");  
    }  
  };  
    

  return {
    createNewPage, createContentPage, createProgramPage, savePage, updateActiveStatus, deletePageById, bulkDeletePages, deletePage,
    toggleSelectedPage, toggleAllFiltered, bulkUpdateStatus, bulkDuplicate, exportAllPages, importPages, importLivePublishedPages,
    pageImportProgress
  };
}
