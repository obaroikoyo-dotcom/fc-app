import { useEffect, useRef } from "react";

// The Google OAuth client is the same one already configured for the
// redirect flow (Supabase's Google provider) - this ID-token flow just
// reuses it, no separate registration needed.
const GOOGLE_CLIENT_ID = "527479654267-lfobgefoppbrnc8nl2r9p5po28ftvbue.apps.googleusercontent.com";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            nonce?: string;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

// Supabase's signInWithIdToken() re-hashes the nonce you give it (SHA-256)
// and compares the result, as a hex string, against the ID token's nonce
// claim - so what's sent to Google here must also be hex, not base64url.
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

interface Props {
  onCredential: (idToken: string, nonce: string) => void;
  children: React.ReactNode;
}

// Wraps arbitrary custom-styled button content (`children`) and, on click,
// triggers Google's actual Identity Services sign-in flow (a popup on the
// user's own domain - no redirect through Supabase's domain, which is what
// shows "flipcollab.com" instead of the raw supabase.co project ref in
// Google's UI). This works by rendering Google's real button invisibly on
// top of the custom one, so clicks land on Google's own element (required
// for their popup to open reliably) while only the custom styling is seen.
export default function GoogleSignInButton({ onCredential, children }: Props) {
  const hiddenBtnRef = useRef<HTMLDivElement>(null);
  const nonceRef = useRef("");
  // Callers (e.g. the onboarding wizards) typically pass a plain inline
  // function that closes over form state, so it gets a new reference on
  // every keystroke. Reading it through a ref updated every render means
  // the setup effect below can run exactly once per mount - re-running it
  // on every re-render was tearing down and rebuilding Google's real
  // button mid-interaction, so a tap could land while it was rebuilding
  // and silently do nothing.
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      const raw = crypto.randomUUID() + crypto.randomUUID();
      nonceRef.current = raw;
      const hashedNonce = await sha256Hex(raw);
      if (cancelled) return;

      const tryInit = () => {
        if (cancelled) return;
        if (!window.google?.accounts?.id) {
          setTimeout(tryInit, 100);
          return;
        }
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => onCredentialRef.current(response.credential, nonceRef.current),
          nonce: hashedNonce,
          use_fedcm_for_prompt: true,
        });
        if (hiddenBtnRef.current) {
          window.google.accounts.id.renderButton(hiddenBtnRef.current, {
            type: "standard",
            theme: "outline",
            size: "large",
            width: 300,
          });
        }
      };
      tryInit();
    };

    setup();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {children}
      <div
        ref={hiddenBtnRef}
        style={{ position: "absolute", inset: 0, zIndex: 1, opacity: 0, overflow: "hidden", cursor: "pointer" }}
      />
    </div>
  );
}
