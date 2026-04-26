// Status badge colors and labels
export const STATUS_CONFIG = {
  NEW: { label: 'New', bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500' },
  FOLLOW_UP: { label: 'Follow-up', bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
  MQL: { label: 'MQL', bg: 'bg-indigo-100', text: 'text-indigo-800', dot: 'bg-indigo-500' },
  SQL: { label: 'SQL', bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-500' },
  MUQL: { label: 'MUQL', bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500' },
  QUOTED: { label: 'Quotation Sent', bg: 'bg-cyan-100', text: 'text-cyan-800', dot: 'bg-cyan-500' },
  WON: { label: 'Won', bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
  JUNK: { label: 'Junk', bg: 'bg-gray-100', text: 'text-gray-800', dot: 'bg-gray-500' },
  'Meeting Scheduled': { label: 'Meeting Scheduled', bg: 'bg-teal-100', text: 'text-teal-800', dot: 'bg-teal-500' },
};

export const PRIORITY_CONFIG = {
  P1: { label: 'P1 - Very High', short: 'P1', color: 'text-red-600', bg: 'bg-red-50' },
  P2: { label: 'P2 - High', short: 'P2', color: 'text-orange-600', bg: 'bg-orange-50' },
  P3: { label: 'P3 - Normal', short: 'P3', color: 'text-blue-600', bg: 'bg-blue-50' },
};

export const SOURCE_CONFIG = {
  REPEAT: { label: 'Repeat', icon: '🔄' },
  INSTAGRAM: { label: 'Instagram', icon: '📸' },
  FB_ADS: { label: 'FB Ads', icon: '📘' },
  GOOGLE_ADS: { label: 'Google Ads', icon: '🔍' },
  WALK_IN: { label: 'Walk-in', icon: '🚶' },
  REFERRAL: { label: 'Referral', icon: '🤝' },
  WEBSITE_ENQUIRY: { label: 'Website Enquiry', icon: '🌐' },
  META_ADS: { label: 'Meta Ads', icon: '📱' },
};

export const DESIGNATION_CONFIG = {
  MR: { label: 'Mr.' },
  MRS: { label: 'Mrs.' },
  DR: { label: 'Dr.' },
  AR: { label: 'Ar.' },
};

export const FILE_SUBCATEGORY_CONFIG = {
  FLOOR_PLANS: { label: 'Floor Plans', icon: '📐' },
  DETAILING_FILES: { label: 'Detailing Files', icon: '📋' },
  REFERENCE_IMAGES: { label: 'Reference Images', icon: '🖼️' },
  GENERAL: { label: 'General', icon: '📁' },
};

export const ACTIVITY_CONFIG = {
  NOTE: { label: 'Note', icon: '📝', color: 'text-blue-600', bg: 'bg-blue-50' },
  CALL: { label: 'Call', icon: '📞', color: 'text-green-600', bg: 'bg-green-50' },
  MEETING: { label: 'Meeting', icon: '📅', color: 'text-purple-600', bg: 'bg-purple-50' },
  STATUS_CHANGE: { label: 'Status Change', icon: '🔄', color: 'text-orange-600', bg: 'bg-orange-50' },
  FILE_UPLOAD: { label: 'File Upload', icon: '📎', color: 'text-gray-600', bg: 'bg-gray-50' },
  QUOTATION: { label: 'Quotation', icon: '📄', color: 'text-cyan-600', bg: 'bg-cyan-50' },
  TASK: { label: 'Task', icon: '✅', color: 'text-indigo-600', bg: 'bg-indigo-50' },
};

export function formatCurrency(amount) {
  if (!amount) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return formatDateShort(dateStr);
}
