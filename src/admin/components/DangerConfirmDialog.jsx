import { useEffect, useState } from "react";
import { Database, FileText, Link2, Trash2, X } from "lucide-react";

export default function DangerConfirmDialog({
  title,
  message,
  details = [],
  verificationText = "DELETE",
  finalLabel = "Delete Permanently",
  onCancel,
  onConfirm
}) {
  const [typedValue, setTypedValue] = useState("");
  const normalizedVerification = String(verificationText || "DELETE").trim();

  useEffect(() => {
    setTypedValue("");
  }, [title, message, normalizedVerification]);

  const canConfirm = typedValue.trim() === normalizedVerification;
  const detailIcons = [FileText, Link2, Database];
  const detailRows = details.map((detail, index) => {
    const [rawLabel, ...valueParts] = String(detail).split(":");
    const hasLabel = valueParts.length > 0;
    return {
      label: hasLabel ? rawLabel.trim() : `Detail ${index + 1}`,
      value: hasLabel ? valueParts.join(":").trim() : detail,
      Icon: detailIcons[index] || FileText
    };
  });

  return (
    <div className="danger-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="danger-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="danger-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="danger-dialog-head">
          <span className="danger-dialog-symbol" aria-hidden="true"><Trash2 size={22} /></span>
          <div className="danger-dialog-heading">
            <h2 id="danger-dialog-title">{title}</h2>
            <p>{message}</p>
          </div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Close confirmation dialog">
            <X size={16} />
          </button>
        </div>

        <div className="danger-dialog-body">
          {detailRows.length > 0 && (
            <section className="danger-dialog-section">
              <span className="danger-dialog-section-label">Page details</span>
              <div className="danger-dialog-details">
                {detailRows.map(({ label, value, Icon }) => (
                  <div key={`${label}-${value}`} className="danger-dialog-detail-row">
                    <Icon size={19} />
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="danger-dialog-section danger-dialog-confirmation">
            <label className="danger-dialog-input">
              <span>To confirm, type the {normalizedVerification.includes("-") ? "slug" : "text"} below</span>
              <div>
                <small>Type</small>
                <input
                  value={typedValue}
                  onChange={(event) => setTypedValue(event.target.value)}
                  placeholder={normalizedVerification}
                  autoFocus
                />
              </div>
            </label>
          </section>
        </div>

        <div className="danger-dialog-actions">
          <button className="ghost-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="danger-button" type="button" onClick={onConfirm} disabled={!canConfirm}>
            {finalLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
