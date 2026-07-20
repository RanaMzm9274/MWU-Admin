import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive, ArrowDown, ArrowUp, CheckCircle2, ChevronRight, Copy, Download, Image,
  LayoutTemplate, LogOut, Pencil, Save, Send, Trash2, Upload, X
} from "lucide-react";
import { Field, StatusPill } from "../components/Common";

export default function StandalonePageEditor({
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
  onLogout,
  runtime
}) {
  const {
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
  } = runtime;
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
      src: mediaPath,
      preferLocalAsset: /^\/assets\//i.test(String(mediaPath || ""))
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
    const sourceSnapshot = builderState?.snapshot || {};
    const snapshotPageSettings = sourceSnapshot.pageSettings || {};
    const publishedHtml = String(builderState?.publishedHtml || "").trim();

    if (!publishedHtml) {
      setNotice("Visual builder returned no HTML to save.");
      return;
    }

    const nextTitle = snapshotPageSettings.title || safePage.title;
    const titleChanged = String(nextTitle || "").trim() !== String(safePage.title || "").trim();
    const nextSlug = slugify(titleChanged ? nextTitle : snapshotPageSettings.slug || safePage.slug || nextTitle);
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
              <input value={safePage.slug} readOnly title="Automatically generated from the page title" />
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
