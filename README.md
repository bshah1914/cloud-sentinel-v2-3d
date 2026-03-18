# CloudSentinel v3.0

**Enterprise Multi-Cloud Security Platform**

CloudSentinel is a comprehensive cloud security platform for monitoring, auditing, and protecting AWS, Azure, and GCP infrastructure from a single dashboard.

## Features

- **Multi-Cloud Scanning** — Discover all resources across AWS, Azure, GCP
- **Security Audit** — Detect misconfigurations, open ports, public exposure
- **Compliance** — 10 frameworks (CIS, NIST, SOC2, ISO 27001, PCI-DSS, HIPAA, GDPR)
- **Threat Detection** — MITRE ATT&CK mapping, attack path analysis, secret detection
- **AI Security Assistant** — AI-powered analysis of your cloud infrastructure
- **Reports** — Export as PDF, Excel, CSV, JSON
- **Command Palette** — Ctrl+K for fast navigation
- **Notification Center** — Real-time security alerts

## Quick Start

### Option 1: Direct Run

```bash
# Install dependencies
pip install -r requirements.txt
cd frontend && npm install && cd ..

# Start backend
cd backend && python3 -m uvicorn app:app --host 0.0.0.0 --port 5000 &

# Start frontend
cd frontend && npx vite --host 0.0.0.0 --port 7001
```

### Option 2: Docker

```bash
chmod +x deploy.sh
./deploy.sh
```

### Login
- **URL:** http://localhost:7001
- **Username:** admin
- **Password:** admin123

## Tech Stack

- **Frontend:** React 19, Tailwind CSS, Recharts, Framer Motion
- **Backend:** Python FastAPI
- **Cloud SDKs:** Boto3 (AWS), Azure SDK, Google Cloud SDK
- **Auth:** JWT + bcrypt
- **Reports:** ReportLab (PDF), OpenPyXL (Excel)

## License

BSD 2-Clause License
