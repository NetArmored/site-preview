import { industryIds, readyIds, followUpIds, answerSpec, followUpSpec } from './engine.js';

export const MAX_BODY = 32 * 1024;

const EMAIL = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const PHONE = /^[0-9+().\-\s]{0,40}$/;

function str(value) {
  return typeof value === 'string' ? value : '';
}

function oneLine(value, max) {
  return str(value).replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);
}

export function validateSubmission(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, errors: ['body'] };
  }

  const contactIn = body.contact && typeof body.contact === 'object' ? body.contact : {};
  const name = oneLine(contactIn.name, 80);
  const email = oneLine(contactIn.email, 120);
  const phone = oneLine(contactIn.phone, 40);
  const business = oneLine(contactIn.business, 120);

  if (!name) errors.push('name');
  if (!email || !EMAIL.test(email) || email.length > 120) errors.push('email');
  if (phone && !PHONE.test(phone)) errors.push('phone');
  if (business.length > 120) errors.push('business');
  if (body.consent !== true) errors.push('consent');

  const token = oneLine(body.turnstileToken, 2048);
  if (body.turnstileToken != null && typeof body.turnstileToken !== 'string') errors.push('turnstile');

  const scanIn = body.scan && typeof body.scan === 'object' ? body.scan : null;
  if (!scanIn) errors.push('scan');
  const industry = scanIn ? oneLine(scanIn.industry, 40) : '';
  if (!industryIds().includes(industry)) errors.push('industry');

  let answers = {};
  let followUp = null;
  let followUpAnswer = null;
  if (scanIn && industryIds().includes(industry)) {
    const cleaned = cleanAnswers(industry, scanIn.answers);
    if (!cleaned.ok) errors.push(...cleaned.errors);
    else answers = cleaned.answers;
    const fu = cleanFollowUp(scanIn.followUp, scanIn.followUpAnswer);
    if (!fu.ok) errors.push('followUp');
    else {
      followUp = fu.followUp;
      followUpAnswer = fu.followUpAnswer;
    }
  }

    const picked = Object.keys(answers).some(function (key) {
      return Array.isArray(answers[key]) && answers[key].length > 0;
    });
    if (!picked) errors.push('answers');

    if (errors.length) return { ok: false, errors: [...new Set(errors)] };

  return {
    ok: true,
    value: {
      contact: { name, email, phone, business },
      consent: true,
      turnstileToken: token,
      scan: { industry, answers, followUp, followUpAnswer }
    }
  };
}

function cleanAnswers(industry, raw) {
  if (raw == null) return { ok: true, answers: {} };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['answers'] };
  const spec = answerSpec(industry);
  const answers = {};
  const errors = [];
  const keys = Object.keys(raw);
  if (keys.length > 40) return { ok: false, errors: ['answers'] };

  keys.forEach(function (key) {
    if (key.endsWith('_star')) {
      const qid = key.slice(0, -5);
      if (!spec[qid] || !spec[qid].star) errors.push('answers');
      return;
    }
    if (key.endsWith('_text')) {
      const qid = key.slice(0, -5);
      if (!spec[qid] || !spec[qid].text) errors.push('answers');
      return;
    }
    if (key === 'ready') return;
    if (!spec[key]) errors.push('answers');
  });
  if (errors.length) return { ok: false, errors };

  Object.keys(spec).forEach(function (key) {
    const rule = spec[key];
    if (rule.values) {
      const selected = asChoiceList(raw[key], rule.values);
      if (selected === null) {
        errors.push('answers');
        return;
      }
      let picks = selected;
      if (rule.exclusive && picks.includes(rule.exclusive)) picks = [rule.exclusive];
      answers[key] = picks;
      if (rule.star) {
        const star = raw[key + '_star'];
        if (star == null || star === '') {
          answers[key + '_star'] = null;
        } else if (typeof star === 'string' && picks.includes(star)) {
          answers[key + '_star'] = star;
        } else if (typeof star === 'string' && !picks.includes(star)) {
          answers[key + '_star'] = null;
        } else {
          errors.push('answers');
        }
      }
      if (rule.text) {
        const text = raw[key + '_text'];
        if (text == null || text === '') answers[key + '_text'] = '';
        else if (typeof text === 'string') answers[key + '_text'] = oneLine(text, 500);
        else errors.push('answers');
      }
    } else if (rule.text) {
      const text = raw[key];
      if (text == null || text === '') return;
      if (typeof text !== 'string') {
        errors.push('answers');
        return;
      }
      const cleaned = oneLine(text, rule.max || 120);
      if (cleaned) answers[key] = cleaned;
    }
  });

  if (raw.ready == null || raw.ready === '') {
    answers.ready = 'explore';
  } else if (typeof raw.ready === 'string' && readyIds().includes(raw.ready)) {
    answers.ready = raw.ready;
  } else {
    errors.push('ready');
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, answers };
}

function asChoiceList(value, allowed) {
  if (value == null || value === '') return [];
  const list = Array.isArray(value) ? value : [value];
  if (list.length > 12) return null;
  const out = [];
  for (const item of list) {
    if (typeof item !== 'string' || !allowed.includes(item)) return null;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

function cleanFollowUp(id, answer) {
  if (id == null || id === '') return { ok: true, followUp: null, followUpAnswer: null };
  if (typeof id !== 'string' || !followUpIds().includes(id)) return { ok: false };
  const spec = followUpSpec(id);
  if (answer == null || answer === '') return { ok: true, followUp: id, followUpAnswer: null };
  if (typeof answer !== 'string' || !spec.values.includes(answer)) return { ok: false };
  return { ok: true, followUp: id, followUpAnswer: answer };
}
