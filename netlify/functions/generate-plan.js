// Apropos Business Center — AG ENGINEERING OS™ onboarding engine
// Intake -> AI diagnosis -> readiness score -> plan -> dashboard -> Supabase record.

const OPENAI_MODEL = process.env.PLAN_MODEL || 'gpt-4o-mini';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_PLAN_MODEL || process.env.PLAN_MODEL || 'claude-sonnet-4-6';

const SECTIONS = [
  'Executive Summary',
  'Company Overview',
  'Products & Services',
  'Market & Target Customer',
  'Competitive Edge',
  'Marketing & Sales Strategy',
  'Operations',
  'Milestones & Roadmap',
  'Financial Outline',
  'Funding Needs',
];

const { recommend } = require('./_recommend');

function clean(s, max = 600) { return String(s || '').trim().slice(0, max); }
function arr(v) { return Array.isArray(v) ? v.map(x => clean(x, 80)).filter(Boolean) : []; }

function intakeFrom(body) {
  const city = clean(body.city, 80);
  const state = clean(body.state, 80);
  return {
    fullName: clean(body.fullName || body.ownerName, 120),
    email: clean(body.email, 160).toLowerCase(),
    phone: clean(body.phone, 60),
    businessName: clean(body.businessName, 140) || 'Your Business',
    industry: clean(body.industry, 120),
    city,
    state,
    location: clean(body.location, 160) || [city, state].filter(Boolean).join(', '),
    businessStageInput: clean(body.businessStage || body.stage, 80) || 'not_sure',
    businessStatus: arr(body.businessStatus),
    servicesNeeded: arr(body.servicesNeeded),
    otherNeeds: clean(body.otherNeeds || body.idea || body.goal, 1200),
    targetCustomer: clean(body.targetCustomer || body.target, 700),
  };
}

function readinessScore(i, diagnosis) {
  const s = new Set(i.businessStatus);
  const n = new Set(i.servicesNeeded);
  const registrationExists = s.has('registered') || s.has('gov_regs');
  const einCredit = registrationExists || s.has('ein');
  const foundation = (registrationExists ? 10 : 0) + (einCredit ? 10 : 0) + (s.has('bank') ? 10 : 0) + ((registrationExists && einCredit) || n.has('documents') ? 10 : 0);
  const marketing = (s.has('website') ? 10 : 0) + (s.has('social') ? 5 : 0) + (s.has('customers') ? 5 : 0);
  const operations = (s.has('employees') ? 5 : 0) + (n.has('documents') || registrationExists ? 5 : 0) + (n.has('automation') ? 5 : 0);
  const growth = (n.has('funding') ? 5 : 0) + (n.has('marketing') || n.has('customers') ? 5 : 0) + (i.businessStageInput === 'growing' || diagnosis.businessStage === 'GROW' ? 5 : 0);
  const government = (registrationExists ? 5 : 0) + (s.has('capability') ? 5 : 0);
  const total = foundation + marketing + operations + growth + government;
  let rating = 'Starting Point';
  if (total >= 75) rating = 'Strong Foundation';
  else if (total >= 50) rating = 'Building Momentum';
  else if (total >= 25) rating = 'Early Foundation';
  return {
    total,
    max: 100,
    rating,
    categories: [
      { name: 'Foundation', score: foundation, max: 40 },
      { name: 'Marketing', score: marketing, max: 20 },
      { name: 'Operations', score: operations, max: 15 },
      { name: 'Growth', score: growth, max: 15 },
      { name: 'Government Readiness', score: government, max: 10 },
    ],
  };
}

function actionPlan(i, diagnosis) {
  const wantsContracts = diagnosis.businessStage === 'WIN CONTRACTS';
  const wantsFunding = diagnosis.businessStage === 'GROW' || i.servicesNeeded.includes('funding');
  return [
    { week: 'Week 1', title: 'Foundation', items: ['Review your Business Assessment Report.', 'Handle the first missing requirement.', 'Save your business plan and confirm your core offer.'] },
    { week: 'Week 2', title: 'Brand & Website', items: ['Clarify your brand message.', 'Start your website or update the current site.', 'Create or refine social profiles.'] },
    { week: 'Week 3', title: wantsContracts ? 'Capability & Opportunities' : 'Marketing & Customers', items: wantsContracts ? ['Prepare capability statement details.', 'Review registration requirements.', 'Explore state or federal opportunity paths.'] : ['Create first promotional messages.', 'Build a customer outreach list.', 'Use the Marketing Agent or AI Advisor for campaign ideas.'] },
    { week: 'Week 4', title: wantsFunding ? 'Funding & Launch Readiness' : 'Launch & Optimization', items: wantsFunding ? ['Prepare use-of-funds notes.', 'Gather documents funders may request.', 'Review the first 30 days with your AI Business Advisor.'] : ['Launch or promote the first offer.', 'Collect feedback from prospects or customers.', 'Refine the next 30-day plan.'] },
  ];
}

function journeyTimeline(i, diagnosis) {
  const s = new Set(i.businessStatus);
  const has = key => s.has(key);
  const registrationExists = has('registered') || has('gov_regs');
  return [
    { label: 'Profile Created', status: 'complete' },
    { label: 'Assessment Generated', status: 'complete' },
    { label: 'Business Plan Generated', status: 'complete' },
    { label: 'Business Registered', status: registrationExists ? 'complete' : 'pending' },
    { label: 'Website Started', status: has('website') ? 'complete' : 'pending' },
    { label: 'Marketing Activated', status: has('social') || has('customers') ? 'complete' : 'pending' },
    { label: 'Funding Prepared', status: i.servicesNeeded.includes('funding') ? 'pending' : 'future' },
    { label: 'Government Readiness Complete', status: registrationExists && has('capability') ? 'complete' : (diagnosis.businessStage === 'WIN CONTRACTS' ? 'pending' : 'future') },
  ];
}

function serviceTimeline(recommendedServices) {
  const immediate = ['business_plan', 'formation', 'documents', 'website', 'branding', 'marketing', 'customers', 'assistant'];
  return {
    now: recommendedServices.filter(s => immediate.includes(s.key)).slice(0, 5),
    later: recommendedServices.filter(s => !immediate.includes(s.key)).slice(0, 5),
  };
}

function truthyStatusValue(value) {
  return ['yes', 'true', 'checked', 'on', '1'].includes(String(value || '').trim().toLowerCase());
}

function capgenAccessFromIntake(i) {
  const statuses = new Set((i.businessStatus || []).map(v => String(v || '').trim().toLowerCase()));
  return statuses.has('registered') || statuses.has('gov_regs');
}

function makeAccessCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function firstAccessCode(row) {
  return row?.login_code || row?.capgen_access_code || null;
}

function buildPlanPrompt(i, diagnosis) {
  return `You are the AI Business Agent for Apropos Business Center, an online full-service business center. Write a practical business plan for the client and use the intake data to make smart assumptions.

CLIENT INTAKE
- Name: ${i.fullName || '(not provided)'}
- Email: ${i.email || '(not provided)'}
- Phone: ${i.phone || '(not provided)'}
- Business name: ${i.businessName}
- Industry: ${i.industry || '(not provided)'}
- Location: ${i.location || '(not provided)'}
- Business stage selected: ${i.businessStageInput}
- Business status checked: ${i.businessStatus.join(', ') || '(none)'}
- Existing registration foundation: ${capgenAccessFromIntake(i) ? 'Yes — build forward from existing Federal registration or State licensed corporation status. Do not tell this client to get an EIN as an immediate priority.' : 'No registration foundation confirmed.'}
- Services requested: ${i.servicesNeeded.join(', ') || '(none)'}
- Target customer: ${i.targetCustomer || '(not provided)'}
- Other needs: ${i.otherNeeds || '(not provided)'}
- Diagnosed path: ${diagnosis.businessStage}
- Missing items: ${diagnosis.missingItems.join(', ') || 'None identified'}

Write a tailored business plan with EXACTLY these sections, each as a "## " markdown heading, in this order:
${SECTIONS.map(s => '## ' + s).join('\n')}

Rules:
- Plainspoken, specific, and action-oriented.
- No placeholders unless truly unavoidable.
- Include concrete first moves that connect to the Apropos Business Center services.
- End after the Funding Needs section.`;
}

async function openAiPlan(i, diagnosis) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.45,
      max_tokens: 3200,
      messages: [
        { role: 'system', content: 'You write concise, practical small-business plans and recommendations.' },
        { role: 'user', content: buildPlanPrompt(i, diagnosis) },
      ],
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || 'OpenAI plan generation failed');
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty OpenAI response');
  return text;
}

async function anthropicPlan(i, diagnosis) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 3200, messages: [{ role: 'user', content: buildPlanPrompt(i, diagnosis) }] }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || 'Anthropic plan generation failed');
  const text = (data.content || []).map(c => c.text || '').join('').trim();
  if (!text) throw new Error('Empty Anthropic response');
  return text;
}

function starterPlan(i, diagnosis) {
  const ind = i.industry || 'your industry';
  const loc = i.location || 'your market';
  return `## Executive Summary
${i.businessName} is positioned as a ${diagnosis.businessStage.toLowerCase()}-path business in ${ind}${loc ? ' serving ' + loc : ''}. The immediate priority is to organize the business foundation, clarify the offer, and use the Apropos Business Center to move from idea or scattered activity into a structured action plan.

## Company Overview
The business should operate with a clear legal and operational foundation: registration, EIN, business banking, basic documents, and a simple customer-facing presence. Missing items identified during intake should be handled first because they affect funding, marketing, and contract readiness.

## Products & Services
The first offer should be simple, specific, and easy to explain. Focus on the service or product most likely to generate the first paying customers, then expand once demand is proven.

## Market & Target Customer
The target customer should be defined by need, location, urgency, and ability to pay. If the customer profile is unclear, the first marketing task is to identify who has the problem and where they already look for a solution.

## Competitive Edge
The business should lead with a clear promise, fast response, reliable execution, and a professional online presence. The edge must be easy for customers to understand in one sentence.

## Marketing & Sales Strategy
Start with a website, a strong offer, consistent social content, direct outreach, and follow-up. The Marketing Agent and AI Business Advisor can turn this into weekly content and daily customer-facing actions.

## Operations
Document how the business receives inquiries, quotes work, delivers service, collects payment, and follows up. Simple systems should be created before volume increases.

## Milestones & Roadmap
First 7 days: complete missing foundation items and save this plan. First 30 days: launch website and marketing. First 90 days: build a repeatable customer acquisition process and prepare funding or contract materials if needed.

## Financial Outline
Track startup costs, monthly expenses, price per sale, expected sales volume, and break-even point. The first goal is not complexity; it is clarity around how many customers are needed to cover costs and create profit.

## Funding Needs
Funding should be tied to specific uses such as website launch, equipment, marketing, inventory, or working capital. Before applying, prepare documents, business plan, basic financial assumptions, and a clear use-of-funds statement.`;
}

async function sendWelcomeEmail(i, diagnosis, readiness, trialEnd, accessCode, capgenAccess = false) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL || !i.email) return false;
  const SITE = 'https://aibizcenter.aproposgroupllc.com';
  const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const first = esc((i.fullName || '').split(' ')[0] || 'there');
  const score = readiness && readiness.total != null ? readiness.total : '';
  const capgenAccessCode = esc(accessCode || '');
  const capgenBlock = capgenAccess && capgenAccessCode ? `<div style="background:#0F2A6A;border-radius:12px;padding:20px 24px;margin:24px 0;text-align:center">
  <p style="color:#C9A84C;font-size:13px;font-weight:800;letter-spacing:.15em;text-transform:uppercase;margin:0 0 8px">Your Government Contract Intelligence Access</p>
  <p style="color:rgba(255,255,255,.8);font-size:14px;margin:0 0 12px">Your Business Center membership includes full access to our CapGen contract intelligence suite. Use your access code below to sign in.</p>
  <p style="color:#C9A84C;font-size:13px;font-weight:800;letter-spacing:.1em;margin:0 0 6px">YOUR ACCESS CODE</p>
  <p style="color:#ffffff;font-size:32px;font-weight:900;letter-spacing:.2em;margin:0 0 12px">${capgenAccessCode}</p>
  <p style="color:rgba(255,255,255,.7);font-size:12px;margin:0 0 16px">Use this code on any of the three platforms below</p>
  <p style="color:#fff;font-size:13px;margin:4px 0">Federal: <a href="https://capgen.aproposgroupllc.com" style="color:#C9A84C">capgen.aproposgroupllc.com</a></p>
  <p style="color:#fff;font-size:13px;margin:4px 0">Nevada: <a href="https://nevadastategen.aproposgroupllc.com" style="color:#C9A84C">nevadastategen.aproposgroupllc.com</a></p>
  <p style="color:#fff;font-size:13px;margin:4px 0">California: <a href="https://calstategen.aproposgroupllc.com" style="color:#C9A84C">calstategen.aproposgroupllc.com</a></p>
</div>` : '';
  let endStr = ''; try { endStr = trialEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); } catch (_) { endStr = trialEnd.toISOString().slice(0, 10); }
  const priorities = ((diagnosis.missingItems && diagnosis.missingItems.length ? diagnosis.missingItems : diagnosis.nextSteps) || []).slice(0, 3);
  const priHtml = priorities.length
    ? priorities.map((p, idx) => `<tr><td style="padding:6px 0;color:#10623f;font-weight:800;width:26px;vertical-align:top">${idx + 1}.</td><td style="padding:6px 0;color:#3c5249">${esc(p)}</td></tr>`).join('')
    : `<tr><td colspan="2" style="padding:6px 0;color:#3c5249">No major gaps flagged — keep building with your advisor.</td></tr>`;
  const subject = `Welcome to the Apropos Business Center, ${first}`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:26px;color:#10241c">
    <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#c79a3e;font-weight:700;margin-bottom:12px">Apropos Business Center&trade;</div>
    <h1 style="font-family:Georgia,serif;font-size:24px;line-height:1.2;margin:0 0 6px">Welcome, ${first} — your assessment is ready.</h1>
    <p style="font-size:15px;line-height:1.6;color:#3c5249;margin:0 0 18px">We've reviewed <b>${esc(i.businessName)}</b> and built your assessment, plan, and recommended path inside the Business Center.</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 18px"><tr>
      <td style="background:#e6f1ea;border:1px solid #cfe3d6;border-radius:12px;padding:16px;text-align:center;width:46%">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#3c5249;font-weight:700">Readiness Score</div>
        <div style="font-family:Georgia,serif;font-size:34px;font-weight:800;color:#0a4a2f;line-height:1.1">${score}<span style="font-size:16px;color:#3c5249">/100</span></div>
      </td>
      <td style="width:8px"></td>
      <td style="background:#fbf9f3;border:1px solid #e3ddcf;border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:.1em;color:#3c5249;font-weight:700">Recommended Path</div>
        <div style="font-family:Georgia,serif;font-size:22px;font-weight:800;color:#10623f;line-height:1.2;margin-top:6px">${esc(diagnosis.businessStage)}</div>
      </td>
    </tr></table>
    <div style="font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#7a8a82;font-weight:700;margin:0 0 6px">Your Top 3 Priorities</div>
    <table style="width:100%;border-collapse:collapse;font-size:15px;margin:0 0 20px">${priHtml}</table>
    <div style="background:#fff8e8;border:1px solid #ead3a0;border-radius:12px;padding:14px 16px;font-size:14px;color:#6f4d05;margin:0 0 20px">&#9203; <b>Your 14-day free access is active</b> and runs through <b>${endStr}</b>. Keep everything you build — cancel anytime.</div>
    ${capgenBlock}
    <a href="${SITE}/#assistant" style="display:inline-block;background:#10623f;color:#fff;text-decoration:none;font-weight:800;padding:14px 26px;border-radius:10px;margin:0 0 10px">Complete your profile with your advisor &rarr;</a>
    <p style="font-size:13px;color:#7a8a82;margin:6px 0 0">Return to your dashboard anytime: <a href="${SITE}" style="color:#10623f">${SITE}</a></p>
    <p style="font-size:12px;color:#9aa8a0;margin-top:22px">&copy; 2026 Apropos Group LLC &middot; APROPOS BUSINESS CENTER&trade; &middot; AG ENGINEERING OS&trade;</p>
  </div>`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to: [i.email], subject, html }),
  });
  return r.ok;
}

async function saveIntakeRecord(i, diagnosis, recommendedServices, plan, mode, emailSent, trialStart, trialEnd, readiness, actionPlanData, journeyData) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { saved: false, id: null, error: 'Supabase env not configured' };
  const payload = {
    full_name: i.fullName,
    email: i.email,
    phone: i.phone || null,
    business_name: i.businessName,
    industry: i.industry,
    city: i.city,
    state: i.state,
    business_stage_input: i.businessStageInput,
    business_status: i.businessStatus,
    services_needed: i.servicesNeeded,
    other_needs: i.otherNeeds || null,
    target_customer: i.targetCustomer || null,
    ai_mode: mode,
    diagnosed_stage: diagnosis.businessStage,
    missing_items: diagnosis.missingItems,
    recommended_services: recommendedServices,
    next_steps: diagnosis.nextSteps,
    business_plan: plan,
    trial_start: trialStart.toISOString(),
    trial_end: trialEnd.toISOString(),
    welcome_email_sent: emailSent,
  };
  const url = `${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/abc_business_center_intakes`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) return { saved: false, id: null, error: data?.message || 'Supabase insert failed' };
  return { saved: true, id: Array.isArray(data) ? data[0]?.id : data?.id, error: null };
}

async function upsertCapGenProfile(i, H) {
  const baseUrl = `${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/capgen_bc_profiles`;
  const payload = {
    email: i.email,
    full_name: i.fullName,
    business_name: i.businessName,
    industry: i.industry,
    city: i.city,
    state: i.state,
    member_type: 'bc_member',
    profile_complete: true,
  };
  const r = await fetch(baseUrl, {
    method: 'POST',
    headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(payload),
  });
  if (r.ok) return { saved: true, error: null };
  const data = await r.json().catch(() => null);
  return { saved: false, error: data?.message || 'capgen_bc_profiles upsert failed' };
}

async function markMemberCapGenQualified(base, H, memberId) {
  const r = await fetch(`${base}?id=eq.${encodeURIComponent(memberId)}`, {
    method: 'PATCH',
    headers: { ...H, prefer: 'return=minimal' },
    body: JSON.stringify({ capgen_qualified: true }),
  });
  if (r.ok) return { saved: true, error: null };
  const data = await r.json().catch(() => null);
  return { saved: false, error: data?.message || 'capgen_qualified update failed' };
}

async function saveMember(i, diagnosis, readiness, trialStart, trialEnd) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { saved: false, error: 'Supabase env not configured' };
  const capgenAccess = capgenAccessFromIntake(i);
  const base = `${process.env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/biz_center_members`;
  const H = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' };
  const profile = {
    full_name: i.fullName,
    phone: i.phone || null,
    business_name: i.businessName,
    industry: i.industry,
    city: i.city,
    state: i.state,
    business_stage: diagnosis.businessStage,
    business_status: i.businessStatus,
    services_needed: i.servicesNeeded,
    other_needs: i.otherNeeds || null,
    target_customer: i.targetCustomer || null,
    readiness_score: readiness.total,
    last_visit: new Date().toISOString(),
  };

  try {
    const found = await fetch(`${base}?email=eq.${encodeURIComponent(i.email)}&select=id,login_code,capgen_access_code`, { headers: H }).then(r => r.json()).catch(() => []);
    let saved = false;
    let returning = false;
    let memberId = null;
    let accessCode = null;

    if (Array.isArray(found) && found.length) {
      returning = true;
      memberId = found[0]?.id || null;
      accessCode = capgenAccess ? firstAccessCode(found[0]) : null;
      const r = await fetch(`${base}?email=eq.${encodeURIComponent(i.email)}`, { method: 'PATCH', headers: { ...H, prefer: 'return=minimal' }, body: JSON.stringify(profile) });
      saved = r.ok;
    } else {
      const insert = { ...profile, email: i.email, subscription_status: 'trial', trial_start: trialStart.toISOString(), trial_end: trialEnd.toISOString() };
      const r = await fetch(base, { method: 'POST', headers: { ...H, prefer: 'return=representation' }, body: JSON.stringify(insert) });
      const inserted = await r.json().catch(() => []);
      saved = r.ok;
      memberId = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;
    }

    if (capgenAccess && saved) {
      if (!accessCode) {
        accessCode = makeAccessCode();
        await fetch(`${base}?email=eq.${encodeURIComponent(i.email)}`, { method: 'PATCH', headers: { ...H, prefer: 'return=minimal' }, body: JSON.stringify({ login_code: accessCode }) });
      }

      if (!memberId) {
        const memberRows = await fetch(`${base}?email=eq.${encodeURIComponent(i.email)}&select=id`, { headers: H }).then(r => r.json()).catch(() => []);
        memberId = Array.isArray(memberRows) ? memberRows[0]?.id : null;
      }
    }

    const capgenQualifiedUpdate = capgenAccess && memberId ? await markMemberCapGenQualified(base, H, memberId) : { saved: false, error: null };
    const capgenProfile = capgenAccess ? await upsertCapGenProfile(i, H) : { saved: false, error: null };

    return {
      saved,
      returning,
      accessCode: capgenAccess ? accessCode : null,
      capgen_access: capgenAccess,
      capgenAccess,
      capgen_qualified: capgenAccess,
      capgenQualified: capgenAccess,
      capgenQualifiedUpdate,
      capgenProfile,
    };
  } catch (e) { return { saved: false, error: e.message || 'member save failed', capgen_access: capgenAccess, capgenAccess, capgen_qualified: capgenAccess, capgenQualified: capgenAccess }; }
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad JSON' }) }; }
  const i = intakeFrom(body);
  if (!i.fullName || !i.email || !i.businessName || !i.industry || !i.city || !i.state) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Please complete the required contact and business fields.' }) };
  }

  const diagnosis = recommend({ businessStatus: i.businessStatus, servicesNeeded: i.servicesNeeded, businessStageInput: i.businessStageInput });
  let plan, mode;
  try {
    if (process.env.OPENAI_API_KEY) { plan = await openAiPlan(i, diagnosis); mode = 'openai'; }
    else if (process.env.ANTHROPIC_API_KEY) { plan = await anthropicPlan(i, diagnosis); mode = 'anthropic'; }
    else { plan = starterPlan(i, diagnosis); mode = 'starter'; }
  } catch (_) { plan = starterPlan(i, diagnosis); mode = 'starter-fallback'; }

  const recommendedServices = diagnosis.recommendedServices;
  const trialStart = new Date();
  const trialEnd = new Date(trialStart.getTime() + 14 * 24 * 60 * 60 * 1000);
  const readiness = readinessScore(i, diagnosis);
  const actionPlanData = actionPlan(i, diagnosis);
  const journeyData = journeyTimeline(i, diagnosis);
  const timeline = serviceTimeline(recommendedServices);

  let memberRecord = { saved: false, capgen_access: false, capgenAccess: false, capgen_qualified: false, capgenQualified: false };
  try { memberRecord = await saveMember(i, diagnosis, readiness, trialStart, trialEnd); }
  catch (e) { memberRecord = { saved: false, error: e.message || 'member save failed', capgen_access: false, capgenAccess: false, capgen_qualified: false, capgenQualified: false }; }

  const capgenAccess = !!memberRecord.capgenAccess;

  let emailSent = false;
  try { emailSent = await sendWelcomeEmail(i, diagnosis, readiness, trialEnd, memberRecord.accessCode || null, capgenAccess); } catch (_) { emailSent = false; }

  let supabaseRecord = { saved: false, id: null, error: null };
  try { supabaseRecord = await saveIntakeRecord(i, diagnosis, recommendedServices, plan, mode, emailSent, trialStart, trialEnd, readiness, actionPlanData, journeyData); }
  catch (e) { supabaseRecord = { saved: false, id: null, error: e.message || 'Supabase save failed' }; }

  return { statusCode: 200, headers, body: JSON.stringify({
    ok: true,
    mode,
    emailSent,
    supabaseRecord,
    memberRecord,
    capgenAccess,
    capgen_access: capgenAccess,
    capgenQualified: capgenAccess,
    capgen_qualified: capgenAccess,
    capgenAccessCode: memberRecord.accessCode || null,
    businessName: i.businessName,
    fullName: i.fullName,
    businessStage: diagnosis.businessStage,
    missingItems: diagnosis.missingItems,
    recommendedServices,
    nextSteps: diagnosis.nextSteps,
    readiness,
    actionPlan: actionPlanData,
    journey: journeyData,
    serviceTimeline: timeline,
    trial: { day: 1, daysTotal: 14, start: trialStart.toISOString(), end: trialEnd.toISOString() },
    plan,
    disclaimer: 'This plan and dashboard are AI-generated business guidance for planning purposes only. They are not legal, tax, financial, or accounting advice.',
  }) };
};