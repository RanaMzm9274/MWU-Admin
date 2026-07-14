import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Copy,
  Download,
  Filter,
  FolderOpen,
  Globe2,
  Layers,
  ListChecks,
  ListTree,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import { StatusPill, ViewModeToggle } from "../components/Common";

export default function PagesView({
  pages,
  allPages,
  menuGroupChoices,
  activePageId,
  setActivePageId,
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  menuFilter,
  setMenuFilter,
  sortKey,
  setSortKey,
  selectedPageIds,
  toggleSelectedPage,
  toggleAllFiltered,
  bulkUpdateStatus,
  bulkDeletePages,
  bulkDuplicate,
  exportAllPages,
  importLivePublishedPages,
  importInputRef,
  importPages,
  createNewPage,
  deletePageById,
  openPageEditorView,
  pageStatusFilters,
  getThumbnail,
  getMenuReferenceLabel,
  getSeoScore,
  formatDate,
  isLocalDraftPage,
  openPageEditorTab
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [viewMode, setViewMode] = useState("list");
  const pageTypeOptions = useMemo(
    () => Array.from(new Set(allPages.map((page) => page.type).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [allPages]
  );
  const totalPages = Math.max(Math.ceil(pages.length / pageSize), 1);
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = pages.length ? (safePage - 1) * pageSize : 0;
  const paginatedPages = pages.slice(pageStart, pageStart + pageSize);
  const pageEnd = Math.min(pageStart + paginatedPages.length, pages.length);
  const visibleSelected =
    paginatedPages.length > 0 &&
    paginatedPages.every((page) => selectedPageIds.some((id) => String(id) === String(page.id)));

  useEffect(() => {
    setCurrentPage(1);
  }, [query, statusFilter, typeFilter, menuFilter, sortKey, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const selectPageRow = (pageId) => {
    setActivePageId(pageId);
  };

  const openPageForEdit = (page) => {
    if (!page) return;
    if (!isLocalDraftPage(page)) {
      openPageEditorTab(page.id);
      return;
    }
    openPageEditorView(page.id, "content");
  };

  const openPageSections = (pageId) => {
    openPageEditorView(pageId, "builder");
  };

  return (
    <section className="admin-view pages-redesign">
      <div className="view-header">
        <div>
          <span className="eyebrow">All Website Pages</span>
          <h2>Editing and Management</h2>
        </div>
        <div className="header-actions">
          <button className="ghost-button" type="button" onClick={importLivePublishedPages}>
            <Globe2 size={17} />
            <span>Import Live Published</span>
          </button>
          <button className="ghost-button" type="button" onClick={() => importInputRef.current?.click()}>
            <FolderOpen size={17} />
            <span>Import</span>
          </button>
          <input ref={importInputRef} className="hidden-input" type="file" accept="application/json" onChange={importPages} />
          <button className="ghost-button" type="button" onClick={exportAllPages}>
            <Download size={17} />
            <span>Export All</span>
          </button>
          <button className="primary-button" type="button" onClick={createNewPage}>
            <Plus size={17} />
            <span>Add Page</span>
          </button>
        </div>
      </div>

      <div className="view-content">
        <div className="filter-bar manager-toolbar pages-toolbar">
          <label className="search-field">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or slug" />
          </label>

          <label className="select-field">
            <Filter size={17} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option>All</option>
              {pageStatusFilters.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>

          <label className="select-field">
            <Layers size={17} />
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option>All</option>
              {pageTypeOptions.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>

          <label className="select-field">
            <ListChecks size={17} />
            <select value={menuFilter} onChange={(event) => setMenuFilter(event.target.value)}>
              <option>All</option>
              {menuGroupChoices.map((group) => (
                <option key={group.value || "not-in-menu"} value={group.value}>
                  {group.label}
                </option>
              ))}
            </select>
          </label>

          <label className="select-field">
            <BarChart3 size={17} />
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
              <option value="updatedAt">Latest Updated</option>
              <option value="title">Title A-Z</option>
              <option value="menuOrder">Menu Order</option>
              <option value="status">Status</option>
            </select>
          </label>

          <label className="select-field">
            <ListTree size={17} />
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              {[25, 50, 100].map((size) => (
                <option value={size} key={size}>{size} per page</option>
              ))}
            </select>
          </label>

          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>

        <div className={`bulk-bar ${selectedPageIds.length ? "show" : ""}`}>
          <span className="count"><span>{selectedPageIds.length}</span> selected</span>
          <button className="ghost-button" type="button" onClick={() => bulkUpdateStatus("Published")}>
            <Send size={17} />
            <span>Publish</span>
          </button>
          <button className="ghost-button" type="button" onClick={() => bulkUpdateStatus("Review")}>
            <ShieldCheck size={17} />
            <span>Review</span>
          </button>
          <button className="ghost-button" type="button" onClick={() => bulkUpdateStatus("Archived")}>
            <Archive size={17} />
            <span>Archive</span>
          </button>
          <button className="danger-button" type="button" onClick={bulkDeletePages}>
            <Trash2 size={17} />
            <span>Delete</span>
          </button>
          <button className="ghost-button" type="button" onClick={bulkDuplicate}>
            <Copy size={17} />
            <span>Duplicate</span>
          </button>
        </div>

        <div className="table-panel panel">
          {viewMode === "list" ? (
            <div className="pages-table" role="table" aria-label="All website pages">
              <div className="pages-row table-head" role="row">
                <label className="check-cell">
                  <input
                    type="checkbox"
                    checked={visibleSelected}
                    onChange={() => toggleAllFiltered(paginatedPages.map((page) => page.id))}
                  />
                </label>
                <span>Page</span>
                <span>Type</span>
                <span>Menu</span>
                <span>Status</span>
                <span>SEO</span>
                <span>Updated</span>
                <span>Actions</span>
              </div>

              {paginatedPages.map((page) => (
                <div className={`pages-row ${String(page.id) === String(activePageId) ? "active" : ""}`} role="row" key={page.id}>
                  <label className="check-cell">
                    <input
                      type="checkbox"
                      checked={selectedPageIds.some((id) => String(id) === String(page.id))}
                      onChange={() => toggleSelectedPage(page.id)}
                    />
                  </label>
                  <button className="page-title-cell" type="button" onClick={() => selectPageRow(page.id)}>
                    <img src={getThumbnail(page)} alt="" />
                    <span>
                      <strong>{page.title}</strong>
                      <small>/{page.slug}</small>
                    </span>
                  </button>
                  <span>{page.type}</span>
                  <span>{getMenuReferenceLabel(page, allPages)}</span>
                  <StatusPill status={page.status} />
                  <span>{getSeoScore(page)}%</span>
                  <span>{formatDate(page.updatedAt)}</span>
                  <div className="table-actions">
                    <button className="icon-button" type="button" aria-label="Edit page" onClick={() => openPageForEdit(page)}>
                      <Pencil size={16} />
                    </button>
                    <button className="icon-button" type="button" aria-label="View sections" onClick={() => openPageSections(page.id)}>
                      <ListTree size={16} />
                    </button>
                    <button className="icon-button danger" type="button" aria-label="Delete page" onClick={() => deletePageById(page.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="pages-grid" role="list" aria-label="All website pages grid">
              {paginatedPages.map((page) => (
                <article className={`page-grid-card ${String(page.id) === String(activePageId) ? "active" : ""}`} key={page.id}>
                  <div className="page-grid-card-top">
                    <label className="check-cell">
                      <input
                        type="checkbox"
                        checked={selectedPageIds.some((id) => String(id) === String(page.id))}
                        onChange={() => toggleSelectedPage(page.id)}
                      />
                    </label>
                    <StatusPill status={page.status} />
                  </div>
                  <button className="page-grid-thumb" type="button" onClick={() => selectPageRow(page.id)}>
                    <img src={getThumbnail(page)} alt="" />
                  </button>
                  <div className="page-grid-card-body">
                    <strong>{page.title}</strong>
                    <small>/{page.slug}</small>
                    <p>{page.summary}</p>
                  </div>
                  <div className="page-grid-card-meta">
                    <span>{page.type}</span>
                    <span>{getMenuReferenceLabel(page, allPages)}</span>
                    <span>SEO {getSeoScore(page)}%</span>
                    <span>{formatDate(page.updatedAt)}</span>
                  </div>
                  <div className="page-grid-card-actions">
                    <button className="icon-button" type="button" aria-label="Edit page" onClick={() => openPageForEdit(page)}>
                      <Pencil size={16} />
                    </button>
                    <button className="icon-button" type="button" aria-label="View sections" onClick={() => openPageSections(page.id)}>
                      <ListTree size={16} />
                    </button>
                    <button className="icon-button danger" type="button" aria-label="Delete page" onClick={() => deletePageById(page.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))}
              {!paginatedPages.length && <p className="content-pages-empty">No pages match the current filters.</p>}
            </div>
          )}

          <div className="pagination-bar">
            <span>
              Showing {pages.length ? pageStart + 1 : 0}-{pageEnd} of {pages.length} pages
            </span>
            <div className="pagination-actions">
              <button className="ghost-button" type="button" aria-label="First page" disabled={safePage <= 1} onClick={() => setCurrentPage(1)}>
                <ChevronsLeft size={16} />
              </button>
              <button className="ghost-button" type="button" aria-label="Previous page" disabled={safePage <= 1} onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))}>
                <ArrowUp size={16} />
              </button>
              <strong>Page {safePage} of {totalPages}</strong>
              <button className="ghost-button" type="button" aria-label="Next page" disabled={safePage >= totalPages} onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))}>
                <ArrowDown size={16} />
              </button>
              <button className="ghost-button" type="button" aria-label="Last page" disabled={safePage >= totalPages} onClick={() => setCurrentPage(totalPages)}>
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
