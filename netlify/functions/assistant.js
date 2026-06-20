// Apropos Business Center — your personal AI Business Assistant.
// The 24/7 advisor the SBDC counselor could never be: no waitlist, knows YOUR
// business, available to the masses. Backed by Claude.
//
//   - With ANTHROPIC_API_KEY set → a live, conversational business advisor.
//   - Without it → an honest helpful fallback so the UI never breaks.

const MODEL = process.env.ASSISTANT_MODEL || 'claude-sonnet-4-6';

const SYSTEM = `You are the Apropos Business Assistant — a sharp, encouraging, plain-spoken business advisor available 24/7 inside the Apropos Business Center, an online business development center that DOES the work with founders instead of just advising them.

You are the personal counselor every founder wishes they had: no waitlist, no jargon, always in their corner. Help people START a business, BUILD their presence, WIN customers and government contracts, and GROW.

How you answer:
- Be concrete, prioritized, and action-oriented. Give the next 1-3 moves, not a lecture.
- Keep replies tight — a few short paragraphs or a short list. Match the person's level.
- When it fits naturally, point them to the Center's tools: the tailored Business Plan, the website builder, CapGen (brand & content creation), and StateGen (find & win government contracts). Don't force it.
- Be warm and direct. You believe in them and you tell the truth.
- This is practical guidance, not legal, tax, or financial advice — say so only when it genuinely matters.`;

function fallback(messages) {
  const last = [...messages].reverse().find(m => m.role === 'user')?.content || '';
  return `I'm your Apropos Business Assistant. (My live brain switches on the moment the API key is connected — until then, here's a real starting point.)

You asked about: "${String(last).slice(0, 140)}"

Three moves that apply to almost any business right now:
1. **Nail the one-sentence pitch** — who you help and the result you deliver. Everything else flows from it.
2. **Get findable** — a simple website and one social channel where your customers already are. The Center's website + CapGen tools can build these for you.
3. **Land your first 5 customers** before you perfect anything. Real feedback beats a perfect plan.

Generate your tailored business plan above, and connect the key to chat with me live.`;
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
  if (!messages.length) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Say something to your assistant.' }) };

  const context = String(body.context || '').slice(0, 6000);
  const system = context ? `${SYSTEM}\n\nThe founder is working on this business (use it to tailor your help):\n${context}` : SYSTEM;

  if (!process.env.ANTHROPIC_API_KEY) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, mode: 'fallback', reply: fallback(messages) }) };
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
    if (!r.ok) throw new Error(data?.error?.message || 'Assistant error');
    const reply = (data.content || []).map(c => c.text || '').join('').trim();
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, mode: 'ai', reply: reply || "I'm here — could you say a bit more?" }) };
  } catch (e) {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, mode: 'fallback', reply: fallback(messages) }) };
  }
};
