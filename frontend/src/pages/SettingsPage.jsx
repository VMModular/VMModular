import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import {
  GET_ALERT_SETTINGS, UPDATE_ALERT_SETTINGS,
  GET_QUALIFICATION_CRITERIA, SAVE_QUALIFICATION_CRITERIA,
  IS_CALENDAR_CONNECTED, GET_CALENDAR_AUTH_URL, DISCONNECT_CALENDAR,
} from '../graphql/queries';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('criteria');

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-sm text-gray-500 mb-1">Admin Screens</p>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        </div>
        <button onClick={() => navigate('/settings/org')} className="btn-secondary text-sm">
          Organization Structure & Roles →
        </button>
      </div>

      {/* Section tabs */}
      <div className="flex gap-4 mb-8 border-b border-gray-200">
        {[
          { id: 'criteria', label: 'MQL/SQL Criteria' },
          { id: 'alerts', label: 'Alert Configuration' },
          { id: 'integrations', label: 'Integrations' },
        ].map((tab) => (
          <button key={tab.id} onClick={() => setActiveSection(tab.id)}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeSection === tab.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeSection === 'criteria' && <CriteriaSettings />}
      {activeSection === 'alerts' && <AlertSettings />}
      {activeSection === 'integrations' && <IntegrationSettings />}
    </div>
  );
}

function CriteriaSettings() {
  const { enqueueSnackbar } = useSnackbar();
  const { data, loading, refetch } = useQuery(GET_QUALIFICATION_CRITERIA);
  const [saveCriteria] = useMutation(SAVE_QUALIFICATION_CRITERIA);

  const allCriteria = data?.qualificationCriteria || [];
  const mqlCriteria = allCriteria.filter((c) => c.type === 'MQL');
  const sqlCriteria = allCriteria.filter((c) => c.type === 'SQL');

  const [mqlRows, setMqlRows] = useState(null);
  const [sqlRows, setSqlRows] = useState(null);

  // Initialize from data
  const currentMql = mqlRows ?? mqlCriteria.map((c) => ({ field: c.field, operator: c.operator, value: c.value }));
  const currentSql = sqlRows ?? sqlCriteria.map((c) => ({ field: c.field, operator: c.operator, value: c.value }));

  const addRow = (type) => {
    const newRow = { field: '', operator: 'equals', value: '' };
    if (type === 'MQL') setMqlRows([...currentMql, newRow]);
    else setSqlRows([...currentSql, newRow]);
  };

  const updateRow = (type, index, key, val) => {
    const rows = type === 'MQL' ? [...currentMql] : [...currentSql];
    rows[index] = { ...rows[index], [key]: val };
    if (type === 'MQL') setMqlRows(rows);
    else setSqlRows(rows);
  };

  const removeRow = (type, index) => {
    const rows = type === 'MQL' ? [...currentMql] : [...currentSql];
    rows.splice(index, 1);
    if (type === 'MQL') setMqlRows(rows);
    else setSqlRows(rows);
  };

  const handleSave = async () => {
    try {
      const mqlData = currentMql.filter((r) => r.field && r.value).map((r) => ({ ...r, type: 'MQL' }));
      const sqlData = currentSql.filter((r) => r.field && r.value).map((r) => ({ ...r, type: 'SQL' }));

      // Always send both types so old criteria get deactivated even when list is empty
      await saveCriteria({ variables: { criteria: mqlData, type: 'MQL' } });
      await saveCriteria({ variables: { criteria: sqlData, type: 'SQL' } });
      refetch();
      enqueueSnackbar('Criteria saved & leads re-evaluated', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err.message || 'Failed to save criteria', { variant: 'error' });
    }
  };

  if (loading) return <div className="animate-pulse h-40 bg-gray-100 rounded-xl" />;

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-semibold text-gray-900">MQL/SQL Criteria Settings</h2>

      {/* MQL Criteria */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">MQL Criteria</h3>
        <CriteriaTable rows={currentMql} type="MQL" onUpdate={updateRow} onRemove={removeRow} />
        <button onClick={() => addRow('MQL')} className="text-sm text-primary-600 font-medium mt-3 hover:underline">
          + Add Rule
        </button>
      </div>

      {/* SQL Criteria */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">SQL Criteria</h3>
        <CriteriaTable rows={currentSql} type="SQL" onUpdate={updateRow} onRemove={removeRow} />
        <button onClick={() => addRow('SQL')} className="text-sm text-primary-600 font-medium mt-3 hover:underline">
          + Add Rule
        </button>
      </div>

      <button onClick={handleSave} className="btn-primary">Save Criteria</button>
    </div>
  );
}

function CriteriaTable({ rows, type, onUpdate, onRemove }) {
  const fields = [
    { value: 'budget', label: 'Budget' },
    { value: 'location', label: 'Location' },
    { value: 'source', label: 'Source' },
    { value: 'priority', label: 'Priority' },
    { value: 'company', label: 'Company' },
    { value: 'delivery_days', label: 'Delivery Days' },
    { value: 'campaign_name', label: 'Campaign Name' },
    { value: 'campaign_active', label: 'Campaign Active' },
    { value: 'property_in_possession', label: 'Property in Possession' },
    { value: 'current_living_city', label: 'Living City' },
    { value: 'current_living_country', label: 'Living Country' },
  ];

  const operators = [
    { value: 'equals', label: '=' },
    { value: 'not_equals', label: '≠' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'greater_than_or_equal', label: 'Greater than or equal (≥)' },
    { value: 'less_than', label: 'Less than' },
    { value: 'less_than_or_equal', label: 'Less than or equal (≤)' },
    { value: 'contains', label: 'Contains' },
  ];

  return (
    <table className="w-full">
      <thead>
        <tr>
          <th className="text-left text-xs font-semibold text-gray-500 uppercase pb-2 w-1/3">Field</th>
          <th className="text-left text-xs font-semibold text-gray-500 uppercase pb-2 w-1/4">Operator</th>
          <th className="text-left text-xs font-semibold text-gray-500 uppercase pb-2 w-1/3">Value</th>
          <th className="w-10"></th>
        </tr>
      </thead>
      <tbody className="space-y-2">
        {rows.map((row, i) => (
          <tr key={i} className={`border-t border-gray-100 ${i % 2 === 1 ? 'bg-gray-50/60' : ''}`}>
            <td className="py-2 pr-2">
              <select
                className="input-field"
                value={row.field}
                onChange={(e) => onUpdate(type, i, 'field', e.target.value)}
              >
                <option value="">Select field</option>
                {fields.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </td>
            <td className="py-2 pr-2">
              <select
                className="input-field"
                value={row.operator}
                onChange={(e) => onUpdate(type, i, 'operator', e.target.value)}
              >
                {operators.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </td>
            <td className="py-2 pr-2">
              <input
                className="input-field"
                placeholder="Value"
                value={row.value}
                onChange={(e) => onUpdate(type, i, 'value', e.target.value)}
              />
            </td>
            <td className="py-2">
              <button
                onClick={() => onRemove(type, i)}
                className="text-red-400 hover:text-red-600 p-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AlertSettings() {
  const { enqueueSnackbar } = useSnackbar();
  const { data, loading, refetch } = useQuery(GET_ALERT_SETTINGS);
  const [updateSettings] = useMutation(UPDATE_ALERT_SETTINGS);

  const settings = data?.alertSettings || [];

  const getVal = (key) => settings.find((s) => s.settingKey === key)?.settingValue || '';

  const [formValues, setFormValues] = useState(null);

  const currentValues = formValues ?? {
    unattended_leads_days: getVal('unattended_leads_days') || '3',
    max_quote_revisions: getVal('max_quote_revisions') || '3',
    sql_lead_inactive_days: getVal('sql_lead_inactive_days') || '5',
    min_calls_threshold: getVal('min_calls_threshold') || '3',
  };

  const set = (key) => (e) => setFormValues({ ...currentValues, [key]: e.target.value });

  const handleSave = async () => {
    try {
      const settingsArr = Object.entries(currentValues).map(([settingKey, settingValue]) => ({
        settingKey,
        settingValue: String(settingValue),
      }));
      await updateSettings({ variables: { settings: settingsArr } });
      refetch();
      enqueueSnackbar('Alert settings saved', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err.message || 'Failed to save alert settings', { variant: 'error' });
    }
  };

  if (loading) return <div className="animate-pulse h-40 bg-gray-100 rounded-xl" />;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Alerts Configuration</h2>
      <div className="card space-y-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 w-64">Unattended Leads Alert (Days):</label>
          <input
            type="number"
            className="input-field w-24"
            value={currentValues.unattended_leads_days}
            onChange={set('unattended_leads_days')}
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 w-64">Leads with More Than N Quote Revisions:</label>
          <input
            type="number"
            className="input-field w-24"
            value={currentValues.max_quote_revisions}
            onChange={set('max_quote_revisions')}
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 w-64">No Activity on SQL Lead for (Days):</label>
          <input
            type="number"
            className="input-field w-24"
            value={currentValues.sql_lead_inactive_days}
            onChange={set('sql_lead_inactive_days')}
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 w-64">Minimum Calls Threshold:</label>
          <input
            type="number"
            className="input-field w-24"
            value={currentValues.min_calls_threshold}
            onChange={set('min_calls_threshold')}
          />
        </div>
      </div>
      <button onClick={handleSave} className="btn-primary">Save Alert Settings</button>
    </div>
  );
}

function IntegrationSettings() {
  const { enqueueSnackbar } = useSnackbar();
  const { data: connData, loading: connLoading, refetch: refetchConn } = useQuery(IS_CALENDAR_CONNECTED);
  const { data: authData, loading: authLoading } = useQuery(GET_CALENDAR_AUTH_URL, { skip: connData?.isCalendarConnected });
  const [disconnectCalendar, { loading: disconnecting }] = useMutation(DISCONNECT_CALENDAR);

  const isConnected = connData?.isCalendarConnected;

  const handleConnect = () => {
    if (authData?.calendarAuthUrl?.url) {
      window.location.href = authData.calendarAuthUrl.url;
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Google Calendar? Existing synced events will remain.')) return;
    try {
      await disconnectCalendar();
      refetchConn();
      enqueueSnackbar('Google Calendar disconnected', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err.message || 'Failed to disconnect calendar', { variant: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Integrations</h2>

      {/* Google Calendar */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white border border-gray-200 rounded-xl flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-7 h-7">
                <path d="M19.5 3h-3V1.5H15V3H9V1.5H7.5V3h-3C3.675 3 3 3.675 3 4.5v15c0 .825.675 1.5 1.5 1.5h15c.825 0 1.5-.675 1.5-1.5v-15c0-.825-.675-1.5-1.5-1.5z" fill="#4285F4" />
                <path d="M19.5 19.5h-15V8.25h15V19.5z" fill="#fff" />
                <rect x="6.75" y="10.5" width="3" height="2.25" fill="#EA4335" />
                <rect x="10.5" y="10.5" width="3" height="2.25" fill="#FBBC04" />
                <rect x="14.25" y="10.5" width="3" height="2.25" fill="#34A853" />
                <rect x="6.75" y="13.5" width="3" height="2.25" fill="#4285F4" />
                <rect x="10.5" y="13.5" width="3" height="2.25" fill="#EA4335" />
                <rect x="14.25" y="13.5" width="3" height="2.25" fill="#FBBC04" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Google Calendar & Meet</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Sync meetings, schedule calls, and auto-generate Google Meet links for leads.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {connLoading || authLoading ? (
              <div className="w-24 h-9 bg-gray-200 rounded-lg animate-pulse" />
            ) : isConnected ? (
              <>
                <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 bg-green-500 rounded-full" /> Connected
                </span>
                <button onClick={handleDisconnect} disabled={disconnecting}
                  className="text-xs text-red-600 hover:text-red-800 font-medium px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50">
                  {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </>
            ) : (
              <button onClick={handleConnect}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path d="M12 23c2.97 0 5.46-.99 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Connect Google Calendar
              </button>
            )}
          </div>
        </div>

        {isConnected && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Your Google Calendar is connected. You can schedule meetings with leads from the Calendar page and auto-generate Google Meet links.
            </p>
          </div>
        )}
      </div>

      {/* Placeholder for future integrations */}
      <div className="card opacity-60">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-100 border border-gray-200 rounded-xl flex items-center justify-center text-2xl">📧</div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Email Integration</h3>
            <p className="text-xs text-gray-500 mt-0.5">Coming soon — sync emails with leads and track communication history.</p>
          </div>
          <span className="ml-auto text-xs text-gray-400 font-medium bg-gray-100 px-3 py-1 rounded-full">Coming Soon</span>
        </div>
      </div>
    </div>
  );
}
