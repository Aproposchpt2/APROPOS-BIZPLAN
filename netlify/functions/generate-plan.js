// Apropos Online SBDC — Tailored Business Plan generator (the opening play).
// "We don't teach the class. We hand you the plan." Then → access to CapGen products.
//
// Works end-to-end today:
//   - If ANTHROPIC_API_KEY is set, it writes a genuinely tailored plan with Claude.
//   - If not, it returns a solid starter plan assembled from the owner's inputs,
//     so the flow is functional immediately (add the key to turn on AI tailoring).

const MODEL = process.env.PLAN_MODEL || 'claude-sonnet-4-6';

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

function clean(s, max = 600) { return String(s || '').trim().slice(0, max); }

function intakeFrom(body) {
  return {
    businessName: clean(body.businessName, 120) || 'Your Business',
    ownerName: clean(body.ownerName, 120),
    industry: clean(body.industry, 120),
    location: clean(body.location, 120),
    stage: clean(body.stage, 40) || 'idea',
    idea: clean(body.idea, 1200),
    target: clean(body.target, 600),
    edge: clean(body.edge, 600),
    goal: clean(body.goal, 600),
    budget: clean(body.budget, 60),
  };
}

function buildPrompt(i) {
  return `You are a senior small-business advisor writing a clear, practical, ready-to-use business plan for a real entrepreneur. Write in plain, confident language a first-time owner can act on — no fluff, no filler, no "[insert here]" placeholders. Make reasonable, specific assumptions from what they gave you and state them.

ENTREPRENEUR INPUT
- Business name: ${i.businessName}
- Owner: ${i.ownerName || '(not given)'}
- Industry: ${i.industry || '(not given)'}
- Location: ${i.location || '(not given)'}
- Stage: ${i.stage}
- What the business does: ${i.idea || '(not given)'}
- Target customer: ${i.target || '(not given)'}
- Their stated edge: ${i.edge || '(not given)'}
- Their goal: ${i.goal || '(not given)'}
- Startup budget: ${i.budget || '(not given)'}

Write a tailored business plan with EXACTLY these sections, each as a "## " markdown heading, in this order:
${SECTIONS.map(s => '## ' + s).join('\n')}

Rules:
- 2-4 tight paragraphs or a short bullet list per section.
- Be concrete to THIS business and location; use real, sensible numbers in the Financial Outline and Funding Needs (clearly framed as estimates).
- In Marketing & Sales Strategy, recommend specific first moves (brand, website, content, local outreach) — these set up tools they can use next.
- End with no commentary after the last section.`;
}

async function aiPlan(i) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 3000,
      messages: [{ role: 'user', content: buildPrompt(i) }],
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || 'AI generation failed');
  const text = (data.content || []).map(c => c.text || '').join('').trim();
  if (!text) throw new Error('Empty AI response');
  return text;
}

// Keyless starter plan — still tailored to their inputs, so the flow works today.
function starterPlan(i) {
  const loc = i.location || 'your area';
  const ind = i.industry || 'your industry';
  const tgt = i.target || 'your target customers';
  const does = i.idea || 'what your business offers';
  const edge = i.edge || 'the advantage that makes you the obvious choice';
  return `## Executive Summary
${i.businessName} is a ${i.stage}-stage ${ind} business${i.location ? ' based in ' + i.location : ''}. ${does ? does + '. ' : ''}It serves ${tgt}, and competes by leading with ${edge}. ${i.goal ? 'The near-term goal: ' + i.goal + '.' : ''}

## Company Overview
${i.ownerName ? i.ownerName + ' founded ' + i.businessName : i.businessName + ' is being built'} to meet a clear need in ${loc}. Decide your legal structure (an LLC is the common first choice), register the business, and open a dedicated business bank account before your first sale.

## Products & Services
List your 1–3 core offers, what each costs you to deliver, and what you'll charge. Start with the single offer your ${tgt} most want, prove it, then expand.

## Market & Target Customer
Your customer: ${tgt}. Define where they already look for a solution (search, social, referrals, local foot traffic) — that's exactly where your first marketing goes.

## Competitive Edge
Your edge: ${edge}. Make it the first thing every customer hears. If a competitor can copy it in a weekend, sharpen it until they can't.

## Marketing & Sales Strategy
First moves: (1) a memorable name and clean brand, (2) a simple website that turns visitors into inquiries, (3) consistent content where your customers already are, (4) local outreach and reviews. These are the exact pieces the CapGen tools can build for you next — so you launch in days, not months.

## Operations
Map the path from "customer says yes" to "customer is delighted": how the order comes in, who fulfills it, and how you follow up. Keep it simple enough to run yourself, documented enough to hand off later.

## Milestones & Roadmap
30 days: brand, website, first 5 customers. 90 days: repeatable sales motion + first reviews. 6–12 months: steady pipeline and your first hire or first contract.

## Financial Outline
Estimate startup costs${i.budget ? ' (you noted ~' + i.budget + ')' : ''}, monthly fixed costs, price per sale, and the number of sales needed to break even. Track every dollar from day one — banks and funders will ask.

## Funding Needs
If you need capital, size it to a specific use (equipment, inventory, marketing) with the return it produces. Options to line up: a business bank account and credit, small-business grants, and microloans — pursue these in parallel with launch.`;
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad JSON' }) }; }
  const i = intakeFrom(body);
  if (!i.idea && i.businessName === 'Your Business') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Tell us at least your business name and what it does.' }) };
  }

  let plan, mode;
  try {
    if (process.env.ANTHROPIC_API_KEY) { plan = await aiPlan(i); mode = 'ai'; }
    else { plan = starterPlan(i); mode = 'starter'; }
  } catch (e) {
    plan = starterPlan(i); mode = 'starter-fallback';
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ok: true,
      mode,
      businessName: i.businessName,
      plan,
      capgen: [
        { key: 'website',  label: 'Build your website',        blurb: 'Turn the plan into a live site that brings in customers.', },
        { key: 'brand',    label: 'Create your brand & content', blurb: 'Name, look, social posts, captions — done for you.', },
        { key: 'proposal', label: 'Win contracts',              blurb: 'Find government opportunities and draft the bid.', },
      ],
      disclaimer: 'This plan is a tailored starting point, not financial or legal advice. Verify numbers and registrations for your state before relying on them.',
    }),
  };
};
