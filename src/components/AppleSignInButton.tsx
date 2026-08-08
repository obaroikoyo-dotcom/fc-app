import { useEffect, useRef } from "react";

// Placeholder Services ID - Apple Sign In won't actually work until this is
// swapped for a real one registered in the Apple Developer portal ("Sign In
// with Apple" > Services ID), with APPLE_REDIRECT_URI added as an
// authorized redirect/return URL for that Services ID. See setup notes.
const APPLE_CLIENT_ID = "com.flipcollab.web";
const APPLE_REDIRECT_URI = "https://flipcollab.com";

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: {
          clientId: string;
          scope?: string;
          redirectURI: string;
          usePopup?: boolean;
          nonce?: string;
        }) => void;
        signIn: () => Promise<{
          authorization: { code: string; id_token: string; state?: string };
          user?: { email?: string; name?: { firstName?: string; lastName?: string } };
        }>;
      };
    };
  }
}

interface Props {
  onCredential: (idToken: string, nonce: string) => void;
  children: React.ReactNode;
}

// Mirrors GoogleSignInButton's contract (onCredential gets the raw ID token
// + the raw nonce, for supabase.auth.signInWithIdToken to hash and verify).
// Unlike Google, Apple's JS SDK doesn't need a hidden real-button overlay -
// signIn() can be called directly from any click handler. Apple hashes the
// nonce we give init() itself (SHA-256) before it ends up in the id_token's
// nonce claim, the same way Supabase re-hashes the raw nonce we pass it to
// compare - so both sides need the same raw string, not a pre-hashed one.
export default function AppleSignInButton({ onCredential, children }: Props) {
  const nonceRef = useRef("");
  const readyRef = useRef(false);
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  const initClient = () => {
    if (!window.AppleID?.auth) return false;
    nonceRef.current = crypto.randomUUID() + crypto.randomUUID();
    window.AppleID.auth.init({
      clientId: APPLE_CLIENT_ID,
      scope: "name email",
      redirectURI: APPLE_REDIRECT_URI,
      usePopup: true,
      nonce: nonceRef.current,
    });
    readyRef.current = true;
    return true;
  };

  useEffect(() => {
    let cancelled = false;
    const tryInit = () => {
      if (cancelled) return;
      if (!initClient()) setTimeout(tryInit, 100);
    };
    tryInit();
    return () => { cancelled = true; };
  }, []);

  const handleClick = async () => {
    if (!readyRef.current || !window.AppleID?.auth) return;
    try {
      const response = await window.AppleID.auth.signIn();
      onCredentialRef.current(response.authorization.id_token, nonceRef.current);
    } catch {
      // User dismissed the popup or it failed - matches Google's silent
      // no-op when someone backs out of the picker.
    } finally {
      // The nonce Apple already used is spent - get a fresh one ready for
      // any retry without waiting on a remount.
      initClient();
    }
  };

  return (
    <div onClick={handleClick} style={{ width: "100%", cursor: "pointer" }}>
      {children}
    </div>
  );
}
