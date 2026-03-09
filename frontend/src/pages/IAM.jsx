import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  KeyRound, Users, ShieldCheck, FileText, ChevronDown,
  ChevronRight, Search, UserCheck, UserX
} from 'lucide-react';
import { getIAM } from '../api';
import Card from '../components/Card';
import StatCard from '../components/StatCard';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';

export default function IAM() {
  const { account } = useOutletContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('users');
  const [search, setSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());

  useEffect(() => {
    if (!account) return;
    setLoading(true);
    getIAM(account)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [account]);

  if (loading) return <Loader text="Loading IAM data..." />;
  if (error) return <EmptyState title="Error" description={error} />;
  if (!data) return <EmptyState title="No data" />;

  const { users, roles, policies, summary } = data;

  const toggleRow = (i) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const filterItems = (items) => {
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter((item) =>
      (item.name || '').toLowerCase().includes(s) ||
      (item.arn || '').toLowerCase().includes(s)
    );
  };

  const summaryChart = [
    { name: 'Users', count: summary.Users || 0 },
    { name: 'Roles', count: summary.Roles || 0 },
    { name: 'Groups', count: summary.Groups || 0 },
    { name: 'Policies', count: summary.Policies || 0 },
  ];

  const tabs = [
    { key: 'users', label: 'Users', icon: Users, count: users.length },
    { key: 'roles', label: 'Roles', icon: ShieldCheck, count: roles.length },
    { key: 'policies', label: 'Policies', icon: FileText, count: policies.length },
  ];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <KeyRound className="w-6 h-6 text-accent" /> IAM Report
        </h1>
        <p className="text-text-muted text-sm mt-1">Identity and Access Management for <span className="text-accent">{account}</span></p>
      </motion.div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Users" value={summary.Users || 0} color="primary" delay={0} />
        <StatCard icon={ShieldCheck} label="Roles" value={summary.Roles || 0} color="accent" delay={0.05} />
        <StatCard icon={Users} label="Groups" value={summary.Groups || 0} color="success" delay={0.1} />
        <StatCard icon={FileText} label="Policies" value={summary.Policies || 0} color="warning" delay={0.15} />
      </div>

      {/* Summary Chart */}
      <Card delay={0.1}>
        <h3 className="text-sm font-semibold text-text-muted mb-4">IAM Overview</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={summaryChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', fontSize: '12px' }} />
            <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); setExpandedRows(new Set()); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === key
                ? 'bg-primary/15 text-primary-light border border-primary/20'
                : 'bg-surface-light text-text-muted border border-border hover:text-text'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-surface-lighter">{count}</span>
          </button>
        ))}
        <div className="ml-auto relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full bg-surface-light border border-border rounded-lg pl-10 pr-3 py-2 text-sm text-text focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Users */}
      {activeTab === 'users' && (
        <Card delay={0.2}>
          <div className="space-y-1">
            {filterItems(users).map((user, i) => (
              <div key={i}>
                <button
                  onClick={() => toggleRow(i)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-surface-lighter/30 transition-colors text-left"
                >
                  {expandedRows.has(i) ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${user.mfa_devices?.length > 0 ? 'bg-emerald-500/15' : 'bg-amber-500/15'}`}>
                    {user.mfa_devices?.length > 0 ? <UserCheck className="w-4 h-4 text-emerald-400" /> : <UserX className="w-4 h-4 text-amber-400" />}
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium">{user.name}</span>
                    <p className="text-xs text-text-muted font-mono">{user.arn}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <span>{user.policies.length} policies</span>
                    <span>{user.groups?.length || 0} groups</span>
                  </div>
                </button>
                <AnimatePresence>
                  {expandedRows.has(i) && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="ml-16 mr-4 mb-2 overflow-hidden">
                      <div className="bg-surface/50 rounded-lg p-4 space-y-3 text-sm">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><span className="text-text-muted">Created: </span>{user.created || '-'}</div>
                          <div><span className="text-text-muted">MFA: </span>
                            <span className={user.mfa_devices?.length > 0 ? 'text-emerald-400' : 'text-red-400'}>
                              {user.mfa_devices?.length > 0 ? 'Enabled' : 'Disabled'}
                            </span>
                          </div>
                        </div>
                        {user.policies.length > 0 && (
                          <div>
                            <p className="text-xs text-text-muted mb-1">Attached Policies:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {user.policies.map((p) => (
                                <span key={p} className="px-2 py-0.5 rounded bg-primary/10 text-primary-light text-xs">{p}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {user.groups?.length > 0 && (
                          <div>
                            <p className="text-xs text-text-muted mb-1">Groups:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {user.groups.map((g) => (
                                <span key={g} className="px-2 py-0.5 rounded bg-accent/10 text-accent text-xs">{g}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
            {filterItems(users).length === 0 && <EmptyState title="No users found" />}
          </div>
        </Card>
      )}

      {/* Roles */}
      {activeTab === 'roles' && (
        <Card delay={0.2}>
          <div className="space-y-1">
            {filterItems(roles).map((role, i) => (
              <div key={i}>
                <button onClick={() => toggleRow(i)} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-surface-lighter/30 transition-colors text-left">
                  {expandedRows.has(i) ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium">{role.name}</span>
                    <p className="text-xs text-text-muted font-mono">{role.arn}</p>
                  </div>
                  <span className="text-xs text-text-muted">{role.policies.length} policies</span>
                </button>
                <AnimatePresence>
                  {expandedRows.has(i) && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="ml-16 mr-4 mb-2 overflow-hidden">
                      <div className="bg-surface/50 rounded-lg p-4 space-y-3 text-sm">
                        <div className="text-xs text-text-muted">Created: {role.created || '-'}</div>
                        {role.policies.length > 0 && (
                          <div>
                            <p className="text-xs text-text-muted mb-1">Policies:</p>
                            <div className="flex flex-wrap gap-1.5">
                              {role.policies.map((p) => <span key={p} className="px-2 py-0.5 rounded bg-primary/10 text-primary-light text-xs">{p}</span>)}
                            </div>
                          </div>
                        )}
                        {role.trust_policy && (
                          <div>
                            <p className="text-xs text-text-muted mb-1">Trust Policy:</p>
                            <pre className="text-xs bg-surface rounded-lg p-3 overflow-x-auto text-text-muted">
                              {JSON.stringify(role.trust_policy, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
            {filterItems(roles).length === 0 && <EmptyState title="No roles found" />}
          </div>
        </Card>
      )}

      {/* Policies */}
      {activeTab === 'policies' && (
        <Card delay={0.2}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-muted text-left border-b border-border">
                  <th className="pb-3 font-medium">Policy Name</th>
                  <th className="pb-3 font-medium">ARN</th>
                  <th className="pb-3 font-medium">Attachments</th>
                  <th className="pb-3 font-medium">Attachable</th>
                </tr>
              </thead>
              <tbody>
                {filterItems(policies).map((p, i) => (
                  <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.5) }} className="border-b border-border/30 hover:bg-surface-lighter/20 transition-colors">
                    <td className="py-3 font-medium">{p.name}</td>
                    <td className="py-3 font-mono text-xs text-text-muted">{p.arn}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${p.attachment_count > 0 ? 'bg-primary/15 text-primary-light' : 'bg-surface-lighter text-text-muted'}`}>
                        {p.attachment_count}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={p.is_attachable ? 'text-emerald-400' : 'text-text-muted'}>
                        {p.is_attachable ? 'Yes' : 'No'}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {filterItems(policies).length === 0 && <EmptyState title="No policies found" />}
          </div>
        </Card>
      )}
    </div>
  );
}
