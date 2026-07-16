import { LogOut } from "lucide-react";
import PageEditor from "./PageEditor";

export default function StandalonePageEditorView({
  page,
  isLoading,
  notFound,
  notice,
  setNotice,
  builderInitPayload,
  builderInitRevision,
  onPersistBuilderState,
  onEditableHtmlUpdate,
  mediaItems,
  onUploadMediaFiles,
  onDeleteMedia,
  onLogout
}) {
  if (isLoading) {
    return <main className="standalone-state"><strong>Loading page editor…</strong></main>;
  }
  if (notFound || !page) {
    return <main className="standalone-state"><strong>Page not found.</strong></main>;
  }

  return (
    <main className="standalone-editor-view">
      <header className="standalone-editor-bar">
        <div>
          <span className="eyebrow">MWU Standalone Editor</span>
          <strong>{page.title || "Untitled Page"}</strong>
        </div>
        <button className="ghost-button" type="button" onClick={onLogout}>
          <LogOut size={16} />
          <span>Log out</span>
        </button>
      </header>
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button className="icon-button" type="button" onClick={() => setNotice("")}>×</button>
        </div>
      )}
      <PageEditor
        page={page}
        builderInitPayload={builderInitPayload}
        builderInitRevision={builderInitRevision}
        onPersistBuilderState={onPersistBuilderState}
        onEditableHtmlUpdate={onEditableHtmlUpdate}
        mediaItems={mediaItems}
        onUploadMediaFiles={onUploadMediaFiles}
        onDeleteMedia={onDeleteMedia}
        setNotice={setNotice}
      />
    </main>
  );
}
