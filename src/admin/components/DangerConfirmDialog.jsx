import { useEffect, useState } from "react";
import { X } from "lucide-react";

export default function DangerConfirmDialog({
  title,
  message,
  details = [],
  verificationText = "DELETE",
  continueLabel = "Continue",
  finalLabel = "Delete Permanently",
  onCancel,
  onConfirm
}) {
  const [step, setStep] = useState(1);
  const [typedValue, setTypedValue] = useState("");
  const normalizedVerification = String(verificationText || "DELETE").trim();

  useEffect(() => {
    setStep(1);
    setTypedValue("");
  }, [title, message, normalizedVerification]);

  const canConfirm = typedValue.trim() === normalizedVerification;

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
          <div>
            <span className="eyebrow">Double Verification</span>
            <h2 id="danger-dialog-title">{title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Close confirmation dialog">
            <X size={16} />
          </button>
        </div>

        <div className="danger-dialog-body">
          <p>{message}</p>
          {details.length > 0 && (
            <div className="danger-dialog-details">
              {details.map((detail) => (
                <div key={detail} className="danger-dialog-detail-row">
                  <span>{detail}</span>
                </div>
              ))}
            </div>
          )}

          <div className="danger-dialog-steps">
            <div className={`danger-step ${step >= 1 ? "active" : ""}`}>
              <strong>1</strong>
              <span>Review the deletion details</span>
            </div>
            <div className={`danger-step ${step >= 2 ? "active" : ""}`}>
              <strong>2</strong>
              <span>Type <code>{normalizedVerification}</code> to confirm</span>
            </div>
          </div>

          {step === 2 && (
            <label className="danger-dialog-input">
              <span>Verification text</span>
              <input
                value={typedValue}
                onChange={(event) => setTypedValue(event.target.value)}
                placeholder={normalizedVerification}
                autoFocus
              />
              <small>This action cannot be undone.</small>
            </label>
          )}
        </div>

        <div className="danger-dialog-actions">
          <button className="ghost-button" type="button" onClick={onCancel}>
            Cancel
          </button>
          {step === 1 ? (
            <button className="danger-button" type="button" onClick={() => setStep(2)}>
              {continueLabel}
            </button>
          ) : (
            <button className="danger-button" type="button" onClick={onConfirm} disabled={!canConfirm}>
              {finalLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
