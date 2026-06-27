// Apropos Business Center — AI Advisor function.
// MORGAN two-stage advisor + legacy coach compatibility.

const MODEL = process.env.ASSISTANT_MODEL || 'claude-sonnet-4-6';
const SUPA  = process.env.SUPABASE_URL;
const SKEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CATALOG = {
  plan:       { label: 'Business Plan & Assessment', kind: 'included', href: '#start', desc: 'Your tailored plan, readiness score, and 30-day action plan.' },
  documents:  { label: 'Business Documents', kind: 'included', href: '#documents', desc: 'Generate contracts, agreements, and core business documents.' },
  website:    { label: 'Website Build', kind: 'included', href: 'website-demo.html', desc: 'A professionally written, hand-built site.' },
  proposal:   { label: 'Proposal Writer', kind: 'included', href: '#assistant', desc: 'Draft a compliant, persuasive proposal.' },
  capgen:     { label: 'Government Contracts + Capability', kind: 'included', href: 'https://capgenmkt.aproposgroupllc.com', desc: 'Find federal opportunities and build a capability statement.' },
  nevada:     { label: 'Nevada State & Local Contracts', kind: 'included', href: 'https://nevadastategen.aproposgroupllc.com', desc: 'Nevada procurement matched to your business.' },
  california: { label: 'California State & Local Contracts', kind: 'included', href: 'https://calstategen.aproposgroupllc.com', desc: 'California procurement matched to your business.' },
  launch:     { label: 'Website Launch & Hosting', kind: 'addon', href: 'mailto:jeff@aproposgroupllc.com?subject=Website%20Launch%20%26%20Hosting%20add-on', desc: 'Deploy your site to your domain and keep it live.' },
  social:     { label: 'Done-for-You Social Posting', kind: 'addon', href: 'mailto:jeff@aproposgroupllc.com?subject=Done-for-You%20Social%20Posting%20add-on', desc: 'Daily promotional posts for your business.' },
};

const CATALOG_LINES = Object.entries(CATALOG).map(([id, s]) => `- ${id} [${s.kind}] — ${s.label}: ${s.desc}`).join('\n');

const SYSTEM = `You are the Apropos AI Agent Coach inside the Apropos Business Center. Help people start, build, win customers, prepare documents, and grow. You are also a router to the right service room.

THE ROOMS:
${CATALOG_LINES}

Routing rules:
- Included services come with membership.
- Add-on services are paid extras.
- Recommend the 1-2 rooms that move the member forward now.
- If recommending rooms, end with exactly [[OPEN: id1, id2]].`;

const DEPARTMENTS = {
  'website-advisory': { label: 'Enter Website Design Advisory →', href: '/website-builder.html', primary: true },
  planning:           { label: 'Business Assessment & Planning →', href: '/assessment.html' },
  proposals:          { label: 'Contract Proposal Writing (Coming Soon)', href: '#' },
  marketing:          { label: 'Marketing & Promotions Advisory (Coming Soon)', href: '#' },
  funding:            { label: 'Capital & Funding Advisory →', href: '#' },
  registration:       { label: 'Business Registration Advisory →', href: '#' },
  federal:            { label: 'Federal Contract Opportunities →', href: 'https://capgen.aproposgroupllc.com', blank: true },
  nevada:             { label: 'Nevada State Contract Opportunities →', href: 'https://nevadastategen.aproposgroupllc.com', blank: true },
  california:         { label: 'California State Contract Opportunities →', href: 'https://calstategen.aproposgroupllc.com', blank: true },
};

const WEBSITE_REDIRECT_RULE = `WEBSITE REDIRECT RULE:
When the user expresses interest in building, getting, redesigning, or improving a website, do not collect website requirements here. Reply with exactly this message and then the website tag:
"Great news — your Business Center membership includes access to our Website Design Advisory department. Our AI design studio will guide you through the entire process and have a working preview of your site ready same day. Everything is handled for you — just click below to get started."
[[OPEN: website-advisory]]`;

const DEPT_ROUTING = `DEPARTMENT ROUTING:
When routing to a department, end with one final line exactly like [[OPEN: id1, id2]]. Valid ids: website-advisory, planning, proposals, marketing, funding, registration, federal, nevada, california. At most 3.`;

const KNOWLEDGE_BASE = `
PLATFORM IDENTITY:
You are Morgan, a personal AI Business Advisor at the APROPOS BUSINESS CENTER™, powered by AG ENGINEERING OS™ — Precision-Built for Business.

MEMBERSHIP:
The Business Center membership is $24.99/month after a 14-day free trial. Included departments include Business Assessment, Website Design Advisory, Federal Contract Advisory, Nevada State Contract Advisory, California State Contract Advisory, Capital & Funding Advisory, and Business Registration Advisory. Proposal writing and website launch/deployment may be separate add-ons.

CONTRACT INTELLIGENCE TRUST LANGUAGE:
When discussing contract intelligence, say opportunities are matched to the business profile and sourced from official public records or official government records.

MORGAN STYLE:
Warm, concrete, plainspoken, direct, and practical. A few short paragraphs, not a lecture.`;

const STAGE1 = `You are Morgan, a professional AI Business Advisor at the Apropos Business Center.
You have been personally assigned to this client. Address them by their first name.
You are in their first advisory session following their business assessment.
You lead this conversation with structure and authority.
Begin with this exact introduction:
"Hello [First Name], my name is Morgan. I've been assigned as your personal Business Advisor here at the Apropos Business Center. I've reviewed your assessment and I'm ready to walk you through what I found and where we go from here. Are you ready to get started?"
In this session you will:
- Walk the user through their assessment score and what it means
- Identify their top 3 priority gaps
- Generate a personalized 90-day action plan
- Recommend which departments to visit first and why
- Answer questions about business formation, EIN, licensing, funding readiness`;

const STAGE2 = `You are Morgan, a professional AI Business Advisor at the Apropos Business Center.
You are in a returning member session. The user leads this conversation.
Begin with this exact greeting:
"Welcome back [First Name]. What are we working on today?"
In this session you will:
- Listen and confirm the user's session objective first
- Operate as a peer-level advisor
- Assist with progress review, strategy, documents, marketing, pricing, hiring, operations, and business Q&A.`;

const CAPGEN_STAGE1_RULE = `CAPGEN BRIEFING RULE (Stage 1 only):
Read the client context carefully.
If the context shows capgen_qualified: true OR capgen_access: true OR CapGen qualified: Yes:

After completing the assessment walkthrough and 90-day action plan, proactively cover the following:

"Your Business Center membership includes access to our government contract intelligence suite — three platforms that match open contract opportunities to your business profile sourced from official public records.

Here is how to access them:
1. Visit capgen.aproposgroupllc.com (Federal), nevadastategen.aproposgroupllc.com (Nevada), or calstategen.aproposgroupllc.com (California)
2. Click 'BC Members Login'
3. Enter your Business Center email and the access code from your welcome email
4. Your personalized contract dashboard will load automatically

These platforms are fully included in your $24.99/month membership — no additional cost."

If the context does NOT show capgen_qualified, capgen_access, or CapGen qualified: Yes, do NOT mention CapGen, the contract intelligence platforms, or government contracting unless the user brings it up first.

This rule fires automatically based on the client context — Morgan never asks the user about their qualification status.`;

function morganSystem(stage, firstName, context) {
  const name = (firstName && String(firstName).trim()) || 'there';
  const stageNumber = Number(stage);
  const base = (stageNumber === 2 ? STAGE2 : STAGE1).split('[First Name]').join(name);
  let sys = `${base}\n\n${WEBSITE_REDIRECT_RULE}\n\n${DEPT_ROUTING}`;
  if (stageNumber === 1) sys += `\n\n${CAPGEN_STAGE1_RULE}`;
  sys += `\n\n${KNOWLEDGE_BASE}`;
  sys += `\n\nIMPORTANT: the exact opening line above has already been delivered to the user. Do not repeat it. Continue naturally from the user's latest message.`;
  sys += `\n\nVoice: warm, concrete, plain-spoken — a few short paragraphs, not a lecture.`;
  if (context) sys += `\n\nClient context (use it to tailor your help; never read it back verbatim, and never invent details you don't actually have):\n${context}`;
  return sys;
}

function extractActions(reply, catalog) {
  const m = reply.match(/\[\[\s*OPEN\s*:([^\]]*)\]\]/i);
  if (!m) return { text: reply.trim(), actions: [] };
  const text = reply.slice(0, m.index).trim();
  const ids = m[1].split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const seen = new Set();
  const actions = [];
  for (const id of ids) {
    if (seen.has(id) || !catalog[id]) continue;
    seen.add(id);
    const s = catalog[id];
    const a = { id, label: s.label, href: s.href };
    if (s.kind) a.kind = s.kind;
    if (s.primary) a.primary = true;
    if (s.blank) a.blank = true;
    actions.push(a);
    if (actions.length >= 3) break;
  }
  return { text: text || reply.trim(), actions };
}

function fallback(messages) {
  const last = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  const reply = `I'm your Apropos AI Agent Coach. Here's a real starting point for: "${String(last).slice(0, 140)}"

1. Nail the one-sentence pitch.
2. Get findable with a professional website and one active channel.
3. Land the first 5 customers before perfecting everything.`;
  return { text: reply, actions: [{ id: 'website', label: CATALOG.website.label, href: CATALOG.website.href, kind: 'included' }, { id: 'documents', label: CATALOG.documents.label, href: CATALOG.documents.href, kind: 'included' }] };
}

async function supa(path, opts = {}) {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function hasCapGenSignal(context) {
  return /capgen_qualified\s*:\s*true|capgen_access\s*:\s*true|CapGen qualified\s*:\s*Yes/i.test(String(context || ''));
}

async function capgenContextForEmail(email) {
  if (!SUPA || !SKEY || !email) return '';
  try {
    const rows = await supa(`biz_center_members?email=eq.${encodeURIComponent(String(email).toLowerCase())}&select=capgen_qualified&limit=1`);
    const qualified = Array.isArray(rows) && rows.some(r => r && r.capgen_qualified === true);
    return `CapGen qualified: ${qualified ? 'Yes — cover CapGen briefing' : 'No — do not mention CapGen'}`;
  } catch (_) {
    return '';
  }
}

async function saveMorganSession({ sessionId, userEmail, stage, messages }) {
  if (!SUPA || !SKEY || !sessionId) return;
  const row = { id: sessionId, user_email: userEmail || null, stage: String(stage), messages, updated_at: new Date().toISOString() };
  try {
    await supa('morgan_sessions', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row) });
  } catch (_) {}
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad JSON' }) }; }

  let messages = Array.isArray(body.messages) ? body.messages : [];
  messages = messages.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim()).map(m => ({ role: m.role, content: String(m.content).slice(0, 4000) })).slice(-12);
  if (!messages.length) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Say something to your advisor.' }) };

  const morganMode = body.stage === 1 || body.stage === 2 || body.stage === '1' || body.stage === '2';
  let context = String(body.context || '').slice(0, 6000);
  const stageNumber = Number(body.stage);
  if (morganMode && stageNumber === 1 && !hasCapGenSignal(context)) {
    const capgenLine = await capgenContextForEmail(body.userEmail);
    if (capgenLine) context += `${context ? '\n' : ''}${capgenLine}`;
  }
  const catalog = morganMode ? DEPARTMENTS : CATALOG;
  let system = morganMode ? morganSystem(body.stage, body.firstName, context) : (context ? `${SYSTEM}\n\nThe member is working on this business:\n${context}` : SYSTEM);

  if (morganMode && body.document_context) {
    system += `\n\nThe user has shared a document. Use its content to give more specific, tailored advice. Document content:\n${String(body.document_context).slice(0, 14000)}`;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    if (morganMode) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, mode: 'fallback', reply: "I'm Morgan, your Business Advisor. I'll be fully live in just a moment — in the meantime, tell me what you'd like to work on, and feel free to explore your departments above.", actions: [] }) };
    const { text, actions } = fallback(messages);
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, mode: 'fallback', reply: text, actions }) };
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 900, system, messages }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || 'Advisor error');
    const raw = (data.content || []).map(c => c.text || '').join('').trim();
    const { text, actions } = extractActions(raw || '', catalog);
    if (morganMode) await saveMorganSession({ sessionId: body.sessionId, userEmail: body.userEmail, stage: body.stage, messages: messages.concat([{ role: 'assistant', content: text }]) });
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, mode: 'ai', reply: text || "I'm here — could you say a bit more?", actions }) };
  } catch (e) {
    if (morganMode) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, mode: 'fallback', reply: 'I hit a brief connection issue — please try that again in a moment.', actions: [] }) };
    const { text, actions } = fallback(messages);
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, mode: 'fallback', reply: text, actions }) };
  }
};