import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Server, Database, Shield, Layers, CloudLightning,
  HardDrive, Globe, ChevronDown, MapPin, Search
} from 'lucide-react';
import { getResources } from '../api';
import Card from '../components/Card';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';

const RESOURCE_TABS = [
  { key: 'ec2_instances', label: 'EC2 Instances', icon: Server },
  { key: 's3_buckets', label: 'S3 Buckets', icon: Database },
  { key: 'security_groups', label: 'Security Groups', icon: Shield },
  { key: 'vpcs', label: 'VPCs', icon: Layers },
  { key: 'lambda_functions', label: 'Lambda', icon: CloudLightning },
  { key: 'rds_instances', label: 'RDS', icon: HardDrive },
  { key: 'load_balancers', label: 'ELBs', icon: Globe },
];

export default function Resources() {
  const { account } = useOutletContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('ec2_instances');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!account) return;
    setLoading(true);
    getResources(account)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [account]);

  if (loading) return <Loader text="Loading resources..." />;
  if (error) return <EmptyState title="Error" description={error} />;
  if (!data) return <EmptyState title="No data" description="Select an account" />;

  const regions = Object.keys(data.regions);

  // Aggregate resources from all (or selected) regions
  const getItems = () => {
    const items = [];
    const regionsToShow = selectedRegion === 'all' ? regions : [selectedRegion];
    for (const r of regionsToShow) {
      const regionData = data.regions[r] || {};
      const resourceList = regionData[activeTab] || [];
      resourceList.forEach((item) => items.push({ ...item, _region: r }));
    }
    if (search) {
      const s = search.toLowerCase();
      return items.filter((item) =>
        Object.values(item).some((v) => String(v).toLowerCase().includes(s))
      );
    }
    return items;
  };

  const items = getItems();

  const getColumns = () => {
    switch (activeTab) {
      case 'ec2_instances': return ['id', 'type', 'state', 'public_ip', 'private_ip', 'vpc'];
      case 's3_buckets': return ['name', 'created'];
      case 'security_groups': return ['id', 'name', 'vpc', 'inbound_rules', 'outbound_rules'];
      case 'vpcs': return ['id', 'cidr', 'default'];
      case 'lambda_functions': return ['name', 'runtime', 'memory'];
      case 'rds_instances': return ['id', 'engine', 'class', 'publicly_accessible'];
      case 'load_balancers': return ['name', 'dns', 'scheme'];
      default: return [];
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold">Resources</h1>
        <p className="text-text-muted text-sm mt-1">Explore collected AWS resources for <span className="text-accent">{account}</span></p>
      </motion.div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {RESOURCE_TABS.map(({ key, label, icon: Icon }) => {
          const count = (() => {
            let c = 0;
            const regionsToShow = selectedRegion === 'all' ? regions : [selectedRegion];
            for (const r of regionsToShow) c += (data.regions[r]?.[key] || []).length;
            return c;
          })();
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === key
                  ? 'bg-primary/15 text-primary-light border border-primary/20'
                  : 'bg-surface-light text-text-muted hover:text-text border border-border hover:border-border'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === key ? 'bg-primary/20' : 'bg-surface-lighter'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search resources..."
            className="w-full bg-surface-light border border-border rounded-lg pl-10 pr-3 py-2 text-sm text-text focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
          className="bg-surface-light border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary transition-colors cursor-pointer"
        >
          <option value="all">All Regions</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Table */}
      <Card delay={0.1}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-muted text-left border-b border-border">
                <th className="pb-3 font-medium pr-4">Region</th>
                {getColumns().map((col) => (
                  <th key={col} className="pb-3 font-medium pr-4 capitalize">
                    {col.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <motion.tr
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.5) }}
                  className="border-b border-border/30 hover:bg-surface-lighter/20 transition-colors"
                >
                  <td className="py-3 pr-4">
                    <span className="flex items-center gap-1 text-xs text-text-muted">
                      <MapPin className="w-3 h-3" />{item._region}
                    </span>
                  </td>
                  {getColumns().map((col) => (
                    <td key={col} className="py-3 pr-4">
                      {col === 'state' ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          item[col] === 'running' ? 'bg-emerald-500/15 text-emerald-400' :
                          item[col] === 'stopped' ? 'bg-red-500/15 text-red-400' :
                          'bg-slate-500/15 text-slate-400'
                        }`}>
                          {item[col] ?? '-'}
                        </span>
                      ) : col === 'publicly_accessible' ? (
                        <span className={item[col] ? 'text-red-400' : 'text-emerald-400'}>
                          {item[col] ? 'Yes' : 'No'}
                        </span>
                      ) : col === 'public_ip' && item[col] ? (
                        <span className="font-mono text-amber-400">{item[col]}</span>
                      ) : (
                        <span className={`${['id', 'name', 'dns', 'cidr', 'private_ip'].includes(col) ? 'font-mono text-xs' : ''}`}>
                          {item[col] ?? '-'}
                        </span>
                      )}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
            <EmptyState title="No resources found" description="No resources match the current filters" />
          )}
        </div>
      </Card>
    </div>
  );
}
