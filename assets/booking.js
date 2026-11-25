/* Appointment handoff.
   Today "Schedule an appointment" opens the contact form with details filled in.
   A self-booking calendar can replace NABooking.build later. Keep the same
   arguments: name, email, business, phone, industry, summary, source.
   Never set consent — the contact form leaves that box unticked. */
(function (w) {
  'use strict';
  var LABELS = {
    hospitality: 'Hospitality, Restaurants, Bars & Entertainment',
    restaurant: 'Restaurants (Without Gaming)',
    retail: 'Retail & Convenience Stores',
    professional: 'Professional Services',
    logistics: 'Logistics & Transportation',
    home: 'Home Services & Field Operations',
    healthcare: 'Healthcare Administration',
    general: 'General Small Business Operations'
  };
  function clean(s, max) {
    return String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function build(opts) {
    opts = opts || {};
    var p = new URLSearchParams();
    var source = clean(opts.source || 'scan-consultation', 40).replace(/[^a-z0-9-]/gi, '') || 'scan-consultation';
    p.set('source', source);
    [['name', opts.name, 80], ['email', opts.email, 120], ['business', opts.business, 120], ['phone', opts.phone, 40], ['industry', opts.industry, 80], ['summary', opts.summary, 280]].forEach(function (f) {
      var v = clean(f[1], f[2]);
      if (v) p.set(f[0], v);
    });
    return '/contact/?' + p.toString();
  }
  w.NABooking = {
    build: build,
    label: function (id) { return LABELS[id] || LABELS.general; },
    labels: LABELS
  };
})(window);
