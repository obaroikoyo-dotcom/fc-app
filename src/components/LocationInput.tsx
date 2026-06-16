import { useEffect, useRef } from "react";

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  inputStyle: React.CSSProperties;
}

export default function LocationInput({ onChange, inputStyle }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !(window as any).google) return;

    const { PlaceAutocompleteElement } = (window as any).google.maps.places;
    if (!PlaceAutocompleteElement) return;

    const autocomplete = new PlaceAutocompleteElement({
      types: ["(cities)"],
    });

    Object.assign(autocomplete.style, {
      ...inputStyle,
      width: "100%",
      display: "block",
    });

    autocomplete.addEventListener("gmp-placeselect", (e: any) => {
      const place = e.placePrediction.toPlace();
      onChange(place.displayName || "");
    });

    containerRef.current.appendChild(autocomplete);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, []);

  return <div ref={containerRef} style={{ width: "100%" }} />;
}