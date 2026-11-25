/** Public scan config. The Turnstile site key is not a secret. The secret key is never returned. */

export function publicScanConfig(env) {
  const key = String((env && env.TURNSTILE_SITE_KEY) || '').trim();
  if (!key || /placeholder/i.test(key)) return { turnstileSiteKey: null };
  return { turnstileSiteKey: key };
}
