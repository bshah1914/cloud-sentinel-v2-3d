import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { getAccounts } from '../api';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [activeAccount, setActiveAccount] = useState('');

  const refreshAccounts = useCallback(async () => {
    try {
      const res = await getAccounts();
      const accts = res.accounts || [];
      setAccounts(accts);
      // If current active account was removed or doesn't exist, pick a new default
      if (accts.length > 0) {
        const stillExists = accts.find((a) => a.name === activeAccount);
        if (!stillExists) {
          const def = accts.find((a) => a.default) || accts[0];
          setActiveAccount(def.name);
        }
      } else {
        setActiveAccount('');
      }
      return accts;
    } catch {
      return [];
    }
  }, [activeAccount]);

  useEffect(() => {
    getAccounts().then((res) => {
      const accts = res.accounts || [];
      setAccounts(accts);
      if (accts.length > 0) {
        const def = accts.find((a) => a.default) || accts[0];
        setActiveAccount(def.name);
      }
    }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <motion.div
        initial={false}
        animate={{ marginLeft: collapsed ? 72 : 260 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="min-h-screen flex flex-col"
      >
        <Topbar
          account={activeAccount}
          onAccountChange={setActiveAccount}
          accounts={accounts}
        />
        <main className="flex-1 p-6">
          <Outlet context={{ account: activeAccount, accounts, setActiveAccount, refreshAccounts }} />
        </main>
      </motion.div>
    </div>
  );
}
