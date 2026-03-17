import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area, Treemap
} from 'recharts';
import {
  ShieldAlert, AlertTriangle, Search, RefreshCw, Globe, Lock,
  Server, Database, Shield, ChevronRight, ChevronDown, Clock, Crosshair,
  Activity, Eye, MapPin, Zap, Target, Copy, CheckCircle2, XCircle,
  Skull, Network, ArrowRight, Flame, Bug, KeyRound, FileWarning,
  TrendingDown, Radio
} from 'lucide-react';
import { getThreats } from '../api';
import { useToast } from '../components/Toast';
import Card from '../components/Card';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';

const SEV_COLORS = { CRITICAL: '#f43f5e', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#3b82f6' };
const SEV_BG = { CRITICAL: 'from-rose-500/20 to-rose-600/5', HIGH: 'from-orange-500/20 to-orange-600/5', MEDIUM: 'from-yellow-500/20 to-yellow-600/5', LOW: 'from-blue-500/20 to-blue-600/5' };

const CAT_META = {
  network_exposure: { label: 'Network Exposure', icon: Network, color: '#f43f5e', desc: 'Open ports and unrestricted network access' },
  public_exposure: { label: 'Public Exposure', icon: Globe, color: '#f97316', desc: 'Internet-facing resources' },
  data_exposure: { label: 'Data Exposure', icon: Database, color: '#ef4444', desc: 'Publicly accessible data stores' },
  identity_threat: { label: 'Identity Threat', icon: KeyRound, color: '#a78bfa', desc: 'IAM misconfigurations and weak auth' },
  detection_gap: { label: 'Detection Gap', icon: Eye, color: '#facc15', desc: 'Missing monitoring and logging' },
  secret_exposure: { label: 'Secret Exposure', icon: Bug, color: '#ec4899', desc: 'Hardcoded credentials and API keys' },
  encryption_gap: { label: 'Encryption Gap', icon: Lock, color: '#fb923c', desc: 'Unencrypted data at rest' },
  lateral_movement: { label: 'Lateral Movement', icon: Activity, color: '#8b5cf6', desc: 'Overly permissive cross-account access' },
  compliance_drift: { label: 'Compliance Drift', icon: TrendingDown, color: '#38bdf8', desc: 'Compliance score regression' },
};

const STEP_COLORS = {
  recon: { color: '#60a5fa', label: 'RECON', icon: Search },
  exploit: { color: '#f43f5e', label: 'EXPLOIT', icon: Flame },
  access: { color: '#f97316', label: 'ACCESS', icon: KeyRound },
  escalate: { color: '#a78bfa', label: 'ESCALATE', icon: TrendingDown },
  exfiltrate: { color: '#ef4444', label: 'EXFIL', icon: Database },
  persist: { color: '#eab308', label: 'PERSIST', icon: Lock },
};

const CHART_TOOLTIP = {
  contentStyle: { background: '#1a2332', border: '1px solid rgba(124,58,237,0.15)', borderRadius: '14px', color: '#f8fafc', fontSize: '11px', boxShadow: '0 12px 40px rgba(0,0,0,0.4)', padding: '10px 14px' },
};

function ThreatScoreGauge({ score }) {
  const r = 72;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? '#4ade80' : score >= 50 ? '#eab308' : '#f43f5e';
  const label = score >= 80 ? 'SECURE' : score >= 50 ? 'AT RISK' : 'CRITICAL';

  return (
    <div className="relative w-48 h-48 mx-auto">
      <div className="absolute inset-4 rounded-full blur-3xl opacity-25" style={{ background: color }} />
      <svg className="transform -rotate-90 relative z-10" width={192} height={192} viewBox="0 0 192 192">
        <circle cx="96" cy="96" r={r} fill="none" stroke="rgba(41,53,72,0.5)" strokeWidth="8" />
        <circle cx="96" cy="96" r={r + 8} fill="none" stroke="rgba(41,53,72,0.2)" strokeWidth="1" strokeDasharray="4 4" />
        <motion.circle cx="96" cy="96" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: offset }}
          transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 14px ${color}60)` }} />
        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map((tick) => {
          const angle = (tick / 100) * 360 - 90;
          const rad = (angle * Math.PI) / 180;
          const x1 = 96 + (r - 14) * Math.cos(rad);
          const y1 = 96 + (r - 14) * Math.sin(rad);
          const x2 = 96 + (r - 8) * Math.cos(rad);
          const y2 = 96 + (r - 8) * Math.sin(rad);
          return <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(161,180,207,0.3)" strokeWidth="2" />;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
        <motion.span initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.8, type: 'spring' }}
          className="text-4xl font-black tabular-nums tracking-tight" style={{ color }}>{score}</motion.span>
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] mt-1" style={{ color }}>{label}</span>
        <span className="text-[8px] text-text-muted/60 mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

function CategoryCard({ category, count, total }) {
  const meta = CAT_META[category] || { label: category, icon: AlertTriangle, color: '#94a3b8', desc: '' };
  const Icon = meta.icon;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <motion.div whileHover={{ scale: 1.02, y: -2 }}
      className="rounded-xl border border-border/40 bg-surface-light/60 p-4 hover:border-primary/15 transition-all cursor-default">
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${meta.color}12`, border: `1px solid ${meta.color}20` }}>
          <Icon className="w-4 h-4" style={{ color: meta.color }} />
        </div>
        <span className="text-xl font-black tabular-nums" style={{ color: meta.color }}>{count}</span>
      </div>
      <p className="text-xs font-semibold text-text">{meta.label}</p>
      <p className="text-[10px] text-text-muted mt-0.5 leading-relaxed">{meta.desc}</p>
      <div className="mt-3 progress-track">
        <motion.div className="progress-fill" style={{ background: meta.color }}
          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }} />
      </div>
      <p className="text-[9px] text-text-muted/60 mt-1.5 text-right tabular-nums">{pct}% of threats</p>
    </motion.div>
  );
}

export default function Threats() {
  const { account } = useOutletContext();
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [sevFilter, setSevFilter] = useState(new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']));
  const [expandedThreats, setExpandedThreats] = useState(new Set());
  const [expandedPaths, setExpandedPaths] = useState(new Set([0]));
  const [copiedId, setCopiedId] = useState(null);

  const loadThreats = () => {
    if (!account) { setLoading(false); return; }
    setLoading(true);
    getThreats(account)
      .then(d => { setData(d); addToast(`${d.total} threats detected — Risk score: ${d.risk_score}/100`, d.risk_score >= 50 ? 'success' : 'warning'); })
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
  if (!data) return <EmptyState icon={Crosshair} title="No threat data" description="Run a cloud scan first to detect threats in your infrastructure." />;

  const threats = data.threats || [];
  const attackPaths = data.attack_paths || [];
  const summary = data.summary || {};

  const filtered = threats.filter(t => {
    if (!sevFilter.has(t.severity)) return false;
    if (search) {
      const s = search.toLowerCase();
      return t.title.toLowerCase().includes(s) || t.description.toLowerCase().includes(s) ||
        t.resource.toLowerCase().includes(s) || (t.mitre_technique || '').toLowerCase().includes(s) ||
        (t.category || '').toLowerCase().includes(s);
    }
    return true;
  });

  const sevPie = Object.entries(summary.severity || {}).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
  const catBar = Object.entries(summary.categories || {}).map(([key, value]) => ({
    name: CAT_META[key]?.label || key, value, fill: CAT_META[key]?.color || '#7c3aed',
  })).sort((a, b) => b.value - a.value);

  const regionData = Object.entries(summary.regions || {}).map(([name, value]) => ({ name: name.length > 12 ? name.slice(0, 12) : name, threats: value }));

  const radarData = Object.entries(summary.categories || {}).map(([key, value]) => ({
    category: CAT_META[key]?.label?.split(' ')[0] || key, value, fullMark: Math.max(...Object.values(summary.categories || {})),
  }));

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'attack-paths', label: 'Attack Paths', icon: Crosshair, count: attackPaths.length },
    { id: 'threats', label: 'All Threats', icon: Flame, count: threats.length },
    { id: 'regions', label: 'Region Map', icon: Globe },
  ];

  return (
    <div className="space-y-6">
      {/* ═══ Header ═══ */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="report-header flex items-end justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500/20 to-rose-600/10 border border-rose-500/20 flex items-center justify-center shadow-xl shadow-rose-500/10">
              <Crosshair className="w-6 h-6 text-rose-400" />
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 dot-pulse border-2 border-surface-light" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text flex items-center gap-2">
              Threat Detection
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-500/12 text-rose-400 border border-rose-500/15 uppercase tracking-widest">Live</span>
            </h1>
            <p className="text-text-muted text-xs mt-0.5">
              {data.total} active threats &bull; {attackPaths.length} attack paths &bull;
              Account: <span className="text-accent font-medium">{account}</span> &bull;
              Scanned: {new Date(data.scanned_at).toLocaleTimeString()}
            </p>
          </div>
        </div>
        <button onClick={loadThreats}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-500/80 to-rose-600/80 hover:from-rose-500 hover:to-rose-600 rounded-xl text-xs font-semibold transition-all shadow-lg shadow-rose-500/15">
          <Radio className="w-3.5 h-3.5" /> Rescan Now
        </button>
      </motion.div>

      {/* ═══ KPI Row ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Risk Score Gauge */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="lg:col-span-1 lg:row-span-2 kpi-card flex flex-col items-center justify-center !py-6">
          <ThreatScoreGauge score={data.risk_score} />
          <p className="text-[9px] text-text-muted uppercase tracking-[0.15em] font-semibold mt-1">Infrastructure Health</p>
        </motion.div>

        {/* Severity KPIs */}
        {[
          { label: 'Critical Threats', count: summary.severity?.CRITICAL || 0, color: '#f43f5e', icon: Skull, desc: 'Immediate action required' },
          { label: 'High Threats', count: summary.severity?.HIGH || 0, color: '#f97316', icon: Flame, desc: 'Important security risks' },
          { label: 'Medium Threats', count: summary.severity?.MEDIUM || 0, color: '#eab308', icon: AlertTriangle, desc: 'Should be addressed' },
          { label: 'Attack Paths', count: attackPaths.length, color: '#a78bfa', icon: Crosshair, desc: 'Exploitable kill chains' },
          { label: 'Total Threats', count: data.total, color: '#7c3aed', icon: ShieldAlert, desc: 'All detected threats' },
          { label: 'Categories', count: Object.keys(summary.categories || {}).length, color: '#38bdf8', icon: Target, desc: 'Threat type diversity' },
          { label: 'Regions Affected', count: Object.keys(summary.regions || {}).length, color: '#4ade80', icon: Globe, desc: 'Geographic spread' },
          { label: 'Resource Types', count: Object.keys(summary.resource_types || {}).length, color: '#fb923c', icon: Server, desc: 'Affected service types' },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.03 }}
            className="kpi-card stat-shine group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-widest text-text-muted">{kpi.label}</p>
                <p className="text-2xl font-black mt-1 tabular-nums" style={{ color: kpi.color }}>{kpi.count}</p>
                <p className="text-[8px] text-text-muted/50 mt-0.5">{kpi.desc}</p>
              </div>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform" style={{ background: `${kpi.color}12` }}>
                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ═══ Tabs ═══ */}
      <div className="flex items-center gap-1.5">
        {tabs.map(({ id, label, icon: Icon, count }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
              activeTab === id ? 'bg-primary/12 text-primary-light border-primary/20 shadow-sm shadow-primary/5' : 'bg-surface-light/50 text-text-muted border-border/30 hover:text-text hover:border-border/50'
            }`}>
            <Icon className="w-3.5 h-3.5" /> {label}
            {count !== undefined && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-surface-lighter/50 font-bold tabular-nums">{count}</span>}
          </button>
        ))}
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Severity Donut */}
            <Card delay={0.05} hover={false}>
              <div className="section-title mb-4"><Flame className="w-4 h-4 text-rose-400" /><span>Severity Breakdown</span></div>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={200}>
                  <PieChart>
                    <Pie data={sevPie} cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={4} dataKey="value" animationDuration={1000}>
                      {sevPie.map(d => <Cell key={d.name} fill={SEV_COLORS[d.name]} stroke="transparent" />)}
                    </Pie>
                    <Tooltip {...CHART_TOOLTIP} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {sevPie.map(d => (
                    <div key={d.name} className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full shadow-sm" style={{ background: SEV_COLORS[d.name], boxShadow: `0 0 10px ${SEV_COLORS[d.name]}40` }} />
                      <span className="text-[10px] text-text-muted w-16 uppercase tracking-wider font-medium">{d.name}</span>
                      <span className="text-base font-black tabular-nums" style={{ color: SEV_COLORS[d.name] }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Threat Radar */}
            <Card delay={0.1} hover={false}>
              <div className="section-title mb-4"><Target className="w-4 h-4 text-primary-light" /><span>Threat Radar</span></div>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="rgba(124,58,237,0.1)" />
                  <PolarAngleAxis dataKey="category" tick={{ fill: '#a1b4cf', fontSize: 9 }} />
                  <PolarRadiusAxis tick={false} axisLine={false} />
                  <Radar name="Threats" dataKey="value" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.12} strokeWidth={2}
                    dot={{ r: 3, fill: '#f43f5e', stroke: '#1a2332', strokeWidth: 2 }} />
                </RadarChart>
              </ResponsiveContainer>
            </Card>

            {/* Category Bar */}
            <Card delay={0.15} hover={false}>
              <div className="section-title mb-4"><ShieldAlert className="w-4 h-4 text-amber-400" /><span>By Category</span></div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={catBar} layout="vertical" barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.05)" />
                  <XAxis type="number" tick={{ fill: '#a1b4cf', fontSize: 9 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#a1b4cf', fontSize: 9 }} width={100} />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {catBar.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Category Grid */}
          <div>
            <div className="section-title mb-4"><Bug className="w-4 h-4 text-rose-400" /><span>Threat Categories ({Object.keys(summary.categories || {}).length})</span></div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {Object.entries(summary.categories || {}).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                <CategoryCard key={cat} category={cat} count={count} total={data.total} />
              ))}
            </div>
          </div>

          {/* Top Threats Preview */}
          <Card delay={0.2} hover={false}>
            <div className="section-title mb-4"><Skull className="w-4 h-4 text-rose-400" /><span>Top Critical Threats</span></div>
            <div className="space-y-2">
              {threats.filter(t => t.severity === 'CRITICAL').slice(0, 5).map((t, i) => {
                const catInfo = CAT_META[t.category] || {};
                return (
                  <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.05 }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-500/5 border border-rose-500/10 hover:border-rose-500/20 transition-all">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/12 flex items-center justify-center flex-shrink-0">
                      <Skull className="w-4 h-4 text-rose-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-text truncate">{t.title}</p>
                      <p className="text-[10px] text-text-muted mt-0.5 truncate">{t.description}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[8px] text-text-muted bg-surface-lighter/30 px-2 py-0.5 rounded-md font-mono">{t.mitre_technique?.split(' - ')[0]}</span>
                      <span className="text-[9px] text-text-muted bg-surface-lighter/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5" />{t.region}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ═══ ATTACK PATHS TAB ═══ */}
      {activeTab === 'attack-paths' && (
        <div className="space-y-4">
          {attackPaths.length === 0 ? (
            <EmptyState icon={Crosshair} title="No attack paths detected" description="Your infrastructure doesn't have exploitable kill chains. Great!" />
          ) : (
            attackPaths.map((path, pi) => {
              const isExpanded = expandedPaths.has(pi);
              return (
                <motion.div key={pi} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: pi * 0.06 }}
                  className="border border-border/40 rounded-2xl overflow-hidden bg-surface-light/60 shadow-lg shadow-black/10">
                  {/* Path Header */}
                  <button onClick={() => { const n = new Set(expandedPaths); n.has(pi) ? n.delete(pi) : n.add(pi); setExpandedPaths(n); }}
                    className="w-full flex items-center justify-between px-6 py-5 hover:bg-white/[0.02] transition-all text-left">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center"
                          style={{ background: `linear-gradient(135deg, ${SEV_COLORS[path.severity]}20, ${SEV_COLORS[path.severity]}05)`, border: `1px solid ${SEV_COLORS[path.severity]}25` }}>
                          <Crosshair className="w-5 h-5" style={{ color: SEV_COLORS[path.severity] }} />
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 text-[8px] font-black px-1.5 py-0.5 rounded-full"
                          style={{ background: SEV_COLORS[path.severity], color: '#fff' }}>{path.steps.length}</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-text">{path.name}</h3>
                        <p className="text-[10px] text-text-muted mt-0.5">{path.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest"
                        style={{ color: SEV_COLORS[path.severity], background: `${SEV_COLORS[path.severity]}10`, border: `1px solid ${SEV_COLORS[path.severity]}20` }}>
                        {path.severity}
                      </span>
                      <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                        <ChevronDown className="w-4 h-4 text-text-muted" />
                      </motion.div>
                    </div>
                  </button>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden border-t border-border/20">
                        <div className="p-6">
                          {/* Kill Chain Steps */}
                          <p className="text-[9px] text-text-muted uppercase tracking-[0.15em] font-bold mb-4">Kill Chain Visualization</p>
                          <div className="flex items-center gap-0 overflow-x-auto pb-4">
                            {path.steps.map((step, si) => {
                              const stepMeta = STEP_COLORS[step.type] || { color: '#94a3b8', label: step.type, icon: AlertTriangle };
                              const StepIcon = stepMeta.icon;
                              return (
                                <div key={si} className="flex items-center flex-shrink-0">
                                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + si * 0.1 }}
                                    className="w-52 rounded-2xl p-4 border" style={{ borderColor: `${stepMeta.color}25`, background: `${stepMeta.color}06` }}>
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${stepMeta.color}18` }}>
                                        <StepIcon className="w-3.5 h-3.5" style={{ color: stepMeta.color }} />
                                      </div>
                                      <div>
                                        <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: stepMeta.color }}>{stepMeta.label}</span>
                                        <span className="text-[8px] text-text-muted ml-1.5">Step {step.step}</span>
                                      </div>
                                    </div>
                                    <p className="text-xs font-semibold text-text">{step.action}</p>
                                    <p className="text-[10px] text-text-muted mt-1 leading-relaxed">{step.detail}</p>
                                  </motion.div>
                                  {si < path.steps.length - 1 && (
                                    <div className="flex items-center px-2 flex-shrink-0">
                                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 + si * 0.1 }}>
                                        <ArrowRight className="w-5 h-5" style={{ color: `${stepMeta.color}60` }} />
                                      </motion.div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* MITRE + Impact */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                            <div className="rounded-xl bg-primary/5 border border-primary/10 p-4">
                              <p className="text-[9px] text-primary-light uppercase tracking-[0.12em] font-bold mb-2.5 flex items-center gap-1.5">
                                <Shield className="w-3 h-3" /> MITRE ATT&CK Chain
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {path.mitre_chain?.map((t, ti) => (
                                  <span key={ti} className="px-2.5 py-1 rounded-lg bg-primary/8 text-primary-light text-[9px] font-mono border border-primary/12 font-medium">{t}</span>
                                ))}
                              </div>
                            </div>
                            <div className="rounded-xl bg-rose-500/5 border border-rose-500/10 p-4">
                              <p className="text-[9px] text-rose-400 uppercase tracking-[0.12em] font-bold mb-2.5 flex items-center gap-1.5">
                                <Skull className="w-3 h-3" /> Potential Impact
                              </p>
                              <p className="text-xs text-text leading-relaxed">{path.impact}</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* ═══ ALL THREATS TAB ═══ */}
      {activeTab === 'threats' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search threats, resources, MITRE techniques..."
                className="w-full bg-surface-light border border-border/50 rounded-xl pl-10 pr-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-primary/30 transition-all" />
            </div>
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(sev => (
              <button key={sev} onClick={() => { const n = new Set(sevFilter); n.has(sev) ? n.delete(sev) : n.add(sev); setSevFilter(n); }}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${
                  sevFilter.has(sev) ? 'opacity-100' : 'opacity-25'
                }`} style={{ color: SEV_COLORS[sev], borderColor: `${SEV_COLORS[sev]}30`, background: sevFilter.has(sev) ? `${SEV_COLORS[sev]}08` : 'transparent' }}>{sev}</button>
            ))}
            <span className="text-[10px] text-text-muted ml-auto tabular-nums">{filtered.length} / {threats.length}</span>
          </div>

          {/* Threat List */}
          <Card hover={false}>
            <div className="space-y-0.5 max-h-[650px] overflow-y-auto">
              {filtered.map((threat, i) => {
                const isExpanded = expandedThreats.has(i);
                const catInfo = CAT_META[threat.category] || { icon: AlertTriangle, color: '#94a3b8' };
                const CatIcon = catInfo.icon;
                return (
                  <div key={i}>
                    <button onClick={() => { const n = new Set(expandedThreats); n.has(i) ? n.delete(i) : n.add(i); setExpandedThreats(n); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/[0.025] transition-all text-left group">
                      <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
                        <ChevronRight className="w-3.5 h-3.5 text-text-muted/50" />
                      </motion.div>
                      <span className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: SEV_COLORS[threat.severity] }} />
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${catInfo.color}10` }}>
                        <CatIcon className="w-3.5 h-3.5" style={{ color: catInfo.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text truncate group-hover:text-primary-light transition-colors">{threat.title}</p>
                        <p className="text-[10px] text-text-muted/60 font-mono truncate">{threat.mitre_technique}</p>
                      </div>
                      <span className="text-[9px] text-text-muted/60 bg-surface-lighter/20 px-2 py-0.5 rounded-md flex-shrink-0">{threat.resource_type}</span>
                      <span className="text-[9px] text-text-muted/60 bg-surface-lighter/20 px-2 py-0.5 rounded-md flex items-center gap-1 flex-shrink-0">
                        <MapPin className="w-2.5 h-2.5" />{threat.region}
                      </span>
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className="ml-14 mr-4 mb-3 overflow-hidden">
                          <div className="rounded-xl border border-border/25 bg-surface/30 p-4 space-y-3">
                            <p className="text-xs text-text-muted leading-relaxed">{threat.description}</p>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                              {[
                                { label: 'Resource', value: threat.resource, mono: true },
                                { label: 'Type', value: threat.resource_type },
                                { label: 'MITRE Tactic', value: threat.mitre_tactic },
                                { label: 'Technique', value: threat.mitre_technique, accent: true },
                              ].map(f => (
                                <div key={f.label} className="bg-surface-lighter/15 rounded-lg p-2.5">
                                  <span className="text-[8px] text-text-muted uppercase tracking-widest font-semibold">{f.label}</span>
                                  <p className={`text-[11px] mt-0.5 truncate ${f.mono ? 'font-mono text-text' : f.accent ? 'text-primary-light font-mono' : 'text-text'}`}>{f.value}</p>
                                </div>
                              ))}
                            </div>
                            <div className="bg-emerald-500/5 border border-emerald-500/12 rounded-xl p-3.5 flex items-start gap-3">
                              <Zap className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-[8px] text-emerald-400 uppercase tracking-[0.15em] font-bold mb-1">Remediation</p>
                                <p className="text-xs text-text-muted leading-relaxed">{threat.remediation}</p>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); copyRemediation(threat.remediation, threat.id); }}
                                className="p-2 rounded-lg hover:bg-emerald-500/10 text-text-muted hover:text-emerald-400 transition-all flex-shrink-0">
                                {copiedId === threat.id ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
              {filtered.length === 0 && <EmptyState title="No threats match" description="Adjust filters" />}
            </div>
          </Card>
        </div>
      )}

      {/* ═══ REGIONS TAB ═══ */}
      {activeTab === 'regions' && (
        <div className="space-y-5">
          <Card delay={0.05} hover={false}>
            <div className="section-title mb-4"><Globe className="w-4 h-4 text-accent-light" /><span>Threats by Region</span></div>
            {regionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={regionData} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.06)" />
                  <XAxis dataKey="name" tick={{ fill: '#a1b4cf', fontSize: 10 }} angle={-25} textAnchor="end" height={50} />
                  <YAxis tick={{ fill: '#a1b4cf', fontSize: 10 }} />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Bar dataKey="threats" fill="#f43f5e" radius={[6, 6, 0, 0]}>
                    {regionData.map((e, i) => <Cell key={i} fill={e.threats > 5 ? '#f43f5e' : e.threats > 2 ? '#f97316' : '#eab308'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-48 flex items-center justify-center text-text-muted text-sm">No regional data</div>}
          </Card>

          {/* Region Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(summary.regions || {}).sort((a, b) => b[1] - a[1]).map(([region, count]) => (
              <motion.div key={region} whileHover={{ scale: 1.01 }}
                className="rounded-xl border border-border/40 bg-surface-light/60 p-4 hover:border-rose-500/15 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/8 flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-rose-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-text font-mono">{region}</p>
                      <p className="text-[10px] text-text-muted">{count} threat{count !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black tabular-nums" style={{ color: count > 5 ? '#f43f5e' : count > 2 ? '#f97316' : '#eab308' }}>{count}</p>
                  </div>
                </div>
                <div className="compliance-bar mt-3">
                  <motion.div className="compliance-fill" initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (count / Math.max(...Object.values(summary.regions || {}))) * 100)}%` }}
                    transition={{ duration: 1, delay: 0.3 }}
                    style={{ background: `linear-gradient(90deg, ${count > 5 ? '#f43f5e' : '#f97316'}, ${count > 5 ? '#f43f5e80' : '#f9731680'})` }} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
