export default function PageEditor({ page }) {
  const pageId = page?.id || page?.slug || "new-page";
  const builderUrl = `/visual-page-builder.html?pageId=${encodeURIComponent(pageId)}`;

  return (
    <section className="admin-view page-editor-html-shell">
      <div className="panel page-editor-html-frame-panel">
        <iframe
          id="mwu-html-page-editor-frame"
          title={`${page?.title || "Page"} HTML builder`}
          src={builderUrl}
          className="page-editor-html-frame"
          sandbox="allow-same-origin allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    </section>
  );
}
