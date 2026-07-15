export default function ConfirmModal({ title, message, confirmLabel = 'Delete', danger = true, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[90] p-4">
      <div className="bg-surface1 border border-hairline-strong rounded-modal p-6 w-full max-w-sm">
        <h2 className="text-[15px] font-medium text-text-primary mb-2" style={{ fontWeight: 590 }}>{title}</h2>
        <p className="text-[13px] text-text-secondary mb-6">{message}</p>
        <div className="flex justify-end gap-2 border-t border-hairline pt-4">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className={danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
