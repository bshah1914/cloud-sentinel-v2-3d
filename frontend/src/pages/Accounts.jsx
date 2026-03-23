import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, CheckCircle2, XCircle, MapPin, HardDrive,
  Network, X, Cloud, Globe, Layers
} from 'lucide-react';
import { getAccounts, addAccount, removeAccount, getCIDRs, addCIDR, removeCIDR, getVpcCidrs } from '../api';
import Card from '../components/Card';
import Loader from '../components/Loader';

export default function Accounts() {
  const { refreshAccounts } = useOutletContext();
  const [accounts, setAccounts] = useState([]);
  const [cidrs, setCidrs] = useState([]);
  const [vpcCidrs, setVpcCidrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddCIDR, setShowAddCIDR] = useState(false);
  const [newAccount, setNewAccount] = useState({ id: '', name: '', provider: 'aws', default: false, access_key: '', secret_key: '', role_arn: '' });
  const [newCIDR, setNewCIDR] = useState({ cidr: '', name: '' });
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [acctRes, cidrRes] = await Promise.all([getAccounts(), getCIDRs()]);
      setAccounts(acctRes.accounts || []);
      setCidrs(cidrRes.cidrs || []);
      // Load VPC CIDRs for each account that has data
      const accts = acctRes.accounts || [];
      const vpcPromises = accts.filter(a => a.has_data).map(a => getVpcCidrs(a.name).catch(() => ({ vpc_cidrs: [] })));
      const vpcResults = await Promise.all(vpcPromises);
      setVpcCidrs(vpcResults.flatMap(r => r.vpc_cidrs || []));
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAddAccount = async (e) => {
    e.preventDefault();
    try {
      // Save to legacy system (config.json)
      await addAccount({ id: newAccount.id, name: newAccount.name, provider: newAccount.provider, default: newAccount.default });
      // Also save to V2 database with credentials
      const { getBase } = await import('../api');
      const base = getBase();
      const token = localStorage.getItem('cm_token');
      await fetch(`${base}/v2/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: newAccount.name, provider: newAccount.provider,
          account_id: newAccount.id,
          access_key: newAccount.access_key, secret_key: newAccount.secret_key,
          role_arn: newAccount.role_arn || null, region: 'us-east-1',
        }),
      });
      setNewAccount({ id: '', name: '', provider: 'aws', default: false, access_key: '', secret_key: '', role_arn: '' });
      setShowAddAccount(false);
      await load();
      await refreshAccounts();
    } catch (e) { setError(e.message); }
  };

  const handleRemoveAccount = async (id) => {
    if (!confirm('Offboard this account?\n\nThis will permanently delete ALL collected scan data for this account.')) return;
    const acct = accounts.find((a) => a.id === id);
    await removeAccount(id, acct?.provider || 'aws');
    await load();
    await refreshAccounts();
  };

  const handleAddCIDR = async (e) => {
    e.preventDefault();
    try {
      await addCIDR(newCIDR);
      setNewCIDR({ cidr: '', name: '' });
      setShowAddCIDR(false);
      load();
    } catch (e) { setError(e.message); }
  };

  const handleRemoveCIDR = async (cidr) => {
    await removeCIDR(cidr);
    load();
  };

  if (loading) return <Loader text="Loading accounts..." />;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/12 flex items-center justify-center">
            <Cloud className="w-4.5 h-4.5 text-primary-light" />
          </div>
          Account Management
        </h1>
        <p className="text-text-muted text-sm mt-1.5">Manage cloud accounts and trusted CIDR ranges</p>
      </motion.div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-red-500/8 border border-red-500/15 rounded-xl p-3.5 text-red-400 text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
          <button onClick={() => setError('')} className="ml-auto hover:text-red-300"><X className="w-4 h-4" /></button>
        </motion.div>
      )}

      {/* Accounts Section */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text flex items-center gap-2">
          Cloud Accounts <span className="text-[10px] text-text-muted bg-surface-lighter/50 px-2 py-0.5 rounded-md">{accounts.length}</span>
        </h2>
        <button onClick={() => setShowAddAccount(!showAddAccount)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary rounded-xl text-xs font-medium transition-all shadow-sm shadow-primary/15">
          <Plus className="w-3.5 h-3.5" /> Add Account
        </button>
      </div>

      <AnimatePresence>
        {showAddAccount && (
          <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} onSubmit={handleAddAccount}
            className="bg-surface-light/80 border border-border/30 rounded-2xl p-5 space-y-4 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] text-text-muted mb-1.5 uppercase tracking-wider font-medium">Provider</label>
                <select value={newAccount.provider} onChange={(e) => setNewAccount({ ...newAccount, provider: e.target.value })}
                  className="w-full bg-surface/60 border border-border/50 rounded-xl px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary/40 cursor-pointer">
                  <option value="aws">AWS</option>
                  <option value="azure">Azure</option>
                  <option value="gcp">GCP</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-text-muted mb-1.5 uppercase tracking-wider font-medium">Account ID</label>
                <input type="text" value={newAccount.id} onChange={(e) => setNewAccount({ ...newAccount, id: e.target.value })}
                  placeholder="123456789012" required
                  className="w-full bg-surface/60 border border-border/50 rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-primary/40 transition-all" />
              </div>
              <div>
                <label className="block text-[10px] text-text-muted mb-1.5 uppercase tracking-wider font-medium">Account Name</label>
                <input type="text" value={newAccount.name} onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                  placeholder="production" required
                  className="w-full bg-surface/60 border border-border/50 rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-primary/40 transition-all" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
              <div>
                <label className="block text-[10px] text-text-muted mb-1.5 uppercase tracking-wider font-medium">Access Key ID</label>
                <input type="text" value={newAccount.access_key} onChange={(e) => setNewAccount({ ...newAccount, access_key: e.target.value })}
                  placeholder="AKIAIOSFODNN7EXAMPLE" required
                  className="w-full bg-surface/60 border border-border/50 rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-primary/40 transition-all font-mono" />
              </div>
              <div>
                <label className="block text-[10px] text-text-muted mb-1.5 uppercase tracking-wider font-medium">Secret Access Key</label>
                <input type="password" value={newAccount.secret_key} onChange={(e) => setNewAccount({ ...newAccount, secret_key: e.target.value })}
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLE" required
                  className="w-full bg-surface/60 border border-border/50 rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-primary/40 transition-all font-mono" />
              </div>
              <div>
                <label className="block text-[10px] text-text-muted mb-1.5 uppercase tracking-wider font-medium">Role ARN <span className="text-text-muted/50">(optional)</span></label>
                <input type="text" value={newAccount.role_arn} onChange={(e) => setNewAccount({ ...newAccount, role_arn: e.target.value })}
                  placeholder="arn:aws:iam::123456789012:role/CloudSentinel"
                  className="w-full bg-surface/60 border border-border/50 rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-primary/40 transition-all font-mono" />
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={newAccount.default} onChange={(e) => setNewAccount({ ...newAccount, default: e.target.checked })}
                  className="w-4 h-4 rounded accent-primary" />
                Default Account
              </label>
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={() => setShowAddAccount(false)} className="px-4 py-2.5 bg-surface-lighter/50 hover:bg-surface-lighter rounded-xl text-xs transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-medium transition-colors">Connect Account</button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Account Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(accounts || []).map((acct, i) => (
          <Card key={acct.id} delay={i * 0.04}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${acct.has_data ? 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400' : 'bg-surface-lighter/50 border-border/30 text-text-muted'}`}>
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-text">{acct.name}</h3>
                  <p className="text-[10px] text-text-muted font-mono">{acct.id}
                    <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                      acct.provider === 'azure' ? 'bg-blue-500/10 text-blue-400' :
                      acct.provider === 'gcp' ? 'bg-sky-500/10 text-sky-400' :
                      'bg-orange-500/10 text-orange-400'
                    }`}>{(acct.provider || 'aws').toUpperCase()}</span>
                  </p>
                </div>
              </div>
              <button onClick={() => handleRemoveAccount(acct.id)}
                className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/8 transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 flex items-center gap-3 text-xs">
              {acct.has_data ? (
                <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Data Available</span>
              ) : (
                <span className="flex items-center gap-1 text-text-muted"><XCircle className="w-3.5 h-3.5" /> No Data</span>
              )}
              {acct.default && (
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary-light text-[10px] font-medium border border-primary/10">Default</span>
              )}
            </div>
            {acct.regions?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(acct.regions || []).map((r) => (
                  <span key={r} className="flex items-center gap-1 text-[10px] bg-surface/40 border border-border/20 rounded-md px-2 py-0.5 text-text-muted">
                    <MapPin className="w-2.5 h-2.5" />{r}
                  </span>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* CIDRs Section */}
      <div className="flex items-center justify-between mt-8">
        <h2 className="text-sm font-semibold text-text flex items-center gap-2">
          <Network className="w-4 h-4 text-accent" /> Trusted CIDRs
          <span className="text-[10px] text-text-muted bg-surface-lighter/50 px-2 py-0.5 rounded-md">{cidrs.length}</span>
        </h2>
        <button onClick={() => setShowAddCIDR(!showAddCIDR)}
          className="flex items-center gap-2 px-4 py-2 bg-accent/12 hover:bg-accent/20 text-accent border border-accent/15 rounded-xl text-xs font-medium transition-all">
          <Plus className="w-3.5 h-3.5" /> Add CIDR
        </button>
      </div>

      <AnimatePresence>
        {showAddCIDR && (
          <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} onSubmit={handleAddCIDR}
            className="bg-surface-light/80 border border-border/30 rounded-2xl p-5 overflow-hidden">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-[10px] text-text-muted mb-1.5 uppercase tracking-wider font-medium">CIDR Block</label>
                <input type="text" value={newCIDR.cidr} onChange={(e) => setNewCIDR({ ...newCIDR, cidr: e.target.value })}
                  placeholder="10.0.0.0/8" required
                  className="w-full bg-surface/60 border border-border/50 rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-primary/40 transition-all" />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-text-muted mb-1.5 uppercase tracking-wider font-medium">Name</label>
                <input type="text" value={newCIDR.name} onChange={(e) => setNewCIDR({ ...newCIDR, name: e.target.value })}
                  placeholder="Office Network" required
                  className="w-full bg-surface/60 border border-border/50 rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-primary/40 transition-all" />
              </div>
              <button type="submit" className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-medium transition-colors">Save</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {cidrs.length > 0 && (
        <Card hover={false}>
          <div className="space-y-1.5">
            {(cidrs || []).map((c, i) => (
              <motion.div key={c.cidr} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.025 }}
                className="flex items-center justify-between bg-surface/40 rounded-xl px-4 py-3 border border-border/20 hover:border-border/40 transition-all">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-accent">{c.cidr}</span>
                  <span className="text-text-muted text-xs">{c.name}</span>
                </div>
                <button onClick={() => handleRemoveCIDR(c.cidr)}
                  className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/8 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </Card>
      )}
      {/* VPC CIDRs from Scan Data */}
      {vpcCidrs.length > 0 && (
        <>
          <div className="flex items-center justify-between mt-8">
            <h2 className="text-sm font-semibold text-text flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary-light" /> VPC CIDRs (from scan)
              <span className="text-[10px] text-text-muted bg-surface-lighter/50 px-2 py-0.5 rounded-md">{vpcCidrs.length}</span>
            </h2>
          </div>
          <Card hover={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-muted border-b border-border/50">
                    {['VPC ID', 'CIDR Block', 'Name', 'Region', 'Subnets', 'State', 'Default'].map(h => (
                      <th key={h} className="pb-2.5 text-left font-medium text-[10px] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(vpcCidrs || []).map((vpc, i) => (
                    <motion.tr key={`${vpc.vpc_id}-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="border-b border-border/15 hover:bg-surface/20 transition-all">
                      <td className="py-2.5 font-mono text-text-muted text-[11px]">{vpc.vpc_id}</td>
                      <td className="py-2.5">
                        <span className="font-mono text-sm text-accent font-semibold">{vpc.cidr}</span>
                      </td>
                      <td className="py-2.5 text-text">{vpc.name || '-'}</td>
                      <td className="py-2.5">
                        <span className="flex items-center gap-1 text-text-muted">
                          <MapPin className="w-3 h-3" />{vpc.region}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary-light text-[10px] font-medium">
                          <Layers className="w-3 h-3" />{vpc.subnets}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${
                          vpc.state === 'available' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>{vpc.state}</span>
                      </td>
                      <td className="py-2.5">
                        {vpc.is_default ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 font-medium">Default</span>
                        ) : (
                          <span className="text-text-muted text-[10px]">Custom</span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
