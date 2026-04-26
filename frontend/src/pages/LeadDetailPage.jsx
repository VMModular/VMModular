import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { useSnackbar } from 'notistack';
import { GET_LEAD, UPDATE_LEAD, CREATE_ACTIVITY, CREATE_QUOTATION, UPLOAD_FILE, DELETE_FILE, COMPLETE_TASK, CREATE_CALENDAR_EVENT } from '../graphql/queries';
import { STATUS_CONFIG, PRIORITY_CONFIG, SOURCE_CONFIG, ACTIVITY_CONFIG, DESIGNATION_CONFIG, FILE_SUBCATEGORY_CONFIG, formatCurrency, formatDate, timeAgo } from '../utils/constants';

const STATUSES = ['NEW', 'FOLLOW_UP', 'MQL', 'SQL', 'MUQL', 'QUOTED', 'WON', 'JUNK'];
const PRIORITIES = ['P1', 'P2', 'P3'];
const DESIGNATIONS = ['MR', 'MRS', 'DR', 'AR'];
const FILE_SUBCATEGORIES = ['FLOOR_PLANS', 'DETAILING_FILES', 'REFERENCE_IMAGES', 'GENERAL'];

export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('activity');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [editing, setEditing] = useState(false);

  const { data, loading, refetch } = useQuery(GET_LEAD, { variables: { id } });
  const { enqueueSnackbar } = useSnackbar();
  const [updateLead] = useMutation(UPDATE_LEAD);
  const [createActivity] = useMutation(CREATE_ACTIVITY);
  const [createQuotation] = useMutation(CREATE_QUOTATION);
  const [uploadFile] = useMutation(UPLOAD_FILE);
  const [deleteFile] = useMutation(DELETE_FILE);
  const [completeTask] = useMutation(COMPLETE_TASK);
  const [createCalendarEvent] = useMutation(CREATE_CALENDAR_EVENT);

  if (loading) return <LoadingSkeleton />;
  const lead = data?.lead;
  if (!lead) return <div className="p-8 text-red-600">Lead not found</div>;

  const statusCfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.NEW;
  const priorityCfg = PRIORITY_CONFIG[lead.priority] || PRIORITY_CONFIG.P3;

  const handleStatusChange = async (newStatus) => {
    try {
      await updateLead({ variables: { id, input: { status: newStatus } } });
      refetch();
      enqueueSnackbar('Status updated', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err.message || 'Failed to update status', { variant: 'error' });
    }
  };

  const handleAddNote = async (content) => {
    try {
      await createActivity({ variables: { input: { leadId: id, type: 'NOTE', content } } });
      setShowNoteModal(false);
      refetch();
      enqueueSnackbar('Note added', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err.message || 'Failed to add note', { variant: 'error' });
    }
  };

  const handleLogCall = async (content) => {
    try {
      await createActivity({ variables: { input: { leadId: id, type: 'CALL', content } } });
      setShowCallModal(false);
      refetch();
      enqueueSnackbar('Call logged', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err.message || 'Failed to log call', { variant: 'error' });
    }
  };

  const handleAddTask = async ({ content, dueDate, notes }) => {
    try {
      const metadata = {};
      if (notes) metadata.notes = notes;
      await createActivity({
        variables: { input: { leadId: id, type: 'TASK', content, dueDate, metadata } },
      });
      setShowTaskModal(false);
      refetch();
      enqueueSnackbar('Task created', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err.message || 'Failed to create task', { variant: 'error' });
    }
  };

  const handleScheduleMeeting = async ({ title, description, startTime, endTime, addMeetLink }) => {
    try {
      await createCalendarEvent({
        variables: {
          input: {
            leadId: id,
            title,
            description,
            startTime,
            endTime,
            attendees: lead.email ? [lead.email] : [],
            addMeetLink,
          },
        },
      });
      setShowMeetingModal(false);
      refetch();
      enqueueSnackbar('Meeting scheduled', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err.message || 'Failed to schedule meeting', { variant: 'error' });
    }
  };

  const handleAddQuotation = async ({ amount, fileUrl, status }) => {
    try {
      await createQuotation({
        variables: { input: { leadId: id, amount: parseFloat(amount), fileUrl: fileUrl || undefined, status: status || 'DRAFT' } },
      });
      setShowQuotationModal(false);
      refetch();
      enqueueSnackbar('Quotation added', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err.message || 'Failed to add quotation', { variant: 'error' });
    }
  };

  const handleCompleteTask = async (activityId) => {
    try {
      await completeTask({ variables: { activityId } });
      refetch();
      enqueueSnackbar('Task marked complete', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err.message || 'Failed to complete task', { variant: 'error' });
    }
  };

  const displayName = lead.name || [lead.firstName, lead.middleName, lead.lastName].filter(Boolean).join(' ');
  const designationLabel = lead.designation ? (DESIGNATION_CONFIG[lead.designation]?.label || lead.designation) + ' ' : '';

  const tabs = [
    { key: 'activity', label: 'Activity History' },
    { key: 'quotations', label: 'Quotations' },
    { key: 'files', label: 'Files' },
    { key: 'details', label: 'Lead Details' },
  ];

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <button onClick={() => navigate('/leads')} className="hover:text-primary-600">Leads</button>
        <span>/</span>
        <span className="text-gray-900">{displayName}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{designationLabel}{displayName}</h1>
            <span className="text-gray-400">—</span>
            <span className="text-lg text-gray-600">{lead.company || 'No company'}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className={`badge ${statusCfg.bg} ${statusCfg.text}`}>{statusCfg.label}</span>
            <span className={`font-medium ${priorityCfg.color}`}>{priorityCfg.label}</span>
            {lead.source && (
              <span className="text-gray-500">
                {SOURCE_CONFIG[lead.source]?.icon} {SOURCE_CONFIG[lead.source]?.label}
              </span>
            )}
            {lead.campaignName && (
              <span className="text-gray-500">
                🎯 {lead.campaignName} {lead.campaignActive ? '(Active)' : '(Inactive)'}
              </span>
            )}
          </div>
        </div>

        {/* Status dropdown */}
        <div className="flex items-center gap-2">
          <select
            value={lead.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="input-field w-auto text-sm"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
            ))}
          </select>
          <select
            value={lead.priority}
            onChange={async (e) => {
              try {
                await updateLead({ variables: { id, input: { priority: e.target.value } } });
                refetch();
                enqueueSnackbar('Priority updated', { variant: 'success' });
              } catch (err) {
                enqueueSnackbar(err.message || 'Failed to update priority', { variant: 'error' });
              }
            }}
            className="input-field w-auto text-sm"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Actions + Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Action Buttons */}
          <div className="flex gap-3">
            <button onClick={() => setShowCallModal(true)} className="btn-primary text-sm flex items-center gap-2">
              📞 Log Call
            </button>
            <button onClick={() => setShowMeetingModal(true)} className="btn-secondary text-sm flex items-center gap-2">
              📅 Schedule Meeting
            </button>
            <button onClick={() => setShowTaskModal(true)} className="btn-secondary text-sm flex items-center gap-2">
              ✅ Add Task
            </button>
            <button onClick={() => { setActiveTab('files'); }} className="btn-secondary text-sm flex items-center gap-2">
              📎 Upload File
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex gap-6">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'activity' && (
            <ActivityTimeline activities={lead.activities || []} onCompleteTask={handleCompleteTask} />
          )}

          {activeTab === 'quotations' && (
            <QuotationsTab
              quotations={lead.quotations || []}
              onAddQuotation={() => setShowQuotationModal(true)}
            />
          )}

          {activeTab === 'details' && (
            <LeadDetailsTab lead={lead} onSave={async (input) => {
              try {
                await updateLead({ variables: { id, input } });
                refetch();
                enqueueSnackbar('Lead details saved', { variant: 'success' });
              } catch (err) {
                enqueueSnackbar(err.message || 'Failed to save lead details', { variant: 'error' });
              }
            }} />
          )
          }

          {activeTab === 'files' && (
            <FilesTab
              files={lead.files || []}
              leadId={id}
              onUpload={async (input) => {
                try {
                  await uploadFile({ variables: { input: { ...input, leadId: id } } });
                  refetch();
                } catch (err) {
                  enqueueSnackbar(err.message || 'Failed to upload file', { variant: 'error' });
                  throw err;
                }
              }}
              onDelete={async (fileId) => {
                try {
                  await deleteFile({ variables: { id: fileId } });
                  refetch();
                  enqueueSnackbar('File deleted', { variant: 'success' });
                } catch (err) {
                  enqueueSnackbar(err.message || 'Failed to delete file', { variant: 'error' });
                }
              }}
            />
          )}
        </div>

        {/* Right: Lead Info Card */}
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Lead Details</h3>
            <dl className="space-y-3">
              <InfoRow label="Budget" value={formatCurrency(lead.budget)} />
              <InfoRow label="Location" value={lead.location} />
              <InfoRow label="Delivery" value={lead.deliveryDays ? `${lead.deliveryDays} Days` : '—'} />
              <InfoRow label="Email" value={lead.email} />
              <InfoRow label="Phone" value={lead.phone} />
              <InfoRow label="Assigned To" value={lead.assignedTo?.name} />
              <InfoRow label="Created" value={formatDate(lead.createdAt)} />
              {lead.propertyInPossession !== null && lead.propertyInPossession !== undefined && (
                <InfoRow label="Property in Possession" value={lead.propertyInPossession ? 'Yes' : 'No'} />
              )}
              {(lead.expectedHandoverMonth || lead.expectedHandoverYear) && (
                <InfoRow label="Expected Handover" value={`${lead.expectedHandoverMonth || ''} ${lead.expectedHandoverYear || ''}`} />
              )}
              {(lead.currentLivingCity || lead.currentLivingArea) && (
                <InfoRow label="Living Location" value={[lead.currentLivingArea, lead.currentLivingCity, lead.currentLivingCountry].filter(Boolean).join(', ')} />
              )}
            </dl>
          </div>

          {/* Additional Contacts */}
          {lead.contacts && lead.contacts.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Additional Contacts</h3>
              <div className="space-y-3">
                {lead.contacts.map((c) => (
                  <div key={c.id} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-900">{c.name || 'Unnamed'} {c.relationship && <span className="text-gray-500 font-normal">({c.relationship})</span>}</p>
                    {c.phone && <p className="text-xs text-gray-600 mt-1">📞 {c.phone}</p>}
                    {c.email && <p className="text-xs text-gray-600">✉️ {c.email}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick files preview */}
          {lead.files?.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Files</h3>
              <div className="space-y-2">
                {lead.files.slice(0, 5).map((f) => (
                  <div key={f.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                    <span className="text-lg">📄</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{f.fileName}</p>
                      <p className="text-xs text-gray-500">{FILE_SUBCATEGORY_CONFIG[f.subCategory]?.label || 'General'} · {formatDate(f.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showNoteModal && (
        <TextInputModal title="Add Note" placeholder="Type your note..." onSubmit={handleAddNote} onClose={() => setShowNoteModal(false)} />
      )}
      {showCallModal && (
        <TextInputModal title="Log Call" placeholder="Call notes..." onSubmit={handleLogCall} onClose={() => setShowCallModal(false)} />
      )}
      {showQuotationModal && (
        <QuotationModal
          existingCount={(lead.quotations || []).length}
          onSubmit={handleAddQuotation}
          onClose={() => setShowQuotationModal(false)}
        />
      )}
      {showTaskModal && (
        <TaskModal onSubmit={handleAddTask} onClose={() => setShowTaskModal(false)} />
      )}
      {showMeetingModal && (
        <MeetingModal
          lead={lead}
          onSubmit={handleScheduleMeeting}
          onClose={() => setShowMeetingModal(false)}
        />
      )}
    </div>
  );
}

function ActivityTimeline({ activities, onCompleteTask }) {
  if (activities.length === 0) {
    return <div className="text-center py-12 text-gray-400">No activity yet</div>;
  }

  return (
    <div className="space-y-1">
      {activities.map((activity, i) => {
        const cfg = ACTIVITY_CONFIG[activity.type] || ACTIVITY_CONFIG.NOTE;
        const isTask = activity.type === 'TASK';
        const isOverdue = activity.isOverdue;
        const isCompleted = activity.isCompleted;
        return (
          <div key={activity.id} className={`flex gap-4 py-4 ${isOverdue ? 'bg-red-50 -mx-4 px-4 rounded-lg border border-red-200' : ''}`}>
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full ${isOverdue ? 'bg-red-100' : isCompleted ? 'bg-green-100' : cfg.bg} flex items-center justify-center text-lg`}>
                {isOverdue ? '⚠️' : isCompleted ? '✅' : cfg.icon}
              </div>
              {i < activities.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 mt-2" />}
            </div>
            <div className="flex-1 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-sm font-medium ${isOverdue ? 'text-red-600' : cfg.color}`}>{cfg.label}</span>
                {isOverdue && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">Overdue</span>
                )}
                {isTask && isCompleted && (
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">Completed</span>
                )}
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-500">{timeAgo(activity.createdAt)}</span>
              </div>
              <p className={`text-sm ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{activity.content}</p>
              {isTask && activity.dueDate && (
                <p className={`text-xs mt-1 ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                  Due: {activity.dueDate}
                </p>
              )}
              <div className="flex items-center gap-3 mt-1">
                {activity.user && (
                  <p className="text-xs text-gray-400">by {activity.user.name}</p>
                )}
                {isTask && !isCompleted && onCompleteTask && (
                  <button
                    onClick={() => onCompleteTask(activity.id)}
                    className="text-xs text-green-600 hover:text-green-800 font-medium"
                  >
                    Mark Complete
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QuotationsTab({ quotations, onAddQuotation }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Quotations ({quotations.length})</h3>
        <button onClick={onAddQuotation} className="btn-primary text-sm">
          + Add Quotation
        </button>
      </div>
      {quotations.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No quotations yet</div>
      ) : (
        <div className="space-y-3">
          {quotations.map((q) => (
            <div key={q.id} className="card flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    v{q.version} — {q.version === 1 ? 'Initial Quotation' : `Revised Quotation`}
                  </span>
                  <span className={`badge ${q.status === 'SENT' ? 'bg-blue-100 text-blue-800' : q.status === 'ACCEPTED' ? 'bg-green-100 text-green-800' : q.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                    {q.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {formatCurrency(q.amount)} · {formatDate(q.createdAt)}
                  {q.createdBy && <span> · by {q.createdBy.name}</span>}
                </p>
              </div>
              {q.fileUrl && (
                <a href={q.fileUrl} className="text-primary-600 text-sm font-medium hover:underline" target="_blank" rel="noopener noreferrer">
                  📄 View Document
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LeadDetailsTab({ lead, onSave }) {
  const [form, setForm] = useState({
    designation: lead.designation || '',
    firstName: lead.firstName || '',
    middleName: lead.middleName || '',
    lastName: lead.lastName || '',
    company: lead.company || '',
    email: lead.email || '',
    phone: lead.phone || '',
    budget: lead.budget || '',
    location: lead.location || '',
    deliveryDays: lead.deliveryDays || '',
    notes: lead.notes || '',
    campaignName: lead.campaignName || '',
    campaignActive: lead.campaignActive ?? true,
    propertyInPossession: lead.propertyInPossession ?? false,
    expectedHandoverMonth: lead.expectedHandoverMonth || '',
    expectedHandoverYear: lead.expectedHandoverYear || '',
    currentLivingArea: lead.currentLivingArea || '',
    currentLivingCity: lead.currentLivingCity || '',
    currentLivingCountry: lead.currentLivingCountry || '',
    contacts: lead.contacts ? lead.contacts.map(c => ({ ...c })) : [],
  });

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const setBool = (key) => (e) => setForm({ ...form, [key]: e.target.checked });

  const updateContact = (idx, field, value) => {
    const updated = [...form.contacts];
    updated[idx] = { ...updated[idx], [field]: value };
    setForm({ ...form, contacts: updated });
  };

  const addContact = () => {
    if (form.contacts.length >= 2) return;
    setForm({
      ...form,
      contacts: [...form.contacts, { contactOrder: form.contacts.length + 2, name: '', phone: '', email: '', relationship: '' }],
    });
  };

  const removeContact = (idx) => {
    const updated = form.contacts.filter((_, i) => i !== idx);
    setForm({ ...form, contacts: updated });
  };

  const handleSave = () => {
    const input = {
      designation: form.designation || undefined,
      firstName: form.firstName,
      middleName: form.middleName || undefined,
      lastName: form.lastName || undefined,
      company: form.company,
      email: form.email,
      phone: form.phone,
      budget: form.budget ? parseFloat(form.budget) : undefined,
      location: form.location,
      deliveryDays: form.deliveryDays ? parseInt(form.deliveryDays) : undefined,
      notes: form.notes,
      campaignName: form.campaignName || undefined,
      campaignActive: form.campaignActive,
      propertyInPossession: form.propertyInPossession,
      expectedHandoverMonth: form.expectedHandoverMonth || undefined,
      expectedHandoverYear: form.expectedHandoverYear ? parseInt(form.expectedHandoverYear) : undefined,
      currentLivingArea: form.currentLivingArea || undefined,
      currentLivingCity: form.currentLivingCity || undefined,
      currentLivingCountry: form.currentLivingCountry || undefined,
      contacts: form.contacts.map((c, i) => ({
        contactOrder: c.contactOrder || i + 2,
        name: c.name,
        phone: c.phone,
        email: c.email,
        relationship: c.relationship,
      })),
    };
    onSave(input);
  };

  return (
    <div className="space-y-6">
      {/* Name Section */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Personal Information</h4>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <select className="input-field" value={form.designation} onChange={set('designation')}>
              <option value="">--</option>
              {DESIGNATIONS.map((d) => <option key={d} value={d}>{DESIGNATION_CONFIG[d].label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input className="input-field" value={form.firstName} onChange={set('firstName')} />
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
          <input className="input-field" value={form.email} onChange={set('email')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <input className="input-field" value={form.location} onChange={set('location')} />
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

      {/* Property Handover */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Property Information</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expected Handover Month</label>
            <input className="input-field" placeholder="e.g. March" value={form.expectedHandoverMonth} onChange={set('expectedHandoverMonth')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expected Handover Year</label>
            <input className="input-field" type="number" placeholder="e.g. 2025" value={form.expectedHandoverYear} onChange={set('expectedHandoverYear')} />
          </div>
        </div>
      </div>

      {/* Current Living Location */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Current Living Location</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
            <input className="input-field" value={form.currentLivingArea} onChange={set('currentLivingArea')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input className="input-field" value={form.currentLivingCity} onChange={set('currentLivingCity')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <input className="input-field" value={form.currentLivingCountry} onChange={set('currentLivingCountry')} />
          </div>
        </div>
      </div>

      {/* Additional Contacts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-700">Additional Contacts</h4>
          {form.contacts.length < 2 && (
            <button type="button" onClick={addContact} className="text-sm text-primary-600 hover:text-primary-800">+ Add Contact</button>
          )}
        </div>
        {form.contacts.map((c, i) => (
          <div key={i} className="p-4 border border-gray-200 rounded-lg mb-3">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700">Contact #{c.contactOrder || i + 2}</span>
              <button type="button" onClick={() => removeContact(i)} className="text-sm text-red-600 hover:text-red-800">Remove</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name</label>
                <input className="input-field" value={c.name || ''} onChange={(e) => updateContact(i, 'name', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone</label>
                <input className="input-field" value={c.phone || ''} onChange={(e) => updateContact(i, 'phone', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email</label>
                <input className="input-field" value={c.email || ''} onChange={(e) => updateContact(i, 'email', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Relationship</label>
                <input className="input-field" placeholder="e.g. Spouse, Parent" value={c.relationship || ''} onChange={(e) => updateContact(i, 'relationship', e.target.value)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea className="input-field" rows={4} value={form.notes} onChange={set('notes')} />
      </div>
      <div className="flex justify-end">
        <button onClick={handleSave} className="btn-primary">Save Changes</button>
      </div>
    </div>
  );
}

function FilesTab({ files, leadId, onUpload, onDelete }) {
  const { enqueueSnackbar } = useSnackbar();
  const [activeSubCat, setActiveSubCat] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  const [selectedSubCategory, setSelectedSubCategory] = useState('GENERAL');

  const filteredFiles = activeSubCat ? files.filter(f => f.subCategory === activeSubCat) : files;

  const handleFileSelect = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    let successCount = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const fileUrl = URL.createObjectURL(file);

      try {
        await onUpload({
          fileName: file.name,
          fileUrl: fileUrl,
          fileType: file.type,
          fileSize: file.size,
          subCategory: selectedSubCategory,
        });
        successCount++;
      } catch {
        // error already shown by parent
      }

      setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
    }

    setUploading(false);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (successCount > 0) enqueueSnackbar(`${successCount} file${successCount > 1 ? 's' : ''} uploaded`, { variant: 'success' });
  };

  const triggerFileUpload = (subCat) => {
    setSelectedSubCategory(subCat || activeSubCat || 'GENERAL');
    fileInputRef.current?.click();
  };

  const ACCEPTED_TYPES = '.pdf,.png,.jpg,.jpeg,.dwg,.dxf,.docx';

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveSubCat(null)}
            className={`px-3 py-1.5 text-sm rounded-lg ${!activeSubCat ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            All ({files.length})
          </button>
          {FILE_SUBCATEGORIES.map(sc => {
            const count = files.filter(f => f.subCategory === sc).length;
            return (
              <button
                key={sc}
                onClick={() => setActiveSubCat(sc)}
                className={`px-3 py-1.5 text-sm rounded-lg ${activeSubCat === sc ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {FILE_SUBCATEGORY_CONFIG[sc]?.icon} {FILE_SUBCATEGORY_CONFIG[sc]?.label} ({count})
              </button>
            );
          })}
        </div>
        <button onClick={() => triggerFileUpload()} className="btn-primary text-sm">
          + Upload File
        </button>
      </div>

      {/* Upload progress */}
      {uploading && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
            <span className="text-sm text-blue-700">Uploading... {uploadProgress}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-1.5 mt-2">
            <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {/* Sub-category upload zones */}
      {activeSubCat && (
        <div
          className="mb-4 border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-primary-400 hover:bg-primary-50/30 transition-colors cursor-pointer"
          onClick={() => triggerFileUpload(activeSubCat)}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary-400', 'bg-primary-50'); }}
          onDragLeave={(e) => { e.currentTarget.classList.remove('border-primary-400', 'bg-primary-50'); }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('border-primary-400', 'bg-primary-50');
            const dt = e.dataTransfer;
            if (dt.files.length > 0) {
              setSelectedSubCategory(activeSubCat);
              const input = fileInputRef.current;
              // Manually handle dropped files
              const fileList = dt.files;
              handleFileDropped(fileList);
            }
          }}
        >
          <div className="text-3xl mb-2">{FILE_SUBCATEGORY_CONFIG[activeSubCat]?.icon || '📁'}</div>
          <p className="text-sm font-medium text-gray-700">
            Click to upload or drag & drop files here
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {FILE_SUBCATEGORY_CONFIG[activeSubCat]?.label} · PDF, PNG, JPG, DWG, DXF, DOCX
          </p>
        </div>
      )}

      {filteredFiles.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No files in this category</div>
      ) : (
        <div className="space-y-2">
          {filteredFiles.map(f => (
            <div key={f.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-lg">{FILE_SUBCATEGORY_CONFIG[f.subCategory]?.icon || '📄'}</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{f.fileName}</p>
                  <p className="text-xs text-gray-500">
                    {FILE_SUBCATEGORY_CONFIG[f.subCategory]?.label || 'General'} · {formatDate(f.createdAt)}
                    {f.fileSize && <span> · {formatFileSize(f.fileSize)}</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {f.fileUrl && (f.fileType?.startsWith('image/') || f.fileName?.match(/\.(png|jpg|jpeg|gif|webp)$/i)) && (
                  <button onClick={() => window.open(f.fileUrl, '_blank')} className="text-sm text-blue-600 hover:underline">Preview</button>
                )}
                {f.fileUrl && (
                  <a href={f.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:underline" download>Download</a>
                )}
                <button onClick={() => onDelete(f.id)} className="text-sm text-red-600 hover:text-red-800">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  async function handleFileDropped(fileList) {
    setUploading(true);
    setUploadProgress(0);
    const droppedFiles = Array.from(fileList);
    let successCount = 0;
    for (let i = 0; i < droppedFiles.length; i++) {
      const file = droppedFiles[i];
      const fileUrl = URL.createObjectURL(file);
      try {
        await onUpload({
          fileName: file.name,
          fileUrl: fileUrl,
          fileType: file.type,
          fileSize: file.size,
          subCategory: selectedSubCategory,
        });
        successCount++;
      } catch {
        // error already shown by parent
      }
      setUploadProgress(Math.round(((i + 1) / droppedFiles.length) * 100));
    }
    setUploading(false);
    setUploadProgress(0);
    if (successCount > 0) enqueueSnackbar(`${successCount} file${successCount > 1 ? 's' : ''} uploaded`, { variant: 'success' });
  }
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value || '—'}</dd>
    </div>
  );
}

function TaskModal({ onSubmit, onClose }) {
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');

  const handleSubmit = () => {
    if (!content.trim() || !dueDate) return;
    onSubmit({ content: content.trim(), dueDate, notes: notes.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Task</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Task Description *</label>
            <input className="input-field" placeholder="e.g. Follow up with client" value={content} onChange={(e) => setContent(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
            <input type="date" className="input-field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea className="input-field" rows={3} placeholder="Additional details..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={!content.trim() || !dueDate} className="btn-primary">Create Task</button>
        </div>
      </div>
    </div>
  );
}

function MeetingModal({ lead, onSubmit, onClose }) {
  const displayName = lead.name || [lead.firstName, lead.lastName].filter(Boolean).join(' ');
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 3600000);
  const toLocalISO = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [title, setTitle] = useState(`Meeting with ${displayName}`);
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState(toLocalISO(now));
  const [endTime, setEndTime] = useState(toLocalISO(oneHourLater));
  const [addMeetLink, setAddMeetLink] = useState(true);

  const handleSubmit = () => {
    if (!title.trim() || !startTime || !endTime) return;
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      addMeetLink,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">📅 Schedule Meeting via Google Calendar</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea className="input-field" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
              <input type="datetime-local" className="input-field" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
              <input type="datetime-local" className="input-field" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          {lead.email && (
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
              Attendee: {lead.email}
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" className="rounded border-gray-300" checked={addMeetLink} onChange={(e) => setAddMeetLink(e.target.checked)} />
            Add Google Meet link
          </label>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={!title.trim() || !startTime || !endTime} className="btn-primary">Schedule Meeting</button>
        </div>
      </div>
    </div>
  );
}

function QuotationModal({ existingCount, onSubmit, onClose }) {
  const nextVersion = existingCount + 1;
  const [amount, setAmount] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [status, setStatus] = useState('DRAFT');
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileName(file.name);
      setFileUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = () => {
    if (!amount) return;
    onSubmit({ amount, fileUrl: fileUrl || undefined, status });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Quotation</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
            <input className="input-field bg-gray-50" value={`v${nextVersion}`} disabled />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) *</label>
            <input type="number" className="input-field" placeholder="e.g. 1500000" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quotation Document</label>
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.xlsx" className="hidden" onChange={handleFileSelect} />
            <div className="flex items-center gap-3">
              <button onClick={() => fileInputRef.current?.click()} className="btn-secondary text-sm">
                📎 Choose File
              </button>
              {fileName && <span className="text-sm text-gray-600 truncate">{fileName}</span>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="DRAFT">Draft</option>
              <option value="SENT">Sent</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={!amount} className="btn-primary">Save Quotation</button>
        </div>
      </div>
    </div>
  );
}

function TextInputModal({ title, placeholder, type = 'text', onSubmit, onClose }) {
  const [value, setValue] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
        {type === 'number' ? (
          <input
            type="number"
            className="input-field"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        ) : (
          <textarea
            className="input-field"
            rows={4}
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        )}
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={() => value.trim() && onSubmit(value.trim())}
            disabled={!value.trim()}
            className="btn-primary"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-8 space-y-6 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-32" />
      <div className="h-8 bg-gray-200 rounded w-64" />
      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-4">
          <div className="flex gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-gray-200 rounded-lg w-32" />)}</div>
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
        <div className="h-80 bg-gray-200 rounded-xl" />
      </div>
    </div>
  );
}
