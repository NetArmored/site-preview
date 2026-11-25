import { MAX_BODY, validateSubmission } from './validate.js';
import { evaluateScan, shortScanSummary } from './engine.js';
import { buildAppointmentUrl, industryLabel, siteOrigin } from './appointment.js';
import { toAiFacts, writeSummary } from './summary.js';
import { buildMessages, fromAddress, leadRecipient } from './emails.js';

const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 8;
const buckets = new Map();

export function resetRateLimit() { buckets.clear(); }

export function allowRequest(ip, now) {
  const key = ip || 'unknown';
  const fresh = (buckets.get(key) || []).filter(function (t) { return now - t < WINDOW_MS; });
  if (fresh.length >= LIMIT) {
    buckets.set(key, fresh);
    return false;
  }
  fresh.push(now);
  buckets.set(key, fresh);
  return true;
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function clientIp(request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
}

export function sameOrigin(request) {
  let target;
  try { target = new URL(request.url); } catch (e) { return false; }
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      const o = new URL(origin);
      return o.protocol === target.protocol && o.host === target.host;
    } catch (e) { return false; }
  }
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  return true;
}

export async function verifyTurnstile(secret, token, ip, fetchImpl) {
  if (!secret || /placeholder/i.test(secret)) return { ok: false, reason: 'not_configured' };
  if (!token) return { ok: false, reason: 'missing' };
  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (ip) body.set('remoteip', ip.split(',')[0].trim());
  let res;
  try {
    res = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
  } catch (e) {
    return { ok: false, reason: 'network' };
  }
  if (!res.ok) return { ok: false, reason: 'http' };
  let data = {};
  try { data = await res.json(); } catch (e) { return { ok: false, reason: 'http' }; }
  return { ok: data.success === true, reason: data.success ? 'ok' : 'rejected' };
}

export async function sendResend(apiKey, message, fetchImpl) {
  const res = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      from: message.from,
      to: message.to,
      reply_to: message.reply_to,
      subject: message.subject,
      html: message.html,
      text: message.text
    })
  });
  return { ok: res.ok, status: res.status };
}

function honeypotTripped(body) {
  if (!body || typeof body !== 'object') return false;
  const v = body.company_website;
  if (v == null || v === '') return false;
  if (typeof v === 'string') return v.trim() !== '';
  return true;
}

function configured(value) {
  return !!(value && !/placeholder/i.test(String(value)));
}

/**
 * Pages Function entry. deps.fetch and deps.now are for tests.
 * Recipients, subjects, and HTML are chosen here — never from the request body.
 */
export async function handleScanReport(request, env, deps) {
  const fetchImpl = (deps && deps.fetch) || fetch;
  const now = (deps && deps.now) ? deps.now() : Date.now();
  env = env || {};

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method !== 'POST') return json({ ok: false, code: 'method' }, 405);
  if (!sameOrigin(request)) return json({ ok: false, code: 'origin' }, 403);

  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY) return json({ ok: false, code: 'too_large' }, 413);

  let raw = '';
  try { raw = await request.text(); } catch (e) { return json({ ok: false, code: 'body' }, 400); }
  if (raw.length > MAX_BODY) return json({ ok: false, code: 'too_large' }, 413);

  let body;
  try { body = JSON.parse(raw); } catch (e) { return json({ ok: false, code: 'json' }, 400); }

  if (!allowRequest(clientIp(request) || 'unknown', now)) return json({ ok: false, code: 'rate' }, 429);

  if (honeypotTripped(body)) return json({ ok: true, sent: false }, 200);

  const validated = validateSubmission(body);
  if (!validated.ok) return json({ ok: false, code: 'validation', fields: validated.errors }, 400);

  if (!configured(env.TURNSTILE_SECRET_KEY) || !configured(env.RESEND_API_KEY)) {
    return json({ ok: false, code: 'mailer_not_configured' }, 503);
  }

  const turnstile = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, validated.value.turnstileToken, clientIp(request), fetchImpl);
  if (!turnstile.ok) return json({ ok: false, code: 'turnstile' }, 403);

  const report = evaluateScan(validated.value.scan);
  const facts = toAiFacts(report, validated.value.contact);
  const summary = await writeSummary(env, facts);

  const business = validated.value.contact.business || piiExtra(report);
  const appointmentUrl = buildAppointmentUrl({
    origin: siteOrigin(env),
    source: 'scan-consultation',
    name: validated.value.contact.name,
    email: validated.value.contact.email,
    business: business,
    phone: validated.value.contact.phone,
    industry: industryLabel(report.industry),
    summary: shortScanSummary(report)
  });

  const messages = buildMessages({
    contact: Object.assign({}, validated.value.contact, { business: business || validated.value.contact.business }),
    report: report,
    summary: summary,
    appointmentUrl: appointmentUrl,
    sentAt: new Date(now).toISOString()
  });

  if (messages.lead.to.length !== 1 || messages.lead.to[0] !== leadRecipient()) {
    return json({ ok: false, code: 'mailer' }, 500);
  }
  if (messages.lead.from !== fromAddress() || messages.visitor.from !== fromAddress()) {
    return json({ ok: false, code: 'mailer' }, 500);
  }
  if (messages.visitor.reply_to !== 'hello@netarmored.com') {
    return json({ ok: false, code: 'mailer' }, 500);
  }
  if (messages.visitor.to.length !== 1 || messages.visitor.to[0] !== validated.value.contact.email) {
    return json({ ok: false, code: 'mailer' }, 500);
  }

  let leadSent = false;
  let visitorSent = false;
  try {
    const lead = await sendResend(env.RESEND_API_KEY, messages.lead, fetchImpl);
    leadSent = lead.ok;
    const visitor = await sendResend(env.RESEND_API_KEY, messages.visitor, fetchImpl);
    visitorSent = visitor.ok;
  } catch (e) {
    return json({ ok: false, code: 'mailer' }, 502);
  }
  if (!leadSent || !visitorSent) return json({ ok: false, code: 'mailer' }, 502);
  return json({ ok: true, sent: true }, 200);
}

function piiExtra(report) {
  let found = '';
  (report.questions || []).forEach(function (q) {
    (q.extras || []).forEach(function (x) {
      if (!found && x.pii && x.value) found = x.value;
    });
  });
  return found;
}

export function onRequest(context) {
  return handleScanReport(context.request, context.env);
}
