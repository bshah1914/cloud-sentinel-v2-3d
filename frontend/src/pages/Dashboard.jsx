import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Server, Shield, Globe, Database, CloudLightning, Layers,
  AlertTriangle, MapPin, ScanLine, Plus, Users, Lock, Unlock,
  HardDrive, Network, Camera, Activity, CheckCircle2, XCircle,
  Info, ChevronDown, ChevronUp
} from 'lucide-react';
import { getDashboard } from '../api';
import StatCard from '../components/StatCard';
import SecurityScore from '../components/SecurityScore';
import Card from '../components/Card';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';

// CloudMapper severity colors
const SEVERITY = {
  critical: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30', dot: 'bg-red-500' },
  high:     { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30', dot: 'bg-orange-500' },
  medium:   { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-500' },
  low:      { bg: 'bg-yellow-500/15', text: 'text-yellow-400', border: 'border-yellow-500/30', dot: 'bg-yellow-500' },
  info:     { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
};

function SeverityBadge({ level }) {
  const s = SEVERITY[level] || SEVERITY.info;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text} border ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

const RESOURCE_LABELS = {
  instances: 'EC2',
  security_groups: 'Security Groups',
  vpcs: 'VPCs',
  subnets: 'Subnets',
  lambdas: 'Lambda',
  rds: 'RDS',
  elbs: 'ELB/ALB',
  snapshots: 'Snapshots',
};

export default function Dashboard() {
  const { account, accounts } = useOutletContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [noData, setNoData] = useState(false);
  const [expandedRegion, setExpandedRegion] = useState(null);
  const [showAllPublicIps, setShowAllPublicIps] = useState(false);

  useEffect(() => {
    if (!account) {
      setLoading(false);
      setNoData(true);
      return;
    }
    setLoading(true);
    setError(null);
    setNoData(false);
    setData(null);
    getDashboard(account)
      .then((res) => {
        setData(res);
        setNoData(false);
      })
      .catch((e) => {
        if (e.message.includes('No data') || e.message.includes('404')) {
          setNoData(true);
          setError(null);
        } else {
          setError(e.message);
        }
      })
      .finally(() => setLoading(false));
  }, [account]);

  if (loading) return <Loader text="Loading dashboard..." />;

  if (!account || accounts.length === 0) {
    return (
      <EmptyState
        icon={Plus}
        title="No accounts configured"
        description="Add an AWS account first to get started."
        action={
          <Link to="/accounts" className="px-5 py-2.5 bg-primary hover:bg-primary-dark rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Account
          </Link>
        }
      />
    );
  }

  if (noData) {
    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-text-muted text-sm mt-1">
            Account: <span className="text-accent">{account}</span>
          </p>
        </motion.div>
        <EmptyState
          icon={ScanLine}
          title="No data collected yet"
          description={`Account "${account}" has no scan data. Run a scan to collect AWS resource data and view the dashboard.`}
          action={
            <Link to="/scan" className="px-5 py-2.5 bg-primary hover:bg-primary-dark rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2">
              <ScanLine className="w-4 h-4" /> Go to Scans
            </Link>
          }
        />
      </div>
    );
  }

  if (error) return <EmptyState icon={AlertTriangle} title="Error loading dashboard" description={error} />;
  if (!data) return <EmptyState title="No data available" description="Select an account to view the dashboard" />;

  const {
    totals, regions, region_matrix, public_ips, public_summary,
    security_score, iam_summary, iam_users, iam_users_no_mfa,
    open_security_groups, regions_scanned, caller_identity, collection_date,
  } = data;

  // Regions with resources, sorted by total resource count
  const activeRegions = Object.entries(regions)
    .filter(([, stats]) => stats.has_resources)
    .sort((a, b) => {
      const sumA = (a[1].instances || 0) + (a[1].security_groups || 0) + (a[1].vpcs || 0) + (a[1].lambdas || 0) + (a[1].rds || 0) + (a[1].elbs || 0);
      const sumB = (b[1].instances || 0) + (b[1].security_groups || 0) + (b[1].vpcs || 0) + (b[1].lambdas || 0) + (b[1].rds || 0) + (b[1].elbs || 0);
      return sumB - sumA;
    });

  const regionBarData = activeRegions.map(([name, stats]) => ({
    name: name,
    EC2: stats.instances || 0,
    SGs: stats.security_groups || 0,
    VPCs: stats.vpcs || 0,
    Lambda: stats.lambdas || 0,
    RDS: stats.rds || 0,
    ELB: stats.elbs || 0,
  }));

  const resourcePie = [
    { name: 'EC2', value: totals.instances, color: '#6366f1' },
    { name: 'S3', value: totals.buckets, color: '#06b6d4' },
    { name: 'Lambda', value: totals.lambdas, color: '#10b981' },
    { name: 'RDS', value: totals.rds, color: '#f59e0b' },
    { name: 'ELB', value: totals.elbs, color: '#ef4444' },
    { name: 'SGs', value: totals.security_groups, color: '#8b5cf6' },
  ].filter((d) => d.value > 0);

  // Security findings for severity badges
  const findings = [];
  if (!iam_summary.AccountMFAEnabled) findings.push({ text: 'Root account MFA not enabled', severity: 'critical' });
  if (iam_summary.AccountAccessKeysPresent) findings.push({ text: 'Root account has access keys', severity: 'critical' });
  if (public_summary?.rds > 0) findings.push({ text: `${public_summary.rds} publicly accessible RDS instance(s)`, severity: 'high' });
  if (open_security_groups > 0) findings.push({ text: `${open_security_groups} security group rule(s) open to 0.0.0.0/0`, severity: 'high' });
  if (public_summary?.ec2 > 0) findings.push({ text: `${public_summary.ec2} EC2 instance(s) with public IPs`, severity: 'medium' });
  if (iam_users_no_mfa > 0) findings.push({ text: `${iam_users_no_mfa} IAM user(s) without MFA`, severity: 'medium' });
  if (public_summary?.elb > 0) findings.push({ text: `${public_summary.elb} internet-facing load balancer(s)`, severity: 'low' });
  if (findings.length === 0) findings.push({ text: 'No major issues detected', severity: 'info' });

  const publicIpsToShow = showAllPublicIps ? public_ips : public_ips.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-text-muted text-sm mt-1">
            Account: <span className="text-accent">{account}</span>
            {caller_identity?.Account && (
              <span className="ml-2 text-text-muted">({caller_identity.Account})</span>
            )}
          </p>
          <p className="text-text-muted text-xs mt-0.5">
            {regions_scanned} region(s) scanned
            {collection_date && ` • Last updated: ${new Date(collection_date).toLocaleString()}`}
          </p>
        </div>
      </motion.div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <StatCard icon={Server} label="EC2 Instances" value={totals.instances} color="primary" delay={0} />
        <StatCard icon={Database} label="S3 Buckets" value={totals.buckets} color="accent" delay={0.05} />
        <StatCard icon={Shield} label="Security Groups" value={totals.security_groups} color="warning" delay={0.1} />
        <StatCard icon={Layers} label="VPCs" value={totals.vpcs} color="success" delay={0.15} />
        <StatCard icon={CloudLightning} label="Lambda Functions" value={totals.lambdas} color="info" delay={0.2} />
        <StatCard icon={Database} label="RDS Instances" value={totals.rds} color="danger" delay={0.25} />
        <StatCard icon={Globe} label="ELBs" value={totals.elbs} color="primary" delay={0.3} />
        <StatCard icon={Network} label="Subnets" value={totals.subnets} color="accent" delay={0.35} />
        <StatCard icon={Camera} label="Snapshots" value={totals.snapshots} color="warning" delay={0.4} />
        <StatCard icon={HardDrive} label="NICs" value={totals.network_interfaces} color="info" delay={0.45} />
      </div>

      {/* Security Score + Findings + Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Security Score */}
        <Card delay={0.1} className="flex flex-col items-center justify-center">
          <SecurityScore score={security_score} />
          <div className="mt-4 grid grid-cols-2 gap-3 w-full text-xs">
            <div className="flex items-center justify-between bg-surface/50 rounded-lg px-3 py-2">
              <span className="text-text-muted">MFA Enabled</span>
              <span className={iam_summary.AccountMFAEnabled ? 'text-emerald-400' : 'text-red-400'}>
                {iam_summary.AccountMFAEnabled ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between bg-surface/50 rounded-lg px-3 py-2">
              <span className="text-text-muted">Public IPs</span>
              <span className={public_ips.length > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                {public_ips.length}
              </span>
            </div>
            <div className="flex items-center justify-between bg-surface/50 rounded-lg px-3 py-2">
              <span className="text-text-muted">Open SGs</span>
              <span className={open_security_groups > 0 ? 'text-red-400' : 'text-emerald-400'}>
                {open_security_groups}
              </span>
            </div>
            <div className="flex items-center justify-between bg-surface/50 rounded-lg px-3 py-2">
              <span className="text-text-muted">No MFA Users</span>
              <span className={iam_users_no_mfa > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                {iam_users_no_mfa}
              </span>
            </div>
          </div>
        </Card>

        {/* Security Findings */}
        <Card delay={0.15}>
          <h3 className="text-sm font-semibold text-text-muted mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Security Findings
          </h3>
          <div className="space-y-2.5 max-h-72 overflow-y-auto">
            {findings.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.05 }}
                className={`flex items-start gap-3 p-2.5 rounded-lg ${SEVERITY[f.severity].bg} border ${SEVERITY[f.severity].border}`}
              >
                <span className={`mt-0.5 ${SEVERITY[f.severity].text}`}>
                  {f.severity === 'critical' || f.severity === 'high' ? (
                    <XCircle className="w-4 h-4" />
                  ) : f.severity === 'info' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text">{f.text}</p>
                </div>
                <SeverityBadge level={f.severity} />
              </motion.div>
            ))}
          </div>
        </Card>

        {/* Resource Distribution Pie */}
        <Card delay={0.2}>
          <h3 className="text-sm font-semibold text-text-muted mb-4">Resource Distribution</h3>
          {resourcePie.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={resourcePie}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    animationBegin={300}
                    animationDuration={800}
                  >
                    {resourcePie.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#f1f5f9',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 justify-center">
                {resourcePie.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                    <span className="text-text-muted">{d.name}</span>
                    <span className="text-text font-medium">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-text-muted text-sm">
              No resources found
            </div>
          )}
        </Card>
      </div>

      {/* Region Usage Matrix (CloudMapper style) */}
      {region_matrix && Object.keys(region_matrix).length > 0 && (
        <Card delay={0.25}>
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-semibold">Region Usage Matrix</h3>
            <span className="text-xs text-text-muted">({Object.keys(region_matrix).length} regions)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-text-muted border-b border-border">
                  <th className="pb-2.5 text-left font-medium pr-4 sticky left-0 bg-surface-light">Region</th>
                  {Object.keys(RESOURCE_LABELS).map((key) => (
                    <th key={key} className="pb-2.5 text-center font-medium px-2 whitespace-nowrap">
                      {RESOURCE_LABELS[key]}
                    </th>
                  ))}
                  <th className="pb-2.5 text-center font-medium px-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(region_matrix)
                  .sort((a, b) => {
                    const sumA = Object.values(a[1]).reduce((s, v) => s + v, 0);
                    const sumB = Object.values(b[1]).reduce((s, v) => s + v, 0);
                    return sumB - sumA;
                  })
                  .map(([region, resources], i) => {
                    const total = Object.values(resources).reduce((s, v) => s + v, 0);
                    const hasResources = total > 0;
                    return (
                      <motion.tr
                        key={region}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 + i * 0.02 }}
                        className={`border-b border-border/30 ${hasResources ? 'hover:bg-surface-lighter/30' : 'opacity-50'}`}
                      >
                        <td className="py-2.5 pr-4 font-mono text-text sticky left-0 bg-surface-light">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${hasResources ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                            {region}
                          </div>
                        </td>
                        {Object.keys(RESOURCE_LABELS).map((key) => {
                          const val = resources[key] || 0;
                          return (
                            <td key={key} className="py-2.5 text-center px-2">
                              {val > 0 ? (
                                <span className="inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 font-medium">
                                  {val}
                                </span>
                              ) : (
                                <span className="text-gray-600">-</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2.5 text-center px-2">
                          <span className={`font-semibold ${hasResources ? 'text-text' : 'text-gray-600'}`}>
                            {total}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                {/* Totals row */}
                <tr className="border-t-2 border-border font-semibold">
                  <td className="py-2.5 pr-4 text-text sticky left-0 bg-surface-light">Total</td>
                  {Object.keys(RESOURCE_LABELS).map((key) => {
                    const colTotal = Object.values(region_matrix).reduce((s, r) => s + (r[key] || 0), 0);
                    return (
                      <td key={key} className="py-2.5 text-center px-2 text-primary">
                        {colTotal > 0 ? colTotal : '-'}
                      </td>
                    );
                  })}
                  <td className="py-2.5 text-center px-2 text-primary">
                    {Object.values(region_matrix).reduce((s, r) => s + Object.values(r).reduce((a, b) => a + b, 0), 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Region Bar Chart */}
      {regionBarData.length > 0 && (
        <Card delay={0.3}>
          <h3 className="text-sm font-semibold text-text-muted mb-4">Resources by Region</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={regionBarData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                  fontSize: '12px',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="EC2" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="SGs" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Lambda" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="RDS" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ELB" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Per-Region Expandable Details */}
      {activeRegions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-text-muted mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" /> Region Details ({activeRegions.length} active)
          </h2>
          <div className="space-y-2">
            {activeRegions.map(([regionName, stats], i) => (
              <motion.div
                key={regionName}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-surface-light border border-border rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedRegion(expandedRegion === regionName ? null : regionName)}
                  className="w-full flex items-center justify-between p-4 hover:bg-surface-lighter/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-cyan-400" />
                    <span className="font-mono text-sm font-medium">{regionName}</span>
                    <div className="flex items-center gap-2 ml-2">
                      {stats.instances > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-400">
                          {stats.instances} EC2
                        </span>
                      )}
                      {stats.lambdas > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                          {stats.lambdas} Lambda
                        </span>
                      )}
                      {stats.rds > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-400">
                          {stats.rds} RDS
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {stats.guardduty_enabled ? (
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <Shield className="w-3 h-3" /> GuardDuty
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600 flex items-center gap-1">
                        <Shield className="w-3 h-3" /> No GuardDuty
                      </span>
                    )}
                    {expandedRegion === regionName ? (
                      <ChevronUp className="w-4 h-4 text-text-muted" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-text-muted" />
                    )}
                  </div>
                </button>

                <AnimatePresence>
                  {expandedRegion === regionName && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {[
                          { label: 'EC2 Instances', value: stats.instances, sub: `${stats.instances_running || 0} running / ${stats.instances_stopped || 0} stopped` },
                          { label: 'Security Groups', value: stats.security_groups },
                          { label: 'VPCs', value: stats.vpcs },
                          { label: 'Subnets', value: stats.subnets },
                          { label: 'Lambda', value: stats.lambdas },
                          { label: 'RDS', value: stats.rds },
                          { label: 'ELBs', value: stats.elbs },
                          { label: 'Snapshots', value: stats.snapshots },
                          { label: 'NICs', value: stats.network_interfaces },
                          { label: 'CloudTrail', value: stats.cloudtrail_trails, sub: stats.cloudtrail_trails > 0 ? 'Active' : 'None' },
                        ].map(({ label, value, sub }) => (
                          <div key={label} className="bg-surface/50 rounded-lg p-3">
                            <p className="text-lg font-bold text-text">{value || 0}</p>
                            <p className="text-xs text-text-muted">{label}</p>
                            {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Public Network Resources */}
      {public_ips.length > 0 && (
        <Card delay={0.4}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-semibold">Public Network Resources ({public_ips.length})</h3>
            </div>
            {public_summary && (
              <div className="flex items-center gap-3 text-xs">
                {public_summary.ec2 > 0 && (
                  <span className="px-2 py-1 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                    {public_summary.ec2} EC2
                  </span>
                )}
                {public_summary.rds > 0 && (
                  <span className="px-2 py-1 rounded bg-red-500/15 text-red-400 border border-red-500/20">
                    {public_summary.rds} RDS
                  </span>
                )}
                {public_summary.elb > 0 && (
                  <span className="px-2 py-1 rounded bg-purple-500/15 text-purple-400 border border-purple-500/20">
                    {public_summary.elb} ELB
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted text-left border-b border-border">
                  <th className="pb-3 font-medium">IP / DNS</th>
                  <th className="pb-3 font-medium">Resource</th>
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Instance</th>
                  <th className="pb-3 font-medium">State</th>
                  <th className="pb-3 font-medium">Region</th>
                </tr>
              </thead>
              <tbody>
                {publicIpsToShow.map((ip, i) => (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.03 }}
                    className="border-b border-border/50 hover:bg-surface-lighter/30 transition-colors"
                  >
                    <td className="py-2.5 font-mono text-amber-400 text-xs max-w-[200px] truncate">{ip.ip}</td>
                    <td className="py-2.5 font-mono text-text-muted text-xs">{ip.resource}</td>
                    <td className="py-2.5 text-xs text-text">{ip.name || '-'}</td>
                    <td className="py-2.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        ip.type === 'EC2' ? 'bg-indigo-500/15 text-indigo-400' :
                        ip.type === 'RDS' ? 'bg-red-500/15 text-red-400' :
                        'bg-purple-500/15 text-purple-400'
                      }`}>
                        {ip.type}
                      </span>
                    </td>
                    <td className="py-2.5 text-xs text-text-muted font-mono">{ip.instance_type || '-'}</td>
                    <td className="py-2.5">
                      <span className={`text-xs ${
                        ip.state === 'running' || ip.state === 'active' || ip.state === 'available' ? 'text-emerald-400' :
                        ip.state === 'stopped' ? 'text-gray-500' : 'text-amber-400'
                      }`}>
                        {ip.state || '-'}
                      </span>
                    </td>
                    <td className="py-2.5 text-xs flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-text-muted" />
                      {ip.region}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          {public_ips.length > 10 && (
            <button
              onClick={() => setShowAllPublicIps(!showAllPublicIps)}
              className="mt-3 text-xs text-primary hover:text-primary-dark transition-colors"
            >
              {showAllPublicIps ? 'Show less' : `Show all ${public_ips.length} resources`}
            </button>
          )}
        </Card>
      )}

      {/* IAM Overview */}
      <Card delay={0.5}>
        <h3 className="text-sm font-semibold text-text-muted mb-4 flex items-center gap-2">
          <Users className="w-4 h-4" /> IAM Overview
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-4">
          {[
            { label: 'Users', value: iam_summary.Users, color: 'text-indigo-400' },
            { label: 'Roles', value: iam_summary.Roles, color: 'text-cyan-400' },
            { label: 'Groups', value: iam_summary.Groups, color: 'text-emerald-400' },
            { label: 'Policies', value: iam_summary.Policies, color: 'text-amber-400' },
            { label: 'MFA Devices', value: iam_summary.MFADevices, color: 'text-blue-400' },
            { label: 'Access Keys Quota', value: iam_summary.AccessKeysPerUserQuota, color: 'text-purple-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-surface/50 rounded-lg p-3 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value ?? '-'}</p>
              <p className="text-xs text-text-muted mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* IAM Users detail table */}
        {iam_users && iam_users.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-text-muted mb-2">IAM Users ({iam_users.length})</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-muted border-b border-border">
                    <th className="pb-2 text-left font-medium">Username</th>
                    <th className="pb-2 text-center font-medium">MFA</th>
                    <th className="pb-2 text-center font-medium">Policies</th>
                    <th className="pb-2 text-left font-medium">Groups</th>
                    <th className="pb-2 text-left font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {iam_users.map((u) => (
                    <tr key={u.name} className="border-b border-border/30 hover:bg-surface-lighter/30">
                      <td className="py-2 font-mono text-text">{u.name}</td>
                      <td className="py-2 text-center">
                        {u.has_mfa ? (
                          <Lock className="w-3.5 h-3.5 text-emerald-400 mx-auto" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5 text-red-400 mx-auto" />
                        )}
                      </td>
                      <td className="py-2 text-center text-text-muted">{u.policies_count}</td>
                      <td className="py-2 text-text-muted">{u.groups?.join(', ') || '-'}</td>
                      <td className="py-2 text-text-muted">{u.created ? new Date(u.created).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
