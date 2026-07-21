import { useEffect, useMemo, useState } from "react";
import { BarChart3, Filter, Layers, ListChecks, ListTree, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { StatusPill, ViewModeToggle } from "../components/Common";

export default function ContentPagesView({
  title,
  eyebrow,
  description,
  pages,
  emptyLabel,
  icon: Icon,
  pageStatusFilters,
  getThumbnail,
  openPageEditorTab,
  deletePageById,
  createLabel,
  onCreate
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [menuFilter, setMenuFilter] = useState("All");
  const [sortKey, setSortKey] = useState("updatedAt");
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState("grid");
  const typeOptions = useMemo(() => Array.from(new Set(pages.map((page) => page.type).filter(Boolean))).sort(), [pages]);
  const menuOptions = useMemo(() => Array.from(new Set(pages.map((page) => page.menu).filter(Boolean))).sort(), [pages]);
  const filteredPages = useMemo(() => pages
    .filter((page) => statusFilter === "All" || (page.status || "").toLowerCase() === statusFilter.toLowerCase())
    .filter((page) => typeFilter === "All" || page.type === typeFilter)
    .filter((page) => menuFilter === "All" || page.menu === menuFilter)
    .filter((page) => [page.title, page.slug, page.type, page.menu, page.summary].join(" ").toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      if (sortKey === "title") return String(a.title || "").localeCompare(String(b.title || ""));
      if (sortKey === "menuOrder") return Number(a.menuOrder || 0) - Number(b.menuOrder || 0);
      if (sortKey === "status") return String(a.status || "").localeCompare(String(b.status || ""));
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    }), [pages, statusFilter, typeFilter, menuFilter, query, sortKey]);
  const totalPages = Math.max(1, Math.ceil(filteredPages.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const visiblePages = filteredPages.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, statusFilter, typeFilter, menuFilter, sortKey, pageSize]);

  const openPage = (page, tab) => {
    openPageEditorTab(page.id, tab);
  };

  return (
    <section className="content-pages-view">
      {/* <div className="content-pages-header">
        <div className="content-pages-copy">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="content-pages-count">
          <Icon size={22} />
          <strong>{pages.length}</strong>
          <span>Total pages</span>
        </div>
      </div> */}

      <section className="content-pages-shell">
        <div className="content-pages-head">
          <div><span className="eyebrow">Review Queue</span><h2>{filteredPages.length} Pages</h2></div>
          {onCreate && <button className="primary-button content-pages-create" type="button" onClick={onCreate}><Plus size={17} /><span>{createLabel}</span></button>}
        </div>

        <div className="filter-bar manager-toolbar pages-toolbar content-pages-toolbar">
          <label className="search-field">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or slug..." />
          </label>
          <label className="select-field">
            <Filter size={16} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option>All</option>
              {pageStatusFilters.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="select-field">
            <Layers size={16} />
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option>All</option>
              {typeOptions.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label className="select-field">
            <ListChecks size={16} />
            <select value={menuFilter} onChange={(event) => setMenuFilter(event.target.value)}>
              <option>All</option>
              {menuOptions.map((menu) => <option key={menu}>{menu}</option>)}
            </select>
          </label>
          <label className="select-field">
            <BarChart3 size={16} />
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value)}>
              <option value="updatedAt">Latest Updated</option>
              <option value="title">Title A-Z</option>
              <option value="menuOrder">Menu Order</option>
              <option value="status">Status</option>
            </select>
          </label>
          <label className="select-field">
            <ListTree size={16} />
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              {[25, 50, 100].map((size) => <option value={size} key={size}>{size} per page</option>)}
            </select>
          </label>
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>

        <div className={`content-pages-grid ${viewMode === "list" ? "list-mode" : ""}`}>
          {visiblePages.map((page) => (
            <article className={`content-page-card ${viewMode === "list" ? "list-mode" : ""}`} key={page.id}>
              <img src={getThumbnail(page)} alt="" />
              <div className="content-page-card-body">
                <StatusPill status={page.status} />
                <h3>{page.title}</h3>
                <small>/{page.slug}</small>
                <p>{page.summary}</p>
              </div>
              <div className="content-page-actions">
                <button className="icon-button" type="button" aria-label="Edit page" onClick={() => openPage(page, "content")}>
                  <Pencil size={16} />
                </button>
                <button className="icon-button" type="button" aria-label="View sections" onClick={() => openPage(page, "builder")}>
                  <ListTree size={16} />
                </button>
                <button className="icon-button danger" type="button" aria-label="Delete page" onClick={() => deletePageById(page.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
          {!filteredPages.length && <p className="content-pages-empty">{emptyLabel}</p>}
        </div>
        {filteredPages.length > 0 && (
          <div className="pagination-bar">
            <span>Showing {pageStart + 1}-{Math.min(pageStart + pageSize, filteredPages.length)} of {filteredPages.length} pages</span>
            <div className="pagination-actions">
              <button className="ghost-button" type="button" disabled={safePage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>Previous</button>
              <strong>Page {safePage} of {totalPages}</strong>
              <button className="ghost-button" type="button" disabled={safePage >= totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>Next</button>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}
