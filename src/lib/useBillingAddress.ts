import { useRef, useState } from "react";
import { LOCATIONIQ_API_KEY } from "./locationiq";
import { COUNTRIES } from "./countries";
import { REGIONS_BY_COUNTRY } from "./regions";

export interface NominatimResult {
  display_name: string;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
}

// Shared by every billing-address form in the app (campaign payments,
// enterprise subscriptions, anywhere else that charges a card) so the
// search-to-autofill behavior and the accuracy check below stay identical
// everywhere instead of drifting between copies.
export function useBillingAddress(defaultCountry = "GB") {
  const [line1, setLine1State] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountryState] = useState(defaultCountry);
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const setCountry = (value: string) => { setCountryState(value); setState(""); };

  const setLine1 = (value: string) => {
    setLine1State(value);
    setVerifyError("");
    setShowSuggestions(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    // No key set yet -> no suggestions, but every field can still be typed
    // by hand (see LOCATIONIQ_API_KEY's comment).
    if (value.trim().length < 3 || !LOCATIONIQ_API_KEY) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      setSearching(true);
      try {
        const res = await fetch(
          `https://api.locationiq.com/v1/search?key=${LOCATIONIQ_API_KEY}&format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(value)}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        // On an invalid/rate-limited key LocationIQ returns an error object,
        // not an array - fail quietly rather than crash the .map() below.
        setSuggestions(Array.isArray(data) ? data : []);
      } catch {
        // Ignore aborted/failed lookups - user can still type the address manually.
      } finally {
        setSearching(false);
      }
    }, 500);
  };

  const selectSuggestion = (result: NominatimResult) => {
    const a = result.address || {};
    const l1 = [a.house_number, a.road].filter(Boolean).join(" ");
    setLine1State(l1 || result.display_name.split(",")[0]);
    setCity(a.city || a.town || a.village || "");
    const rawState = a.state || a.county || "";
    let countryCode = country;
    if (a.country_code) {
      const upper = a.country_code.toUpperCase();
      if (COUNTRIES.some(c => c.code === upper)) { countryCode = upper; setCountryState(upper); }
    }
    // Nominatim returns the full state/county name - match it to our
    // dropdown's code (e.g. "California" -> "CA") when that country has
    // one, so the picked address shows as actually selected.
    const regionMatch = REGIONS_BY_COUNTRY[countryCode]?.find(r => r.name.toLowerCase() === rawState.toLowerCase());
    setState(regionMatch?.code || rawState);
    setPostalCode(a.postcode || "");
    setSuggestions([]);
    setShowSuggestions(false);
    setVerifyError("");
  };

  const isFilled = () => !!(line1.trim() && city.trim() && postalCode.trim() && country.trim());

  // Confirms the typed combination actually resolves to a real place, and
  // that the resolved country matches what's selected - catches someone
  // picking e.g. "Barbados" as the country while the city is really
  // "Southwark", without requiring them to have used a suggestion. Fails
  // open (never blocks the payment) when there's no key or the lookup
  // itself errors - this is a sanity check, not the source of truth for
  // whether a card can be charged.
  const verify = async (): Promise<boolean> => {
    if (!LOCATIONIQ_API_KEY) return true;
    setVerifying(true);
    setVerifyError("");
    try {
      const query = [line1, city, state, postalCode, country].filter(Boolean).join(", ");
      const res = await fetch(
        `https://api.locationiq.com/v1/search?key=${LOCATIONIQ_API_KEY}&format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(query)}`
      );
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        setVerifyError("We couldn't find that address - check the details, or pick a suggestion from the search above.");
        return false;
      }
      const foundCountryCode: string | undefined = data[0]?.address?.country_code?.toUpperCase();
      if (foundCountryCode && foundCountryCode !== country.toUpperCase()) {
        setVerifyError(`That address looks like it's in ${data[0]?.address?.country || "a different country"}, not the country selected below.`);
        return false;
      }
      return true;
    } catch {
      return true;
    } finally {
      setVerifying(false);
    }
  };

  return {
    line1, setLine1, line2, setLine2, city, setCity, state, setState,
    postalCode, setPostalCode, country, setCountry,
    regionsForCountry: REGIONS_BY_COUNTRY[country] || null,
    suggestions, searching, showSuggestions, setShowSuggestions, selectSuggestion,
    isFilled, verify, verifying, verifyError,
    asBillingDetails: () => ({ line1, line2, city, state, postal_code: postalCode, country }),
  };
}

export type BillingAddress = ReturnType<typeof useBillingAddress>;
