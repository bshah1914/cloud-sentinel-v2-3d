import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  LayoutDashboard, Users, ShieldCheck, Server, KeyRound,
  ShieldAlert, ScanLine, Cloud, ChevronLeft, ChevronRight,
  UserCog, Layers, Sparkles, FileText, ClipboardCheck, BookOpen, Crosshair
} from 'lucide-react';

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Overview', section: 'main' },
  { to: '/dashboard', icon: Layers, label: 'Dashboard', section: 'main' },
  { to: '/accounts', icon: Users, label: 'Accounts', section: 'manage' },
  { to: '/scan', icon: ScanLine, label: 'Scans', section: 'manage' },
  { to: '/audit', icon: ShieldCheck, label: 'Audit', section: 'security' },
  { to: '/resources', icon: Server, label: 'Resources', section: 'security' },
  { to: '/iam', icon: KeyRound, label: 'IAM', section: 'security' },
  { to: '/security-groups', icon: ShieldAlert, label: 'Security', section: 'security' },
  { to: '/threats', icon: Crosshair, label: 'Threats', section: 'security' },
  { to: '/compliance', icon: ClipboardCheck, label: 'Compliance', section: 'compliance' },
  { to: '/report', icon: FileText, label: 'Report', section: 'report' },
  { to: '/docs', icon: BookOpen, label: 'Docs', section: 'report' },
  { to: '/users', icon: UserCog, label: 'Users', section: 'admin' },
];

const SECTIONS = {
  main: 'Dashboard',
  manage: 'Management',
  security: 'Security',
  compliance: 'Compliance',
  report: 'Reports',
  admin: 'Admin',
};

const PROVIDER_COLORS = {
  aws: { bg: 'from-orange-500/20 to-orange-600/10', dot: '#FF9900', label: 'AWS' },
  azure: { bg: 'from-blue-500/20 to-blue-600/10', dot: '#0078D4', label: 'Azure' },
  gcp: { bg: 'from-sky-500/20 to-sky-600/10', dot: '#4285F4', label: 'GCP' },
};

export default function Sidebar({ collapsed, onToggle, activeProvider }) {
  const location = useLocation();
  const providerInfo = PROVIDER_COLORS[activeProvider];

  let lastSection = null;

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed left-0 top-0 h-screen bg-surface-light/95 backdrop-blur-xl border-r border-border/50 z-50 flex flex-col"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-border/50">
        <div className="flex items-center gap-3 overflow-hidden">
          <motion.div
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.6 }}
            className="w-10 h-10 rounded-xl gradient-border flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/15"
          >
            <Cloud className="w-5 h-5 text-white" />
          </motion.div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="whitespace-nowrap"
              >
                <h1 className="text-sm font-bold gradient-text">CloudLunar</h1>
                <p className="text-[10px] text-text-muted tracking-wider uppercase">Enterprise Security</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Provider indicator */}
      {activeProvider && (
        <div className="px-3 pt-3">
          <div className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r border border-border/30',
            providerInfo?.bg || 'from-primary/20 to-primary/10'
          )}>
            <span className="relative flex-shrink-0">
              <span className="w-2.5 h-2.5 rounded-full block" style={{ background: providerInfo?.dot || '#6366f1' }} />
              <span className="absolute inset-0 w-2.5 h-2.5 rounded-full animate-ping opacity-30" style={{ background: providerInfo?.dot || '#6366f1' }} />
            </span>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs font-semibold text-text uppercase tracking-wider"
                >
                  {providerInfo?.label || activeProvider}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, icon: Icon, label, section }) => {
          const showSection = section !== lastSection && !collapsed;
          lastSection = section;
          return (
            <div key={to}>
              {showSection && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[10px] font-semibold text-text-muted/60 uppercase tracking-widest px-3 pt-4 pb-1.5"
                >
                  {SECTIONS[section]}
                </motion.p>
              )}
              <div className={collapsed ? 'tooltip-wrapper' : ''}>
                <NavLink
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) => clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative',
                    isActive
                      ? 'bg-primary/12 text-primary-light nav-active-indicator shadow-sm shadow-primary/5'
                      : 'text-text-muted hover:text-text hover:bg-white/[0.03]'
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <div className={clsx(
                        'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all',
                        isActive ? 'bg-primary/15' : 'bg-transparent'
                      )}>
                        <Icon className={clsx('w-[18px] h-[18px]', isActive && 'text-primary-light')} />
                      </div>
                      <AnimatePresence>
                        {!collapsed && (
                          <motion.span
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -5 }}
                            className="whitespace-nowrap"
                          >
                            {label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {isActive && !collapsed && (
                        <motion.div
                          layoutId="nav-dot"
                          className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-light"
                          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        />
                      )}
                    </>
                  )}
                </NavLink>
                {collapsed && <span className="tooltip-text">{label}</span>}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Upgrade banner - only when expanded */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-3 pb-2 overflow-hidden"
          >
            <div className="rounded-xl bg-gradient-to-br from-primary/15 to-accent/10 border border-primary/10 p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary-light" />
                <span className="text-xs font-semibold text-text">CloudLunar Pro</span>
              </div>
              <p className="text-[10px] text-text-muted leading-relaxed">Multi-cloud scanning with real-time alerts and compliance reports.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapse button */}
      <div className="p-3 border-t border-border/50">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-text-muted hover:text-text hover:bg-white/[0.03] transition-all text-sm"
        >
          <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.3 }}>
            <ChevronLeft className="w-4 h-4" />
          </motion.div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs">
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}
