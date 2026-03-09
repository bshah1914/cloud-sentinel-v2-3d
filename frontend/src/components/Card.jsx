import { motion } from 'framer-motion';
import { clsx } from 'clsx';

export default function Card({ children, className, glow, delay = 0, ...props }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={clsx(
        'rounded-xl bg-surface-light border border-border p-6',
        'hover:border-primary/40 transition-all duration-300',
        glow && `glow-${glow}`,
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
