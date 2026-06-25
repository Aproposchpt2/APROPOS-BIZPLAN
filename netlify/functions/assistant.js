// Apropos Business Center — AI Advisor function.
// Evolved into MORGAN, the two-stage AI Business Advisor (Item 2), while staying
// backward-compatible with the legacy AI Agent Coach used by coach.html.
//
//   Morgan mode  → body.stage is 1 or 2. Two-stage advisor with department routing,
//                  the website-redirect rule, and morgan_sessions persistence.
//   Legacy mode  → no stage. Original "router with context" coach behavior.
//
//   - With ANTHROPIC_API_KEY set → live Claude (claude-sonnet-4-6).
//   - Without it → an honest fallback so the UI never breaks.

const MODEL = process.env.ASSISTANT_MODEL || 'claude-sonnet-4-6';
const SUPA  = process.env.SUPABASE_URL;
const SKEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Legacy coach catalog (used by coach.html) ───────────────────────────────
const CATALOG = {
  plan:       { label: 'Business Plan & Assessment',          kind: 'included', href: '#start',     desc: 'Your tailored plan, readiness score, and 30-day action plan.' },
  documents:  { label: 'Business Documents',                  kind: 'included', href: '#documents', desc: 'Generate contracts, agreements, and core business documents.' },
  website:    { label: 'Website Build',                       kind: 'included', href: 'website-demo.html', desc: 'A professionally written, hand-built site — we write the copy for you.' },
  proposal:   { label: 'Proposal Writer',                     kind: 'included', href: '#assistant', desc: 'Draft a compliant, persuasive proposal with me, right here.' },
  capgen:     { label: 'Government Contracts + Capability',   kind: 'included', href: 'https://capgenmkt.aproposgroupllc.com', desc: 'Find federal opportunities and build a capability statement.' },
  nevada:     { label: 'Nevada State & Local Contracts',      kind: 'included', href: 'https://nevadastategen.aproposgroupllc.com', desc: 'Live Nevada state & local procurement matched to your business.' },
  california: { label: 'California State & Local Contracts',  kind: 'included', href: 'https://calstategen.aproposgroupllc.com', desc: 'Live California state & local procurement matched to your business.' },
  launch:     { label: 'Website Launch & Hosting',           kind: 'addon',    href: 'mailto:jeff@aproposgroupllc.com?subject=Website%20Launch%20%26%20Hosting%20add-on', desc: 'We deploy your site to your domain and keep it live (paid add-on).' },
  social:     { label: 'Done-for-You Social Posting',        kind: 'addon',    href: 'mailto:jeff@aproposgroupllc.com?subject=Done-for-You%20Social%20Posting%20add-on', desc: 'We post for your business every day, automatically (paid add-on).' },
};

const CATALOG_LINES = Object.entries(CATALOG)
  .map(([id, s]) => `- ${id} [${s.kind}] — ${s.label}: ${s.desc}`)
  .join('\n');

const SYSTEM = `You are the Apropos AI Agent Coach — a sharp, encouraging, plain-spoken business coach available 24/7 inside the Apropos Business Center, an online business development center that DOES the work with founders instead of just advising them.

You are the personal counselor every founder wishes they had: no waitlist, no jargon, always in their corner. Help people START a business, BUILD their presence, WIN customers and government contracts, and GROW.

You are also a ROUTER. The Center delivers everything through self-contained services (the "rooms" below). Your job is to figure out the member's best next move and SEND THEM INTO THE RIGHT ROOM — not just talk about it.

THE ROOMS (id [kind] — what it does):
${CATALOG_LINES}

Routing rules:
- "included" services come with their membership — open them freely.
- "addon" services are paid extras — describe the value honestly and tell them you can set it up on request.
- Recommend based on the member's stage, readiness score, and what they're asking for. Don't dump the whole menu; pick the 1-2 rooms that actually move them forward now.
- For the Proposal Writer, you draft the proposal WITH them right here in the chat.

How you answer:
- Be concrete, prioritized, and action-oriented. Give the next 1-3 moves, not a lecture.
- Keep replies tight — a few short paragraphs or a short list. Match the person's level.
- Be warm and direct. You believe in them and you tell the truth.
- This is practical guidance, not legal, tax, or financial advice — say so only when it genuinely matters.

OPEN PROTOCOL (important): whenever you recommend one or more rooms, end your reply with a SINGLE final line in exactly this form:
[[OPEN: id1, id2]]
Use only ids from the room list above, at most 3, most relevant first. If you are not recommending any room this turn, omit the line entirely. Never explain the line; it is read by the app, not the person.`;

// ── Morgan department routing targets (Item 2) ──────────────────────────────
// `primary` → render as the gold .btn-primary-style button. `blank` → open in a new tab.
const DEPARTMENTS = {
  'website-advisory': { label: 'Enter Website Design Advisory →',          href: 'https://ai4websitedesign.com',            primary: true, blank: true },
  planning:           { label: 'Business Assessment & Planning →',         href: '/assessment.html' },
  proposals:          { label: 'Contract Proposal Writing (Coming Soon)',  href: '#' },
  marketing:          { label: 'Marketing & Promotions Advisory (Coming Soon)', href: '#' },
  funding:            { label: 'Capital & Funding Advisory →',             href: '#' },
  registration:       { label: 'Business Registration Advisory →',         href: '#' },
  federal:            { label: 'Federal Contract Opportunities →',         href: 'https://capgenmkt.aproposgroupllc.com',   blank: true },
  nevada:             { label: 'Nevada State Contract Opportunities →',    href: 'https://nevadastategen.aproposgroupllc.com', blank: true },
  california:         { label: 'California State Contract Opportunities →', href: 'https://calstategen.aproposgroupllc.com', blank: true },
};

const WEBSITE_REDIRECT_RULE = `WEBSITE REDIRECT RULE (this OVERRIDES every other instruction whenever it applies):
When the user expresses ANY interest in building a website, getting a website, redesigning their website, or asks ANY question about their web presence or online identity — do NOT gather website requirements here. Do not ask design questions. Do not collect colors, content, or preferences. Reply with EXACTLY this message, word for word, with nothing before or after it except the tag:
"Great news — your Business Center membership includes access to our Website Design Advisory department. Our AI design studio will guide you through the entire process and have a working preview of your site ready same day. Everything is handled for you — just click below to get started."
Then put this exact tag on its own final line: [[OPEN: website-advisory]]
This fires on any website-related intent no matter what else is being discussed, and it overrides all other behavior for that topic. After delivering it, do not re-engage on website topics.`;

const DEPT_ROUTING = `DEPARTMENT ROUTING: When you point the user to a department, end your reply with ONE final line in exactly this form:
[[OPEN: id1, id2]]
Valid ids: website-advisory, planning, proposals, marketing, funding, registration, federal, nevada, california. At most 3, most relevant first. Omit the line entirely when you are not routing this turn. Never explain or mention the line — the app reads it; the person never sees it.`;

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
- Answer questions about business formation, EIN, licensing, funding readiness
If the user asks about finding government contracts, websites, proposal writing, or other department tools, acknowledge their interest and direct them to the appropriate department using a clickable link.`;

const STAGE2 = `You are Morgan, a professional AI Business Advisor at the Apropos Business Center.
You are in a returning member session. The user leads this conversation.
Begin with this exact greeting:
"Welcome back [First Name]. What are we working on today?"
In this session you will:
- Listen and confirm the user's session objective first
- Operate as a peer-level advisor — no onboarding hand-holding
- Assist with: progress review, updated strategy, document drafting, marketing guidance, pricing, hiring, operations, general business Q&A
If the user asks about government contracts, websites, proposal writing, or Facebook promo automation, direct them to the appropriate department with a clickable link.`;

function morganSystem(stage, firstName, context) {
  const name = (firstName && String(firstName).trim()) || 'there';
  const base = (Number(stage) === 2 ? STAGE2 : STAGE1).split('[First Name]').join(name);
  let sys = `${base}\n\n${WEBSITE_REDIRECT_RULE}\n\n${DEPT_ROUTING}`;
  sys += `\n\nIMPORTANT: your exact opening line above has ALREADY been delivered to the user as your first message. Do NOT repeat it or greet them again. Continue the conversation naturally from the user's most recent message.`;
  sys += `\n\nVoice: warm, concrete, plain-spoken — a few short paragraphs, not a lecture. This is practical guidance, not legal, tax, or financial advice — say so only when it genuinely matters.`;
  if (context) sys += `\n\nClient context (use it to tailor your help; never read it back verbatim, and never invent details you don't actually have):\n${context}`;
  return sys;
}

// Pull the [[OPEN: ...]] tag out of the model's reply → clean text + action buttons.
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
  const reply = `I'm your Apropos AI Agent Coach. (My live brain switches on the moment the API key is connected — until then, here's a real starting point.)

You asked about: "${String(last).slice(0, 140)}"

Three moves that apply to almost any business right now:
1. **Nail the one-sentence pitch** — who you help and the result you deliver. Everything else flows from it.
2. **Get findable** — a professional website and one social channel where your customers already are.
3. **Land your first 5 customers** before you perfect anything. Real feedback beats a perfect plan.

When you're ready, I can open your Website Build or your Business Documents and we'll knock these out together.`;
  return { text: reply, actions: [{ id: 'website', label: CATALOG.website.label, href: CATALOG.website.href, kind: 'included' }, { id: 'documents', label: CATALOG.documents.label, href: CATALOG.documents.href, kind: 'included' }] };
}

// ── Supabase: persist Morgan conversations (degrades silently if unavailable) ─
async function supa(path, opts = {}) {
  const r = await fetch(`${SUPA}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function saveMorganSession({ sessionId, userEmail, stage, messages }) {
  if (!SUPA || !SKEY || !sessionId) return;
  const row = {
    id: sessionId,
    user_email: userEmail || null,
    stage: String(stage),
    messages,
    updated_at: new Date().toISOString(),
  };
  try {
    // Upsert on the primary key (id) so each browser session keeps one growing row.
    await supa('morgan_sessions', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row) });
  } catch (_) { /* table may not exist yet, or a transient error — never break the chat */ }
}

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad JSON' }) }; }

  let messages = Array.isArray(body.messages) ? body.messages : [];
  messages = messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: String(m.content).slice(0, 4000) }))
    .slice(-12);
  if (!messages.length) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Say something to your advisor.' }) };

  const morganMode = body.stage === 1 || body.stage === 2 || body.stage === '1' || body.stage === '2';
  const context = String(body.context || '').slice(0, 6000);
  const catalog = morganMode ? DEPARTMENTS : CATALOG;
  const system = morganMode
    ? morganSystem(body.stage, body.firstName, context)
    : (context ? `${SYSTEM}\n\nThe member is working on this business (use it to route and tailor your help):\n${context}` : SYSTEM);

  if (!process.env.ANTHROPIC_API_KEY) {
    if (morganMode) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, mode: 'fallback', reply: "I'm Morgan, your Business Advisor. I'll be fully live in just a moment — in the meantime, tell me what you'd like to work on, and feel free to explore your departments above.", actions: [] }) };
    }
    const { text, actions } = fallback(messages);
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, mode: 'fallback', reply: text, actions }) };
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 900, system, messages }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || 'Advisor error');
    const raw = (data.content || []).map(c => c.text || '').join('').trim();
    const { text, actions } = extractActions(raw || '', catalog);
    if (morganMode) {
      await saveMorganSession({ sessionId: body.sessionId, userEmail: body.userEmail, stage: body.stage, messages: messages.concat([{ role: 'assistant', content: text }]) });
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, mode: 'ai', reply: text || "I'm here — could you say a bit more?", actions }) };
  } catch (e) {
    if (morganMode) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, mode: 'fallback', reply: "I hit a brief connection issue — please try that again in a moment.", actions: [] }) };
    }
    const { text, actions } = fallback(messages);
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, mode: 'fallback', reply: text, actions }) };
  }
};
