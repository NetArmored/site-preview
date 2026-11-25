import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleContact, validateContact, buildContactMessages } from '../functions/lib/contact.js';

function fields(extra) {
  const fd = new FormData();
  const base = Object.assign({
    biz: 'Northstar Cafe',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '(702) 555-0100',
    industry: 'Professional Services',
    challenges: 'Scheduling takes too long.',
    lead_source: 'scan-consultation',
    consent: 'on',
    marketing: 'on',
    company_website: '',
    'cf-turnstile-response': 'token-ok'
  }, extra || {});
  Object.keys(base).forEach(function (key) {
    const value = base[key];
    if (Array.isArray(value)) value.forEach(function (item) { fd.append(key, item); });
    else fd.set(key, value);
  });
  (extra && extra.svc || ['AI Strategy & Business Discovery', 'Managed AI Optimization']).forEach(function (item) {
    fd.append('svc', item);
  });
  return fd;
}

function request(body, opts) {
  const o = opts || {};
  return new Request('https://preview.example/api/contact', {
    method: o.method || 'POST',
    headers: Object.assign({
      origin: 'https://preview.example',
      'cf-connecting-ip': o.ip || ('203.0.113.' + (Math.floor(Math.random() * 200) + 1))
    }, o.headers || {}),
    body: o.method === 'GET' ? undefined : body
  });
}

function env() {
  return { RESEND_API_KEY: 're_test_key', TURNSTILE_SECRET_KEY: 'turnstile_test_secret' };
}

function mockFetch(turnstileOk) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init: init });
    if (String(url).includes('siteverify')) {
      return new Response(JSON.stringify({ success: turnstileOk !== false }), { status: 200 });
    }
    if (String(url).includes('api.resend.com')) {
      return new Response(JSON.stringify({ id: 'email_test' }), { status: 200 });
    }
    throw new Error('unexpected ' + url);
  };
  return { calls: calls, fetchImpl: fetchImpl };
}

test('validation requires the contact form fields and known industry', () => {
  const missing = validateContact({ name: '', email: 'nope', biz: '', industry: 'Gaming', consent: '' });
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.includes('name'));
  assert.ok(missing.errors.includes('email'));
  assert.ok(missing.errors.includes('biz'));
  assert.ok(missing.errors.includes('industry'));
  assert.ok(missing.errors.includes('consent'));
  const badService = validateContact({
    name: 'Ada', email: 'ada@example.com', biz: 'Cafe', industry: 'Other', consent: 'on', svc: ['Not a service']
  });
  assert.equal(badService.ok, false);
  assert.ok(badService.errors.includes('svc'));
});

test('lead email goes only to hello and includes every field', () => {
  const lead = validateContact({
    name: 'Ada <script>',
    email: 'ada@example.com',
    biz: 'Northstar Cafe',
    phone: '(702) 555-0100',
    industry: 'Professional Services',
    challenges: 'Scheduling takes too long.',
    svc: ['AI Integration & Automation'],
    consent: 'on',
    marketing: 'on',
    lead_source: 'scan-consultation'
  }).value;
  const messages = buildContactMessages(lead);
  assert.deepEqual(messages.lead.to, ['hello@netarmored.com']);
  assert.equal(messages.lead.reply_to, 'ada@example.com');
  assert.equal(messages.lead.from, 'NetArmored <hello@netarmored.com>');
  assert.equal(messages.lead.subject, 'Website lead: Northstar Cafe (Ada <script>)');
  assert.match(messages.lead.text, /Lead source: scan-consultation/);
  assert.match(messages.lead.text, /Insights opt-in: Yes/);
  assert.match(messages.lead.text, /Scheduling takes too long/);
  assert.match(messages.lead.text, /AI Integration & Automation/);
  assert.equal(messages.lead.html.includes('<script>'), false);
  assert.match(messages.lead.html, /&lt;script&gt;/);
  assert.equal(messages.visitor.to[0], 'ada@example.com');
  assert.equal(messages.visitor.reply_to, 'hello@netarmored.com');
  assert.match(messages.visitor.text, /received your consultation request/);
});

test('a valid submission emails hello and confirms to the visitor', async () => {
  const { calls, fetchImpl } = mockFetch(true);
  const res = await handleContact(request(fields(), { ip: '203.0.113.21' }), env(), { fetch: fetchImpl, now: () => 1764028800000 });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).ok, true);
  const verify = calls.find((c) => c.url.includes('siteverify'));
  assert.match(verify.init.body, /turnstile_test_secret/);
  const emails = calls.filter((c) => c.url.includes('api.resend.com')).map((c) => JSON.parse(c.init.body));
  assert.equal(emails.length, 2);
  const lead = emails.find((m) => m.to[0] === 'hello@netarmored.com');
  const visitor = emails.find((m) => m.to[0] === 'ada@example.com');
  assert.ok(lead);
  assert.deepEqual(lead.to, ['hello@netarmored.com']);
  assert.equal(lead.reply_to, 'ada@example.com');
  assert.match(lead.subject, /^Website lead: Northstar Cafe \(Ada Lovelace\)$/);
  assert.match(lead.text, /scan-consultation/);
  assert.match(lead.text, /Insights opt-in: Yes/);
  assert.equal(visitor.reply_to, 'hello@netarmored.com');
});

test('honeypot, failed turnstile, and missing keys do not send mail', async () => {
  const quiet = async () => { throw new Error('should not send'); };
  const honey = await handleContact(request(fields({ company_website: 'https://spam.example' }), { ip: '203.0.113.22' }), env(), { fetch: quiet, now: () => 1 });
  assert.equal(honey.status, 200);
  assert.equal((await honey.json()).ok, true);

  const { calls, fetchImpl } = mockFetch(false);
  const blocked = await handleContact(request(fields(), { ip: '203.0.113.23' }), env(), { fetch: fetchImpl, now: () => 1 });
  assert.equal(blocked.status, 403);
  assert.equal((await blocked.json()).code, 'turnstile');
  assert.equal(calls.some((c) => c.url.includes('api.resend.com')), false);

  const missing = await handleContact(request(fields(), { ip: '203.0.113.24' }), { RESEND_API_KEY: 're_placeholder', TURNSTILE_SECRET_KEY: 'x' }, { fetch: quiet, now: () => 1 });
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).code, 'mailer_not_configured');
});

test('client supplied recipients are ignored', async () => {
  const { calls, fetchImpl } = mockFetch(true);
  const body = fields();
  body.set('to', 'attacker@example.net');
  body.set('html', '<p>wire funds</p>');
  const res = await handleContact(request(body, { ip: '203.0.113.25' }), env(), { fetch: fetchImpl, now: () => 2 });
  assert.equal(res.status, 200);
  const emails = calls.filter((c) => c.url.includes('api.resend.com')).map((c) => JSON.parse(c.init.body));
  emails.forEach(function (message) {
    assert.equal(JSON.stringify(message.to).includes('attacker@example.net'), false);
    assert.equal(message.html.includes('wire funds'), false);
  });
});

test('missing fields and cross origin are refused before mail', async () => {
  const quiet = async () => { throw new Error('no'); };
  const bad = await handleContact(request(fields({ email: 'not-an-email', consent: '' }), { ip: '203.0.113.26' }), env(), { fetch: quiet, now: () => 3 });
  assert.equal(bad.status, 400);
  const payload = await bad.json();
  assert.equal(payload.code, 'validation');
  assert.ok(payload.fields.includes('email'));
  assert.ok(payload.fields.includes('consent'));
  const cross = await handleContact(request(fields(), { ip: '203.0.113.27', headers: { origin: 'https://evil.example' } }), env(), { fetch: quiet, now: () => 3 });
  assert.equal(cross.status, 403);
});

test('rate limit stops a burst', async () => {
  const ip = '198.51.100.44';
  const quiet = async () => { throw new Error('no'); };
  for (let i = 0; i < 8; i++) {
    const res = await handleContact(request(fields({ email: '' }), { ip: ip }), env(), { fetch: quiet, now: () => 50 });
    assert.notEqual(res.status, 429);
  }
  const blocked = await handleContact(request(fields({ email: '' }), { ip: ip }), env(), { fetch: quiet, now: () => 50 });
  assert.equal(blocked.status, 429);
});
