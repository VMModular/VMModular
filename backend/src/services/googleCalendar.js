const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/pool');

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/meetings.space.created',
];

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/auth/google/callback'
  );
}

function getAuthUrl(userId) {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: userId,
  });
}

async function handleCallback(code, userId) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  db.prepare(
    `UPDATE users SET
      google_access_token = ?,
      google_refresh_token = COALESCE(?, google_refresh_token),
      google_token_expiry = ?,
      updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    tokens.access_token,
    tokens.refresh_token || null,
    tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    userId
  );
  return tokens;
}

function getCalendarClient(userId) {
  const user = db.prepare(
    'SELECT google_access_token, google_refresh_token, google_token_expiry FROM users WHERE id = ?'
  ).get(userId);
  if (!user || !user.google_access_token) return null;

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: user.google_access_token,
    refresh_token: user.google_refresh_token,
    expiry_date: user.google_token_expiry ? new Date(user.google_token_expiry).getTime() : null,
  });

  oauth2Client.on('tokens', (tokens) => {
    db.prepare(
      `UPDATE users SET
        google_access_token = ?,
        google_refresh_token = COALESCE(?, google_refresh_token),
        google_token_expiry = ?
       WHERE id = ?`
    ).run(
      tokens.access_token,
      tokens.refresh_token || null,
      tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      userId
    );
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

async function createCalendarEvent(userId, {
  title, description, startTime, endTime,
  attendees = [], addMeetLink = false, timeZone = 'Asia/Kolkata',
}) {
  const calendar = getCalendarClient(userId);
  if (!calendar) throw new Error('Google Calendar not connected. Please connect your account first.');

  const event = {
    summary: title,
    description,
    start: { dateTime: startTime, timeZone },
    end: { dateTime: endTime, timeZone },
    attendees: attendees.map((email) => ({ email })),
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 30 },
        { method: 'popup', minutes: 15 },
      ],
    },
  };

  if (addMeetLink) {
    event.conferenceData = {
      createRequest: {
        requestId: `vmcrm-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    };
  }

  const response = await calendar.events.insert({
    calendarId: 'primary',
    resource: event,
    conferenceDataVersion: addMeetLink ? 1 : 0,
    sendUpdates: 'all',
  });

  const data = response.data;
  return {
    eventId: data.id,
    htmlLink: data.htmlLink,
    meetLink: data.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === 'video')?.uri || null,
    meetingCode: data.conferenceData?.conferenceId || null,
    summary: data.summary,
    start: data.start.dateTime,
    end: data.end.dateTime,
  };
}

async function updateCalendarEvent(userId, googleEventId, {
  title, description, startTime, endTime, attendees, timeZone = 'Asia/Kolkata',
}) {
  const calendar = getCalendarClient(userId);
  if (!calendar) throw new Error('Google Calendar not connected.');

  const patch = {};
  if (title !== undefined) patch.summary = title;
  if (description !== undefined) patch.description = description;
  if (startTime !== undefined) patch.start = { dateTime: startTime, timeZone };
  if (endTime !== undefined) patch.end = { dateTime: endTime, timeZone };
  if (attendees !== undefined) patch.attendees = attendees.map((email) => ({ email }));

  const response = await calendar.events.patch({
    calendarId: 'primary',
    eventId: googleEventId,
    resource: patch,
    sendUpdates: 'all',
  });
  return response.data;
}

async function listAllEvents(userId, { maxResults = 50, timeMin, timeMax } = {}) {
  const calendar = getCalendarClient(userId);
  if (!calendar) return [];

  try {
    const params = { calendarId: 'primary', maxResults, singleEvents: true, orderBy: 'startTime' };
    if (timeMin) params.timeMin = timeMin;
    if (timeMax) params.timeMax = timeMax;

    const response = await calendar.events.list(params);
    return (response.data.items || []).map((event) => ({
      eventId: event.id,
      summary: event.summary || 'No Title',
      description: event.description || '',
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      htmlLink: event.htmlLink,
      status: event.status,
      meetLink: event.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === 'video')?.uri || null,
      meetingCode: event.conferenceData?.conferenceId || null,
      attendees: (event.attendees || []).map((a) => a.email),
    }));
  } catch (err) {
    console.error('Failed to list events:', err.message);
    return [];
  }
}

async function getFreeBusy(userId, { timeMin, timeMax }) {
  const calendar = getCalendarClient(userId);
  if (!calendar) return [];

  try {
    const response = await calendar.freebusy.query({
      resource: { timeMin, timeMax, items: [{ id: 'primary' }] },
    });
    return response.data.calendars?.primary?.busy || [];
  } catch (err) {
    console.error('Free/busy query failed:', err.message);
    return [];
  }
}

async function syncEventsFromGoogle(userId, maxResults = 100) {
  const events = await listAllEvents(userId, {
    maxResults,
    timeMin: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    timeMax: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  });

  let synced = 0;
  for (const ev of events) {
    const existing = db.prepare(
      'SELECT id FROM calendar_events WHERE google_event_id = ? AND user_id = ?'
    ).get(ev.eventId, userId);

    if (existing) {
      db.prepare(
        `UPDATE calendar_events SET title = ?, description = ?, start_time = ?, end_time = ?,
          meet_link = ?, html_link = ?, attendees = ?
         WHERE google_event_id = ? AND user_id = ?`
      ).run(
        ev.summary, ev.description || null, ev.start, ev.end,
        ev.meetLink || null, ev.htmlLink || null,
        JSON.stringify(ev.attendees),
        ev.eventId, userId
      );
      db.prepare(`UPDATE calendar_events SET updated_at = datetime('now') WHERE google_event_id = ? AND user_id = ?`).run(ev.eventId, userId);
    } else {
      const id = uuidv4();
      db.prepare(
        `INSERT OR IGNORE INTO calendar_events
          (id, user_id, google_event_id, title, description, start_time, end_time, meet_link, html_link, attendees)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id, userId, ev.eventId,
        ev.summary, ev.description || null, ev.start, ev.end,
        ev.meetLink || null, ev.htmlLink || null,
        JSON.stringify(ev.attendees)
      );
      synced++;
    }
  }
  return { total: events.length, synced };
}

async function listUpcomingEvents(userId, maxResults = 10) {
  return listAllEvents(userId, { maxResults, timeMin: new Date().toISOString() });
}

async function deleteCalendarEvent(userId, eventId) {
  const calendar = getCalendarClient(userId);
  if (!calendar) throw new Error('Google Calendar not connected.');
  await calendar.events.delete({ calendarId: 'primary', eventId });
  return true;
}

function isCalendarConnected(userId) {
  const user = db.prepare('SELECT google_access_token FROM users WHERE id = ?').get(userId);
  return !!(user && user.google_access_token);
}

module.exports = {
  getAuthUrl,
  handleCallback,
  createCalendarEvent,
  updateCalendarEvent,
  listUpcomingEvents,
  listAllEvents,
  getFreeBusy,
  syncEventsFromGoogle,
  deleteCalendarEvent,
  isCalendarConnected,
};
