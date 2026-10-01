import { useState } from "react";

interface Field {
  key: string;
  label: string;
  placeholder?: string;
}

interface Props {
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  extraFields?: Field[];
  onConfirm: (reason: string, extra: Record<string, string>) => Promise<void>;
  onClose: () => void;
}

// superadmin.md §1.5 — every write is audited with a mandatory reason. This
// is the one dialog every action button in the panel opens.
export function ReasonModal({ title, description, confirmLabel = "Confirm", danger, extraFields, onConfirm, onClose }: Props) {
  const [reason, setReason] = useState("");
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onConfirm(reason.trim(), extra);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-modal-backdrop" onClick={() => !busy && onClose()}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
        {extraFields?.map((f) => (
          <input
            key={f.key}
            placeholder={f.placeholder ?? f.label}
            value={extra[f.key] ?? ""}
            onChange={(e) => setExtra((s) => ({ ...s, [f.key]: e.target.value }))}
          />
        ))}
        <textarea rows={3} placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
        {error && <p style={{ color: "var(--a-red)", fontSize: 12.5, marginTop: -6, marginBottom: 10 }}>{error}</p>}
        <div className="admin-modal-actions">
          <button className="admin-btn ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className={`admin-btn ${danger ? "danger" : ""}`} onClick={submit} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
