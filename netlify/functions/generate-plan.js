// Apropos Business Center — Business Plan + Onboarding Diagnosis
// Sprint 2: simple intake -> AI diagnosis -> plan -> dashboard recommendations -> Supabase record.

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

const SERVICE_LIBRARY = {
  business_plan: { label: 'Business Plan', icon: '📄', href: '#results', blurb: 'Your tailored business plan and operating roadmap.' },
  formation: { label: 'Business Formation Guidance', icon: '🏢', href: '#assistant', blurb: 'Registration, EIN, business bank account, and startup checklist guidance.' },
  documents: { label: 'Business Documents', icon: '📑', href: '#documents', blurb: 'Generate NDAs, agreements, proposals, invoices, and other business documents.' },
  website: { label: 'Website Design', icon: '🌐', href: 'https://ai4websitedesign.com', blurb: 'Move from idea to a live customer-facing website.' },
  branding: { label: 'Branding', icon: '✨', href: 'https://ai4websitedesign.com', blurb: 'Clarify your offer, name, message, and visual presence.' },
  marketing: { label: 'Marketing Agent', icon: '📣', href: 'https://ai4-product-purchasing.ai4businesses.org/marketing-agent-offer.html', blurb: 'Create consistent promotional content and customer outreach.' },
  customers: { label: 'Getting Customers', icon: '🤝', href: '#assistant', blurb: 'Build your first customer acquisition plan and follow-up motion.' },
  funding: { label: 'Funding Readiness', icon: '💵', href: '#assistant', blurb: 'Prepare your business for grants, loans, and funding applications.' },
  contracts: { label: 'Contract Opportunity Center', icon: '🏛', href: 'https://nevadastategen.aproposgroupllc.com', blurb: 'Prepare for state and federal opportunity intelligence.' },
  capability: { label: 'Capability Statement', icon: '🧾', href: 'https://ai4-product-purchasing.ai4businesses.org/capgen-offer.html', blurb: 'Build the profile government buyers and partners expect.' },
  proposal: { label: 'Proposal Writing', icon: '📝', href: '#assistant', blurb: 'Turn opportunities into organized proposal responses.' },
  automation: { label: 'Business Automation', icon: '⚙️', href: '#assistant', blurb: 'Identify repeatable tasks that can be systemized.' },
  assistant: { label: 'AI Business Assistant', icon: '💬', href: '#assistant', blurb: 'Ask follow-up questions and get practical next-step guidance.' },
};

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

function inferPath(i) {
  const statuses = new Set(i.businessStatus);
  const needs = new Set(i.servicesNeeded);
  const missing = [];
  const recKeys = new Set(['business_plan', 'assistant']);

  const noBasics = i.businessStageInput === 'idea' || i.businessStageInput === 'starting' || statuses.has('none');
  const wantsContracts = i.businessStageInput === 'contracts' || needs.has('contracts') || needs.has('capability') || needs.has('proposal');
  const wantsFunding = i.businessStageInput === 'funding' || needs.has('funding');
  const wantsCustomers = i.businessStageInput === 'customers' || needs.has('marketing') || needs.has('customers');

  if (!statuses.has('registered')) missing.push('Business Registration');
  if (!statuses.has('ein')) missing.push('EIN');
  if (!statuses.has('bank')) missing.push('Business Bank Account');
  if (!statuses.has('website')) missing.push('Website');
  if (!statuses.has('social')) missing.push('Social Media Presence');
  if (!statuses.has('customers')) missing.push('Customer Acquisition System');
  if (wantsContracts && !statuses.has('gov_regs')) missing.push('Government Registrations');
  if (wantsContracts && !statuses.has('capability')) missing.push('Capability Statement');

  if (noBasics) ['formation', 'documents'].forEach(k => recKeys.add(k));
  if (!statuses.has('website') || needs.has('website')) recKeys.add('website');
  if (needs.has('branding')) recKeys.add('branding');
  if (wantsCustomers) ['marketing', 'customers'].forEach(k => recKeys.add(k));
  if (wantsFunding) recKeys.add('funding');
  if (wantsContracts) ['contracts', 'capability', 'proposal'].forEach(k => recKeys.add(k));
  if (needs.has('automation')) recKeys.add('automation');
  if (needs.has('documents')) recKeys.add('documents');

  let businessStage = 'BUILD';
  if (noBasics) businessStage = 'START';
  if (wantsCustomers) businessStage = 'MARKET';
  if (wantsContracts) businessStage = 'WIN CONTRACTS';
  if (wantsFunding || i.businessStageInput === 'growing') businessStage = 'GROW';
  if (i.businessStageInput === 'not_sure' && noBasics) businessStage = 'START';

  const nextSteps = [
    'Review and save your AI-generated business plan.',
    missing.length ? `Start with the missing foundation item: ${missing[0]}.` : 'Choose the highest-priority service card in your dashboard.',
    wantsContracts ? 'Prepare your capability profile before pursuing contract opportunities.' : 'Use the AI Business Assistant to turn this plan into a 7-day action list.',
  ];

  return { businessStage, missingItems: missing.slice(0, 8), recommendedServiceKeys: Array.from(recKeys).slice(0, 8), nextSteps };
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
Start with a website, a strong offer, consistent social content, direct outreach, and follow-up. The Marketing Agent and AI Business Assistant can turn this into weekly content and daily customer-facing actions.

## Operations
Document how the business receives inquiries, quotes work, delivers service, collects payment, and follows up. Simple systems should be created before volume increases.

## Milestones & Roadmap
First 7 days: complete missing foundation items and save this plan. First 30 days: launch website and marketing. First 90 days: build a repeatable customer acquisition process and prepare funding or contract materials if needed.

## Financial Outline
Track startup costs, monthly expenses, price per sale, expected sales volume, and break-even point. The first goal is not complexity; it is clarity around how many customers are needed to cover costs and create profit.

## Funding Needs
Funding should be tied to specific uses such as website launch, equipment, marketing, inventory, or working capital. Before applying, prepare documents, business plan, basic financial assumptions, and a clear use-of-funds statement.`;
}

async function sendWelcomeEmail(i, diagnosis) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL || !i.email) return false;
  const subject = 'Welcome to Apropos Business Center';
  const body = `Your free 14-day access has started.\n\nBusiness: ${i.businessName}\nRecommended path: ${diagnosis.businessStage}\n\nYour AI-generated business plan and recommended services are ready in your Business Center dashboard.\n\nNext step: return to the dashboard and continue building your business.\n\nApropos Business Center`;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL, to: [i.email], subject, text: body }),
  });
  return r.ok;
}

async function saveIntakeRecord(i, diagnosis, recommendedServices, plan, mode, emailSent, trialStart, trialEnd) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { saved: false, id: null, error: 'Supabase env not configured' };
  }

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
  if (!r.ok) {
    return { saved: false, id: null, error: data?.message || 'Supabase insert failed' };
  }
  return { saved: true, id: Array.isArray(data) ? data[0]?.id : data?.id, error: null };
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

  const diagnosis = inferPath(i);
  let plan, mode;
  try {
    if (process.env.OPENAI_API_KEY) { plan = await openAiPlan(i, diagnosis); mode = 'openai'; }
    else if (process.env.ANTHROPIC_API_KEY) { plan = await anthropicPlan(i, diagnosis); mode = 'anthropic'; }
    else { plan = starterPlan(i, diagnosis); mode = 'starter'; }
  } catch (e) {
    plan = starterPlan(i, diagnosis); mode = 'starter-fallback';
  }

  let emailSent = false;
  try { emailSent = await sendWelcomeEmail(i, diagnosis); } catch (_) { emailSent = false; }

  const recommendedServices = diagnosis.recommendedServiceKeys.map(key => ({ key, ...SERVICE_LIBRARY[key] })).filter(s => s.label);
  const trialStart = new Date();
  const trialEnd = new Date(trialStart.getTime() + 14 * 24 * 60 * 60 * 1000);

  let supabaseRecord = { saved: false, id: null, error: null };
  try {
    supabaseRecord = await saveIntakeRecord(i, diagnosis, recommendedServices, plan, mode, emailSent, trialStart, trialEnd);
  } catch (e) {
    supabaseRecord = { saved: false, id: null, error: e.message || 'Supabase save failed' };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ok: true,
      mode,
      emailSent,
      supabaseRecord,
      businessName: i.businessName,
      fullName: i.fullName,
      businessStage: diagnosis.businessStage,
      missingItems: diagnosis.missingItems,
      recommendedServices,
      nextSteps: diagnosis.nextSteps,
      trial: { day: 1, daysTotal: 14, start: trialStart.toISOString(), end: trialEnd.toISOString() },
      plan,
      disclaimer: 'This plan and dashboard are AI-generated business guidance for planning purposes only. They are not legal, tax, financial, or accounting advice.',
    }),
  };
};