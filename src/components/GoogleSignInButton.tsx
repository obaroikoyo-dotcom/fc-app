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

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hashBuffer);
  let binary = "";
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      const raw = crypto.randomUUID() + crypto.randomUUID();
      nonceRef.current = raw;
      const hashedNonce = await sha256Base64Url(raw);
      if (cancelled) return;

      const tryInit = () => {
        if (cancelled) return;
        if (!window.google?.accounts?.id) {
          setTimeout(tryInit, 100);
          return;
        }
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => onCredential(response.credential, nonceRef.current),
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
  }, [onCredential]);

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
