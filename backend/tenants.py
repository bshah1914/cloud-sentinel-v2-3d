"""
CloudSentinel Multi-Tenant Management
Handles organizations (clients), client users, plans, billing, and data isolation.
"""

import json
import uuid
from datetime import datetime
from pathlib import Path
from passlib.context import CryptContext

TENANTS_FILE = Path(__file__).parent / "tenants.json"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ── Plans ────────────────────────────────────────────────────────
PLANS = {
    "free": {
        "name": "Free",
        "price": 0,
        "max_accounts": 1,
        "max_scans_per_month": 5,
        "max_users": 2,
        "features": ["basic_scan", "dashboard", "reports_pdf"],
        "compliance_frameworks": 2,
        "support": "community",
    },
    "pro": {
        "name": "Professional",
        "price": 99,
        "max_accounts": 5,
        "max_scans_per_month": 50,
        "max_users": 10,
        "features": ["basic_scan", "advanced_scan", "dashboard", "compliance", "reports_pdf", "reports_excel", "threats", "ai_chat"],
        "compliance_frameworks": 5,
        "support": "email",
    },
    "enterprise": {
        "name": "Enterprise",
        "price": 499,
        "max_accounts": -1,  # unlimited
        "max_scans_per_month": -1,
        "max_users": -1,
        "features": ["basic_scan", "advanced_scan", "dashboard", "compliance", "reports_pdf", "reports_excel", "reports_json", "threats", "ai_chat", "attack_paths", "white_label", "api_access", "sso"],
        "compliance_frameworks": 10,
        "support": "priority",
    },
}


# ── Data Layer ───────────────────────────────────────────────────
def _load_data() -> dict:
    if TENANTS_FILE.exists():
        with open(TENANTS_FILE) as f:
            return json.load(f)
    return {"organizations": [], "client_users": [], "invoices": [], "activity_log": []}


def _save_data(data: dict):
    with open(TENANTS_FILE, "w") as f:
        json.dump(data, f, indent=2, default=str)


# ── Organization (Client) Management ────────────────────────────
def create_organization(name: str, contact_email: str, plan: str = "free", cloud_accounts: list = None) -> dict:
    data = _load_data()
    org = {
        "id": str(uuid.uuid4())[:8],
        "name": name,
        "contact_email": contact_email,
        "plan": plan,
        "status": "active",  # active, suspended, cancelled
        "cloud_accounts": cloud_accounts or [],
        "created": datetime.now().isoformat(),
        "scans_this_month": 0,
        "last_scan": None,
        "security_score": None,
        "total_resources": 0,
        "total_findings": 0,
        "billing": {
            "mrr": PLANS.get(plan, PLANS["free"])["price"],
            "payment_method": None,
            "next_invoice": None,
        },
    }
    data["organizations"].append(org)
    _save_data(data)
    _log_activity(data, "system", f"Organization '{name}' created with {plan} plan")
    return org


def update_organization(org_id: str, updates: dict) -> dict:
    data = _load_data()
    org = next((o for o in data["organizations"] if o["id"] == org_id), None)
    if not org:
        return None
    for k, v in updates.items():
        if k in org and k != "id":
            org[k] = v
    if "plan" in updates:
        org["billing"]["mrr"] = PLANS.get(updates["plan"], PLANS["free"])["price"]
    _save_data(data)
    return org


def delete_organization(org_id: str) -> bool:
    data = _load_data()
    data["organizations"] = [o for o in data["organizations"] if o["id"] != org_id]
    data["client_users"] = [u for u in data["client_users"] if u["org_id"] != org_id]
    _save_data(data)
    return True


def get_organization(org_id: str) -> dict:
    data = _load_data()
    return next((o for o in data["organizations"] if o["id"] == org_id), None)


def get_all_organizations() -> list:
    return _load_data()["organizations"]


def get_org_by_name(name: str) -> dict:
    data = _load_data()
    return next((o for o in data["organizations"] if o["name"].lower() == name.lower()), None)


# ── Client User Management ──────────────────────────────────────
def create_client_user(org_id: str, username: str, password: str, email: str, role: str = "viewer") -> dict:
    data = _load_data()
    org = next((o for o in data["organizations"] if o["id"] == org_id), None)
    if not org:
        return None

    # Check user limit
    plan = PLANS.get(org["plan"], PLANS["free"])
    existing = [u for u in data["client_users"] if u["org_id"] == org_id]
    if plan["max_users"] != -1 and len(existing) >= plan["max_users"]:
        return {"error": f"User limit ({plan['max_users']}) reached for {plan['name']} plan"}

    # Check duplicate username
    if any(u["username"] == username for u in data["client_users"]):
        return {"error": f"Username '{username}' already exists"}

    user = {
        "id": str(uuid.uuid4())[:8],
        "org_id": org_id,
        "org_name": org["name"],
        "username": username,
        "email": email,
        "hashed_password": pwd_context.hash(password),
        "role": role,  # client_admin, editor, viewer
        "status": "active",
        "created": datetime.now().isoformat(),
        "last_login": None,
    }
    data["client_users"].append(user)
    _save_data(data)
    _log_activity(data, "system", f"User '{username}' created for org '{org['name']}'")
    return user


def authenticate_client_user(username: str, password: str) -> dict:
    data = _load_data()
    for user in data["client_users"]:
        if user["username"] == username and pwd_context.verify(password, user["hashed_password"]):
            if user["status"] != "active":
                return {"error": "Account is suspended"}
            org = next((o for o in data["organizations"] if o["id"] == user["org_id"]), None)
            if org and org["status"] != "active":
                return {"error": "Organization is suspended"}
            user["last_login"] = datetime.now().isoformat()
            _save_data(data)
            return user
    return None


def get_client_users(org_id: str) -> list:
    data = _load_data()
    return [u for u in data["client_users"] if u["org_id"] == org_id]


def delete_client_user(user_id: str) -> bool:
    data = _load_data()
    data["client_users"] = [u for u in data["client_users"] if u["id"] != user_id]
    _save_data(data)
    return True


# ── Billing & Invoices ──────────────────────────────────────────
def create_invoice(org_id: str, amount: float, description: str) -> dict:
    data = _load_data()
    invoice = {
        "id": f"INV-{str(uuid.uuid4())[:6].upper()}",
        "org_id": org_id,
        "amount": amount,
        "description": description,
        "status": "pending",  # pending, paid, overdue
        "created": datetime.now().isoformat(),
        "due_date": None,
    }
    data["invoices"].append(invoice)
    _save_data(data)
    return invoice


def get_invoices(org_id: str = None) -> list:
    data = _load_data()
    if org_id:
        return [i for i in data["invoices"] if i["org_id"] == org_id]
    return data["invoices"]


# ── Activity Log ────────────────────────────────────────────────
def _log_activity(data: dict, actor: str, action: str, org_id: str = None):
    data["activity_log"].append({
        "id": str(uuid.uuid4())[:8],
        "actor": actor,
        "action": action,
        "org_id": org_id,
        "timestamp": datetime.now().isoformat(),
    })
    # Keep last 500 entries
    data["activity_log"] = data["activity_log"][-500:]
    _save_data(data)


def log_activity(actor: str, action: str, org_id: str = None):
    data = _load_data()
    _log_activity(data, actor, action, org_id)


def get_activity_log(org_id: str = None, limit: int = 50) -> list:
    data = _load_data()
    logs = data["activity_log"]
    if org_id:
        logs = [l for l in logs if l.get("org_id") == org_id]
    return sorted(logs, key=lambda x: x["timestamp"], reverse=True)[:limit]


# ── Platform Analytics (Owner) ───────────────────────────────────
def get_platform_stats() -> dict:
    data = _load_data()
    orgs = data["organizations"]
    users = data["client_users"]
    invoices = data["invoices"]

    active_orgs = [o for o in orgs if o["status"] == "active"]
    total_mrr = sum(o["billing"]["mrr"] for o in active_orgs)
    total_resources = sum(o.get("total_resources", 0) for o in orgs)
    total_findings = sum(o.get("total_findings", 0) for o in orgs)

    plan_distribution = {}
    for o in orgs:
        plan_distribution[o["plan"]] = plan_distribution.get(o["plan"], 0) + 1

    return {
        "total_clients": len(orgs),
        "active_clients": len(active_orgs),
        "suspended_clients": len([o for o in orgs if o["status"] == "suspended"]),
        "total_users": len(users),
        "total_mrr": total_mrr,
        "total_arr": total_mrr * 12,
        "total_resources_monitored": total_resources,
        "total_findings": total_findings,
        "avg_security_score": round(sum(o.get("security_score", 0) or 0 for o in active_orgs) / max(len(active_orgs), 1)),
        "plan_distribution": plan_distribution,
        "total_invoices": len(invoices),
        "pending_invoices": len([i for i in invoices if i["status"] == "pending"]),
        "revenue_collected": sum(i["amount"] for i in invoices if i["status"] == "paid"),
    }


# ── Scan Enforcement ────────────────────────────────────────────
def can_scan(org_id: str) -> dict:
    data = _load_data()
    org = next((o for o in data["organizations"] if o["id"] == org_id), None)
    if not org:
        return {"allowed": False, "reason": "Organization not found"}
    if org["status"] != "active":
        return {"allowed": False, "reason": "Organization is suspended"}

    plan = PLANS.get(org["plan"], PLANS["free"])
    if plan["max_scans_per_month"] != -1 and org["scans_this_month"] >= plan["max_scans_per_month"]:
        return {"allowed": False, "reason": f"Monthly scan limit ({plan['max_scans_per_month']}) reached. Upgrade your plan."}

    return {"allowed": True}


def record_scan(org_id: str):
    data = _load_data()
    org = next((o for o in data["organizations"] if o["id"] == org_id), None)
    if org:
        org["scans_this_month"] = org.get("scans_this_month", 0) + 1
        org["last_scan"] = datetime.now().isoformat()
        _save_data(data)


def update_org_stats(org_id: str, resources: int = 0, findings: int = 0, score: int = None):
    data = _load_data()
    org = next((o for o in data["organizations"] if o["id"] == org_id), None)
    if org:
        org["total_resources"] = resources
        org["total_findings"] = findings
        if score is not None:
            org["security_score"] = score
        _save_data(data)
