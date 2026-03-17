import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Headphones, MessageSquare, Send, Search, BookOpen, Zap,
  Mail, Clock, CheckCircle2, AlertTriangle, ChevronRight,
  ChevronDown, Bug, Lightbulb, HelpCircle, FileText, Shield,
  ExternalLink, Phone, Globe, Star, ThumbsUp, ThumbsDown
} from 'lucide-react';
import Card from '../components/Card';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth';

const TICKET_CATEGORIES = [
  { id: 'bug', label: 'Bug Report', icon: Bug, color: '#f43f5e', desc: 'Something isn\'t working correctly' },
  { id: 'feature', label: 'Feature Request', icon: Lightbulb, color: '#eab308', desc: 'Suggest a new feature or improvement' },
  { id: 'security', label: 'Security Issue', icon: Shield, color: '#ef4444', desc: 'Report a security vulnerability' },
  { id: 'billing', label: 'Billing & Plans', icon: FileText, color: '#7c3aed', desc: 'Questions about pricing or subscriptions' },
  { id: 'general', label: 'General Question', icon: HelpCircle, color: '#38bdf8', desc: 'General help and inquiries' },
  { id: 'integration', label: 'Integration Help', icon: Globe, color: '#4ade80', desc: 'Help with cloud provider setup' },
];

const PRIORITY_OPTIONS = [
  { id: 'low', label: 'Low', color: '#60a5fa', desc: 'General question, no urgency' },
  { id: 'medium', label: 'Medium', color: '#eab308', desc: 'Impacting workflow but workaround exists' },
  { id: 'high', label: 'High', color: '#f97316', desc: 'Major feature broken, no workaround' },
  { id: 'critical', label: 'Critical', color: '#f43f5e', desc: 'Security incident or complete outage' },
];

const SAMPLE_TICKETS = [
  { id: 'TK-001', subject: 'AWS scan failing for us-west-2 region', category: 'bug', priority: 'high', status: 'in_progress', created: '2h ago', replies: 3 },
  { id: 'TK-002', subject: 'Request: Add Kubernetes cluster scanning', category: 'feature', priority: 'medium', status: 'open', created: '1d ago', replies: 1 },
  { id: 'TK-003', subject: 'How to configure Azure Service Principal?', category: 'integration', priority: 'low', status: 'resolved', created: '3d ago', replies: 5 },
  { id: 'TK-004', subject: 'Upgrade from Free to Pro plan', category: 'billing', priority: 'low', status: 'resolved', created: '5d ago', replies: 2 },
];

const FAQ = [
  { q: 'How do I add a new cloud account?', a: 'Go to Accounts → Add Account. Select your provider (AWS/Azure/GCP), enter the account ID and name, then click Save. After adding, go to Scans to run your first scan.' },
  { q: 'Why does my scan show 0 resources?', a: 'Make sure your credentials have the correct IAM permissions. For AWS, the user needs ReadOnlyAccess or specific service permissions (EC2, S3, IAM, RDS, Lambda, etc.).' },
  { q: 'How is the security score calculated?', a: 'The security score is based on: root MFA status, IAM user MFA coverage, open security groups, public resources, encryption status, and CloudTrail/GuardDuty enablement.' },
  { q: 'What compliance frameworks are supported?', a: 'CloudSentinel supports 10 frameworks: CIS AWS/Azure/GCP, NIST 800-53, SOC 2, ISO 27001, PCI-DSS, HIPAA, GDPR, and AWS Well-Architected Security Pillar.' },
  { q: 'How do I export reports?', a: 'Go to Report page → Click Export Excel or Export PDF. You can also export from Dashboard (CSV/PDF) and Compliance (PDF/CSV/JSON).' },
  { q: 'Can I schedule automatic scans?', a: 'Automatic scheduling is available on the Pro and Enterprise plans. Contact support or upgrade your plan to enable this feature.' },
  { q: 'Is my data secure?', a: 'Yes. Credentials are used only during scans and never stored. All data is kept locally on your server. JWT tokens expire after 8 hours. Passwords are bcrypt hashed.' },
  { q: 'How do I use the AI assistant?', a: 'Click the sparkle button (✨) in the bottom-right corner. Ask about security risks, compliance scores, WAF analysis, or remediation steps. The AI uses your actual scan data.' },
];

const STATUS_STYLES = {
  open: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/15', label: 'Open' },
  in_progress: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/15', label: 'In Progress' },
  resolved: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/15', label: 'Resolved' },
  closed: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/15', label: 'Closed' },
};

export default function Support() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('help');
  const [expandedFaq, setExpandedFaq] = useState(new Set([0]));
  const [searchFaq, setSearchFaq] = useState('');

  // Ticket form state
  const [ticketForm, setTicketForm] = useState({ subject: '', category: 'general', priority: 'medium', description: '' });
  const [tickets, setTickets] = useState(SAMPLE_TICKETS);

  // Feedback state
  const [feedback, setFeedback] = useState({ rating: 0, message: '' });

  const handleSubmitTicket = () => {
    if (!ticketForm.subject.trim() || !ticketForm.description.trim()) {
      addToast('Please fill in subject and description', 'warning');
      return;
    }
    const newTicket = {
      id: `TK-${String(tickets.length + 1).padStart(3, '0')}`,
      subject: ticketForm.subject,
      category: ticketForm.category,
      priority: ticketForm.priority,
      status: 'open',
      created: 'Just now',
      replies: 0,
    };
    setTickets([newTicket, ...tickets]);
    setTicketForm({ subject: '', category: 'general', priority: 'medium', description: '' });
    addToast(`Ticket ${newTicket.id} created successfully`, 'success');
    setActiveTab('tickets');
  };

  const handleFeedback = () => {
    if (!feedback.rating) { addToast('Please select a rating', 'warning'); return; }
    addToast('Thank you for your feedback!', 'success');
    setFeedback({ rating: 0, message: '' });
  };

  const filteredFaq = searchFaq
    ? FAQ.filter(f => f.q.toLowerCase().includes(searchFaq.toLowerCase()) || f.a.toLowerCase().includes(searchFaq.toLowerCase()))
    : FAQ;

  const tabs = [
    { id: 'help', label: 'Help Center', icon: HelpCircle },
    { id: 'new-ticket', label: 'New Ticket', icon: MessageSquare },
    { id: 'tickets', label: 'My Tickets', icon: FileText, count: tickets.filter(t => t.status !== 'resolved' && t.status !== 'closed').length },
    { id: 'feedback', label: 'Feedback', icon: Star },
    { id: 'contact', label: 'Contact', icon: Headphones },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="report-header text-center">
        <div className="w-12 h-12 rounded-2xl gradient-border flex items-center justify-center mx-auto mb-3 shadow-lg shadow-primary/15">
          <Headphones className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-text">Support Center</h1>
        <p className="text-text-muted text-sm mt-1">Get help, report issues, or share feedback</p>
      </motion.div>

      {/* Tabs */}
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        {tabs.map(({ id, label, icon: Icon, count }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
              activeTab === id ? 'bg-primary/12 text-primary-light border-primary/20' : 'bg-surface-light/50 text-text-muted border-border/30 hover:text-text'
            }`}>
            <Icon className="w-3.5 h-3.5" /> {label}
            {count > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/12 text-amber-400 font-bold">{count}</span>}
          </button>
        ))}
      </div>

      {/* ═══ HELP CENTER ═══ */}
      {activeTab === 'help' && (
        <div className="space-y-5">
          {/* Quick Links */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { icon: BookOpen, title: 'Documentation', desc: '15 guides covering every feature', color: '#7c3aed', link: '/docs' },
              { icon: MessageSquare, title: 'AI Assistant', desc: 'Ask anything about your cloud security', color: '#38bdf8', action: 'ai' },
              { icon: Zap, title: 'Quick Start', desc: 'Get started in under 5 minutes', color: '#4ade80', link: '/docs' },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                whileHover={{ y: -2 }}
                className="rounded-xl border border-border/40 bg-surface-light/60 p-5 cursor-pointer hover:border-primary/20 transition-all">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: `${item.color}12`, border: `1px solid ${item.color}20` }}>
                  <item.icon className="w-5 h-5" style={{ color: item.color }} />
                </div>
                <h3 className="text-sm font-semibold text-text">{item.title}</h3>
                <p className="text-[10px] text-text-muted mt-1">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* FAQ */}
          <div>
            <div className="section-title mb-4"><HelpCircle className="w-4 h-4 text-primary-light" /><span>Frequently Asked Questions</span></div>
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input type="text" value={searchFaq} onChange={e => setSearchFaq(e.target.value)} placeholder="Search FAQ..."
                className="w-full bg-surface-light border border-border/50 rounded-xl pl-10 pr-3 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-primary/30 transition-all" />
            </div>
            <div className="space-y-2">
              {filteredFaq.map((faq, i) => {
                const isOpen = expandedFaq.has(i);
                return (
                  <div key={i} className="border border-border/30 rounded-xl overflow-hidden bg-surface-light/50">
                    <button onClick={() => { const n = new Set(expandedFaq); n.has(i) ? n.delete(i) : n.add(i); setExpandedFaq(n); }}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-all text-left">
                      <span className="text-sm font-medium text-text">{faq.q}</span>
                      <motion.div animate={{ rotate: isOpen ? 180 : 0 }}><ChevronDown className="w-4 h-4 text-text-muted" /></motion.div>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-3 border-t border-border/20">
                        <p className="text-xs text-text-muted leading-relaxed pt-2">{faq.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ NEW TICKET ═══ */}
      {activeTab === 'new-ticket' && (
        <Card hover={false}>
          <div className="section-title mb-5"><MessageSquare className="w-4 h-4 text-primary-light" /><span>Submit a Support Ticket</span></div>
          <div className="space-y-4 max-w-2xl">
            {/* Category */}
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-widest font-semibold mb-2 block">Category</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {TICKET_CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setTicketForm({ ...ticketForm, category: cat.id })}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all text-left ${
                      ticketForm.category === cat.id ? 'border-primary/30 bg-primary/8' : 'border-border/30 hover:border-border/50'
                    }`}>
                    <cat.icon className="w-4 h-4 flex-shrink-0" style={{ color: cat.color }} />
                    <div>
                      <p className="text-text font-semibold">{cat.label}</p>
                      <p className="text-[9px] text-text-muted">{cat.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-widest font-semibold mb-1.5 block">Subject</label>
              <input type="text" value={ticketForm.subject} onChange={e => setTicketForm({ ...ticketForm, subject: e.target.value })}
                placeholder="Brief summary of your issue"
                className="w-full bg-surface/50 border border-border/50 rounded-xl px-4 py-2.5 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-primary/30 transition-all" />
            </div>

            {/* Priority */}
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-widest font-semibold mb-2 block">Priority</label>
              <div className="flex gap-2">
                {PRIORITY_OPTIONS.map(p => (
                  <button key={p.id} onClick={() => setTicketForm({ ...ticketForm, priority: p.id })}
                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold border text-center transition-all ${
                      ticketForm.priority === p.id ? 'opacity-100' : 'opacity-40 hover:opacity-70'
                    }`} style={{ borderColor: `${p.color}30`, background: ticketForm.priority === p.id ? `${p.color}10` : 'transparent', color: p.color }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-[10px] text-text-muted uppercase tracking-widest font-semibold mb-1.5 block">Description</label>
              <textarea value={ticketForm.description} onChange={e => setTicketForm({ ...ticketForm, description: e.target.value })}
                rows={5} placeholder="Describe your issue in detail. Include steps to reproduce, expected behavior, and any error messages."
                className="w-full bg-surface/50 border border-border/50 rounded-xl px-4 py-3 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-primary/30 transition-all resize-none" />
            </div>

            <button onClick={handleSubmitTicket}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-primary-dark rounded-xl text-sm font-semibold transition-all shadow-lg shadow-primary/15 hover:shadow-primary/25">
              <Send className="w-4 h-4" /> Submit Ticket
            </button>
          </div>
        </Card>
      )}

      {/* ═══ MY TICKETS ═══ */}
      {activeTab === 'tickets' && (
        <Card hover={false}>
          <div className="section-title mb-4"><FileText className="w-4 h-4 text-primary-light" /><span>My Tickets ({tickets.length})</span></div>
          <div className="space-y-2">
            {tickets.map((ticket, i) => {
              const catMeta = TICKET_CATEGORIES.find(c => c.id === ticket.category) || TICKET_CATEGORIES[4];
              const statusStyle = STATUS_STYLES[ticket.status] || STATUS_STYLES.open;
              const prioMeta = PRIORITY_OPTIONS.find(p => p.id === ticket.priority) || PRIORITY_OPTIONS[1];
              return (
                <motion.div key={ticket.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl border border-border/25 hover:border-border/50 bg-surface-light/30 transition-all">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${catMeta.color}12` }}>
                    <catMeta.icon className="w-4 h-4" style={{ color: catMeta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-text-muted font-mono">{ticket.id}</span>
                      <span className="text-sm font-medium text-text truncate">{ticket.subject}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[9px] text-text-muted flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{ticket.created}</span>
                      <span className="text-[9px] text-text-muted">{ticket.replies} replies</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-bold" style={{ color: prioMeta.color, background: `${prioMeta.color}10` }}>
                    {prioMeta.label}
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                    {statusStyle.label}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ═══ FEEDBACK ═══ */}
      {activeTab === 'feedback' && (
        <Card hover={false} className="max-w-xl mx-auto">
          <div className="text-center mb-6">
            <Star className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <h2 className="text-lg font-bold text-text">Rate Your Experience</h2>
            <p className="text-xs text-text-muted mt-1">Help us improve CloudSentinel</p>
          </div>

          {/* Star Rating */}
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map(star => (
              <motion.button key={star} whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}
                onClick={() => setFeedback({ ...feedback, rating: star })}
                className="p-1 transition-all">
                <Star className={`w-8 h-8 ${feedback.rating >= star ? 'text-amber-400 fill-amber-400' : 'text-text-muted/20'}`} />
              </motion.button>
            ))}
          </div>
          {feedback.rating > 0 && (
            <p className="text-center text-xs text-text-muted mb-4">
              {feedback.rating <= 2 ? "We're sorry to hear that. Please tell us how we can improve." :
               feedback.rating <= 4 ? 'Thanks! Any suggestions for improvement?' :
               'Awesome! We\'re glad you love CloudSentinel!'}
            </p>
          )}

          <textarea value={feedback.message} onChange={e => setFeedback({ ...feedback, message: e.target.value })}
            rows={4} placeholder="Share your thoughts, suggestions, or what you love about CloudSentinel..."
            className="w-full bg-surface/50 border border-border/50 rounded-xl px-4 py-3 text-sm text-text placeholder:text-text-muted/40 focus:outline-none focus:border-primary/30 transition-all resize-none mb-4" />

          <button onClick={handleFeedback}
            className="w-full py-3 bg-gradient-to-r from-primary to-primary-dark rounded-xl text-sm font-semibold transition-all shadow-lg shadow-primary/15 flex items-center justify-center gap-2">
            <Send className="w-4 h-4" /> Submit Feedback
          </button>
        </Card>
      )}

      {/* ═══ CONTACT ═══ */}
      {activeTab === 'contact' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: Mail, title: 'Email Support', detail: 'support@cloudsentinel.io', sub: 'Response within 24 hours', color: '#7c3aed' },
              { icon: Phone, title: 'Phone Support', detail: '+1 (800) 555-CLOUD', sub: 'Mon-Fri 9am-6pm EST (Enterprise)', color: '#4ade80' },
              { icon: MessageSquare, title: 'Live Chat', detail: 'Available in-app', sub: 'AI assistant 24/7, human agents on Pro+', color: '#38bdf8' },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="rounded-xl border border-border/40 bg-surface-light/60 p-5 text-center hover:border-primary/15 transition-all">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: `${item.color}12`, border: `1px solid ${item.color}20` }}>
                  <item.icon className="w-6 h-6" style={{ color: item.color }} />
                </div>
                <h3 className="text-sm font-semibold text-text">{item.title}</h3>
                <p className="text-xs text-primary-light font-medium mt-1">{item.detail}</p>
                <p className="text-[10px] text-text-muted mt-1">{item.sub}</p>
              </motion.div>
            ))}
          </div>

          <Card hover={false}>
            <div className="section-title mb-4"><Clock className="w-4 h-4 text-accent-light" /><span>Support SLA by Plan</span></div>
            <div className="overflow-x-auto">
              <table className="corp-table w-full">
                <thead><tr><th>Plan</th><th>Response Time</th><th>Channels</th><th>Hours</th></tr></thead>
                <tbody>
                  <tr><td className="text-text font-medium">Free</td><td>Best effort</td><td>Community forum, AI chat</td><td>AI: 24/7</td></tr>
                  <tr><td className="text-text font-medium">Pro</td><td className="text-amber-400">24 hours</td><td>Email, Slack, AI chat</td><td>Mon-Fri 9-6 EST</td></tr>
                  <tr><td className="text-text font-medium">Enterprise</td><td className="text-emerald-400 font-semibold">1 hour</td><td>All + dedicated engineer + phone</td><td>24/7/365</td></tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
