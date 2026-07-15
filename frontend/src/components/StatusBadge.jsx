const STATE_STYLES = {
  running: { color: 'text-running', bg: 'bg-running/10', dot: 'bg-running' },
  starting: { color: 'text-info', bg: 'bg-info/10', dot: 'bg-info' },
  stopping: { color: 'text-warning', bg: 'bg-warning/10', dot: 'bg-warning' },
  restarting: { color: 'text-info', bg: 'bg-info/10', dot: 'bg-info' },
  installing: { color: 'text-info', bg: 'bg-info/10', dot: 'bg-info' },
  crashed: { color: 'text-stopped', bg: 'bg-stopped/10', dot: 'bg-stopped' },
  stopped: { color: 'text-text-secondary', bg: 'bg-text-secondary/10', dot: 'bg-text-secondary' }
};

export default function StatusBadge({ state }) {
  const style = STATE_STYLES[state] || STATE_STYLES.stopped;
  return (
    <span className={`status-badge ${style.color} ${style.bg}`}>
      <span className={`status-dot ${style.dot}`} />
      {state}
    </span>
  );
}
