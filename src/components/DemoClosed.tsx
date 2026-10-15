import { useEffect } from "react";

// A /demo address opened without a valid private link. The demo never starts;
// the visitor just lands on the normal front page.
export default function DemoClosed() {
  useEffect(() => {
    window.location.replace("/");
  }, []);
  return null;
}
