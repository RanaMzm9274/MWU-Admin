import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";

export default function AdminSidebar({
  logoSrc,
  mobileOpen,
  collapsed,
  navItems,
  activeView,
  stats,
  onToggle,
  onNavigate,
  onLogout
}) {
  return (
    <aside className={`sidebar ${mobileOpen ? "open" : ""} ${collapsed ? "collapsed" : ""}`}>
      <div className="brand">
        <img src={logoSrc} alt="Madda Walabu University" />
        <button
          className="icon-button nav-close"
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="main-nav" aria-label="CRM navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={activeView === item.id ? "active" : ""}
              title={item.label}
              aria-label={item.label}
              onClick={() => onNavigate(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        {/* <div className="sidebar-panel">
          <span>Website Status</span>
          <strong>Live content sync</strong>
          <p>{stats.published} published pages, {stats.review} in review.</p>
          <div className="mini-meter">
            <i style={{ width: `${Math.min(stats.averageSeo, 100)}%` }} />
          </div>
        </div> */}
        <button className="sidebar-logout" type="button" onClick={onLogout} title="Logout" aria-label="Logout">
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
