/** Both messages are built here. The browser cannot supply the subject, HTML, or recipients. */

import { industryLabel } from './appointment.js';

const FROM = 'NetArmored <hello@netarmored.com>';
const LEAD_TO = 'hello@netarmored.com';
const REPLY_TO = 'hello@netarmored.com';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function paragraphs(text) {
  return String(text || '').split(/\n{2,}/).map(function (p) {
    return '<p style="margin:0 0 14px;font:16px/1.55 Arial,Helvetica,sans-serif;color:#1B2738;">' + esc(p).replace(/\n/g, '<br>') + '</p>';
  }).join('');
}

function button(url, label) {
  return '<a href="' + esc(url) + '" style="display:inline-block;background:#377DFF;color:#ffffff;text-decoration:none;font:700 16px/1 Arial,Helvetica,sans-serif;padding:14px 22px;border-radius:10px;">' + esc(label) + '</a>';
}

function shell(title, inner) {
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + '</title></head>'
    + '<body style="margin:0;padding:0;background:#E7EEF6;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E7EEF6;padding:24px 12px;"><tr><td align="center">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #D5E0EC;">'
    + '<tr><td style="background:#0B1424;padding:22px 28px;">'
    + '<p style="margin:0;font:700 13px/1 Arial,Helvetica,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#2DD4BF;">NetArmored</p>'
    + '<p style="margin:8px 0 0;font:700 22px/1.25 Arial,Helvetica,sans-serif;color:#F8FAFC;">' + esc(title) + '</p>'
    + '</td></tr>'
    + '<tr><td style="padding:28px;">' + inner + '</td></tr>'
    + '<tr><td style="padding:0 28px 24px;">'
    + '<p style="margin:0;font:13px/1.5 Arial,Helvetica,sans-serif;color:#5C6B80;">NetArmored Consulting LLC · Las Vegas, Nevada<br>'
    + '<a href="mailto:hello@netarmored.com" style="color:#377DFF;">hello@netarmored.com</a> · (702) 714-0714</p>'
    + '</td></tr></table></td></tr></table></body></html>';
}

function oppBlocks(report) {
  const tiers = ['quick', 'integ', 'long'];
  let html = '';
  let text = '';
  tiers.forEach(function (tier) {
    const list = report.tiers[tier] || [];
    if (!list.length) return;
    html += '<p style="margin:22px 0 8px;font:700 12px/1 Arial,Helvetica,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#0F766E;">' + esc(list[0].tierLabel) + '</p>';
    text += '\n' + list[0].tierLabel + '\n';
    list.forEach(function (op) {
      html += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 10px;background:#F4F7FB;border-radius:12px;"><tr><td style="padding:14px 16px;">'
        + '<p style="margin:0 0 6px;font:700 16px/1.3 Arial,Helvetica,sans-serif;color:#0B1424;">' + esc(op.title) + '</p>'
        + '<p style="margin:0 0 8px;font:14px/1.5 Arial,Helvetica,sans-serif;color:#334155;">' + esc(op.summary) + '</p>'
        + '<p style="margin:0;font:12px/1.4 Arial,Helvetica,sans-serif;color:#5C6B80;">Impact ' + esc(op.impact) + '/5 · Feasibility ' + esc(op.feasibility) + '/5 · Match ' + esc(op.match) + '</p>'
        + '</td></tr></table>';
      text += op.title + '\n' + op.summary + '\nImpact ' + op.impact + '/5 · Feasibility ' + op.feasibility + '/5 · Match ' + op.match + '\n\n';
    });
  });
  return { html, text };
}

function answerLines(report) {
  let html = '';
  let text = '';
  (report.questions || []).forEach(function (q) {
    const picks = (q.picks || []).map(function (p) { return p.starred ? '★ ' + p.label : p.label; });
    const shown = picks.length ? picks.join(', ') : 'No selection';
    html += '<p style="margin:0 0 10px;font:14px/1.45 Arial,Helvetica,sans-serif;color:#1B2738;"><b>' + esc(q.title) + '</b><br>' + esc(shown);
    text += q.title + '\n' + shown + '\n';
    if (q.text) {
      html += '<br><span style="color:#334155;">' + esc(q.text) + '</span>';
      text += q.text + '\n';
    }
    (q.extras || []).forEach(function (x) {
      html += '<br><span style="color:#334155;">' + esc(x.label) + ': ' + esc(x.value) + '</span>';
      text += x.label + ': ' + x.value + '\n';
    });
    html += '</p>';
    text += '\n';
  });
  if (report.followUp) {
    const ans = report.followUp.answerLabel || 'Skipped';
    html += '<p style="margin:0 0 10px;font:14px/1.45 Arial,Helvetica,sans-serif;color:#1B2738;"><b>' + esc(report.followUp.title) + '</b><br>' + esc(ans) + '</p>';
    text += report.followUp.title + '\n' + ans + '\n\n';
  }
  return { html, text };
}

export function leadRecipient() { return LEAD_TO; }
export function fromAddress() { return FROM; }
export function replyToAddress() { return REPLY_TO; }

export function buildMessages(input) {
  const contact = input.contact;
  const report = input.report;
  const summary = input.summary;
  const appointmentUrl = input.appointmentUrl;
  const sentAt = input.sentAt || new Date().toISOString();
  const business = contact.business || businessFromScan(report) || '';
  const opps = oppBlocks(report);
  const answers = answerLines(report);
  const stars = (report.starred || []).map(function (s) { return s.label + ' (' + s.question + ')'; });
  const starText = stars.length ? stars.join('; ') : 'None starred';

  const visitorSubject = 'Your NetArmored AI Opportunity Snapshot';
  const visitorHtml = shell('Your AI Opportunity Snapshot',
    '<p style="margin:0 0 14px;font:16px/1.55 Arial,Helvetica,sans-serif;color:#1B2738;">Hello ' + esc(firstName(contact.name)) + ',</p>'
    + '<p style="margin:0 0 14px;font:16px/1.55 Arial,Helvetica,sans-serif;color:#1B2738;">Here is the snapshot from your AI Opportunity Scan for ' + esc(report.industryName) + '. It is a practical starting point, not a quote or a guaranteed result.</p>'
    + '<p style="margin:18px 0 8px;font:700 13px/1 Arial,Helvetica,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#377DFF;">What the scan found</p>'
    + paragraphs(summary.text)
    + '<p style="margin:6px 0 18px;font:16px/1.55 Arial,Helvetica,sans-serif;color:#1B2738;"><b>What to fix first:</b> ' + esc(report.fixFirst ? report.fixFirst.title : 'A short conversation to choose the first workflow') + '.</p>'
    + '<p style="margin:0 0 22px;">' + button(appointmentUrl, 'Schedule an appointment') + '</p>'
    + opps.html
    + '<p style="margin:18px 0 0;font:13px/1.5 Arial,Helvetica,sans-serif;color:#5C6B80;">You asked us to email this report. We also sent a copy to NetArmored so we can follow up. When a writing assistant is available, Cloudflare Workers AI drafts the summary from your answers, scores, and industry only. It does not receive your name, email, phone, or business name.</p>'
  );
  const visitorText = [
    'Hello ' + firstName(contact.name) + ',',
    '',
    'Here is the snapshot from your AI Opportunity Scan for ' + report.industryName + '.',
    '',
    'What the scan found',
    summary.text,
    '',
    'What to fix first: ' + (report.fixFirst ? report.fixFirst.title : 'A short conversation to choose the first workflow') + '.',
    '',
    'Schedule an appointment:',
    appointmentUrl,
    '',
    opps.text.trim(),
    '',
    'You asked us to email this report. We also sent a copy to NetArmored.',
    'When a writing assistant is available, Cloudflare Workers AI drafts the summary from your answers, scores, and industry only. It does not receive your name, email, phone, or business name.',
    '',
    'NetArmored Consulting LLC',
    'hello@netarmored.com',
    '(702) 714-0714'
  ].join('\n');

  const leadSubject = clip('AI Opportunity Scan: ' + (business || contact.name) + ' (' + report.industryName + ')', 140);
  const leadHtml = shell('Scan lead',
    '<p style="margin:0 0 12px;font:14px/1.5 Arial,Helvetica,sans-serif;color:#5C6B80;">' + esc(sentAt) + ' · Summary source: ' + esc(summary.source) + '</p>'
    + row('Name', contact.name) + row('Email', contact.email) + row('Phone', contact.phone || '—') + row('Business', business || '—')
    + row('Industry', report.industryName + ' (' + industryLabel(report.industry) + ')')
    + row('Track', report.trackName)
    + row('Readiness', report.readinessLabel)
    + row('Starred priorities', starText)
    + '<p style="margin:18px 0 8px;font:700 13px/1 Arial,Helvetica,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#377DFF;">Summary</p>'
    + paragraphs(summary.text)
    + '<p style="margin:8px 0 16px;">' + button(appointmentUrl, 'Open the prefilled consultation form') + '</p>'
    + '<p style="margin:0 0 16px;font:13px/1.45 Arial,Helvetica,sans-serif;color:#5C6B80;word-break:break-all;">' + esc(appointmentUrl) + '</p>'
    + '<p style="margin:8px 0;font:700 13px/1 Arial,Helvetica,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#377DFF;">Scores and recommendations</p>'
    + opps.html
    + '<p style="margin:18px 0 8px;font:700 13px/1 Arial,Helvetica,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#377DFF;">Every answer</p>'
    + answers.html
    + '<p style="margin:12px 0 0;font:13px/1.5 Arial,Helvetica,sans-serif;color:#5C6B80;">Internal copy only. The visitor report was sent to ' + esc(contact.email) + '. Do not forward this message to anyone else.</p>'
  );
  const leadText = [
    'AI Opportunity Scan lead',
    sentAt + ' · Summary source: ' + summary.source,
    '',
    'Name: ' + contact.name,
    'Email: ' + contact.email,
    'Phone: ' + (contact.phone || '—'),
    'Business: ' + (business || '—'),
    'Industry: ' + report.industryName,
    'Track: ' + report.trackName,
    'Readiness: ' + report.readinessLabel,
    'Starred priorities: ' + starText,
    '',
    'Summary',
    summary.text,
    '',
    'Prefilled consultation form:',
    appointmentUrl,
    '',
    'Scores and recommendations',
    opps.text.trim(),
    '',
    'Every answer',
    answers.text.trim(),
    '',
    'Internal copy only. Visitor report sent to ' + contact.email + '.'
  ].join('\n');

  return {
    from: FROM,
    lead: {
      from: FROM,
      to: [LEAD_TO],
      reply_to: contact.email,
      subject: leadSubject,
      html: leadHtml,
      text: leadText
    },
    visitor: {
      from: FROM,
      to: [contact.email],
      reply_to: REPLY_TO,
      subject: visitorSubject,
      html: visitorHtml,
      text: visitorText
    }
  };
}

function businessFromScan(report) {
  let found = '';
  (report.questions || []).forEach(function (q) {
    (q.extras || []).forEach(function (x) {
      if (!found && x.pii && x.value) found = x.value;
    });
  });
  return found;
}

function firstName(name) {
  const part = String(name || '').trim().split(/\s+/)[0];
  return part || 'there';
}

function row(label, value) {
  return '<p style="margin:0 0 6px;font:14px/1.45 Arial,Helvetica,sans-serif;color:#1B2738;"><b>' + esc(label) + ':</b> ' + esc(value) + '</p>';
}

function clip(s, max) {
  const t = String(s || '');
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}
