import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import {
  FileText, Download, FileSpreadsheet, Shield, Server, AlertTriangle,
  Globe, Lock, Users, Activity, CheckCircle2, XCircle, MapPin,
  Cpu, DollarSign, Settings, Leaf, Eye, Zap, Brain, ChevronDown,
  ChevronRight, RefreshCw, Printer, Cloud, KeyRound, ShieldAlert
} from 'lucide-react';
import { getReport, exportReport } from '../api';
import { useToast } from '../components/Toast';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';

const CHART_TOOLTIP = {
  contentStyle: { background: '#1a2332', border: '1px solid rgba(99,102,241,0.12)', borderRadius: '12px', color: '#eef2ff', fontSize: '11px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' },
};

const SEV_COLORS = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#3b82f6', INFO: '#64748b' };

const WAF_PILLARS = [
  { key: 'security', label: 'Security', icon: Shield, color: '#ef4444' },
  { key: 'reliability', label: 'Reliability', icon: Activity, color: '#f59e0b' },
  { key: 'performance', label: 'Performance', icon: Cpu, color: '#7c3aed' },
  { key: 'cost', label: 'Cost', icon: DollarSign, color: '#10b981' },
  { key: 'operational', label: 'Operations', icon: Settings, color: '#06b6d4' },
  { key: 'sustainability', label: 'Sustainability', icon: Leaf, color: '#84cc16' },
];

function SectionHeader({ icon: Icon, title, count, color = 'text-primary-light' }) {
  return (
    <div className="section-title mb-4">
      <Icon className={`w-4 h-4 ${color}`} />
      <span>{title}</span>
      {count !== undefined && (
        <span className="text-[10px] text-text-muted bg-surface-lighter/50 px-2 py-0.5 rounded-md font-semibold ml-1">{count}</span>
      )}
    </div>
  );
}

function RenderAiContent({ content }) {
  if (!content) return null;
  return (
    <div className="space-y-1 text-xs text-text-muted leading-relaxed">
      {content.split('\n').map((line, i) => {
        if (line.startsWith('## ')) return <p key={i} className="text-sm font-bold text-text mt-3 mb-1">{line.slice(3)}</p>;
        if (line.match(/^\*\*.*\*\*$/)) return <p key={i} className="text-xs font-semibold text-text mt-2">{line.replace(/\*\*/g, '')}</p>;
        if (line.match(/^\*\*.*\*\*:/)) {
          const parts = line.split('**');
          return <p key={i} className="text-xs mt-1"><span className="font-semibold text-text">{parts[1]}</span>{parts[2]}</p>;
        }
        if (line.startsWith('- ')) {
          const text = line.slice(2);
          const hasCode = text.includes('`');
          if (hasCode) {
            const parts = text.split('`');
            return <p key={i} className="text-xs pl-3 flex items-start gap-1.5"><span className="text-primary-light mt-0.5 text-[8px]">●</span><span>{parts.map((p, j) => j % 2 === 1 ? <code key={j} className="px-1 py-0.5 rounded bg-primary/8 text-primary-light text-[10px] font-mono">{p}</code> : p)}</span></p>;
          }
          return <p key={i} className="text-xs pl-3 flex items-start gap-1.5"><span className="text-primary-light mt-0.5 text-[8px]">●</span>{text}</p>;
        }
        if (line.trim() === '') return <div key={i} className="h-1.5" />;
        return <p key={i} className="text-xs">{line}</p>;
      })}
    </div>
  );
}

export default function Report() {
  const { account, provider } = useOutletContext();
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(null);
  const [expandedSections, setExpandedSections] = useState(new Set(['summary', 'waf', 'audit', 'ai']));

  const toggleSection = (s) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  const loadReport = () => {
    if (!account) { setLoading(false); return; }
    setLoading(true);
    getReport(account)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadReport(); }, [account]);

  const handleExport = async (format) => {
    setExporting(format);
    try {
      await exportReport(account, format);
      addToast(`${format === 'excel' ? 'Excel' : 'PDF'} report downloaded successfully`, 'success');
    } catch (e) {
      addToast(`Export failed: ${e.message}`, 'error');
    }
    setExporting(null);
  };

  if (loading) return <Loader text="Generating comprehensive report..." />;
  if (!data || !data.dashboard) return <EmptyState icon={FileText} title="No report data" description="Run a scan first to generate the comprehensive report." />;

  const dash = data.dashboard;
  const totals = dash.totals || {};
  const audit = data.audit || {};
  const waf = data.waf || {};
  const iam = data.iam || {};
  const sgs = data.security_groups || {};
  const ai = data.ai_recommendations || {};

  const sevPie = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']
    .map(s => ({ name: s, value: audit.summary?.[s] || 0 }))
    .filter(d => d.value > 0);

  const radarData = WAF_PILLARS.map(p => ({
    pillar: p.label,
    score: waf.pillars?.[p.key]?.score || 0,
    fullMark: 100,
  }));

  const regionBar = Object.entries(dash.region_matrix || {})
    .map(([name, res]) => ({ name, total: Object.values(res).reduce((s, v) => s + v, 0), ...res }))
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const resourcePie = [
    { name: 'EC2', value: totals.instances, color: '#7c3aed' },
    { name: 'S3', value: totals.buckets, color: '#06b6d4' },
    { name: 'SGs', value: totals.security_groups, color: '#f59e0b' },
    { name: 'Lambda', value: totals.lambdas, color: '#10b981' },
    { name: 'VPCs', value: totals.vpcs, color: '#8b5cf6' },
    { name: 'RDS', value: totals.rds, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const CollapsibleSection = ({ id, icon, title, count, color, children }) => {
    const isOpen = expandedSections.has(id);
    return (
      <div className="border border-border/30 rounded-2xl overflow-hidden bg-surface-light/50">
        <button onClick={() => toggleSection(id)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.015] transition-all text-left">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color || '#7c3aed'}12` }}>
              {icon}
            </div>
            <span className="text-sm font-semibold text-text">{title}</span>
            {count !== undefined && <span className="text-[10px] text-text-muted bg-surface-lighter/50 px-2 py-0.5 rounded-md">{count}</span>}
          </div>
          <motion.div animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronRight className="w-4 h-4 text-text-muted" />
          </motion.div>
        </button>
        {isOpen && <div className="px-6 pb-6 border-t border-border/20">{children}</div>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="report-header flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-border flex items-center justify-center shadow-lg shadow-primary/15">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text">Comprehensive Report</h1>
              <p className="text-text-muted text-xs mt-0.5">
                Account: <span className="text-accent font-medium">{data.account}</span> &bull;
                Provider: {data.provider?.toUpperCase()} &bull;
                Generated: {new Date(data.generated_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadReport} className="p-2.5 rounded-xl text-text-muted hover:text-text bg-surface-lighter/50 hover:bg-surface-lighter border border-border/50 transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => handleExport('excel')} disabled={!!exporting}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600/90 hover:bg-emerald-600 disabled:opacity-50 rounded-xl text-xs font-semibold transition-all shadow-sm shadow-emerald-600/15">
            {exporting === 'excel' ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
            Export Excel
          </button>
          <button onClick={() => handleExport('pdf')} disabled={!!exporting}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-primary-dark disabled:opacity-50 rounded-xl text-xs font-semibold transition-all shadow-sm shadow-primary/15">
            {exporting === 'pdf' ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" /> : <Download className="w-3.5 h-3.5" />}
            Export PDF
          </button>
        </div>
      </motion.div>

      {/* Score Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Security Score', value: `${dash.security_score}/100`, color: dash.security_score >= 80 ? '#10b981' : dash.security_score >= 50 ? '#f59e0b' : '#ef4444', icon: Shield },
          { label: 'WAF Score', value: `${waf.overall_score || 0}%`, color: (waf.overall_score || 0) >= 80 ? '#10b981' : (waf.overall_score || 0) >= 50 ? '#f59e0b' : '#ef4444', icon: Activity },
          { label: 'Total Resources', value: Object.values(totals).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0), color: '#7c3aed', icon: Server },
          { label: 'Audit Findings', value: audit.total || 0, color: '#f59e0b', icon: AlertTriangle },
          { label: 'Regions', value: dash.regions_scanned || 0, color: '#06b6d4', icon: Globe },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="kpi-card stat-shine">
            <div className="flex items-start justify-between">
              <div>
                <p className="metric-label">{kpi.label}</p>
                <p className="text-2xl font-bold mt-1.5 tabular-nums" style={{ color: kpi.color }}>{kpi.value}</p>
              </div>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${kpi.color}12` }}>
                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Section 1: Executive Summary */}
      <CollapsibleSection id="summary" title="Executive Summary" icon={<Server className="w-4 h-4 text-primary-light" />} color="#7c3aed">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-4">
          {/* Resource Distribution */}
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-widest font-semibold mb-3">Resource Distribution</p>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={resourcePie} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" animationDuration={800}>
                    {resourcePie.map(e => <Cell key={e.name} fill={e.color} stroke="transparent" />)}
                  </Pie>
                  <Tooltip {...CHART_TOOLTIP} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {resourcePie.map(d => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                      <span className="text-xs text-text-muted">{d.name}</span>
                    </div>
                    <span className="text-xs font-bold tabular-nums text-text">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Key Metrics Table */}
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-widest font-semibold mb-3">Infrastructure Metrics</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'EC2 Instances', value: totals.instances },
                { label: 'S3 Buckets', value: totals.buckets },
                { label: 'Security Groups', value: totals.security_groups },
                { label: 'Lambda Functions', value: totals.lambdas },
                { label: 'VPCs', value: totals.vpcs },
                { label: 'RDS Instances', value: totals.rds },
                { label: 'Subnets', value: totals.subnets },
                { label: 'Snapshots', value: totals.snapshots },
                { label: 'Public IPs', value: dash.public_ips?.length || 0 },
                { label: 'Open SG Rules', value: dash.open_security_groups },
                { label: 'IAM Users', value: iam.summary?.Users || dash.iam_summary?.Users || 0 },
                { label: 'No MFA Users', value: dash.iam_users_no_mfa },
              ].map(m => (
                <div key={m.label} className="flex items-center justify-between bg-surface/40 rounded-lg px-3 py-2 border border-border/15">
                  <span className="text-[10px] text-text-muted">{m.label}</span>
                  <span className="text-xs font-bold tabular-nums text-text">{m.value ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Region Bar Chart */}
        {regionBar.length > 0 && (
          <div className="mt-5">
            <p className="text-[10px] text-text-muted uppercase tracking-widest font-semibold mb-3">Resources by Region (Top 10)</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={regionBar} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.05)" />
                <XAxis dataKey="name" tick={{ fill: '#7c8db5', fontSize: 9 }} angle={-25} textAnchor="end" height={50} />
                <YAxis tick={{ fill: '#7c8db5', fontSize: 10 }} />
                <Tooltip {...CHART_TOOLTIP} />
                <Bar dataKey="instances" name="EC2" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                <Bar dataKey="security_groups" name="SGs" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                <Bar dataKey="lambdas" name="Lambda" fill="#10b981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="rds" name="RDS" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CollapsibleSection>

      {/* Section 2: Well-Architected Framework */}
      <CollapsibleSection id="waf" title="Well-Architected Framework" count={`${waf.overall_score || 0}%`}
        icon={<Shield className="w-4 h-4 text-red-400" />} color="#ef4444">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          {/* Radar */}
          <div>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke="rgba(99,102,241,0.08)" />
                <PolarAngleAxis dataKey="pillar" tick={{ fill: '#7c8db5', fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Score" dataKey="score" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.15} strokeWidth={2}
                  dot={{ r: 4, fill: '#7c3aed', stroke: '#1a2332', strokeWidth: 2 }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Pillar bars + checks */}
          <div className="space-y-3">
            {WAF_PILLARS.map(p => {
              const pillarData = waf.pillars?.[p.key];
              const score = pillarData?.score || 0;
              const Icon = p.icon;
              return (
                <div key={p.key}>
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${p.color}15` }}>
                      <Icon className="w-3 h-3" style={{ color: p.color }} />
                    </div>
                    <span className="text-xs font-medium text-text flex-1">{p.label}</span>
                    <span className="text-[10px] font-bold tabular-nums" style={{ color: p.color }}>{score}%</span>
                  </div>
                  <div className="compliance-bar">
                    <motion.div className="compliance-fill" style={{ background: `linear-gradient(90deg, ${p.color}, ${p.color}80)` }}
                      initial={{ width: 0 }} animate={{ width: `${score}%` }}
                      transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }} />
                  </div>
                  {/* Individual checks */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {pillarData?.checks?.map((c, ci) => (
                      <span key={ci} className={`text-[9px] px-2 py-0.5 rounded-md ${c.passed ? 'bg-emerald-500/8 text-emerald-400' : 'bg-red-500/8 text-red-400'}`}>
                        {c.passed ? '✓' : '✗'} {c.name}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CollapsibleSection>

      {/* Section 3: Audit Findings */}
      <CollapsibleSection id="audit" title="Security Audit Findings" count={audit.total}
        icon={<AlertTriangle className="w-4 h-4 text-amber-400" />} color="#f59e0b">
        <div className="mt-4">
          {/* Severity summary */}
          <div className="flex items-center gap-3 mb-4">
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'].map(s => (
              <div key={s} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/20 bg-surface/30">
                <span className="w-2 h-2 rounded-full" style={{ background: SEV_COLORS[s] }} />
                <span className="text-[10px] text-text-muted uppercase tracking-wider">{s}</span>
                <span className="text-xs font-bold tabular-nums" style={{ color: SEV_COLORS[s] }}>{audit.summary?.[s] || 0}</span>
              </div>
            ))}
            <div className="ml-auto">
              <ResponsiveContainer width={100} height={60}>
                <PieChart>
                  <Pie data={sevPie} cx="50%" cy="50%" innerRadius={18} outerRadius={28} paddingAngle={2} dataKey="value">
                    {sevPie.map(d => <Cell key={d.name} fill={SEV_COLORS[d.name]} stroke="transparent" />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Findings table */}
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="corp-table w-full">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Title</th>
                  <th>Region</th>
                  <th>Resource</th>
                </tr>
              </thead>
              <tbody>
                {audit.findings?.map((f, i) => (
                  <tr key={i}>
                    <td><StatusBadge status={f.severity} /></td>
                    <td className="text-text">{f.title || f.issue}</td>
                    <td className="text-text-muted">{f.region && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{f.region}</span>}</td>
                    <td className="font-mono text-[10px] text-accent max-w-[200px] truncate">{f.resource || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CollapsibleSection>

      {/* Section 4: IAM */}
      <CollapsibleSection id="iam" title="IAM Users & Access" count={iam.users?.length || 0}
        icon={<KeyRound className="w-4 h-4 text-cyan-400" />} color="#06b6d4">
        <div className="mt-4">
          {iam.users?.length > 0 ? (
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="corp-table w-full">
                <thead>
                  <tr><th>Username</th><th>MFA</th><th>Policies</th><th>Groups</th></tr>
                </thead>
                <tbody>
                  {iam.users.map((u, i) => (
                    <tr key={i}>
                      <td className="font-mono text-text">{u.name}</td>
                      <td>
                        {u.mfa_devices?.length > 0
                          ? <span className="flex items-center gap-1 text-emerald-400 text-[10px]"><CheckCircle2 className="w-3 h-3" /> Enabled</span>
                          : <span className="flex items-center gap-1 text-red-400 text-[10px]"><XCircle className="w-3 h-3" /> Disabled</span>}
                      </td>
                      <td className="text-text-muted text-xs">{u.policies?.join(', ') || '-'}</td>
                      <td className="text-text-muted text-xs">{u.groups?.join(', ') || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-text-muted text-sm py-4 text-center">No IAM user data available</p>}
        </div>
      </CollapsibleSection>

      {/* Section 5: Security Groups */}
      <CollapsibleSection id="sgs" title="Risky Security Groups" count={sgs.risky_groups?.length || 0}
        icon={<ShieldAlert className="w-4 h-4 text-red-400" />} color="#ef4444">
        <div className="mt-4">
          {sgs.risky_groups?.length > 0 ? (
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="corp-table w-full">
                <thead>
                  <tr><th>Severity</th><th>Group</th><th>ID</th><th>Region</th><th>Open Ports</th></tr>
                </thead>
                <tbody>
                  {sgs.risky_groups.map((sg, i) => (
                    <tr key={i}>
                      <td><StatusBadge status={sg.severity} /></td>
                      <td className="text-text font-medium">{sg.group_name}</td>
                      <td className="font-mono text-[10px] text-text-muted">{sg.group_id}</td>
                      <td className="text-text-muted text-xs">{sg.region}</td>
                      <td className="text-xs">
                        {sg.open_rules.map((r, j) => (
                          <span key={j} className="inline-block mr-1 px-1.5 py-0.5 rounded bg-red-500/8 text-red-400 text-[10px] font-mono">
                            {r.protocol === '-1' ? 'ALL' : `${r.protocol}:${r.from_port}`}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-text-muted text-sm py-4 text-center">No risky security groups found</p>}
        </div>
      </CollapsibleSection>

      {/* Section 6: AI Recommendations */}
      <CollapsibleSection id="ai" title="AI Security Intelligence" icon={<Brain className="w-4 h-4 text-purple-400" />} color="#8b5cf6">
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[
            { key: 'summary', title: 'Cloud Posture Summary', icon: Cloud, color: '#7c3aed' },
            { key: 'risk', title: 'Top Security Risks', icon: AlertTriangle, color: '#ef4444' },
            { key: 'recommend', title: 'Recommendations & Best Practices', icon: Zap, color: '#f59e0b' },
            { key: 'compliance', title: 'Compliance Assessment', icon: Shield, color: '#10b981' },
            { key: 'public', title: 'Public Exposure Analysis', icon: Globe, color: '#06b6d4' },
            { key: 'iam', title: 'IAM & Authentication Review', icon: Lock, color: '#8b5cf6' },
          ].map(({ key, title, icon: Icon, color }) => (
            <div key={key} className={`rounded-xl border border-border/20 bg-surface/30 p-4 risk-${key === 'risk' ? 'critical' : key === 'recommend' ? 'medium' : 'info'}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${color}12` }}>
                  <Icon className="w-3 h-3" style={{ color }} />
                </div>
                <span className="text-xs font-semibold text-text">{title}</span>
              </div>
              <RenderAiContent content={ai[key]} />
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Footer */}
      <div className="text-center py-4 border-t border-border/20">
        <p className="text-[10px] text-text-muted/50">
          CloudSentinel Enterprise Security Platform &bull; Report generated {new Date(data.generated_at).toLocaleString()} &bull; Account: {data.account}
        </p>
      </div>
    </div>
  );
}
