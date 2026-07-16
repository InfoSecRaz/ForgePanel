export default function FieldBadges({ field }) {
  if (!field.readonly && !field.requiresRestart) return null;

  return (
    <span className="inline-flex gap-1 ml-1.5 align-middle">
      {field.readonly && (
        <span className="status-badge bg-surface2 text-text-muted border border-hairline" style={{ fontSize: '10px' }}>
          READ ONLY
        </span>
      )}
      {field.requiresRestart && (
        <span className="status-badge bg-warning/15 text-warning" style={{ fontSize: '10px' }}>
          RESTART REQUIRED
        </span>
      )}
    </span>
  );
}
