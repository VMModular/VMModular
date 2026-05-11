require('dotenv').config();
const db = require('./pool');
const { v4: uuidv4 } = require('uuid');

function seed() {
  try {
    console.log('Seeding database...');

    const transaction = db.transaction(() => {
      // ── Create Users (using fixed IDs for idempotency) ──
      const ownerId = '00000000-0000-4000-a000-000000000001';
      const sm1Id   = '00000000-0000-4000-a000-000000000002';
      const sm2Id   = '00000000-0000-4000-a000-000000000003';
      const se1Id   = '00000000-0000-4000-a000-000000000004';
      const se2Id   = '00000000-0000-4000-a000-000000000005';
      const se3Id   = '00000000-0000-4000-a000-000000000006';
      const se4Id   = '00000000-0000-4000-a000-000000000007';

      const insertUser = db.prepare(
        `INSERT OR IGNORE INTO users (id, email, name, role, reports_to) VALUES (?, ?, ?, ?, ?)`
      );
      insertUser.run(ownerId, 'owner@moducraft.com', 'Rajesh Kumar', 'OWNER', null);
      insertUser.run(sm1Id, 'sm1@moducraft.com', 'Rahul Sharma', 'SENIOR_MANAGER', ownerId);
      insertUser.run(sm2Id, 'sm2@moducraft.com', 'Amit Sharma', 'SENIOR_MANAGER', ownerId);
      insertUser.run(se1Id, 'se1@moducraft.com', 'Priya Singh', 'SALES_EXECUTIVE', sm1Id);
      insertUser.run(se2Id, 'se2@moducraft.com', 'Amit Verma', 'SALES_EXECUTIVE', sm1Id);
      insertUser.run(se3Id, 'se3@moducraft.com', 'Rahul Sharma Jr', 'SALES_EXECUTIVE', sm2Id);
      insertUser.run(se4Id, 'se4@moducraft.com', 'Bons Verma', 'SALES_EXECUTIVE', sm2Id);

      // Optional OWNER bootstrap account from env
      const ownerEmail = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
      if (ownerEmail) {
        // Prefer explicit OWNER_NAME; fall back to deriving from email local part
        let ownerName = (process.env.OWNER_NAME || '').trim();
        if (!ownerName) {
          const localPart = ownerEmail.split('@')[0];
          ownerName = localPart
            .replace(/[._\-]+/g, ' ')
            .split(' ')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
        }
        db.prepare(
          `INSERT INTO users (id, email, name, role, reports_to, is_active)
           VALUES (?, ?, ?, 'OWNER', NULL, 1)
           ON CONFLICT(email) DO UPDATE SET
             role = 'OWNER',
             name = excluded.name,
             reports_to = NULL,
             is_active = 1,
             updated_at = datetime('now')`
        ).run('00000000-0000-4000-a000-000000000099', ownerEmail, ownerName);
      }

      console.log('  Users seeded');

      const salesExecs = [se1Id, se2Id, se3Id, se4Id];

      // ── Helper functions ──
      const firstNames = ['Aarav', 'Aditi', 'Aisha', 'Akash', 'Ananya', 'Arjun', 'Bhavna', 'Chetan', 'Deepa', 'Dhruv',
        'Esha', 'Farhan', 'Gauri', 'Harsh', 'Isha', 'Jai', 'Kavya', 'Kunal', 'Lakshmi', 'Manish',
        'Neha', 'Nikhil', 'Pooja', 'Pranav', 'Priya', 'Rahul', 'Ravi', 'Rekha', 'Rohit', 'Sakshi',
        'Sandeep', 'Sapna', 'Siddharth', 'Sneha', 'Suresh', 'Tanvi', 'Tushar', 'Uma', 'Varun', 'Vidya',
        'Vikram', 'Yash', 'Zara', 'Anil', 'Meena', 'Kiran', 'Naveen', 'Pallavi', 'Ramesh', 'Sunita'];

      const lastNames = ['Agarwal', 'Bansal', 'Choudhary', 'Desai', 'Gupta', 'Iyer', 'Jain', 'Kapoor', 'Kumar',
        'Malhotra', 'Mehta', 'Nair', 'Patel', 'Rao', 'Reddy', 'Shah', 'Sharma', 'Singh', 'Sinha',
        'Tiwari', 'Verma', 'Yadav', 'Bhatia', 'Chopra', 'Dutta'];

      const companies = ['ModuCraft Designs', 'Urban Living Co', 'Elegant Interiors', 'Prestige Homes',
        'Royal Decor', 'Sunrise Builders', 'Dream Spaces', 'Zenith Interiors', 'Harmony Home',
        'Vista Design Studio', 'Luxe Living', 'Prime Interiors', 'Skyline Homes', 'Artisan Kitchens',
        'Pinnacle Design', 'Golden Interiors', 'Metro Living', 'HomeStar Solutions', 'Crystal Interiors',
        'NexGen Homes', null];

      const locations = ['Hyderabad', 'Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Pune', 'Kolkata',
        'Ahmedabad', 'Jaipur', 'Lucknow', 'Chandigarh', 'Kochi', 'Goa', 'Noida', 'Gurgaon',
        'Visakhapatnam', 'Coimbatore', 'Mysore', 'Indore', 'Nagpur'];

      const livingCities = ['San Francisco', 'Dubai', 'London', 'Singapore', 'Sydney', 'Toronto',
        'Hyderabad', 'Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Chennai', 'Kolkata', 'Jaipur', 'Ahmedabad'];

      const livingCountries = ['India', 'USA', 'UAE', 'UK', 'Singapore', 'Australia', 'Canada'];

      const statuses = ['NEW', 'FOLLOW_UP', 'MQL', 'SQL', 'MUQL', 'QUOTED', 'WON', 'JUNK'];
      const statusWeights = [25, 20, 15, 12, 5, 10, 8, 5];

      const allPriorities = ['P1', 'P2', 'P3'];
      const priorityWeights = [25, 35, 40];

      const allSources = ['REPEAT', 'INSTAGRAM', 'FB_ADS', 'GOOGLE_ADS', 'META_ADS', 'WALK_IN', 'REFERRAL', 'WEBSITE_ENQUIRY'];
      const designations = ['MR', 'MRS', 'DR', 'AR'];

      const campaignNames = [null, null, null, 'Spring Kitchen Sale 2026', 'Modular Kitchen FB Campaign',
        'Wardrobe Campaign Q1', 'Premium Interior Google Ads', 'Instagram Reels Campaign',
        'Festive Season 2025', 'New Year Campaign 2026'];

      const livingAreas = ['Banjara Hills', 'Koramangala', 'Andheri West', 'Defence Colony',
        'Jubilee Hills', 'Whitefield', 'Powai', 'Gachibowli', 'Electronic City',
        'HSR Layout', 'Indiranagar', 'MG Road', 'Hitech City', 'Madhapur'];

      function weightedPick(items, weights) {
        const total = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        for (let i = 0; i < items.length; i++) {
          r -= weights[i];
          if (r <= 0) return items[i];
        }
        return items[items.length - 1];
      }

      function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
      function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

      function randomBudget() {
        const ranges = [
          { min: 200000, max: 500000, weight: 10 },
          { min: 500000, max: 1000000, weight: 20 },
          { min: 1000000, max: 2000000, weight: 30 },
          { min: 2000000, max: 3500000, weight: 25 },
          { min: 3500000, max: 5000000, weight: 15 },
        ];
        const range = weightedPick(ranges, ranges.map(r => r.weight));
        return Math.round(rand(range.min, range.max) / 10000) * 10000;
      }

      function randomRecentDate() {
        const now = Date.now();
        const offset = rand(0, 90) * 86400000 + rand(0, 86400000);
        return new Date(now - offset).toISOString().replace('T', ' ').slice(0, 19);
      }

      // ── Insert 100 Leads ──
      const insertLead = db.prepare(
        `INSERT INTO leads (id, name, designation, first_name, middle_name, last_name, company, email, phone,
         status, priority, source, campaign_name, campaign_active, assigned_to, budget, location, delivery_days,
         property_in_possession, expected_handover_month, expected_handover_year,
         current_living_area, current_living_city, current_living_country,
         notes, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const insertActivity = db.prepare(
        `INSERT INTO activities (id, lead_id, user_id, type, content, created_at) VALUES (?, ?, ?, ?, ?, ?)`
      );
      const insertContact = db.prepare(
        `INSERT OR IGNORE INTO lead_contacts (id, lead_id, contact_order, name, phone, email, relationship) VALUES (?, ?, ?, ?, ?, ?, ?)`
      );

      const leadIds = [];
      for (let n = 0; n < 100; n++) {
        const leadId = uuidv4();
        leadIds.push(leadId);

        const firstName = pick(firstNames);
        const lastName = pick(lastNames);
        const middleName = Math.random() < 0.15 ? pick(firstNames) : null;
        const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
        const designation = pick(designations);
        const company = pick(companies);
        const status = weightedPick(statuses, statusWeights);
        const priority = weightedPick(allPriorities, priorityWeights);
        const source = pick(allSources);
        const assignedTo = pick(salesExecs);
        const budget = randomBudget();
        const location = pick(locations);
        const deliveryDays = pick([30, 45, 60, 90, 120, 150, 180]);
        const propertyInPossession = Math.random() < 0.55 ? 1 : 0;
        const campaignName = pick(campaignNames);
        const campaignActive = campaignName ? (Math.random() < 0.7 ? 1 : 0) : null;
        const hasHandover = propertyInPossession === 0 && Math.random() < 0.6;
        const expectedHandoverMonth = hasHandover ? rand(1, 12) : null;
        const expectedHandoverYear = hasHandover ? pick([2025, 2026, 2027]) : null;
        const hasLiving = Math.random() < 0.4;
        const currentLivingArea = hasLiving ? pick(livingAreas) : null;
        const currentLivingCity = hasLiving ? pick(livingCities) : null;
        const currentLivingCountry = hasLiving ? pick(livingCountries) : null;

        const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${rand(1, 99)}@email.com`;
        const phone = `9${rand(100000000, 999999999)}`;
        const createdAt = randomRecentDate();
        const updatedAt = createdAt;

        const notes = Math.random() < 0.3 ? pick([
          'Interested in modular kitchen with premium finish.',
          'Looking for full home interior design.',
          'Wants a walk-through before finalizing.',
          'Prefers Italian marble countertops.',
          'Referred by existing customer.',
          'Needs wardrobe + kitchen combo.',
          'Budget-conscious, looking for value options.',
          'Repeat customer, wants bedroom redesign.',
          'Very responsive, schedule site visit soon.',
          'NRI client, communication via WhatsApp only.',
        ]) : null;

        insertLead.run(
          leadId, fullName, designation, firstName, middleName, lastName,
          company, email, phone, status, priority, source,
          campaignName, campaignActive, assignedTo, budget, location, deliveryDays,
          propertyInPossession, expectedHandoverMonth, expectedHandoverYear,
          currentLivingArea, currentLivingCity, currentLivingCountry,
          notes, ownerId, createdAt, updatedAt
        );

        // 1–3 activities per lead
        const actCount = rand(1, 3);
        const actTypes = ['NOTE', 'CALL', 'MEETING', 'TASK'];
        const actContents = {
          NOTE: ['Initial lead created and assigned.', 'Client discussed budget and preferences.', 'Follow-up needed next week.', 'Shared catalog via email.'],
          CALL: ['Called to discuss requirements.', 'Follow-up call completed.', 'Client requested callback.', 'Discussed pricing options.'],
          MEETING: ['Site visit scheduled.', 'Met at showroom, showed samples.', 'Virtual meeting completed.', 'Design consultation done.'],
          TASK: ['Send quotation by Friday.', 'Prepare 3D render for kitchen.', 'Follow up after site visit.', 'Schedule architect meeting.'],
        };
        for (let a = 0; a < actCount; a++) {
          const aType = pick(actTypes);
          insertActivity.run(uuidv4(), leadId, assignedTo, aType, pick(actContents[aType]), createdAt);
        }

        // 20% chance of secondary contact
        if (Math.random() < 0.2) {
          insertContact.run(uuidv4(), leadId, 2,
            `${pick(firstNames)} ${pick(lastNames)}`,
            `9${rand(100000000, 999999999)}`,
            `contact${rand(1, 999)}@email.com`,
            pick(['Spouse', 'Architect', 'Son', 'Daughter', 'Brother', 'Engineer', 'Interior Designer'])
          );
        }
      }

      // ── Guaranteed leads to match MQL/SQL criteria ──
      // MQL: budget>15L, possession=1, location=Hyderabad (but budget<=25L so NOT SQL)
      const mqlGuaranteed = [
        { first: 'Meera', last: 'Reddy', budget: 1800000, status: 'FOLLOW_UP', priority: 'P2' },
        { first: 'Vikash', last: 'Nair', budget: 2200000, status: 'NEW', priority: 'P1' },
        { first: 'Anita', last: 'Rao', budget: 1650000, status: 'FOLLOW_UP', priority: 'P3' },
        { first: 'Sunil', last: 'Desai', budget: 2400000, status: 'NEW', priority: 'P2' },
      ];
      // SQL: budget>25L, location=Hyderabad
      const sqlGuaranteed = [
        { first: 'Lakshmi', last: 'Patel', budget: 4770000, status: 'NEW', priority: 'P2', possession: 1 },
        { first: 'Harsh', last: 'Iyer', budget: 3180000, status: 'FOLLOW_UP', priority: 'P1', possession: 1 },
        { first: 'Pradeep', last: 'Shah', budget: 2800000, status: 'NEW', priority: 'P1', possession: 0 },
      ];

      for (const g of mqlGuaranteed) {
        const lid = uuidv4();
        const fullName = g.first + ' ' + g.last;
        const createdAt = randomRecentDate();
        insertLead.run(lid, fullName, 'MR', g.first, null, g.last,
          pick(companies), `${g.first.toLowerCase()}.${g.last.toLowerCase()}@email.com`,
          `9${rand(100000000, 999999999)}`, g.status, g.priority, pick(allSources),
          null, null, pick(salesExecs), g.budget, 'Hyderabad', pick([30, 45, 60, 90]),
          1, null, null, null, null, null, null, ownerId, createdAt, createdAt);
        insertActivity.run(uuidv4(), lid, pick(salesExecs), 'NOTE', 'Initial enquiry received.', createdAt);
      }

      for (const g of sqlGuaranteed) {
        const lid = uuidv4();
        const fullName = g.first + ' ' + g.last;
        const createdAt = randomRecentDate();
        insertLead.run(lid, fullName, 'MR', g.first, null, g.last,
          pick(companies), `${g.first.toLowerCase()}.${g.last.toLowerCase()}@email.com`,
          `9${rand(100000000, 999999999)}`, g.status, g.priority, pick(allSources),
          null, null, pick(salesExecs), g.budget, 'Hyderabad', pick([30, 45, 60, 90]),
          g.possession ?? 0, null, null, null, null, null, null, ownerId, createdAt, createdAt);
        insertActivity.run(uuidv4(), lid, pick(salesExecs), 'NOTE', 'High-value enquiry.', createdAt);
      }

      console.log('  100 + 7 guaranteed leads seeded with activities and contacts');

      // ── Default MQL/SQL criteria (lowercase field names matching CRITERIA_FIELD_MAP) ──
      const insertCriteria = db.prepare(
        `INSERT OR IGNORE INTO qualification_criteria (id, type, field, operator, value, created_by) VALUES (?, ?, ?, ?, ?, ?)`
      );
      insertCriteria.run(uuidv4(), 'MQL', 'budget', 'greater_than', '1500000', ownerId);
      insertCriteria.run(uuidv4(), 'MQL', 'property_in_possession', 'equals', 'true', ownerId);
      insertCriteria.run(uuidv4(), 'MQL', 'location', 'equals', 'Hyderabad', ownerId);
      insertCriteria.run(uuidv4(), 'SQL', 'budget', 'greater_than', '2500000', ownerId);
      insertCriteria.run(uuidv4(), 'SQL', 'location', 'equals', 'Hyderabad', ownerId);

      console.log('  Qualification criteria seeded');

      // ── Default alert settings ──
      const insertSetting = db.prepare(
        `INSERT OR IGNORE INTO alert_settings (id, setting_key, setting_value, updated_by) VALUES (?, ?, ?, ?)`
      );
      insertSetting.run(uuidv4(), 'unattended_leads_days', '3', ownerId);
      insertSetting.run(uuidv4(), 'max_quote_revisions', '3', ownerId);
      insertSetting.run(uuidv4(), 'sql_lead_inactive_days', '5', ownerId);
      insertSetting.run(uuidv4(), 'min_calls_threshold', '3', ownerId);

      console.log('  Alert settings seeded');
    });

    transaction();

    // ── Post-seed: Apply qualification criteria to leads ──
    console.log('  Applying qualification criteria to seeded leads...');
    const CRITERIA_FIELD_MAP = {
      budget: { column: 'budget', type: 'number' },
      location: { column: 'location', type: 'string' },
      source: { column: 'source', type: 'string' },
      priority: { column: 'priority', type: 'string' },
      status: { column: 'status', type: 'string' },
      company: { column: 'company', type: 'string' },
      delivery_days: { column: 'delivery_days', type: 'number' },
      campaign_name: { column: 'campaign_name', type: 'string' },
      campaign_active: { column: 'campaign_active', type: 'boolean' },
      property_in_possession: { column: 'property_in_possession', type: 'boolean' },
      current_living_city: { column: 'current_living_city', type: 'string' },
      current_living_country: { column: 'current_living_country', type: 'string' },
    };

    function evalCrit(leadValue, operator, criterionValue, fieldType) {
      if (leadValue === null || leadValue === undefined) return false;
      if (fieldType === 'number') {
        const lv = parseFloat(leadValue), cv = parseFloat(criterionValue);
        if (isNaN(lv) || isNaN(cv)) return false;
        switch (operator) {
          case 'equals': return lv === cv;
          case 'not_equals': return lv !== cv;
          case 'greater_than': return lv > cv;
          case 'less_than': return lv < cv;
          default: return false;
        }
      }
      if (fieldType === 'boolean') {
        const lv = leadValue === 1 || leadValue === true || leadValue === '1' || leadValue === 'true';
        const cv = criterionValue === '1' || criterionValue === 'true' || criterionValue === 'yes';
        switch (operator) {
          case 'equals': return lv === cv;
          case 'not_equals': return lv !== cv;
          default: return false;
        }
      }
      const lv = String(leadValue).toLowerCase(), cv = String(criterionValue).toLowerCase();
      switch (operator) {
        case 'equals': return lv === cv;
        case 'not_equals': return lv !== cv;
        case 'contains': return lv.includes(cv);
        default: return false;
      }
    }

    const mqlCriteria = db.prepare('SELECT * FROM qualification_criteria WHERE is_active = 1 AND type = ?').all('MQL');
    const sqlCriteria = db.prepare('SELECT * FROM qualification_criteria WHERE is_active = 1 AND type = ?').all('SQL');
    const allLeads = db.prepare("SELECT * FROM leads WHERE status NOT IN ('QUOTED', 'WON', 'JUNK', 'MUQL')").all();

    let mqlCount = 0, sqlCount = 0, downgradeCount = 0;
    const ownerId2 = db.prepare("SELECT id FROM users WHERE role = 'OWNER'").get().id;

    for (const lead of allLeads) {
      let matchesMQL = mqlCriteria.length > 0 && mqlCriteria.every(c => {
        const m = CRITERIA_FIELD_MAP[c.field];
        return m ? evalCrit(lead[m.column], c.operator, c.value, m.type) : false;
      });
      let matchesSQL = sqlCriteria.length > 0 && sqlCriteria.every(c => {
        const m = CRITERIA_FIELD_MAP[c.field];
        return m ? evalCrit(lead[m.column], c.operator, c.value, m.type) : false;
      });

      const qualified = matchesSQL ? 'SQL' : matchesMQL ? 'MQL' : null;
      if (qualified && lead.status !== qualified) {
        db.prepare("UPDATE leads SET status = ?, updated_at = datetime('now') WHERE id = ?").run(qualified, lead.id);
        db.prepare(
          `INSERT INTO activities (id, lead_id, user_id, type, content, metadata) VALUES (?, ?, ?, 'STATUS_CHANGE', ?, ?)`
        ).run(uuidv4(), lead.id, ownerId2,
          `Auto-qualified from ${lead.status} to ${qualified} (criteria match)`,
          JSON.stringify({ from: lead.status, to: qualified, auto: true }));
        if (qualified === 'MQL') mqlCount++;
        else sqlCount++;
      } else if (!qualified && (lead.status === 'MQL' || lead.status === 'SQL')) {
        // Lead was randomly assigned MQL/SQL but doesn't actually match criteria — revert
        db.prepare("UPDATE leads SET status = 'FOLLOW_UP', updated_at = datetime('now') WHERE id = ?").run(lead.id);
        downgradeCount++;
      }
    }
    console.log(`  Qualified ${mqlCount} leads as MQL, ${sqlCount} leads as SQL, downgraded ${downgradeCount} leads`);

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Seeding failed:', error.message);
    throw error;
  }
}

seed();
