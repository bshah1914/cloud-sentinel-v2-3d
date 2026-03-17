import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, X, Sparkles, User, Minimize2, Maximize2, Shield, Zap, Brain, RefreshCw } from 'lucide-react';

const SUGGESTIONS = [
  { text: 'Well-Architected analysis', icon: Shield },
  { text: 'Top security risks', icon: Zap },
  { text: 'How to improve my score?', icon: Brain },
  { text: 'Publicly exposed resources', icon: RefreshCw },
];

// Simple markdown-like rendering
function RenderMessage({ content }) {
  const lines = content.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return <p key={i} className="text-sm font-bold text-text mt-2 mb-1">{line.replace('## ', '')}</p>;
        }
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={i} className="text-xs font-semibold text-text mt-1.5">{line.replace(/\*\*/g, '')}</p>;
        }
        if (line.match(/^\*\*.*\*\*:/)) {
          const parts = line.split('**');
          return (
            <p key={i} className="text-xs mt-1.5">
              <span className="font-semibold text-text">{parts[1]}</span>
              <span className="text-text-muted">{parts[2]}</span>
            </p>
          );
        }
        if (line.startsWith('- ')) {
          const text = line.slice(2);
          const hasEmoji = /^[✅❌⚠️🔴🟠🟡🟢✓✗]/.test(text);
          const hasResource = text.includes('`');
          if (hasResource) {
            const parts = text.split('`');
            return (
              <p key={i} className="text-xs text-text-muted pl-3 flex items-start gap-1.5">
                <span className="text-primary-light mt-0.5 text-[8px]">●</span>
                <span>{parts.map((p, j) => j % 2 === 1 ? <code key={j} className="px-1 py-0.5 rounded bg-primary/8 text-primary-light text-[10px] font-mono">{p}</code> : p)}</span>
              </p>
            );
          }
          return (
            <p key={i} className="text-xs text-text-muted pl-3 flex items-start gap-1.5">
              <span className={`mt-0.5 text-[8px] ${hasEmoji ? '' : 'text-primary-light'}`}>{hasEmoji ? '' : '●'}</span>
              <span>{text}</span>
            </p>
          );
        }
        if (line.startsWith('   ✓') || line.startsWith('   ✗')) {
          const passed = line.includes('✓');
          return (
            <p key={i} className={`text-[11px] pl-6 ${passed ? 'text-emerald-400' : 'text-red-400'}`}>
              {line.trim()}
            </p>
          );
        }
        if (line.trim() === '') return <div key={i} className="h-1" />;
        return <p key={i} className="text-xs text-text-muted leading-relaxed">{line}</p>;
      })}
    </div>
  );
}

export default function AiChat() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Welcome to CloudSentinel AI! I analyze your cloud infrastructure against the **AWS Well-Architected Framework** and security best practices.\n\nI can help with:\n- **Well-Architected analysis** across 6 pillars\n- **Security risk assessment** and findings\n- **Compliance recommendations** (CIS, SOC2, GDPR)\n- **Actionable remediation** steps\n\nWhat would you like to know?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setLoading(true);

    try {
      const token = localStorage.getItem('cm_token');
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: msg, history: messages.slice(-6) }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response || data.detail || 'I could not process that request.', wafScore: data.waf_score }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Unable to connect to the AI service. Please check that the backend is running.' }]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <>
      {/* Floating Action Button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl shadow-2xl shadow-primary/30 flex items-center justify-center group overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #6366f1, #06b6d4)' }}
          >
            <Sparkles className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-surface dot-pulse" />
            {/* Shine effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.9 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl overflow-hidden border border-border/30"
            style={{
              width: minimized ? 340 : 420,
              height: minimized ? 56 : 600,
              boxShadow: '0 25px 60px rgba(0,0,0,0.4), 0 0 40px rgba(99,102,241,0.08)',
              background: 'var(--color-surface-light)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(6,182,212,0.05))' }}
              onClick={() => minimized && setMinimized(false)}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #06b6d4)' }}>
                  <Bot className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text flex items-center gap-1.5">
                    CloudSentinel AI
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold uppercase tracking-wider">Live</span>
                  </h3>
                  {!minimized && <p className="text-[10px] text-text-muted">Security Intelligence &bull; WAF Analysis</p>}
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button onClick={(e) => { e.stopPropagation(); setMinimized(!minimized); }}
                  className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-white/5 transition-all">
                  {minimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                  className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/8 transition-all">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {!minimized && (
              <>
                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map((msg, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        msg.role === 'user' ? 'bg-primary/15' : ''
                      }`}
                        style={msg.role === 'assistant' ? { background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(6,182,212,0.1))' } : {}}>
                        {msg.role === 'user' ? <User className="w-3.5 h-3.5 text-primary-light" /> : <Bot className="w-3.5 h-3.5 text-accent" />}
                      </div>
                      <div className={`max-w-[82%] rounded-2xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-primary/12 text-text rounded-tr-md border border-primary/10'
                          : 'bg-surface-lighter/40 text-text border border-border/20 rounded-tl-md'
                      }`}>
                        {msg.role === 'assistant' ? <RenderMessage content={msg.content} /> : (
                          <p className="text-[13px]">{msg.content}</p>
                        )}
                        {msg.wafScore !== undefined && msg.wafScore > 0 && (
                          <div className="mt-2 pt-2 border-t border-border/20 flex items-center gap-2">
                            <Shield className="w-3 h-3 text-primary-light" />
                            <span className="text-[10px] text-text-muted">WAF Score:</span>
                            <span className={`text-xs font-bold ${msg.wafScore >= 80 ? 'text-emerald-400' : msg.wafScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                              {msg.wafScore}%
                            </span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {loading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(6,182,212,0.1))' }}>
                        <Bot className="w-3.5 h-3.5 text-accent" />
                      </div>
                      <div className="bg-surface-lighter/40 border border-border/20 rounded-2xl rounded-tl-md px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {[0, 1, 2].map((j) => (
                              <motion.span key={j}
                                animate={{ y: [0, -4, 0] }}
                                transition={{ duration: 0.6, repeat: Infinity, delay: j * 0.15 }}
                                className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                            ))}
                          </div>
                          <span className="text-[10px] text-text-muted">Analyzing your infrastructure...</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Suggestions */}
                {messages.length <= 2 && (
                  <div className="px-4 py-2.5 border-t border-border/20">
                    <p className="text-[9px] text-text-muted mb-2 uppercase tracking-widest font-semibold">Try asking</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {SUGGESTIONS.map(({ text, icon: Icon }) => (
                        <button key={text} onClick={() => sendMessage(text)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/8 text-[11px] text-text-muted hover:text-primary-light hover:bg-primary/10 hover:border-primary/15 transition-all text-left">
                          <Icon className="w-3 h-3 text-primary-light/60 flex-shrink-0" />
                          <span className="truncate">{text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input */}
                <div className="p-3 border-t border-border/20">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <input ref={inputRef} type="text" value={input}
                        onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                        placeholder="Ask about security, WAF pillars, compliance..."
                        className="w-full bg-surface/50 border border-border/30 rounded-xl px-4 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-primary/25 transition-all"
                      />
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => sendMessage()}
                      disabled={!input.trim() || loading}
                      className="w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-20 transition-all shadow-sm"
                      style={{ background: input.trim() ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'rgba(99,102,241,0.1)' }}
                    >
                      <Send className="w-4 h-4 text-white" />
                    </motion.button>
                  </div>
                  <p className="text-[8px] text-text-muted/40 text-center mt-1.5">Powered by CloudSentinel Security Intelligence Engine</p>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
