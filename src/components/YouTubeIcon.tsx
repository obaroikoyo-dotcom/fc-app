export default function YouTubeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg className="youtube-icon" width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="10" width="40" height="28" rx="8" fill="#FF0000" />
      <path d="M20 17.5L31 24L20 30.5V17.5Z" fill="#fff" />
    </svg>
  );
}
