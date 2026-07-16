import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, FileText, ListChecks, ListTree, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Field } from "../components/Common";

export default function MenusView({
  pages,
  menuGroupChoices = [],
  savePage,
  setPages,
  setFormPage,
  openPageEditorTab,
  normalizePage,
  getMenuReferenceLabel
}) {
  const selectableGroups = menuGroupChoices.filter((group) => group.value);
  const [activeGroup, setActiveGroup] = useState(selectableGroups[0]?.value || "");
  const [availableQuery, setAvailableQuery] = useState("");
  const sortedPages = useMemo(
    () =>
      [...pages].sort((a, b) => {
        const orderDiff = Number(a.menuOrder || 0) - Number(b.menuOrder || 0);
        return orderDiff || a.title.localeCompare(b.title);
      }),
    [pages]
  );

  useEffect(() => {
    if (!selectableGroups.some((group) => group.value === activeGroup)) {
      setActiveGroup(selectableGroups[0]?.value || "");
    }
  }, [activeGroup, selectableGroups]);

  const activeMenuPages = useMemo(
    () => sortedPages.filter((page) => page.menu === activeGroup),
    [activeGroup, sortedPages]
  );
  const availablePages = useMemo(
    () =>
      sortedPages
        .filter((page) => page.menu !== activeGroup)
        .filter((page) => [page.title, page.slug].join(" ").toLowerCase().includes(availableQuery.toLowerCase()))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [activeGroup, availableQuery, sortedPages]
  );
  const rootPages = useMemo(() => activeMenuPages.filter((page) => !page.parentSlug), [activeMenuPages]);

  const persistPages = async (nextPages) => {
    const normalizedPages = nextPages.map((page) => normalizePage(page));
    const updates = new Map(normalizedPages.map((page) => [String(page.id), page]));
    setPages((current) => current.map((page) => updates.get(String(page.id)) || page));
    setFormPage((current) => updates.get(String(current.id)) || current);
    for (const nextPage of normalizedPages) {
      await savePage({ preventDefault() {} }, nextPage);
    }
  };

  const addPageToMenu = (page) => {
    const nextOrder = activeMenuPages.reduce((maxOrder, item) => Math.max(maxOrder, Number(item.menuOrder || 0)), 0) + 1;
    return persistPages([{ ...page, menu: activeGroup, parentSlug: "", menuOrder: nextOrder }]);
  };
  const removeFromMenu = (page) => persistPages([{ ...page, menu: "", parentSlug: "", menuOrder: 1 }]);
  const updateMenuField = (page, field, value) => {
    if (field === "parentSlug" && value === page.slug) return;
    return persistPages([{ ...page, [field]: field === "menuOrder" ? Math.max(1, Number(value || 1)) : value }]);
  };
  const moveMenuPage = (page, direction) => {
    const siblings = activeMenuPages
      .filter((item) => String(item.parentSlug || "") === String(page.parentSlug || ""))
      .sort((a, b) => Number(a.menuOrder || 0) - Number(b.menuOrder || 0));
    const pageIndex = siblings.findIndex((item) => String(item.id) === String(page.id));
    const swapIndex = direction === "up" ? pageIndex - 1 : pageIndex + 1;
    if (pageIndex < 0 || swapIndex < 0 || swapIndex >= siblings.length) return;
    const swapPage = siblings[swapIndex];
    return persistPages([
      { ...page, menuOrder: Number(swapPage.menuOrder || swapIndex + 1) },
      { ...swapPage, menuOrder: Number(page.menuOrder || pageIndex + 1) }
    ]);
  };

  return (
    <section className="admin-view menu-builder-view">
      <div className="view-header">
        <div>
          <span className="eyebrow">Navigation Builder</span>
          <h2>Manage Website Menus</h2>
          <p>Add pages into menus, set parent-child relationships, reorder items, and remove pages from navigation without touching their page content.</p>
        </div>
        <div className="view-stat-card">
          <ListChecks size={22} />
          <strong>{activeMenuPages.length}</strong>
          <span>Items in {activeGroup || "menu"}</span>
        </div>
      </div>

      <div className="view-content menu-builder-grid">
        <section className="panel menu-builder-panel">
          <div className="panel-head">
            <div><span className="eyebrow">Menu Group</span><h2>Current Navigation</h2></div>
          </div>
          <div className="menu-select-row">
            <Field label="Select Menu">
              <select value={activeGroup} onChange={(event) => setActiveGroup(event.target.value)}>
                {selectableGroups.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}
              </select>
            </Field>
            <span className="menu-builder-live-note">Changes save directly to the database.</span>
          </div>

          <div className="menu-builder-list">
            {activeMenuPages.map((page) => {
              const siblings = activeMenuPages
                .filter((item) => String(item.parentSlug || "") === String(page.parentSlug || ""))
                .sort((a, b) => Number(a.menuOrder || 0) - Number(b.menuOrder || 0));
              const siblingIndex = siblings.findIndex((item) => String(item.id) === String(page.id));
              return (
                <article className="menu-builder-item" key={page.id}>
                  <div className="menu-builder-item-head">
                    <div><strong>{page.title}</strong><small>/{page.slug}</small></div>
                    <div className="table-actions">
                      <button className="icon-button" type="button" aria-label="Edit page" onClick={() => openPageEditorTab(page.id, "content")}><Pencil size={16} /></button>
                      <button className="icon-button" type="button" aria-label="Open builder" onClick={() => openPageEditorTab(page.id, "builder")}><ListTree size={16} /></button>
                      <button className="icon-button danger" type="button" aria-label="Remove from menu" onClick={() => removeFromMenu(page)}><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <div className="field-grid menu-builder-fields">
                    <Field label="Parent Page">
                      <select value={page.parentSlug || ""} onChange={(event) => updateMenuField(page, "parentSlug", event.target.value)}>
                        <option value="">Top level page</option>
                        {rootPages.filter((item) => String(item.id) !== String(page.id)).map((item) => (
                          <option key={item.id} value={item.slug}>{item.title}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Menu Order">
                      <input type="number" min="1" value={page.menuOrder || 1} onChange={(event) => updateMenuField(page, "menuOrder", event.target.value)} />
                    </Field>
                  </div>
                  <div className="menu-builder-row-actions">
                    <button type="button" className="ghost-button" onClick={() => moveMenuPage(page, "up")} disabled={siblingIndex <= 0}><ArrowUp size={16} /><span>Move Up</span></button>
                    <button type="button" className="ghost-button" onClick={() => moveMenuPage(page, "down")} disabled={siblingIndex === -1 || siblingIndex >= siblings.length - 1}><ArrowDown size={16} /><span>Move Down</span></button>
                  </div>
                </article>
              );
            })}
            {!activeMenuPages.length && (
              <div className="empty-state"><ListChecks size={24} /><strong>No pages linked to this menu</strong><span>Add pages from the right panel to start building this navigation group.</span></div>
            )}
          </div>
        </section>

        <section className="panel menu-builder-panel">
          <div className="panel-head"><div><span className="eyebrow">Available Pages</span><h2>Add or Move Pages</h2></div></div>
          <div className="search-wrap">
            <label className="search-field no-margin"><Search size={16} /><input value={availableQuery} onChange={(event) => setAvailableQuery(event.target.value)} placeholder="Search pages to add" /></label>
          </div>
          <div className="menu-builder-list">
            {availablePages.map((page) => (
              <article className="menu-builder-item compact" key={page.id}>
                <div className="menu-builder-item-head">
                  <div><strong>{page.title}</strong><small>/{page.slug}</small></div>
                  <button className="ghost-button" type="button" onClick={() => addPageToMenu(page)}><Plus size={16} /><span>{page.menu ? `Move to ${activeGroup}` : `Add to ${activeGroup}`}</span></button>
                </div>
                <span className="menu-builder-meta">{page.menu ? `Currently in ${getMenuReferenceLabel(page, pages)}` : "Not currently linked to any menu"}</span>
              </article>
            ))}
            {!availablePages.length && (
              <div className="empty-state"><FileText size={24} /><strong>All pages are already assigned</strong><span>Use the left panel to reorder or remove menu items.</span></div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
