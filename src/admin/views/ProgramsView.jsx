import { useState } from "react";
import {
  Download,
  Eye,
  FileText,
  Filter,
  GraduationCap,
  Layers,
  Link as LinkIcon,
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
  megaMenuPrograms = [],
  programPages,
  mainPage,
  openPageEditorTab,
  createProgramPage,
  deletePageById,
  addCategory,
  updateCategory,
  updateMegaMenuCategory,
  deleteCategory,
  addProgram,
  importLivePrograms,
  updateProgram,
  deleteProgram,
  pageStatusFilters,
  statusOptions,
  mediaItems,
  logoSrc,
  getThumbnail
}) {
  const [activeTab, setActiveTab] = useState("pages");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [programQuery, setProgramQuery] = useState("");
  const [programStatusFilter, setProgramStatusFilter] = useState("All");
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [pageQuery, setPageQuery] = useState("");
  const [pageStatusFilter, setPageStatusFilter] = useState("All");
  const [pageViewMode, setPageViewMode] = useState("grid");
  const sortedCategories = [...categories].sort((a, b) => Number(a.menuOrder) - Number(b.menuOrder));
  const filteredProgramPages = programPages
    .filter((page) => pageStatusFilter === "All" || (page.status || "").toLowerCase() === pageStatusFilter.toLowerCase())
    .filter((page) =>
      [page.title, page.slug, page.type, page.menu, page.summary].join(" ").toLowerCase().includes(pageQuery.toLowerCase())
    );
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
  const featuredPrograms = programs.filter((program) => program.featured && program.status !== "Archived");
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
  const selectableMegaMenuPrograms = megaMenuPrograms.length ? megaMenuPrograms : programs;
  const getMegaMenuProgramIds = (category) =>
    Array.isArray(category.programIds)
      ? category.programIds.map(String)
      : selectableMegaMenuPrograms
          .filter((program) => program.categorySlug === category.slug)
          .map((program) => String(program.id));
  const updateMegaMenuPrograms = (category, nextIds) => {
    const normalizedIds = Array.from(new Set(nextIds.map(String)));
    if (typeof updateMegaMenuCategory === "function") {
      updateMegaMenuCategory(category.id, normalizedIds);
      return;
    }
    updateCategory(category.id, "programIds", normalizedIds);
  };

  return (
    <section className="programs-view">
      <div className="program-tabs" role="tablist" aria-label="Program management tabs">
        {[
          { id: "pages", label: "Program Pages", icon: FileText },
          { id: "programs", label: "Programs", icon: GraduationCap },
          { id: "categories", label: "Categories", icon: Layers },
          { id: "mega-menu", label: "Mega Menu", icon: ListTree },
          { id: "preview", label: "Listing Preview", icon: Eye }
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

          <div className="manager-toolbar programs-toolbar programs-pages-toolbar">
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
            <ViewModeToggle value={pageViewMode} onChange={setPageViewMode} />
          </div>

          <div className={`program-pages-grid ${pageViewMode === "list" ? "list-mode" : ""}`}>
            {filteredProgramPages.map((page) => (
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

      {activeTab === "mega-menu" && (
        <section className="panel programs-manager programs-mega-manager">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Header Navigation</span>
              <h2>Programs Mega Menu</h2>
              <p>Choose each category and assign multiple programs. These assignments are shared with the Header editor.</p>
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
      )}

      {activeTab === "preview" && (
        <section className="program-listing-preview">
          <div
            className="program-listing-hero"
            style={{ backgroundImage: `linear-gradient(90deg, rgba(8, 25, 51, 0.9), rgba(26, 75, 150, 0.68)), url(${mainPage.heroImage})` }}
          >
            <img src={logoSrc} alt="Madda Walabu University" />
            <span>{mainPage.heroTag}</span>
            <h2>{mainPage.heroHeadline}</h2>
            <p>{mainPage.summary}</p>
          </div>
          <div className="program-category-preview">
            {sortedCategories.filter((category) => category.status !== "Archived").map((category) => {
              const listedPrograms = programs.filter(
                (program) => program.categorySlug === category.slug && program.status !== "Archived"
              );
              return (
                <section className="program-category-section" key={category.id}>
                  <div className="panel-head compact">
                    <div>
                      <span className="eyebrow">{category.name}</span>
                      <h2>{category.description}</h2>
                    </div>
                    <StatusPill status={category.status} />
                  </div>
                  <div className="program-preview-grid">
                    {listedPrograms.map((program) => (
                      <article className="program-preview-card" key={program.id}>
                        <img src={program.heroImage} alt="" />
                        <div>
                          <span>{program.level} / {program.duration}</span>
                          <h3>{program.title}</h3>
                          <p>{program.summary}</p>
                          <small>{program.college} / {program.campus}</small>
                          <StatusPill status={program.applicationOpen ? "Published" : "Review"} />
                        </div>
                      </article>
                    ))}
                    {!listedPrograms.length && <p className="program-empty">No active programs in this category.</p>}
                  </div>
                </section>
              );
            })}
          </div>
          <div className="featured-strip">
            <strong>{featuredPrograms.length}</strong>
            <span>featured programs will appear on the main programs page.</span>
          </div>
        </section>
      )}
    </section>
  );
}
