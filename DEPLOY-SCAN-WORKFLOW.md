# Deploy the scan follow-up workflow

This is the checklist for turning the AI Opportunity Scan email workflow on. The repository is public. Do not commit API keys, and do not paste them into this file.

Nothing in this change edits DNS, the live Cloudflare project, or the existing contact function. Those steps are for Clint, after the GitHub Pages preview looks right.

## What has to be in place first

1. The existing Cloudflare Pages project that serves `www.netarmored.com`.
2. A Cloudflare account where Workers AI can be enabled (the binding does not use its own API key).
3. A Resend account, with permission to add and verify `netarmored.com`.
4. A Cloudflare Turnstile widget (site key + secret key).
5. Access to DreamHost DNS for `netarmored.com`. Nameservers stay on DreamHost.

The only internal recipient is `hello@netarmored.com`. That address is fixed in `functions/lib/emails.js`. The visitor’s own address is the other recipient. A browser cannot choose either one.

## What this repo adds

| Path | Role |
| --- | --- |
| `functions/api/scan-report.js` | Validates the submission, checks Turnstile, scores the scan, asks Workers AI for a summary, sends both emails through Resend. |
| `functions/api/scan-config.js` | Returns the public Turnstile site key, or `null` while it is still the placeholder. Never returns the secret. |
| `functions/lib/engine.js` | Server-side scoring. Client scores are ignored. |
| `assets/booking.js` | Builds the prefilled `/contact/` link. Replace `NABooking.build` later if a self-booking calendar is added. The contact consent box is never pre-ticked. |
| `_headers` | Live CSP, plus the two Turnstile hosts. |

`/api/contact` is not in this repo. The contact form still posts to `https://www.netarmored.com/api/contact`, and the page still reads only `?source=` into the hidden lead-source field. Do not replace that function when this project is deployed. Copy the existing `functions/api/contact.js` from the current production project into this repo before the production deploy, or confirm the Pages project keeps it.

GitHub Pages (`https://netarmored.github.io/site-preview/`) cannot run Functions. On that host the consent step still validates, then shows the snapshot, and a line says `preview: emails are not sent from this preview`. That line is not shown on `netarmored.com` or on `*.pages.dev`.

## 1. Cloudflare Pages project

Use the existing Pages project for a **preview deployment** of this branch before production.

- Build command: none. Output directory: the site root (`.`), which is `pages_build_output_dir` in `wrangler.toml`.
- The `functions/` directory is the Pages Functions directory. Do not move it into a subfolder.
- Production branch stays `main` until this pull request is approved. Deploy this branch as a Preview.
- Preview environment and Production environment need the same variable names. Use the preview URL as `SITE_ORIGIN` on the preview, and `https://www.netarmored.com` in production.

## 2. Environment variables and secrets

Set these in the Pages dashboard (Settings → Variables and secrets) for **both Preview and Production**. `wrangler.toml` only holds placeholders so this public repo never contains a real key.

| Name | Kind | Value |
| --- | --- | --- |
| `RESEND_API_KEY` | Secret (`wrangler pages secret put RESEND_API_KEY`) | Resend API key. Starts with `re_`. |
| `TURNSTILE_SECRET_KEY` | Secret | Turnstile secret key. |
| `TURNSTILE_SITE_KEY` | Plain text variable | Turnstile site key. It is public (the browser has to see it) but it is still not committed. |
| `AI_MODEL` | Plain text, optional | `@cf/meta/llama-3.2-3b-instruct` |
| `SITE_ORIGIN` | Plain text | Preview: the `https://….pages.dev` URL of that deployment, with no trailing slash. Production: `https://www.netarmored.com`. |

While either secret contains the word `placeholder`, or is missing, the function refuses to send and returns `mailer_not_configured`. The visitor still sees the on-screen snapshot.

Local wrangler: copy `.dev.vars.example` to `.dev.vars` (gitignored) and put the real secrets only in `.dev.vars`.

## 3. Workers AI binding

`wrangler.toml` declares:

```toml
[ai]
binding = "AI"
```

In the Pages project, confirm the binding name is `AI` (Settings → Bindings → Workers AI). The function calls `env.AI.run`. No Workers AI token is stored in the repo.

The model is only given the industry, the answers (including which ones were starred), the follow-up answer, and the server-computed scores. Name, email, phone, and business name are not included. Business name and establishment name typed inside the scan are marked as contact details and are left out of the prompt as well. If the AI call fails, both emails still go out with a fixed summary.

Enable Workers AI for the account if Cloudflare asks for it. That is an account setting, not a DNS change.

## 4. Turnstile widget

In the Cloudflare dashboard: Turnstile → Add widget.

- Widget name: `netarmored-scan` (or similar).
- Hostnames: `netarmored.com`, `www.netarmored.com`, and the Pages preview hostname (`*.pages.dev` for this project, or the specific preview host).
- Widget mode: Managed.
- Copy the site key into `TURNSTILE_SITE_KEY` and the secret into `TURNSTILE_SECRET_KEY`.

Do not use a testing site key in production. The server calls `https://challenges.cloudflare.com/turnstile/v0/siteverify` and will not send mail if that check fails.

There is also a hidden honeypot field, `company_website`. Leave it empty. A filled honeypot gets a normal “ok” response and no email.

## 5. Content Security Policy

The live site sends:

```text
default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'
```

`_headers` keeps that policy and adds only what Turnstile’s documentation requires:

- `script-src` also allows `https://challenges.cloudflare.com`
- `frame-src` allows `https://challenges.cloudflare.com`

`connect-src` stays `'self'`. That is enough for Turnstile pre-clearance and is not required for the normal widget.

If a Transform Rule or an older `_headers` file on the Pages project still sends the previous CSP, update that rule in place or remove it. Two CSP headers are both enforced, and the old one would block the Turnstile script.

## 6. Resend and DreamHost DNS

Verify `netarmored.com` in Resend (Domains → Add domain). Send from `hello@netarmored.com`. Resend must show the domain as verified before production mail will go out.

Do **not** change any of the following. They were read from public DNS on 25 Nov 2026 and must stay as they are:

| Record | Leave this value alone |
| --- | --- |
| Nameservers | `ns1.dreamhost.com`, `ns2.dreamhost.com`, `ns3.dreamhost.com` |
| MX on the root | `0 vade-in1.mail.dreamhost.com` |
| DKIM | `dreamhost._domainkey` TXT (the existing DreamHost key) |
| DMARC | `_dmarc` TXT `v=DMARC1; p=none; rua=mailto:support@netarmored.com; fo=1` |
| Google verification | the existing `google-site-verification` TXT |

Add only new records, in the DreamHost DNS panel (not Cloudflare DNS, because the nameservers are DreamHost). Copy the values from the Resend domain’s Records tab. Do not invent the DKIM key.

**DKIM (new name, do not edit `dreamhost._domainkey`):**

| Type | Host | Value |
| --- | --- | --- |
| TXT | `resend._domainkey` | the `p=…` value shown by Resend |

**Return-path / SPF for sending.** Resend puts this on the `send` host, not on the root, so it does not replace DreamHost mail. Use whichever pair the Records tab shows.

Older shape (MX + TXT), US East region:

| Type | Host | Value | Priority |
| --- | --- | --- | --- |
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com.` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | |

The trailing dot on the MX target matters at DreamHost. Without it, DreamHost may save `feedback-smtp.us-east-1.amazonses.com.netarmored.com` and mail will fail. If Resend shows a different region (`eu-west-1`, `sa-east-1`, `ap-northeast-1`), use that host exactly.

Domains created after August 2026 may show CNAMEs instead of the MX + TXT pair:

| Type | Host | Value |
| --- | --- | --- |
| CNAME | `send` | target copied from Resend |
| CNAME | `rsend` | target copied from Resend |

A CNAME cannot share a name with any other record. Do not also add a TXT or MX on `send` if Resend shows CNAMEs. Do not put either record on the root domain.

**Root SPF — one record only.**

Today the single root SPF TXT is:

```text
v=spf1 mx include:netblocks.dreamhost.com include:relay.mailchannels.net -all
```

Do not add a second TXT on the root that starts with `v=spf1`. Two SPF records on the same name make SPF fail, and DreamHost mail can be rejected.

Resend’s own SPF is the TXT on `send` above, so the root record does not have to change for Resend to authenticate. Leave it as it is unless Resend’s Records tab explicitly tells you to authorize them on the root.

If that happens, edit the existing root TXT. Do not create another one. The merged value is:

```text
v=spf1 mx include:netblocks.dreamhost.com include:relay.mailchannels.net include:amazonses.com -all
```

Before saving that merge, count the SPF lookups (`mx`, `include:netblocks.dreamhost.com`, `include:relay.mailchannels.net`, and `include:amazonses.com`, including nested lookups). The limit is 10. If the merge would pass 10, do not save it. Leave the root SPF unchanged and use the `send` record only.

Do not change the DMARC record. Resend’s DKIM is on `resend._domainkey.netarmored.com` and aligns with the domain on its own. Adding a second DMARC record would be a second policy on `_dmarc`; do not add one.

After the records propagate, click Verify in Resend. Sending stays blocked until the domain is verified.

## 7. Test on a preview deployment before production

1. Deploy this branch as a Pages Preview. Do not promote it to production yet.
2. Set the Preview secrets and set Preview `SITE_ORIGIN` to that preview’s `https://….pages.dev` origin.
3. Open `/scan/` on the preview host (not on github.io).
4. Complete the five questions, star one answer, and confirm the star still toggles.
5. Submit the consent step with a real inbox you can read. Turnstile must be solved.
6. Confirm two emails:
   - Visitor: from `NetArmored <hello@netarmored.com>`, Reply-To `hello@netarmored.com`, HTML and plain text, “Schedule an appointment” button.
   - Lead: to `hello@netarmored.com` only, with the visitor’s details, every answer, starred items, scores, recommendations, the summary, and the same prefilled link. Reply-To on this internal copy is the visitor, so a reply reaches them.
7. Open the appointment link. Name, email, business, phone, industry, and the short summary are filled in. `source` is `scan-consultation`. The consent checkbox is **not** checked.
8. Submit once with the honeypot filled (or with no Turnstile token) and confirm nothing is emailed.
9. Turn the Workers AI binding off, or use a bad model name, and confirm both emails still arrive with the standard summary (`Summary source: template` on the lead copy).
10. Submit the normal contact form once and confirm `/api/contact` still behaves as it does today. On this preview the form action is still the live site, so a contact-form submit emails the live inbox. The scan does not.
11. Only after that, merge, set Production `SITE_ORIGIN` back to `https://www.netarmored.com`, and deploy production.

## 8. Local check

```bash
npm test
npx wrangler pages dev . --port 8788
```

`npm test` mocks Resend, Turnstile, and Workers AI. `wrangler pages dev` boots the real function. With the placeholder secrets it answers `mailer_not_configured` and does not send mail.

GitHub Pages paths stay relative (`../assets/…`). The scan calls `api/scan-report` relative to the folder the page was loaded from, so `/site-preview/` keeps working and does not call the live API.
