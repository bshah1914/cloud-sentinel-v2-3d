import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  ShieldAlert, AlertTriangle, Globe, Lock, MapPin
} from 'lucide-react';
import { getSecurityGroups } from '../api';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';

export default function SecurityGroups() {
  const { account } = useOutletContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!account) return;
    setLoading(true);
    getSecurityGroups(account)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [account]);

  if (loading) return <Loader text="Analyzing security groups..." />;
  if (error) return <EmptyState title="Error" description={error} />;
  if (!data) return <EmptyState title="No data" />;

  const { risky_groups } = data;
  const criticalCount = risky_groups.filter((g) => g.severity === 'CRITICAL').length;
  const highCount = risky_groups.filter((g) => g.severity === 'HIGH').length;

  const pieData = [
    { name: 'CRITICAL', value: criticalCount, color: '#ef4444' },
    { name: 'HIGH', value: highCount, color: '#f97316' },
  ].filter((d) => d.value > 0);

  const dangerousPorts = { 22: 'SSH', 3389: 'RDP', 3306: 'MySQL', 5432: 'PostgreSQL', 1433: 'MSSQL', 27017: 'MongoDB' };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-amber-400" /> Security Groups Analysis
        </h1>
        <p className="text-text-muted text-sm mt-1">Identifying risky security group rules open to the world</p>
      </motion.div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card delay={0} className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-red-500/15 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <div>
            <p className="text-3xl font-bold text-red-400">{risky_groups.length}</p>
            <p className="text-xs text-text-muted">Risky Security Groups</p>
          </div>
        </Card>

        <Card delay={0.05} className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-red-500/15 flex items-center justify-center">
            <Globe className="w-7 h-7 text-red-400" />
          </div>
          <div>
            <p className="text-3xl font-bold text-red-400">{criticalCount}</p>
            <p className="text-xs text-text-muted">Critical (sensitive ports)</p>
          </div>
        </Card>

        <Card delay={0.1} className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <ShieldAlert className="w-7 h-7 text-amber-400" />
          </div>
          <div>
            <p className="text-3xl font-bold text-amber-400">{highCount}</p>
            <p className="text-xs text-text-muted">High (open ports)</p>
          </div>
        </Card>
      </div>

      {risky_groups.length === 0 ? (
        <EmptyState
          icon={Lock}
          title="No risky security groups found"
          description="All security groups appear properly configured"
        />
      ) : (
        <>
          {/* Severity breakdown */}
          {pieData.length > 0 && (
            <Card delay={0.15}>
              <h3 className="text-sm font-semibold text-text-muted mb-4">Severity Distribution</h3>
              <div className="flex items-center gap-8">
                <ResponsiveContainer width="40%" height={160}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={5} dataKey="value">
                      {pieData.map((d) => <Cell key={d.name} fill={d.color} stroke="transparent" />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                      <span className="text-sm">{d.name}</span>
                      <span className="text-2xl font-bold" style={{ color: d.color }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Risky Groups List */}
          <div className="space-y-3">
            {risky_groups.map((sg, i) => (
              <Card key={i} delay={0.2 + i * 0.03}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${sg.severity === 'CRITICAL' ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
                      <ShieldAlert className={`w-5 h-5 ${sg.severity === 'CRITICAL' ? 'text-red-400' : 'text-amber-400'}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{sg.group_name}</h3>
                      <p className="text-xs text-text-muted font-mono">{sg.group_id}</p>
                    </div>
                  </div>
                  <StatusBadge status={sg.severity} />
                </div>

                <div className="flex items-center gap-4 text-xs text-text-muted mb-3">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{sg.region}</span>
                  {sg.vpc_id && <span className="font-mono">{sg.vpc_id}</span>}
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-text-muted font-medium">Open Rules ({sg.open_rules.length}):</p>
                  {sg.open_rules.map((rule, j) => {
                    const portLabel = dangerousPorts[rule.from_port];
                    return (
                      <motion.div
                        key={j}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + j * 0.05 }}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                          portLabel ? 'bg-red-500/10 border border-red-500/20' : 'bg-amber-500/10 border border-amber-500/20'
                        }`}
                      >
                        <Globe className="w-4 h-4 text-text-muted" />
                        <span className="font-mono">
                          {rule.protocol === '-1' ? 'ALL Traffic' : rule.protocol?.toUpperCase()}
                        </span>
                        <span className="font-mono">
                          {rule.from_port === rule.to_port
                            ? `Port ${rule.from_port ?? 'ALL'}`
                            : `Ports ${rule.from_port}-${rule.to_port}`}
                        </span>
                        {portLabel && (
                          <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs font-medium">
                            {portLabel}
                          </span>
                        )}
                        <span className="text-text-muted ml-auto">0.0.0.0/0</span>
                      </motion.div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
