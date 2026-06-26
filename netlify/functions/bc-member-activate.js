'use strict';

// Business Center one-time activation
// Verifies the welcome-email access code once, then marks the shared member profile activated.
// Required Netlify env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.

const SUPABASE_URL = (process.env.BC_SUPA_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.BC_SUPA_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(statusCode, body) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

function headers(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    authorization: `Bearer ${SERVICE_KEY}`,
    'content-type': 'application/json',
    ...extra,
  };
}

function clean(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function normalizeCode(value) {
  return clean(value, 80).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function memberAccessCode(member) {
  // login_code is the existing Business Center table column shown in Supabase.
  // capgen_access_code is supported for forward compatibility with earlier build notes.
  return normalizeCode(member.login_code || member.capgen_access_code || '');
}

function activeMember(member) {
  const status = String(member.subscription_status || '').toLowerCase();
  if (['active', 'trial', 'trialing', 'paid', 'comp'].includes(status)) return true;
  const trialEnd = member.trial_end ? Date.parse(member.trial_end) : 0;
  return Number.isFinite(trialEnd) && trialEnd > Date.now();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'POST only' });
  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { ok: false, error: 'Supabase environment variables are not configured.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { ok: false, error: 'Invalid JSON.' }); }

  const email = clean(body.email, 180).toLowerCase();
  const accessCode = normalizeCode(body.accessCode || body.code);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { ok: false, error: 'A valid email address is required.' });
  }
  if (!accessCode) return json(400, { ok: false, error: 'Access code is required.' });

  const select = 'id,email,full_name,business_name,industry,city,state,subscription_status,trial_end,login_code,capgen_access_code';
  const lookupUrl = `${SUPABASE_URL}/rest/v1/biz_center_members?email=eq.${encodeURIComponent(email)}&select=${encodeURIComponent(select)}`;
  const lookup = await fetch(lookupUrl, { headers: headers() });
  const members = await lookup.json().catch(() => []);

  if (!lookup.ok) return json(500, { ok: false, error: members?.message || 'Could not verify member profile.' });
  if (!Array.isArray(members) || !members.length) return json(404, { ok: false, error: 'No Business Center member was found for that email.' });

  const member = members.find(m => memberAccessCode(m) === accessCode);
  if (!member) {
    return json(401, {
      ok: false,
      error: `The access code does not match this member email. Found ${members.length} member record(s) for this email, but none contain that code in login_code or capgen_access_code.`,
    });
  }

  if (!activeMember(member)) return json(403, { ok: false, error: 'This Business Center membership is not active.' });

  const activatedAt = new Date().toISOString();
  let activationStored = false;
  let activationWarning = null;

  // Activate only the row where email + code matched.
  const patchActivation = await fetch(`${SUPABASE_URL}/rest/v1/biz_center_members?id=eq.${encodeURIComponent(member.id)}`, {
    method: 'PATCH',
    headers: headers({ Prefer: 'return=minimal' }),
    body: JSON.stringify({
      bc_access_activated: true,
      bc_access_activated_at: activatedAt,
      last_visit: activatedAt,
    }),
  });

  if (patchActivation.ok) {
    activationStored = true;
  } else {
    const err = await patchActivation.json().catch(() => null);
    activationWarning = err?.message || 'Activation flag was verified but could not be stored. Run the BC activation schema SQL.';
    await fetch(`${SUPABASE_URL}/rest/v1/biz_center_members?id=eq.${encodeURIComponent(member.id)}`, {
      method: 'PATCH',
      headers: headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ last_visit: activatedAt }),
    }).catch(() => null);
  }

  return json(200, {
    ok: true,
    activated: activationStored,
    activationWarning,
    matchedRecords: members.length,
    codeColumnUsed: member.login_code ? 'login_code' : 'capgen_access_code',
    member: {
      id: member.id,
      email: member.email,
      fullName: member.full_name || '',
      businessName: member.business_name || '',
      industry: member.industry || '',
      city: member.city || '',
      state: member.state || '',
      activatedAt,
    },
  });
};
