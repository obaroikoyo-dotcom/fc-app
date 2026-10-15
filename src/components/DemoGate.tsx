import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";

// Holds the app back for a moment at /demo so the sign-in client can finish
// loading its saved session first. If the app were already listening when
// that finishes, the "signed in" event would arrive while the client is still
// mid-start, and the app's own first data request inside that event would
// wait on the client, which waits on the event: nothing ever moves.
export default function DemoGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    supabase.auth.getSession().catch(() => undefined).finally(() => {
      if (live) setReady(true);
    });
    return () => { live = false; };
  }, []);

  if (!ready) return <div style={{ minHeight: "100vh", background: "#0a0a0a" }} />;
  return <>{children}</>;
}
