import { motion } from 'framer-motion';

export default function Loader({ text = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <motion.div
        className="w-12 h-12 rounded-full border-3 border-surface-lighter border-t-primary"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
      <p className="mt-4 text-text-muted text-sm">{text}</p>
    </div>
  );
}
