"""
CloudMapper FastAPI Backend
Wraps CloudMapper CLI functionality into REST API endpoints.
"""

import json
import os
import glob
import subprocess
import threading
import uuid
import yaml
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from jose import JWTError, jwt
from passlib.context import CryptContext

# Resolve paths relative to the cloudmapper root
BASE_DIR = Path(__file__).resolve().parent.parent
ACCOUNT_DATA_DIR = BASE_DIR / "account-data"
CONFIG_FILE = BASE_DIR / "config.json"
CONFIG_DEMO = BASE_DIR / "config.json.demo"
AUDIT_CONFIG = BASE_DIR / "audit_config.yaml"
AUDIT_OVERRIDE = BASE_DIR / "config" / "audit_config_override.yaml"
USERS_FILE = BASE_DIR / "backend" / "users.json"

# ── JWT / Auth Config ─────────────────────────────────────────────
SECRET_KEY = "cloudmapper-super-secret-change-in-production-2024"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def _load_users() -> list[dict]:
    if USERS_FILE.exists():
        with open(USERS_FILE) as f:
            return json.load(f)
    return []


def _save_users(users: list[dict]):
    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=2)


def _init_admin():
    """Create default admin user if no users exist."""
    users = _load_users()
    if not users:
        users.append({
            "username": "admin",
            "hashed_password": pwd_context.hash("admin123"),
            "role": "admin",
            "created": datetime.now().isoformat(),
        })
        _save_users(users)


def _authenticate_user(username: str, password: str) -> Optional[dict]:
    users = _load_users()
    for user in users:
        if user["username"] == username and pwd_context.verify(password, user["hashed_password"]):
            return user
    return None


def _create_token(data: dict, expires_delta: timedelta) -> str:
    to_encode = data.copy()
    to_encode["exp"] = datetime.utcnow() + expires_delta
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(401, "Invalid token")
    except JWTError:
        raise HTTPException(401, "Invalid or expired token")
    users = _load_users()
    for user in users:
        if user["username"] == username:
            return user
    raise HTTPException(401, "User not found")


# ── App Setup ─────────────────────────────────────────────────────
app = FastAPI(title="CloudMapper API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create admin user on startup
_init_admin()

# ── In-memory state for scan jobs ──────────────────────────────────
scan_jobs: dict = {}


# ── Pydantic Models ───────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str


class AccountIn(BaseModel):
    id: str
    name: str
    default: bool = False


class CIDRIn(BaseModel):
    cidr: str
    name: str


class ScanRequest(BaseModel):
    account_name: Optional[str] = None
    aws_access_key_id: Optional[str] = None
    aws_secret_access_key: Optional[str] = None
    aws_region: Optional[str] = "us-east-1"  # "all" for all regions


class AuditOverrideIn(BaseModel):
    finding_id: str
    severity: Optional[str] = None
    ignore_resources: Optional[list[str]] = None


# ── AUTH ENDPOINTS ────────────────────────────────────────────────
@app.post("/api/auth/login")
def login(req: LoginRequest):
    user = _authenticate_user(req.username, req.password)
    if not user:
        raise HTTPException(401, "Invalid username or password")
    token = _create_token(
        {"sub": user["username"], "role": user["role"]},
        timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "username": user["username"],
            "role": user["role"],
        },
    }


@app.get("/api/auth/me")
def get_me(user: dict = Depends(get_current_user)):
    return {
        "username": user["username"],
        "role": user["role"],
        "created": user.get("created"),
    }


# ── Helpers ────────────────────────────────────────────────────────
def _load_config() -> dict:
    cfg_path = CONFIG_FILE if CONFIG_FILE.exists() else CONFIG_DEMO
    with open(cfg_path) as f:
        return json.load(f)


def _save_config(config: dict):
    # Always write to config.json (not the demo file)
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=4)


def _load_audit_config() -> dict:
    with open(AUDIT_CONFIG) as f:
        cfg = yaml.safe_load(f) or {}
    if AUDIT_OVERRIDE.exists():
        with open(AUDIT_OVERRIDE) as f:
            override = yaml.safe_load(f) or {}
        for k, v in override.items():
            if k not in cfg:
                cfg[k] = {"title": "Unknown", "severity": "High", "group": "unknown"}
            cfg[k].update(v)
    return cfg


def _get_account_dirs() -> list[str]:
    if not ACCOUNT_DATA_DIR.exists():
        return []
    return [
        d.name
        for d in ACCOUNT_DATA_DIR.iterdir()
        if d.is_dir() and not d.name.startswith(".")
    ]


def _read_json(path: Path) -> dict:
    if not path.exists():
        return {}
    with open(path) as f:
        return json.load(f)


def _get_regions_for_account(account_name: str) -> list[str]:
    acct_dir = ACCOUNT_DATA_DIR / account_name
    if not acct_dir.exists():
        return []
    return [
        d.name
        for d in acct_dir.iterdir()
        if d.is_dir() and d.name.startswith(("us-", "eu-", "ap-", "sa-", "ca-", "me-", "af-"))
    ]


# ── ACCOUNTS ──────────────────────────────────────────────────────
@app.get("/api/accounts")
def list_accounts(user: dict = Depends(get_current_user)):
    config = _load_config()
    accounts = config.get("accounts", [])
    enriched = []
    seen_names = set()
    for acct in accounts:
        has_data = (ACCOUNT_DATA_DIR / acct["name"]).exists()
        regions = _get_regions_for_account(acct["name"]) if has_data else []
        enriched.append({**acct, "has_data": has_data, "regions": regions})
        seen_names.add(acct["name"])

    # Auto-detect accounts that have data but aren't in config
    for data_dir in _get_account_dirs():
        if data_dir not in seen_names:
            regions = _get_regions_for_account(data_dir)
            enriched.append({
                "id": "auto-detected",
                "name": data_dir,
                "default": len(enriched) == 0,
                "has_data": True,
                "regions": regions,
            })

    return {"accounts": enriched}


@app.post("/api/accounts")
def add_account(account: AccountIn, user: dict = Depends(get_current_user)):
    config = _load_config()
    for existing in config.get("accounts", []):
        if existing["id"] == account.id:
            raise HTTPException(400, "Account with this ID already exists")
    config.setdefault("accounts", []).append(account.dict())
    _save_config(config)
    return {"status": "ok", "account": account.dict()}


@app.delete("/api/accounts/{account_id}")
def remove_account(account_id: str, user: dict = Depends(get_current_user)):
    import shutil

    config = _load_config()
    # Find account name before removing
    removed_name = None
    for acct in config.get("accounts", []):
        if acct["id"] == account_id:
            removed_name = acct["name"]
            break

    config["accounts"] = [a for a in config.get("accounts", []) if a["id"] != account_id]
    _save_config(config)

    # Delete collected data for this account
    data_deleted = False
    if removed_name:
        acct_data_dir = ACCOUNT_DATA_DIR / removed_name
        if acct_data_dir.exists():
            shutil.rmtree(acct_data_dir)
            data_deleted = True

    return {
        "status": "ok",
        "account_removed": removed_name,
        "data_deleted": data_deleted,
    }


# ── CIDRs ─────────────────────────────────────────────────────────
@app.get("/api/cidrs")
def list_cidrs(user: dict = Depends(get_current_user)):
    config = _load_config()
    cidrs = config.get("cidrs", {})
    return {"cidrs": [{"cidr": k, **v} for k, v in cidrs.items()]}


@app.post("/api/cidrs")
def add_cidr(cidr_in: CIDRIn, user: dict = Depends(get_current_user)):
    config = _load_config()
    config.setdefault("cidrs", {})[cidr_in.cidr] = {"name": cidr_in.name}
    _save_config(config)
    return {"status": "ok"}


@app.delete("/api/cidrs/{cidr}")
def remove_cidr(cidr: str, user: dict = Depends(get_current_user)):
    config = _load_config()
    # URL-decode slashes:  cidr comes as "1.1.1.1%2F32" → need to handle
    config.get("cidrs", {}).pop(cidr, None)
    _save_config(config)
    return {"status": "ok"}


# ── RESOURCE DATA (from account-data/) ────────────────────────────
@app.get("/api/resources/{account_name}")
def get_resources(account_name: str, user: dict = Depends(get_current_user)):
    """Return a summary of all collected resources for an account."""
    acct_dir = ACCOUNT_DATA_DIR / account_name
    if not acct_dir.exists():
        raise HTTPException(404, f"No data for account '{account_name}'")

    resources = {}
    regions = _get_regions_for_account(account_name)

    for region in regions:
        region_dir = acct_dir / region
        region_data = {}

        # EC2 instances
        ec2 = _read_json(region_dir / "ec2-describe-instances.json")
        instances = []
        for r in ec2.get("Reservations", []):
            for inst in r.get("Instances", []):
                instances.append({
                    "id": inst.get("InstanceId"),
                    "type": inst.get("InstanceType"),
                    "state": inst.get("State", {}).get("Name"),
                    "public_ip": inst.get("PublicIpAddress"),
                    "private_ip": inst.get("PrivateIpAddress"),
                    "vpc": inst.get("VpcId"),
                    "launch_time": inst.get("LaunchTime"),
                })
        region_data["ec2_instances"] = instances

        # S3 buckets (global but stored in region)
        s3 = _read_json(region_dir / "s3-list-buckets.json")
        region_data["s3_buckets"] = [
            {"name": b["Name"], "created": b.get("CreationDate")}
            for b in s3.get("Buckets", [])
        ]

        # Security groups
        sgs = _read_json(region_dir / "ec2-describe-security-groups.json")
        region_data["security_groups"] = [
            {
                "id": sg["GroupId"],
                "name": sg["GroupName"],
                "vpc": sg.get("VpcId"),
                "description": sg.get("Description"),
                "inbound_rules": len(sg.get("IpPermissions", [])),
                "outbound_rules": len(sg.get("IpPermissionsEgress", [])),
            }
            for sg in sgs.get("SecurityGroups", [])
        ]

        # VPCs
        vpcs = _read_json(region_dir / "ec2-describe-vpcs.json")
        region_data["vpcs"] = [
            {"id": v["VpcId"], "cidr": v.get("CidrBlock"), "default": v.get("IsDefault")}
            for v in vpcs.get("Vpcs", [])
        ]

        # Lambda functions
        lam = _read_json(region_dir / "lambda-list-functions.json")
        region_data["lambda_functions"] = [
            {"name": fn["FunctionName"], "runtime": fn.get("Runtime"), "memory": fn.get("MemorySize")}
            for fn in lam.get("Functions", [])
        ]

        # RDS instances
        rds = _read_json(region_dir / "rds-describe-db-instances.json")
        region_data["rds_instances"] = [
            {
                "id": db["DBInstanceIdentifier"],
                "engine": db.get("Engine"),
                "class": db.get("DBInstanceClass"),
                "publicly_accessible": db.get("PubliclyAccessible"),
            }
            for db in rds.get("DBInstances", [])
        ]

        # ELBs
        elb = _read_json(region_dir / "elb-describe-load-balancers.json")
        region_data["load_balancers"] = [
            {"name": lb.get("LoadBalancerName"), "dns": lb.get("DNSName"), "scheme": lb.get("Scheme")}
            for lb in elb.get("LoadBalancerDescriptions", [])
        ]

        # ELBv2
        elbv2 = _read_json(region_dir / "elbv2-describe-load-balancers.json")
        region_data["load_balancers_v2"] = [
            {"name": lb.get("LoadBalancerName"), "dns": lb.get("DNSName"), "type": lb.get("Type"), "scheme": lb.get("Scheme")}
            for lb in elbv2.get("LoadBalancers", [])
        ]

        resources[region] = region_data

    return {"account": account_name, "regions": resources}


# ── IAM DATA ──────────────────────────────────────────────────────
@app.get("/api/iam/{account_name}")
def get_iam_data(account_name: str, user: dict = Depends(get_current_user)):
    """Return IAM users, roles, policies for an account."""
    # IAM data is global but stored under a region dir
    acct_dir = ACCOUNT_DATA_DIR / account_name
    regions = _get_regions_for_account(account_name)
    if not regions:
        raise HTTPException(404, "No data found")

    region = regions[0]
    region_dir = acct_dir / region

    auth = _read_json(region_dir / "iam-get-account-authorization-details.json")
    summary = _read_json(region_dir / "iam-get-account-summary.json")

    users = []
    for u in auth.get("UserDetailList", []):
        users.append({
            "name": u.get("UserName"),
            "arn": u.get("Arn"),
            "created": u.get("CreateDate"),
            "policies": [p["PolicyName"] for p in u.get("AttachedManagedPolicies", [])],
            "inline_policies": list(u.get("UserPolicyList", [])),
            "groups": u.get("GroupList", []),
            "mfa_devices": u.get("MFADevices", []),
        })

    roles = []
    for r in auth.get("RoleDetailList", []):
        roles.append({
            "name": r.get("RoleName"),
            "arn": r.get("Arn"),
            "created": r.get("CreateDate"),
            "policies": [p["PolicyName"] for p in r.get("AttachedManagedPolicies", [])],
            "trust_policy": r.get("AssumeRolePolicyDocument"),
        })

    policies = []
    for p in auth.get("Policies", []):
        policies.append({
            "name": p.get("PolicyName"),
            "arn": p.get("Arn"),
            "attachment_count": p.get("AttachmentCount"),
            "is_attachable": p.get("IsAttachable"),
        })

    return {
        "account": account_name,
        "summary": summary.get("SummaryMap", {}),
        "users": users,
        "roles": roles,
        "policies": policies,
    }


# ── SECURITY GROUPS ANALYSIS ──────────────────────────────────────
@app.get("/api/security-groups/{account_name}")
def get_security_groups_analysis(account_name: str, user: dict = Depends(get_current_user)):
    """Analyze security groups for risky rules."""
    acct_dir = ACCOUNT_DATA_DIR / account_name
    regions = _get_regions_for_account(account_name)
    results = []

    for region in regions:
        sgs = _read_json(acct_dir / region / "ec2-describe-security-groups.json")
        for sg in sgs.get("SecurityGroups", []):
            open_to_world = []
            for rule in sg.get("IpPermissions", []):
                for ip_range in rule.get("IpRanges", []):
                    if ip_range.get("CidrIp") == "0.0.0.0/0":
                        open_to_world.append({
                            "protocol": rule.get("IpProtocol"),
                            "from_port": rule.get("FromPort"),
                            "to_port": rule.get("ToPort"),
                        })
                for ip_range in rule.get("Ipv6Ranges", []):
                    if ip_range.get("CidrIpv6") == "::/0":
                        open_to_world.append({
                            "protocol": rule.get("IpProtocol"),
                            "from_port": rule.get("FromPort"),
                            "to_port": rule.get("ToPort"),
                        })
            if open_to_world:
                results.append({
                    "region": region,
                    "group_id": sg["GroupId"],
                    "group_name": sg["GroupName"],
                    "vpc_id": sg.get("VpcId"),
                    "open_rules": open_to_world,
                    "severity": "CRITICAL" if any(
                        r.get("from_port") in (22, 3389, 3306, 5432) or r.get("protocol") == "-1"
                        for r in open_to_world
                    ) else "HIGH",
                })

    return {"account": account_name, "risky_groups": results}


# ── AUDIT FINDINGS ────────────────────────────────────────────────
@app.get("/api/audit/config")
def get_audit_config(user: dict = Depends(get_current_user)):
    """Return all audit finding definitions."""
    cfg = _load_audit_config()
    findings = []
    for fid, conf in cfg.items():
        findings.append({"id": fid, **conf})
    return {"findings": findings}


@app.post("/api/audit/run/{account_name}")
def run_audit(account_name: str, user: dict = Depends(get_current_user)):
    """Run audit checks against collected data (no CLI dependency)."""
    acct_dir = ACCOUNT_DATA_DIR / account_name
    if not acct_dir.exists():
        raise HTTPException(404, f"No data for account '{account_name}'")

    regions = _get_regions_for_account(account_name)
    if not regions:
        raise HTTPException(404, "No region data found")

    findings = []

    for region in regions:
        rd = acct_dir / region

        # Check 1: Security groups open to 0.0.0.0/0
        sgs = _read_json(rd / "ec2-describe-security-groups.json")
        for sg in sgs.get("SecurityGroups", []):
            for rule in sg.get("IpPermissions", []):
                for ip_range in rule.get("IpRanges", []):
                    if ip_range.get("CidrIp") == "0.0.0.0/0":
                        port = rule.get("FromPort")
                        proto = rule.get("IpProtocol", "tcp")
                        sev = "CRITICAL" if port in (22, 3389, 3306, 5432, 1433, 27017) or proto == "-1" else "HIGH"
                        port_str = f"port {port}" if port else "all ports"
                        findings.append({
                            "issue": "SG_OPEN_TO_WORLD",
                            "title": f"Security Group open to 0.0.0.0/0 on {port_str}",
                            "severity": sev,
                            "region": region,
                            "resource": f"{sg['GroupId']} ({sg['GroupName']})",
                            "description": f"Inbound rule allows {proto} traffic on {port_str} from anywhere",
                            "group": "security_groups",
                        })
                for ip_range in rule.get("Ipv6Ranges", []):
                    if ip_range.get("CidrIpv6") == "::/0":
                        port = rule.get("FromPort")
                        findings.append({
                            "issue": "SG_OPEN_TO_WORLD_IPV6",
                            "title": f"Security Group open to ::/0 on port {port or 'all'}",
                            "severity": "HIGH",
                            "region": region,
                            "resource": f"{sg['GroupId']} ({sg['GroupName']})",
                            "description": f"Inbound rule allows IPv6 traffic from anywhere",
                            "group": "security_groups",
                        })

        # Check 2: EC2 instances with public IPs
        ec2 = _read_json(rd / "ec2-describe-instances.json")
        for res in ec2.get("Reservations", []):
            for inst in res.get("Instances", []):
                if inst.get("PublicIpAddress"):
                    findings.append({
                        "issue": "EC2_PUBLIC_IP",
                        "title": "EC2 instance has public IP",
                        "severity": "MEDIUM",
                        "region": region,
                        "resource": f"{inst['InstanceId']} ({inst.get('PublicIpAddress')})",
                        "description": "Instance is directly accessible from the internet",
                        "group": "ec2",
                    })

        # Check 3: RDS publicly accessible
        rds = _read_json(rd / "rds-describe-db-instances.json")
        for db in rds.get("DBInstances", []):
            if db.get("PubliclyAccessible"):
                findings.append({
                    "issue": "RDS_PUBLIC",
                    "title": "RDS instance is publicly accessible",
                    "severity": "CRITICAL",
                    "region": region,
                    "resource": db.get("DBInstanceIdentifier"),
                    "description": f"Database {db.get('Engine', 'unknown')} is marked as publicly accessible",
                    "group": "rds",
                })
            if not db.get("StorageEncrypted"):
                findings.append({
                    "issue": "RDS_UNENCRYPTED",
                    "title": "RDS instance storage not encrypted",
                    "severity": "HIGH",
                    "region": region,
                    "resource": db.get("DBInstanceIdentifier"),
                    "description": "Database storage is not encrypted at rest",
                    "group": "rds",
                })

        # Check 4: ELB using HTTP (not HTTPS)
        elb = _read_json(rd / "elb-describe-load-balancers.json")
        for lb in elb.get("LoadBalancerDescriptions", []):
            for listener in lb.get("ListenerDescriptions", []):
                l = listener.get("Listener", {})
                if l.get("Protocol", "").upper() == "HTTP":
                    findings.append({
                        "issue": "ELB_HTTP",
                        "title": "ELB using HTTP listener",
                        "severity": "MEDIUM",
                        "region": region,
                        "resource": lb.get("LoadBalancerName"),
                        "description": "Load balancer accepts unencrypted HTTP traffic",
                        "group": "elb",
                    })

        # Check 5: CloudTrail not enabled
        trails = _read_json(rd / "cloudtrail-describe-trails.json")
        if not trails.get("trailList"):
            findings.append({
                "issue": "NO_CLOUDTRAIL",
                "title": "No CloudTrail trails configured",
                "severity": "HIGH",
                "region": region,
                "resource": "CloudTrail",
                "description": "No audit logging trails found in this region",
                "group": "logging",
            })

        # Check 6: GuardDuty not enabled
        gd = _read_json(rd / "guardduty-list-detectors.json")
        if not gd.get("DetectorIds"):
            findings.append({
                "issue": "NO_GUARDDUTY",
                "title": "GuardDuty not enabled",
                "severity": "MEDIUM",
                "region": region,
                "resource": "GuardDuty",
                "description": "AWS threat detection service not active in this region",
                "group": "monitoring",
            })

    # Check 7: IAM - root account keys, MFA, etc.
    if regions:
        iam_summary = _read_json(acct_dir / regions[0] / "iam-get-account-summary.json").get("SummaryMap", {})
        if not iam_summary.get("AccountMFAEnabled"):
            findings.append({
                "issue": "ROOT_NO_MFA",
                "title": "Root account MFA not enabled",
                "severity": "CRITICAL",
                "region": "global",
                "resource": "Root Account",
                "description": "The root account does not have MFA enabled",
                "group": "iam",
            })
        if iam_summary.get("AccountAccessKeysPresent"):
            findings.append({
                "issue": "ROOT_ACCESS_KEYS",
                "title": "Root account has access keys",
                "severity": "CRITICAL",
                "region": "global",
                "resource": "Root Account",
                "description": "Root account access keys exist — these should be deleted",
                "group": "iam",
            })

        # Check IAM users without MFA
        auth = _read_json(acct_dir / regions[0] / "iam-get-account-authorization-details.json")
        for u in auth.get("UserDetailList", []):
            if not u.get("MFADevices"):
                findings.append({
                    "issue": "USER_NO_MFA",
                    "title": f"IAM user '{u.get('UserName')}' has no MFA",
                    "severity": "HIGH",
                    "region": "global",
                    "resource": u.get("UserName"),
                    "description": "IAM user does not have MFA enabled",
                    "group": "iam",
                })

    severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}
    findings.sort(key=lambda x: severity_order.get(x.get("severity", "INFO"), 5))

    return {
        "account": account_name,
        "total": len(findings),
        "findings": findings,
        "summary": {
            sev: len([f for f in findings if f.get("severity") == sev])
            for sev in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]
        },
    }


# ── SCAN (COLLECT via boto3) ──────────────────────────────────────
def _boto3_collect(account_name: str, region: str, aws_key: str = None, aws_secret: str = None):
    """Collect AWS data directly via boto3 and store as JSON files."""
    import boto3

    kwargs = {}
    if aws_key and aws_secret:
        kwargs["aws_access_key_id"] = aws_key
        kwargs["aws_secret_access_key"] = aws_secret
    kwargs["region_name"] = region

    session = boto3.Session(**kwargs)

    acct_dir = ACCOUNT_DATA_DIR / account_name / region
    acct_dir.mkdir(parents=True, exist_ok=True)

    collected = []

    # Helper to safely call and save
    def _collect_service(filename, client_name, method, **call_kwargs):
        try:
            client = session.client(client_name)
            data = getattr(client, method)(**call_kwargs)
            data.pop("ResponseMetadata", None)
            with open(acct_dir / filename, "w") as f:
                json.dump(data, f, indent=2, default=str)
            collected.append(filename)
        except Exception as e:
            return f"{filename}: {str(e)[:100]}"
        return None

    errors = []

    # EC2 instances
    e = _collect_service("ec2-describe-instances.json", "ec2", "describe_instances")
    if e: errors.append(e)

    # Security groups
    e = _collect_service("ec2-describe-security-groups.json", "ec2", "describe_security_groups")
    if e: errors.append(e)

    # VPCs
    e = _collect_service("ec2-describe-vpcs.json", "ec2", "describe_vpcs")
    if e: errors.append(e)

    # Subnets
    e = _collect_service("ec2-describe-subnets.json", "ec2", "describe_subnets")
    if e: errors.append(e)

    # S3 buckets
    e = _collect_service("s3-list-buckets.json", "s3", "list_buckets")
    if e: errors.append(e)

    # Lambda functions
    e = _collect_service("lambda-list-functions.json", "lambda", "list_functions")
    if e: errors.append(e)

    # RDS instances
    e = _collect_service("rds-describe-db-instances.json", "rds", "describe_db_instances")
    if e: errors.append(e)

    # ELB classic
    e = _collect_service("elb-describe-load-balancers.json", "elb", "describe_load_balancers")
    if e: errors.append(e)

    # ELBv2
    e = _collect_service("elbv2-describe-load-balancers.json", "elbv2", "describe_load_balancers")
    if e: errors.append(e)

    # IAM (global)
    e = _collect_service("iam-get-account-authorization-details.json", "iam", "get_account_authorization_details")
    if e: errors.append(e)

    e = _collect_service("iam-get-account-summary.json", "iam", "get_account_summary")
    if e: errors.append(e)

    # STS identity
    e = _collect_service("sts-get-caller-identity.json", "sts", "get_caller_identity")
    if e: errors.append(e)

    # EC2 snapshots (owned by self)
    e = _collect_service("ec2-describe-snapshots.json", "ec2", "describe_snapshots", OwnerIds=["self"])
    if e: errors.append(e)

    # EC2 network interfaces
    e = _collect_service("ec2-describe-network-interfaces.json", "ec2", "describe_network_interfaces")
    if e: errors.append(e)

    # CloudTrail
    e = _collect_service("cloudtrail-describe-trails.json", "cloudtrail", "describe_trails")
    if e: errors.append(e)

    # GuardDuty
    e = _collect_service("guardduty-list-detectors.json", "guardduty", "list_detectors")
    if e: errors.append(e)

    return collected, errors


ALL_AWS_REGIONS = [
    "us-east-1", "us-east-2", "us-west-1", "us-west-2",
    "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-central-2",
    "eu-north-1", "eu-south-1", "eu-south-2",
    "ap-south-1", "ap-south-2", "ap-southeast-1", "ap-southeast-2",
    "ap-southeast-3", "ap-southeast-4", "ap-northeast-1", "ap-northeast-2", "ap-northeast-3",
    "ap-east-1", "sa-east-1", "ca-central-1", "ca-west-1",
    "me-south-1", "me-central-1", "af-south-1", "il-central-1",
]


def _get_enabled_regions(aws_key: str = None, aws_secret: str = None) -> list[str]:
    """Fetch the list of enabled regions for this account via EC2 describe-regions."""
    import boto3
    kwargs = {"region_name": "us-east-1"}
    if aws_key and aws_secret:
        kwargs["aws_access_key_id"] = aws_key
        kwargs["aws_secret_access_key"] = aws_secret
    try:
        ec2 = boto3.client("ec2", **kwargs)
        resp = ec2.describe_regions(AllRegions=False)
        return [r["RegionName"] for r in resp.get("Regions", [])]
    except Exception:
        return ALL_AWS_REGIONS[:15]  # fallback to common regions


@app.post("/api/scan/start")
def start_scan(req: ScanRequest, user: dict = Depends(get_current_user)):
    """Start a background collect + audit pipeline using boto3."""
    job_id = str(uuid.uuid4())[:8]
    account_name = req.account_name or "demo"
    scan_jobs[job_id] = {
        "id": job_id,
        "status": "running",
        "account": account_name,
        "started": datetime.now().isoformat(),
        "log": [],
        "progress": 0,
        "regions_scanned": [],
        "regions_total": 0,
    }

    def _run():
        job = scan_jobs[job_id]
        try:
            requested_region = req.aws_region or "us-east-1"

            # Determine which regions to scan
            if requested_region == "all":
                job["log"].append("Discovering enabled AWS regions...")
                regions_to_scan = _get_enabled_regions(req.aws_access_key_id, req.aws_secret_access_key)
                job["log"].append(f"Found {len(regions_to_scan)} enabled regions")
            else:
                regions_to_scan = [requested_region]

            job["regions_total"] = len(regions_to_scan)
            total_collected = 0
            total_errors = []
            region_results = {}

            for idx, region in enumerate(regions_to_scan):
                region_pct = int(5 + (85 * idx / len(regions_to_scan)))
                job["progress"] = region_pct
                job["log"].append(f"[{idx+1}/{len(regions_to_scan)}] Scanning {region}...")

                collected, errors = _boto3_collect(
                    account_name,
                    region,
                    aws_key=req.aws_access_key_id,
                    aws_secret=req.aws_secret_access_key,
                )

                region_results[region] = {"collected": len(collected), "errors": len(errors)}
                total_collected += len(collected)
                total_errors.extend(errors)
                job["regions_scanned"].append(region)

                if collected:
                    job["log"].append(f"  {region}: {len(collected)} resources collected")
                else:
                    job["log"].append(f"  {region}: no resources (or access denied)")

            # Store describe-regions once at account level
            try:
                import boto3
                kwargs = {"region_name": "us-east-1"}
                if req.aws_access_key_id and req.aws_secret_access_key:
                    kwargs["aws_access_key_id"] = req.aws_access_key_id
                    kwargs["aws_secret_access_key"] = req.aws_secret_access_key
                ec2 = boto3.client("ec2", **kwargs)
                regions_data = ec2.describe_regions()
                regions_data.pop("ResponseMetadata", None)
                acct_base = ACCOUNT_DATA_DIR / account_name
                acct_base.mkdir(parents=True, exist_ok=True)
                with open(acct_base / "describe-regions.json", "w") as f:
                    json.dump(regions_data, f, indent=2, default=str)
            except Exception:
                pass

            # Summary
            if total_errors:
                job["log"].append(f"Warnings: {len(total_errors)} total across all regions")

            # Check if we got ANY data across all regions
            acct_dir = ACCOUNT_DATA_DIR / account_name
            has_any_data = any(
                (acct_dir / r).exists() and any((acct_dir / r).glob("*.json"))
                for r in regions_to_scan
            )

            if not has_any_data:
                job["status"] = "failed"
                job["log"].append("FAILED: No data files were created. Check AWS credentials.")
                job["completed"] = datetime.now().isoformat()
                return

            job["progress"] = 95

            # Summary of regions with data
            regions_with_data = [r for r in regions_to_scan if (acct_dir / r).exists() and any((acct_dir / r).glob("*.json"))]
            job["log"].append(f"Data collected in {len(regions_with_data)}/{len(regions_to_scan)} regions")

            job["progress"] = 100
            job["status"] = "completed"
            job["log"].append(f"Scan completed — {total_collected} resources across {len(regions_with_data)} regions")
            job["completed"] = datetime.now().isoformat()

        except Exception as e:
            job["status"] = "failed"
            job["log"].append(f"Error: {str(e)}")
            job["completed"] = datetime.now().isoformat()

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    return {"job_id": job_id, "status": "started"}


@app.get("/api/scan/status/{job_id}")
def scan_status(job_id: str, user: dict = Depends(get_current_user)):
    if job_id not in scan_jobs:
        raise HTTPException(404, "Job not found")
    return scan_jobs[job_id]


@app.get("/api/scan/history")
def scan_history(user: dict = Depends(get_current_user)):
    return {"jobs": list(scan_jobs.values())}


# ── DASHBOARD SUMMARY ─────────────────────────────────────────────
@app.get("/api/dashboard/{account_name}")
def dashboard_summary(account_name: str, user: dict = Depends(get_current_user)):
    """Return a high-level dashboard summary for an account."""
    acct_dir = ACCOUNT_DATA_DIR / account_name
    if not acct_dir.exists():
        raise HTTPException(404, f"No data for account '{account_name}'")

    regions = _get_regions_for_account(account_name)
    total_instances = 0
    total_sgs = 0
    total_vpcs = 0
    total_lambdas = 0
    total_buckets = 0
    total_rds = 0
    total_elbs = 0
    public_ips = []
    region_stats = {}

    total_subnets = 0
    total_snapshots = 0
    total_nics = 0

    for region in regions:
        rd = acct_dir / region
        r_stats = {}

        # EC2
        ec2 = _read_json(rd / "ec2-describe-instances.json")
        instances = [i for r in ec2.get("Reservations", []) for i in r.get("Instances", [])]
        running = [i for i in instances if i.get("State", {}).get("Name") == "running"]
        stopped = [i for i in instances if i.get("State", {}).get("Name") == "stopped"]
        r_stats["instances"] = len(instances)
        r_stats["instances_running"] = len(running)
        r_stats["instances_stopped"] = len(stopped)
        total_instances += len(instances)
        for inst in instances:
            if inst.get("PublicIpAddress"):
                name_tag = ""
                for tag in inst.get("Tags", []):
                    if tag.get("Key") == "Name":
                        name_tag = tag.get("Value", "")
                public_ips.append({
                    "ip": inst["PublicIpAddress"],
                    "resource": inst["InstanceId"],
                    "name": name_tag,
                    "type": "EC2",
                    "instance_type": inst.get("InstanceType"),
                    "state": inst.get("State", {}).get("Name"),
                    "region": region,
                })

        # SGs
        sgs = _read_json(rd / "ec2-describe-security-groups.json")
        r_stats["security_groups"] = len(sgs.get("SecurityGroups", []))
        total_sgs += r_stats["security_groups"]

        # VPCs
        vpcs = _read_json(rd / "ec2-describe-vpcs.json")
        r_stats["vpcs"] = len(vpcs.get("Vpcs", []))
        total_vpcs += r_stats["vpcs"]

        # Subnets
        subnets = _read_json(rd / "ec2-describe-subnets.json")
        r_stats["subnets"] = len(subnets.get("Subnets", []))
        total_subnets += r_stats["subnets"]

        # Lambda
        lam = _read_json(rd / "lambda-list-functions.json")
        r_stats["lambdas"] = len(lam.get("Functions", []))
        total_lambdas += r_stats["lambdas"]

        # S3 (global but stored per region)
        s3 = _read_json(rd / "s3-list-buckets.json")
        r_stats["buckets"] = len(s3.get("Buckets", []))
        total_buckets += r_stats["buckets"]

        # RDS
        rds = _read_json(rd / "rds-describe-db-instances.json")
        rds_list = rds.get("DBInstances", [])
        r_stats["rds"] = len(rds_list)
        total_rds += r_stats["rds"]
        # Public RDS
        for db in rds_list:
            if db.get("PubliclyAccessible") and db.get("Endpoint", {}).get("Address"):
                public_ips.append({
                    "ip": db["Endpoint"]["Address"],
                    "resource": db["DBInstanceIdentifier"],
                    "name": db.get("Engine", ""),
                    "type": "RDS",
                    "instance_type": db.get("DBInstanceClass"),
                    "state": db.get("DBInstanceStatus"),
                    "region": region,
                })

        # ELBs
        elb = _read_json(rd / "elb-describe-load-balancers.json")
        elbv2 = _read_json(rd / "elbv2-describe-load-balancers.json")
        elb_list = elb.get("LoadBalancerDescriptions", [])
        elbv2_list = elbv2.get("LoadBalancers", [])
        r_stats["elbs"] = len(elb_list) + len(elbv2_list)
        total_elbs += r_stats["elbs"]
        # Public ELBs
        for lb in elb_list:
            if lb.get("Scheme") == "internet-facing":
                public_ips.append({
                    "ip": lb.get("DNSName", ""),
                    "resource": lb.get("LoadBalancerName"),
                    "name": "Classic ELB",
                    "type": "ELB",
                    "instance_type": "classic",
                    "state": "active",
                    "region": region,
                })
        for lb in elbv2_list:
            if lb.get("Scheme") == "internet-facing":
                public_ips.append({
                    "ip": lb.get("DNSName", ""),
                    "resource": lb.get("LoadBalancerName"),
                    "name": lb.get("Type", "ALB/NLB"),
                    "type": "ELBv2",
                    "instance_type": lb.get("Type"),
                    "state": lb.get("State", {}).get("Code", "active"),
                    "region": region,
                })

        # Snapshots
        snaps = _read_json(rd / "ec2-describe-snapshots.json")
        r_stats["snapshots"] = len(snaps.get("Snapshots", []))
        total_snapshots += r_stats["snapshots"]

        # Network Interfaces
        nics = _read_json(rd / "ec2-describe-network-interfaces.json")
        r_stats["network_interfaces"] = len(nics.get("NetworkInterfaces", []))
        total_nics += r_stats["network_interfaces"]

        # CloudTrail
        trails = _read_json(rd / "cloudtrail-describe-trails.json")
        r_stats["cloudtrail_trails"] = len(trails.get("trailList", []))

        # GuardDuty
        gd = _read_json(rd / "guardduty-list-detectors.json")
        r_stats["guardduty_enabled"] = len(gd.get("DetectorIds", [])) > 0

        # Region has resources?
        r_stats["has_resources"] = any(
            r_stats.get(k, 0) > 0
            for k in ["instances", "security_groups", "vpcs", "lambdas", "rds", "elbs"]
        )

        region_stats[region] = r_stats

    # IAM summary
    iam_summary = {}
    iam_users = []
    iam_roles = []
    if regions:
        iam_summary = _read_json(acct_dir / regions[0] / "iam-get-account-summary.json").get("SummaryMap", {})
        auth = _read_json(acct_dir / regions[0] / "iam-get-account-authorization-details.json")
        for u in auth.get("UserDetailList", []):
            iam_users.append({
                "name": u.get("UserName"),
                "arn": u.get("Arn"),
                "created": u.get("CreateDate"),
                "has_mfa": len(u.get("MFADevices", [])) > 0,
                "policies_count": len(u.get("AttachedManagedPolicies", [])) + len(u.get("UserPolicyList", [])),
                "groups": u.get("GroupList", []),
            })
        for r in auth.get("RoleDetailList", []):
            iam_roles.append({
                "name": r.get("RoleName"),
                "arn": r.get("Arn"),
                "created": r.get("CreateDate"),
                "policies_count": len(r.get("AttachedManagedPolicies", [])),
            })

    # STS caller identity
    caller_identity = {}
    if regions:
        caller_identity = _read_json(acct_dir / regions[0] / "sts-get-caller-identity.json")

    # Calculate security score (weighted heuristic like CloudMapper)
    score = 100
    if not iam_summary.get("AccountMFAEnabled"):
        score -= 20
    if iam_summary.get("AccountAccessKeysPresent"):
        score -= 15
    # Public resources penalty
    ec2_public = len([p for p in public_ips if p["type"] == "EC2"])
    rds_public = len([p for p in public_ips if p["type"] == "RDS"])
    if ec2_public:
        score -= min(ec2_public * 5, 20)
    if rds_public:
        score -= min(rds_public * 10, 20)
    # Users without MFA
    users_no_mfa = len([u for u in iam_users if not u["has_mfa"]])
    if users_no_mfa:
        score -= min(users_no_mfa * 3, 15)
    # Open security groups (check from region data)
    open_sgs = 0
    for region in regions:
        rd = acct_dir / region
        sgs_data = _read_json(rd / "ec2-describe-security-groups.json")
        for sg in sgs_data.get("SecurityGroups", []):
            for rule in sg.get("IpPermissions", []):
                for ip_range in rule.get("IpRanges", []):
                    if ip_range.get("CidrIp") == "0.0.0.0/0":
                        open_sgs += 1
    if open_sgs:
        score -= min(open_sgs * 3, 15)

    # Region usage matrix (CloudMapper style: which resource types exist in which regions)
    resource_types = ["instances", "security_groups", "vpcs", "subnets", "lambdas", "rds", "elbs", "snapshots"]
    region_matrix = {}
    for region, stats in region_stats.items():
        region_matrix[region] = {rt: stats.get(rt, 0) for rt in resource_types}

    return {
        "account": account_name,
        "caller_identity": caller_identity,
        "security_score": max(score, 0),
        "collection_date": datetime.now().isoformat(),
        "regions_scanned": len(regions),
        "totals": {
            "instances": total_instances,
            "security_groups": total_sgs,
            "vpcs": total_vpcs,
            "subnets": total_subnets,
            "lambdas": total_lambdas,
            "buckets": total_buckets,
            "rds": total_rds,
            "elbs": total_elbs,
            "snapshots": total_snapshots,
            "network_interfaces": total_nics,
        },
        "regions": region_stats,
        "region_matrix": region_matrix,
        "public_ips": public_ips,
        "public_summary": {
            "ec2": len([p for p in public_ips if p["type"] == "EC2"]),
            "rds": len([p for p in public_ips if p["type"] == "RDS"]),
            "elb": len([p for p in public_ips if p["type"] in ("ELB", "ELBv2")]),
            "total": len(public_ips),
        },
        "iam_summary": iam_summary,
        "iam_users": iam_users,
        "iam_roles_count": len(iam_roles),
        "iam_users_no_mfa": users_no_mfa,
        "open_security_groups": open_sgs,
    }


# ── HEALTH ────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "version": "2.0.0",
        "accounts_with_data": _get_account_dirs(),
        "timestamp": datetime.now().isoformat(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8088)

