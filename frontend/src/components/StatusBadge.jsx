const STATE_STYLES = {
  running: { color: 'text-running', bg: 'bg-running/15', dot: 'bg-running', pulse: false },
  starting: { color: 'text-accent', bg: 'bg-accent/15', dot: 'bg-accent', pulse: true },
  stopping: { color: 'text-warning', bg: 'bg-warning/15', dot: 'bg-warning', pulse: true },
  restarting: { color: 'text-accent', bg: 'bg-accent/15', dot: 'bg-accent', pulse: true },
  installing: { color: 'text-accent', bg: 'bg-accent/15', dot: 'bg-accent', pulse: true },
  crashed: { color: 'text-stopped', bg: 'bg-stopped/15', dot: 'bg-stopped', pulse: false },
  stopped: { color: 'text-text-secondary', bg: 'bg-surface3', dot: 'bg-text-muted', pulse: false }
};

export default function StatusBadge({ state }) {
  const style = STATE_STYLES[state] || STATE_STYLES.stopped;
  return (
    <span className={`status-badge ${style.color} ${style.bg}`}>
      <span className={`status-dot ${style.dot} ${style.pulse ? 'animate-pulseDot' : ''}`} />
      {state}
    </span>
  );
}
