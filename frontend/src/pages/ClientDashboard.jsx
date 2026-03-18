import { useState, useEffect } from 'react';
import { getClientProfile, getClientActivity, getClientInvoices } from '../api';

export default function ClientDashboard() {
  const [profile, setProfile] = useState(null);
  const [activity, setActivity] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [p, a, i] = await Promise.all([getClientProfile(), getClientActivity(), getClientInvoices()]);
        setProfile(p);
        setActivity(a.activity || []);
        setInvoices(i.invoices || []);
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full"><div className="text-gray-400">Loading...</div></div>;
  if (!profile) return <div className="p-6 text-gray-400">Unable to load client profile. Contact your administrator.</div>;

  const org = profile.organization;
  const plan = profile.plan;

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Welcome, {org.name}</h1>
        <p className="text-sm text-gray-400 mt-1">Your cloud security overview</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1e1b4b]/50 p-1 rounded-lg w-fit">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'plan', label: 'My Plan' },
          { id: 'team', label: 'Team' },
          { id: 'billing', label: 'Billing' },
          { id: 'activity', label: 'Activity' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === t.id ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { l: 'Security Score', v: org.security_score ?? 'N/A', c: (org.security_score || 0) > 70 ? '#10b981' : '#f59e0b' },
              { l: 'Resources', v: org.total_resources || 0, c: '#06b6d4' },
              { l: 'Findings', v: org.total_findings || 0, c: '#ef4444' },
              { l: 'Scans This Month', v: `${org.scans_this_month || 0}/${plan.max_scans_per_month === -1 ? '∞' : plan.max_scans_per_month}`, c: '#7c3aed' },
            ].map((s, i) => (
              <div key={i} className="bg-[#1e1b4b]/60 border border-white/5 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">{s.l}</p>
                <p className="text-2xl font-bold" style={{ color: s.c }}>{s.v}</p>
              </div>
            ))}
          </div>
          {org.last_scan && (
            <p className="text-xs text-gray-500">Last scan: {new Date(org.last_scan).toLocaleString()}</p>
          )}
        </div>
      )}

      {/* Plan */}
      {tab === 'plan' && (
        <div className="bg-[#1e1b4b]/60 border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Current Plan: <span className="text-violet-400">{plan.name}</span></h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { l: 'Price', v: plan.price === 0 ? 'Free' : `$${plan.price}/month` },
              { l: 'Cloud Accounts', v: plan.max_accounts === -1 ? 'Unlimited' : plan.max_accounts },
              { l: 'Scans/Month', v: plan.max_scans_per_month === -1 ? 'Unlimited' : plan.max_scans_per_month },
              { l: 'Team Members', v: plan.max_users === -1 ? 'Unlimited' : plan.max_users },
              { l: 'Compliance Frameworks', v: plan.compliance_frameworks },
              { l: 'Support Level', v: plan.support?.charAt(0).toUpperCase() + plan.support?.slice(1) },
            ].map((s, i) => (
              <div key={i} className="py-2 border-b border-white/5">
                <span className="text-xs text-gray-400">{s.l}</span>
                <p className="text-sm text-white font-medium">{s.v}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <h4 className="text-xs text-gray-400 mb-2">Features</h4>
            <div className="flex flex-wrap gap-2">
              {(plan.features || []).map(f => (
                <span key={f} className="text-xs px-2 py-1 bg-violet-600/20 text-violet-300 rounded-full">{f.replace(/_/g, ' ')}</span>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">Contact your administrator to upgrade your plan.</p>
        </div>
      )}

      {/* Team */}
      {tab === 'team' && (
        <div className="bg-[#1e1b4b]/60 border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Team Members ({(profile.users || []).length}/{plan.max_users === -1 ? '∞' : plan.max_users})</h3>
          <div className="space-y-2">
            {(profile.users || []).map(u => (
              <div key={u.id} className="flex items-center justify-between py-2 border-b border-white/5">
                <div>
                  <span className="text-sm text-white font-medium">{u.username}</span>
                  <span className="text-xs text-gray-500 ml-2">{u.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-1 rounded bg-violet-600/20 text-violet-300">{u.role}</span>
                  <span className={`text-xs ${u.status === 'active' ? 'text-green-400' : 'text-red-400'}`}>{u.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Billing */}
      {tab === 'billing' && (
        <div className="bg-[#1e1b4b]/60 border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Invoices</h3>
          {invoices.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  {['Invoice ID', 'Amount', 'Description', 'Status', 'Date'].map(h => (
                    <th key={h} className="text-left text-xs text-gray-400 px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className="border-b border-white/5">
                    <td className="px-3 py-2 text-sm text-white">{inv.id}</td>
                    <td className="px-3 py-2 text-sm text-green-400">${inv.amount}</td>
                    <td className="px-3 py-2 text-sm text-gray-300">{inv.description}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${inv.status === 'paid' ? 'bg-green-600/20 text-green-400' : 'bg-yellow-600/20 text-yellow-400'}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{new Date(inv.created).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-gray-500 text-sm">No invoices yet</p>}
        </div>
      )}

      {/* Activity */}
      {tab === 'activity' && (
        <div className="bg-[#1e1b4b]/60 border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Activity Log</h3>
          <div className="space-y-2">
            {activity.map((a, i) => (
              <div key={i} className="flex justify-between text-sm py-2 border-b border-white/5">
                <span className="text-gray-300">{a.action}</span>
                <span className="text-gray-500 text-xs">{new Date(a.timestamp).toLocaleString()}</span>
              </div>
            ))}
            {activity.length === 0 && <p className="text-gray-500 text-sm">No activity yet</p>}
          </div>
        </div>
      )}
    </div>
  );
}
