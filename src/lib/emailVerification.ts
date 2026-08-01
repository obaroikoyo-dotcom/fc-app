// Cheap first-pass signal for whether a brand's signup email is a real
// company domain rather than a generic personal one. Easy to fake with any
// owned domain, but filters out the laziest fake signups - a stronger check
// (e.g. Stripe business verification) can raise the bar later without
// needing a new column, since it'd just overwrite the same `verified` flag.
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "hotmail.com", "outlook.com",
  "live.com", "msn.com", "icloud.com", "me.com", "mac.com", "aol.com", "protonmail.com",
  "proton.me", "mail.com", "gmx.com", "yandex.com", "zoho.com", "qq.com", "163.com", "hey.com",
]);

export function isBusinessEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return false;
  return !FREE_EMAIL_DOMAINS.has(domain);
}
