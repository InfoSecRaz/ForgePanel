import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../lib/api';
import { useToast } from '../../lib/ToastContext';
import ConfirmModal from '../../components/ConfirmModal';

const TYPES = ['restart', 'backup', 'command', 'update_check'];

const CRON_EXAMPLES = [
  ['* * * * *', 'Every minute'],
  ['*/5 * * * *', 'Every 5 minutes'],
  ['0 * * * *', 'Every hour'],
  ['0 */6 * * *', 'Every 6 hours'],
  ['0 2 * * *', 'Every day at 2am'],
  ['0 2 * * 0', 'Every Sunday at 2am'],
  ['0 2 1 * *', '1st of every month at 2am']
];

const CRON_SPECIAL_CHARS = [
  ['*', 'Any value'],
  [',', 'Value list separator (1,3,5)'],
  ['-', 'Range of values (1-5)'],
  ['/', 'Step values (*/5)']
];

export default function Tasks({ server }) {
  const [tasks, setTasks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('restart');
  const [cronExpression, setCronExpression] = useState('0 4 * * *');
  const [command, setCommand] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showCheatsheet, setShowCheatsheet] = useState(false);
  const toast = useToast();

  function load() {
    api.get(`/servers/${server.id}/tasks`).then(setTasks).catch((err) => toast.error(err.message));
  }

  useEffect(() => { load(); }, [server.id]);

  async function createTask() {
    try {
      await api.post(`/servers/${server.id}/tasks`, {
        name,
        type,
        cronExpression,
        payload: type === 'command' ? { command } : undefined
      });
      setShowForm(false);
      setName('');
      toast.success('Task created');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function toggleEnabled(task) {
    try {
      await api.put(`/servers/${server.id}/tasks/${task.id}`, { enabled: !task.enabled });
      load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function confirmDelete() {
    try {
      await api.del(`/servers/${server.id}/tasks/${deleteTarget.id}`);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="p-lg space-y-lg">
      <div className="flex justify-between items-center">
        <h2 className="text-section-head text-text-primary">Scheduled Tasks</h2>
        {!showForm && <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Task</button>}
      </div>

      {showForm && (
        <div className="card p-4 space-y-3">
          <input className="input" placeholder="Task name" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className="input" placeholder="Cron expression (e.g. 0 4 * * *)" value={cronExpression} onChange={(e) => setCronExpression(e.target.value)} />

          <button
            type="button"
            className="text-label text-text-muted hover:text-text-secondary"
            onClick={() => setShowCheatsheet((v) => !v)}
          >
            {showCheatsheet ? 'Hide cron reference' : 'Show cron reference'}
          </button>

          <AnimatePresence initial={false}>
            {showCheatsheet && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                style={{ overflow: 'hidden' }}
              >
                <div className="bg-surface2 border border-hairline rounded-card p-3 grid grid-cols-2 gap-4 text-[12px]">
                  <div className="space-y-1">
                    <p className="text-text-muted mb-1" style={{ fontWeight: 590 }}>Examples</p>
                    {CRON_EXAMPLES.map(([expr, desc]) => (
                      <div key={expr} className="flex justify-between gap-3">
                        <span className="text-text-primary" style={{ fontFamily: 'var(--font-mono)' }}>{expr}</span>
                        <span className="text-text-secondary text-right">{desc}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <p className="text-text-muted mb-1" style={{ fontWeight: 590 }}>Special characters</p>
                    {CRON_SPECIAL_CHARS.map(([char, desc]) => (
                      <div key={char} className="flex gap-3">
                        <span className="text-text-primary w-4" style={{ fontFamily: 'var(--font-mono)' }}>{char}</span>
                        <span className="text-text-secondary">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {type === 'command' && (
            <input className="input" placeholder="Command to send" value={command} onChange={(e) => setCommand(e.target.value)} />
          )}
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={createTask} disabled={!name}>Create</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-text-secondary border-b border-hairline">
              <th className="p-3 font-normal">Name</th>
              <th className="p-3 font-normal">Type</th>
              <th className="p-3 font-normal">Schedule</th>
              <th className="p-3 font-normal">Last Run</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="border-b border-hairline last:border-0">
                <td className="p-3 text-text-primary">{task.name}</td>
                <td className="p-3 text-text-secondary">{task.type}</td>
                <td className="p-3 text-text-secondary" style={{ fontFamily: 'var(--font-mono)' }}>{task.cron_expression}</td>
                <td className="p-3 text-text-secondary">{task.last_run ? new Date(task.last_run).toLocaleString() : '-'}</td>
                <td className="p-3 text-right space-x-3">
                  <button className="text-accent text-label" onClick={() => toggleEnabled(task)}>{task.enabled ? 'Disable' : 'Enable'}</button>
                  <button className="text-stopped text-label" onClick={() => setDeleteTarget(task)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tasks.length === 0 && (
          <p className="p-6 text-center text-text-muted text-caption">
            No scheduled tasks yet. You can schedule automatic restarts, backups, custom commands, and update checks on any cron schedule.
          </p>
        )}
      </div>

      {deleteTarget && (
        <ConfirmModal
          title="Delete task?"
          message={`This removes the scheduled task "${deleteTarget.name}".`}
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
