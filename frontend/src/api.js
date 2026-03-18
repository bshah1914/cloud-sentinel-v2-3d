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

// Health
export const getHealth = () => request('/health');

// Providers
export const getProviders = () => request('/providers');
export const validateCredentials = (providerId, credentials) =>
  request(`/providers/${providerId}/validate`, { method: 'POST', body: JSON.stringify(credentials) });
export const getProviderRegions = (providerId) => request(`/providers/${providerId}/regions`);

// Accounts (multi-cloud)
export const getAccounts = () => request('/accounts');
export const addAccount = (data) => request('/accounts', { method: 'POST', body: JSON.stringify(data) });
export const removeAccount = (id, provider = 'aws') => request(`/accounts/${id}?provider=${provider}`, { method: 'DELETE' });

// CIDRs
export const getCIDRs = () => request('/cidrs');
export const addCIDR = (data) => request('/cidrs', { method: 'POST', body: JSON.stringify(data) });
export const removeCIDR = (cidr) => request(`/cidrs/${encodeURIComponent(cidr)}`, { method: 'DELETE' });

// Dashboard (multi-cloud)
export const getDashboard = (account, provider) =>
  provider ? request(`/dashboard/${provider}/${account}`) : request(`/dashboard/${account}`);
export const getMultiCloudOverview = () => request('/overview');

// Resources (provider-specific or legacy)
export const getResources = (account, provider) =>
  provider ? request(`/${provider}/resources/${account}`) : request(`/resources/${account}`);

// IAM
export const getIAM = (account, provider) =>
  provider === 'aws' ? request(`/aws/iam/${account}`) : request(`/iam/${account}`);

// Security Groups / NSGs / Firewalls
export const getSecurityGroups = (account, provider) => {
  if (provider === 'azure') return request(`/azure/nsgs/${account}`);
  if (provider === 'gcp') return request(`/gcp/firewalls/${account}`);
  return request(`/security-groups/${account}`);
};

// Audit
export const getAuditConfig = () => request('/audit/config');
export const runAudit = (account, provider) =>
  provider ? request(`/${provider}/audit/${account}`, { method: 'POST' }) : request(`/audit/run/${account}`, { method: 'POST' });

// Scan (multi-cloud)
export const startScan = ({ accountName, provider = 'aws', credentials = {}, region = 'all',
                            awsAccessKeyId, awsSecretAccessKey, awsRegion }) =>
  request('/scan/start', {
    method: 'POST',
    body: JSON.stringify({
      account_name: accountName,
      provider,
      credentials: Object.keys(credentials).length > 0 ? credentials : undefined,
      region: region || awsRegion || 'all',
      // Legacy AWS fields
      aws_access_key_id: awsAccessKeyId || undefined,
      aws_secret_access_key: awsSecretAccessKey || undefined,
      aws_region: awsRegion || undefined,
    }),
  });
export const getScanStatus = (jobId) => request(`/scan/status/${jobId}`);
export const getScanHistory = () => request('/scan/history');

// Report Export
async function downloadFile(path, filename) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    localStorage.removeItem('cm_token');
    window.location.href = '/';
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const exportDashboard = (account, provider, format = 'pdf') =>
  downloadFile(
    `/export/dashboard/${provider}/${account}?format=${format}`,
    `dashboard-${account}-${new Date().toISOString().split('T')[0]}.${format}`
  );

export const exportAudit = (account, format = 'pdf') =>
  downloadFile(
    `/export/audit/${account}?format=${format}`,
    `audit-${account}-${new Date().toISOString().split('T')[0]}.${format}`
  );

// Users (RBAC)
export const getUsers = () => request('/users');
export const createUser = (data) => request('/users', { method: 'POST', body: JSON.stringify(data) });
export const deleteUser = (username) => request(`/users/${username}`, { method: 'DELETE' });

// AI Chat
export const aiChat = (message, history = []) =>
  request('/ai/chat', { method: 'POST', body: JSON.stringify({ message, history }) });

// Well-Architected Framework
export const getWafReport = (account) => request(`/waf/${account}`);

// Threat Detection
export const getThreats = (account) => request(`/threats/${account}`);

// Compliance Module
export const getComplianceFrameworks = () => request('/compliance/frameworks');
export const getComplianceFramework = (id) => request(`/compliance/frameworks/${id}`);
export const runComplianceScan = (account, frameworks = []) =>
  request(`/compliance/scan/${account}`, { method: 'POST', body: JSON.stringify({ frameworks }) });
export const getComplianceResults = (account) => request(`/compliance/results/${account}`);
export const getComplianceHistory = (account) => request(`/compliance/history/${account}`);
export const exportComplianceReport = (account, format = 'pdf') =>
  downloadFile(`/compliance/results/${account}/export?format=${format}`,
    `compliance-${account}-${new Date().toISOString().split('T')[0]}.${format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'pdf'}`);

// Comprehensive Report
export const getReport = (account) => request(`/report/${account}`);
export const exportReport = (account, format = 'pdf') =>
  downloadFile(
    `/report/${account}/export?format=${format}`,
    `CloudSentinel-Report-${account}-${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'pdf'}`
  );

// ── Admin (Owner) APIs ──────────────────────────────────────────
export const getAdminStats = () => request('/admin/stats');
export const getAdminClients = () => request('/admin/clients');
export const createClient = (data) => request('/admin/clients', { method: 'POST', body: JSON.stringify(data) });
export const getClient = (orgId) => request(`/admin/clients/${orgId}`);
export const updateClient = (orgId, data) => request(`/admin/clients/${orgId}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteClient = (orgId) => request(`/admin/clients/${orgId}`, { method: 'DELETE' });
export const createClientUser = (orgId, data) => request(`/admin/clients/${orgId}/users`, { method: 'POST', body: JSON.stringify(data) });
export const getClientUsers = (orgId) => request(`/admin/clients/${orgId}/users`);
export const deleteClientUser = (userId) => request(`/admin/users/${userId}`, { method: 'DELETE' });
export const getAdminActivity = () => request('/admin/activity');
export const getAdminInvoices = () => request('/admin/invoices');
export const getAdminPlans = () => request('/admin/plans');

// ── Client Self-service APIs ────────────────────────────────────
export const getClientProfile = () => request('/client/profile');
export const getClientInvoices = () => request('/client/invoices');
export const getClientActivity = () => request('/client/activity');
