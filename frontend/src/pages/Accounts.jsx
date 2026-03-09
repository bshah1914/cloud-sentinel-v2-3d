import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, CheckCircle2, XCircle, MapPin, HardDrive,
  Network, X
} from 'lucide-react';
import { getAccounts, addAccount, removeAccount, getCIDRs, addCIDR, removeCIDR } from '../api';
import Card from '../components/Card';
import Loader from '../components/Loader';

export default function Accounts() {
  const { refreshAccounts } = useOutletContext();
  const [accounts, setAccounts] = useState([]);
  const [cidrs, setCidrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddCIDR, setShowAddCIDR] = useState(false);
  const [newAccount, setNewAccount] = useState({ id: '', name: '', default: false });
  const [newCIDR, setNewCIDR] = useState({ cidr: '', name: '' });
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [acctRes, cidrRes] = await Promise.all([getAccounts(), getCIDRs()]);
      setAccounts(acctRes.accounts || []);
      setCidrs(cidrRes.cidrs || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAddAccount = async (e) => {
    e.preventDefault();
    try {
      await addAccount(newAccount);
      setNewAccount({ id: '', name: '', default: false });
      setShowAddAccount(false);
      await load();
      // Sync the Layout/Topbar/Scan account lists
      await refreshAccounts();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleRemoveAccount = async (id) => {
    if (!confirm('Offboard this account?\n\nThis will permanently delete ALL collected scan data for this account. This action cannot be undone.')) return;
    await removeAccount(id);
    await load();
    // Sync the Layout/Topbar/Scan account lists
    await refreshAccounts();
  };

  const handleAddCIDR = async (e) => {
    e.preventDefault();
    try {
      await addCIDR(newCIDR);
      setNewCIDR({ cidr: '', name: '' });
      setShowAddCIDR(false);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleRemoveCIDR = async (cidr) => {
    await removeCIDR(cidr);
    load();
  };

  if (loading) return <Loader text="Loading accounts..." />;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold">Account Management</h1>
        <p className="text-text-muted text-sm mt-1">Manage AWS accounts and trusted CIDR ranges</p>
      </motion.div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4" />
          {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </motion.div>
      )}

      {/* Accounts Section */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">AWS Accounts ({accounts.length})</h2>
        <button
          onClick={() => setShowAddAccount(!showAddAccount)}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Account
        </button>
      </div>

      {/* Add Account Form */}
      <AnimatePresence>
        {showAddAccount && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddAccount}
            className="bg-surface-light border border-border rounded-xl p-5 space-y-4 overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-text-muted mb-1.5">Account ID</label>
                <input
                  type="text"
                  value={newAccount.id}
                  onChange={(e) => setNewAccount({ ...newAccount, id: e.target.value })}
                  placeholder="123456789012"
                  required
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1.5">Account Name</label>
                <input
                  type="text"
                  value={newAccount.name}
                  onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                  placeholder="production"
                  required
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="flex items-end gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAccount.default}
                    onChange={(e) => setNewAccount({ ...newAccount, default: e.target.checked })}
                    className="w-4 h-4 rounded accent-primary"
                  />
                  Default
                </label>
                <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition-colors">
                  Save
                </button>
                <button type="button" onClick={() => setShowAddAccount(false)} className="px-4 py-2 bg-surface-lighter hover:bg-surface-lighter/80 rounded-lg text-sm transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Account Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((acct, i) => (
          <Card key={acct.id} delay={i * 0.05}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${acct.has_data ? 'bg-emerald-500/15 text-emerald-400' : 'bg-surface-lighter text-text-muted'}`}>
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{acct.name}</h3>
                  <p className="text-xs text-text-muted font-mono">{acct.id}</p>
                </div>
              </div>
              <button
                onClick={() => handleRemoveAccount(acct.id)}
                className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-4 flex items-center gap-3 text-xs">
              {acct.has_data ? (
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Data Available
                </span>
              ) : (
                <span className="flex items-center gap-1 text-text-muted">
                  <XCircle className="w-3.5 h-3.5" /> No Data
                </span>
              )}
              {acct.default && (
                <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary-light text-xs">Default</span>
              )}
            </div>
            {acct.regions?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {acct.regions.map((r) => (
                  <span key={r} className="flex items-center gap-1 text-xs bg-surface/50 rounded px-2 py-0.5 text-text-muted">
                    <MapPin className="w-3 h-3" />{r}
                  </span>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* CIDRs Section */}
      <div className="flex items-center justify-between mt-8">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Network className="w-5 h-5 text-accent" /> Trusted CIDRs ({cidrs.length})
        </h2>
        <button
          onClick={() => setShowAddCIDR(!showAddCIDR)}
          className="flex items-center gap-2 px-4 py-2 bg-accent/20 hover:bg-accent/30 text-accent rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Add CIDR
        </button>
      </div>

      <AnimatePresence>
        {showAddCIDR && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddCIDR}
            className="bg-surface-light border border-border rounded-xl p-5 overflow-hidden"
          >
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs text-text-muted mb-1.5">CIDR Block</label>
                <input
                  type="text"
                  value={newCIDR.cidr}
                  onChange={(e) => setNewCIDR({ ...newCIDR, cidr: e.target.value })}
                  placeholder="10.0.0.0/8"
                  required
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-text-muted mb-1.5">Name</label>
                <input
                  type="text"
                  value={newCIDR.name}
                  onChange={(e) => setNewCIDR({ ...newCIDR, name: e.target.value })}
                  placeholder="Office Network"
                  required
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium transition-colors">Save</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {cidrs.length > 0 && (
        <Card>
          <div className="space-y-2">
            {cidrs.map((c, i) => (
              <motion.div
                key={c.cidr}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between bg-surface/50 rounded-lg px-4 py-3 hover:bg-surface-lighter/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-accent">{c.cidr}</span>
                  <span className="text-text-muted text-sm">{c.name}</span>
                </div>
                <button
                  onClick={() => handleRemoveCIDR(c.cidr)}
                  className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
