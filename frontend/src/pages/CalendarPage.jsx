import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { useSnackbar } from 'notistack';
import {
  GET_CALENDAR_EVENTS, IS_CALENDAR_CONNECTED, GET_CALENDAR_AUTH_URL,
  CREATE_CALENDAR_EVENT, DELETE_CALENDAR_EVENT, GET_LEADS,
} from '../graphql/queries';

export default function CalendarPage() {
  const { enqueueSnackbar } = useSnackbar();
  const { data: connData, loading: connLoading } = useQuery(IS_CALENDAR_CONNECTED);
  const { data: authData } = useQuery(GET_CALENDAR_AUTH_URL, { skip: connData?.isCalendarConnected });
  const { data: eventsData, loading: eventsLoading, refetch } = useQuery(GET_CALENDAR_EVENTS, {
    variables: { limit: 50 },
    skip: !connData?.isCalendarConnected,
  });
  const { data: leadsData } = useQuery(GET_LEADS, { variables: { limit: 100 } });
  const [createEvent, { loading: creating }] = useMutation(CREATE_CALENDAR_EVENT);
  const [deleteEvent] = useMutation(DELETE_CALENDAR_EVENT);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const isConnected = connData?.isCalendarConnected;
  const events = eventsData?.calendarEvents || [];
  const leads = leadsData?.leads?.leads || [];

  if (connLoading) return <LoadingSkeleton />;

  if (!isConnected) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">Calendar</h1>
        <div className="card max-w-lg mx-auto text-center py-12">
          <div className="text-5xl mb-4">📅</div>
          <h2 className="text-lg font-semibold text-gray-900">Connect Google Calendar</h2>
          <p className="text-sm text-gray-500 mt-2 mb-6">
            Connect your Google Calendar to schedule meetings, create Google Meet links, and sync events with your leads.
          </p>
          <button onClick={() => authData?.calendarAuthUrl?.url && (window.location.href = authData.calendarAuthUrl.url)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors">
            <GoogleIcon /> Connect Google Calendar
          </button>
        </div>
      </div>
    );
  }

  const now = new Date();
  const upcomingEvents = events.filter(e => new Date(e.startTime) >= now);
  const pastEvents = events.filter(e => new Date(e.startTime) < now);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
          <p className="text-sm text-gray-500 mt-1">Manage meetings, calls & Google Meet links</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary text-sm">+ New Event</button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-primary-600">{upcomingEvents.length}</p>
          <p className="text-xs text-gray-500 mt-1">Upcoming</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-green-600">{events.filter(e => e.meetLink).length}</p>
          <p className="text-xs text-gray-500 mt-1">With Meet Link</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-gray-600">{pastEvents.length}</p>
          <p className="text-xs text-gray-500 mt-1">Past Events</p>
        </div>
      </div>

      {eventsLoading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : events.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">🗓️</div>
          <h3 className="text-lg font-semibold text-gray-900">No Events Yet</h3>
          <p className="text-sm text-gray-500 mt-1">Create your first calendar event to get started.</p>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary mt-4">Create Event</button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Upcoming */}
          {upcomingEvents.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Upcoming Events</h2>
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <EventCard key={event.id} event={event} onDelete={async () => {
                    if (!confirm('Delete this event?')) return;
                    try {
                      await deleteEvent({ variables: { eventId: event.id } });
                      refetch();
                      enqueueSnackbar('Event deleted', { variant: 'success' });
                    } catch (err) {
                      enqueueSnackbar(err.message || 'Failed to delete event', { variant: 'error' });
                    }
                  }} />
                ))}
              </div>
            </div>
          )}

          {/* Past */}
          {pastEvents.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Past Events</h2>
              <div className="space-y-3 opacity-70">
                {pastEvents.slice(0, 10).map((event) => (
                  <EventCard key={event.id} event={event} isPast />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <CreateEventModal
          leads={leads}
          creating={creating}
          onClose={() => setShowCreateModal(false)}
          onSubmit={async (input) => {
            try {
              await createEvent({ variables: { input } });
              refetch();
              setShowCreateModal(false);
              enqueueSnackbar('Event created', { variant: 'success' });
            } catch (err) {
              enqueueSnackbar(err.message || 'Failed to create event', { variant: 'error' });
            }
          }}
        />
      )}
    </div>
  );
}

function EventCard({ event, onDelete, isPast }) {
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeStr = `${start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex gap-4">
          {/* Date pill */}
          <div className="flex flex-col items-center justify-center bg-primary-50 text-primary-700 rounded-xl px-4 py-2 min-w-[70px]">
            <span className="text-xs uppercase font-medium">{start.toLocaleDateString('en-US', { month: 'short' })}</span>
            <span className="text-xl font-bold">{start.getDate()}</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{event.title}</h3>
            <p className="text-xs text-gray-500 mt-1">{dateStr} · {timeStr}</p>
            {event.description && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{event.description}</p>}

            <div className="flex items-center gap-3 mt-2">
              {event.meetLink && (
                <a href={event.meetLink} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium hover:bg-blue-100">
                  📹 Join Meet
                </a>
              )}
              {event.htmlLink && (
                <a href={event.htmlLink} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-gray-400 hover:text-gray-600">
                  Open in Google Calendar →
                </a>
              )}
              {event.attendees && (
                <span className="text-xs text-gray-400">
                  {JSON.parse(event.attendees || '[]').length} attendee(s)
                </span>
              )}
            </div>
          </div>
        </div>

        {!isPast && onDelete && (
          <button onClick={onDelete} className="text-gray-400 hover:text-red-500 p-1" title="Delete event">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function CreateEventModal({ leads, creating, onClose, onSubmit }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    leadId: '',
    attendees: '',
    addMeetLink: true,
  });

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const handleSubmit = () => {
    if (!form.title || !form.startTime || !form.endTime) return;
    const input = {
      title: form.title,
      description: form.description || undefined,
      startTime: new Date(form.startTime).toISOString(),
      endTime: new Date(form.endTime).toISOString(),
      leadId: form.leadId || undefined,
      attendees: form.attendees
        ? form.attendees.split(',').map((e) => e.trim()).filter(Boolean)
        : undefined,
      addMeetLink: form.addMeetLink,
    };
    onSubmit(input);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Calendar Event</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input className="input-field" value={form.title} onChange={set('title')} placeholder="Meeting with client" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea className="input-field" rows={2} value={form.description} onChange={set('description')} placeholder="Meeting agenda..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
              <input type="datetime-local" className="input-field" value={form.startTime} onChange={set('startTime')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time *</label>
              <input type="datetime-local" className="input-field" value={form.endTime} onChange={set('endTime')} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Link to Lead</label>
            <select className="input-field" value={form.leadId} onChange={set('leadId')}>
              <option value="">— None —</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.company})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Attendees (comma-separated emails)</label>
            <input className="input-field" value={form.attendees} onChange={set('attendees')} placeholder="person@email.com, other@email.com" />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="addMeet" checked={form.addMeetLink} onChange={set('addMeetLink')}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <label htmlFor="addMeet" className="text-sm font-medium text-gray-700">
              Add Google Meet link 📹
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={creating || !form.title.trim() || !form.startTime || !form.endTime} className="btn-primary">
            {creating ? 'Creating...' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path d="M12 23c2.97 0 5.46-.99 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-8 animate-pulse space-y-6">
      <div className="h-8 bg-gray-200 rounded w-48" />
      <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}</div>
      <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}</div>
    </div>
  );
}
