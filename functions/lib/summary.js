/** AI summary. Contact details are never placed in the prompt. */

const DEFAULT_MODEL = '@cf/meta/llama-3.2-3b-instruct';

function bannedValues(contact) {
  const c = contact || {};
  return [c.name, c.email, c.phone, c.business]
    .map(function (v) { return String(v || '').trim().toLowerCase(); })
    .filter(Boolean);
}

function looksBanned(value, banned) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return false;
  return banned.some(function (b) { return b && (v === b || v.includes(b)); });
}

/** Facts safe to send to Workers AI: answers, scores, industry. No contact fields. */
export function toAiFacts(report, contact) {
  const banned = bannedValues(contact);
  const questions = (report.questions || []).map(function (q) {
    return {
      question: q.title,
      selected: (q.picks || []).map(function (p) {
        return p.starred ? p.label + ' (starred most important)' : p.label;
      }),
      note: q.text && !looksBanned(q.text, banned) ? q.text : '',
      details: (q.extras || []).filter(function (x) { return !x.pii && !looksBanned(x.value, banned); }).map(function (x) {
        return x.label + ': ' + x.value;
      })
    };
  }).map(function (q) {
    const out = { question: q.question, selected: q.selected };
    if (q.note) out.note = q.note;
    if (q.details.length) out.details = q.details;
    return out;
  });

  return {
    industry: report.industryName,
    readiness: report.readinessLabel,
    answers: questions,
    starredPriorities: (report.starred || []).map(function (s) { return s.label; }),
    followUp: report.followUp && report.followUp.answerLabel ? {
      question: report.followUp.title,
      answer: report.followUp.answerLabel
    } : null,
    recommendations: (report.ranked || []).map(function (op) {
      return {
        tier: op.tierLabel,
        title: op.title,
        why: op.summary,
        matchScore: op.match,
        impact: op.impact,
        feasibility: op.feasibility
      };
    })
  };
}

export function templateSummary(facts) {
  const industry = facts.industry || 'this business';
  const first = facts.recommendations && facts.recommendations[0];
  const second = facts.recommendations && facts.recommendations[1];
  if (!first) {
    return 'For ' + industry + ', the answers did not point to one strong starting point. A short conversation can sort out which workflow is worth fixing first. These are preliminary ideas, not a commitment or a guaranteed result.';
  }
  let text = 'For ' + industry + ', the scan points to ' + first.title + ' as the first thing to fix. ' + first.why;
  if (second) text += ' After that, look at ' + second.title + '.';
  text += ' These are preliminary ideas from the answers, not a commitment or a guaranteed result.';
  return text;
}

export function buildPrompt(facts) {
  return [
    'Write two short paragraphs for the business owner.',
    'Paragraph 1: what the scan found.',
    'Paragraph 2: what to fix first, and the one step after that.',
    'Use only the JSON facts below. Do not invent prices, timelines, vendors, or contact details.',
    'Do not greet anyone by name. Do not mention an email address or phone number.',
    'Plain text. No markdown, no bullet characters.',
    '',
    JSON.stringify(facts)
  ].join('\n');
}

function extractText(out) {
  if (!out) return '';
  if (typeof out === 'string') return out;
  if (typeof out.response === 'string') return out.response;
  if (out.result && typeof out.result.response === 'string') return out.result.response;
  return '';
}

export function sanitizeModelText(text) {
  return String(text || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
    .replace(/\+?\d[\d\s().-]{8,}\d/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 1200);
}

export async function writeSummary(env, facts) {
  const template = templateSummary(facts);
  try {
    if (!env || !env.AI || typeof env.AI.run !== 'function') {
      return { text: template, source: 'template' };
    }
    const model = env.AI_MODEL && !/placeholder/i.test(env.AI_MODEL) ? env.AI_MODEL : DEFAULT_MODEL;
    const out = await env.AI.run(model, {
      messages: [
        { role: 'system', content: 'You write short, plain-language summaries of a business technology scan. You never invent contact details, prices, or guarantees.' },
        { role: 'user', content: buildPrompt(facts) }
      ],
      max_tokens: 320
    });
    const text = sanitizeModelText(extractText(out));
    if (text.length < 40) return { text: template, source: 'template' };
    return { text: text, source: 'ai' };
  } catch (err) {
    return { text: template, source: 'template' };
  }
}
