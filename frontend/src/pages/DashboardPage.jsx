import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useNavigate } from 'react-router-dom';
import { GET_DASHBOARD, GET_LEADS, SAVE_COLUMN_PREFERENCES } from '../graphql/queries';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, STATUS_CONFIG, PRIORITY_CONFIG, SOURCE_CONFIG, formatDate, timeAgo } from '../utils/constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

const SEVERITY_CONFIG = {
  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: '🔴', badge: 'bg-red-100 text-red-700' },
  high: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', icon: '🟠', badge: 'bg-amber-100 text-amber-700' },
  medium: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', icon: '🟡', badge: 'bg-yellow-100 text-yellow-700' },
  low: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: 'ℹ️', badge: 'bg-blue-100 text-blue-700' },
};

const SOURCE_COLORS = ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function DashboardPage() {
  const { data, loading, error } = useQuery(GET_DASHBOARD);
  const [activeTab, setActiveTab] = useState('overview');
  const [dismissedAlerts, setDismissedAlerts] = useState([]);
  const [drilldownFilter, setDrilldownFilter] = useState(null); // { label, status }

  if (loading) return <LoadingSkeleton />;
  if (error) return <div className="p-8 text-red-600">Error loading dashboard: {error.message}</div>;

  const metrics = data?.dashboardMetrics;
  if (!metrics) return null;

  const perf = metrics.performanceMetrics;
  const activeAlerts = metrics.alerts.filter((a) => !dismissedAlerts.includes(a.id));

  // If drilldown is active, show filtered leads list
  if (drilldownFilter) {
    return (
      <DrilldownLeadsList
        filter={drilldownFilter}
        onBack={() => setDrilldownFilter(null)}
      />
    );
  }

  const funnelData = metrics.pipelineStages.map((s) => ({ name: s.stage, value: s.count }));
  const teamChartData = metrics.teamPerformance.map((t) => ({
    name: t.userName.split(' ')[0],
    New: t.newCount, MQL: t.mqlCount, SQL: t.sqlCount, Quoted: t.quotedCount, Won: t.wonCount,
  }));

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'performance', label: 'Performance' },
    { id: 'alerts', label: `Alerts ${activeAlerts.length > 0 ? `(${activeAlerts.length})` : ''}` },
  ];

  const handleKPIClick = (label, status, criteriaType) => {
    if (status || criteriaType) {
      setDrilldownFilter({ label, status, criteriaType });
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Management Dashboard</h1>
        {activeAlerts.length > 0 && (
          <span className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            {activeAlerts.length} Active Alert{activeAlerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeAlerts.filter((a) => a.severity === 'critical').length > 0 && activeTab !== 'alerts' && (
        <div className="mb-6">
          {activeAlerts.filter((a) => a.severity === 'critical').map((alert) => (
            <div key={alert.id} className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg mb-2">
              <div className="flex items-center gap-3">
                <span className="text-lg">🔴</span>
                <div>
                  <p className="text-sm font-semibold text-red-800">{alert.message}</p>
                  <p className="text-xs text-red-600 mt-0.5">Critical - Requires immediate attention</p>
                </div>
              </div>
              <button onClick={() => setDismissedAlerts([...dismissedAlerts, alert.id])} className="text-red-400 hover:text-red-600"><XIcon /></button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'overview' && <OverviewTab metrics={metrics} funnelData={funnelData} teamChartData={teamChartData} perf={perf} onKPIClick={handleKPIClick} overdueTasks={metrics.overdueTasks || []} />}
      {activeTab === 'performance' && <PerformanceTab perf={perf} />}
      {activeTab === 'alerts' && <AlertsTab alerts={activeAlerts} onDismiss={(id) => setDismissedAlerts([...dismissedAlerts, id])} />}
    </div>
  );
}

/* ─── Overview Tab ─── */
function OverviewTab({ metrics, funnelData, teamChartData, perf, onKPIClick, overdueTasks }) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        <KPICard label="Total Leads" value={metrics.totalLeads} icon="📊" color="primary" onClick={() => onKPIClick('Total Leads', 'ALL')} clickable />
        <KPICard label="New Leads" value={metrics.newLeads} icon="🆕" color="blue" onClick={() => onKPIClick('New Leads', 'NEW')} clickable />
        <KPICard label="MQL" value={metrics.mqlLeads} icon="🎯" color="indigo" onClick={() => onKPIClick('MQL Leads', null, 'MQL')} clickable />
        <KPICard label="SQL" value={metrics.sqlLeads} icon="⚡" color="purple" onClick={() => onKPIClick('SQL Leads', null, 'SQL')} clickable />
        <KPICard label="Won" value={metrics.wonLeads} icon="🏆" color="green" onClick={() => onKPIClick('Won Leads', 'WON')} clickable />
        <KPICard label="Conversion" value={`${perf?.conversionRate || 0}%`} icon="📈" color="emerald" />
      </div>

      {overdueTasks.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">⏰</span>
            <h3 className="text-sm font-semibold text-red-800">Overdue Tasks ({overdueTasks.length})</h3>
          </div>
          <div className="space-y-2">
            {overdueTasks.slice(0, 5).map((task) => (
              <div key={task.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-red-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">{task.content}</p>
                  <p className="text-xs text-gray-500">
                    {task.lead && <span>{task.lead.name || [task.lead.firstName, task.lead.lastName].filter(Boolean).join(' ')} · </span>}
                    Due: {task.dueDate} · {task.user?.name}
                  </p>
                </div>
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">Overdue</span>
              </div>
            ))}
            {overdueTasks.length > 5 && (
              <p className="text-xs text-red-600 text-center">+{overdueTasks.length - 5} more overdue tasks</p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="card flex items-center justify-between">
          <div><p className="text-sm text-gray-500">Booked Orders Value</p><p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.bookedOrdersValue)}</p></div>
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-2xl">💰</div>
        </div>
        <div className="card flex items-center justify-between">
          <div><p className="text-sm text-gray-500">Average Deal Size</p><p className="text-2xl font-bold text-gray-900">{formatCurrency(perf?.avgDealSize || 0)}</p></div>
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-2xl">📐</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Pipeline</h3>
          <div className="space-y-3">
            {funnelData.map((stage, i) => {
              const maxVal = Math.max(...funnelData.map((s) => s.value), 1);
              const width = Math.max((stage.value / maxVal) * 100, 8);
              const colors = ['bg-blue-500', 'bg-indigo-500', 'bg-purple-500', 'bg-cyan-500', 'bg-green-500'];
              return (
                <div key={stage.name} className="flex items-center gap-3">
                  <div className="w-16 text-sm text-gray-600 text-right">{stage.name}</div>
                  <div className="flex-1 relative">
                    <div className={`h-9 ${colors[i]} rounded-lg flex items-center justify-end pr-3 transition-all duration-500`} style={{ width: `${width}%` }}>
                      <span className="text-white text-xs font-bold">{stage.value}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Performance (Last 30 Days)</h3>
          {teamChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={teamChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="New" fill="#3B82F6" radius={[2, 2, 0, 0]} />
                <Bar dataKey="MQL" fill="#4F46E5" radius={[2, 2, 0, 0]} />
                <Bar dataKey="SQL" fill="#7C3AED" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Quoted" fill="#06B6D4" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Won" fill="#10B981" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-64 flex items-center justify-center text-gray-400">No team data available</div>}
        </div>
      </div>
    </>
  );
}

/* ─── Performance Tab ─── */
function PerformanceTab({ perf }) {
  const [trendMode, setTrendMode] = useState('weekly');
  if (!perf) return <div className="text-gray-400 text-center py-12">No performance data available</div>;

  const weeklyData = (perf.weeklyTrend || []).map((w) => ({ ...w, label: w.week.replace(/^\d{4}-/, '') }));
  const dailyData = (perf.dailyTrend || []).map((d) => ({ ...d, label: d.day.substring(5) }));
  const trendData = trendMode === 'weekly' ? weeklyData : dailyData;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card text-center"><p className="text-sm text-gray-500">Overall Conversion Rate</p><p className="text-3xl font-bold text-primary-600 mt-1">{perf.conversionRate}%</p></div>
        <div className="card text-center"><p className="text-sm text-gray-500">Average Deal Size</p><p className="text-3xl font-bold text-green-600 mt-1">{formatCurrency(perf.avgDealSize)}</p></div>
        <div className="card text-center"><p className="text-sm text-gray-500">Total Sources</p><p className="text-3xl font-bold text-indigo-600 mt-1">{(perf.sourceBreakdown || []).length}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Trend</h3>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setTrendMode('daily')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${trendMode === 'daily' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Daily
              </button>
              <button
                onClick={() => setTrendMode('weekly')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${trendMode === 'weekly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Weekly
              </button>
            </div>
          </div>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} />
                <Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="newLeads" stroke="#3B82F6" name="New Leads" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="wonLeads" stroke="#10B981" name="Won" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="h-64 flex items-center justify-center text-gray-400">No trend data</div>}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Source Breakdown</h3>
          {(perf.sourceBreakdown || []).length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={240}>
                <PieChart>
                  <Pie data={perf.sourceBreakdown} dataKey="count" nameKey="source" cx="50%" cy="50%" outerRadius={90} innerRadius={45}>
                    {perf.sourceBreakdown.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {perf.sourceBreakdown.map((s, i) => (
                  <div key={s.source} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                      <span className="text-gray-700">{s.source.replace(/_/g, ' ')}</span>
                    </div>
                    <span className="font-medium text-gray-900">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="h-60 flex items-center justify-center text-gray-400">No source data</div>}
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Leaderboard</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase pb-3 pl-2">Rank</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase pb-3">Name</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase pb-3">Total Leads</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase pb-3">Won</th>
                <th className="text-center text-xs font-semibold text-gray-500 uppercase pb-3">Conversion</th>
                <th className="text-right text-xs font-semibold text-gray-500 uppercase pb-3 pr-2">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {(perf.teamRanking || []).map((member, i) => (
                <tr key={member.userId} className={`border-b border-gray-50 hover:bg-gray-100 ${i % 2 === 1 ? 'bg-gray-50/60' : ''}`}>
                  <td className="py-3 pl-2">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-500'}`}>{i + 1}</span>
                  </td>
                  <td className="py-3 font-medium text-gray-900">{member.userName}</td>
                  <td className="py-3 text-center text-gray-700">{member.totalLeads}</td>
                  <td className="py-3 text-center"><span className="text-green-700 font-medium">{member.wonLeads}</span></td>
                  <td className="py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${member.conversionRate >= 20 ? 'bg-green-100 text-green-700' : member.conversionRate >= 10 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{member.conversionRate}%</span>
                  </td>
                  <td className="py-3 text-right pr-2 font-medium text-gray-900">{formatCurrency(member.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Alerts Tab ─── */
function AlertsTab({ alerts, onDismiss }) {
  const sortedAlerts = [...alerts].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.severity] || 3) - (order[b.severity] || 3);
  });

  if (sortedAlerts.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">✅</div>
        <h3 className="text-lg font-semibold text-gray-900">All Clear!</h3>
        <p className="text-gray-500 text-sm mt-1">No active alerts at the moment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Active Alerts ({alerts.length})</h2>
        <div className="flex gap-2">
          {['critical', 'high', 'medium'].map((sev) => {
            const count = alerts.filter((a) => a.severity === sev).length;
            if (count === 0) return null;
            const cfg = SEVERITY_CONFIG[sev];
            return <span key={sev} className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.badge}`}>{count} {sev}</span>;
          })}
        </div>
      </div>
      {sortedAlerts.map((alert) => {
        const cfg = SEVERITY_CONFIG[alert.severity || 'medium'];
        return (
          <div key={alert.id} className={`${cfg.bg} ${cfg.border} border rounded-xl p-5 transition-all hover:shadow-sm`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <span className="text-lg mt-0.5">{cfg.icon}</span>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`text-sm font-semibold ${cfg.text}`}>{alert.message}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>{alert.severity || 'medium'}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {alert.type === 'UNATTENDED' && 'These leads have received no updates — consider re-assigning or following up.'}
                    {alert.type === 'EXCESSIVE_REVISIONS' && 'Multiple quote revisions may indicate scope issues — review with the team.'}
                    {alert.type === 'SQL_INACTIVE' && 'SQL leads without activity risk going cold — ensure timely follow-ups.'}
                    {alert.type === 'LOW_CALL_ACTIVITY' && 'Team members with low call volume may need coaching or workload rebalancing.'}
                    {alert.type === 'STUCK_P1' && 'High-priority leads stuck early in the pipeline require immediate attention.'}
                  </p>
                  {alert.count > 0 && <p className="text-xs text-gray-400 mt-2">Affecting {alert.count} {alert.leadIds?.length > 0 ? 'lead' : 'member'}{alert.count !== 1 ? 's' : ''}</p>}
                </div>
              </div>
              <button onClick={() => onDismiss(alert.id)} className="text-gray-400 hover:text-gray-600 p-1"><XIcon /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Helpers ─── */
function KPICard({ label, value, icon, color, onClick, clickable }) {
  const colorMap = {
    primary: 'bg-primary-50 text-primary-700 border-primary-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
  return (
    <div
      className={`p-4 rounded-xl border ${colorMap[color]} transition-all hover:shadow-sm ${clickable ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''}`}
      onClick={clickable ? onClick : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium opacity-80">{label}</p>
        <span className="text-lg">{icon}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {clickable && <p className="text-[10px] opacity-60 mt-1">Click to view</p>}
    </div>
  );
}

function XIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

/* ─── Drilldown Leads List ─── */
const STATUSES = ['NEW', 'FOLLOW_UP', 'MQL', 'SQL', 'MUQL', 'QUOTED', 'WON', 'JUNK'];
const PRIORITIES = ['P1', 'P2', 'P3'];
const SOURCES = ['REPEAT', 'INSTAGRAM', 'FB_ADS', 'GOOGLE_ADS', 'WALK_IN', 'REFERRAL', 'WEBSITE_ENQUIRY', 'META_ADS'];

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

function DrilldownLeadsList({ filter, onBack }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState(() => {
    // Criteria-based filtering for MQL/SQL tiles
    if (filter.criteriaType) return { matchesCriteria: filter.criteriaType };
    // Status-based filtering for other tiles
    return filter.status && filter.status !== 'ALL' ? { status: filter.status } : {};
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(
    () => user?.leadsColumnPreferences || DEFAULT_COLUMNS
  );

  useEffect(() => {
    if (user?.leadsColumnPreferences) {
      setVisibleColumns(user.leadsColumnPreferences);
    }
  }, [user?.leadsColumnPreferences]);

  const { data, loading } = useQuery(GET_LEADS, {
    variables: {
      filters: { ...filters, search: search || undefined },
      limit: 200,
      offset: 0,
      sortBy: 'created_at',
      sortOrder: 'DESC',
    },
  });

  const [saveColumnPrefs] = useMutation(SAVE_COLUMN_PREFERENCES);

  const leads = data?.leads?.leads || [];
  const totalCount = data?.leads?.totalCount || 0;

  const toggleColumn = (key) => {
    const col = ALL_COLUMNS.find(c => c.key === key);
    if (col?.always) return;
    const next = visibleColumns.includes(key)
      ? visibleColumns.filter(c => c !== key)
      : [...visibleColumns, key];
    setVisibleColumns(next);
    saveColumnPrefs({ variables: { columns: next } }).catch(() => {});
  };

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => v !== undefined && v !== '' && v !== null && k !== 'matchesCriteria' && !(k === 'status' && v === filter.status)).length;

  const clearFilters = () => {
    if (filter.criteriaType) {
      setFilters({ matchesCriteria: filter.criteriaType });
    } else {
      setFilters(filter.status && filter.status !== 'ALL' ? { status: filter.status } : {});
    }
    setSearch('');
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
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{filter.label}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{totalCount} total leads</p>
          </div>
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
        {(activeFilterCount > 0 || search) && (
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
              {ALL_COLUMNS.filter(c => visibleColumns.includes(c.key)).map(col => (
                <th key={col.key} className="text-left p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {visibleColumns.map((_, j) => (
                    <td key={j} className="p-4"><div className="h-4 bg-gray-200 rounded w-24" /></td>
                  ))}
                </tr>
              ))
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="p-12 text-center text-gray-500">
                  <div className="text-5xl mb-4">📭</div>
                  <h3 className="text-lg font-semibold text-gray-900">No leads found</h3>
                  <p className="text-gray-500 text-sm mt-1">No leads match this filter criteria.</p>
                </td>
              </tr>
            ) : (
              leads.map((lead, idx) => (
                <tr
                  key={lead.id}
                  className={`hover:bg-primary-50/40 cursor-pointer transition-colors ${idx % 2 === 1 ? 'bg-gray-50/60' : ''}`}
                  onClick={() => navigate(`/leads/${lead.id}`)}
                >
                  {ALL_COLUMNS.filter(c => visibleColumns.includes(c.key)).map(col => (
                    <td key={col.key} className="p-4">{renderCellValue(lead, col.key)}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-8 space-y-6 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-64" />
      <div className="h-10 bg-gray-200 rounded w-80" />
      <div className="grid grid-cols-6 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}</div>
      <div className="grid grid-cols-2 gap-6"><div className="h-80 bg-gray-200 rounded-xl" /><div className="h-80 bg-gray-200 rounded-xl" /></div>
    </div>
  );
}
