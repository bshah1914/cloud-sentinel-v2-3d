import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Cloud, Shield, Server, KeyRound, ShieldAlert, ScanLine,
  Users, FileText, ClipboardCheck, Layers, LayoutDashboard, Zap,
  Search, ChevronRight, ChevronDown, Copy, CheckCircle2, Globe,
  Lock, AlertTriangle, Download, Brain, Bell, Command, Settings,
  Eye, Activity, Cpu, Heart, CreditCard, Leaf, DollarSign, Terminal,
  Monitor, ArrowRight, ExternalLink
} from 'lucide-react';
import Card from '../components/Card';

const DOCS = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: Zap,
    color: '#7c3aed',
    sections: [
      {
        title: 'Quick Start Guide',
        content: `CloudSentinel is an enterprise multi-cloud security platform that helps you monitor, audit, and secure your AWS, Azure, and GCP infrastructure.

**Prerequisites:**
• Python 3.10+ with pip
• Node.js 18+ with npm
• AWS/Azure/GCP account credentials

**Installation Steps:**

1. **Start the Backend:**
   \`\`\`
   cd backend
   pip install -r requirements.txt
   python -m uvicorn app:app --reload --port 5000
   \`\`\`

2. **Start the Frontend:**
   \`\`\`
   cd frontend
   npm install
   npx vite --port 3000
   \`\`\`

3. **Login:** Open http://localhost:3000
   - Default credentials: \`admin\` / \`admin123\`

4. **Add a Cloud Account:**
   Navigate to Accounts → Add Account → Enter provider and credentials

5. **Run Your First Scan:**
   Navigate to Scans → Select account → Enter credentials → Start Scan`
      },
      {
        title: 'System Requirements',
        content: `**Minimum Requirements:**
• CPU: 2 cores
• RAM: 4GB
• Disk: 10GB
• Python 3.10+
• Node.js 18+

**Supported Browsers:**
• Chrome 90+
• Firefox 90+
• Safari 15+
• Edge 90+

**Network Requirements:**
• Outbound HTTPS (443) to cloud provider APIs
• Local ports 3000 (frontend) and 5000 (backend)`
      },
      {
        title: 'Architecture Overview',
        content: `CloudSentinel uses a modular plugin-based architecture:

**Frontend:** React 19 + Tailwind CSS + Recharts + Framer Motion
**Backend:** Python FastAPI with provider plugin system
**Storage:** File-based JSON (no database required)
**Auth:** JWT tokens with role-based access control

**Data Flow:**
1. User triggers scan from UI
2. Backend collector gathers data via cloud SDKs (boto3, azure-sdk, google-cloud)
3. Data stored as JSON in account-data/{provider}/{account}/{region}/
4. Parser normalizes data for dashboards
5. Auditor runs security checks
6. Compliance engine evaluates against frameworks
7. AI engine generates recommendations

**Provider Plugin Architecture:**
Each cloud provider implements:
• Collector — Gathers resource data
• Parser — Normalizes for dashboards
• Auditor — Runs security checks
• Routes — Provider-specific API endpoints`
      }
    ]
  },
  {
    id: 'overview-dashboard',
    title: 'Overview Dashboard',
    icon: LayoutDashboard,
    color: '#7c3aed',
    sections: [
      {
        title: 'Executive Overview',
        content: `The Overview page provides a high-level executive dashboard across all your cloud accounts.

**Features:**
• **KPI Cards** — Total accounts, resources, findings, and security score
• **Well-Architected Framework Radar** — Visual assessment across 6 pillars
• **Security Score Trend** — 7-day score history with area chart
• **Provider Cards** — Per-provider breakdown with compliance bars
• **Resource Distribution** — Pie chart showing resource allocation
• **Quick Actions** — One-click navigation to key features

**User Guide:**
1. The page loads automatically on login
2. Select an account from the topbar dropdown to see account-specific data
3. Click "Run Audit" to get fresh security findings
4. Click "Deep Dive" to go to the detailed Dashboard
5. Use the WAF Radar to identify weak security pillars`
      }
    ]
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: Layers,
    color: '#38bdf8',
    sections: [
      {
        title: 'Account Dashboard',
        content: `The Dashboard shows detailed metrics for a specific cloud account.

**Sections:**
• **Resource Stats** — 10 stat cards showing EC2, S3, SGs, VPCs, Lambda, RDS, ELBs, Subnets, Snapshots, NICs
• **Security Score** — Circular gauge with score breakdown (MFA, Public IPs, Open SGs, No MFA Users)
• **Security Findings** — Severity-coded finding cards with icons
• **Resource Distribution** — Donut chart of resource types
• **Region Usage Matrix** — Heatmap table showing resources per region
• **Region Bar Chart** — Stacked bar chart by region
• **Region Details** — Expandable cards per active region
• **Public Network Resources** — Table of all publicly accessible resources
• **IAM Overview** — User table with MFA status

**Export Options:**
• Click "CSV" to download resource data as spreadsheet
• Click "Export PDF" to generate a formatted report
• Both include all visible data sections`
      }
    ]
  },
  {
    id: 'accounts',
    title: 'Account Management',
    icon: Users,
    color: '#4ade80',
    sections: [
      {
        title: 'Managing Cloud Accounts',
        content: `The Accounts page lets you onboard and manage cloud provider accounts.

**Adding an Account:**
1. Click "Add Account"
2. Select provider (AWS / Azure / GCP)
3. Enter Account ID (e.g., 123456789012)
4. Enter Account Name (e.g., production)
5. Check "Default" if this is your primary account
6. Click "Save"

**Account Card Features:**
• Green indicator = scan data available
• Provider badge (AWS/Azure/GCP)
• Default account flag
• Region list showing scanned regions
• Delete button with confirmation

**Trusted CIDRs:**
CIDRs define your trusted IP ranges. Security group rules matching these CIDRs won't be flagged as risks.
• Click "Add CIDR" to add a trusted range (e.g., 10.0.0.0/8)
• Name each CIDR for identification (e.g., "Office Network")`
      }
    ]
  },
  {
    id: 'scanning',
    title: 'Cloud Scanning',
    icon: ScanLine,
    color: '#facc15',
    sections: [
      {
        title: 'Running Cloud Scans',
        content: `The Scan page lets you collect cloud resource data from your providers.

**How to Scan:**
1. Select a cloud provider (AWS / Azure / GCP)
2. Select the target account
3. Enter credentials:
   - **AWS:** Access Key ID + Secret Access Key
   - **Azure:** Client ID + Client Secret + Tenant ID + Subscription ID
   - **GCP:** Service Account JSON key
4. Optionally specify a region (default: all)
5. Click "Start Scan"

**During Scan:**
• Progress bar shows completion percentage
• Live log output displays current operations
• Scan polls every 3 seconds for updates
• Multiple scans can run simultaneously

**After Scan:**
• Scan history shows all past scans with status
• Data is stored in account-data/ directory
• Dashboard and audit pages auto-populate
• Security score is recalculated

**Important Notes:**
• Credentials are used only for the scan and NOT stored
• Scans are read-only — no modifications to your cloud resources
• Full scan of all regions takes 2-5 minutes depending on resource count`
      }
    ]
  },
  {
    id: 'audit',
    title: 'Security Audit',
    icon: Shield,
    color: '#fb7185',
    sections: [
      {
        title: 'Running Security Audits',
        content: `The Audit page runs security checks against your cloud resources and identifies misconfigurations.

**Running an Audit:**
1. Ensure scan data exists for your account
2. Click "Run Audit"
3. Wait for the scan to complete

**Understanding Results:**
• **Summary Cards** — Total findings by severity (CRITICAL, HIGH, MEDIUM, LOW, INFO)
• **Severity Pie Chart** — Visual distribution
• **Severity Filters** — Click severity buttons to show/hide finding types
• **Search** — Filter findings by keyword
• **Expandable Findings** — Click any finding to see details:
  - Issue ID and Group
  - Affected Resource
  - Region
  - Detailed description
  - JSON details (if available)

**Severity Levels:**
• 🔴 CRITICAL — Immediate action required (e.g., open RDP to internet)
• 🟠 HIGH — Important security risk (e.g., no encryption at rest)
• 🟡 MEDIUM — Should be addressed (e.g., public EC2 instances)
• 🔵 LOW — Minor issue (e.g., internet-facing load balancers)
• ⚪ INFO — Informational finding

**Export:**
• CSV — Download findings as spreadsheet for analysis
• PDF — Generate formatted audit report for stakeholders`
      }
    ]
  },
  {
    id: 'resources',
    title: 'Resource Explorer',
    icon: Server,
    color: '#38bdf8',
    sections: [
      {
        title: 'Browsing Cloud Resources',
        content: `The Resources page provides a detailed inventory of all collected cloud resources.

**Resource Types:**
• **EC2 Instances** — ID, type, state (running/stopped), public/private IPs, VPC
• **S3 Buckets** — Name, creation date
• **Security Groups** — ID, name, VPC, inbound/outbound rule counts
• **VPCs** — ID, CIDR, default flag
• **Lambda Functions** — Name, runtime, memory allocation
• **RDS Instances** — ID, engine, class, public accessibility
• **Load Balancers** — Name, DNS, scheme

**Filtering:**
• Click resource type tabs to switch views
• Use the search box to filter by any field
• Select a specific region from the dropdown
• Resource counts shown on each tab badge

**Visual Indicators:**
• Running instances: green badge
• Stopped instances: red badge
• Public IPs: amber highlighted
• Publicly accessible RDS: red text`
      }
    ]
  },
  {
    id: 'iam',
    title: 'IAM Report',
    icon: KeyRound,
    color: '#22d3ee',
    sections: [
      {
        title: 'IAM Analysis',
        content: `The IAM page provides detailed Identity and Access Management analysis.

**Overview Stats:**
• Users, Roles, Groups, Policies counts with stat cards
• Bar chart summary

**Users Tab:**
• Expandable user cards showing:
  - MFA status (green ✓ or amber ✗)
  - Attached policies (click to expand)
  - Group memberships
  - Account creation date
• Users without MFA are highlighted

**Roles Tab:**
• Role name and ARN
• Attached policies list
• Trust policy JSON viewer

**Policies Tab:**
• Sortable table with policy name, ARN
• Attachment count
• Attachable status

**Search:** Filter across all tabs by name or ARN`
      }
    ]
  },
  {
    id: 'security-groups',
    title: 'Security Groups',
    icon: ShieldAlert,
    color: '#f97316',
    sections: [
      {
        title: 'Security Group Analysis',
        content: `The Security Groups page identifies risky firewall rules open to the internet.

**Summary Cards:**
• Total risky security groups
• Critical count (sensitive ports like SSH, RDP, DB)
• High count (other open ports)

**Severity Classification:**
• **CRITICAL** — Ports 22 (SSH), 3389 (RDP), 3306 (MySQL), 5432 (PostgreSQL), 1433 (MSSQL) open to 0.0.0.0/0
• **HIGH** — Any other port open to 0.0.0.0/0 or ::/0

**Each Security Group Card Shows:**
• Group name and ID
• Region and VPC
• Severity badge
• Open rules with protocol, port range, and CIDR
• Dangerous port labels (SSH, RDP, MySQL, etc.)

**Remediation:**
• Restrict ingress rules to specific IP ranges
• Use VPN or bastion hosts instead of direct access
• Apply security groups to application tiers, not directly to internet`
      }
    ]
  },
  {
    id: 'compliance',
    title: 'Cloud Compliance',
    icon: ClipboardCheck,
    color: '#4ade80',
    sections: [
      {
        title: 'Compliance Scanning',
        content: `The Compliance page evaluates your cloud infrastructure against 10 industry frameworks.

**Supported Frameworks:**
• CIS AWS Foundations Benchmark v1.5
• CIS Azure Benchmark v2.0
• CIS GCP Benchmark v2.0
• NIST 800-53 Rev 5
• SOC 2 Type II
• ISO 27001:2022
• PCI-DSS 4.0
• HIPAA
• GDPR
• AWS Well-Architected Security Pillar

**Running a Compliance Scan:**
1. Ensure scan data exists for your account
2. Click "Run Compliance Scan"
3. All 183 checks across 49 controls are evaluated
4. Results are stored for historical tracking

**5 Dashboard Tabs:**

**Overview:**
• Framework scores horizontal bar chart
• Compliance radar chart
• Risk severity distribution pie
• Compliance trend over multiple scans

**Frameworks:**
• Card grid showing all 10 frameworks
• Score ring with percentage
• Control and check counts
• Compliance progress bar

**Findings:**
• Searchable list of all failed checks
• Severity filter buttons (CRITICAL/HIGH/MEDIUM/LOW)
• Expandable details with affected resources
• Remediation steps for each finding

**Controls:**
• Framework selector for focused view
• Per-control pass/fail/warn breakdown
• Individual check status badges

**AI Recommendations:**
• Priority-sorted improvement suggestions
• Impact analysis for each recommendation

**Export Formats:** PDF, CSV, JSON`
      },
      {
        title: 'Understanding Compliance Scores',
        content: `**Score Calculation:**
• Each check evaluates to PASS, FAIL, WARN, or N/A
• Framework score = (PASS count) / (PASS + FAIL count) × 100%
• Overall score = average of all framework scores
• WARN and N/A checks are excluded from scoring

**Score Interpretation:**
• 80-100% — Excellent compliance posture (green)
• 50-79% — Fair, needs improvement (amber)
• 0-49% — Critical, immediate action required (red)

**Compliance Drift:**
Run regular scans to track compliance over time. The trend chart shows score changes across scans, helping identify regressions.`
      }
    ]
  },
  {
    id: 'report',
    title: 'Comprehensive Report',
    icon: FileText,
    color: '#a78bfa',
    sections: [
      {
        title: 'Report Generation',
        content: `The Report page combines all security data into a single comprehensive view.

**6 Collapsible Sections:**

1. **Executive Summary**
   - Resource distribution pie chart
   - 12 infrastructure metrics
   - Top-10 regions bar chart

2. **Well-Architected Framework**
   - Radar chart across 6 pillars
   - Compliance bars with pass/fail check badges

3. **Security Audit Findings**
   - Severity summary with mini pie chart
   - Full scrollable findings table

4. **IAM Users & Access**
   - User table with MFA status, policies, groups

5. **Risky Security Groups**
   - Severity, group name/ID, region, open ports

6. **AI Security Intelligence**
   - 6 AI analysis cards covering posture, risks, compliance, exposure, IAM, recommendations

**Export Options:**
• **Export Excel** — Multi-sheet .xlsx with 7 tabs (styled with color-coded cells)
• **Export PDF** — Multi-page formatted report with tables and charts`
      }
    ]
  },
  {
    id: 'ai-assistant',
    title: 'AI Security Assistant',
    icon: Brain,
    color: '#c084fc',
    sections: [
      {
        title: 'Using the AI Chat',
        content: `CloudSentinel includes an AI-powered security assistant that analyzes your actual cloud data.

**Opening AI Chat:**
• Click the sparkle button (✨) in the bottom-right corner
• The chat window opens with suggestion chips

**What You Can Ask:**
• "Well-Architected analysis" — Full WAF pillar breakdown with pass/fail checks
• "Top security risks" — Critical and high-severity findings from your infrastructure
• "How to improve my score?" — Prioritized recommendations based on failed checks
• "Cloud posture summary" — Resource counts, security metrics, finding breakdown
• "Publicly exposed resources" — Internet-facing services and remediation tips
• "IAM status" — MFA coverage, root account security, policy analysis
• "Compliance assessment" — CIS/SOC2/GDPR alignment evaluation
• "Recommendations" — Actionable steps sorted by priority (Critical → Long-term)

**Key Features:**
• Responses use your actual scan data — not generic advice
• Markdown-style formatting with headers, bullets, code blocks
• WAF score badge shown on relevant responses
• Chat history maintained during session
• Minimizable window`
      }
    ]
  },
  {
    id: 'productivity',
    title: 'Productivity Features',
    icon: Command,
    color: '#facc15',
    sections: [
      {
        title: 'Command Palette',
        content: `Press **Ctrl+K** (or **⌘+K** on Mac) to open the Command Palette.

**Features:**
• Search across all pages and actions
• Keyboard navigation: ↑/↓ to move, Enter to select, Esc to close
• Results grouped by category (Navigate, Action)

**Quick Shortcuts:**
• \`Ctrl+D\` — Go to Dashboard
• \`Ctrl+S\` — Go to Scans
• \`Ctrl+A\` — Go to Audit
• \`Ctrl+R\` — Go to Report`
      },
      {
        title: 'Notification Center',
        content: `Click the bell icon (🔔) in the topbar to view notifications.

**Notification Types:**
• 🔴 Critical — Open ports, public databases
• 🟡 Warning — Compliance drift, MFA issues
• 🔵 Info — Scan completions, new features
• 🟢 Success — Successful operations

**Actions:**
• Click "Mark all read" to clear unread badges
• Click ✕ on individual notifications to dismiss
• Unread count shown on bell icon badge`
      },
      {
        title: 'Theme Toggle',
        content: `Click the sun/moon icon (☀️/🌙) in the topbar to switch between dark and light themes.

• **Dark Theme** — Default, optimized for extended use
• **Light Theme** — Corporate-friendly, high-contrast

Theme preference is saved in your browser and persists across sessions.`
      }
    ]
  },
  {
    id: 'user-management',
    title: 'User Management',
    icon: Settings,
    color: '#94a3b8',
    sections: [
      {
        title: 'Managing Users & Roles',
        content: `The Users page allows administrators to manage user accounts and roles.

**Roles:**
• **Admin** — Full access including user management, account deletion
• **Editor** — Can run scans, audits, and view all data
• **Viewer** — Read-only access to dashboards and reports

**Creating a User (Admin only):**
1. Click "Add User"
2. Enter username and password
3. Select role (Admin / Editor / Viewer)
4. Click "Create"

**Deleting a User (Admin only):**
• Click the trash icon next to any user (cannot delete yourself)
• Confirm deletion in the prompt

**Security Notes:**
• Passwords are bcrypt hashed
• JWT tokens expire after 8 hours
• Failed logins return generic error messages`
      }
    ]
  },
  {
    id: 'api-reference',
    title: 'API Reference',
    icon: Terminal,
    color: '#60a5fa',
    sections: [
      {
        title: 'Authentication',
        content: `All API endpoints require a JWT Bearer token.

**Login:**
\`\`\`
POST /api/auth/login
Body: {"username": "admin", "password": "admin123"}
Response: {"access_token": "eyJ...", "token_type": "bearer"}
\`\`\`

**Using the Token:**
\`\`\`
Authorization: Bearer <access_token>
\`\`\``
      },
      {
        title: 'Core Endpoints',
        content: `**Health:** \`GET /api/health\`
**Accounts:** \`GET /api/accounts\` | \`POST /api/accounts\` | \`DELETE /api/accounts/{id}\`
**Dashboard:** \`GET /api/dashboard/{provider}/{account}\`
**Overview:** \`GET /api/overview\`
**Resources:** \`GET /api/resources/{account}\`
**IAM:** \`GET /api/iam/{account}\`
**Security Groups:** \`GET /api/security-groups/{account}\`
**Audit:** \`POST /api/audit/run/{account}\`
**Scan:** \`POST /api/scan/start\` | \`GET /api/scan/status/{job_id}\`
**Report:** \`GET /api/report/{account}\` | \`GET /api/report/{account}/export?format=pdf|excel\`
**Compliance:** \`GET /api/compliance/frameworks\` | \`POST /api/compliance/scan/{account}\` | \`GET /api/compliance/results/{account}\`
**AI Chat:** \`POST /api/ai/chat\` Body: \`{"message": "your question"}\`
**WAF:** \`GET /api/waf/{account}\`
**Users:** \`GET /api/users\` | \`POST /api/users\` | \`DELETE /api/users/{username}\``
      }
    ]
  }
];

function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);
  const code = children.replace(/```\n?/g, '').trim();
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group my-2">
      <pre className="text-[11px] bg-surface/60 border border-border/30 rounded-xl p-3.5 overflow-x-auto text-text-muted font-mono leading-relaxed">{code}</pre>
      <button onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-surface-lighter/50 hover:bg-surface-lighter border border-border/30 text-text-muted hover:text-text opacity-0 group-hover:opacity-100 transition-all">
        {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function RenderContent({ content }) {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return (
    <div className="space-y-1.5">
      {parts.map((part, i) => {
        if (part.startsWith('```')) return <CodeBlock key={i}>{part}</CodeBlock>;
        return part.split('\n').map((line, j) => {
          const key = `${i}-${j}`;
          if (line.startsWith('**') && line.endsWith('**')) return <p key={key} className="text-sm font-semibold text-text mt-3 mb-1">{line.replace(/\*\*/g, '')}</p>;
          if (line.match(/^\*\*.*?\*\*/)) {
            const parts2 = line.split(/\*\*(.*?)\*\*/g);
            return <p key={key} className="text-xs text-text-muted leading-relaxed">{parts2.map((p, k) => k % 2 === 1 ? <strong key={k} className="text-text font-semibold">{p}</strong> : p)}</p>;
          }
          if (line.startsWith('• ')) return <p key={key} className="text-xs text-text-muted pl-4 flex items-start gap-2 leading-relaxed"><span className="text-primary-light mt-1 text-[6px]">●</span>{line.slice(2)}</p>;
          if (line.match(/^\d+\.\s/)) return <p key={key} className="text-xs text-text-muted pl-4 leading-relaxed">{line}</p>;
          if (line.match(/^#{1,3}\s/)) return <p key={key} className="text-sm font-semibold text-text mt-3 mb-1">{line.replace(/^#+\s/, '')}</p>;
          if (line.includes('`') && !line.startsWith('`')) {
            const parts2 = line.split(/`(.*?)`/g);
            return <p key={key} className="text-xs text-text-muted leading-relaxed">{parts2.map((p, k) => k % 2 === 1 ? <code key={k} className="px-1.5 py-0.5 rounded-md bg-primary/8 text-primary-light text-[10px] font-mono border border-primary/10">{p}</code> : p)}</p>;
          }
          if (line.trim() === '') return <div key={key} className="h-2" />;
          return <p key={key} className="text-xs text-text-muted leading-relaxed">{line}</p>;
        });
      })}
    </div>
  );
}

export default function Docs() {
  const [activeDoc, setActiveDoc] = useState('getting-started');
  const [expandedSections, setExpandedSections] = useState(new Set([0]));
  const [search, setSearch] = useState('');

  const toggleSection = (i) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const currentDoc = DOCS.find(d => d.id === activeDoc);

  const filteredDocs = search
    ? DOCS.filter(d => d.title.toLowerCase().includes(search.toLowerCase()) ||
        d.sections.some(s => s.title.toLowerCase().includes(search.toLowerCase()) || s.content.toLowerCase().includes(search.toLowerCase())))
    : DOCS;

  return (
    <div className="flex gap-6 min-h-[calc(100vh-120px)]">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0">
        <div className="sticky top-24 space-y-4">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-9 h-9 rounded-xl gradient-border flex items-center justify-center shadow-lg shadow-primary/15">
              <BookOpen className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text">Documentation</h2>
              <p className="text-[10px] text-text-muted">{DOCS.length} guides</p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search docs..."
              className="w-full bg-surface-lighter/30 border border-border/40 rounded-xl pl-9 pr-3 py-2 text-xs text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary/30 transition-all" />
          </div>

          <nav className="space-y-0.5">
            {filteredDocs.map(doc => {
              const Icon = doc.icon;
              const isActive = doc.id === activeDoc;
              return (
                <button key={doc.id} onClick={() => { setActiveDoc(doc.id); setExpandedSections(new Set([0])); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all ${
                    isActive ? 'bg-primary/10 text-primary-light' : 'text-text-muted hover:text-text hover:bg-white/[0.03]'
                  }`}>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isActive ? 'bg-primary/15' : 'bg-surface-lighter/30'}`}>
                    <Icon className="w-3.5 h-3.5" style={{ color: isActive ? doc.color : undefined }} />
                  </div>
                  <span className="text-xs font-medium truncate">{doc.title}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-3xl">
        {currentDoc && (
          <motion.div key={currentDoc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            {/* Header */}
            <div className="report-header flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${currentDoc.color}15` }}>
                <currentDoc.icon className="w-5 h-5" style={{ color: currentDoc.color }} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-text">{currentDoc.title}</h1>
                <p className="text-[10px] text-text-muted">{currentDoc.sections.length} section(s) &bull; CloudSentinel v3.0</p>
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-3">
              {currentDoc.sections.map((section, i) => {
                const isExpanded = expandedSections.has(i);
                return (
                  <div key={i} className="border border-border/30 rounded-2xl overflow-hidden bg-surface-light/50">
                    <button onClick={() => toggleSection(i)}
                      className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-all text-left">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[10px] font-bold text-primary-light bg-primary/10 w-6 h-6 rounded-lg flex items-center justify-center">{i + 1}</span>
                        <span className="text-sm font-semibold text-text">{section.title}</span>
                      </div>
                      <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronRight className="w-4 h-4 text-text-muted" />
                      </motion.div>
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }} className="overflow-hidden">
                          <div className="px-5 pb-5 pt-1 border-t border-border/20">
                            <RenderContent content={section.content} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
