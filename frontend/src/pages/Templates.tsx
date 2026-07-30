import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../lib/ToastContext';
import NewServerModal from '../components/NewServerModal';
import type { Template, Server } from '../types';

interface Badge {
  label: string;
  className: string;
}

function getBadges(template: Template): Badge[] {
  const badges: Badge[] = [];
  if (template.installNotes && template.installNotes.includes('GSLT')) {
    badges.push({ label: 'Needs GSLT', className: 'bg-warning/15 text-warning' });
  }
  if (template.wineRequired) {
    badges.push({ label: 'Experimental', className: 'bg-warning/15 text-warning' });
  }
  if (template.anon === false) {
    badges.push({ label: 'Steam Login', className: 'bg-info/15 text-info' });
  }
  return badges;
}

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    api.get<Template[]>('/templates')
      .then(setTemplates)
      .catch((err) => toast.error(`Failed to load templates: ${(err as Error).message}`))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-lg text-text-secondary text-[13px]">Loading...</div>;

  const categories = ['all', ...new Set(templates.map((t) => t.category))].sort();
  const filtered = templates.filter((t) => {
    const matchesQuery = !query || t.name.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === 'all' || t.category === category;
    return matchesQuery && matchesCategory;
  });

  return (
    <div className="p-lg space-y-lg">
      <h1 className="text-page-title text-text-primary">Templates</h1>

      <div className="space-y-3">
        <input
          className="input"
          placeholder="Search templates..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex gap-1.5 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-2.5 py-1 rounded-badge text-label transition-colors duration-100 ${
                category === cat ? 'bg-accent text-text-primary' : 'bg-surface3 text-text-secondary hover:text-text-primary'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-xl text-center text-text-muted text-caption">No templates match your search.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
          {filtered.map((template) => {
            const badges = getBadges(template);
            return (
              <button
                key={template.id}
                onClick={() => setSelected(template)}
                className="card p-4 text-left hover:border-hairline-strong hover:bg-surface2 transition-colors duration-100 flex flex-col"
                style={{ minHeight: '100px' }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[13px] text-text-primary" style={{ fontWeight: 590 }}>{template.name}</span>
                  <div className="flex flex-col gap-1 items-end flex-shrink-0">
                    <span className="status-badge bg-surface3 text-text-muted">{template.category}</span>
                    {badges.map((badge) => (
                      <span key={badge.label} className={`status-badge ${badge.className}`}>{badge.label}</span>
                    ))}
                  </div>
                </div>
                <p className="text-caption text-text-muted italic line-clamp-3">
                  {template.installNotes || 'Standard setup, no special requirements.'}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <NewServerModal
          template={selected}
          onClose={() => setSelected(null)}
          onCreated={(server: Server) => navigate(`/servers/${server.id}`)}
        />
      )}
    </div>
  );
}
