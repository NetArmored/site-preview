/**
 * Where the "Schedule an appointment" link goes.
 *
 * Today this is a prefilled /contact/ page. source stays scan-consultation
 * for that button. A self-booking calendar can replace buildAppointmentUrl
 * later; keep the same arguments so the scan and both emails pick it up
 * in one place. This URL never sets consent — the contact form leaves
 * that box unticked.
 */

export const INDUSTRY_LABELS = {
  hospitality: 'Hospitality, Restaurants, Bars & Entertainment',
  restaurant: 'Restaurants (Without Gaming)',
  retail: 'Retail & Convenience Stores',
  professional: 'Professional Services',
  logistics: 'Logistics & Transportation',
  home: 'Home Services & Field Operations',
  healthcare: 'Healthcare Administration',
  general: 'General Small Business Operations'
};

export function industryLabel(id) {
  return INDUSTRY_LABELS[id] || INDUSTRY_LABELS.general;
}

function clean(value, max) {
  return String(value == null ? '' : value).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function siteOrigin(env) {
  const raw = env && env.SITE_ORIGIN ? String(env.SITE_ORIGIN).trim() : '';
  if (/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(raw) && !/placeholder/i.test(raw)) return raw.replace(/\/$/, '');
  return 'https://www.netarmored.com';
}

export function buildAppointmentUrl(opts) {
  const o = opts || {};
  const origin = siteOrigin({ SITE_ORIGIN: o.origin });
  const params = new URLSearchParams();
  const source = clean(o.source || 'scan-consultation', 40).replace(/[^a-z0-9-]/gi, '') || 'scan-consultation';
  params.set('source', source);
  const fields = [
    ['name', o.name, 80],
    ['email', o.email, 120],
    ['business', o.business, 120],
    ['phone', o.phone, 40],
    ['industry', o.industry, 80],
    ['summary', o.summary, 280]
  ];
  fields.forEach(function (f) {
    const v = clean(f[1], f[2]);
    if (v) params.set(f[0], v);
  });
  return origin + '/contact/?' + params.toString();
}
