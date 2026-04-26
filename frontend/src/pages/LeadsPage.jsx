import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { GET_LEADS, CREATE_LEAD, DELETE_LEAD, SAVE_COLUMN_PREFERENCES } from '../graphql/queries';
import { useAuth } from '../context/AuthContext';
import { STATUS_CONFIG, PRIORITY_CONFIG, SOURCE_CONFIG, DESIGNATION_CONFIG, formatDate, formatCurrency } from '../utils/constants';

const STATUSES = ['NEW', 'FOLLOW_UP', 'MQL', 'SQL', 'MUQL', 'QUOTED', 'WON', 'JUNK'];
const PRIORITIES = ['P1', 'P2', 'P3'];
const SOURCES = ['REPEAT', 'INSTAGRAM', 'FB_ADS', 'GOOGLE_ADS', 'WALK_IN', 'REFERRAL', 'WEBSITE_ENQUIRY', 'META_ADS'];
const DESIGNATIONS = ['MR', 'MRS', 'DR', 'AR'];

const ALL_COLUMNS = [
  { key: 'name', label: 'Lead Name', always: true },
  { key: 'company', label: 'Company' },
  { key: 'status', label: 'Status' },
  { key: 'lastActivity', label: 'Last Activity' },
  { key: 'priority', label: 'Priority' },
  { key: 'assignedTo', label: 'Assigned To' },
  { key: 'source', label: 'Source' },
  { key: 'budget', label: 'Budget' },
  { key: 'location', label: 'Location' },
  { key: 'campaignName', label: 'Campaign' },
  { key: 'propertyInPossession', label: 'Property in Possession' },
  { key: 'currentLivingCity', label: 'Living City' },
];

const DEFAULT_COLUMNS = ['name', 'company', 'status', 'lastActivity', 'priority', 'assignedTo'];

export default function LeadsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [filters, setFilters] = useState(() => {
    try { const s = localStorage.getItem('vmcrm_lead_filters'); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const [search, setSearch] = useState(() => localStorage.getItem('vmcrm_lead_search') || '');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState(new Set());
  const [actionsOpen, setActionsOpen] = useState(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(
    () => user?.leadsColumnPreferences || DEFAULT_COLUMNS
  );

  // Sync columns from user data once loaded
  useEffect(() => {
    if (user?.leadsColumnPreferences) {
      setVisibleColumns(user.leadsColumnPreferences);
    }
  }, [user?.leadsColumnPreferences]);

  // Persist filters and search to localStorage
  useEffect(() => {
    localStorage.setItem('vmcrm_lead_filters', JSON.stringify(filters));
  }, [filters]);
  useEffect(() => {
    localStorage.setItem('vmcrm_lead_search', search);
  }, [search]);

  const { data, loading, refetch } = useQuery(GET_LEADS, {
    variables: {
      filters: { ...filters, search: search || undefined },
      limit: 200,
      offset: 0,
      sortBy: 'created_at',
      sortOrder: 'DESC',
    },
  });

  const [deleteLead] = useMutation(DELETE_LEAD, {
    onCompleted: () => { refetch(); enqueueSnackbar('Lead deleted', { variant: 'success' }); },
    onError: (err) => { enqueueSnackbar(err.message || 'Failed to delete lead', { variant: 'error' }); },
  });

  const [saveColumnPrefs] = useMutation(SAVE_COLUMN_PREFERENCES);

  const leads = data?.leads?.leads || [];
  const totalCount = data?.leads?.totalCount || 0;

  const toggleSelect = (id) => {
    const next = new Set(selectedLeads);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedLeads(next);
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leads.map((l) => l.id)));
    }
  };

  const toggleColumn = (key) => {
    const col = ALL_COLUMNS.find(c => c.key === key);
    if (col?.always) return;
    const next = visibleColumns.includes(key)
      ? visibleColumns.filter(c => c !== key)
      : [...visibleColumns, key];
    setVisibleColumns(next);
    saveColumnPrefs({ variables: { columns: next } }).catch((err) => {
      enqueueSnackbar(err.message || 'Failed to save column preferences', { variant: 'error' });
    });
  };

  const activeFilterCount = Object.values(filters).filter(v => v !== undefined && v !== '' && v !== null).length;

  const clearFilters = () => {
    setFilters({});
    setSearch('');
    localStorage.removeItem('vmcrm_lead_filters');
    localStorage.removeItem('vmcrm_lead_search');
  };

  const renderCellValue = (lead, colKey) => {
    const statusCfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.NEW;
    const priorityCfg = PRIORITY_CONFIG[lead.priority] || PRIORITY_CONFIG.P3;
    switch (colKey) {
      case 'name':
        return <span className="text-sm font-medium text-gray-900">{lead.name || `${lead.firstName || ''} ${lead.lastName || ''}`.trim()}</span>;
      case 'company':
        return <span className="text-sm text-gray-600">{lead.company || '—'}</span>;
      case 'status':
        return <span className={`badge ${statusCfg.bg} ${statusCfg.text}`}>{statusCfg.label}</span>;
      case 'lastActivity':
        return <span className="text-sm text-gray-500">{formatDate(lead.updatedAt)}</span>;
      case 'priority':
        return <span className={`text-sm font-medium ${priorityCfg.color}`}>{priorityCfg.short}</span>;
      case 'assignedTo':
        return (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-xs font-medium">
              {lead.assignedTo?.name?.[0] || '?'}
            </div>
            <span className="text-sm text-gray-600">{lead.assignedTo?.name || 'Unassigned'}</span>
          </div>
        );
      case 'source':
        return <span className="text-sm text-gray-600">{SOURCE_CONFIG[lead.source]?.label || lead.source || '—'}</span>;
      case 'budget':
        return <span className="text-sm text-gray-600">{formatCurrency(lead.budget)}</span>;
      case 'location':
        return <span className="text-sm text-gray-600">{lead.location || '—'}</span>;
      case 'campaignName':
        return <span className="text-sm text-gray-600">{lead.campaignName || '—'}</span>;
      case 'propertyInPossession':
        return <span className="text-sm text-gray-600">{lead.propertyInPossession === true ? 'Yes' : lead.propertyInPossession === false ? 'No' : '—'}</span>;
      case 'currentLivingCity':
        return <span className="text-sm text-gray-600">{lead.currentLivingCity || '—'}</span>;
      default:
        return '—';
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads List</h1>
          <p className="text-sm text-gray-500 mt-1">{totalCount} total leads</p>
        </div>
        <div className="flex gap-3">
          {user?.role !== 'SALES_EXECUTIVE' && (
            <button className="btn-secondary text-sm">
              Sales Exec View
            </button>
          )}
          <button onClick={() => setShowCreateModal(true)} className="btn-primary text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Lead
          </button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, company, email..."
            className="input-field pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input-field w-auto"
          value={filters.status || ''}
          onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })}
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
          ))}
        </select>
        <select
          className="input-field w-auto"
          value={filters.priority || ''}
          onChange={(e) => setFilters({ ...filters, priority: e.target.value || undefined })}
        >
          <option value="">All Priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
          ))}
        </select>
        <select
          className="input-field w-auto"
          value={filters.source || ''}
          onChange={(e) => setFilters({ ...filters, source: e.target.value || undefined })}
        >
          <option value="">All Sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>{SOURCE_CONFIG[s].label}</option>
          ))}
        </select>
        <button
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className={`btn-secondary text-sm flex items-center gap-1 ${showAdvancedFilters ? 'ring-2 ring-primary-300' : ''}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
          </svg>
          Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
        </button>
        <div className="relative">
          <button
            onClick={() => setShowColumnPicker(!showColumnPicker)}
            className="btn-secondary text-sm flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z" />
            </svg>
            Columns
          </button>
          {showColumnPicker && (
            <div className="absolute right-0 top-10 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-56">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Toggle Columns</h4>
              {ALL_COLUMNS.map(col => (
                <label key={col.key} className="flex items-center gap-2 py-1 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={visibleColumns.includes(col.key)}
                    disabled={col.always}
                    onChange={() => toggleColumn(col.key)}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button onClick={clearFilters} className="text-sm text-red-600 hover:text-red-800">
            Clear all
          </button>
        )}
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="card p-4 mb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Budget Min (₹)</label>
              <input
                type="number"
                className="input-field"
                placeholder="Min"
                value={filters.budgetMin || ''}
                onChange={(e) => setFilters({ ...filters, budgetMin: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Budget Max (₹)</label>
              <input
                type="number"
                className="input-field"
                placeholder="Max"
                value={filters.budgetMax || ''}
                onChange={(e) => setFilters({ ...filters, budgetMax: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
              <input
                type="text"
                className="input-field"
                placeholder="Filter by location"
                value={filters.location || ''}
                onChange={(e) => setFilters({ ...filters, location: e.target.value || undefined })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">No Activity (days)</label>
              <input
                type="number"
                className="input-field"
                placeholder="e.g. 7"
                value={filters.noActivityDays || ''}
                onChange={(e) => setFilters({ ...filters, noActivityDays: e.target.value ? parseInt(e.target.value) : undefined })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Campaign Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="Filter by campaign"
                value={filters.campaignName || ''}
                onChange={(e) => setFilters({ ...filters, campaignName: e.target.value || undefined })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Campaign Active</label>
              <select
                className="input-field"
                value={filters.campaignActive === true ? 'true' : filters.campaignActive === false ? 'false' : ''}
                onChange={(e) => setFilters({ ...filters, campaignActive: e.target.value === '' ? undefined : e.target.value === 'true' })}
              >
                <option value="">Any</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Property in Possession</label>
              <select
                className="input-field"
                value={filters.propertyInPossession === true ? 'true' : filters.propertyInPossession === false ? 'false' : ''}
                onChange={(e) => setFilters({ ...filters, propertyInPossession: e.target.value === '' ? undefined : e.target.value === 'true' })}
              >
                <option value="">Any</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Created After</label>
              <input
                type="date"
                className="input-field"
                value={filters.createdAfter || ''}
                onChange={(e) => setFilters({ ...filters, createdAfter: e.target.value || undefined })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-10 p-4">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={selectedLeads.size === leads.length && leads.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              {ALL_COLUMNS.filter(c => visibleColumns.includes(c.key)).map(col => (
                <th key={col.key} className="text-left p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{col.label}</th>
              ))}
              <th className="w-12 p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="p-4"><div className="w-4 h-4 bg-gray-200 rounded" /></td>
                  {visibleColumns.map((_, j) => (
                    <td key={j} className="p-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                  ))}
                  <td className="p-4"></td>
                </tr>
              ))
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + 2} className="p-12 text-center text-gray-500">
                  No leads found. Try adjusting your filters.
                </td>
              </tr>
            ) : (
              leads.map((lead, idx) => (
                <tr
                  key={lead.id}
                  className={`hover:bg-primary-50/40 cursor-pointer transition-colors ${idx % 2 === 1 ? 'bg-gray-50/60' : ''}`}
                  onClick={() => navigate(`/leads/${lead.id}`)}
                >
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={selectedLeads.has(lead.id)}
                      onChange={() => toggleSelect(lead.id)}
                    />
                  </td>
                  {ALL_COLUMNS.filter(c => visibleColumns.includes(c.key)).map(col => (
                    <td key={col.key} className="p-4">{renderCellValue(lead, col.key)}</td>
                  ))}
                  <td className="p-4 relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setActionsOpen(actionsOpen === lead.id ? null : lead.id)}
                      className="p-1 rounded hover:bg-gray-100"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                      </svg>
                    </button>
                    {actionsOpen === lead.id && (
                      <div className="absolute right-4 top-12 z-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-40">
                        <h4 className="text-xs font-semibold text-gray-500 px-3 py-1.5 uppercase">Quick Actions</h4>
                        <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                          📞 Call
                        </button>
                        <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                          ✉️ Email
                        </button>
                        <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                          📝 Add Note
                        </button>
                        {user?.role !== 'SALES_EXECUTIVE' && (
                          <button
                            onClick={() => { deleteLead({ variables: { id: lead.id } }); setActionsOpen(null); }}
                            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            🗑️ Delete
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Lead Modal */}
      {showCreateModal && (
        <CreateLeadModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => { setShowCreateModal(false); refetch(); }}
        />
      )}
    </div>
  );
}

function CreateLeadModal({ onClose, onCreated }) {
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState({
    designation: '', firstName: '', middleName: '', lastName: '',
    company: '', email: '', phone: '',
    status: 'NEW', priority: 'P3', source: 'WEBSITE_ENQUIRY',
    budget: '', location: '', deliveryDays: '',
    campaignName: '', campaignActive: true,
    propertyInPossession: false, expectedHandoverMonth: '', expectedHandoverYear: '',
    currentLivingArea: '', currentLivingCity: '', currentLivingCountry: '',
  });

  const [createLead, { loading }] = useMutation(CREATE_LEAD);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createLead({
        variables: {
          input: {
            ...form,
            budget: form.budget ? parseFloat(form.budget) : undefined,
            deliveryDays: form.deliveryDays ? parseInt(form.deliveryDays) : undefined,
            expectedHandoverMonth: form.expectedHandoverMonth || undefined,
            expectedHandoverYear: form.expectedHandoverYear ? parseInt(form.expectedHandoverYear) : undefined,
            designation: form.designation || undefined,
            campaignName: form.campaignName || undefined,
            currentLivingArea: form.currentLivingArea || undefined,
            currentLivingCity: form.currentLivingCity || undefined,
            currentLivingCountry: form.currentLivingCountry || undefined,
          },
        },
      });
      onCreated();
      enqueueSnackbar('Lead created', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err.message || 'Failed to create lead', { variant: 'error' });
    }
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const setBool = (key) => (e) => setForm({ ...form, [key]: e.target.checked });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Create New Lead</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name Section */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <select className="input-field" value={form.designation} onChange={set('designation')}>
                <option value="">--</option>
                {DESIGNATIONS.map((d) => <option key={d} value={d}>{DESIGNATION_CONFIG[d].label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input className="input-field" required value={form.firstName} onChange={set('firstName')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
              <input className="input-field" value={form.middleName} onChange={set('middleName')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input className="input-field" value={form.lastName} onChange={set('lastName')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <input className="input-field" value={form.company} onChange={set('company')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input className="input-field" value={form.phone} onChange={set('phone')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input className="input-field" type="email" value={form.email} onChange={set('email')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input className="input-field" value={form.location} onChange={set('location')} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select className="input-field" value={form.priority} onChange={set('priority')}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <select className="input-field" value={form.source} onChange={set('source')}>
                {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_CONFIG[s].label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select className="input-field" value={form.status} onChange={set('status')}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget (₹)</label>
              <input className="input-field" type="number" value={form.budget} onChange={set('budget')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery (days)</label>
              <input className="input-field" type="number" value={form.deliveryDays} onChange={set('deliveryDays')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
              <input className="input-field" value={form.campaignName} onChange={set('campaignName')} />
            </div>
          </div>
          {/* Campaign & Property */}
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" className="rounded border-gray-300" checked={form.campaignActive} onChange={setBool('campaignActive')} />
              Campaign Active
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" className="rounded border-gray-300" checked={form.propertyInPossession} onChange={setBool('propertyInPossession')} />
              Property in Possession
            </label>
          </div>
          {/* Living Location */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Living Area</label>
              <input className="input-field" value={form.currentLivingArea} onChange={set('currentLivingArea')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Living City</label>
              <input className="input-field" value={form.currentLivingCity} onChange={set('currentLivingCity')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Living Country</label>
              <input className="input-field" value={form.currentLivingCountry} onChange={set('currentLivingCountry')} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading || !form.firstName.trim()} className="btn-primary">
              {loading ? 'Creating...' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


