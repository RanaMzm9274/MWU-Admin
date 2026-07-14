import { useState } from "react";
import { Filter, ListTree, Pencil, Search, Trash2 } from "lucide-react";
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
  isLocalDraftPage,
  openPageEditorTab,
  setActivePageId,
  setActiveView,
  setEditorTab,
  deletePageById
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [viewMode, setViewMode] = useState("grid");
  const filteredPages = pages
    .filter((page) => statusFilter === "All" || (page.status || "").toLowerCase() === statusFilter.toLowerCase())
    .filter((page) =>
      [page.title, page.slug, page.type, page.menu, page.summary]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase())
    );

  const openPage = (page, tab) => {
    if (tab === "content" && !isLocalDraftPage(page)) {
      openPageEditorTab(page.id);
      return;
    }
    setActivePageId(page.id);
    setEditorTab(tab);
    setActiveView("page-editor");
  };

  return (
    <section className="content-pages-view">
      <div className="content-pages-header">
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
      </div>

      <section className="content-pages-shell">
        <div className="content-pages-head">
          <span className="eyebrow">Review Queue</span>
          <h2>{filteredPages.length} Pages</h2>
        </div>

        <div className="content-pages-toolbar">
          <label className="content-pages-search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or slug..." />
          </label>
          <label className="content-pages-filter">
            <Filter size={16} />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option>All</option>
              {pageStatusFilters.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>

        <div className={`content-pages-grid ${viewMode === "list" ? "list-mode" : ""}`}>
          {filteredPages.map((page) => (
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
      </section>
    </section>
  );
}
