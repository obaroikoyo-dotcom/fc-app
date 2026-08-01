interface Props {
  size?: number;
  title?: string;
}

// Consistent "verified" tick used next to a brand's name everywhere it
// appears - profile, cards, chat header, dashboard.
export default function VerifiedBadge({ size = 14, title = "Verified business email" }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <title>{title}</title>
      <path
        d="M12 2L14.4 4.1L17.5 3.6L18.4 6.6L21.4 7.5L20.9 10.6L23 13L20.9 15.4L21.4 18.5L18.4 19.4L17.5 22.4L14.4 21.9L12 24L9.6 21.9L6.5 22.4L5.6 19.4L2.6 18.5L3.1 15.4L1 13L3.1 10.6L2.6 7.5L5.6 6.6L6.5 3.6L9.6 4.1L12 2Z"
        fill="#1d9bf0"
      />
      <path d="M8.5 12.5L11 15L16 9.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
