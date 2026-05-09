import { gql } from '@apollo/client';

// ── Auth ──
export const DEV_LOGIN = gql`
  mutation DevLogin($email: String!) {
    devLogin(email: $email) {
      token
      user { id email name role avatarUrl }
    }
  }
`;

export const GOOGLE_LOGIN = gql`
  mutation GoogleLogin($idToken: String!) {
    googleLogin(idToken: $idToken) {
      token
      user { id email name role avatarUrl }
    }
  }
`;

export const GET_ME = gql`
  query Me {
    me { id email name role avatarUrl leadsColumnPreferences }
  }
`;

// ── Users ──
export const GET_USERS = gql`
  query Users {
    users { id email name role avatarUrl reportsToId isActive }
  }
`;

export const GET_ORG_STRUCTURE = gql`
  query OrgStructure {
    orgStructure {
      id email name role avatarUrl reportsToId isActive
      directReports { id name role }
    }
  }
`;

export const GET_UNASSIGNED_USERS = gql`
  query UnassignedUsers {
    unassignedUsers { id email name role }
  }
`;

export const CREATE_USER = gql`
  mutation CreateUser($email: String!, $name: String!, $role: UserRole!, $reportsTo: ID) {
    createUser(email: $email, name: $name, role: $role, reportsTo: $reportsTo) {
      id email name role
    }
  }
`;

export const UPDATE_ORG_STRUCTURE = gql`
  mutation UpdateOrgStructure($userId: ID!, $reportsTo: ID, $role: UserRole) {
    updateOrgStructure(userId: $userId, reportsTo: $reportsTo, role: $role) {
      id name role reportsToId
    }
  }
`;

// ── Leads ──
export const GET_LEADS = gql`
  query Leads($filters: LeadFilters, $limit: Int, $offset: Int, $sortBy: String, $sortOrder: String) {
    leads(filters: $filters, limit: $limit, offset: $offset, sortBy: $sortBy, sortOrder: $sortOrder) {
      totalCount
      leads {
        id name designation firstName middleName lastName
        company status priority source
        budget location deliveryDays
        campaignName campaignActive
        propertyInPossession expectedHandoverMonth expectedHandoverYear
        currentLivingArea currentLivingCity currentLivingCountry
        assignedTo { id name avatarUrl }
        createdAt updatedAt
      }
    }
  }
`;

export const GET_LEAD = gql`
  query Lead($id: ID!) {
    lead(id: $id) {
      id name designation firstName middleName lastName
      company email phone status priority source
      budget location deliveryDays notes
      campaignName campaignActive
      propertyInPossession expectedHandoverMonth expectedHandoverYear
      currentLivingArea currentLivingCity currentLivingCountry
      contacts { id contactOrder name phone email relationship }
      assignedTo { id name email avatarUrl }
      createdBy { id name }
      activities {
        id type content metadata dueDate isCompleted isOverdue createdAt
        user { id name avatarUrl }
      }
      quotations {
        id version amount fileUrl status createdAt
        createdBy { id name }
      }
      files { id fileName fileUrl fileType category subCategory createdAt }
      createdAt updatedAt
    }
  }
`;

export const CREATE_LEAD = gql`
  mutation CreateLead($input: CreateLeadInput!) {
    createLead(input: $input) {
      id name designation firstName middleName lastName company status priority
    }
  }
`;

export const UPDATE_LEAD = gql`
  mutation UpdateLead($id: ID!, $input: UpdateLeadInput!) {
    updateLead(id: $id, input: $input) {
      id name designation firstName middleName lastName
      company status priority source budget location deliveryDays notes
      campaignName campaignActive
      propertyInPossession expectedHandoverMonth expectedHandoverYear
      currentLivingArea currentLivingCity currentLivingCountry
      contacts { id contactOrder name phone email relationship }
      assignedTo { id name }
    }
  }
`;

export const DELETE_LEAD = gql`
  mutation DeleteLead($id: ID!) {
    deleteLead(id: $id)
  }
`;

// ── Activities ──
export const CREATE_ACTIVITY = gql`
  mutation CreateActivity($input: CreateActivityInput!) {
    createActivity(input: $input) {
      id type content metadata dueDate isCompleted isOverdue createdAt
      user { id name avatarUrl }
    }
  }
`;

export const COMPLETE_TASK = gql`
  mutation CompleteTask($activityId: ID!) {
    completeTask(activityId: $activityId) {
      id isCompleted isOverdue
    }
  }
`;

// ── Quotations ──
export const CREATE_QUOTATION = gql`
  mutation CreateQuotation($input: CreateQuotationInput!) {
    createQuotation(input: $input) {
      id version amount status createdAt
    }
  }
`;

// ── Dashboard ──
export const GET_DASHBOARD = gql`
  query DashboardMetrics {
    dashboardMetrics {
      totalLeads newLeads mqlLeads sqlLeads quotedLeads wonLeads
      bookedOrdersValue
      pipelineStages { stage count }
      teamPerformance { userId userName newCount mqlCount sqlCount quotedCount wonCount }
      alerts { id type message count leadIds severity }
      performanceMetrics {
        conversionRate avgDealSize avgTimeToClose
        weeklyTrend { week newLeads wonLeads revenue }
        dailyTrend { day newLeads wonLeads revenue }
        sourceBreakdown { source count wonCount revenue }
        teamRanking { userId userName totalLeads wonLeads conversionRate revenue }
      }
      overdueTasks {
        id leadId type content dueDate isCompleted isOverdue createdAt
        user { id name }
        lead { id name firstName lastName }
      }
    }
  }
`;

// ── Settings ──
export const GET_ALERT_SETTINGS = gql`
  query AlertSettings {
    alertSettings { id settingKey settingValue updatedAt }
  }
`;

export const UPDATE_ALERT_SETTINGS = gql`
  mutation UpdateAlertSettings($settings: [AlertSettingInput!]!) {
    updateAlertSettings(settings: $settings) {
      id settingKey settingValue
    }
  }
`;

export const GET_QUALIFICATION_CRITERIA = gql`
  query QualificationCriteria($type: CriteriaType) {
    qualificationCriteria(type: $type) {
      id type field operator value isActive
    }
  }
`;

export const SAVE_QUALIFICATION_CRITERIA = gql`
  mutation SaveQualificationCriteria($criteria: [QualificationCriteriaInput!]!, $type: CriteriaType!) {
    saveQualificationCriteria(criteria: $criteria, type: $type) {
      id type field operator value
    }
  }
`;

// ── Calendar ──
export const GET_CALENDAR_AUTH_URL = gql`
  query CalendarAuthUrl {
    calendarAuthUrl { url }
  }
`;

export const GET_CALENDAR_EVENTS = gql`
  query CalendarEvents($limit: Int) {
    calendarEvents(limit: $limit) {
      id leadId userId googleEventId title description startTime endTime meetLink htmlLink attendees createdAt
    }
  }
`;

export const IS_CALENDAR_CONNECTED = gql`
  query IsCalendarConnected {
    isCalendarConnected
  }
`;

export const CREATE_CALENDAR_EVENT = gql`
  mutation CreateCalendarEvent($input: CreateCalendarEventInput!) {
    createCalendarEvent(input: $input) {
      id leadId title description startTime endTime meetLink htmlLink attendees
    }
  }
`;

export const DELETE_CALENDAR_EVENT = gql`
  mutation DeleteCalendarEvent($eventId: ID!) {
    deleteCalendarEvent(eventId: $eventId)
  }
`;

export const DISCONNECT_CALENDAR = gql`
  mutation DisconnectCalendar {
    disconnectCalendar
  }
`;

export const SYNC_CALENDAR_EVENTS = gql`
  mutation SyncCalendarEvents {
    syncCalendarEvents { total synced }
  }
`;

export const GET_FREE_BUSY = gql`
  query FreeBusy($timeMin: String!, $timeMax: String!) {
    freeBusy(timeMin: $timeMin, timeMax: $timeMax) { start end }
  }
`;

export const UPDATE_USER = gql`
  mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      id name email role isActive reportsToId
    }
  }
`;

export const UPLOAD_FILE = gql`
  mutation UploadFile($input: UploadFileInput!) {
    uploadFile(input: $input) {
      id fileName fileUrl fileType category subCategory createdAt
    }
  }
`;

export const DELETE_FILE = gql`
  mutation DeleteFile($id: ID!) {
    deleteFile(id: $id)
  }
`;

export const SAVE_COLUMN_PREFERENCES = gql`
  mutation SaveColumnPreferences($columns: [String!]!) {
    saveColumnPreferences(columns: $columns) {
      id leadsColumnPreferences
    }
  }
`;

export const GET_FILES = gql`
  query Files($leadId: ID!, $subCategory: FileSubCategory) {
    files(leadId: $leadId, subCategory: $subCategory) {
      id fileName fileUrl fileType category subCategory createdAt
    }
  }
`;
