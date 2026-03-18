import { useState, useEffect } from 'react';
import { getClientProfile, getMultiCloudOverview, getResources, getThreats, getComplianceResults, getSecurityGroups, getIAM } from '../api';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';

const COLORS = ['#7c3aed', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6'];

export default function ClientDashboard() {
  const [profile, setProfile] = useState(null);
  const [overview, setOverview] = useState(null);
  const [threats, setThreats] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [secGroups, setSecGroups] = useState(null);
  const [iam, setIam] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const p = await getClientProfile();
        setProfile(p);
        const accountName = p.organization?.cloud_accounts?.[0]?.name;
        if (accountName) {
          const [ov, th, comp, sg, im] = await Promise.allSettled([
            getMultiCloudOverview(),
            getThreats(accountName),
            getComplianceResults(accountName),
            getSecurityGroups(accountName),
            getIAM(accountName),
          ]);
          if (ov.status === 'fulfilled') setOverview(ov.value);
          if (th.status === 'fulfilled') setThreats(th.value);
          if (comp.status === 'fulfilled') setCompliance(comp.value);
          if (sg.status === 'fulfilled') setSecGroups(sg.value);
          if (im.status === 'fulfilled') setIam(im.value);
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full"><div className="text-gray-400">Loading unified dashboard...</div></div>;
  if (!profile) return <div className="p-6 text-gray-400">Unable to load dashboard. Contact your administrator.</div>;

  const org = profile.organization;
  const plan = profile.plan;
  const score = org.security_score || overview?.avg_security_score || 0;
  const scoreColor = score > 70 ? '#10b981' : score > 40 ? '#f59e0b' : '#ef4444';
  const totalResources = org.total_resources || overview?.total_resources || 0;
  const totalFindings = org.total_findings || overview?.total_findings || 0;

  // Threat stats
  const threatList = threats?.threats || [];
  const criticalThreats = threatList.filter(t => t.severity === 'CRITICAL').length;
  const highThreats = threatList.filter(t => t.severity === 'HIGH').length;
  const mediumThreats = threatList.filter(t => t.severity === 'MEDIUM').length;
  const threatBySeverity = [
    { name: 'Critical', value: criticalThreats, color: '#ef4444' },
    { name: 'High', value: highThreats, color: '#f59e0b' },
    { name: 'Medium', value: mediumThreats, color: '#3b82f6' },
    { name: 'Low', value: threatList.filter(t => t.severity === 'LOW').length, color: '#10b981' },
  ].filter(t => t.value > 0);

  const threatByCategory = {};
  threatList.forEach(t => { threatByCategory[t.category] = (threatByCategory[t.category] || 0) + 1; });
  const threatCategoryData = Object.entries(threatByCategory).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }));

  // Compliance stats
  const compFrameworks = compliance?.frameworks || [];
  const compData = compFrameworks.map(f => ({
    name: f.short_name || f.name?.substring(0, 8),
    score: f.score || 0,
  }));
  const avgCompliance = compFrameworks.length > 0 ? Math.round(compFrameworks.reduce((s, f) => s + (f.score || 0), 0) / compFrameworks.length) : 0;

  // Security groups
  const riskyGroups = secGroups?.risky_groups || [];

  // IAM
  const iamUsers = iam?.users || [];
  const iamRoles = iam?.roles || [];
  const usersWithoutMFA = iamUsers.filter(u => !u.mfa_devices || u.mfa_devices.length === 0).length;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">{org.name} — Unified security overview</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs px-3 py-1.5 rounded-full bg-violet-600/20 text-violet-300 font-medium">{plan.name} Plan</span>
          <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${org.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{org.status}</span>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { l: 'Security Score', v: score || 'N/A', c: scoreColor },
          { l: 'Resources', v: totalResources, c: '#06b6d4' },
          { l: 'Findings', v: totalFindings, c: '#f59e0b' },
          { l: 'Threats', v: threatList.length, c: '#ef4444' },
          { l: 'Compliance', v: avgCompliance ? `${avgCompliance}%` : 'N/A', c: '#7c3aed' },
          { l: 'Risky SGs', v: riskyGroups.length, c: '#ec4899' },
        ].map((s, i) => (
          <div key={i} className="bg-[#1e1b4b]/60 border border-white/5 rounded-xl p-4">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{s.l}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.c }}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* Row 2: Score Ring + Threat Pie + Compliance Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Security Score Ring */}
        <div className="bg-[#1e1b4b]/60 border border-white/5 rounded-xl p-5 flex flex-col items-center justify-center">
          <p className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-wider">Security Score</p>
          <div className="relative w-28 h-28">
            <svg className="w-28 h-28 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#1e1b4b" strokeWidth="8" />
              <circle cx="60" cy="60" r="52" fill="none" stroke={scoreColor} strokeWidth="8"
                strokeDasharray={`${score * 3.27} 327`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-white">{score}</span>
              <span className="text-[10px] text-gray-400">/ 100</span>
            </div>
          </div>
          <p className="text-xs mt-2 font-medium" style={{ color: scoreColor }}>
            {score > 70 ? 'Good' : score > 40 ? 'Needs Work' : 'Critical'}
          </p>
        </div>

        {/* Threat Severity Pie */}
        <div className="bg-[#1e1b4b]/60 border border-white/5 rounded-xl p-5">
          <p className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-wider">Threats by Severity</p>
          {threatBySeverity.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie data={threatBySeverity} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" stroke="none">
                    {threatBySeverity.map((t, i) => <Cell key={i} fill={t.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {threatBySeverity.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />
                    <span className="text-xs text-gray-300">{t.name}: <span className="text-white font-bold">{t.value}</span></span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-gray-500 text-sm">No threats detected</p>}
        </div>

        {/* Compliance Scores */}
        <div className="bg-[#1e1b4b]/60 border border-white/5 rounded-xl p-5">
          <p className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-wider">Compliance Scores</p>
          {compData.length > 0 ? (
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={compData} barSize={16}>
                <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#1e1b4b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 12 }} />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {compData.map((d, i) => <Cell key={i} fill={d.score > 70 ? '#10b981' : d.score > 40 ? '#f59e0b' : '#ef4444'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-500 text-sm">Run a compliance scan to see results</p>}
        </div>
      </div>

      {/* Row 3: Threat Categories + IAM Summary + Risky Security Groups */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Threat Categories */}
        <div className="bg-[#1e1b4b]/60 border border-white/5 rounded-xl p-5">
          <p className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-wider">Threat Categories</p>
          <div className="space-y-2">
            {threatCategoryData.slice(0, 6).map((t, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs text-gray-300 capitalize">{t.name}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 h-1.5 bg-[#0f0a2a] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(t.value / Math.max(...threatCategoryData.map(c => c.value)) * 100, 100)}%`, background: COLORS[i % COLORS.length] }} />
                  </div>
                  <span className="text-xs text-white font-bold w-4 text-right">{t.value}</span>
                </div>
              </div>
            ))}
            {threatCategoryData.length === 0 && <p className="text-gray-500 text-sm">No threats</p>}
          </div>
        </div>

        {/* IAM Summary */}
        <div className="bg-[#1e1b4b]/60 border border-white/5 rounded-xl p-5">
          <p className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-wider">IAM Overview</p>
          <div className="space-y-3">
            {[
              { l: 'IAM Users', v: iamUsers.length, c: '#06b6d4' },
              { l: 'IAM Roles', v: iamRoles.length, c: '#7c3aed' },
              { l: 'Users without MFA', v: usersWithoutMFA, c: usersWithoutMFA > 0 ? '#ef4444' : '#10b981' },
              { l: 'Policies', v: iam?.policies?.length || 0, c: '#f59e0b' },
            ].map((s, i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-xs text-gray-400">{s.l}</span>
                <span className="text-sm font-bold" style={{ color: s.c }}>{s.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risky Security Groups */}
        <div className="bg-[#1e1b4b]/60 border border-white/5 rounded-xl p-5">
          <p className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-wider">Risky Security Groups</p>
          <div className="space-y-2 max-h-[160px] overflow-y-auto">
            {riskyGroups.slice(0, 5).map((sg, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-[#0f0a2a]/50">
                <div>
                  <p className="text-xs text-white font-medium">{sg.group_name}</p>
                  <p className="text-[10px] text-gray-500">{sg.region}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${sg.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {sg.severity}
                </span>
              </div>
            ))}
            {riskyGroups.length === 0 && <p className="text-gray-500 text-sm">No risky groups found</p>}
            {riskyGroups.length > 5 && <p className="text-xs text-violet-400 text-center mt-1">+{riskyGroups.length - 5} more</p>}
          </div>
        </div>
      </div>

      {/* Row 4: Top Threats List */}
      {threatList.length > 0 && (
        <div className="bg-[#1e1b4b]/60 border border-white/5 rounded-xl p-5">
          <p className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-wider">Top Threats</p>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {threatList.filter(t => t.severity === 'CRITICAL' || t.severity === 'HIGH').slice(0, 8).map((t, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[#0f0a2a]/50 border border-white/5">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${t.severity === 'CRITICAL' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                  <div>
                    <p className="text-sm text-white">{t.title}</p>
                    <p className="text-[10px] text-gray-500">{t.category?.replace(/_/g, ' ')} — {t.mitre_tactic}</p>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${t.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {t.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer info */}
      <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
        <span>Last scan: {org.last_scan ? new Date(org.last_scan).toLocaleString() : 'Never'}</span>
        <span>Scans: {org.scans_this_month || 0}/{plan.max_scans_per_month === -1 ? '∞' : plan.max_scans_per_month} this month</span>
      </div>
    </div>
  );
}
