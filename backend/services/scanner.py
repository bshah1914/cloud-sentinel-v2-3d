"""
CloudSentinel Enterprise — Real AWS Scanner Service
Uses boto3 to scan live AWS accounts and store results in database.
"""

import json
import os
import time
import threading
from datetime import datetime, timezone

try:
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError
    HAS_BOTO3 = True
except ImportError:
    HAS_BOTO3 = False

from models.database import SessionLocal, Scan, Finding, CloudAccount, AuditLog, gen_id, utcnow


# All scannable regions
AWS_REGIONS = [
    "us-east-1", "us-east-2", "us-west-1", "us-west-2",
    "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-north-1",
    "ap-south-1", "ap-southeast-1", "ap-southeast-2",
    "ap-northeast-1", "ap-northeast-2", "ap-northeast-3",
    "sa-east-1", "ca-central-1",
]


def _get_boto_session(account):
    """Create a boto3 session for a cloud account."""
    if account.role_arn:
        sts = boto3.client("sts",
            aws_access_key_id=account.access_key,
            aws_secret_access_key=account.secret_key)
        creds = sts.assume_role(RoleArn=account.role_arn, RoleSessionName="CloudSentinel")["Credentials"]
        return boto3.Session(
            aws_access_key_id=creds["AccessKeyId"],
            aws_secret_access_key=creds["SecretAccessKey"],
            aws_session_token=creds["SessionToken"])
    return boto3.Session(
        aws_access_key_id=account.access_key,
        aws_secret_access_key=account.secret_key)


def _scan_region(session, region):
    """Scan a single AWS region and return resource data."""
    results = {"region": region, "resources": {}, "findings": []}

    try:
        # EC2 Instances
        ec2 = session.client("ec2", region_name=region)
        try:
            instances = []
            for r in ec2.describe_instances().get("Reservations", []):
                instances.extend(r.get("Instances", []))
            results["resources"]["ec2_instances"] = len(instances)

            # Check for public IPs, stopped instances
            for inst in instances:
                if inst.get("PublicIpAddress"):
                    results["findings"].append({
                        "title": f"EC2 instance {inst['InstanceId']} has public IP {inst['PublicIpAddress']}",
                        "severity": "MEDIUM", "category": "network",
                        "resource_type": "EC2", "resource_id": inst["InstanceId"],
                        "region": region,
                        "remediation": "Consider using private subnets with NAT gateway",
                    })
                if inst.get("State", {}).get("Name") == "stopped":
                    results["findings"].append({
                        "title": f"EC2 instance {inst['InstanceId']} is stopped (wasting cost)",
                        "severity": "LOW", "category": "cost",
                        "resource_type": "EC2", "resource_id": inst["InstanceId"],
                        "region": region,
                        "remediation": "Terminate stopped instances or create AMI and terminate",
                    })
        except ClientError:
            pass

        # Security Groups
        try:
            sgs = ec2.describe_security_groups().get("SecurityGroups", [])
            results["resources"]["security_groups"] = len(sgs)
            for sg in sgs:
                for perm in sg.get("IpPermissions", []):
                    for ip_range in perm.get("IpRanges", []):
                        if ip_range.get("CidrIp") == "0.0.0.0/0":
                            port = perm.get("FromPort", "all")
                            sev = "CRITICAL" if port in [22, 3389, 3306, 5432, 1433, 27017] else "HIGH"
                            results["findings"].append({
                                "title": f"Security Group {sg['GroupId']} open to 0.0.0.0/0 on port {port}",
                                "severity": sev, "category": "network",
                                "resource_type": "SecurityGroup", "resource_id": sg["GroupId"],
                                "region": region,
                                "remediation": f"Restrict port {port} to specific CIDR ranges",
                                "remediation_cli": f"aws ec2 revoke-security-group-ingress --group-id {sg['GroupId']} --protocol tcp --port {port} --cidr 0.0.0.0/0",
                            })
        except ClientError:
            pass

        # VPCs
        try:
            vpcs = ec2.describe_vpcs().get("Vpcs", [])
            results["resources"]["vpcs"] = len(vpcs)
        except ClientError:
            pass

        # Subnets
        try:
            subnets = ec2.describe_subnets().get("Subnets", [])
            results["resources"]["subnets"] = len(subnets)
        except ClientError:
            pass

        # Snapshots
        try:
            snapshots = ec2.describe_snapshots(OwnerIds=["self"]).get("Snapshots", [])
            results["resources"]["snapshots"] = len(snapshots)
        except ClientError:
            pass

        # Lambda
        try:
            lam = session.client("lambda", region_name=region)
            functions = lam.list_functions().get("Functions", [])
            results["resources"]["lambda_functions"] = len(functions)
            for fn in functions:
                env_vars = fn.get("Environment", {}).get("Variables", {})
                for key in env_vars:
                    if any(s in key.upper() for s in ["SECRET", "PASSWORD", "KEY", "TOKEN", "API_KEY"]):
                        results["findings"].append({
                            "title": f"Lambda {fn['FunctionName']} has potential secret in env var: {key}",
                            "severity": "HIGH", "category": "secrets",
                            "resource_type": "Lambda", "resource_id": fn["FunctionName"],
                            "region": region,
                            "remediation": "Use AWS Secrets Manager instead of environment variables",
                        })
        except ClientError:
            pass

        # RDS
        try:
            rds = session.client("rds", region_name=region)
            dbs = rds.describe_db_instances().get("DBInstances", [])
            results["resources"]["rds_instances"] = len(dbs)
            for db in dbs:
                if db.get("PubliclyAccessible"):
                    results["findings"].append({
                        "title": f"RDS instance {db['DBInstanceIdentifier']} is publicly accessible",
                        "severity": "CRITICAL", "category": "data",
                        "resource_type": "RDS", "resource_id": db["DBInstanceIdentifier"],
                        "region": region,
                        "remediation": "Disable public access on RDS instance",
                        "remediation_cli": f"aws rds modify-db-instance --db-instance-identifier {db['DBInstanceIdentifier']} --no-publicly-accessible",
                    })
                if not db.get("StorageEncrypted"):
                    results["findings"].append({
                        "title": f"RDS instance {db['DBInstanceIdentifier']} storage is not encrypted",
                        "severity": "HIGH", "category": "encryption",
                        "resource_type": "RDS", "resource_id": db["DBInstanceIdentifier"],
                        "region": region,
                        "remediation": "Enable encryption at rest for RDS",
                    })
        except ClientError:
            pass

        # ELBs
        try:
            elbv2 = session.client("elbv2", region_name=region)
            lbs = elbv2.describe_load_balancers().get("LoadBalancers", [])
            results["resources"]["load_balancers"] = len(lbs)
        except ClientError:
            pass

        # S3 (global, only scan once in us-east-1)
        if region == "us-east-1":
            try:
                s3 = session.client("s3", region_name=region)
                buckets = s3.list_buckets().get("Buckets", [])
                results["resources"]["s3_buckets"] = len(buckets)

                for bucket in buckets[:20]:  # Limit to 20 to avoid throttling
                    try:
                        acl = s3.get_bucket_acl(Bucket=bucket["Name"])
                        for grant in acl.get("Grants", []):
                            grantee = grant.get("Grantee", {})
                            if grantee.get("URI") == "http://acs.amazonaws.com/groups/global/AllUsers":
                                results["findings"].append({
                                    "title": f"S3 bucket {bucket['Name']} has public ACL",
                                    "severity": "CRITICAL", "category": "data",
                                    "resource_type": "S3", "resource_id": bucket["Name"],
                                    "region": "global",
                                    "remediation": "Remove public ACL from S3 bucket",
                                })
                    except ClientError:
                        pass
            except ClientError:
                pass

        # IAM (global, only scan once in us-east-1)
        if region == "us-east-1":
            try:
                iam = session.client("iam")
                summary = iam.get_account_summary().get("SummaryMap", {})
                results["resources"]["iam_users"] = summary.get("Users", 0)
                results["resources"]["iam_roles"] = summary.get("Roles", 0)

                if not summary.get("AccountMFAEnabled"):
                    results["findings"].append({
                        "title": "Root account MFA is not enabled",
                        "severity": "CRITICAL", "category": "iam",
                        "resource_type": "IAM", "resource_id": "root",
                        "region": "global",
                        "remediation": "Enable MFA on the root account immediately",
                    })

                # Check users without MFA
                users = iam.list_users().get("Users", [])
                for user in users:
                    mfa_devices = iam.list_mfa_devices(UserName=user["UserName"]).get("MFADevices", [])
                    if not mfa_devices:
                        results["findings"].append({
                            "title": f"IAM user {user['UserName']} does not have MFA enabled",
                            "severity": "MEDIUM", "category": "iam",
                            "resource_type": "IAM", "resource_id": user["UserName"],
                            "region": "global",
                            "remediation": f"Enable MFA for user {user['UserName']}",
                        })
            except ClientError:
                pass

        # CloudTrail
        try:
            ct = session.client("cloudtrail", region_name=region)
            trails = ct.describe_trails().get("trailList", [])
            results["resources"]["cloudtrail"] = len(trails)
            if not trails and region == "us-east-1":
                results["findings"].append({
                    "title": "CloudTrail is not enabled",
                    "severity": "HIGH", "category": "monitoring",
                    "resource_type": "CloudTrail", "resource_id": "none",
                    "region": region,
                    "remediation": "Enable CloudTrail for audit logging",
                })
        except ClientError:
            pass

        # GuardDuty
        try:
            gd = session.client("guardduty", region_name=region)
            detectors = gd.list_detectors().get("DetectorIds", [])
            results["resources"]["guardduty"] = len(detectors)
            if not detectors:
                results["findings"].append({
                    "title": f"GuardDuty is not enabled in {region}",
                    "severity": "MEDIUM", "category": "monitoring",
                    "resource_type": "GuardDuty", "resource_id": "none",
                    "region": region,
                    "remediation": f"Enable GuardDuty in {region} for threat detection",
                })
        except ClientError:
            pass

    except Exception as e:
        results["error"] = str(e)

    return results


def run_scan(scan_id, account_id):
    """Run a full scan in a background thread."""
    db = SessionLocal()
    try:
        scan = db.query(Scan).filter(Scan.id == scan_id).first()
        account = db.query(CloudAccount).filter(CloudAccount.id == account_id).first()
        if not scan or not account:
            return

        scan.status = "running"
        scan.started_at = utcnow()
        db.commit()

        if not HAS_BOTO3:
            scan.status = "failed"
            scan.error_message = "boto3 not installed"
            db.commit()
            return

        if not account.access_key or not account.secret_key:
            scan.status = "failed"
            scan.error_message = "No credentials configured"
            db.commit()
            return

        session = _get_boto_session(account)
        all_results = {}
        all_findings = []
        total_resources = 0

        for region in AWS_REGIONS:
            try:
                region_data = _scan_region(session, region)
                all_results[region] = region_data
                total_resources += sum(region_data.get("resources", {}).values())
                all_findings.extend(region_data.get("findings", []))
            except Exception as e:
                all_results[region] = {"error": str(e)}

        # Count severities
        critical = sum(1 for f in all_findings if f["severity"] == "CRITICAL")
        high = sum(1 for f in all_findings if f["severity"] == "HIGH")
        medium = sum(1 for f in all_findings if f["severity"] == "MEDIUM")
        low = sum(1 for f in all_findings if f["severity"] == "LOW")

        # Calculate security score
        score = max(0, 100 - (critical * 10) - (high * 3) - (medium * 1))

        # Update scan record
        scan.status = "completed"
        scan.completed_at = utcnow()
        scan.regions_scanned = len(AWS_REGIONS)
        scan.resources_found = total_resources
        scan.findings_count = len(all_findings)
        scan.critical_count = critical
        scan.high_count = high
        scan.medium_count = medium
        scan.low_count = low
        scan.security_score = score
        try:
            scan.duration_seconds = int((scan.completed_at - scan.started_at).total_seconds())
        except TypeError:
            scan.duration_seconds = 0
        scan.results = all_results

        # Store findings in DB
        for f in all_findings:
            finding = Finding(
                id=gen_id(), org_id=scan.org_id, scan_id=scan.id,
                account_name=account.name,
                title=f["title"], severity=f["severity"],
                category=f.get("category"), resource_type=f.get("resource_type"),
                resource_id=f.get("resource_id"), region=f.get("region"),
                remediation=f.get("remediation"),
                remediation_cli=f.get("remediation_cli"),
            )
            db.add(finding)

        # Update account
        account.last_scan_at = utcnow()
        account.last_scan_status = "completed"
        account.total_resources = total_resources
        account.security_score = score

        # Audit log
        db.add(AuditLog(
            id=gen_id(), org_id=scan.org_id,
            user_id=scan.triggered_by, action="scan.completed",
            resource_type="scan", resource_id=scan.id,
            details={"findings": len(all_findings), "resources": total_resources, "score": score}
        ))

        db.commit()

    except Exception as e:
        scan.status = "failed"
        scan.error_message = str(e)
        scan.completed_at = utcnow()
        db.commit()
    finally:
        db.close()


def start_scan_async(scan_id, account_id):
    """Start a scan in a background thread."""
    t = threading.Thread(target=run_scan, args=(scan_id, account_id), daemon=True)
    t.start()
    return t
