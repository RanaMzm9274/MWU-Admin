import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Download,
  FileText,
  Filter,
  GraduationCap,
  Layers,
  Link as LinkIcon,
  ListChecks,
  ListTree,
  Pencil,
  Plus,
  Search,
  Trash2
} from "lucide-react";
import { Field, StatusPill, ViewModeToggle } from "../components/Common";

export default function ProgramsView({
  categories,
  programs,
  programPages,
  openPageEditorTab,
  createProgramPage,
  deletePageById,
  addCategory,
  updateCategory,
  deleteCategory,
  addProgram,
  importLivePrograms,
  updateProgram,
  deleteProgram,
  pageStatusFilters,
  statusOptions,
  mediaItems,
  getThumbnail
}) {
  const [activeTab, setActiveTab] = useState("pages");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [programQuery, setProgramQuery] = useState("");
  const [programStatusFilter, setProgramStatusFilter] = useState("All");
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [pageQuery, setPageQuery] = useState("");
  const [pageStatusFilter, setPageStatusFilter] = useState("All");
  const [pageTypeFilter, setPageTypeFilter] = useState("All");
  const [pageMenuFilter, setPageMenuFilter] = useState("All");
  const [pageSortKey, setPageSortKey] = useState("updatedAt");
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageViewMode, setPageViewMode] = useState("grid");
  const sortedCategories = [...categories].sort((a, b) => Number(a.menuOrder) - Number(b.menuOrder));
  const programPageTypes = useMemo(() => Array.from(new Set(programPages.map((page) => page.type).filter(Boolean))).sort(), [programPages]);
  const programPageMenus = useMemo(() => Array.from(new Set(programPages.map((page) => page.menu).filter(Boolean))).sort(), [programPages]);
  const filteredProgramPages = programPages
    .filter((page) => pageStatusFilter === "All" || (page.status || "").toLowerCase() === pageStatusFilter.toLowerCase())
    .filter((page) => pageTypeFilter === "All" || page.type === pageTypeFilter)
    .filter((page) => pageMenuFilter === "All" || page.menu === pageMenuFilter)
    .filter((page) =>
      [page.title, page.slug, page.type, page.menu, page.summary].join(" ").toLowerCase().includes(pageQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (pageSortKey === "title") return String(a.title || "").localeCompare(String(b.title || ""));
      if (pageSortKey === "menuOrder") return Number(a.menuOrder || 0) - Number(b.menuOrder || 0);
      if (pageSortKey === "status") return String(a.status || "").localeCompare(String(b.status || ""));
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    });
  const totalProgramPageCount = Math.max(1, Math.ceil(filteredProgramPages.length / pageSize));
  const safeProgramPage = Math.min(currentPage, totalProgramPageCount);
  const programPageStart = (safeProgramPage - 1) * pageSize;
  const visibleProgramPages = filteredProgramPages.slice(programPageStart, programPageStart + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageQuery, pageStatusFilter, pageTypeFilter, pageMenuFilter, pageSortKey, pageSize]);
  const filteredPrograms = programs
    .filter((program) => categoryFilter === "All" || program.categorySlug === categoryFilter)
    .filter((program) => programStatusFilter === "All" || (program.status || "").toLowerCase() === programStatusFilter.toLowerCase())
    .filter((program) =>
      [program.title, program.slug, program.college, program.level, program.campus, program.pageSlug]
        .join(" ")
        .toLowerCase()
        .includes(programQuery.toLowerCase())
    )
    .sort((a, b) => a.title.localeCompare(b.title));
  const selectedProgram =
    filteredPrograms.find((program) => String(program.id) === String(selectedProgramId)) ||
    filteredPrograms[0] ||
    programs.find((program) => String(program.id) === String(selectedProgramId)) ||
    null;
  const selectedProgramLinkedPage = selectedProgram
    ? programPages.find((page) => page.slug === selectedProgram.pageSlug)
    : null;
  const selectedProgramCategoryName = selectedProgram
    ? sortedCategories.find((category) => category.slug === selectedProgram.categorySlug)?.name || "Uncategorized"
    : "";
  return (
    <section className="programs-view">
      <div className="program-tabs" role="tablist" aria-label="Program management tabs">
        {[
          { id: "pages", label: "Program Pages", icon: FileText },
          { id: "programs", label: "Programs", icon: GraduationCap },
          { id: "categories", label: "Categories", icon: Layers }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} type="button" className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>
              <Icon size={17} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === "pages" && (
        <section className="panel programs-manager">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Imported Program Pages</span>
              <h2>{filteredProgramPages.length} Program Pages</h2>
            </div>
            <div className="panel-actions">
              <button className="ghost-button" type="button" onClick={importLivePrograms}>
                <Download size={17} />
                <span>Import Live Programs</span>
              </button>
              <button className="primary-button" type="button" onClick={() => createProgramPage()}>
                <Plus size={17} />
                <span>Add Page</span>
              </button>
            </div>
          </div>

          <div className="filter-bar manager-toolbar pages-toolbar programs-pages-toolbar">
            <label className="search-field">
              <Search size={17} />
              <input value={pageQuery} onChange={(event) => setPageQuery(event.target.value)} placeholder="Search program page title or slug" />
            </label>
            <label className="select-field">
              <Filter size={17} />
              <select value={pageStatusFilter} onChange={(event) => setPageStatusFilter(event.target.value)}>
                <option>All</option>
                {pageStatusFilters.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
            <label className="select-field">
              <Layers size={17} />
              <select value={pageTypeFilter} onChange={(event) => setPageTypeFilter(event.target.value)}>
                <option>All</option>
                {programPageTypes.map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>
            <label className="select-field">
              <ListChecks size={17} />
              <select value={pageMenuFilter} onChange={(event) => setPageMenuFilter(event.target.value)}>
                <option>All</option>
                {programPageMenus.map((menu) => <option key={menu}>{menu}</option>)}
              </select>
            </label>
            <label className="select-field">
              <BarChart3 size={17} />
              <select value={pageSortKey} onChange={(event) => setPageSortKey(event.target.value)}>
                <option value="updatedAt">Latest Updated</option>
                <option value="title">Title A-Z</option>
                <option value="menuOrder">Menu Order</option>
                <option value="status">Status</option>
              </select>
            </label>
            <label className="select-field">
              <ListTree size={17} />
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                {[25, 50, 100].map((size) => <option value={size} key={size}>{size} per page</option>)}
              </select>
            </label>
            <ViewModeToggle value={pageViewMode} onChange={setPageViewMode} />
          </div>

          <div className={`program-pages-grid ${pageViewMode === "list" ? "list-mode" : ""}`}>
            {visibleProgramPages.map((page) => (
              <article className={`program-page-card ${pageViewMode === "list" ? "list-mode" : ""}`} key={page.id}>
                <img src={getThumbnail(page)} alt="" />
                <div className="program-page-card-body">
                  <StatusPill status={page.status} />
                  <h3>{page.title}</h3>
                  <small>/{page.slug}</small>
                  <p>{page.summary}</p>
                </div>
                <div className="program-page-actions">
                  <button className="icon-button" type="button" aria-label="Edit page" onClick={() => openPageEditorTab(page.id, "content")}>
                    <Pencil size={16} />
                  </button>
                  <button className="icon-button" type="button" aria-label="View sections" onClick={() => openPageEditorTab(page.id, "builder")}>
                    <ListTree size={16} />
                  </button>
                  <button className="icon-button danger" type="button" aria-label="Delete page" onClick={() => deletePageById(page.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
            {!filteredProgramPages.length && <p className="program-empty">No program pages match the current filters.</p>}
          </div>
          {filteredProgramPages.length > 0 && (
            <div className="pagination-bar">
              <span>Showing {programPageStart + 1}-{Math.min(programPageStart + pageSize, filteredProgramPages.length)} of {filteredProgramPages.length} pages</span>
              <div className="pagination-actions">
                <button className="ghost-button" type="button" disabled={safeProgramPage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>Previous</button>
                <strong>Page {safeProgramPage} of {totalProgramPageCount}</strong>
                <button className="ghost-button" type="button" disabled={safeProgramPage >= totalProgramPageCount} onClick={() => setCurrentPage((page) => Math.min(totalProgramPageCount, page + 1))}>Next</button>
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === "programs" && (
        <section className="panel programs-manager">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Program Catalog</span>
              <h2>{filteredPrograms.length} Programs</h2>
            </div>
            <div className="panel-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => addProgram(categoryFilter === "All" ? sortedCategories[0]?.slug : categoryFilter)}
              >
                <Plus size={17} />
                <span>Add Program</span>
              </button>
            </div>
          </div>

          <div className="manager-toolbar programs-toolbar programs-catalog-toolbar">
            <label className="search-field">
              <Search size={17} />
              <input value={programQuery} onChange={(event) => setProgramQuery(event.target.value)} placeholder="Search programs, college, level, or page" />
            </label>
            <label className="select-field">
              <Layers size={17} />
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option>All</option>
                {sortedCategories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
              </select>
            </label>
            <label className="select-field">
              <Filter size={17} />
              <select value={programStatusFilter} onChange={(event) => setProgramStatusFilter(event.target.value)}>
                <option>All</option>
                {statusOptions.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
          </div>

          <div className="program-editor-list">
            {selectedProgram ? (
              <article className="program-editor-card single-editor" key={selectedProgram.id}>
                <div className="program-editor-media">
                  <img src={selectedProgram.heroImage} alt="" />
                  <div className="program-editor-rail-meta">
                    <StatusPill status={selectedProgram.status} />
                    <strong>{selectedProgram.level}</strong>
                    <small>{selectedProgramCategoryName}</small>
                  </div>
                  <div className="program-editor-rail-stats">
                    <span>{selectedProgram.applicationOpen ? "Applications open" : "Applications closed"}</span>
                    <span>{selectedProgram.featured ? "Featured listing" : "Standard listing"}</span>
                    <span>{selectedProgramLinkedPage ? `Linked: /${selectedProgramLinkedPage.slug}` : "No page linked"}</span>
                  </div>
                </div>
                <div className="program-editor-fields">
                  <div className="program-editor-header">
                    <div>
                      <span className="eyebrow">Selected Program</span>
                      <h3>{selectedProgram.title}</h3>
                      <p>{selectedProgram.college} / {selectedProgram.campus}</p>
                    </div>
                    <div className="program-editor-header-actions">
                      {selectedProgramLinkedPage ? (
                        <button className="ghost-button" type="button" onClick={() => openPageEditorTab(selectedProgramLinkedPage.id, "content")}>
                          <Pencil size={16} />
                          <span>Edit Page</span>
                        </button>
                      ) : (
                        <button className="ghost-button" type="button" onClick={() => createProgramPage(selectedProgram)}>
                          <LinkIcon size={16} />
                          <span>Create Page</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="program-editor-section">
                    <div className="program-editor-section-title">
                      <strong>Selection</strong>
                      <span>Choose the catalog record and its public page relationship.</span>
                    </div>
                    <div className="field-grid">
                      <Field label="Program">
                        <select value={selectedProgram.id} onChange={(event) => setSelectedProgramId(event.target.value)}>
                          {filteredPrograms.map((program) => (
                            <option key={program.id} value={program.id}>
                              {program.title} / {program.level}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Linked Page">
                        <select value={selectedProgram.pageSlug} onChange={(event) => updateProgram(selectedProgram.id, "pageSlug", event.target.value)}>
                          <option value="">Not linked</option>
                          {programPages.map((page) => <option key={page.id} value={page.slug}>{page.title}</option>)}
                        </select>
                      </Field>
                    </div>
                  </div>

                  <div className="program-editor-section">
                    <div className="program-editor-section-title">
                      <strong>Academic Details</strong>
                      <span>Update the catalog fields shown across program listings.</span>
                    </div>
                    <div className="field-grid">
                      <Field label="Program Name">
                        <input value={selectedProgram.title} onChange={(event) => updateProgram(selectedProgram.id, "title", event.target.value)} />
                      </Field>
                      <Field label="Catalog Slug">
                        <input value={selectedProgram.slug} onChange={(event) => updateProgram(selectedProgram.id, "slug", event.target.value)} />
                      </Field>
                      <Field label="Category">
                        <select value={selectedProgram.categorySlug} onChange={(event) => updateProgram(selectedProgram.id, "categorySlug", event.target.value)}>
                          {sortedCategories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
                        </select>
                      </Field>
                      <Field label="Level">
                        <select value={selectedProgram.level} onChange={(event) => updateProgram(selectedProgram.id, "level", event.target.value)}>
                          <option>Undergraduate</option>
                          <option>Postgraduate</option>
                          <option>PhD</option>
                          <option>Specialty</option>
                          <option>Short Course</option>
                        </select>
                      </Field>
                      <Field label="College / School">
                        <input value={selectedProgram.college} onChange={(event) => updateProgram(selectedProgram.id, "college", event.target.value)} />
                      </Field>
                      <Field label="Duration">
                        <input value={selectedProgram.duration} onChange={(event) => updateProgram(selectedProgram.id, "duration", event.target.value)} />
                      </Field>
                      <Field label="Delivery">
                        <select value={selectedProgram.delivery} onChange={(event) => updateProgram(selectedProgram.id, "delivery", event.target.value)}>
                          <option>Regular</option>
                          <option>Weekend</option>
                          <option>Extension</option>
                          <option>Online</option>
                          <option>Hybrid</option>
                        </select>
                      </Field>
                      <Field label="Campus">
                        <input value={selectedProgram.campus} onChange={(event) => updateProgram(selectedProgram.id, "campus", event.target.value)} />
                      </Field>
                    </div>
                    <Field label="Program Summary">
                      <textarea rows="3" value={selectedProgram.summary} onChange={(event) => updateProgram(selectedProgram.id, "summary", event.target.value)} />
                    </Field>
                  </div>

                  <div className="program-editor-section">
                    <div className="program-editor-section-title">
                      <strong>Publishing</strong>
                      <span>Control visibility, image, and admission callouts.</span>
                    </div>
                    <div className="field-grid">
                      <Field label="Image">
                        <select value={selectedProgram.heroImage} onChange={(event) => updateProgram(selectedProgram.id, "heroImage", event.target.value)}>
                          {mediaItems.map((media) => <option key={media.id} value={media.path}>{media.title}</option>)}
                        </select>
                      </Field>
                      <Field label="Status">
                        <select value={selectedProgram.status} onChange={(event) => updateProgram(selectedProgram.id, "status", event.target.value)}>
                          {statusOptions.map((status) => <option key={status}>{status}</option>)}
                        </select>
                      </Field>
                    </div>
                  </div>

                  <div className="program-switches">
                    <label className="toggle-field">
                      <input type="checkbox" checked={selectedProgram.featured} onChange={(event) => updateProgram(selectedProgram.id, "featured", event.target.checked)} />
                      <span>Featured program</span>
                    </label>
                    <label className="toggle-field">
                      <input type="checkbox" checked={selectedProgram.applicationOpen} onChange={(event) => updateProgram(selectedProgram.id, "applicationOpen", event.target.checked)} />
                      <span>Applications open</span>
                    </label>
                    <button className="danger-button" type="button" onClick={() => deleteProgram(selectedProgram.id)}>
                      <Trash2 size={17} />
                      <span>Delete Program</span>
                    </button>
                  </div>
                </div>
              </article>
            ) : (
              <div className="program-catalog-empty">
                <GraduationCap size={26} />
                <strong>No programs match these filters</strong>
                <span>Create a program or change the selected category and status.</span>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "categories" && (
        <section className="panel category-manager">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Program Categories</span>
              <h2>{categories.length} Categories</h2>
            </div>
            <button className="primary-button" type="button" onClick={addCategory}>
              <Plus size={17} />
              <span>Add Category</span>
            </button>
          </div>

          <div className="category-grid">
            {sortedCategories.map((category) => {
              const categoryPrograms = programs.filter((program) => program.categorySlug === category.slug);
              return (
                <article className="category-card" key={category.id}>
                  <img src={category.heroImage} alt="" />
                  <div className="category-card-fields">
                    <Field label="Category Name">
                      <input value={category.name} onChange={(event) => updateCategory(category.id, "name", event.target.value)} />
                    </Field>
                    <Field label="Slug">
                      <input value={category.slug} onChange={(event) => updateCategory(category.id, "slug", event.target.value)} />
                    </Field>
                    <Field label="Description">
                      <textarea rows="3" value={category.description} onChange={(event) => updateCategory(category.id, "description", event.target.value)} />
                    </Field>
                    <div className="field-grid">
                      <Field label="Menu Order">
                        <input type="number" min="1" value={category.menuOrder} onChange={(event) => updateCategory(category.id, "menuOrder", event.target.value)} />
                      </Field>
                      <Field label="Status">
                        <select value={category.status} onChange={(event) => updateCategory(category.id, "status", event.target.value)}>
                          {statusOptions.map((status) => <option key={status}>{status}</option>)}
                        </select>
                      </Field>
                      <Field label="Image">
                        <select value={category.heroImage} onChange={(event) => updateCategory(category.id, "heroImage", event.target.value)}>
                          {mediaItems.map((media) => <option key={media.id} value={media.path}>{media.title}</option>)}
                        </select>
                      </Field>
                      <label className="toggle-field">
                        <input type="checkbox" checked={category.featured} onChange={(event) => updateCategory(category.id, "featured", event.target.checked)} />
                        <span>Featured category</span>
                      </label>
                    </div>
                    <div className="category-program-links">
                      <div className="category-program-links-head">
                        <strong>Programs in this category</strong>
                        <span>{categoryPrograms.length}</span>
                      </div>
                      <div className="category-program-chips">
                        {categoryPrograms.slice(0, 8).map((program) => (
                          <button
                            type="button"
                            key={program.id}
                            onClick={() => {
                              setCategoryFilter(category.slug);
                              setProgramQuery(program.title);
                              setActiveTab("programs");
                            }}
                          >
                            <GraduationCap size={14} />
                            <span>{program.title}</span>
                            {program.pageSlug && <LinkIcon size={13} />}
                          </button>
                        ))}
                        {!categoryPrograms.length && <small>No programs assigned yet.</small>}
                      </div>
                    </div>
                    <div className="category-footer">
                      <span>{categoryPrograms.length} programs listed</span>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => {
                          setCategoryFilter(category.slug);
                          setProgramQuery("");
                          setActiveTab("programs");
                        }}
                      >
                        <GraduationCap size={16} />
                        <span>Manage Programs</span>
                      </button>
                      <button className="danger-button" type="button" onClick={() => deleteCategory(category.id)} disabled={categories.length <= 1}>
                        <Trash2 size={17} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Programs mega-menu editing moved to the Header & Footer popup.
        <section className="panel programs-manager programs-mega-manager">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Header Navigation</span>
              <h2>Programs Mega Menu</h2>
              <p>Choose each category and assign multiple programs. These assignments are shared with the Header editor.</p>
            </div>
            <div className="panel-actions">
              <button
                className="primary-button"
                type="button"
                disabled={!megaMenuDirty || megaMenuSaving}
                onClick={async () => {
                  if (typeof saveMegaMenu !== "function") return;
                  setMegaMenuSaving(true);
                  try {
                    const saved = await saveMegaMenu();
                    if (saved) setMegaMenuDirty(false);
                  } finally {
                    setMegaMenuSaving(false);
                  }
                }}
              >
                <Save size={17} />
                <span>{megaMenuSaving ? "Saving..." : megaMenuDirty ? "Save Mega Menu" : "Saved"}</span>
              </button>
            </div>
          </div>

          <div className="programs-mega-category-grid">
            {sortedCategories
              .filter((category) => category.status !== "Archived")
              .map((category) => {
                const selectedIds = getMegaMenuProgramIds(category);
                const selectedPrograms = selectableMegaMenuPrograms.filter((program) => selectedIds.includes(String(program.id)));
                return (
                  <article className="programs-mega-category-card" key={category.id}>
                    <div className="programs-mega-category-head">
                      <div>
                        <span>Menu category</span>
                        <h3>{category.name}</h3>
                      </div>
                      <strong>{selectedIds.length} programs</strong>
                    </div>

                    <Field label="Programs shown under this category">
                      <select
                        className="programs-multi-select"
                        multiple
                        size={Math.min(12, Math.max(6, selectableMegaMenuPrograms.length))}
                        value={selectedIds}
                        onChange={(event) =>
                          updateMegaMenuPrograms(
                            category,
                            Array.from(event.target.selectedOptions).map((option) => option.value)
                          )
                        }
                      >
                        {[...selectableMegaMenuPrograms]
                          .sort((a, b) => a.title.localeCompare(b.title))
                          .map((program) => (
                            <option key={program.id} value={String(program.id)}>
                              {program.title} — {program.level}
                            </option>
                          ))}
                      </select>
                    </Field>

                    <div className="programs-mega-actions">
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => updateMegaMenuPrograms(category, selectableMegaMenuPrograms.map((program) => String(program.id)))}
                      >
                        Select All
                      </button>
                      <button className="ghost-button" type="button" onClick={() => updateMegaMenuPrograms(category, [])}>
                        Clear
                      </button>
                    </div>

                    <div className="programs-mega-selected">
                      {selectedPrograms.map((program) => (
                        <span key={program.id}>{program.title}</span>
                      ))}
                      {!selectedPrograms.length && <small>No programs selected for this category.</small>}
                    </div>
                  </article>
                );
              })}
          </div>
        </section>
      */}

    </section>
  );
}
