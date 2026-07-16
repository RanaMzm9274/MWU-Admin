import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Copy, GripVertical, LayoutTemplate, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { Field } from "../components/Common";

export default function BuilderView({
  page,
  setActiveView,
  updateField,
  updateSection,
  addSection,
  duplicateSection,
  moveSection,
  removeSection,
  savePage,
  sectionTypes,
  layoutOptions,
  defaultPageStyles,
  getSectionStyles,
  getPageStyles,
  toCssUnit,
  renderPreview
}) {
  const [activeBlockId, setActiveBlockId] = useState(page.sections[0]?.id || "");
  const [sidebarMode, setSidebarMode] = useState("elements");
  const [inspectorTab, setInspectorTab] = useState("content");
  const [devicePreview, setDevicePreview] = useState("desktop");
  const activeBlock = page.sections.find((section) => section.id === activeBlockId) || page.sections[0];
  const activeBlockStyles = getSectionStyles(activeBlock);
  const pageStyles = getPageStyles(page);

  const updateBlockStyle = (field, value) => {
    if (activeBlock) updateSection(activeBlock.id, "styles", { ...activeBlockStyles, [field]: value });
  };
  const applySectionPreset = (preset) => {
    if (!activeBlock) return;
    const presets = {
      clean: { backgroundColor: "#ffffff", textColor: "#667085", headingColor: "#081933", paddingTop: "56", paddingBottom: "56", shadow: false },
      spotlight: { backgroundColor: "#eff6ff", textColor: "#344054", headingColor: "#081933", paddingTop: "72", paddingBottom: "72", shadow: true },
      dark: { backgroundColor: "#081933", textColor: "#eaf1f7", headingColor: "#ffffff", paddingTop: "72", paddingBottom: "72", shadow: true },
      gold: { backgroundColor: "#fff8e6", textColor: "#4f3b12", headingColor: "#081933", accentColor: "#d6a128", paddingTop: "60", paddingBottom: "60", shadow: false }
    };
    updateSection(activeBlock.id, "styles", { ...activeBlockStyles, ...(presets[preset] || presets.clean) });
  };

  useEffect(() => {
    if (!page.sections.some((section) => section.id === activeBlockId)) setActiveBlockId(page.sections[0]?.id || "");
  }, [activeBlockId, page.id, page.sections]);
  useEffect(() => {
    setSidebarMode("elements");
    setInspectorTab("content");
    setDevicePreview("desktop");
  }, [page.id]);

  return (
    <form className="builder-pro builder-studio" onSubmit={savePage}>
      <section className="builder-ui-head">
        <div className="builder-ui-crumb"><div className="builder-ui-mark">MW</div><div><span className="eyebrow">CRM Portal / Page Builder</span><h2>{page.title}</h2></div></div>
        <div className="builder-ui-actions">
          <button className="ghost-button" type="button" onClick={() => setActiveView("pages")}><Pencil size={16} /><span>Open Full Editor</span></button>
          <button className="primary-button" type="submit"><Save size={16} /><span>Save</span></button>
        </div>
      </section>

      <section className="builder-ui-shell">
        <aside className="builder-ui-sidebar">
          {sidebarMode === "elements" ? (
            <>
              <div className="builder-ui-panel-head">
                <div><span className="eyebrow">Elements</span><h3>Page Builder</h3><p className="panel-help">Add blocks, then select one on canvas to edit content and styling.</p></div>
                <button type="button" className="panel-mode-btn active" aria-label="Elements panel"><LayoutTemplate size={15} /></button>
              </div>
              <div className="builder-ui-widget-grid">
                {sectionTypes.map((type) => <button type="button" className="builder-ui-widget-card" key={type} onClick={() => addSection(type)}><div className="builder-ui-widget-icon"><LayoutTemplate size={16} /></div><span>{type}</span></button>)}
              </div>
              <div className="builder-ui-layers">
                <span className="eyebrow">Layers</span>
                <div className="navigator-panel">
                  {page.sections.map((section, index) => (
                    <button key={section.id} type="button" className={activeBlock?.id === section.id ? "active" : ""} onClick={() => { setActiveBlockId(section.id); setSidebarMode("style"); }}>
                      <GripVertical size={14} /><span>{index + 1}. {section.title || section.type}</span><small>{section.visible === false ? "Hidden" : section.type}</small>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="builder-ui-panel-head builder-ui-panel-head-style">
                <div><span className="eyebrow">{inspectorTab === "page" ? "Page Settings" : "Selected Block"}</span><h3>{inspectorTab === "page" ? page.title : activeBlock?.title || "Select a block"}</h3></div>
                <button type="button" className="panel-mode-btn" onClick={() => setSidebarMode("elements")} aria-label="Back to elements panel"><Plus size={15} /></button>
              </div>
              <div className="inspector-tabs builder-ui-tabs">
                {["content", "style", "advanced", "page"].map((tab) => <button key={tab} type="button" className={inspectorTab === tab ? "active" : ""} onClick={() => setInspectorTab(tab)}>{tab}</button>)}
              </div>
              {activeBlock && inspectorTab === "content" && (
                <div className="inspector-fields builder-ui-fields">
                  <Field label="Block Title"><input value={activeBlock.title || ""} onChange={(event) => updateSection(activeBlock.id, "title", event.target.value)} /></Field>
                  <Field label="Section Type"><select value={activeBlock.type} onChange={(event) => updateSection(activeBlock.id, "type", event.target.value)}>{sectionTypes.map((type) => <option key={type}>{type}</option>)}</select></Field>
                  <Field label="Layout"><select value={activeBlock.layout || "Text first"} onChange={(event) => updateSection(activeBlock.id, "layout", event.target.value)}>{layoutOptions.map((layout) => <option key={layout}>{layout}</option>)}</select></Field>
                  <Field label="Content"><textarea rows="5" value={activeBlock.body || ""} onChange={(event) => updateSection(activeBlock.id, "body", event.target.value)} /></Field>
                </div>
              )}
              {activeBlock && inspectorTab === "style" && (
                <div className="inspector-fields builder-ui-fields">
                  <div className="style-preset-grid">{["clean", "spotlight", "dark", "gold"].map((preset) => <button key={preset} type="button" onClick={() => applySectionPreset(preset)}>{preset}</button>)}</div>
                  <div className="field-grid one color-grid">
                    {[["backgroundColor", "Background Color", "#ffffff"], ["headingColor", "Heading Color", "#081933"], ["textColor", "Text Color", "#667085"], ["accentColor", "Accent Color", "#d6a128"]].map(([field, label, fallback]) => (
                      <Field label={label} key={field}><input type="color" value={activeBlockStyles[field] || fallback} onChange={(event) => updateBlockStyle(field, event.target.value)} /></Field>
                    ))}
                  </div>
                  <Field label="Text Alignment"><select value={activeBlockStyles.align || "left"} onChange={(event) => updateBlockStyle("align", event.target.value)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></Field>
                </div>
              )}
              {activeBlock && inspectorTab === "advanced" && (
                <div className="inspector-fields builder-ui-fields">
                  <div className="spacing-grid">
                    {[["paddingTop", "Padding Top"], ["paddingBottom", "Padding Bottom"], ["paddingLeft", "Padding Left"], ["paddingRight", "Padding Right"], ["gap", "Column Gap"], ["borderRadius", "Border Radius"]].map(([field, label]) => (
                      <Field label={label} key={field}><input value={activeBlockStyles[field] || ""} onChange={(event) => updateBlockStyle(field, event.target.value)} /></Field>
                    ))}
                  </div>
                  <label className="toggle-field"><input type="checkbox" checked={activeBlock.visible !== false} onChange={(event) => updateSection(activeBlock.id, "visible", event.target.checked)} /><span>Visible on website</span></label>
                </div>
              )}
              {inspectorTab === "page" && (
                <div className="inspector-fields builder-ui-fields">
                  <Field label="Page Title"><input value={page.title} onChange={(event) => updateField("title", event.target.value)} /></Field>
                  <Field label="Hero Headline"><textarea rows="4" value={page.heroHeadline || ""} onChange={(event) => updateField("heroHeadline", event.target.value)} /></Field>
                  <Field label="Page Background"><input type="color" value={pageStyles.backgroundColor || "#ffffff"} onChange={(event) => updateField("styles", { ...pageStyles, backgroundColor: event.target.value })} /></Field>
                  <Field label="Canvas Width"><input value={pageStyles.canvasWidth || ""} onChange={(event) => updateField("styles", { ...pageStyles, canvasWidth: event.target.value })} /></Field>
                </div>
              )}
            </>
          )}
        </aside>

        <section className="builder-ui-canvas">
          <div className="builder-ui-toolbar">
            <div><span className="eyebrow">Canvas</span><h3>{page.sections.length} Blocks</h3><small>Use the style tab to update visual settings for the selected block.</small></div>
            <div className="device-switcher">{["desktop", "tablet", "mobile"].map((device) => <button key={device} type="button" className={devicePreview === device ? "active" : ""} onClick={() => setDevicePreview(device)}>{device}</button>)}</div>
          </div>
          <div className={`builder-ui-page device-${devicePreview}`} style={{ maxWidth: toCssUnit(pageStyles.canvasWidth, defaultPageStyles.canvasWidth) }}>
            <div className="builder-ui-page-meta">
              <Field label="Page Title"><input value={page.title} onChange={(event) => updateField("title", event.target.value)} /></Field>
              <Field label="Hero Headline"><textarea rows="2" value={page.heroHeadline || ""} onChange={(event) => updateField("heroHeadline", event.target.value)} /></Field>
            </div>
            <div className="builder-stack standalone builder-ui-stack">
              {page.sections.map((section, index) => (
                <article className={`canvas-block builder-ui-block ${activeBlock?.id === section.id ? "active" : ""}`} role="button" tabIndex={0} key={section.id} onClick={() => { setActiveBlockId(section.id); setSidebarMode("style"); }}>
                  <div className="builder-ui-block-label">{index + 1}. {section.type}</div>
                  <span className="canvas-handle"><GripVertical size={16} />{index + 1}</span>
                  <img src={section.image || page.heroImage} alt="" />
                  <span className="canvas-copy"><small>{section.type}</small><strong>{section.title}</strong><em>{section.layout}</em></span>
                  <span className="canvas-actions">
                    <button type="button" onClick={(event) => { event.stopPropagation(); moveSection(section.id, "up"); }} disabled={index === 0}><ArrowUp size={15} /></button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); moveSection(section.id, "down"); }} disabled={index === page.sections.length - 1}><ArrowDown size={15} /></button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); duplicateSection(section.id); }}><Copy size={15} /></button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); removeSection(section.id); }}><Trash2 size={15} /></button>
                  </span>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="panel builder-preview">{renderPreview(page)}</section>
      </section>
    </form>
  );
}
