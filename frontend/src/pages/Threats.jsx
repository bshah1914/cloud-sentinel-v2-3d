import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import {
  ShieldAlert, AlertTriangle, Search, RefreshCw, Globe, Lock,
  Server, Database, Shield, ChevronRight, Clock, Crosshair,
  Activity, Eye, MapPin, Zap, Target, Copy, CheckCircle2, XCircle
} from 'lucide-react';
import { getThreats } from '../api';
import { useToast } from '../components/Toast';
import Card from '../components/Card';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';

const SEV_COLORS = { CRITICAL: '#fb7185', HIGH: '#f97316', MEDIUM: '#facc15', LOW: '#60a5fa' };

const CAT_LABELS = {
  network_exposure: { label: 'Network Exposure', icon: Globe, color: '#fb7185' },
  public_exposure: { label: 'Public Exposure', icon: Eye, color: '#f97316' },
  data_exposure: { label: 'Data Exposure', icon: Database, color: '#ef4444' },
  identity_threat: { label: 'Identity Threat', icon: Lock, color: '#a78bfa' },
  detection_gap: { label: 'Detection Gap', icon: Shield, color: '#facc15' },
};

const CHART_TOOLTIP = {
  contentStyle: { background: '#1a2332', border: '1px solid rgba(124,58,237,0.12)', borderRadius: '12px', color: '#f8fafc', fontSize: '11px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' },
};

function ThreatScoreGauge({ score }) {
  const r = 70;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? '#4ade80' : score >= 50 ? '#facc15' : '#fb7185';

  return (
    <div className="relative w-44 h-44 mx-auto">
      <div className="absolute inset-4 rounded-full blur-2xl opacity-20" style={{ background: color }} />
      <svg className="transform -rotate-90 relative z-10" width={176} height={176} viewBox="0 0 176 176">
        <circle cx="88" cy="88" r={r} fill="none" stroke="#293548" strokeWidth="10" />
        <motion.circle cx="88" cy="88" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 10px ${color}50)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
        <span className="text-3xl font-black tabular-nums" style={{ color }}>{score}</span>
        <span className="text-[10px] text-text-muted font-semibold uppercase tracking-widest mt-0.5">
          {score >= 80 ? 'Low Risk' : score >= 50 ? 'Medium Risk' : 'High Risk'}
        </span>
      </div>
    </div>
  );
}

export default function Threats() {
  const { account } = useOutletContext();
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sevFilter, setSevFilter] = useState(new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']));
  const [expandedThreats, setExpandedThreats] = useState(new Set());
  const [copiedId, setCopiedId] = useState(null);

  const loadThreats = () => {
    if (!account) { setLoading(false); return; }
    setLoading(true);
    getThreats(account)
      .then(d => { setData(d); addToast(`Threat scan: ${d.total} threats detected, risk score ${d.risk_score}`, d.risk_score >= 80 ? 'success' : 'warning'); })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadThreats(); }, [account]);

  const copyRemediation = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) return <Loader text="Scanning for threats..." />;
  if (!data) return <EmptyState icon={ShieldAlert} title="No threat data" description="Run a cloud scan first to detect threats." />;

  const threats = data.threats || [];
  const summary = data.summary || {};

  const filtered = threats.filter(t => {
    if (!sevFilter.has(t.severity)) return false;
    if (search) {
      const s = search.toLowerCase();
      return t.title.toLowerCase().includes(s) || t.description.toLowerCase().includes(s) ||
        t.resource.toLowerCase().includes(s) || t.region.toLowerCase().includes(s) ||
        (t.mitre_technique || '').toLowerCase().includes(s);
    }
    return true;
  });

  const sevPie = Object.entries(summary.severity || {}).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
  const catBar = Object.entries(summary.categories || {}).map(([key, value]) => ({
    name: CAT_LABELS[key]?.label || key, value, fill: CAT_LABELS[key]?.color || '#7c3aed',
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="report-header flex items-end justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/20 flex items-center justify-center shadow-lg shadow-rose-500/10">
            <Crosshair className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">Threat Detection</h1>
            <p className="text-text-muted text-xs mt-0.5">
              Real-time threat analysis &bull; {data.total} threats detected &bull;
              Account: <span className="text-accent font-medium">{account}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadThreats} className="flex items-center gap-2 px-4 py-2.5 bg-surface-lighter/50 hover:bg-surface-lighter border border-border/50 rounded-xl text-xs font-medium transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Rescan
          </button>
        </div>
      </motion.div>

      {/* Score + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Risk Score */}
        <Card delay={0.05} hover={false} className="flex flex-col items-center justify-center">
          <ThreatScoreGauge score={data.risk_score} />
          <p className="text-[10px] text-text-muted mt-2 uppercase tracking-widest font-semibold">Infrastructure Health</p>
        </Card>

        {/* Severity Cards */}
        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Critical', count: summary.severity?.CRITICAL || 0, color: '#fb7185', icon: XCircle },
            { label: 'High', count: summary.severity?.HIGH || 0, color: '#f97316', icon: AlertTriangle },
            { label: 'Medium', count: summary.severity?.MEDIUM || 0, color: '#facc15', icon: Shield },
            { label: 'Total Threats', count: data.total, color: '#7c3aed', icon: Crosshair },
          ].map((kpi, i) => (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="kpi-card stat-shine">
              <div className="flex items-start justify-between">
                <div>
                  <p className="metric-label">{kpi.label}</p>
                  <p className="text-3xl font-black mt-1.5 tabular-nums" style={{ color: kpi.color }}>{kpi.count}</p>
                </div>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${kpi.color}15` }}>
                  <kpi.icon className="w-4.5 h-4.5" style={{ color: kpi.color }} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Severity Distribution */}
        <Card delay={0.1} hover={false}>
          <div className="section-title mb-4"><AlertTriangle className="w-4 h-4 text-rose-400" /><span>Severity Distribution</span></div>
          {sevPie.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={sevPie} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={4} dataKey="value">
                    {sevPie.map(d => <Cell key={d.name} fill={SEV_COLORS[d.name]} stroke="transparent" />)}
                  </Pie>
                  <Tooltip {...CHART_TOOLTIP} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                {sevPie.map(d => (
                  <div key={d.name} className="flex items-center gap-2.5">
                    <span className="w-3 h-3 rounded-full" style={{ background: SEV_COLORS[d.name], boxShadow: `0 0 8px ${SEV_COLORS[d.name]}40` }} />
                    <span className="text-xs text-text-muted w-16">{d.name}</span>
                    <span className="text-lg font-bold tabular-nums" style={{ color: SEV_COLORS[d.name] }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="h-48 flex items-center justify-center text-text-muted text-sm">No threats detected</div>}
        </Card>

        {/* Category Breakdown */}
        <Card delay={0.15} hover={false}>
          <div className="section-title mb-4"><Target className="w-4 h-4 text-primary-light" /><span>Threat Categories</span></div>
          {catBar.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={catBar} layout="vertical" barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.06)" />
                <XAxis type="number" tick={{ fill: '#a1b4cf', fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#a1b4cf', fontSize: 10 }} width={120} />
                <Tooltip {...CHART_TOOLTIP} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {catBar.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-48 flex items-center justify-center text-text-muted text-sm">No categories</div>}
        </Card>
      </div>

      {/* Threat Feed */}
      <div>
        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search threats, resources, MITRE techniques..."
              className="w-full bg-surface-light border border-border/50 rounded-xl pl-10 pr-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-primary/30 transition-all" />
          </div>
          {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sev => (
            <button key={sev} onClick={() => { const n = new Set(sevFilter); n.has(sev) ? n.delete(sev) : n.add(sev); setSevFilter(n); }}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border transition-all ${
                sevFilter.has(sev) ? 'opacity-100 border-current/20' : 'opacity-30 border-transparent'
              }`} style={{ color: SEV_COLORS[sev] }}>{sev}</button>
          ))}
          <span className="text-[10px] text-text-muted ml-auto">{filtered.length} of {threats.length} threats</span>
        </div>

        {/* Threat List */}
        <Card hover={false}>
          <div className="section-title mb-4"><Crosshair className="w-4 h-4 text-rose-400" /><span>Live Threat Feed</span></div>
          <div className="space-y-1 max-h-[600px] overflow-y-auto">
            {filtered.map((threat, i) => {
              const isExpanded = expandedThreats.has(i);
              const catInfo = CAT_LABELS[threat.category] || { label: threat.category, icon: AlertTriangle, color: '#94a3b8' };
              const CatIcon = catInfo.icon;
              return (
                <div key={i}>
                  <button onClick={() => { const n = new Set(expandedThreats); n.has(i) ? n.delete(i) : n.add(i); setExpandedThreats(n); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/[0.02] transition-all text-left group">
                    <motion.div animate={{ rotate: isExpanded ? 90 : 0 }}><ChevronRight className="w-3.5 h-3.5 text-text-muted" /></motion.div>
                    <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border"
                      style={{ color: SEV_COLORS[threat.severity], borderColor: `${SEV_COLORS[threat.severity]}25`, background: `${SEV_COLORS[threat.severity]}10` }}>
                      {threat.severity}
                    </span>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${catInfo.color}12` }}>
                      <CatIcon className="w-3.5 h-3.5" style={{ color: catInfo.color }} />
                    </div>
                    <span className="text-sm flex-1 truncate">{threat.title}</span>
                    <span className="text-[9px] text-text-muted bg-surface-lighter/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5" />{threat.region}
                    </span>
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="ml-11 mr-4 mb-2 overflow-hidden">
                        <div className="bg-surface/40 rounded-xl p-4 space-y-3 border border-border/20">
                          <p className="text-xs text-text-muted leading-relaxed">{threat.description}</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="bg-surface-lighter/20 rounded-lg p-2.5">
                              <span className="text-[9px] text-text-muted uppercase tracking-wider">Resource</span>
                              <p className="text-text font-mono text-[11px] mt-0.5">{threat.resource}</p>
                            </div>
                            <div className="bg-surface-lighter/20 rounded-lg p-2.5">
                              <span className="text-[9px] text-text-muted uppercase tracking-wider">Type</span>
                              <p className="text-text text-[11px] mt-0.5">{threat.resource_type}</p>
                            </div>
                            <div className="bg-surface-lighter/20 rounded-lg p-2.5">
                              <span className="text-[9px] text-text-muted uppercase tracking-wider">MITRE Tactic</span>
                              <p className="text-text text-[11px] mt-0.5">{threat.mitre_tactic}</p>
                            </div>
                            <div className="bg-surface-lighter/20 rounded-lg p-2.5">
                              <span className="text-[9px] text-text-muted uppercase tracking-wider">MITRE Technique</span>
                              <p className="text-primary-light text-[11px] mt-0.5 font-mono">{threat.mitre_technique}</p>
                            </div>
                          </div>
                          {/* Remediation */}
                          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 flex items-start gap-3">
                            <Zap className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-[9px] text-emerald-400 uppercase tracking-wider font-bold mb-1">Remediation</p>
                              <p className="text-xs text-text-muted leading-relaxed">{threat.remediation}</p>
                            </div>
                            <button onClick={() => copyRemediation(threat.remediation, threat.id)}
                              className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-text-muted hover:text-emerald-400 transition-all flex-shrink-0">
                              {copiedId === threat.id ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
            {filtered.length === 0 && <EmptyState title="No threats match filters" description="Adjust search or severity filters" />}
          </div>
        </Card>
      </div>
    </div>
  );
}
