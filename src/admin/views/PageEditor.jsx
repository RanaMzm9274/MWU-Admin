import { useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";

export default function PageEditor({
  page,
  builderInitPayload,
  onPersistBuilderState,
  onEditableHtmlUpdate
}) {
  const safePage = page || {};
  const pageId = safePage.id || safePage.slug || "new-page";
  const builderUrl = `/visual-page-builder.html?pageId=${encodeURIComponent(pageId)}`;
  const builderFrameRef = useRef(null);

  useEffect(() => {
    const frame = builderFrameRef.current;
    if (!frame) return;

    const postInit = () => {
      frame.contentWindow?.postMessage(
        { type: "MWU_HTML_BUILDER_INIT", payload: builderInitPayload || {} },
        "*"
      );
    };

    frame.addEventListener("load", postInit);
    return () => frame.removeEventListener("load", postInit);
  }, [builderInitPayload, pageId]);

  useEffect(() => {
    builderFrameRef.current?.contentWindow?.postMessage(
      { type: "MWU_HTML_BUILDER_INIT", payload: builderInitPayload || {} },
      "*"
    );
  }, [builderInitPayload, pageId]);

  useEffect(() => {
    const handleMessage = (event) => {
      const data = event.data || {};
      if (data.type === "MWU_HTML_BUILDER_READY") {
        builderFrameRef.current?.contentWindow?.postMessage(
          { type: "MWU_HTML_BUILDER_INIT", payload: builderInitPayload || {} },
          "*"
        );
        return;
      }
      if (data.type === "MWU_HTML_BUILDER_STATE" && (data.saveMode === "draft" || data.saveMode === "publish")) {
        onPersistBuilderState?.(data, data.saveMode);
        return;
      }
      if (data.type === "MWU_LIVE_HTML_UPDATED") {
        onEditableHtmlUpdate?.(data);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [builderInitPayload, onEditableHtmlUpdate, onPersistBuilderState]);

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
              onClick={() => builderFrameRef.current?.contentWindow?.location.reload()}
            >
              <RefreshCw size={16} />
              <span>Reload</span>
            </button>
          </div>
        </div>
        <iframe
          ref={builderFrameRef}
          title={`${safePage.title || "Page"} visual builder`}
          src={builderUrl}
          className="page-editor-html-frame"
          sandbox="allow-same-origin allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    </section>
  );
}
