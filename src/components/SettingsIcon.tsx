// One shared line-icon set for every settings row across Creator and Brand
// profiles, so a row's purpose reads at a glance instead of relying on text
// alone - same idea as the icon+label+chevron pattern of Meta's Accounts
// Centre and TikTok's Settings screen, adapted to this app's stroke-icon
// style (24x24 viewBox, currentColor, consistent stroke weight).
const paths: Record<string, React.ReactNode> = {
  "edit-profile": <><circle cx="12" cy="8" r="3.4" /><path d="M5 20c1.2-4 4-6 7-6s5.8 2 7 6" /></>,
  "niche": <path d="M11 4H6a2 2 0 0 0-2 2v5l9.5 9.5a1.5 1.5 0 0 0 2 0l5-5a1.5 1.5 0 0 0 0-2L11 4Z M8.2 8.2h.01" strokeLinejoin="round" />,
  "social": <><circle cx="6.5" cy="12" r="2.5" /><circle cx="17.5" cy="6" r="2.5" /><circle cx="17.5" cy="18" r="2.5" /><path d="M8.7 10.8 15.3 7.2M8.7 13.2l6.6 3.6" /></>,
  "payouts": <><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18" /><circle cx="16.5" cy="14.2" r="1.1" fill="currentColor" stroke="none" /></>,
  "notifications": <><path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z" strokeLinejoin="round" /><path d="M10 19a2 2 0 0 0 4 0" /></>,
  "visibility": <><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" strokeLinejoin="round" /><circle cx="12" cy="12" r="2.6" /></>,
  "share": <><circle cx="18" cy="5" r="2.2" /><circle cx="6" cy="12" r="2.2" /><circle cx="18" cy="19" r="2.2" /><path d="M8 10.8 16 6.2M8 13.2l8 4.6" /></>,
  "portfolio": <><rect x="3" y="4.5" width="18" height="15" rx="2.2" /><path d="M3 9h18" /><circle cx="6.3" cy="6.7" r="0.5" fill="currentColor" stroke="none" /></>,
  "favourites": <path d="M12 20s-7.5-4.6-9.8-9.1C.7 7.4 2.4 4 6 4c2.1 0 3.6 1.2 4.4 2.4C11.2 5.2 12.7 4 14.8 4c3.6 0 5.3 3.4 3.8 6.9C19.5 15.4 12 20 12 20Z" strokeLinejoin="round" />,
  "applications": <><rect x="5" y="4" width="14" height="17" rx="2.2" /><path d="M9 3.5h6v2.2H9zM8.5 11.5l2 2 4-4.4M8.5 16h7" /></>,
  "reported-blocked": <><path d="M12 3.5 19.5 6.5V12c0 4.8-3 7.6-7.5 9-4.5-1.4-7.5-4.2-7.5-9V6.5L12 3.5Z" strokeLinejoin="round" /><path d="M9.3 9.3l5.4 5.4" /></>,
  "audience-rates": <><path d="M6 20V11M12 20V6M18 20v-7" /></>,
  "past-collabs": <><rect x="3" y="8" width="18" height="12" rx="2.2" /><path d="M8.5 8V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2" /></>,
  "admin": <><path d="M12 3.5 19.5 6.5V12c0 4.8-3 7.6-7.5 9-4.5-1.4-7.5-4.2-7.5-9V6.5L12 3.5Z" strokeLinejoin="round" /><path d="m9.3 12.2 2 2 3.6-4" /></>,
  "about": <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><circle cx="12" cy="7.8" r="0.15" fill="currentColor" stroke="currentColor" strokeWidth="2.4" /></>,
  "help": <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.3a2.5 2.5 0 1 1 3.6 2.3c-.9.5-1.1 1-1.1 1.9" /><circle cx="12" cy="16.6" r="0.15" fill="currentColor" stroke="currentColor" strokeWidth="2.4" /></>,
  "privacy": <><rect x="5" y="11" width="14" height="9.5" rx="2.2" /><path d="M8 11V7.5a4 4 0 0 1 8 0V11" /></>,
  "terms": <><path d="M7 3.5h7.5L19 8v12.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" strokeLinejoin="round" /><path d="M14 3.5V8h5M9 12.5h6M9 16h6" /></>,
  "verified": <><path d="M12 3.5 19.5 6.5V12c0 4.8-3 7.6-7.5 9-4.5-1.4-7.5-4.2-7.5-9V6.5L12 3.5Z" strokeLinejoin="round" /><path d="m9 12.2 2 2 4-4.4" /></>,
  "industry": <><path d="M4 20V9l6-4v15M20 20V13l-6-3v10" /><path d="M4 20h16" /></>,
  "campaign-prefs": <><path d="M4 6h9M17 6h3M4 12h3M9 12h11M4 18h13M19 18h1" /><circle cx="13" cy="6" r="1.8" fill="currentColor" stroke="#0a0a0a" /><circle cx="6" cy="12" r="1.8" fill="currentColor" stroke="#0a0a0a" /><circle cx="16" cy="18" r="1.8" fill="currentColor" stroke="#0a0a0a" /></>,
};

export function ChevronIcon({ size = 15, color = "#666" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M9 5.5 15.5 12 9 18.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SettingsIcon({ name, size = 17, color = "#999" }: { name: keyof typeof paths | string; size?: number; color?: string }) {
  const glyph = paths[name];
  if (!glyph) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" style={{ flexShrink: 0 }}>
      {glyph}
    </svg>
  );
}
