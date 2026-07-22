import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Trash2, X } from "lucide-react";

const shortenMediaUrl = (value = "", maxLength = 54) => {
  const raw = String(value || "").trim();
  if (!raw || raw.length <= maxLength) return raw;
  const keep = Math.max(10, Math.floor((maxLength - 3) / 2));
  return `${raw.slice(0, keep)}...${raw.slice(-keep)}`;
};

const editorDebugLog = (stage, details = {}) => {
  console.info(`[MWU editor debug] ${stage}`, details);
};

export default function PageEditor({
  page,
  builderInitPayload,
  builderInitRevision = 0,
  onPersistBuilderState,
  onEditableHtmlUpdate,
  mediaItems = [],
  onUploadMediaFiles,
  onDeleteMedia,
  setNotice
}) {
  const safePage = page || {};
  const pageId = safePage.id || safePage.slug || "new-page";
  const builderUrl = `/visual-page-builder.html?v=20260722-responsive-motion&pageId=${encodeURIComponent(pageId)}`;
  const builderFrameRef = useRef(null);
  const latestPayloadRef = useRef(builderInitPayload || {});
  const builderPayloadSignature = useMemo(() => JSON.stringify({
    pageId,
    elementCount: Array.isArray(builderInitPayload?.elements) ? builderInitPayload.elements.length : 0,
    exactImport: Boolean(builderInitPayload?.pageSettings?.exactImport),
    importCssCount: Array.isArray(builderInitPayload?.importCssLinks) ? builderInitPayload.importCssLinks.length : 0,
    importInlineCssLength: String(builderInitPayload?.importInlineCss || "").length
  }), [builderInitPayload, pageId]);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerQuery, setMediaPickerQuery] = useState("");
  const [selectedMediaId, setSelectedMediaId] = useState("");
  const [pendingImageElementId, setPendingImageElementId] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const filteredMediaItems = useMemo(() => {
    const query = String(mediaPickerQuery || "").trim().toLowerCase();
    if (!query) {
      return mediaItems;
    }
    return mediaItems.filter((item) =>
      [
        item?.title,
        item?.name,
        item?.filename,
        item?.path,
        item?.type,
        item?.size,
        item?.dimensions,
        item?.mimeType,
        item?.mime_type,
        item?.uploadedAt,
        item?.uploaded_at
      ].join(" ").toLowerCase().includes(query)
    );
  }, [mediaItems, mediaPickerQuery]);

  const selectedMediaItem =
    filteredMediaItems.find((item) => String(item.id) === String(selectedMediaId)) ||
    mediaItems.find((item) => String(item.id) === String(selectedMediaId)) ||
    filteredMediaItems[0] ||
    mediaItems[0] ||
    null;

  const selectedMediaUrl = selectedMediaItem?.path || selectedMediaItem?.url || "";
  const selectedMediaDetails = selectedMediaItem ? [
    ["Upload date", selectedMediaItem.uploadedAt || selectedMediaItem.uploaded_at || "Unknown"],
    ["Name", selectedMediaItem.title || selectedMediaItem.name || selectedMediaItem.filename || "Untitled media"],
    ["Type", selectedMediaItem.type || selectedMediaItem.media_type || selectedMediaItem.kind || "Image"],
    ["Size", selectedMediaItem.size || selectedMediaItem.size_label || "Unknown"],
    ["Dimensions", selectedMediaItem.dimensions || [selectedMediaItem.width, selectedMediaItem.height].filter(Boolean).join(" x ") || "Unknown"],
    ["MIME type", selectedMediaItem.mimeType || selectedMediaItem.mime_type || selectedMediaItem.content_type || "Unknown"],
    ["URL", selectedMediaUrl]
  ] : [];

  const postInitMessage = () => {
    const payload = latestPayloadRef.current || {};
    editorDebugLog("iframe-host:post-init", {
      pageId,
      title: safePage.title,
      elementCount: Array.isArray(payload.elements) ? payload.elements.length : 0,
      firstElementType: payload.elements?.[0]?.type || "",
      exactImport: Boolean(payload.pageSettings?.exactImport),
      importCssCount: Array.isArray(payload.importCssLinks) ? payload.importCssLinks.length : 0,
      htmlBytes: String(payload.elements?.[0]?.content?.code || "").length
    });
    builderFrameRef.current?.contentWindow?.postMessage(
      { type: "MWU_HTML_BUILDER_INIT", payload },
      "*"
    );
  };

  useEffect(() => {
    latestPayloadRef.current = builderInitPayload || {};
    // Do not reinitialize the iframe for every React field update. Save/publish
    // updates status, raw HTML, and the API response in quick succession; each
    // re-init used to replace the already-styled imported DOM with raw markup
    // while its stylesheets were still loading. Initial load is handled by the
    // iframe READY/load events, and real external refreshes use initRevision.
  }, [builderInitPayload, builderPayloadSignature]);

  useEffect(() => {
    const frame = builderFrameRef.current;
    if (!frame) return;

    const postInit = () => postInitMessage();
    frame.addEventListener("load", postInit);
    return () => frame.removeEventListener("load", postInit);
  }, [pageId]);

  useEffect(() => {
    if (!builderInitRevision) {
      return;
    }
    postInitMessage();
  }, [builderInitRevision, pageId]);

  useEffect(() => {
    if (!selectedMediaId && filteredMediaItems.length) {
      setSelectedMediaId(filteredMediaItems[0].id);
      return;
    }
    if (selectedMediaId && !mediaItems.some((item) => String(item.id) === String(selectedMediaId))) {
      setSelectedMediaId(filteredMediaItems[0]?.id || mediaItems[0]?.id || "");
    }
  }, [filteredMediaItems, mediaItems, selectedMediaId]);

  useEffect(() => {
    const handleMessage = (event) => {
      const data = event.data || {};
      if (data.type === "MWU_HTML_BUILDER_READY") {
        editorDebugLog("iframe-host:builder-ready", { pageId, title: safePage.title });
        postInitMessage();
        return;
      }
      if (data.type === "MWU_HTML_BUILDER_STATE" && (data.saveMode === "draft" || data.saveMode === "publish")) {
        onPersistBuilderState?.(data, data.saveMode);
        return;
      }
      if (data.type === "MWU_LIVE_HTML_UPDATED") {
        onEditableHtmlUpdate?.(data);
        return;
      }
      if (data.type === "MWU_IMPORTED_EDITOR_ERROR") {
        console.error("[MWU page editor] imported editor error", data);
        setNotice?.(`Image editor diagnostic: ${data.stage || "unknown error"}. Check console for details.`);
        return;
      }
      if (data.type === "MWU_REQUEST_IMAGE_PICKER") {
        const nextElementId = String(data.elementId || "");
        if (!nextElementId) {
          return;
        }
        setPendingImageElementId(nextElementId);
        setMediaPickerQuery("");
        setSelectedMediaId(mediaItems[0]?.id || "");
        setMediaPickerOpen(true);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [mediaItems, onEditableHtmlUpdate, onPersistBuilderState, setNotice]);

  const applySelectedMedia = () => {
    try {
      if (!pendingImageElementId || !selectedMediaItem?.path) {
        console.error("[MWU page editor] image replacement blocked before postMessage", {
          pendingImageElementId,
          selectedMediaItem
        });
        return;
      }
      console.info("[MWU page editor] posting image replacement", {
        elementId: pendingImageElementId,
        src: selectedMediaItem.path,
        title: selectedMediaItem.title
      });
      builderFrameRef.current?.contentWindow?.postMessage(
        {
          type: "MWU_REPLACE_IMAGE_SOURCE",
          elementId: pendingImageElementId,
          src: selectedMediaItem.path,
          preferLocalAsset: /^\/assets\//i.test(String(selectedMediaItem.path || ""))
        },
        "*"
      );
      setMediaPickerOpen(false);
    } catch (error) {
      console.error("[MWU page editor] failed to post image replacement", {
        error,
        pendingImageElementId,
        selectedMediaItem
      });
    }
  };

  const copySelectedMediaUrl = async () => {
    const url = selectedMediaUrl;
    if (!url) return;
    try {
      await navigator.clipboard?.writeText(url);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = url;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
    }
  };

  const deleteSelectedMedia = async () => {
    if (!selectedMediaItem?.id || !onDeleteMedia) {
      return;
    }
    const deleted = await onDeleteMedia(selectedMediaItem.id);
    if (!deleted) {
      return;
    }
    const remainingItems = mediaItems.filter((item) => String(item.id) !== String(selectedMediaItem.id));
    setSelectedMediaId(remainingItems[0]?.id || "");
    if (!remainingItems.length) {
      setMediaPickerOpen(false);
    }
  };

  const handleUpload = async (event) => {
    const files = event.target.files;
    if (!files?.length || !onUploadMediaFiles) {
      event.target.value = "";
      return;
    }
    try {
      setUploadingMedia(true);
      const uploadedItems = await onUploadMediaFiles(files);
      const uploadedItem = uploadedItems?.find((item) => item?.id || item?.path);
      if (uploadedItem?.id) {
        setSelectedMediaId(uploadedItem.id);
      } else if (uploadedItem?.path) {
        const matchingItem = mediaItems.find((item) => item.path === uploadedItem.path);
        if (matchingItem?.id) {
          setSelectedMediaId(matchingItem.id);
        }
      }
    } finally {
      setUploadingMedia(false);
      event.target.value = "";
    }
  };

  return (
    <section className="admin-view page-editor-html-shell">
      <div className="panel page-editor-html-frame-panel">
        <div className="page-editor-html-toolbar">
          <div>
            <span className="eyebrow">Page Editor</span>
            <h2>{safePage.title || "Untitled Page"}</h2>
          </div>
          <div className="page-editor-html-toolbar-actions">
            <button
              type="button"
              onClick={() => {
                if (builderFrameRef.current) builderFrameRef.current.src = builderUrl;
              }}
            >
              <RefreshCw size={16} />
              <span>Reload</span>
            </button>
          </div>
        </div>
        <iframe
          key={pageId}
          ref={builderFrameRef}
          title={`${safePage.title || "Page"} visual builder`}
          src={builderUrl}
          className="page-editor-html-frame"
        />
      </div>

      {mediaPickerOpen && (
        <div
          className="page-editor-media-modal"
          onClick={() => setMediaPickerOpen(false)}
        >
          <div
            className="page-editor-media-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="page-editor-media-library">
              <div className="page-editor-media-head">
                <div>
                  <span className="eyebrow">Media Library</span>
                  <h2>Replace imported image</h2>
                </div>
                <button
                  type="button"
                  className="page-editor-media-close"
                  onClick={() => setMediaPickerOpen(false)}
                  aria-label="Close media library"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="page-editor-media-toolbar">
                <input
                  type="search"
                  value={mediaPickerQuery}
                  onChange={(event) => setMediaPickerQuery(event.target.value)}
                  placeholder="Search media..."
                />
                <label className={`ghost-button compact page-editor-media-upload ${uploadingMedia ? "disabled" : ""}`}>
                  {uploadingMedia ? "Uploading..." : "Upload"}
                  <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleUpload} />
                </label>
              </div>
              <div className="page-editor-media-grid">
                {filteredMediaItems.length ? filteredMediaItems.map((item) => {
                  const isActive = String(item.id) === String(selectedMediaItem?.id || "");
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedMediaId(item.id)}
                      className={isActive ? "page-editor-media-card active" : "page-editor-media-card"}
                    >
                      <div className="page-editor-media-thumb">
                        <img src={item.path} alt={item.title || "Media"} />
                      </div>
                      <span>{item.type || "Image"}</span>
                      <strong>
                        {item.title || "Untitled media"}
                      </strong>
                      <small>{item.size || item.dimensions || item.path}</small>
                    </button>
                  );
                }) : (
                  <div className="page-editor-media-empty">
                    No media items match this search.
                  </div>
                )}
              </div>
            </div>

            <aside className="page-editor-media-details">
              {selectedMediaItem ? (
                <>
                  <div className="page-editor-media-preview">
                    <img src={selectedMediaItem.path} alt={selectedMediaItem.title || "Media"} />
                  </div>
                  <div className="page-editor-media-copy">
                    <span className="eyebrow">Image Information</span>
                    <h3>{selectedMediaItem.title || "Untitled media"}</h3>
                    <dl className="page-editor-media-meta">
                      {selectedMediaDetails.map(([label, value]) => (
                        <div
                          key={label}
                          className={label === "URL" ? "page-editor-media-meta-url-row" : ""}
                        >
                          <dt>{label}</dt>
                          {label === "URL" ? (
                            <div className="page-editor-media-url-inline">
                              <dd className="url" title={value || ""}>
                                {shortenMediaUrl(value || "") || "Unknown"}
                              </dd>
                              <button
                                type="button"
                                className="ghost-button compact"
                                onClick={copySelectedMediaUrl}
                                disabled={!selectedMediaItem?.path}
                              >
                                Copy URL
                              </button>
                            </div>
                          ) : (
                            <dd>{value || "Unknown"}</dd>
                          )}
                        </div>
                      ))}
                    </dl>
                  </div>
                </>
              ) : (
                <div className="page-editor-media-empty details">
                  Choose an image to view its upload date, size, dimensions, and URL.
                </div>
              )}
              <div className="page-editor-media-actions">
                <button type="button" className="danger-button" onClick={deleteSelectedMedia} disabled={!selectedMediaItem?.id || uploadingMedia}>
                  <Trash2 size={16} />
                  <span>Delete</span>
                </button>
                <button type="button" className="primary-button" onClick={applySelectedMedia} disabled={!selectedMediaItem || uploadingMedia}>
                  Use selected image
                </button>
              </div>
            </aside>
          </div>
        </div>
      )}
    </section>
  );
}
