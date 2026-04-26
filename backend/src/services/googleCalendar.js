const { google } = require('googleapis');
const db = require('../db/pool');

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/auth/google/callback'
  );
}

/**
 * Generate Google OAuth2 authorization URL
 */
function getAuthUrl(userId) {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: userId,
  });
}

/**
 * Exchange authorization code for tokens and store them
 */
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

/**
 * Get authenticated calendar client for a user
 */
function getCalendarClient(userId) {
  const user = db.prepare(
    'SELECT google_access_token, google_refresh_token, google_token_expiry FROM users WHERE id = ?'
  ).get(userId);

  if (!user || !user.google_access_token) {
    return null;
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: user.google_access_token,
    refresh_token: user.google_refresh_token,
    expiry_date: user.google_token_expiry ? new Date(user.google_token_expiry).getTime() : null,
  });

  // Auto-refresh tokens
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

/**
 * Create a calendar event with optional Google Meet link
 */
async function createCalendarEvent(userId, { title, description, startTime, endTime, attendees = [], addMeetLink = false }) {
  const calendar = getCalendarClient(userId);
  if (!calendar) {
    throw new Error('Google Calendar not connected. Please connect your account first.');
  }

  const event = {
    summary: title,
    description,
    start: {
      dateTime: startTime,
      timeZone: 'Asia/Kolkata',
    },
    end: {
      dateTime: endTime,
      timeZone: 'Asia/Kolkata',
    },
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

  return {
    eventId: response.data.id,
    htmlLink: response.data.htmlLink,
    meetLink: response.data.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === 'video'
    )?.uri || null,
    summary: response.data.summary,
    start: response.data.start.dateTime,
    end: response.data.end.dateTime,
  };
}

/**
 * List upcoming calendar events
 */
async function listUpcomingEvents(userId, maxResults = 10) {
  const calendar = getCalendarClient(userId);
  if (!calendar) return [];

  try {
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return (response.data.items || []).map((event) => ({
      eventId: event.id,
      summary: event.summary || 'No Title',
      description: event.description || '',
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      htmlLink: event.htmlLink,
      meetLink: event.conferenceData?.entryPoints?.find(
        (ep) => ep.entryPointType === 'video'
      )?.uri || null,
      attendees: (event.attendees || []).map((a) => a.email),
    }));
  } catch (err) {
    console.error('Failed to list events:', err.message);
    return [];
  }
}

/**
 * Delete a calendar event
 */
async function deleteCalendarEvent(userId, eventId) {
  const calendar = getCalendarClient(userId);
  if (!calendar) throw new Error('Google Calendar not connected.');

  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
  });
  return true;
}

/**
 * Check if user has calendar connected
 */
function isCalendarConnected(userId) {
  const user = db.prepare('SELECT google_access_token FROM users WHERE id = ?').get(userId);
  return !!(user && user.google_access_token);
}

module.exports = {
  getAuthUrl,
  handleCallback,
  createCalendarEvent,
  listUpcomingEvents,
  deleteCalendarEvent,
  isCalendarConnected,
};
