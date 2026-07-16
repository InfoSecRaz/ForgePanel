import { useState } from 'react';

export default function ConfirmModal({ title, message, confirmLabel = 'Delete', danger = true, confirmText, warning, onConfirm, onCancel }) {
  const [typed, setTyped] = useState('');
  const locked = confirmText !== undefined && typed !== confirmText;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[90] p-4">
      <div className="bg-surface1 border border-hairline-strong rounded-modal p-6 w-full max-w-sm">
        <h2 className="text-[15px] font-medium text-text-primary mb-2" style={{ fontWeight: 590 }}>{title}</h2>
        <p className="text-[13px] text-text-secondary mb-4">{message}</p>

        {warning && (
          <p className="text-[13px] text-warning mb-4">{warning}</p>
        )}

        {confirmText !== undefined && (
          <div className="mb-4">
            <label className="field-label">Type "{confirmText}" to confirm</label>
            <input className="input" autoFocus autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-hairline pt-4">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className={danger ? 'btn btn-danger' : 'btn btn-primary'} disabled={locked} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
