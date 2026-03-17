import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Command, LayoutDashboard, Shield, Server, KeyRound,
  ShieldAlert, ScanLine, Users, FileText, Layers, ClipboardCheck,
  Zap, Globe, Activity, Settings, LogOut, ArrowRight, Clock,
  AlertTriangle, CheckCircle2, Copy, ExternalLink, Hash
} from 'lucide-react';
import { useAuth } from '../auth';

const PAGES = [
  { id: 'overview', label: 'Overview', desc: 'Multi-cloud executive dashboard', icon: LayoutDashboard, path: '/', category: 'Navigate' },
  { id: 'dashboard', label: 'Dashboard', desc: 'Account-level metrics and charts', icon: Layers, path: '/dashboard', category: 'Navigate' },
  { id: 'accounts', label: 'Accounts', desc: 'Manage cloud accounts and CIDRs', icon: Users, path: '/accounts', category: 'Navigate' },
  { id: 'scan', label: 'Scans', desc: 'Run and monitor cloud scans', icon: ScanLine, path: '/scan', category: 'Navigate' },
  { id: 'audit', label: 'Security Audit', desc: 'Run security audits and view findings', icon: Shield, path: '/audit', category: 'Navigate' },
  { id: 'resources', label: 'Resources', desc: 'Browse EC2, S3, Lambda, RDS resources', icon: Server, path: '/resources', category: 'Navigate' },
  { id: 'iam', label: 'IAM Report', desc: 'Users, roles, policies, and MFA status', icon: KeyRound, path: '/iam', category: 'Navigate' },
  { id: 'security-groups', label: 'Security Groups', desc: 'Risky firewall rules and open ports', icon: ShieldAlert, path: '/security-groups', category: 'Navigate' },
  { id: 'compliance', label: 'Compliance', desc: '10 frameworks — CIS, NIST, SOC2, PCI-DSS, HIPAA, GDPR', icon: ClipboardCheck, path: '/compliance', category: 'Navigate' },
  { id: 'report', label: 'Report', desc: 'Comprehensive report with Excel/PDF export', icon: FileText, path: '/report', category: 'Navigate' },
  { id: 'users', label: 'User Management', desc: 'Manage users and RBAC roles', icon: Settings, path: '/users', category: 'Navigate' },
];

const ACTIONS = [
  { id: 'run-scan', label: 'Run Cloud Scan', desc: 'Start a new cloud resource scan', icon: Zap, path: '/scan', category: 'Action' },
  { id: 'run-audit', label: 'Run Security Audit', desc: 'Scan for misconfigurations', icon: Shield, path: '/audit', category: 'Action' },
  { id: 'run-compliance', label: 'Run Compliance Scan', desc: 'Check against 10 compliance frameworks', icon: ClipboardCheck, path: '/compliance', category: 'Action' },
  { id: 'export-report', label: 'Export Full Report', desc: 'Download comprehensive PDF/Excel report', icon: FileText, path: '/report', category: 'Action' },
  { id: 'add-account', label: 'Add Cloud Account', desc: 'Onboard AWS, Azure, or GCP account', icon: Globe, path: '/accounts', category: 'Action' },
];

const SHORTCUTS = [
  { keys: ['Ctrl', 'K'], desc: 'Open command palette' },
  { keys: ['Ctrl', 'D'], desc: 'Go to Dashboard' },
  { keys: ['Ctrl', 'S'], desc: 'Go to Scans' },
  { keys: ['Ctrl', 'A'], desc: 'Go to Audit' },
  { keys: ['Ctrl', 'R'], desc: 'Go to Report' },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { logout } = useAuth();

  // Keyboard shortcut to open
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        setQuery('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape') setOpen(false);

      // Quick navigation shortcuts
      if ((e.ctrlKey || e.metaKey) && !open) {
        const shortcuts = { d: '/dashboard', s: '/scan', a: '/audit', r: '/report' };
        if (shortcuts[e.key]) { e.preventDefault(); navigate(shortcuts[e.key]); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, navigate]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const allItems = useMemo(() => [...PAGES, ...ACTIONS], []);

  const filtered = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase();
    return allItems.filter(item =>
      item.label.toLowerCase().includes(q) ||
      item.desc.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  }, [query, allItems]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  const handleSelect = (item) => {
    setOpen(false);
    setQuery('');
    if (item.id === 'logout') { logout(); return; }
    navigate(item.path);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && filtered[selectedIndex]) { handleSelect(filtered[selectedIndex]); }
  };

  // Group by category
  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [filtered]);

  let flatIndex = -1;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
            onClick={() => setOpen(false)}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-xl z-[201] rounded-2xl overflow-hidden border border-border/50 shadow-2xl shadow-black/40"
            style={{ background: 'var(--color-surface-light)' }}
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border/40">
              <Search className="w-5 h-5 text-primary-light flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search pages, actions, or type a command..."
                className="flex-1 bg-transparent text-text text-sm placeholder:text-text-muted/50 focus:outline-none"
              />
              <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-surface-lighter/50 border border-border/30 text-[10px] text-text-muted font-mono">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[400px] overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="py-12 text-center">
                  <Search className="w-8 h-8 text-text-muted/30 mx-auto mb-3" />
                  <p className="text-sm text-text-muted">No results for "{query}"</p>
                  <p className="text-xs text-text-muted/60 mt-1">Try searching for pages, actions, or features</p>
                </div>
              ) : (
                Object.entries(grouped).map(([category, items]) => (
                  <div key={category}>
                    <p className="text-[9px] font-bold text-text-muted/60 uppercase tracking-widest px-3 pt-3 pb-1.5">{category}</p>
                    {items.map((item) => {
                      flatIndex++;
                      const idx = flatIndex;
                      const isSelected = idx === selectedIndex;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                            isSelected ? 'bg-primary/10 text-primary-light' : 'text-text hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'bg-primary/15' : 'bg-surface-lighter/50'
                          }`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.label}</p>
                            <p className="text-[10px] text-text-muted truncate">{item.desc}</p>
                          </div>
                          {isSelected && <ArrowRight className="w-4 h-4 text-primary-light flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer with shortcuts */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/30 bg-surface/50">
              <div className="flex items-center gap-4">
                {[
                  { keys: ['↑', '↓'], label: 'Navigate' },
                  { keys: ['↵'], label: 'Open' },
                  { keys: ['esc'], label: 'Close' },
                ].map(({ keys, label }) => (
                  <div key={label} className="flex items-center gap-1.5 text-[9px] text-text-muted/60">
                    {keys.map(k => (
                      <kbd key={k} className="px-1.5 py-0.5 rounded bg-surface-lighter/40 border border-border/20 font-mono">{k}</kbd>
                    ))}
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <span className="text-[9px] text-text-muted/40">CloudSentinel v3.0</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
