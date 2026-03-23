"""
CloudSentinel — Database Operations (Single Source of Truth)
Replaces all JSON file operations with database queries.
"""

from passlib.context import CryptContext
from models.database import (
    SessionLocal, Organization, User, CloudAccount, Scan, Finding,
    AuditLog, AlertRule, ScanSchedule, RemediationTask, AlertHistory,
    gen_id, utcnow
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ─── Subscription Plans ───
PLANS = {
    "free": {"name": "Free", "label": "Free", "price": 0, "max_accounts": 1, "max_scans": 10, "max_users": 3, "color": "#6b7280"},
    "pro": {"name": "Professional", "label": "Pro", "price": 99, "max_accounts": 5, "max_scans": 50, "max_users": 10, "color": "#7c3aed"},
    "enterprise": {"name": "Enterprise", "label": "Enterprise", "price": 499, "max_accounts": 999, "max_scans": 99999, "max_users": 999, "color": "#f59e0b"},
}


# ─── USERS ───

def get_user_by_username(username):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username, User.is_active == True).first()
        if user:
            return {
                "id": user.id, "username": user.username, "email": user.email,
                "hashed_password": user.password_hash, "role": user.role,
                "user_type": user.user_type, "org_id": user.org_id,
                "is_active": user.is_active,
                "created": user.created_at.isoformat() if user.created_at else "",
            }
        return None
    finally:
        db.close()


def authenticate_user(username, password):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username, User.is_active == True).first()
        if user and pwd_context.verify(password, user.password_hash):
            user.last_login = utcnow()
            db.commit()
            return {
                "id": user.id, "username": user.username, "email": user.email,
                "hashed_password": user.password_hash, "role": user.role,
                "user_type": user.user_type, "org_id": user.org_id,
                "created": user.created_at.isoformat() if user.created_at else "",
            }
        return None
    finally:
        db.close()


def get_all_users():
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.user_type == "owner").all()
        return [{
            "id": u.id, "username": u.username, "email": u.email,
            "role": u.role, "user_type": u.user_type,
            "created": u.created_at.isoformat() if u.created_at else "",
        } for u in users]
    finally:
        db.close()


def create_user(username, password, role="viewer", user_type="owner", org_id=None, email=None):
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            return {"error": f"User '{username}' already exists"}
        user = User(
            id=gen_id(), username=username, email=email,
            password_hash=pwd_context.hash(password),
            role=role, user_type=user_type, org_id=org_id,
        )
        db.add(user)
        db.commit()
        return {"id": user.id, "username": user.username, "role": user.role}
    finally:
        db.close()


def delete_user(username):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if user:
            db.delete(user)
            db.commit()
            return True
        return False
    finally:
        db.close()


# ─── ORGANIZATIONS (Clients) ───

def get_all_organizations():
    db = SessionLocal()
    try:
        orgs = db.query(Organization).filter(Organization.id != "cloudsentinel").all()
        result = []
        for org in orgs:
            accounts = db.query(CloudAccount).filter(CloudAccount.org_id == org.id).all()
            users = db.query(User).filter(User.org_id == org.id).all()
            latest_scan = db.query(Scan).filter(
                Scan.org_id == org.id, Scan.status == "completed"
            ).order_by(Scan.completed_at.desc()).first()
            result.append({
                "id": org.id, "name": org.name, "plan": org.plan,
                "status": org.status, "contact_email": org.alert_email,
                "cloud_accounts": [{"id": a.id, "name": a.name, "provider": a.provider} for a in accounts],
                "total_resources": sum(a.total_resources for a in accounts),
                "total_findings": latest_scan.findings_count if latest_scan else 0,
                "security_score": accounts[0].security_score if accounts else 0,
                "scans_this_month": db.query(Scan).filter(Scan.org_id == org.id).count(),
                "users_count": len(users),
                "created": org.created_at.isoformat() if org.created_at else "",
            })
        return result
    finally:
        db.close()


def create_organization(name, contact_email=None, plan="free"):
    db = SessionLocal()
    try:
        org = Organization(
            id=gen_id(), name=name,
            slug=name.lower().replace(" ", "-")[:50],
            plan=plan or "free",
            alert_email=contact_email,
        )
        db.add(org)
        db.commit()
        return {"id": org.id, "name": org.name, "plan": org.plan, "status": org.status}
    finally:
        db.close()


def get_organization(org_id):
    db = SessionLocal()
    try:
        org = db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            return None
        accounts = db.query(CloudAccount).filter(CloudAccount.org_id == org_id).all()
        return {
            "id": org.id, "name": org.name, "plan": org.plan,
            "status": org.status, "contact_email": org.alert_email,
            "max_accounts": org.max_accounts, "max_scans_month": org.max_scans_month,
            "max_users": org.max_users,
            "total_resources": sum(a.total_resources for a in accounts),
            "security_score": accounts[0].security_score if accounts else 0,
            "cloud_accounts": [{"id": a.id, "name": a.name, "provider": a.provider,
                                "account_id": a.account_id} for a in accounts],
            "created": org.created_at.isoformat() if org.created_at else "",
        }
    finally:
        db.close()


def update_organization(org_id, updates):
    db = SessionLocal()
    try:
        org = db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            return None
        for key, val in updates.items():
            if hasattr(org, key) and val is not None:
                setattr(org, key, val)
        if "contact_email" in updates:
            org.alert_email = updates["contact_email"]
        db.commit()
        return {"id": org.id, "name": org.name, "plan": org.plan, "status": org.status}
    finally:
        db.close()


def delete_organization(org_id):
    db = SessionLocal()
    try:
        db.query(Finding).filter(Finding.org_id == org_id).delete()
        db.query(AuditLog).filter(AuditLog.org_id == org_id).delete()
        db.query(Scan).filter(Scan.org_id == org_id).delete()
        db.query(CloudAccount).filter(CloudAccount.org_id == org_id).delete()
        db.query(User).filter(User.org_id == org_id).delete()
        db.query(Organization).filter(Organization.id == org_id).delete()
        db.commit()
        return True
    finally:
        db.close()


def get_client_users(org_id):
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.org_id == org_id).all()
        return [{
            "id": u.id, "username": u.username, "email": u.email,
            "role": u.role, "status": "active" if u.is_active else "inactive",
            "created": u.created_at.isoformat() if u.created_at else "",
        } for u in users]
    finally:
        db.close()


def create_client_user(org_id, username, password, email=None, role="client_admin"):
    db = SessionLocal()
    try:
        org = db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            return None
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            return {"error": f"Username '{username}' already exists"}
        user = User(
            id=gen_id(), username=username, email=email,
            password_hash=pwd_context.hash(password),
            role=role, user_type="client", org_id=org_id,
        )
        db.add(user)
        db.commit()
        return {
            "id": user.id, "username": user.username, "email": user.email,
            "role": user.role, "org_id": org_id, "org_name": org.name,
        }
    finally:
        db.close()


def delete_client_user(user_id):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            db.delete(user)
            db.commit()
            return True
        return False
    finally:
        db.close()


# ─── PLATFORM STATS ───

def get_platform_stats():
    db = SessionLocal()
    try:
        orgs = db.query(Organization).filter(Organization.id != "cloudsentinel").all()
        total_mrr = sum(PLANS.get(o.plan, {}).get("price", 0) for o in orgs)
        total_users = db.query(User).filter(User.user_type == "client").count()
        total_scans = db.query(Scan).count()
        return {
            "total_clients": len(orgs),
            "total_mrr": total_mrr,
            "total_users": total_users,
            "total_scans": total_scans,
            "active_clients": sum(1 for o in orgs if o.status == "active"),
            "plans": {p: sum(1 for o in orgs if o.plan == p) for p in PLANS},
        }
    finally:
        db.close()


def get_activity_log(org_id=None, limit=100):
    db = SessionLocal()
    try:
        query = db.query(AuditLog)
        if org_id:
            query = query.filter(AuditLog.org_id == org_id)
        logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()
        return [{
            "id": l.id, "action": l.action, "username": l.username,
            "resource_type": l.resource_type, "resource_id": l.resource_id,
            "details": l.details, "ip_address": l.ip_address,
            "timestamp": l.created_at.isoformat() if l.created_at else "",
        } for l in logs]
    finally:
        db.close()


def get_invoices(org_id=None):
    # Placeholder — would integrate with Stripe
    return []


# ─── CLOUD ACCOUNTS ───

def get_cloud_accounts(org_id=None):
    db = SessionLocal()
    try:
        query = db.query(CloudAccount)
        if org_id:
            query = query.filter(CloudAccount.org_id == org_id)
        accounts = query.all()
        result = []
        for a in accounts:
            latest = db.query(Scan).filter(
                Scan.account_id == a.id, Scan.status == "completed"
            ).order_by(Scan.completed_at.desc()).first()
            result.append({
                "id": a.account_id or a.id, "db_id": a.id,
                "name": a.name, "provider": a.provider,
                "default": False, "has_data": latest is not None,
                "has_credentials": bool(a.access_key and a.secret_key),
                "security_score": a.security_score,
                "total_resources": a.total_resources,
                "last_scan": latest.completed_at.isoformat() if latest and latest.completed_at else None,
                "regions": [],
            })
        return result
    finally:
        db.close()


def add_cloud_account(name, provider, account_id, org_id, access_key=None, secret_key=None, role_arn=None):
    db = SessionLocal()
    try:
        acc = CloudAccount(
            id=gen_id(), org_id=org_id, name=name, provider=provider,
            account_id=account_id, access_key=access_key,
            secret_key=secret_key, role_arn=role_arn,
        )
        db.add(acc)
        db.commit()
        return {"id": acc.id, "name": acc.name, "provider": acc.provider}
    finally:
        db.close()


def update_account_credentials(account_db_id, access_key, secret_key, role_arn=None):
    db = SessionLocal()
    try:
        acc = db.query(CloudAccount).filter(CloudAccount.id == account_db_id).first()
        if not acc:
            # Try by name
            acc = db.query(CloudAccount).filter(CloudAccount.name == account_db_id).first()
        if acc:
            acc.access_key = access_key
            acc.secret_key = secret_key
            if role_arn:
                acc.role_arn = role_arn
            db.commit()
            return True
        return False
    finally:
        db.close()


def remove_cloud_account(account_id):
    db = SessionLocal()
    try:
        acc = db.query(CloudAccount).filter(
            (CloudAccount.id == account_id) | (CloudAccount.account_id == account_id)
        ).first()
        if acc:
            db.query(Finding).filter(Finding.scan_id.in_(
                db.query(Scan.id).filter(Scan.account_id == acc.id)
            )).delete(synchronize_session=False)
            db.query(Scan).filter(Scan.account_id == acc.id).delete()
            db.delete(acc)
            db.commit()
            return True
        return False
    finally:
        db.close()
