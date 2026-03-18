import { useState, useEffect } from 'react';
import { getAdminStats, getAdminClients, createClient, updateClient, deleteClient, createClientUser, getClient, getAdminActivity } from '../api';

const plans = { free: { color: '#6b7280', label: 'Free' }, pro: { color: '#7c3aed', label: 'Pro' }, enterprise: { color: '#f59e0b', label: 'Enterprise' } };
const statusColors = { active: '#10b981', suspended: '#ef4444', cancelled: '#6b7280' };

export default function AdminPanel() {
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [activity, setActivity] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [s, c, a] = await Promise.all([getAdminStats(), getAdminClients(), getAdminActivity()]);
      setStats(s);
      setClients(c.clients || []);
      setActivity(a.activity || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handleAddClient(e) {
    e.preventDefault();
    try {
      await createClient(form);
      setShowAddClient(false);
      setForm({});
      setMsg('Client created successfully');
      loadData();
    } catch (e) { setMsg('Error: ' + e.message); }
  }

  async function handleAddUser(e) {
    e.preventDefault();
    try {
      await createClientUser(selectedClient.id, form);
      setShowAddUser(false);
      setForm({});
      const c = await getClient(selectedClient.id);
      setSelectedClient(c);
      setMsg('User created successfully');
    } catch (e) { setMsg('Error: ' + e.message); }
  }

  async function handleStatusChange(orgId, status) {
    await updateClient(orgId, { status });
    loadData();
    if (selectedClient?.id === orgId) {
      const c = await getClient(orgId);
      setSelectedClient(c);
    }
  }

  async function handlePlanChange(orgId, plan) {
    await updateClient(orgId, { plan });
    loadData();
    if (selectedClient?.id === orgId) {
      const c = await getClient(orgId);
      setSelectedClient(c);
    }
  }

  async function handleDeleteClient(orgId) {
    if (!confirm('Delete this client and all their data?')) return;
    await deleteClient(orgId);
    setSelectedClient(null);
    loadData();
  }

  async function viewClient(orgId) {
    const c = await getClient(orgId);
    setSelectedClient(c);
    setTab('client-detail');
  }

  if (loading) return <div className="flex items-center justify-center h-full"><div className="text-gray-400">Loading admin panel...</div></div>;

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'clients', label: 'Clients', icon: '🏢' },
    { id: 'activity', label: 'Activity', icon: '📋' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-sm text-gray-400 mt-1">Manage clients, plans, and platform</p>
        </div>
        <button onClick={() => { setShowAddClient(true); setForm({ name: '', contact_email: '', plan: 'free' }); }}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition">
          + Add Client
        </button>
      </div>

      {msg && <div className="p-3 bg-violet-600/20 border border-violet-500/30 rounded-lg text-sm text-violet-300">{msg}
        <button onClick={() => setMsg('')} className="ml-2 text-violet-400">x</button></div>}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1e1b4b]/50 p-1 rounded-lg w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSelectedClient(null); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === t.id || (tab === 'client-detail' && t.id === 'clients') ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {tab === 'dashboard' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Clients', value: stats.total_clients, color: '#7c3aed' },
              { label: 'Active Clients', value: stats.active_clients, color: '#10b981' },
              { label: 'Monthly Revenue', value: `$${stats.total_mrr}`, color: '#f59e0b' },
              { label: 'Annual Revenue', value: `$${stats.total_arr}`, color: '#3b82f6' },
              { label: 'Total Users', value: stats.total_users, color: '#8b5cf6' },
              { label: 'Resources Monitored', value: stats.total_resources_monitored, color: '#06b6d4' },
              { label: 'Total Findings', value: stats.total_findings, color: '#ef4444' },
              { label: 'Avg Security Score', value: `${stats.avg_security_score}/100`, color: stats.avg_security_score > 70 ? '#10b981' : '#f59e0b' },
            ].map((s, i) => (
              <div key={i} className="bg-[#1e1b4b]/60 border border-white/5 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Plan Distribution */}
          <div className="bg-[#1e1b4b]/60 border border-white/5 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Plan Distribution</h3>
            <div className="flex gap-6">
              {Object.entries(stats.plan_distribution || {}).map(([plan, count]) => (
                <div key={plan} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: plans[plan]?.color || '#666' }}></div>
                  <span className="text-sm text-gray-300 capitalize">{plan}: <span className="text-white font-bold">{count}</span></span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-[#1e1b4b]/60 border border-white/5 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Recent Activity</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {activity.slice(0, 10).map((a, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-white/5">
                  <span className="text-gray-300">{a.action}</span>
                  <span className="text-gray-500 text-xs">{new Date(a.timestamp).toLocaleString()}</span>
                </div>
              ))}
              {activity.length === 0 && <p className="text-gray-500 text-sm">No activity yet</p>}
            </div>
          </div>
        </div>
      )}

      {/* Clients Tab */}
      {tab === 'clients' && (
        <div className="bg-[#1e1b4b]/60 border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                {['Client', 'Plan', 'Status', 'Resources', 'Findings', 'Score', 'Scans', 'Actions'].map(h => (
                  <th key={h} className="text-left text-xs text-gray-400 font-medium px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => viewClient(c.id)}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-white">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.contact_email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: `${plans[c.plan]?.color}20`, color: plans[c.plan]?.color }}>
                      {plans[c.plan]?.label || c.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: `${statusColors[c.status]}20`, color: statusColors[c.status] }}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">{c.total_resources || 0}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{c.total_findings || 0}</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-medium ${(c.security_score || 0) > 70 ? 'text-green-400' : (c.security_score || 0) > 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {c.security_score ?? '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">{c.scans_this_month || 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <select value={c.status} onChange={e => handleStatusChange(c.id, e.target.value)}
                        className="text-xs bg-[#0f0a2a] border border-white/10 rounded px-1 py-1 text-gray-300">
                        <option value="active">Active</option>
                        <option value="suspended">Suspend</option>
                        <option value="cancelled">Cancel</option>
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-gray-500">No clients yet. Click "+ Add Client" to get started.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Client Detail */}
      {tab === 'client-detail' && selectedClient && (
        <div className="space-y-6">
          <button onClick={() => setTab('clients')} className="text-sm text-violet-400 hover:text-violet-300">← Back to Clients</button>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{selectedClient.name}</h2>
              <p className="text-sm text-gray-400">{selectedClient.contact_email}</p>
            </div>
            <div className="flex gap-2">
              <select value={selectedClient.plan} onChange={e => handlePlanChange(selectedClient.id, e.target.value)}
                className="text-sm bg-[#0f0a2a] border border-white/10 rounded-lg px-3 py-2 text-gray-300">
                <option value="free">Free - $0/mo</option>
                <option value="pro">Pro - $99/mo</option>
                <option value="enterprise">Enterprise - $499/mo</option>
              </select>
              <button onClick={() => handleDeleteClient(selectedClient.id)}
                className="px-3 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg text-sm">Delete</button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { l: 'Status', v: selectedClient.status, c: statusColors[selectedClient.status] },
              { l: 'Plan', v: plans[selectedClient.plan]?.label, c: plans[selectedClient.plan]?.color },
              { l: 'Resources', v: selectedClient.total_resources || 0, c: '#06b6d4' },
              { l: 'Findings', v: selectedClient.total_findings || 0, c: '#ef4444' },
              { l: 'MRR', v: `$${selectedClient.billing?.mrr || 0}`, c: '#f59e0b' },
            ].map((s, i) => (
              <div key={i} className="bg-[#1e1b4b]/60 border border-white/5 rounded-xl p-4">
                <p className="text-xs text-gray-400">{s.l}</p>
                <p className="text-lg font-bold mt-1" style={{ color: s.c }}>{s.v}</p>
              </div>
            ))}
          </div>

          {/* Users */}
          <div className="bg-[#1e1b4b]/60 border border-white/5 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Client Users</h3>
              <button onClick={() => { setShowAddUser(true); setForm({ username: '', password: '', email: '', role: 'viewer' }); }}
                className="text-xs px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg">+ Add User</button>
            </div>
            <div className="space-y-2">
              {(selectedClient.users || []).map(u => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b border-white/5">
                  <div>
                    <span className="text-sm text-white font-medium">{u.username}</span>
                    <span className="text-xs text-gray-500 ml-2">{u.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2 py-1 rounded bg-violet-600/20 text-violet-300">{u.role}</span>
                    <span className="text-xs text-gray-500">{u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never logged in'}</span>
                  </div>
                </div>
              ))}
              {(!selectedClient.users || selectedClient.users.length === 0) && (
                <p className="text-gray-500 text-sm">No users created for this client</p>
              )}
            </div>
          </div>

          {/* Activity */}
          <div className="bg-[#1e1b4b]/60 border border-white/5 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Recent Activity</h3>
            <div className="space-y-2">
              {(selectedClient.activity || []).map((a, i) => (
                <div key={i} className="flex justify-between text-sm py-1 border-b border-white/5">
                  <span className="text-gray-300">{a.action}</span>
                  <span className="text-gray-500 text-xs">{new Date(a.timestamp).toLocaleString()}</span>
                </div>
              ))}
              {(!selectedClient.activity || selectedClient.activity.length === 0) && (
                <p className="text-gray-500 text-sm">No activity yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Activity Tab */}
      {tab === 'activity' && (
        <div className="bg-[#1e1b4b]/60 border border-white/5 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Platform Activity Log</h3>
          <div className="space-y-2">
            {activity.map((a, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/5">
                <div>
                  <span className="text-sm text-gray-300">{a.action}</span>
                  <span className="text-xs text-gray-500 ml-2">by {a.actor}</span>
                </div>
                <span className="text-gray-500 text-xs">{new Date(a.timestamp).toLocaleString()}</span>
              </div>
            ))}
            {activity.length === 0 && <p className="text-gray-500 text-sm">No activity yet</p>}
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {showAddClient && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAddClient(false)}>
          <div className="bg-[#1a1545] border border-white/10 rounded-2xl p-6 w-[420px]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">Add New Client</h3>
            <form onSubmit={handleAddClient} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Organization Name</label>
                <input value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} required
                  className="w-full bg-[#0f0a2a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="Acme Corp" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Contact Email</label>
                <input type="email" value={form.contact_email || ''} onChange={e => setForm({ ...form, contact_email: e.target.value })} required
                  className="w-full bg-[#0f0a2a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm" placeholder="admin@acme.com" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Plan</label>
                <select value={form.plan || 'free'} onChange={e => setForm({ ...form, plan: e.target.value })}
                  className="w-full bg-[#0f0a2a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="free">Free - $0/mo</option>
                  <option value="pro">Professional - $99/mo</option>
                  <option value="enterprise">Enterprise - $499/mo</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddClient(false)} className="flex-1 py-2 border border-white/10 rounded-lg text-gray-400 text-sm">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white text-sm font-medium">Create Client</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAddUser(false)}>
          <div className="bg-[#1a1545] border border-white/10 rounded-2xl p-6 w-[420px]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">Add Client User</h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Username</label>
                <input value={form.username || ''} onChange={e => setForm({ ...form, username: e.target.value })} required
                  className="w-full bg-[#0f0a2a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Email</label>
                <input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} required
                  className="w-full bg-[#0f0a2a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Password</label>
                <input type="password" value={form.password || ''} onChange={e => setForm({ ...form, password: e.target.value })} required
                  className="w-full bg-[#0f0a2a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Role</label>
                <select value={form.role || 'viewer'} onChange={e => setForm({ ...form, role: e.target.value })}
                  className="w-full bg-[#0f0a2a] border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="client_admin">Client Admin</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddUser(false)} className="flex-1 py-2 border border-white/10 rounded-lg text-gray-400 text-sm">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white text-sm font-medium">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
