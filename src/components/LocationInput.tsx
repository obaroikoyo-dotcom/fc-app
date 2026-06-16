import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  inputStyle: React.CSSProperties;
}

export default function LocationInput({ value, onChange, placeholder, inputStyle }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!containerRef.current || !(window as any).google) return;

    const { PlaceAutocompleteElement } = (window as any).google.maps.places;
    if (!PlaceAutocompleteElement) return;

    const autocomplete = new PlaceAutocompleteElement({
      types: ["(cities)"],
    });

    autocomplete.style.width = "100%";

    autocomplete.addEventListener("gmp-placeselect", (e: any) => {
      const place = e.placePrediction.toPlace();
      onChange(place.displayName || "");
    });

    containerRef.current.appendChild(autocomplete);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, []);

  return (
    <div ref={containerRef} style={{ width: "100%" }} />
  );
}