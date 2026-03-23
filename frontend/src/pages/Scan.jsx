import { useState, useEffect, useRef } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ScanLine, Clock, CheckCircle2, XCircle,
  Loader as LoaderIcon, RefreshCw, Terminal, Plus, Key, Eye, EyeOff, Zap
} from 'lucide-react';
import { startScan, getScanStatus, getScanHistory, getProviders } from '../api';
import Card from '../components/Card';
import StatusBadge from '../components/StatusBadge';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';

const PROVIDER_COLORS = {
  aws: 'text-orange-400',
  azure: 'text-blue-400',
  gcp: 'text-sky-400',
};

export default function Scan() {
  const { account, provider, accounts, refreshAccounts } = useOutletContext();
  const [selectedAccount, setSelectedAccount] = useState(account);
  const [selectedProvider, setSelectedProvider] = useState(provider || 'aws');
  const [providers, setProviders] = useState([]);
  const [credentials, setCredentials] = useState({});
  const [region, setRegion] = useState('all');
  const [showSecrets, setShowSecrets] = useState({});
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const pollingRef = useRef({});

  useEffect(() => { if (account) setSelectedAccount(account); }, [account]);
  useEffect(() => { if (provider) setSelectedProvider(provider); }, [provider]);
  useEffect(() => { getProviders().then((res) => setProviders(res.providers || [])).catch(() => {}); }, []);

  const loadHistory = async () => {
    try { const res = await getScanHistory(); setJobs(res.jobs || []); } catch {}
    setLoading(false);
  };
  useEffect(() => { loadHistory(); }, []);

  const currentProvider = providers.find((p) => p.id === selectedProvider);
  const credentialFields = currentProvider?.credential_fields || [];

  const pollJob = (jobId) => {
    if (pollingRef.current[jobId]) return;
    pollingRef.current[jobId] = setInterval(async () => {
      try {
        const status = await getScanStatus(jobId);
        setJobs((prev) => prev.map((j) => j.id === jobId ? status : j));
        if (status.status !== 'running') {
          clearInterval(pollingRef.current[jobId]);
          delete pollingRef.current[jobId];
          if (refreshAccounts) refreshAccounts();
        }
      } catch {
        clearInterval(pollingRef.current[jobId]);
        delete pollingRef.current[jobId];
      }
    }, 3000);
  };

  useEffect(() => { return () => { Object.values(pollingRef.current).forEach(clearInterval); }; }, []);

  const handleStartScan = async () => {
    if (!selectedAccount) return;
    setStarting(true);
    try {
      // Try V2 scan first (uses DB-stored credentials)
      const { getBase } = await import('../api');
      const base = getBase();
      const token = localStorage.getItem('cm_token');

      // Get V2 accounts to find the DB account ID
      const v2Res = await fetch(`${base}/v2/accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const v2Data = await v2Res.json();
      const dbAccount = (v2Data.accounts || []).find(a => a.name === selectedAccount && a.has_credentials);

      if (dbAccount) {
        // Use V2 scanner with DB credentials
        const scanRes = await fetch(`${base}/v2/scans`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ account_id: dbAccount.id, scan_type: 'full' }),
        });
        const scanData = await scanRes.json();
        if (scanRes.ok) {
          const newJob = { id: scanData.scan_id, provider: selectedProvider, status: 'running', account: selectedAccount, started: new Date().toISOString(), log: ['V2 scan started — scanning live AWS account...'], progress: 0 };
          setJobs((prev) => [newJob, ...prev]);
          // Poll V2 scan status
          const pollV2 = setInterval(async () => {
            try {
              const sRes = await fetch(`${base}/v2/scans/${scanData.scan_id}`, { headers: { Authorization: `Bearer ${token}` } });
              const sData = await sRes.json();
              setJobs(prev => prev.map(j => j.id === scanData.scan_id ? { ...j, status: sData.status, findings: sData.findings_count, resources: sData.resources_found, score: sData.security_score, error: sData.error_message, progress: sData.status === 'completed' ? 100 : 50 } : j));
              if (sData.status !== 'running') {
                clearInterval(pollV2);
                if (refreshAccounts) refreshAccounts();
              }
            } catch { clearInterval(pollV2); }
          }, 5000);
          setStarting(false);
          return;
        }
      }

      // No DB account with credentials — save credentials and create account, then scan
      const missing = credentialFields.filter((f) => f.required && !credentials[f.key]);
      if (missing.length > 0) { alert(`Please fill in: ${missing.map((f) => f.label).join(', ')}`); setStarting(false); return; }

      // Save credentials to DB by creating/updating V2 account
      const accessKey = credentials.access_key_id || credentials.access_key;
      const secretKey = credentials.secret_access_key || credentials.secret_key;
      if (accessKey && secretKey) {
        const createRes = await fetch(`${base}/v2/accounts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: selectedAccount, provider: selectedProvider,
            account_id: selectedAccount, access_key: accessKey,
            secret_key: secretKey, region: region || 'us-east-1',
          }),
        });
        const createData = await createRes.json();
        if (createRes.ok && createData.id) {
          // Now run V2 scan with the new account
          const scanRes = await fetch(`${base}/v2/scans`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ account_id: createData.id, scan_type: 'full' }),
          });
          const scanData = await scanRes.json();
          if (scanRes.ok) {
            const newJob = { id: scanData.scan_id, provider: selectedProvider, status: 'running', account: selectedAccount, started: new Date().toISOString(), log: ['V2 scan started — credentials saved, scanning live account...'], progress: 0 };
            setJobs((prev) => [newJob, ...prev]);
            const pollV2 = setInterval(async () => {
              try {
                const sRes = await fetch(`${base}/v2/scans/${scanData.scan_id}`, { headers: { Authorization: `Bearer ${token}` } });
                const sData = await sRes.json();
                setJobs(prev => prev.map(j => j.id === scanData.scan_id ? { ...j, status: sData.status, findings: sData.findings_count, resources: sData.resources_found, score: sData.security_score, error: sData.error_message, progress: sData.status === 'completed' ? 100 : 50 } : j));
                if (sData.status !== 'running') { clearInterval(pollV2); if (refreshAccounts) refreshAccounts(); }
              } catch { clearInterval(pollV2); }
            }, 5000);
            setStarting(false);
            return;
          }
        }
      }

      // Last resort: old scan method (no DB)
      const res = await startScan({
        accountName: selectedAccount, provider: selectedProvider, credentials, region,
        awsAccessKeyId: selectedProvider === 'aws' ? credentials.access_key_id : undefined,
        awsSecretAccessKey: selectedProvider === 'aws' ? credentials.secret_access_key : undefined,
        awsRegion: selectedProvider === 'aws' ? region : undefined,
      });
      const newJob = { id: res.job_id, provider: selectedProvider, status: 'running', account: selectedAccount, started: new Date().toISOString(), log: ['Starting...'], progress: 0 };
      setJobs((prev) => [newJob, ...prev]);
      pollJob(res.job_id);
    } catch (e) { alert(`Failed to start scan: ${e.message}`); }
    setStarting(false);
  };

  useEffect(() => { jobs.filter((j) => j.status === 'running').forEach((j) => pollJob(j.id)); }, [jobs.length]);

  if (loading) return <Loader text="Loading scan history..." />;

  if (!accounts || accounts.length === 0) {
    return (
      <EmptyState icon={Plus} title="No accounts configured" description="Add a cloud account first before you can run scans."
        action={<Link to="/accounts" className="px-5 py-2.5 bg-gradient-to-r from-primary to-primary-dark rounded-xl text-sm font-medium inline-flex items-center gap-2 shadow-lg shadow-primary/20"><Plus className="w-4 h-4" /> Add Account</Link>} />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/12 flex items-center justify-center">
              <ScanLine className="w-4.5 h-4.5 text-primary-light" />
            </div>
            Scan Management
          </h1>
          <p className="text-text-muted text-sm mt-1.5">Collect cloud data and run security scans</p>
        </div>
        <div className="flex items-center gap-2.5">
          <select value={selectedProvider} onChange={(e) => { setSelectedProvider(e.target.value); setCredentials({}); }}
            className="appearance-none bg-surface-lighter/50 border border-border/50 rounded-xl px-3 py-2.5 text-xs text-text focus:outline-none focus:border-primary/40 cursor-pointer">
            {providers.map((p) => <option key={p.id} value={p.id}>{p.short_name}</option>)}
          </select>
          <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)}
            className="appearance-none bg-surface-lighter/50 border border-border/50 rounded-xl px-3 py-2.5 text-xs text-text focus:outline-none focus:border-primary/40 cursor-pointer">
            {accounts.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
          </select>
          <button onClick={handleStartScan} disabled={starting || !selectedAccount}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary disabled:opacity-50 rounded-xl text-xs font-medium transition-all shadow-lg shadow-primary/15">
            {starting ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
            ) : <Zap className="w-3.5 h-3.5" />}
            {starting ? 'Starting...' : 'Start Scan'}
          </button>
          <button onClick={loadHistory} className="p-2.5 rounded-xl text-text-muted hover:text-text hover:bg-white/[0.03] transition-all border border-border/30">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>

      {/* Credentials */}
      <Card hover={false}>
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-4 h-4 text-amber-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider">
            {currentProvider?.short_name || 'Cloud'} Credentials
          </h2>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md bg-surface-lighter/50 ${PROVIDER_COLORS[selectedProvider] || 'text-text-muted'}`}>
            {currentProvider?.short_name}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {credentialFields.map((field) => (
            <div key={field.key}>
              <label className="block text-[10px] text-text-muted mb-1.5 uppercase tracking-wider font-medium">{field.label}</label>
              <div className="relative">
                <input
                  type={field.secret && !showSecrets[field.key] ? 'password' : 'text'}
                  value={credentials[field.key] || ''}
                  onChange={(e) => setCredentials({ ...credentials, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  className="w-full bg-surface/60 border border-border/50 rounded-xl px-3 py-2.5 pr-10 text-sm text-text font-mono placeholder:text-text-muted/40 focus:outline-none focus:border-primary/40 transition-all"
                />
                {field.secret && (
                  <button type="button" onClick={() => setShowSecrets({ ...showSecrets, [field.key]: !showSecrets[field.key] })}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text transition-colors">
                    {showSecrets[field.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
          ))}
          {currentProvider?.region_support && (
            <div>
              <label className="block text-[10px] text-text-muted mb-1.5 uppercase tracking-wider font-medium">Region</label>
              <input type="text" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="all (recommended)"
                className="w-full bg-surface/60 border border-border/50 rounded-xl px-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-primary/40 transition-all" />
            </div>
          )}
        </div>
        <p className="mt-3 text-[10px] text-text-muted/60">Credentials are used only for this scan and are not stored.</p>
      </Card>

      {/* Active scans */}
      {jobs.filter((j) => j.status === 'running').length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Active Scans</h2>
          {jobs.filter((j) => j.status === 'running').map((job) => (
            <Card key={job.id} glow="accent">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/15 flex items-center justify-center">
                    <LoaderIcon className="w-5 h-5 text-cyan-400" />
                  </motion.div>
                  <div>
                    <h3 className="font-semibold text-sm text-text">
                      {job.account || 'Unknown'}
                      {job.provider && <span className={`ml-2 text-[10px] ${PROVIDER_COLORS[job.provider] || ''}`}>[{job.provider?.toUpperCase()}]</span>}
                    </h3>
                    <p className="text-[10px] text-text-muted">
                      Job: <span className="font-mono">{job.id}</span>
                      {job.regions_total > 1 && ` \u2022 ${job.regions_scanned?.length || 0}/${job.regions_total} regions`}
                    </p>
                  </div>
                </div>
                <StatusBadge status="running" />
              </div>
              <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden mb-2">
                <motion.div className="h-full bg-gradient-to-r from-cyan-500 to-primary rounded-full"
                  initial={{ width: 0 }} animate={{ width: `${job.progress || 0}%` }} transition={{ duration: 0.5 }} />
              </div>
              <p className="text-[10px] text-text-muted tabular-nums">{job.progress || 0}% complete</p>
              {job.log?.length > 0 && (
                <div className="mt-3 bg-surface/60 rounded-xl p-3 max-h-28 overflow-y-auto border border-border/20">
                  {job.log.map((line, i) => (
                    <p key={i} className="text-[10px] text-text-muted font-mono flex items-start gap-2">
                      <Terminal className="w-3 h-3 mt-0.5 flex-shrink-0 text-text-muted/50" /> {line}
                    </p>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* History */}
      <div>
        <h2 className="text-xs font-semibold text-text-muted mb-3 uppercase tracking-wider">
          Scan History <span className="text-text-muted/50">({jobs.length})</span>
        </h2>
        {jobs.length === 0 ? (
          <Card hover={false}>
            <div className="text-center py-8 text-text-muted text-sm">
              No scans yet. Select a provider and account, enter credentials, then start a scan.
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {jobs.filter((j) => j.status !== 'running').map((job, i) => (
              <motion.div key={job.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}
                className="bg-surface-light/80 border border-border/30 rounded-2xl p-4 hover:border-border/50 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                      job.status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/15' : 'bg-red-500/10 border-red-500/15'
                    }`}>
                      {job.status === 'completed' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-text">
                        {job.account || 'Unknown'}
                        {job.provider && <span className={`ml-2 text-[10px] ${PROVIDER_COLORS[job.provider] || 'text-text-muted'}`}>[{job.provider?.toUpperCase()}]</span>}
                      </h3>
                      <p className="text-[10px] text-text-muted font-mono">{job.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-text-muted">
                    {job.resources > 0 && <span className="text-emerald-400">{job.resources} resources</span>}
                    {job.findings > 0 && <span className="text-orange-400">{job.findings} findings</span>}
                    {job.score > 0 && <span className="text-primary-light">Score: {job.score}</span>}
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(job.started).toLocaleString()}</span>
                    <StatusBadge status={job.status} />
                  </div>
                </div>
                {job.status === 'failed' && job.error && (
                  <div className="mt-2 p-2.5 bg-red-500/8 border border-red-500/15 rounded-xl text-xs text-red-400 flex items-start gap-2">
                    <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium">Scan failed:</span> {job.error}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
