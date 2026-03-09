import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Wifi, WifiOff, LogOut, ShieldCheck } from 'lucide-react';
import { getHealth } from '../api';
import { useAuth } from '../auth';

export default function Topbar({ account, onAccountChange, accounts }) {
  const { user, logout } = useAuth();
  const [health, setHealth] = useState(null);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(null));
    const t = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="h-16 glass border-b border-border flex items-center justify-between px-6 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <select
          value={account}
          onChange={(e) => onAccountChange(e.target.value)}
          className="bg-surface-lighter border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary transition-colors cursor-pointer"
        >
          {accounts.map((a) => (
            <option key={a.name} value={a.name}>{a.name} ({a.id})</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Clock className="w-3.5 h-3.5" />
          {time.toLocaleTimeString()}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2"
        >
          {health ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Wifi className="w-3.5 h-3.5" />
              <span>API Connected</span>
              <span className="text-text-muted">v{health.version}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <WifiOff className="w-3.5 h-3.5" />
              <span>API Offline</span>
            </div>
          )}
        </motion.div>

        {/* Divider */}
        <div className="w-px h-6 bg-border" />

        {/* User info + Logout */}
        {user && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-primary-light" />
              </div>
              <div className="text-xs">
                <p className="text-text font-medium">{user.username}</p>
                <p className="text-text-muted capitalize">{user.role}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
