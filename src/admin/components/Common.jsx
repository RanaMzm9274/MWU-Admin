import { LayoutDashboard, ListChecks } from "lucide-react";

export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function StatusPill({ status }) {
  return <span className={`status-badge ${status.toLowerCase()}`}>{status}</span>;
}

export function CheckItem({ done, label }) {
  return (
    <div className={done ? "check-item done" : "check-item"}>
      <span aria-hidden="true">{done ? "✓" : "○"}</span>
      <span>{label}</span>
    </div>
  );
}

export function ViewModeToggle({ value = "grid", onChange }) {
  return (
    <div className="view-mode-toggle" role="group" aria-label="View mode toggle">
      <button
        type="button"
        className={value === "list" ? "active" : ""}
        onClick={() => onChange("list")}
        aria-pressed={value === "list"}
      >
        <ListChecks size={16} />
        <span>List</span>
      </button>
      <button
        type="button"
        className={value === "grid" ? "active" : ""}
        onClick={() => onChange("grid")}
        aria-pressed={value === "grid"}
      >
        <LayoutDashboard size={16} />
        <span>Grid</span>
      </button>
    </div>
  );
}
