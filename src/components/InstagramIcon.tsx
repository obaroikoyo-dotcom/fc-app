import { useId } from "react";

export default function InstagramIcon({ size = 16 }: { size?: number }) {
  const gradientId = `ig-gradient-${useId()}`;
  return (
    <svg className="instagram-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFDD55" />
          <stop offset="0.5" stopColor="#FF543E" />
          <stop offset="1" stopColor="#C837AB" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" stroke={`url(#${gradientId})`} strokeWidth="2" />
      <circle cx="12" cy="12" r="4.5" stroke={`url(#${gradientId})`} strokeWidth="2" />
      <circle cx="17.2" cy="6.8" r="1.3" fill={`url(#${gradientId})`} />
    </svg>
  );
}
