import { sameOrigin, verifyTurnstile, sendResend } from './handler.js';

const FROM = 'NetArmored <hello@netarmored.com>';
const LEAD_TO = 'hello@netarmored.com';
const MAX_BODY = 32 * 1024;
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 8;
const buckets = new Map();

const INDUSTRIES = [
  'Hospitality, Restaurants, Bars & Entertainment',
  'Retail & Convenience Stores',
  'Professional Services',
  'Logistics & Transportation',
  'Home Services & Field Operations',
  'Healthcare Administration',
  'Restaurants (Without Gaming)',
  'General Small Business Operations',
  'Other'
];

const SERVICES = [
  'AI Strategy & Business Discovery',
  'AI Integration & Automation',
  'Managed AI Optimization'
];

const EMAIL = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export function resetContactRateLimit() { buckets.clear(); }

function allow(ip, now) {
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

function oneLine(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function keepBreaks(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}

function checked(value) {
  const v = String(value == null ? '' : value).trim().toLowerCase();
  return v === 'on' || v === 'true' || v === 'yes' || v === '1';
}

function clientIp(request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
}

function configured(value) {
  return !!(value && !/placeholder/i.test(String(value)));
}

export function validateContact(fields) {
  const errors = [];
  const name = oneLine(fields.name, 160);
  const email = oneLine(fields.email, 160);
  const business = oneLine(fields.biz || fields.business, 160);
  const phone = oneLine(fields.phone, 160);
  const industry = oneLine(fields.industry, 80);
  const challenges = keepBreaks(fields.challenges || fields.message, 1000);
  const source = oneLine(fields.lead_source || fields.source || 'contact-page', 40).replace(/[^a-z0-9-]/gi, '') || 'contact-page';
  const services = (Array.isArray(fields.svc) ? fields.svc : (fields.svc ? [fields.svc] : []))
    .map(function (item) { return oneLine(item, 80); })
    .filter(Boolean);
  if (!name) errors.push('name');
  if (!email || !EMAIL.test(email)) errors.push('email');
  if (!business) errors.push('biz');
  if (!industry || INDUSTRIES.indexOf(industry) === -1) errors.push('industry');
  if (phone && !/^[0-9+().\-\s]+$/.test(phone)) errors.push('phone');
  if (services.some(function (item) { return SERVICES.indexOf(item) === -1; })) errors.push('svc');
  if (!checked(fields.consent)) errors.push('consent');
  const token = oneLine(fields['cf-turnstile-response'] || fields.turnstileToken, 2048);
  if (errors.length) return { ok: false, errors: [...new Set(errors)] };
  return {
    ok: true,
    value: {
      name: name,
      email: email,
      business: business,
      phone: phone,
      industry: industry,
      challenges: challenges,
      services: [...new Set(services)],
      consent: true,
      insights: checked(fields.marketing),
      source: source.slice(0, 40),
      turnstileToken: token
    }
  };
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function shell(title, inner) {
  return '<!DOCTYPE html><html lang="en"><body style="margin:0;padding:0;background:#E7EEF6;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E7EEF6;padding:24px 12px;"><tr><td align="center">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #D5E0EC;">'
    + '<tr><td style="background:#0B1424;padding:22px 28px;"><p style="margin:0;font:700 13px/1 Arial,Helvetica,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#2DD4BF;">NetArmored</p>'
    + '<p style="margin:8px 0 0;font:700 22px/1.25 Arial,Helvetica,sans-serif;color:#F8FAFC;">' + esc(title) + '</p></td></tr>'
    + '<tr><td style="padding:28px;">' + inner + '</td></tr>'
    + '<tr><td style="padding:0 28px 24px;"><p style="margin:0;font:13px/1.5 Arial,Helvetica,sans-serif;color:#5C6B80;">NetArmored Consulting LLC · Las Vegas, Nevada<br>'
    + '<a href="mailto:hello@netarmored.com" style="color:#377DFF;">hello@netarmored.com</a> · (702) 714-0714</p></td></tr>'
    + '</table></td></tr></table></body></html>';
}

function row(label, value) {
  return '<p style="margin:0 0 8px;font:15px/1.45 Arial,Helvetica,sans-serif;color:#1B2738;"><b>' + esc(label) + ':</b> ' + esc(value || '—') + '</p>';
}

export function buildContactMessages(lead) {
  const subject = ('Website lead: ' + lead.business + ' (' + lead.name + ')').replace(/[\r\n]+/g, ' ').slice(0, 140);
  const services = lead.services.length ? lead.services.join(', ') : 'None selected';
  const insights = lead.insights ? 'Yes' : 'No';
  const html = shell('Website lead',
    row('Business', lead.business)
    + row('Name', lead.name)
    + row('Email', lead.email)
    + row('Phone', lead.phone)
    + row('Industry', lead.industry)
    + row('Services', services)
    + row('Message', lead.challenges)
    + row('Lead source', lead.source)
    + row('Insights opt-in', insights)
    + row('Consent', 'Yes')
  );
  const text = [
    'Website lead',
    'Business: ' + lead.business,
    'Name: ' + lead.name,
    'Email: ' + lead.email,
    'Phone: ' + (lead.phone || '—'),
    'Industry: ' + lead.industry,
    'Services: ' + services,
    'Message: ' + (lead.challenges || '—'),
    'Lead source: ' + lead.source,
    'Insights opt-in: ' + insights,
    'Consent: Yes'
  ].join('\n');
  const first = lead.name.split(/\s+/)[0] || 'there';
  const visitorHtml = shell('We received your request',
    '<p style="margin:0 0 14px;font:16px/1.55 Arial,Helvetica,sans-serif;color:#1B2738;">Hello ' + esc(first) + ',</p>'
    + '<p style="margin:0;font:16px/1.55 Arial,Helvetica,sans-serif;color:#1B2738;">We received your consultation request'
    + (lead.business ? ' for ' + esc(lead.business) : '')
    + '. A person at NetArmored will reply to this email address.</p>'
  );
  const visitorText = 'Hello ' + first + ',\n\nWe received your consultation request' + (lead.business ? ' for ' + lead.business : '') + '. A person at NetArmored will reply to this email address.\n\nNetArmored Consulting LLC\nhello@netarmored.com\n(702) 714-0714';
  return {
    lead: { from: FROM, to: [LEAD_TO], reply_to: lead.email, subject: subject, html: html, text: text },
    visitor: {
      from: FROM,
      to: [lead.email],
      reply_to: 'hello@netarmored.com',
      subject: 'We received your NetArmored request',
      html: visitorHtml,
      text: visitorText
    }
  };
}

async function readFields(request) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY) return { error: json({ ok: false, code: 'too_large' }, 413) };
  let form;
  try { form = await request.formData(); }
  catch (e) { return { error: json({ ok: false, code: 'body' }, 400) }; }
  const fields = {};
  let size = 0;
  for (const [key, value] of form.entries()) {
    const text = typeof value === 'string' ? value : '';
    size += key.length + text.length;
    if (size > MAX_BODY) return { error: json({ ok: false, code: 'too_large' }, 413) };
    if (key === 'svc') {
      fields.svc = fields.svc || [];
      fields.svc.push(text);
    } else if (fields[key] == null) {
      fields[key] = text;
    }
  }
  return { fields: fields };
}

export async function handleContact(request, env, deps) {
  const fetchImpl = (deps && deps.fetch) || fetch;
  const now = (deps && deps.now) ? deps.now() : Date.now();
  env = env || {};
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method !== 'POST') return json({ ok: false, code: 'method' }, 405);
  if (!sameOrigin(request)) return json({ ok: false, code: 'origin' }, 403);

  const read = await readFields(request);
  if (read.error) return read.error;
  const fields = read.fields;
  const ip = clientIp(request) || 'unknown';
  if (!allow(ip, now)) return json({ ok: false, code: 'rate' }, 429);

  if (String(fields.company_website || '').trim()) return json({ ok: true }, 200);

  const validated = validateContact(fields);
  if (!validated.ok) return json({ ok: false, code: 'validation', fields: validated.errors }, 400);

  if (!configured(env.TURNSTILE_SECRET_KEY) || !configured(env.RESEND_API_KEY)) {
    return json({ ok: false, code: 'mailer_not_configured' }, 503);
  }
  const turnstile = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, validated.value.turnstileToken, ip, fetchImpl);
  if (!turnstile.ok) return json({ ok: false, code: 'turnstile' }, 403);

  const messages = buildContactMessages(validated.value);
  if (messages.lead.to.length !== 1 || messages.lead.to[0] !== LEAD_TO || messages.lead.from !== FROM) {
    return json({ ok: false, code: 'mailer' }, 500);
  }
  let lead;
  try {
    lead = await sendResend(env.RESEND_API_KEY, messages.lead, fetchImpl);
  } catch (e) {
    return json({ ok: false, code: 'mailer' }, 502);
  }
  if (!lead.ok) return json({ ok: false, code: 'mailer' }, 502);
  try { await sendResend(env.RESEND_API_KEY, messages.visitor, fetchImpl); } catch (e) { /* lead already sent */ }
  return json({ ok: true }, 200);
}

export function onRequest(context) {
  return handleContact(context.request, context.env);
}
