import { useMemo } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Plus, Save, Trash2 } from "lucide-react";
import { Field } from "../components/Common";

export default function SiteChromeView({
  kind,
  page,
  config,
  snippetHtml,
  statusOptions = [],
  openSiteChromeView,
  updateField,
  updateHtml,
  savePage,
  parseHeaderVisualModel,
  updateHeaderHtmlFromVisualModel,
  buildSiteChromePreviewDocument
}) {
  const sourcePath = page.sourceUrl || page.source_url || config.sourceUrl;
  const statusLabel = page.status || "Draft";
  const isSavedStatus = String(statusLabel).toLowerCase() === "published";
  const visualHeaderModel = useMemo(() => parseHeaderVisualModel(snippetHtml), [parseHeaderVisualModel, snippetHtml]);

  const commitVisualHeaderModel = (updater) => {
    if (kind !== "header") {
      return;
    }
    const nextModel = typeof updater === "function" ? updater(visualHeaderModel) : updater;
    updateHtml(kind, updateHeaderHtmlFromVisualModel(snippetHtml, nextModel));
  };

  const updateHeaderMenuItem = (itemId, field, value) => {
    commitVisualHeaderModel((current) => ({
      ...current,
      menuItems: current.menuItems.map((item) => (item.id === itemId ? { ...item, [field]: value } : item))
    }));
  };

  const moveHeaderMenuItem = (itemId, direction) => {
    commitVisualHeaderModel((current) => {
      const items = [...current.menuItems];
      const index = items.findIndex((item) => item.id === itemId);
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || targetIndex < 0 || targetIndex >= items.length) {
        return current;
      }
      const [moved] = items.splice(index, 1);
      items.splice(targetIndex, 0, moved);
      return { ...current, menuItems: items };
    });
  };

  const removeHeaderMenuItem = (itemId) => {
    commitVisualHeaderModel((current) => ({
      ...current,
      menuItems: current.menuItems.filter((item) => item.id !== itemId)
    }));
  };

  const addHeaderMenuItem = () => {
    commitVisualHeaderModel((current) => ({
      ...current,
      menuItems: [
        ...current.menuItems,
        {
          id: `header-menu-added-${Date.now()}`,
          sourceIndex: current.menuItems.length,
          title: "New Menu Item",
          href: "#",
          isMega: false,
          children: []
        }
      ]
    }));
  };

  const updateHeaderChildItem = (itemId, childId, field, value) => {
    commitVisualHeaderModel((current) => ({
      ...current,
      menuItems: current.menuItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              children: item.children.map((child) => (child.id === childId ? { ...child, [field]: value } : child))
            }
          : item
      )
    }));
  };

  const addHeaderChildItem = (itemId) => {
    commitVisualHeaderModel((current) => ({
      ...current,
      menuItems: current.menuItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              children: [
                ...(item.children || []),
                {
                  id: `header-child-added-${Date.now()}-${itemId}`,
                  title: "New Dropdown Item",
                  href: "#"
                }
              ]
            }
          : item
      )
    }));
  };

  const removeHeaderChildItem = (itemId, childId) => {
    commitVisualHeaderModel((current) => ({
      ...current,
      menuItems: current.menuItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              children: item.children.filter((child) => child.id !== childId)
            }
          : item
      )
    }));
  };

  const moveHeaderChildItem = (itemId, childId, direction) => {
    commitVisualHeaderModel((current) => ({
      ...current,
      menuItems: current.menuItems.map((item) => {
        if (item.id !== itemId) return item;
        const children = [...(item.children || [])];
        const index = children.findIndex((child) => child.id === childId);
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (index < 0 || targetIndex < 0 || targetIndex >= children.length) {
          return item;
        }
        const [moved] = children.splice(index, 1);
        children.splice(targetIndex, 0, moved);
        return { ...item, children };
      })
    }));
  };

  const updateHeaderCta = (field, value) => {
    commitVisualHeaderModel((current) => ({
      ...current,
      [field]: value
    }));
  };

  return (
    <section className="site-chrome-shell">
      <div className="site-chrome-banner">
        <div className="site-chrome-banner-copy">
          <CheckCircle2 size={18} />
          <span>Editing website {kind} content.</span>
        </div>
        <div className="site-chrome-tabs">
          <button type="button" className={kind === "header" ? "active" : ""} onClick={() => openSiteChromeView("header")}>
            Header
          </button>
          <button type="button" className={kind === "footer" ? "active" : ""} onClick={() => openSiteChromeView("footer")}>
            Footer
          </button>
        </div>
      </div>

      <div className="site-chrome-grid">
        <form className="panel site-chrome-editor" onSubmit={(event) => savePage(event, kind)}>
          <div className="panel-head site-chrome-panel-head">
            <div>
              <span className="eyebrow">Global Layout</span>
              <h2>Header & Footer</h2>
            </div>
            <span className={`badge ${isSavedStatus ? "" : "draft"}`}>{statusLabel}</span>
          </div>

          <div className="site-chrome-fields">
            <p className="site-chrome-hint">
              Edit the global {kind} HTML here. Saving creates or updates the active CRM page with slug <code>{config.slug}</code>.
            </p>

            <div className="field-grid">
              <Field label="Title">
                <input value={page.title} onChange={(event) => updateField("title", event.target.value)} />
              </Field>
              <Field label="Status">
                <select value={page.status} onChange={(event) => updateField("status", event.target.value)}>
                  {statusOptions.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </Field>
              <Field label="Source Path">
                <input value={sourcePath} onChange={(event) => updateField("sourceUrl", event.target.value)} />
              </Field>
              <Field label="Slug">
                <input value={page.slug} readOnly />
              </Field>
            </div>

            <Field label="Summary">
              <textarea rows="3" value={page.summary} onChange={(event) => updateField("summary", event.target.value)} />
            </Field>

            {kind === "header" && (
              <div className="site-chrome-visual-editor">
                <div className="site-chrome-editor-label">
                  <strong>Visual Header Builder</strong>
                  <small>{visualHeaderModel.menuItems.length} main items</small>
                </div>
                <p className="site-chrome-hint">
                  Edit the live header menu visually. Special mega-menu items are preserved, while standard menu items and dropdowns can be changed directly.
                </p>

                <div className="site-chrome-cta-grid">
                  <Field label="Header CTA Label">
                    <input value={visualHeaderModel.ctaLabel} onChange={(event) => updateHeaderCta("ctaLabel", event.target.value)} />
                  </Field>
                  <Field label="Header CTA URL">
                    <input value={visualHeaderModel.ctaUrl} onChange={(event) => updateHeaderCta("ctaUrl", event.target.value)} />
                  </Field>
                </div>

                <div className="site-chrome-menu-list">
                  {visualHeaderModel.menuItems.map((item, index) => (
                    <div className="site-chrome-menu-card" key={item.id}>
                      <div className="site-chrome-menu-card-head">
                        <div>
                          <strong>{item.title || `Menu Item ${index + 1}`}</strong>
                          <small>{item.isMega ? "Mega menu preserved" : item.children.length ? "Dropdown menu" : "Single link"}</small>
                        </div>
                        <div className="site-chrome-menu-actions">
                          <button className="ghost-button" type="button" onClick={() => moveHeaderMenuItem(item.id, "up")} disabled={index === 0}>
                            <ChevronUp size={16} />
                            <span>Up</span>
                          </button>
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => moveHeaderMenuItem(item.id, "down")}
                            disabled={index === visualHeaderModel.menuItems.length - 1}
                          >
                            <ChevronDown size={16} />
                            <span>Down</span>
                          </button>
                          {!item.isMega && (
                            <button className="danger-button" type="button" onClick={() => removeHeaderMenuItem(item.id)}>
                              <Trash2 size={16} />
                              <span>Remove</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="field-grid">
                        <Field label="Label">
                          <input value={item.title} onChange={(event) => updateHeaderMenuItem(item.id, "title", event.target.value)} />
                        </Field>
                        <Field label="URL">
                          <input value={item.href} onChange={(event) => updateHeaderMenuItem(item.id, "href", event.target.value)} />
                        </Field>
                      </div>

                      {item.isMega ? (
                        <div className="site-chrome-locked-note">
                          <CheckCircle2 size={15} />
                          <span>This item keeps the existing Programs mega-menu structure. Only its label and URL are edited here.</span>
                        </div>
                      ) : (
                        <div className="site-chrome-children">
                          <div className="site-chrome-children-head">
                            <strong>Dropdown Items</strong>
                            <button className="ghost-button" type="button" onClick={() => addHeaderChildItem(item.id)}>
                              <Plus size={16} />
                              <span>Add Child</span>
                            </button>
                          </div>
                          {(item.children || []).map((child, childIndex) => (
                            <div className="site-chrome-child-row" key={child.id}>
                              <input
                                value={child.title}
                                onChange={(event) => updateHeaderChildItem(item.id, child.id, "title", event.target.value)}
                                placeholder="Child label"
                              />
                              <input
                                value={child.href}
                                onChange={(event) => updateHeaderChildItem(item.id, child.id, "href", event.target.value)}
                                placeholder="Child URL"
                              />
                              <button
                                className="icon-button"
                                type="button"
                                aria-label="Move child up"
                                onClick={() => moveHeaderChildItem(item.id, child.id, "up")}
                                disabled={childIndex === 0}
                              >
                                <ChevronUp size={16} />
                              </button>
                              <button
                                className="icon-button"
                                type="button"
                                aria-label="Move child down"
                                onClick={() => moveHeaderChildItem(item.id, child.id, "down")}
                                disabled={childIndex === item.children.length - 1}
                              >
                                <ChevronDown size={16} />
                              </button>
                              <button
                                className="icon-button danger"
                                type="button"
                                aria-label="Remove child"
                                onClick={() => removeHeaderChildItem(item.id, child.id)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                          {!item.children.length && <div className="site-chrome-empty-note">This menu item currently has no dropdown children.</div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="site-chrome-builder-footer">
                  <button className="ghost-button" type="button" onClick={addHeaderMenuItem}>
                    <Plus size={16} />
                    <span>Add Main Menu Item</span>
                  </button>
                </div>
              </div>
            )}

            <div className="site-chrome-editor-block">
              <div className="site-chrome-editor-label">
                <strong>{config.title} HTML</strong>
                <small>{snippetHtml.length} characters</small>
              </div>
              <textarea
                className="site-chrome-textarea"
                rows="22"
                value={snippetHtml}
                onChange={(event) => updateHtml(kind, event.target.value)}
                placeholder={`Paste ${config.title.toLowerCase()} markup here`}
              />
            </div>

            <div className="site-chrome-footer">
              <div className="site-chrome-save-note">
                {isSavedStatus ? <CheckCircle2 size={15} /> : <Save size={15} />}
                <span>{isSavedStatus ? "Published content loaded." : "Changes are in draft state until you save."}</span>
              </div>
              <button className="primary-button site-chrome-save" type="submit">
                <Save size={17} />
                <span>Save {kind === "header" ? "Header" : "Footer"}</span>
              </button>
            </div>
          </div>
        </form>

        <div className="site-chrome-preview-col">
          <div className="panel site-chrome-preview-panel">
            <div className="panel-head compact site-chrome-panel-head">
              <div>
                <span className="eyebrow">Live Preview</span>
                <h2>{config.title}</h2>
              </div>
              <span className={`badge ${isSavedStatus ? "" : "draft"}`}>{isSavedStatus ? "Published" : "Draft"}</span>
            </div>

            <div className="website-preview website-preview-html site-chrome-preview">
              <div className="preview-html-head site-chrome-preview-head">
                <div>
                  <span className="eyebrow">Snippet Canvas</span>
                  <h3>{config.title}</h3>
                </div>
                <small>{sourcePath}</small>
              </div>
              <iframe title={`${config.title} preview`} srcDoc={buildSiteChromePreviewDocument(kind, snippetHtml)} sandbox="" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
