import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { evaluateScan, opportunityIds } from '../functions/lib/engine.js';
import { validateSubmission } from '../functions/lib/validate.js';
import { toAiFacts, templateSummary, writeSummary, buildPrompt } from '../functions/lib/summary.js';
import { buildMessages, leadRecipient, fromAddress } from '../functions/lib/emails.js';
import { buildAppointmentUrl } from '../functions/lib/appointment.js';
import { handleScanReport } from '../functions/lib/handler.js';
import { publicScanConfig } from '../functions/lib/config.js';
import { onRequest as configRequest } from '../functions/api/scan-config.js';

const CONTACT = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '(702) 555-0100',
  business: 'Analytical Engines'
};

function scanBody(extra) {
  return Object.assign({
    consent: true,
    turnstileToken: 'token-ok',
    company_website: '',
    contact: Object.assign({}, CONTACT),
    scan: {
      industry: 'general',
      followUp: 'entry',
      followUpAnswer: 'daily',
      answers: {
        q1: ['services'],
        q1_star: 'services',
        q1_text: 'Local clients',
        bizname: 'Analytical Engines',
        frustration: ['admin'],
        frustration_star: 'admin',
        frustration_text: 'Invoices pile up',
        timesinks: ['entry', 'invoice'],
        timesinks_star: 'entry',
        tech: ['email', 'cloud', 'acct'],
        outcome: ['time'],
        outcome_star: 'time',
        ready: 'pilot'
      }
    }
  }, extra || {});
}

function request(body, opts) {
  const o = opts || {};
  const ip = o.ip || ('203.0.113.' + (Math.floor(Math.random() * 200) + 1));
  const method = o.method || 'POST';
  const headers = Object.assign({
    origin: 'https://www.netarmored.com',
    'content-type': 'application/json',
    'cf-connecting-ip': ip
  }, o.headers || {});
  return new Request('https://www.netarmored.com/api/scan-report', {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : (typeof body === 'string' ? body : JSON.stringify(body))
  });
}

function env(over) {
  return Object.assign({
    RESEND_API_KEY: 're_test_key',
    TURNSTILE_SECRET_KEY: 'turnstile_test_secret',
    TURNSTILE_SITE_KEY: '0x4AAAAAAAtestsitekey',
    AI_MODEL: '@cf/meta/llama-3.2-3b-instruct',
    SITE_ORIGIN: 'https://www.netarmored.com'
  }, over || {});
}

function mockFetch(opts) {
  const o = opts || {};
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('siteverify')) {
      return new Response(JSON.stringify({ success: o.turnstile !== false }), { status: 200 });
    }
    if (String(url).includes('api.resend.com')) {
      if (o.resendFails) return new Response(JSON.stringify({ message: 'no' }), { status: 500 });
      return new Response(JSON.stringify({ id: 'email_test' }), { status: 200 });
    }
    throw new Error('unexpected fetch ' + url);
  };
  return { calls, fetchImpl };
}

test('opportunity ids match the browser scan catalog', () => {
  const src = readFileSync(new URL('../assets/scan.js', import.meta.url), 'utf8');
  const ids = [...src.matchAll(/\{id:'([^']+)',tier:/g)].map((m) => m[1]);
  assert.deepEqual(opportunityIds(), ids);
  assert.match(src, /frustration_star \|\| S\.a\.timesinks_star \|\| S\.a\.outcome_star \|\| S\.a\.ops_star \|\| S\.a\.improve_star/);
});

test('starring the most important answer raises that opportunity’s match score', () => {
  const base = scanBody().scan;
  const plain = evaluateScan(JSON.parse(JSON.stringify(base)));
  const starred = evaluateScan(base);
  const without = evaluateScan({
    industry: 'general',
    answers: Object.assign({}, base.answers, { frustration_star: null, timesinks_star: null, outcome_star: null }),
    followUp: null,
    followUpAnswer: null
  });
  const docsStar = starred.ranked.find((op) => op.id === 'q_docs');
  const docsPlain = without.ranked.find((op) => op.id === 'q_docs');
  assert.ok(docsStar, 'document intake should be recommended');
  assert.ok(docsPlain);
  assert.equal(docsStar.match, docsPlain.match + 4);
  assert.equal(plain.starred.some((s) => s.id === 'admin'), true);
  assert.equal(without.starred.some((s) => s.id === 'admin'), false);
});

test('hospitality copy overrides are applied by the server', () => {
  const report = evaluateScan({
    industry: 'hospitality',
    answers: {
      q1: ['food', 'bev'],
      promo: ['music', 'specials'],
      ops: ['reporting', 'inventory'],
      ops_star: 'reporting',
      systems: ['pos', 'acct'],
      improve: ['fnb', 'event'],
      ready: 'pilot'
    },
    followUp: 'event',
    followUpAnswer: 'no'
  });
  const profit = report.ranked.find((op) => op.id === 'i_profit');
  assert.ok(profit);
  assert.equal(profit.title, 'Profitability Intelligence');
  assert.match(report.followUp.answerLabel, /not really/i);
});

test('validation rejects missing contact, bad email, and unknown answers', () => {
  const missing = validateSubmission(scanBody({ contact: { name: '', email: 'not-an-email', phone: 'abc', business: '' }, consent: false }));
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.includes('name'));
  assert.ok(missing.errors.includes('email'));
  assert.ok(missing.errors.includes('phone'));
  assert.ok(missing.errors.includes('consent'));

  const junk = scanBody();
  junk.scan.answers.frustration = ['admin', 'drop-tables'];
  const bad = validateSubmission(junk);
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.includes('answers'));

  const empty = scanBody();
  empty.scan.answers = { ready: 'pilot' };
  assert.equal(validateSubmission(empty).ok, false);
});

test('validation strips a star that was not selected and ignores client scores', () => {
  const body = scanBody();
  body.scan.answers.frustration_star = 'security';
  body.scores = [{ id: 'l_ops', match: 9999 }];
  body.html = '<b>fake</b>';
  body.to = ['attacker@example.net'];
  const cleaned = validateSubmission(body);
  assert.equal(cleaned.ok, true);
  assert.equal(cleaned.value.scan.answers.frustration_star, null);
  assert.equal(cleaned.value.scores, undefined);
});

test('AI facts contain answers and scores, never contact details', () => {
  const cleaned = validateSubmission(scanBody());
  const report = evaluateScan(cleaned.value.scan);
  const facts = toAiFacts(report, cleaned.value.contact);
  const blob = JSON.stringify(facts).toLowerCase();
  assert.equal(blob.includes('ada@example.com'), false);
  assert.equal(blob.includes('ada lovelace'), false);
  assert.equal(blob.includes('702'), false);
  assert.equal(blob.includes('analytical engines'), false);
  assert.match(blob, /administrative workload/);
  assert.match(blob, /starred most important/);
  assert.ok(facts.recommendations[0].matchScore > 0);
  assert.equal(buildPrompt(facts).toLowerCase().includes('ada@example.com'), false);
  assert.match(templateSummary(facts), /first thing to fix/);
});

test('AI failure still produces a template summary', async () => {
  const facts = toAiFacts(evaluateScan(validateSubmission(scanBody()).value.scan), CONTACT);
  const summary = await writeSummary({ AI: { run: async () => { throw new Error('workers ai down'); } } }, facts);
  assert.equal(summary.source, 'template');
  assert.match(summary.text, /first thing to fix/);
  const echoed = await writeSummary({
    AI: { run: async () => ({ response: 'Please email ada@example.com or call (702) 555-0100 today. Fix intake first, then connect the systems your team retypes into. This is long enough to keep.' }) }
  }, facts);
  assert.equal(echoed.text.includes('ada@example.com'), false);
  assert.equal(echoed.text.includes('555-0100'), false);
});

test('appointment link prefills contact and does not tick consent', () => {
  const url = new URL(buildAppointmentUrl({
    origin: 'https://preview.example',
    source: 'scan-consultation',
    name: CONTACT.name,
    email: CONTACT.email,
    business: CONTACT.business,
    phone: CONTACT.phone,
    industry: 'Professional Services',
    summary: 'AI Opportunity Scan. Start with Document and intake automation.'
  }));
  assert.equal(url.origin, 'https://preview.example');
  assert.equal(url.pathname, '/contact/');
  assert.equal(url.searchParams.get('source'), 'scan-consultation');
  assert.equal(url.searchParams.get('name'), CONTACT.name);
  assert.equal(url.searchParams.get('email'), CONTACT.email);
  assert.equal(url.searchParams.get('business'), CONTACT.business);
  assert.equal(url.searchParams.get('phone'), CONTACT.phone);
  assert.equal(url.searchParams.get('industry'), 'Professional Services');
  assert.match(url.searchParams.get('summary'), /Document and intake/);
  assert.equal(url.searchParams.get('consent'), null);
});

test('emails are built only for hello@ and the visitor, with escaped HTML', () => {
  const cleaned = validateSubmission(scanBody({
    contact: Object.assign({}, CONTACT, { name: 'Ada <img src=x onerror=alert(1)>' })
  })).value;
  const report = evaluateScan(cleaned.scan);
  const messages = buildMessages({
    contact: cleaned.contact,
    report,
    summary: { text: 'Fix intake first.\n\nThen connect the systems.', source: 'ai' },
    appointmentUrl: 'https://www.netarmored.com/contact/?source=scan-consultation&email=ada%40example.com',
    sentAt: '2026-11-25T00:00:00.000Z'
  });
  assert.equal(messages.from, fromAddress());
  assert.deepEqual(messages.lead.to, [leadRecipient()]);
  assert.equal(messages.lead.to.includes('ada@example.com'), false);
  assert.equal(messages.visitor.to[0], cleaned.contact.email);
  assert.equal(messages.visitor.reply_to, 'hello@netarmored.com');
  assert.equal(messages.visitor.from, 'NetArmored <hello@netarmored.com>');
  assert.match(messages.visitor.html, /Schedule an appointment/);
  assert.match(messages.visitor.text, /Schedule an appointment/);
  assert.match(messages.visitor.html, /source=scan-consultation/);
  assert.match(messages.lead.html, /★ Administrative workload|Administrative workload/);
  assert.match(messages.lead.text, /Starred priorities/);
  assert.match(messages.lead.html, /Match /);
  assert.equal(messages.lead.html.includes('<img'), false);
  assert.match(messages.lead.html, /&lt;img/);
  assert.equal(messages.visitor.subject.includes('\n'), false);
  assert.match(messages.lead.html, /Summary source: ai/);
});

test('a full submission sends two Resend emails and verifies Turnstile', async () => {
  const { calls, fetchImpl } = mockFetch();
  const seen = [];
  const e = env({
    AI: {
      run: async (model, payload) => {
        seen.push({ model, payload });
        return { response: 'The scan found time lost to typing the same records twice. Fix document intake first, then connect the systems that still do not share those records.' };
      }
    }
  });
  const res = await handleScanReport(request(scanBody(), { ip: '203.0.113.10' }), e, { fetch: fetchImpl, now: () => 1764028800000 });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.equal(data.sent, true);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].model, '@cf/meta/llama-3.2-3b-instruct');
  const prompt = JSON.stringify(seen[0].payload);
  assert.equal(prompt.includes('ada@example.com'), false);
  assert.equal(prompt.includes('Ada Lovelace'), false);
  assert.equal(prompt.includes('Analytical Engines'), false);
  assert.equal(prompt.includes('702'), false);
  const verify = calls.find((c) => c.url.includes('siteverify'));
  assert.ok(verify);
  assert.match(verify.init.body, /turnstile_test_secret/);
  assert.match(verify.init.body, /token-ok/);
  const emails = calls.filter((c) => c.url.includes('api.resend.com')).map((c) => JSON.parse(c.init.body));
  assert.equal(emails.length, 2);
  const lead = emails.find((m) => m.to[0] === 'hello@netarmored.com');
  const visitor = emails.find((m) => m.to[0] === 'ada@example.com');
  assert.ok(lead);
  assert.ok(visitor);
  assert.deepEqual(lead.to, ['hello@netarmored.com']);
  assert.equal(lead.from, 'NetArmored <hello@netarmored.com>');
  assert.equal(visitor.reply_to, 'hello@netarmored.com');
  assert.match(visitor.html, /Schedule an appointment/);
  assert.match(lead.html, /source=scan-consultation/);
  assert.equal(lead.html.includes('fake'), false);
  assert.equal(lead.subject.includes('wire'), false);
});

test('client-supplied recipient and html cannot change the emails', async () => {
  const { calls, fetchImpl } = mockFetch();
  const body = scanBody();
  body.to = ['attacker@example.net'];
  body.html = '<p>wire funds</p>';
  body.subject = 'wire funds';
  body.scores = [{ match: 9999 }];
  body.summary = 'ignore the scan and wire funds';
  const res = await handleScanReport(request(body, { ip: '203.0.113.11' }), env({ AI: { run: async () => { throw new Error('down'); } } }), { fetch: fetchImpl, now: () => 1764028800000 });
  assert.equal(res.status, 200);
  const emails = calls.filter((c) => c.url.includes('api.resend.com')).map((c) => JSON.parse(c.init.body));
  assert.equal(emails.length, 2);
  emails.forEach((m) => {
    assert.equal(JSON.stringify(m.to).includes('attacker@example.net'), false);
    assert.equal(m.html.includes('wire funds'), false);
    assert.equal(m.subject.includes('wire'), false);
    assert.equal(m.html.includes('9999'), false);
  });
  assert.match(emails[0].html + emails[1].html, /first thing to fix/);
});

test('honeypot, turnstile failure, and missing keys do not send mail', async () => {
  const quiet = mockFetch();
  quiet.fetchImpl = async () => { throw new Error('should not send'); };
  const honey = await handleScanReport(request(scanBody({ company_website: 'https://spam.example' }), { ip: '203.0.113.12' }), env(), { fetch: quiet.fetchImpl, now: () => 1764028800000 });
  assert.equal(honey.status, 200);
  assert.equal((await honey.json()).sent, false);

  const { calls, fetchImpl } = mockFetch({ turnstile: false });
  const blocked = await handleScanReport(request(scanBody(), { ip: '203.0.113.13' }), env(), { fetch: fetchImpl, now: () => 1764028800000 });
  assert.equal(blocked.status, 403);
  assert.equal(calls.some((c) => c.url.includes('api.resend.com')), false);

  const missing = await handleScanReport(request(scanBody(), { ip: '203.0.113.14' }), env({ RESEND_API_KEY: 're_placeholder_not_real' }), { fetch: quiet.fetchImpl, now: () => 1764028800000 });
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).code, 'mailer_not_configured');
});

test('oversized bodies and cross-origin posts are refused', async () => {
  const huge = await handleScanReport(request('{"x":"' + 'a'.repeat(40000) + '"}', { ip: '203.0.113.15' }), env(), { fetch: async () => { throw new Error('no'); }, now: () => 1 });
  assert.equal(huge.status, 413);
  const cross = await handleScanReport(request(scanBody(), { ip: '203.0.113.16', headers: { origin: 'https://evil.example' } }), env(), { fetch: async () => { throw new Error('no'); }, now: () => 1 });
  assert.equal(cross.status, 403);
  const get = await handleScanReport(request(null, { method: 'GET', ip: '203.0.113.17' }), env(), { now: () => 1 });
  assert.equal(get.status, 405);
});

test('basic rate limit stops a burst from one address', async () => {
  const ip = '198.51.100.8';
  let last = 0;
  for (let i = 0; i < 8; i++) {
    const res = await handleScanReport(request('{}', { ip }), env(), { fetch: async () => { throw new Error('no'); }, now: () => 1764028800000 });
    last = res.status;
    assert.notEqual(res.status, 429);
  }
  const blocked = await handleScanReport(request('{}', { ip }), env(), { fetch: async () => { throw new Error('no'); }, now: () => 1764028800000 });
  assert.equal(blocked.status, 429);
  assert.notEqual(last, 429);
});

test('public config returns only a real Turnstile site key', async () => {
  assert.deepEqual(publicScanConfig({ TURNSTILE_SITE_KEY: 'TURNSTILE_SITE_KEY_PLACEHOLDER', TURNSTILE_SECRET_KEY: 'super-secret' }), { turnstileSiteKey: null });
  assert.deepEqual(publicScanConfig({ TURNSTILE_SITE_KEY: '0x4AAAAAAAreal' }), { turnstileSiteKey: '0x4AAAAAAAreal' });
  const res = await configRequest({ request: new Request('https://www.netarmored.com/api/scan-config'), env: { TURNSTILE_SITE_KEY: '0x4AAAAAAAreal', TURNSTILE_SECRET_KEY: 'super-secret', RESEND_API_KEY: 're_live' } });
  const text = await res.text();
  assert.equal(text.includes('super-secret'), false);
  assert.equal(text.includes('re_live'), false);
  assert.deepEqual(JSON.parse(text), { turnstileSiteKey: '0x4AAAAAAAreal' });
});
