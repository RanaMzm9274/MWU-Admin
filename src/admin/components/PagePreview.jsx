export default function PagePreview({
  page,
  logoSrc,
  getPageStyles,
  getLivePageUrl,
  getStoredEditableDocument,
  buildPreviewDocument,
  getSectionStyles,
  formatHtmlPreview,
  sectionCanvasStyle,
  slugify,
  toCssUnit,
  defaultSectionStyles
}) {
  const visibleSections = page.sections.filter((section) => section.visible !== false);
  const pageStyles = getPageStyles(page);
  const livePageUrl = getLivePageUrl(page);
  const storedDocument = getStoredEditableDocument(page);

  if (storedDocument.fullHtml) {
    return (
      <div className="website-preview website-preview-html">
        <div className="preview-html-head">
          <div><span className="eyebrow">Saved Website Preview</span><h3>{page.title}</h3></div>
          {livePageUrl ? <a className="ghost-button" href={livePageUrl} target="_blank" rel="noreferrer">Open</a> : <small>Stored in database</small>}
        </div>
        <iframe title={`${page.title} full HTML preview`} srcDoc={buildPreviewDocument(page)} sandbox="" />
      </div>
    );
  }

  if (livePageUrl) {
    return (
      <div className="website-preview website-preview-html exact-preview-panel">
        <div className="preview-html-head">
          <div><span className="eyebrow">Exact Website Preview</span><h3>{page.title}</h3></div>
          <a className="ghost-button" href={livePageUrl} target="_blank" rel="noreferrer">Open</a>
        </div>
        <iframe title={`${page.title} exact website preview`} src={livePageUrl} sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox" />
      </div>
    );
  }

  return (
    <div className="website-preview" style={{ background: pageStyles.backgroundColor }}>
      <header className="preview-header">
        <img src={logoSrc} alt="" />
        <nav><span>Home</span><span>About Us</span><span>Programs</span><span>Admissions</span></nav>
      </header>
      <section className="preview-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(8, 25, 51, 0.88), rgba(26, 75, 150, 0.64)), url(${page.heroImage})` }}>
        <div><span>{page.heroTag}</span><h3>{page.heroHeadline}</h3><p>{page.summary}</p><button type="button">{page.ctaLabel}</button></div>
        <div className="preview-hero-stats"><strong>16320+</strong><span>Active Students</span><strong>79</strong><span>Programs</span></div>
      </section>
      <section className="preview-feature-row">
        {["Networked Learning", "Integrated Research", "Community Service"].map((label, index) => (
          <article key={label}><span>{index + 1}</span><strong>{label}</strong><p>{visibleSections[index]?.title || "Managed from CRM content blocks."}</p></article>
        ))}
      </section>
      <section className="preview-about">
        <img src={page.heroImage} alt="" />
        <div><span>About This Page</span><h3>{page.title}</h3><p>{visibleSections[0]?.body || page.summary}</p><button type="button">Learn More</button></div>
      </section>
      <section className="preview-sections">
        {visibleSections.map((section) => {
          const styles = getSectionStyles(section);
          const isRawHtml = section.type === "Raw HTML" || section.layout === "Legacy HTML" || Boolean(section.html);
          if (isRawHtml) {
            return (
              <article className="preview-section-card preview-raw-html" key={section.id}>
                <span>{section.type}</span><h4>{section.title}</h4>
                <iframe title={`${section.title} raw HTML preview`} srcDoc={buildPreviewDocument({ title: section.title, bodyHtml: formatHtmlPreview(section.html), styles: pageStyles })} sandbox="" />
              </article>
            );
          }
          return (
            <article className={`preview-section-card ${slugify(section.type)}`} style={sectionCanvasStyle(section)} key={section.id}>
              {["Program Grid", "Image Gallery", "Testimonials", "Events List"].includes(section.type) && (
                <img style={{ borderRadius: toCssUnit(styles.imageRadius, defaultSectionStyles.imageRadius) }} src={section.image || page.heroImage} alt="" />
              )}
              <span style={{ color: styles.accentColor }}>{section.type}</span>
              <h4 style={{ color: styles.headingColor }}>{section.title}</h4>
              {["Feature Cards", "Program Grid", "Stats Strip", "FAQ"].includes(section.type) ? (
                <div className="preview-chip-grid">
                  {String(section.body).split("|").map((item) => item.trim()).filter(Boolean).map((item) => <small key={item}>{item}</small>)}
                </div>
              ) : <p style={{ color: styles.textColor }}>{section.body}</p>}
              {section.ctaLabel && <button type="button">{section.ctaLabel}</button>}
            </article>
          );
        })}
      </section>
    </div>
  );
}
