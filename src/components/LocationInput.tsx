import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  inputStyle: React.CSSProperties;
}

export default function LocationInput({ value, onChange, placeholder, inputStyle }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ref.current || !(window as any).google) return;
    const autocomplete = new (window as any).google.maps.places.Autocomplete(ref.current, {
      types: ["(cities)"],
      fields: ["formatted_address", "name"],
    });
    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      onChange(place.formatted_address || place.name || "");
    });
  }, []);

  return (
    <input
      ref={ref}
      style={inputStyle}
      placeholder={placeholder || "e.g. London, UK"}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  );
}