const { gql } = require('graphql-tag');

const typeDefs = gql`
  scalar DateTime
  scalar JSON

  # ── Enums ──
  enum UserRole {
    OWNER
    SENIOR_MANAGER
    SALES_EXECUTIVE
  }

  enum LeadStatus {
    NEW
    FOLLOW_UP
    MQL
    SQL
    MUQL
    QUOTED
    WON
    JUNK
  }

  enum LeadPriority {
    P1
    P2
    P3
  }

  enum LeadSource {
    REPEAT
    INSTAGRAM
    FB_ADS
    GOOGLE_ADS
    META_ADS
    WALK_IN
    REFERRAL
    WEBSITE_ENQUIRY
  }

  enum Designation {
    MR
    MRS
    DR
    AR
  }

  enum FileSubCategory {
    FLOOR_PLANS
    DETAILING_FILES
    REFERENCE_IMAGES
    GENERAL
  }

  enum ActivityType {
    NOTE
    CALL
    MEETING
    STATUS_CHANGE
    FILE_UPLOAD
    QUOTATION
    TASK
  }

  enum QuotationStatus {
    DRAFT
    SENT
    ACCEPTED
    REJECTED
  }

  enum CriteriaType {
    MQL
    SQL
  }

  # ── Types ──
  type User {
    id: ID!
    email: String!
    name: String!
    avatarUrl: String
    role: UserRole!
    reportsTo: User
    reportsToId: ID
    directReports: [User!]!
    isActive: Boolean!
    leadsColumnPreferences: [String!]
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type LeadContact {
    id: ID!
    leadId: ID!
    contactOrder: Int!
    name: String
    phone: String
    email: String
    relationship: String
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Lead {
    id: ID!
    name: String
    designation: Designation
    firstName: String!
    middleName: String
    lastName: String
    company: String
    email: String
    phone: String
    status: LeadStatus!
    priority: LeadPriority!
    source: LeadSource
    campaignName: String
    campaignActive: Boolean
    assignedTo: User
    assignedToId: ID
    budget: Float
    location: String
    deliveryDays: Int
    propertyInPossession: Boolean
    expectedHandoverMonth: Int
    expectedHandoverYear: Int
    currentLivingArea: String
    currentLivingCity: String
    currentLivingCountry: String
    notes: String
    createdBy: User
    activities: [Activity!]!
    quotations: [Quotation!]!
    files: [File!]!
    contacts: [LeadContact!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Activity {
    id: ID!
    leadId: ID!
    lead: Lead
    userId: ID!
    user: User
    type: ActivityType!
    content: String
    metadata: JSON
    dueDate: String
    isCompleted: Boolean!
    isOverdue: Boolean!
    createdAt: DateTime!
  }

  type Quotation {
    id: ID!
    leadId: ID!
    lead: Lead
    version: Int!
    amount: Float
    fileUrl: String
    status: QuotationStatus!
    createdBy: User
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type File {
    id: ID!
    leadId: ID!
    activityId: ID
    fileName: String!
    fileUrl: String!
    fileType: String
    fileSize: Int
    category: String
    subCategory: FileSubCategory
    uploadedBy: User
    createdAt: DateTime!
  }

  type AlertSetting {
    id: ID!
    settingKey: String!
    settingValue: String!
    updatedAt: DateTime!
  }

  type QualificationCriteria {
    id: ID!
    type: CriteriaType!
    field: String!
    operator: String!
    value: String!
    isActive: Boolean!
    createdAt: DateTime!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type DashboardMetrics {
    totalLeads: Int!
    newLeads: Int!
    mqlLeads: Int!
    sqlLeads: Int!
    quotedLeads: Int!
    wonLeads: Int!
    bookedOrdersValue: Float!
    pipelineStages: [PipelineStage!]!
    teamPerformance: [TeamPerformance!]!
    alerts: [Alert!]!
    performanceMetrics: PerformanceMetrics
    overdueTasks: [Activity!]!
  }

  type PipelineStage {
    stage: String!
    count: Int!
  }

  type TeamPerformance {
    userId: ID!
    userName: String!
    newCount: Int!
    mqlCount: Int!
    sqlCount: Int!
    quotedCount: Int!
    wonCount: Int!
  }

  type Alert {
    id: ID!
    type: String!
    message: String!
    count: Int!
    leadIds: [ID!]!
    severity: String
  }

  type PerformanceMetrics {
    conversionRate: Float!
    avgDealSize: Float!
    avgTimeToClose: Float!
    weeklyTrend: [WeeklyTrend!]!
    dailyTrend: [DailyTrend!]!
    sourceBreakdown: [SourceBreakdown!]!
    teamRanking: [TeamRanking!]!
  }

  type WeeklyTrend {
    week: String!
    newLeads: Int!
    wonLeads: Int!
    revenue: Float!
  }

  type DailyTrend {
    day: String!
    newLeads: Int!
    wonLeads: Int!
    revenue: Float!
  }

  type SourceBreakdown {
    source: String!
    count: Int!
    wonCount: Int!
    revenue: Float!
  }

  type TeamRanking {
    userId: ID!
    userName: String!
    totalLeads: Int!
    wonLeads: Int!
    conversionRate: Float!
    revenue: Float!
  }

  type CalendarEvent {
    id: ID!
    leadId: ID
    userId: ID!
    googleEventId: String
    title: String!
    description: String
    startTime: String!
    endTime: String!
    meetLink: String
    htmlLink: String
    attendees: [String!]
    createdAt: DateTime!
  }

  type CalendarAuthUrl {
    url: String!
  }

  type LeadsConnection {
    leads: [Lead!]!
    totalCount: Int!
  }

  # ── Inputs ──
  input CreateLeadInput {
    designation: Designation
    firstName: String!
    middleName: String
    lastName: String
    company: String
    email: String
    phone: String
    status: LeadStatus
    priority: LeadPriority
    source: LeadSource
    campaignName: String
    campaignActive: Boolean
    assignedTo: ID
    budget: Float
    location: String
    deliveryDays: Int
    propertyInPossession: Boolean
    expectedHandoverMonth: Int
    expectedHandoverYear: Int
    currentLivingArea: String
    currentLivingCity: String
    currentLivingCountry: String
    notes: String
    contacts: [LeadContactInput!]
  }

  input UpdateLeadInput {
    designation: Designation
    firstName: String
    middleName: String
    lastName: String
    company: String
    email: String
    phone: String
    status: LeadStatus
    priority: LeadPriority
    source: LeadSource
    campaignName: String
    campaignActive: Boolean
    assignedTo: ID
    budget: Float
    location: String
    deliveryDays: Int
    propertyInPossession: Boolean
    expectedHandoverMonth: Int
    expectedHandoverYear: Int
    currentLivingArea: String
    currentLivingCity: String
    currentLivingCountry: String
    notes: String
    contacts: [LeadContactInput!]
  }

  input LeadContactInput {
    contactOrder: Int!
    name: String
    phone: String
    email: String
    relationship: String
  }

  input CreateActivityInput {
    leadId: ID!
    type: ActivityType!
    content: String
    metadata: JSON
    dueDate: String
  }

  input CreateQuotationInput {
    leadId: ID!
    amount: Float
    fileUrl: String
    status: QuotationStatus
  }

  input UpdateQuotationInput {
    amount: Float
    fileUrl: String
    status: QuotationStatus
  }

  input AlertSettingInput {
    settingKey: String!
    settingValue: String!
  }

  input QualificationCriteriaInput {
    type: CriteriaType!
    field: String!
    operator: String!
    value: String!
  }

  input UpdateUserInput {
    name: String
    role: UserRole
    reportsTo: ID
    isActive: Boolean
    leadsColumnPreferences: [String!]
  }

  input LeadFilters {
    status: LeadStatus
    priority: LeadPriority
    source: LeadSource
    assignedTo: ID
    search: String
    noActivityDays: Int
    budgetMin: Float
    budgetMax: Float
    location: String
    propertyInPossession: Boolean
    campaignName: String
    campaignActive: Boolean
    createdAfter: String
    createdBefore: String
    matchesCriteria: CriteriaType
  }

  input UploadFileInput {
    leadId: ID!
    fileName: String!
    fileUrl: String!
    fileType: String
    fileSize: Int
    subCategory: FileSubCategory
  }

  # ── Queries ──
  type Query {
    # Auth
    me: User

    # Users
    users: [User!]!
    user(id: ID!): User
    orgStructure: [User!]!
    unassignedUsers: [User!]!

    # Leads
    leads(filters: LeadFilters, limit: Int, offset: Int, sortBy: String, sortOrder: String): LeadsConnection!
    lead(id: ID!): Lead

    # Activities
    activities(leadId: ID!, limit: Int, offset: Int): [Activity!]!

    # Quotations
    quotations(leadId: ID!): [Quotation!]!

    # Files
    files(leadId: ID!, subCategory: FileSubCategory): [File!]!

    # Dashboard
    dashboardMetrics: DashboardMetrics!

    # Settings
    alertSettings: [AlertSetting!]!
    qualificationCriteria(type: CriteriaType): [QualificationCriteria!]!

    # Calendar
    calendarAuthUrl: CalendarAuthUrl!
    calendarEvents(limit: Int): [CalendarEvent!]!
    isCalendarConnected: Boolean!
  }

  # ── Mutations ──
  type Mutation {
    # Auth
    googleLogin(idToken: String!): AuthPayload!
    devLogin(email: String!): AuthPayload!

    # Users
    createUser(email: String!, name: String!, role: UserRole!, reportsTo: ID): User!
    updateUser(id: ID!, input: UpdateUserInput!): User!
    updateOrgStructure(userId: ID!, reportsTo: ID, role: UserRole): User!

    # Leads
    createLead(input: CreateLeadInput!): Lead!
    updateLead(id: ID!, input: UpdateLeadInput!): Lead!
    deleteLead(id: ID!): Boolean!
    bulkUpdateLeadStatus(leadIds: [ID!]!, status: LeadStatus!): [Lead!]!

    # Activities
    createActivity(input: CreateActivityInput!): Activity!
    completeTask(activityId: ID!): Activity!

    # Quotations
    createQuotation(input: CreateQuotationInput!): Quotation!
    updateQuotation(id: ID!, input: UpdateQuotationInput!): Quotation!

    # Files
    uploadFile(input: UploadFileInput!): File!
    deleteFile(id: ID!): Boolean!

    # Settings
    updateAlertSettings(settings: [AlertSettingInput!]!): [AlertSetting!]!
    saveQualificationCriteria(criteria: [QualificationCriteriaInput!]!, type: CriteriaType!): [QualificationCriteria!]!

    # Column Preferences
    saveColumnPreferences(columns: [String!]!): User!

    # Calendar & Meet
    createCalendarEvent(input: CreateCalendarEventInput!): CalendarEvent!
    deleteCalendarEvent(eventId: ID!): Boolean!
    disconnectCalendar: Boolean!
  }

  input CreateCalendarEventInput {
    leadId: ID
    title: String!
    description: String
    startTime: String!
    endTime: String!
    attendees: [String!]
    addMeetLink: Boolean
  }
`;

module.exports = typeDefs;
