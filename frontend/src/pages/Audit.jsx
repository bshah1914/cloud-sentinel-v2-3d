import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  ShieldCheck, Play, Filter, ChevronDown, ChevronRight,
  AlertTriangle, Search, Download
} from 'lucide-react';
import { runAudit } from '../api';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';

const SEV_COLORS = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#3b82f6',
  INFO: '#64748b',
};

const SEV_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

export default function Audit() {
  const { account } = useOutletContext();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState(new Set(SEV_ORDER));
  const [expandedRows, setExpandedRows] = useState(new Set());

  const handleRunAudit = async () => {
    if (!account) return;
    setLoading(true);
    setError(null);
    try {
      const res = await runAudit(account);
      setResults(res);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const toggleSeverity = (sev) => {
    setSeverityFilter((prev) => {
      const next = new Set(prev);
      next.has(sev) ? next.delete(sev) : next.add(sev);
      return next;
    });
  };

  const toggleRow = (i) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const filtered = useMemo(() => {
    if (!results) return [];
    return results.findings.filter((f) => {
      if (!severityFilter.has(f.severity)) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          (f.title || '').toLowerCase().includes(s) ||
          (f.issue || '').toLowerCase().includes(s) ||
          (f.region || '').toLowerCase().includes(s) ||
          (f.resource || '').toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [results, severityFilter, search]);

  const pieData = results
    ? SEV_ORDER.map((sev) => ({ name: sev, value: results.summary[sev] || 0 })).filter((d) => d.value > 0)
    : [];

  const exportCSV = () => {
    if (!filtered.length) return;
    const headers = 'Severity,Title,Issue,Region,Resource\n';
    const rows = filtered.map((f) =>
      [f.severity, f.title, f.issue, f.region || '', f.resource || ''].map((v) => `"${v}"`).join(',')
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${account}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" /> Security Audit
          </h1>
          <p className="text-text-muted text-sm mt-1">Run security audits and review findings</p>
        </div>
        <div className="flex items-center gap-3">
          {results && (
            <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-surface-lighter hover:bg-surface-lighter/80 rounded-lg text-sm transition-colors">
              <Download className="w-4 h-4" /> Export CSV
            </button>
          )}
          <button
            onClick={handleRunAudit}
            disabled={loading || !account}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {loading ? 'Running...' : 'Run Audit'}
          </button>
        </div>
      </motion.div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading && <Loader text="Running security audit..." />}

      {results && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <Card delay={0} className="col-span-2 flex items-center justify-center">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                    {pieData.map((d) => <Cell key={d.name} fill={SEV_COLORS[d.name]} stroke="transparent" />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
            {SEV_ORDER.map((sev, i) => (
              <Card key={sev} delay={0.05 * (i + 1)}>
                <div className="text-center">
                  <p className="text-3xl font-bold" style={{ color: SEV_COLORS[sev] }}>{results.summary[sev] || 0}</p>
                  <p className="text-xs text-text-muted mt-1">{sev}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <Card delay={0.2}>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search findings..."
                  className="w-full bg-surface border border-border rounded-lg pl-10 pr-3 py-2 text-sm text-text focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-text-muted" />
                {SEV_ORDER.map((sev) => (
                  <button
                    key={sev}
                    onClick={() => toggleSeverity(sev)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      severityFilter.has(sev)
                        ? 'border-current opacity-100'
                        : 'border-transparent opacity-40'
                    }`}
                    style={{ color: SEV_COLORS[sev] }}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Findings Table */}
          <Card delay={0.3}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">
                Findings ({filtered.length} of {results.total})
              </h3>
            </div>
            <div className="space-y-1">
              {filtered.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.5) }}
                >
                  <button
                    onClick={() => toggleRow(i)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-surface-lighter/30 transition-colors text-left"
                  >
                    {expandedRows.has(i) ? <ChevronDown className="w-4 h-4 text-text-muted flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />}
                    <StatusBadge status={f.severity} className="flex-shrink-0" />
                    <span className="text-sm flex-1 truncate">{f.title || f.issue}</span>
                    {f.region && <span className="text-xs text-text-muted">{f.region}</span>}
                  </button>
                  <AnimatePresence>
                    {expandedRows.has(i) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="ml-11 mr-4 mb-2 overflow-hidden"
                      >
                        <div className="bg-surface/50 rounded-lg p-4 space-y-2 text-sm">
                          {f.description && <p className="text-text-muted">{f.description}</p>}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div><span className="text-text-muted">Issue ID: </span><span className="font-mono">{f.issue}</span></div>
                            <div><span className="text-text-muted">Group: </span><span>{f.group}</span></div>
                            {f.resource && <div><span className="text-text-muted">Resource: </span><span className="font-mono text-accent">{f.resource}</span></div>}
                            {f.region && <div><span className="text-text-muted">Region: </span><span>{f.region}</span></div>}
                          </div>
                          {f.details && (
                            <pre className="text-xs bg-surface rounded-lg p-3 overflow-x-auto text-text-muted mt-2">
                              {typeof f.details === 'string' ? f.details : JSON.stringify(f.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
              {filtered.length === 0 && (
                <EmptyState title="No findings match" description="Try adjusting your search or filters" />
              )}
            </div>
          </Card>
        </>
      )}

      {!results && !loading && (
        <EmptyState
          icon={ShieldCheck}
          title="No audit results yet"
          description="Click 'Run Audit' to scan your AWS account for security issues"
        />
      )}
    </div>
  );
}
