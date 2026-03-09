import { motion } from 'framer-motion';

export default function StatCard({ icon: Icon, label, value, color = 'primary', delay = 0 }) {
  const colors = {
    primary: 'from-indigo-500/20 to-indigo-600/5 text-indigo-400 border-indigo-500/20',
    accent: 'from-cyan-500/20 to-cyan-600/5 text-cyan-400 border-cyan-500/20',
    success: 'from-emerald-500/20 to-emerald-600/5 text-emerald-400 border-emerald-500/20',
    warning: 'from-amber-500/20 to-amber-600/5 text-amber-400 border-amber-500/20',
    danger: 'from-red-500/20 to-red-600/5 text-red-400 border-red-500/20',
    info: 'from-blue-500/20 to-blue-600/5 text-blue-400 border-blue-500/20',
  };

  const iconColors = {
    primary: 'text-indigo-400',
    accent: 'text-cyan-400',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-red-400',
    info: 'text-blue-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ scale: 1.02, y: -2 }}
      className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${colors[color]} border p-5`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-text-muted text-sm font-medium">{label}</p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.2 }}
            className="text-3xl font-bold text-text mt-1"
          >
            {value}
          </motion.p>
        </div>
        <div className={`p-3 rounded-lg bg-surface/50 ${iconColors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      {/* Decorative circle */}
      <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-gradient-to-br ${colors[color]} opacity-20 blur-xl`} />
    </motion.div>
  );
}
