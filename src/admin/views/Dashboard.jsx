import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Eye,
  FileText,
  Globe2,
  GraduationCap,
  MessageSquare,
  Plus,
  ShieldCheck
} from "lucide-react";

function TimelineItem({ label, detail, status }) {
  return (
    <div className="timeline-item">
      <span />
      <div>
        <strong>{label}</strong>
        <small>{detail}</small>
      </div>
      <em>{status}</em>
    </div>
  );
}

export default function Dashboard({
  pages,
  stats,
  getThumbnail,
  onCreateNewPage,
  onOpenPages,
  onOpenPrograms,
  onOpenBlogs,
  onOpenRecentPage
}) {
  const recentPages = [...pages]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 4);

  const contentHealth = [
    { label: "Published Pages", value: stats.published, icon: Globe2, tone: "blue" },
    { label: "Review Queue", value: stats.review, icon: ClipboardList, tone: "gold" },
    { label: "Scheduled", value: stats.scheduled, icon: CalendarDays, tone: "green" },
    { label: "SEO Score", value: `${stats.averageSeo}%`, icon: BarChart3, tone: "navy" }
  ];

  const moduleActions = [
    { icon: GraduationCap, label: "Programs", value: "Undergraduate, graduate, PhD", onClick: onOpenPrograms },
    { icon: BookOpen, label: "Admissions", value: "Requirements, forms, scholarships", onClick: onOpenPages },
    { icon: MessageSquare, label: "Blog and Events", value: "Announcements and research updates", onClick: onOpenBlogs },
    { icon: ShieldCheck, label: "Approvals", value: "Draft, review, scheduled, publish", onClick: onOpenPages }
  ].filter((item) => typeof item.onClick === "function");

  return (
    <section className="dashboard-grid">
      <div className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Website Control Center</span>
          <h2>Manage MWU pages with the same academic, blue, gold, and green visual language.</h2>
          <p>
            Create pages, prepare homepage sections, review content quality, and preview how each page will appear on the public website.
          </p>
          <div className="hero-actions">
            {onCreateNewPage && (
              <button className="primary-button" type="button" onClick={onCreateNewPage}>
                <Plus size={17} />
                <span>Add Page</span>
              </button>
            )}
            {onOpenPages && (
              <button className="ghost-button light" type="button" onClick={onOpenPages}>
                <FileText size={17} />
                <span>Manage Pages</span>
              </button>
            )}
          </div>
        </div>
        <div className="hero-stat-stack">
          <span>16320+</span>
          <strong>Students signal from the public site</strong>
          <i />
          <span>79</span>
          <strong>Programs and departments managed</strong>
        </div>
      </div>

      <div className="metric-grid">
        {contentHealth.map((item) => {
          const Icon = item.icon;
          return (
            <button className={`metric-card ${item.tone}`} key={item.label} type="button" onClick={onOpenPages} disabled={!onOpenPages}>
              <Icon size={20} />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </button>
          );
        })}
      </div>

      <section className="panel span-two">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Content Pipeline</span>
            <h2>Recent Website Pages</h2>
          </div>
          {onOpenPages && (
            <button className="ghost-button" type="button" onClick={onOpenPages}>
              <Eye size={17} />
              <span>Open Pages</span>
            </button>
          )}
        </div>

        <div className="recent-grid">
          {recentPages.map((page) => (
            <button
              className="recent-card"
              type="button"
              key={page.id}
              onClick={() => onOpenRecentPage(page)}
            >
              <img src={getThumbnail(page)} alt="" />
              <span className={`status-badge ${page.status.toLowerCase()}`}>{page.status}</span>
              <strong>{page.title}</strong>
              <small>{page.menu} / {page.type}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head compact">
          <div>
            <span className="eyebrow">Modules</span>
            <h2>Website Sections</h2>
          </div>
        </div>
        <div className="module-list">
          {moduleActions.map((item) => (
            <button className="module-row button-row" key={item.label} type="button" onClick={item.onClick}>
              <item.icon size={18} />
              <div>
                <strong>{item.label}</strong>
                <span>{item.value}</span>
              </div>
              <ChevronRight size={17} />
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head compact">
          <div>
            <span className="eyebrow">Publishing</span>
            <h2>Queue</h2>
          </div>
        </div>
        <div className="timeline">
          <TimelineItem label="Review homepage hero" detail="Content Office" status="Today" />
          <TimelineItem label="Publish admission requirements" detail="Admissions Office" status="Scheduled" />
          <TimelineItem label="Update program media" detail="College of Agriculture" status="Pending" />
        </div>
      </section>
    </section>
  );
}
