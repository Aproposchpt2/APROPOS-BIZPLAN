// Apropos Business Center — the AI Agent Coach.
// Not just a chat advisor: a ROUTER WITH CONTEXT. It knows the member's profile
// AND the Center's full service catalog (the "rooms"), so it can recommend the
// right service and OPEN it — Door 2 of the dual-door delivery model.
//
//   - With ANTHROPIC_API_KEY set → a live, conversational coach that routes.
//   - Without it → an honest helpful fallback so the UI never breaks.

const MODEL = process.env.ASSISTANT_MODEL || 'claude-sonnet-4-6';

// THE ROOMS. Every service the Coach can recommend/open. `kind` drives the door:
//   included → opens the module (same session = member profile already loaded).
//   addon    → routes to a setup request (add-on billing is manual for now).
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

// Pull the [[OPEN: ...]] tag out of the model's reply → clean text + action buttons.
function extractActions(reply) {
  const m = reply.match(/\[\[\s*OPEN\s*:([^\]]*)\]\]/i);
  if (!m) return { text: reply.trim(), actions: [] };
  const text = reply.slice(0, m.index).trim();
  const ids = m[1].split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const seen = new Set();
  const actions = [];
  for (const id of ids) {
    if (seen.has(id) || !CATALOG[id]) continue;
    seen.add(id);
    const s = CATALOG[id];
    actions.push({ id, label: s.label, href: s.href, kind: s.kind });
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
  if (!messages.length) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Say something to your coach.' }) };

  const context = String(body.context || '').slice(0, 6000);
  const system = context ? `${SYSTEM}\n\nThe member is working on this business (use it to route and tailor your help):\n${context}` : SYSTEM;

  if (!process.env.ANTHROPIC_API_KEY) {
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
    if (!r.ok) throw new Error(data?.error?.message || 'Coach error');
    const raw = (data.content || []).map(c => c.text || '').join('').trim();
    const { text, actions } = extractActions(raw || '');
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, mode: 'ai', reply: text || "I'm here — could you say a bit more?", actions }) };
  } catch (e) {
    const { text, actions } = fallback(messages);
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, mode: 'fallback', reply: text, actions }) };
  }
};
