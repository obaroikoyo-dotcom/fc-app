export default function StarRating({ rating, size = 14, interactive = false, onChange }: {
  rating: number;
  size?: number;
  interactive?: boolean;
  onChange?: (r: number) => void;
}) {
  return (
    <div style={{ display: "flex", gap: "2px" }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          onClick={interactive ? () => onChange?.(i) : undefined}
          style={{ fontSize: size, color: i <= Math.round(rating) ? "#ffb800" : "#333", cursor: interactive ? "pointer" : "default", lineHeight: 1 }}
        >★</span>
      ))}
    </div>
  );
}
