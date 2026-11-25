/* Server-side scoring for the AI Opportunity Scan.

   Mirrors assets/scan.js (questions, tags, score, pick, and the star boost).
   Emails use this result. Scores, titles, and HTML supplied by the browser are ignored.

   Star boost, same rule as assets/scan.js: the first of
   frustration_star, timesinks_star, outcome_star, ops_star, improve_star
   adds 4 points when it matches a trigger. Every star is still listed
   in the report, including stars on questions that do not change the score.
*/

const IND = {
  general: { name: 'General small business', short: 'your business' },
  hospitality: { name: 'Las Vegas hospitality', short: 'your establishment' },
  retail: { name: 'Retail & convenience', short: 'your store' },
  professional: { name: 'Professional services', short: 'your firm' },
  logistics: { name: 'Logistics & transportation', short: 'your operation' },
  home: { name: 'Home services & field operations', short: 'your company' },
  healthcare: { name: 'Healthcare administration', short: 'your practice' },
  restaurant: { name: 'Restaurants (no gaming)', short: 'your restaurant' }
};

const GEN_Q1 = {
  title: 'How does your business make money?',
  opts: [
    ['products', 'Selling products', 'In-store, online, or both', 'retail'],
    ['services', 'Delivering services by appointment or project', '', 'professional'],
    ['hospitality', 'Food, drinks and entertainment', 'Bars, restaurants, venues', 'hospitality'],
    ['field', 'On-site / field services', 'Repairs, installs, maintenance', 'home'],
    ['transport', 'Moving or delivering goods', '', 'logistics'],
    ['health', 'Healthcare-related services', 'Administrative side only', 'healthcare'],
    ['other', 'Something else', '', 'general']
  ]
};

const READY = [
  ['explore', 'Just exploring what’s possible'],
  ['pilot', 'Ready for a focused pilot project'],
  ['broad', 'Ready for a broader transformation'],
  ['foundation', 'We need the technology foundation first']
];

const GQ_REST = [
  { id: 'frustration', title: 'What’s your biggest business frustration right now?', type: 'multi', opts: [['staff', 'Staffing and workload'], ['admin', 'Administrative workload'], ['cost', 'Operating costs'], ['acquire', 'Winning new customers'], ['response', 'Slow responses to customers'], ['visibility', 'Reporting and visibility'], ['growth', 'Growing without chaos'], ['security', 'Technology or security worries']], text: true },
  { id: 'timesinks', title: 'Where does your team spend the most unnecessary time?', type: 'multi', opts: [['entry', 'Typing the same data into multiple places'], ['sched', 'Scheduling and rescheduling'], ['comms', 'Answering routine customer questions'], ['report', 'Building reports and spreadsheets'], ['coord', 'Chasing updates and handoffs'], ['docs', 'Handling documents, forms and intake'], ['inventory', 'Inventory, ordering and supplies'], ['invoice', 'Invoicing and payment follow-up']] },
  { id: 'tech', title: 'What technology currently supports your business?', type: 'multi', opts: [['sheets', 'Spreadsheets or paper'], ['email', 'Email and shared calendars'], ['acct', 'Accounting software'], ['pos', 'Point-of-sale (POS)'], ['crm', 'CRM or customer database'], ['schedsw', 'Scheduling or booking software'], ['industry', 'Industry-specific software'], ['cloud', 'Cloud file storage'], ['network', 'Our own servers or managed network'], ['limited', 'Very little — we’re starting from scratch']], exclusive: 'limited' },
  { id: 'outcome', title: 'What result would make the biggest difference?', type: 'multi', opts: [['time', 'Give my team time back'], ['response', 'Respond to customers faster'], ['revenue', 'Win more business'], ['visibility', 'See clearly what’s working'], ['cost', 'Reduce operating costs'], ['scale', 'Grow without adding chaos']], readiness: true }
];

const HQ = [
  { id: 'q1', title: 'What generates the most revenue for your establishment?', type: 'multi', opts: [['gaming', 'Gaming'], ['food', 'Food and restaurant sales'], ['bev', 'Alcohol and beverage sales'], ['combo', 'Combination of food, beverages and gaming'], ['unsure', 'Not sure yet']], extra: [['estname', 'Establishment name', true], ['revdetail', 'Additional revenue details', false]] },
  { id: 'promo', title: 'How do you currently promote events and attract returning customers?', type: 'multi', opts: [['social', 'Social media posts'], ['specials', 'Food and drink specials'], ['music', 'Live music and entertainment'], ['messaging', 'Customer text or email messaging'], ['calendar', 'An events calendar'], ['loyalty', 'Loyalty or player programs'], ['wom', 'Mostly word of mouth']] },
  { id: 'ops', title: 'What are the biggest operational problems?', type: 'multi', opts: [['inventory', 'Inventory and ordering'], ['waste', 'Food waste'], ['staffing', 'Staffing'], ['scheduling', 'Scheduling'], ['marketing', 'Marketing takes too much time'], ['reporting', 'Reporting'], ['slow', 'Slow nights'], ['admin', 'Manual administration']] },
  { id: 'systems', title: 'Which systems do you use?', type: 'multi', opts: [['pos', 'POS'], ['acct', 'Accounting'], ['inventorysw', 'Inventory'], ['schedsw', 'Staff scheduling'], ['marketingsw', 'Marketing / email / text tools'], ['gamingvendor', 'Gaming provider relationship'], ['sheets', 'Spreadsheets or paper'], ['limited', 'Not sure / very little']], exclusive: 'limited' },
  { id: 'improve', title: 'What improvement matters most?', type: 'multi', opts: [['traffic', 'More customer traffic'], ['fnb', 'Food and beverage profitability'], ['event', 'Event profitability'], ['efficiency', 'Operational efficiency'], ['repeat', 'More repeat visits'], ['visibility', 'Management visibility']], readiness: true }
];

const FU = {
  event: { title: 'Think about your last major live music event or gaming giveaway. Do you know what it cost, how much additional business it generated, and whether those customers came back?', opts: [['all', 'Yes — cost, lift and return visits'], ['cost', 'We know the cost, not the results'], ['rough', 'We have a rough feel'], ['no', 'Honestly, not really']] },
  entry: { title: 'Do you re-type the same information (customers, orders, hours) into more than one system?', opts: [['daily', 'Yes, every day'], ['weekly', 'Yes, a few times a week'], ['rare', 'Rarely'], ['unsure', 'Not sure']] },
  comms: { title: 'When a customer reaches out after hours or during a rush, what usually happens?', opts: [['next', 'They wait until someone is free'], ['missed', 'Some inquiries get missed'], ['covered', 'We have coverage'], ['unsure', 'Not sure']] },
  staff: { title: 'Roughly how much of your team’s week goes to admin rather than customers or core work?', opts: [['lt10', 'Less than 10%'], ['10_25', '10–25%'], ['25_50', '25–50%'], ['gt50', 'More than half'], ['unsure', 'Not sure']] },
  data: { title: 'Where does your sales and cost information live today?', opts: [['exports', 'In POS / accounting exports'], ['sheets', 'In spreadsheets'], ['scattered', 'Scattered or unsure'], ['dash', 'We already have a dashboard']] }
};

const OPP = [
  { id: 'q_comms', tier: 'quick', t: 'AI-assisted customer response', b: 'Draft accurate first responses to routine questions and requests from your approved information, with staff reviewing anything unusual before it is sent.', imp: 3, eff: 2, needs: ['email', 'crm', 'marketingsw'], tr: { f: ['response', 'acquire'], ts: ['comms'], o: ['response', 'revenue', 'traffic'] } },
  { id: 'q_mkt', tier: 'quick', t: 'Coordinated promotions assistant', b: 'Prepare consistent promotions across channels from one brief, with management approval before anything is published.', imp: 3, eff: 2, needs: ['marketingsw', 'email'], tr: { f: ['acquire'], ts: ['marketing'], o: ['revenue', 'traffic', 'repeat', 'event'] } },
  { id: 'q_docs', tier: 'quick', t: 'Document and intake automation', b: 'Capture information from forms, emails and documents once, check it, and route it to the right place automatically.', imp: 3, eff: 2, needs: ['email', 'cloud'], tr: { f: ['admin'], ts: ['docs', 'entry'], o: ['time'] } },
  { id: 'q_report', tier: 'quick', t: 'Automated weekly management report', b: 'A plain-English weekly summary assembled from the data you already have, so decisions don’t wait on someone building spreadsheets.', imp: 3, eff: 2, needs: ['acct', 'pos', 'sheets'], tr: { f: ['visibility'], ts: ['report', 'reporting'], o: ['visibility'] } },
  { id: 'q_sched', tier: 'quick', t: 'Scheduling and reminder automation', b: 'Reduce back-and-forth with automated booking, confirmations, reminders and shift-swap requests that a manager approves.', imp: 3, eff: 2, needs: ['schedsw', 'email'], tr: { f: ['staff'], ts: ['sched', 'scheduling', 'staffing'], o: ['time', 'efficiency'] } },
  { id: 'q_admin', tier: 'quick', t: 'Back-office task automation', b: 'Automate repetitive admin steps — invoice follow-ups, status updates, data clean-up — often with simple workflow tools before any AI is needed.', imp: 2, eff: 1, needs: ['acct', 'email'], tr: { f: ['admin', 'cost', 'staff'], ts: ['invoice', 'coord', 'admin'], o: ['time', 'cost', 'efficiency'] } },
  { id: 'i_sync', tier: 'integ', t: 'Connect your core systems', b: 'Integrate the applications you already use so information is entered once and flows where it is needed, ending duplicate entry.', imp: 4, eff: 3, needs: ['acct', 'pos', 'crm', 'schedsw', 'industry', 'inventorysw'], tr: { f: ['admin', 'growth'], ts: ['entry', 'coord'], o: ['time', 'scale', 'efficiency'] } },
  { id: 'i_profit', tier: 'integ', t: 'Profitability intelligence', b: 'Combine sales, labor and cost data to compare which products, services, days or promotions actually make money.', imp: 4, eff: 3, needs: ['pos', 'acct', 'sheets'], tr: { f: ['visibility', 'cost'], ts: ['report', 'reporting'], o: ['visibility', 'cost', 'fnb', 'event'] } },
  { id: 'i_crm', tier: 'integ', t: 'Customer follow-up and retention workflow', b: 'Connect inquiries, customer records and messaging so every lead gets a timely follow-up and past customers are invited back.', imp: 4, eff: 3, needs: ['crm', 'email', 'marketingsw', 'pos'], tr: { f: ['acquire', 'response'], ts: ['comms'], o: ['revenue', 'repeat', 'traffic', 'response'] } },
  { id: 'i_inv', tier: 'integ', t: 'Inventory and ordering workflow', b: 'Link sales to stock levels and ordering so reorders, waste and shortages become visible before they cost money.', imp: 4, eff: 3, needs: ['pos', 'inventorysw', 'acct'], tr: { f: ['cost'], ts: ['inventory', 'waste'], o: ['cost', 'fnb'] } },
  { id: 'i_dispatch', tier: 'integ', t: 'Dispatch and scheduling integration', b: 'Connect job requests, schedules and field updates so the office and crews work from the same live picture.', imp: 4, eff: 3, needs: ['schedsw', 'industry', 'crm'], tr: { f: ['staff', 'growth'], ts: ['sched', 'coord'], o: ['time', 'scale'] }, ind: ['logistics', 'home'] },
  { id: 'l_ops', tier: 'long', t: 'Integrated intelligent operations platform', b: 'A connected platform for forecasting, scheduling, customer engagement and reporting that grows with the business.', imp: 5, eff: 5, needs: ['pos', 'acct', 'crm', 'industry'], tr: { f: ['growth', 'visibility'], o: ['scale', 'visibility', 'fnb', 'event'] } },
  { id: 'l_forecast', tier: 'long', t: 'Demand forecasting and resource planning', b: 'Use your own history to anticipate busy and slow periods, then plan staffing, purchasing and promotions around them.', imp: 5, eff: 4, needs: ['pos', 'schedsw', 'inventorysw', 'acct'], tr: { f: ['staff', 'cost'], ts: ['inventory', 'sched', 'scheduling', 'slow', 'waste'], o: ['cost', 'efficiency', 'traffic'] } },
  { id: 'l_agents', tier: 'long', t: 'Coordinated AI agents with approval boundaries', b: 'Specialized assistants that handle multi-step routine work across systems, operating within defined limits and escalating to people for approval.', imp: 5, eff: 5, needs: ['crm', 'acct', 'cloud', 'industry'], tr: { f: ['admin', 'growth', 'staff'], ts: ['coord', 'entry'], o: ['scale', 'time'] } },
  { id: 'l_found', tier: 'long', t: 'Secure technology foundation roadmap', b: 'A staged plan for connectivity, identity, data organization and security so later automation and AI have something solid to build on.', imp: 4, eff: 3, needs: [], tr: { f: ['security', 'growth'], o: ['scale'] }, foundation: true }
];

const OV = {
  hospitality: {
    q_mkt: { t: 'Intelligent Events and Promotions', b: 'An AI-assisted system that prepares coordinated promotions for live music, food specials and other approved events, with management review before publication. Gaming-related promotions follow your approved operator procedures.' },
    i_profit: { t: 'Profitability Intelligence', b: 'Combine available POS data, event expenses, labor information and food costs to compare the financial performance of different events and promotions.' },
    l_ops: { t: 'Intelligent Hospitality Operations', b: 'An integrated business platform supporting demand forecasting, inventory, scheduling, customer engagement, marketing analytics and management reporting.' },
    i_inv: { t: 'Inventory, waste and ordering intelligence', b: 'Connect sales to bar and kitchen inventory so pours, waste and reorders are visible by shift and by event.' }
  },
  restaurant: { i_inv: { t: 'Food cost and ordering intelligence', b: 'Tie menu sales to ingredient usage and supplier orders so food cost and waste become visible week to week.' } },
  retail: { l_forecast: { t: 'Demand forecasting for inventory and staffing', b: 'Use your sales history to anticipate seasonal demand and staff and stock accordingly.' } },
  healthcare: {
    q_comms: { t: 'Administrative inquiry assistant', b: 'Help staff answer routine scheduling and administrative questions from approved information. It does not give clinical advice or make clinical decisions.' },
    q_docs: { t: 'Administrative intake and records workflow', b: 'Reduce manual re-entry of administrative intake information, with access controls and human review appropriate for health information.' }
  },
  home: { q_comms: { t: 'Service request capture and estimate drafts', b: 'Capture service requests completely the first time and draft estimates for staff to review and send.' } },
  logistics: { q_docs: { t: 'Shipping documentation automation', b: 'Extract and route information from bills of lading, PODs and delivery paperwork so it is typed once.' } },
  professional: { q_docs: { t: 'Client onboarding and document workflow', b: 'Collect, check and organize client documents and onboarding steps automatically, with secure storage.' } }
};

const TIER_LABELS = { quick: 'Quick win', integ: 'Integration opportunity', long: 'Longer-term roadmap' };

function has(a, v) { return Array.isArray(a) && a.indexOf(v) > -1; }
function any(a, vs) { return vs.some(function (v) { return has(a, v); }); }

export function industryIds() { return Object.keys(IND); }
export function readyIds() { return READY.map(function (r) { return r[0]; }); }
export function followUpIds() { return Object.keys(FU); }
export function opportunityIds() { return OPP.map(function (op) { return op.id; }); }

export function questionsFor(industry) {
  if (industry === 'hospitality') return HQ.map(cloneQ);
  let q1;
  if (industry && industry !== 'general' && IND[industry]) {
    const specific = specificQ1(industry);
    q1 = specific || generalQ1();
  } else {
    q1 = generalQ1();
  }
  return [q1].concat(GQ_REST.map(cloneQ));
}

function specificQ1(industry) {
  const titles = {
    retail: 'What drives most of your revenue?',
    professional: 'How does your firm earn most of its revenue?',
    logistics: 'What generates most of your revenue?',
    home: 'Where does most of your revenue come from?',
    healthcare: 'How is most of your revenue generated?',
    restaurant: 'What generates the most revenue for your restaurant?'
  };
  const opts = {
    retail: [['instore', 'In-store sales'], ['online', 'Online or delivery orders'], ['both', 'A mix of in-store and online'], ['wholesale', 'Wholesale or B2B accounts'], ['unsure', 'Not sure yet']],
    professional: [['billable', 'Billable hours'], ['project', 'Fixed-fee projects'], ['retainer', 'Retainers or recurring clients'], ['mixed', 'A mix of these'], ['unsure', 'Not sure yet']],
    logistics: [['delivery', 'Local delivery runs'], ['freight', 'Freight / long-haul loads'], ['contract', 'Dedicated contracts for a few customers'], ['warehouse', 'Warehousing and fulfillment'], ['unsure', 'Not sure yet']],
    home: [['service', 'Service calls and repairs'], ['install', 'Installations and projects'], ['maint', 'Maintenance plans and recurring visits'], ['emerg', 'Emergency / after-hours work'], ['unsure', 'Not sure yet']],
    healthcare: [['insurance', 'Insurance-billed appointments'], ['selfpay', 'Self-pay services'], ['mixed', 'A mix of insurance and self-pay'], ['programs', 'Memberships or programs'], ['unsure', 'Not sure yet']],
    restaurant: [['dinein', 'Dine-in food sales'], ['bev', 'Beverage and bar sales'], ['offprem', 'Takeout, delivery and catering'], ['mixed', 'A balanced combination'], ['unsure', 'Not sure yet']]
  };
  if (!opts[industry]) return null;
  return {
    id: 'q1',
    title: titles[industry],
    type: 'multi',
    opts: opts[industry],
    extra: [['bizname', 'Business name', true]],
    text: true
  };
}

function generalQ1() {
  return {
    id: 'q1',
    title: GEN_Q1.title,
    type: 'multi',
    opts: GEN_Q1.opts.map(function (o) { return [o[0], o[1]]; }),
    extra: [['bizname', 'Business name', true]],
    text: true
  };
}

function cloneQ(q) {
  return {
    id: q.id,
    title: q.title,
    type: q.type,
    opts: q.opts.map(function (o) { return o.slice(); }),
    extra: q.extra ? q.extra.map(function (x) { return x.slice(); }) : undefined,
    text: !!q.text,
    exclusive: q.exclusive || null,
    readiness: !!q.readiness
  };
}

/** Allowlists the validator uses. Unknown ids are rejected. */
export function answerSpec(industry) {
  const spec = {};
  questionsFor(industry).forEach(function (q) {
    spec[q.id] = {
      values: q.opts.map(function (o) { return o[0]; }),
      star: q.type === 'multi',
      text: !!q.text,
      exclusive: q.exclusive || null,
      readiness: !!q.readiness
    };
    (q.extra || []).forEach(function (x) {
      spec[x[0]] = { text: true, max: 120, pii: !!x[2] };
    });
  });
  return spec;
}

export function followUpSpec(id) {
  if (!id || !FU[id]) return null;
  return { title: FU[id].title, values: FU[id].opts.map(function (o) { return o[0]; }), labels: Object.fromEntries(FU[id].opts) };
}

function effInd(industry, answers) {
  if (industry && industry !== 'general') return industry;
  const v = answers.q1;
  const vals = Array.isArray(v) ? v : (v ? [v] : []);
  for (let i = 0; i < vals.length; i++) {
    const o = GEN_Q1.opts.filter(function (x) { return x[0] === vals[i]; })[0];
    if (o && o[3]) return o[3];
  }
  return 'general';
}

function tags(industry, answers) {
  const t = { f: [], ts: [], tech: [], o: [], ready: answers.ready || 'explore' };
  if (industry === 'hospitality') {
    const ops = answers.ops || [];
    const pr = answers.promo || [];
    const map = { inventory: ['inventory'], waste: ['waste', 'inventory'], staffing: ['staffing'], scheduling: ['scheduling', 'sched'], marketing: ['marketing'], reporting: ['reporting', 'report'], slow: ['slow'], admin: ['admin', 'entry'] };
    ops.forEach(function (o) { t.ts = t.ts.concat(map[o] || []); });
    if (!has(pr, 'messaging') && !has(pr, 'loyalty')) t.ts.push('comms');
    if (has(pr, 'wom') || pr.length <= 1) t.f.push('acquire');
    if (any(ops, ['staffing', 'scheduling'])) t.f.push('staff');
    if (any(ops, ['reporting'])) t.f.push('visibility');
    if (any(ops, ['inventory', 'waste'])) t.f.push('cost');
    if (any(ops, ['admin', 'marketing'])) t.f.push('admin');
    if (any(pr, ['music', 'specials', 'calendar'])) t.ts.push('marketing');
    t.tech = (answers.systems || []).slice();
    const imps = Array.isArray(answers.improve) ? answers.improve : (answers.improve ? [answers.improve] : []);
    imps.forEach(function (i) { if (i) t.o.push(i); });
    if (any(imps, ['traffic', 'repeat'])) t.f.push('acquire');
    if (has(imps, 'efficiency')) t.f.push('staff');
    if (any(imps, ['fnb', 'event'])) t.f.push('visibility');
  } else {
    t.f = (answers.frustration || []).slice();
    t.ts = (answers.timesinks || []).slice();
    t.tech = (answers.tech || []).slice();
    const outs = Array.isArray(answers.outcome) ? answers.outcome : (answers.outcome ? [answers.outcome] : []);
    outs.forEach(function (o) { if (o) t.o.push(o); });
  }
  return t;
}

function score(op, t, ind, answers) {
  let s = 0;
  if (op.ind && op.ind.indexOf(ind) === -1) return -1;
  const f = t.f || [], ts = t.ts || [], o = t.o || [], tech = t.tech || [];
  (op.tr.f || []).forEach(function (v) { if (has(f, v)) s += 3; });
  (op.tr.ts || []).forEach(function (v) { if (has(ts, v)) s += 2; });
  (op.tr.o || []).forEach(function (v) { if (has(o, v)) s += 2; });
  if (op.needs && op.needs.length) {
    const hasNeed = op.needs.some(function (n) { return has(tech, n); });
    if (hasNeed) s += 1; else s -= 1;
  }
  if (op.foundation && has(f, 'security')) s += 2;
  const star = answers.frustration_star || answers.timesinks_star || answers.outcome_star || answers.ops_star || answers.improve_star;
  if (star && ((op.tr.f || []).indexOf(star) > -1 || (op.tr.ts || []).indexOf(star) > -1 || (op.tr.o || []).indexOf(star) > -1)) s += 4;
  return s;
}

function present(op, ind) {
  const ov = (OV[ind] || {})[op.id];
  const merged = ov ? Object.assign({}, op, ov) : op;
  return {
    id: merged.id,
    tier: merged.tier,
    tierLabel: TIER_LABELS[merged.tier] || merged.tier,
    title: merged.t,
    summary: merged.b,
    impact: merged.imp,
    effort: merged.eff,
    feasibility: 6 - merged.eff
  };
}

function describe(industry, answers) {
  return questionsFor(industry).map(function (q) {
    const raw = answers[q.id];
    const selected = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    const star = answers[q.id + '_star'] || null;
    const picks = selected.map(function (id) {
      const opt = q.opts.find(function (o) { return o[0] === id; });
      return { id: id, label: opt ? opt[1] : id, starred: star === id };
    });
    const extras = (q.extra || []).map(function (x) {
      return { id: x[0], label: x[1], value: answers[x[0]] || '', pii: !!x[2] };
    }).filter(function (x) { return x.value; });
    return {
      id: q.id,
      title: q.title,
      picks: picks,
      text: answers[q.id + '_text'] || '',
      extras: extras
    };
  });
}

function describeFollowUp(followUp, followUpAnswer) {
  if (!followUp || !FU[followUp]) return null;
  const opt = FU[followUp].opts.find(function (o) { return o[0] === followUpAnswer; });
  return {
    id: followUp,
    title: FU[followUp].title,
    answerId: opt ? opt[0] : null,
    answerLabel: opt ? opt[1] : null
  };
}

function listStars(described) {
  const stars = [];
  described.forEach(function (q) {
    q.picks.forEach(function (p) {
      if (p.starred) stars.push({ questionId: q.id, question: q.title, id: p.id, label: p.label });
    });
  });
  return stars;
}

/**
 * @param {{industry:string, answers:object, followUp:?string, followUpAnswer:?string}} scan
 * answers must already be validated and cleaned.
 */
export function evaluateScan(scan) {
  const industry = scan.industry;
  const answers = scan.answers || {};
  const ind = effInd(industry, answers);
  const t = tags(industry, answers);
  const scored = [];
  OPP.forEach(function (op) {
    const sc = score(op, t, ind, answers);
    if (sc > 0) scored.push({ op: op, sc: sc });
  });
  scored.sort(function (a, b) { return b.sc - a.sc || (a.op.tier === 'quick' ? -1 : 1); });
  const tiers = { quick: [], integ: [], long: [] };
  scored.forEach(function (x) {
    if (tiers[x.op.tier].length < 3) {
      tiers[x.op.tier].push(Object.assign({ match: x.sc }, present(x.op, ind)));
    }
  });
  const described = describe(industry, answers);
  const ready = READY.find(function (r) { return r[0] === (answers.ready || 'explore'); });
  const ranked = ['quick', 'integ', 'long'].reduce(function (acc, tier) { return acc.concat(tiers[tier]); }, []);
  const fixFirst = ranked[0] || null;
  const also = ranked[1] || null;
  return {
    track: industry,
    trackName: IND[industry] ? IND[industry].name : industry,
    industry: ind,
    industryName: IND[ind] ? IND[ind].name : ind,
    industryShort: IND[ind] ? IND[ind].short : 'your business',
    readiness: answers.ready || 'explore',
    readinessLabel: ready ? ready[1] : READY[0][1],
    questions: described,
    starred: listStars(described),
    followUp: describeFollowUp(scan.followUp, scan.followUpAnswer),
    tiers: tiers,
    ranked: ranked,
    fixFirst: fixFirst,
    also: also
  };
}

export function shortScanSummary(report) {
  if (!report.fixFirst) return 'AI Opportunity Scan. No single starting point stood out; a short conversation would help.';
  const second = report.also ? ', then ' + report.also.title : '';
  return ('AI Opportunity Scan. Start with ' + report.fixFirst.title + second + '.').slice(0, 280);
}
