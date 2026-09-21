import { useState, useRef, useEffect } from "react";
import { LOCATIONIQ_API_KEY } from "../lib/locationiq";

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  inputStyle: React.CSSProperties;
}

interface Suggestion {
  display_name: string;
  place_id: string;
}

export default function LocationInput({ value, onChange, placeholder, inputStyle }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = async (query: string) => {
    // No key set yet -> no suggestions, but the field still works as a plain
    // text input (see LOCATIONIQ_API_KEY's comment).
    if (query.length < 2 || !LOCATIONIQ_API_KEY) { setSuggestions([]); return; }
    try {
      const res = await fetch(
        `https://api.locationiq.com/v1/autocomplete?key=${LOCATIONIQ_API_KEY}&q=${encodeURIComponent(query)}&format=json&limit=5`,
        { headers: { "Accept-Language": "en" } }
      );
      const data = await res.json();
      // On an invalid/rate-limited key LocationIQ returns an error object,
      // not an array - fail quietly rather than crash the .map() below.
      setSuggestions(Array.isArray(data) ? data : []);
      setShowDropdown(true);
    } catch {
      setSuggestions([]);
    }
  };

  const handleChange = (val: string) => {
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 350);
  };

  const handleSelect = (suggestion: Suggestion) => {
    const parts = suggestion.display_name.split(",");
    const clean = parts.slice(0, 2).join(",").trim();
    onChange(clean);
    setSuggestions([]);
    setShowDropdown(false);
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <input
        style={inputStyle}
        placeholder={placeholder || "e.g. London, UK"}
        value={value}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
      />
      {showDropdown && suggestions.length > 0 && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          background: "#111",
          border: "1px solid #222",
          borderRadius: "8px",
          marginTop: "4px",
          zIndex: 9999,
          overflow: "hidden",
        }}>
          {suggestions.map((s, i) => {
            const parts = s.display_name.split(",");
            const main = parts[0].trim();
            const sub = parts.slice(1, 3).join(",").trim();
            return (
              <div
                key={s.place_id}
                onClick={() => handleSelect(s)}
                style={{
                  padding: "10px 14px",
                  cursor: "pointer",
                  borderBottom: i < suggestions.length - 1 ? "1px solid #1a1a1a" : "none",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#1a1a1a")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <p style={{ color: "#fff", fontSize: "13px", fontWeight: 500, margin: 0 }}>{main}</p>
                {sub && <p style={{ color: "#999", fontSize: "11px", margin: "2px 0 0 0" }}>{sub}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}