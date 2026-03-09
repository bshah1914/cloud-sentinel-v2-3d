const BASE = '/api';

function getToken() {
  return localStorage.getItem('cm_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    // Token expired or invalid — clear and redirect to login
    localStorage.removeItem('cm_token');
    window.location.href = '/';
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

// Health (public)
export const getHealth = () => request('/health');

// Accounts
export const getAccounts = () => request('/accounts');
export const addAccount = (data) => request('/accounts', { method: 'POST', body: JSON.stringify(data) });
export const removeAccount = (id) => request(`/accounts/${id}`, { method: 'DELETE' });

// CIDRs
export const getCIDRs = () => request('/cidrs');
export const addCIDR = (data) => request('/cidrs', { method: 'POST', body: JSON.stringify(data) });
export const removeCIDR = (cidr) => request(`/cidrs/${encodeURIComponent(cidr)}`, { method: 'DELETE' });

// Dashboard
export const getDashboard = (account) => request(`/dashboard/${account}`);

// Resources
export const getResources = (account) => request(`/resources/${account}`);

// IAM
export const getIAM = (account) => request(`/iam/${account}`);

// Security Groups
export const getSecurityGroups = (account) => request(`/security-groups/${account}`);

// Audit
export const getAuditConfig = () => request('/audit/config');
export const runAudit = (account) => request(`/audit/run/${account}`, { method: 'POST' });

// Scan
export const startScan = ({ accountName, awsAccessKeyId, awsSecretAccessKey, awsRegion }) =>
  request('/scan/start', {
    method: 'POST',
    body: JSON.stringify({
      account_name: accountName,
      aws_access_key_id: awsAccessKeyId || undefined,
      aws_secret_access_key: awsSecretAccessKey || undefined,
      aws_region: awsRegion || 'us-east-1',
    }),
  });
export const getScanStatus = (jobId) => request(`/scan/status/${jobId}`);
export const getScanHistory = () => request('/scan/history');
