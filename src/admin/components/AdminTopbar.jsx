import { Bell, PanelLeftOpen, Plus } from "lucide-react";

export default function AdminTopbar({ canCreatePages, onOpenSidebar, onCreatePage }) {
  return (
    <header className="topbar">
      <button className="icon-button mobile-toggle" type="button" onClick={onOpenSidebar} aria-label="Open sidebar">
        <PanelLeftOpen size={19} />
      </button>
      <div>
        <span className="eyebrow">Madda Walabu University</span>
        <h1>CRM Portal</h1>
      </div>
      <div className="topbar-actions">
        <button className="ghost-button" type="button">
          <Bell size={17} />
          <span>Alerts</span>
        </button>
        {canCreatePages && (
          <button className="primary-button" type="button" onClick={onCreatePage}>
            <Plus size={17} />
            <span>Add Page</span>
          </button>
        )}
      </div>
    </header>
  );
}
