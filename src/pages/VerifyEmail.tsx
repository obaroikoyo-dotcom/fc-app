import { useState, useRef, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { type Page } from "../App";

interface Props {
  navigate: (p: Page) => void;
  email: string;
}

export default function VerifyEmail({ navigate, email }: Props) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const handleChange = (idx: number, value: string) => {
    if (!/^[0-9]?$/.test(value)) return;
    const next = [...code];
    next[idx] = value;
    setCode(next);
    setError("");
    if (value && idx < 5) inputsRef.current[idx + 1]?.focus();
    if (next.every(c => c !== "") && idx === 5) verify(next.join(""));
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = pasted.split("").concat(Array(6).fill("")).slice(0, 6);
    setCode(next);
    const lastIdx = Math.min(pasted.length, 6) - 1;
    inputsRef.current[lastIdx]?.focus();
    if (pasted.length === 6) verify(pasted);
  };

  const verify = async (otp: string) => {
    setLoading(true);
    setError("");

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "signup",
    });

    if (verifyError) {
      setError("Invalid or expired code. Try again.");
      setLoading(false);
      setCode(["", "", "", "", "", ""]);
      inputsRef.current[0]?.focus();
      return;
    }

    if (data.session) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.session.user.id)
        .single();

      setLoading(false);
      if (profile?.role === "brand") navigate("brand-dashboard");
      else navigate("explore");
    } else {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError("");
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    setResending(false);
    if (resendError) {
      setError("Couldn't resend code. Try again shortly.");
    } else {
      setResent(true);
      setTimeout(() => setResent(false), 4000);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes logoPop {
          0% { transform: scale(0.8); opacity: 0; }
          60% { transform: scale(1.04); opacity: 1; }
          100% { transform: scale(1); }
        }
        @keyframes popIn {
          0% { transform: scale(0.85); opacity: 0; }
          60% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .verify-card { animation: fadeInUp 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
        .verify-logo { animation: logoPop 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
        .otp-box { animation: popIn 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; animation-fill-mode: both; }
        .otp-error { animation: shake 0.4s ease; }
        .otp-box:nth-child(1) { animation-delay: 0.08s; }
        .otp-box:nth-child(2) { animation-delay: 0.13s; }
        .otp-box:nth-child(3) { animation-delay: 0.18s; }
        .otp-box:nth-child(4) { animation-delay: 0.23s; }
        .otp-box:nth-child(5) { animation-delay: 0.28s; }
        .otp-box:nth-child(6) { animation-delay: 0.33s; }
      `}</style>

      <div className="verify-card" style={{ maxWidth: "400px", width: "100%", textAlign: "center" }}>

        <div className="verify-logo" style={{ width: "56px", height: "56px", borderRadius: "14px", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem auto" }}>
          <svg width="28" height="28" viewBox="0 0 365 219" xmlns="http://www.w3.org/2000/svg">
            <path fill="#0a0a0a" d="M96.064575,165.549103 C96.366272,165.727371 96.667969,165.905640 97.020691,167.005798 C97.020691,171.608582 97.020691,176.211365 97.020691,180.814133 C97.424942,181.114319 97.829193,181.414505 98.233437,181.714676 C112.648994,169.587921 127.064552,157.461166 142.352478,144.600555 C136.653229,143.119751 132.347198,142.000931 127.689224,140.117615 C127.401375,135.075287 127.113518,130.032959 126.973160,124.267860 C128.984497,117.933220 135.203888,117.274460 139.932022,114.509651 C155.839188,105.207825 171.638748,95.721939 187.475739,86.308678 C187.475739,81.703476 187.475739,76.882881 187.475739,71.560562 C199.698669,77.999992 211.662857,84.303108 224.050797,90.829468 C211.899780,100.692886 199.833862,110.487228 187.173111,120.764412 C187.504791,113.638428 187.794525,107.413536 188.107529,100.688721 C176.578140,106.953163 164.937210,113.278221 153.019852,119.753464 C153.019852,128.063873 153.106766,136.719467 152.942032,145.370270 C152.911331,146.981888 152.323242,149.053528 151.220428,150.097000 C144.539169,156.418716 137.624146,162.492935 130.805710,168.670242 C119.956711,178.499100 109.033417,188.248886 98.336990,198.241348 C95.231705,201.142258 95.152985,204.950058 97.201767,209.194946 C103.133720,203.998001 108.661530,199.143433 114.202187,194.303558 C124.588501,185.230896 134.993423,176.179520 145.369888,167.095627 C156.346924,157.485947 167.147339,147.667404 178.310654,138.279892 C187.504074,130.548904 197.168274,123.380470 206.526382,115.841782 C216.044556,108.174164 225.652557,100.596611 234.831161,92.535484 C242.725525,85.602264 250.409851,78.357109 257.535583,70.647736 C262.086914,65.723610 265.476868,59.720032 269.270355,54.121033 C269.441528,53.868385 268.453339,52.830238 267.078735,52.001575 C239.384109,52.054615 211.689484,52.107655 183.141708,52.016808 C181.365662,52.220932 179.304489,51.914135 177.863312,52.718365 C171.889130,56.052246 165.844223,59.361343 160.293884,63.334187 C142.027573,76.408920 124.005127,89.823792 105.801323,102.986748 C100.091866,107.115173 95.788017,111.704567 96.962341,119.483917 C97.280693,121.592850 96.936661,123.801773 96.237114,126.246277 C96.460686,127.509384 96.684258,128.772491 97.016251,130.843353 C97.000595,132.201004 96.984940,133.558655 96.440697,135.056396 C96.343376,135.367905 96.246063,135.679413 95.986572,136.916962 C96.040627,146.281021 96.094688,155.645096 96.064575,165.549103 M268.743988,141.763657 C268.770264,140.839050 268.796509,139.914444 268.968628,138.063904 C268.973663,119.750961 269.030243,101.437645 268.898254,83.125687 C268.885986,81.426476 267.676086,79.735893 267.022247,78.041290 C265.681519,78.851440 264.154022,79.460625 263.030609,80.504608 C256.130219,86.916985 249.380585,93.492241 242.448868,99.869919 C240.085922,102.043976 236.203033,103.322350 235.114822,105.897491 C234.163528,108.148582 236.246307,111.628464 236.836929,114.595688 C238.044830,120.663971 239.928818,127.158257 235.640747,132.438889 C232.546341,136.249557 228.330673,139.533447 223.978882,141.864670 C212.656128,147.930222 200.982910,153.341537 188.925125,159.271774 C188.532455,153.090378 188.180252,147.545990 187.788666,141.381638 C174.279053,153.046722 161.510452,164.071960 148.805481,175.042252 C163.134384,183.761902 177.085220,192.251465 191.036057,200.741043 C191.380646,200.313141 191.725250,199.885239 192.069839,199.457336 C191.270569,195.139252 190.471298,190.821167 189.658249,186.428650 C190.906189,186.077881 192.752045,185.654800 194.533447,185.043854 C218.178879,176.934647 240.343750,165.827255 260.791931,151.475250 C263.901611,149.292648 265.688232,145.225082 268.743988,141.763657 z"/>
            <path fill="#fff" d="M128.041168,140.882126 C132.347198,142.000931 136.653229,143.119751 142.352478,144.600555 C127.064552,157.461166 112.648994,169.587921 98.233437,181.714676 C97.829193,181.414505 97.424942,181.114319 97.020691,180.814133 C97.020691,176.211365 97.020691,171.608582 97.008347,166.274246 C96.997238,165.362289 96.998489,165.181900 97.297333,164.707855 C97.730225,157.650772 97.973732,150.886917 97.947639,144.124069 C97.937180,141.414383 97.333435,138.706955 96.997574,135.727798 C96.984940,133.558655 97.000595,132.201004 97.240967,130.232178 C97.276009,128.402283 97.086334,127.183540 96.896652,125.964798 C96.936661,123.801773 97.280693,121.592850 96.962341,119.483917 C95.788017,111.704567 100.091866,107.115173 105.801323,102.986748 C124.005127,89.823792 142.027573,76.408920 160.293884,63.334187 C165.844223,59.361343 171.889130,56.052246 177.863312,52.718365 C179.304489,51.914135 181.365662,52.220932 183.676743,52.472023 C185.237396,53.284367 186.262344,53.951061 187.288757,53.953350 C213.030014,54.010765 238.771545,54.022274 264.512543,53.920010 C265.679047,53.915379 266.841064,52.771313 268.005157,52.157959 C268.453339,52.830238 269.441528,53.868385 269.270355,54.121033 C265.476868,59.720032 262.086914,65.723610 257.535583,70.647736 C250.409851,78.357109 242.725525,85.602264 234.831161,92.535484 C225.652557,100.596611 216.044556,108.174164 206.526382,115.841782 C197.168274,123.380470 187.504074,130.548904 178.310654,138.279892 C167.147339,147.667404 156.346924,157.485947 145.369888,167.095627 C134.993423,176.179520 124.588501,185.230896 114.202187,194.303558 C108.661530,199.143433 103.133720,203.998001 97.201767,209.194946 C95.152985,204.950058 95.231705,201.142258 98.336990,198.241348 C109.033417,188.248886 119.956711,178.499100 130.805710,168.670242 C137.624146,162.492935 144.539169,156.418716 151.220428,150.097000 C152.323242,149.053528 152.911331,146.981888 152.942032,145.370270 C153.106766,136.719467 153.019852,128.063873 153.019852,119.753464 C164.937210,113.278221 176.578140,106.953163 188.107529,100.688721 C187.794525,107.413536 187.504791,113.638428 187.173111,120.764412 C199.833862,110.487228 211.899780,100.692886 224.050797,90.829468 C211.662857,84.303108 199.698669,77.999992 187.475739,71.560562 C187.475739,76.882881 187.475739,81.703476 187.475739,86.308678 C171.638748,95.721939 155.839188,105.207825 139.932022,114.509651 C135.203888,117.274460 128.984497,117.933220 126.518005,124.739204 C125.845863,130.034561 125.566727,134.858078 125.527977,139.683517 C125.524826,140.076309 127.164734,140.482285 128.041168,140.882126 z"/>
            <path fill="#fff" d="M268.086823,142.029373 C265.688232,145.225082 263.901611,149.292648 260.791931,151.475250 C240.343750,165.827255 218.178879,176.934647 194.533447,185.043854 C192.752045,185.654800 190.906189,186.077881 189.658249,186.428650 C190.471298,190.821167 191.270569,195.139252 192.069839,199.457336 C191.725250,199.885239 191.380646,200.313141 191.036057,200.741043 C177.085220,192.251465 163.134384,183.761902 148.805481,175.042252 C161.510452,164.071960 174.279053,153.046722 187.788666,141.381638 C188.180252,147.545990 188.532455,153.090378 188.925125,159.271774 C200.982910,153.341537 212.656128,147.930222 223.978882,141.864670 C228.330673,139.533447 232.546341,136.249557 235.640747,132.438889 C239.928818,127.158257 238.044830,120.663971 236.836929,114.595688 C236.246307,111.628464 234.163528,108.148582 235.114822,105.897491 C236.203033,103.322350 240.085922,102.043976 242.448868,99.869919 C249.380585,93.492241 256.130219,86.916985 263.030609,80.504608 C264.154022,79.460625 265.681519,78.851440 267.022247,78.041290 C267.676086,79.735893 268.885986,81.426476 268.898254,83.125687 C269.030243,101.437645 268.973663,119.750961 268.580200,138.587204 C268.156769,140.083466 268.121796,141.056412 268.086823,142.029373 z"/>
          </svg>
        </div>

        <p style={{ fontFamily: "'Syne', sans-serif", fontSize: "16px", fontWeight: 800, color: "#fff", marginBottom: "2rem", letterSpacing: "-0.02em" }}>FlipCollab</p>

        <div style={{ background: "#111", border: "1px solid #1a1a1a", borderRadius: "16px", padding: "2.25rem 2rem" }}>

          <p style={{ fontSize: "10px", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#444", marginBottom: "0.75rem" }}>One more step</p>

          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: "0.75rem" }}>Enter your code</h1>

          <p style={{ fontSize: "13px", color: "#555", lineHeight: 1.7, marginBottom: "1.75rem" }}>
            We sent a 6-digit code to <span style={{ color: "#fff", fontWeight: 600 }}>{email}</span>
          </p>

          <div className={error ? "otp-error" : ""} style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "1.25rem" }}>
            {code.map((digit, idx) => (
              <input
                key={idx}
                className="otp-box"
                ref={el => { inputsRef.current[idx] = el; }}
                value={digit}
                onChange={e => handleChange(idx, e.target.value)}
                onKeyDown={e => handleKeyDown(idx, e)}
                onPaste={handlePaste}
                inputMode="numeric"
                maxLength={1}
                disabled={loading}
                style={{
                  width: "36px",
                  height: "44px",
                  textAlign: "center",
                  fontSize: "17px",
                  fontWeight: 700,
                  color: "#fff",
                  background: "#0a0a0a",
                  border: `1px solid ${error ? "#ff3b30" : digit ? "#fff" : "#222"}`,
                  borderRadius: "10px",
                  outline: "none",
                  fontFamily: "inherit",
                  transition: "border-color 0.15s",
                }}
              />
            ))}
          </div>

          {error && <p style={{ fontSize: "12px", color: "#ff3b30", marginBottom: "1rem" }}>{error}</p>}

          {loading && <p style={{ fontSize: "12px", color: "#555", marginBottom: "1rem" }}>Verifying...</p>}

          <div style={{ height: "1px", background: "#1a1a1a", marginBottom: "1.5rem" }} />

          <p style={{ fontSize: "12px", color: "#444", lineHeight: 1.6, marginBottom: "1rem" }}>
            Didn't get it? Check your spam folder, or
          </p>

          <div
            onClick={resending ? undefined : handleResend}
            style={{ padding: "13px", borderRadius: "8px", background: "transparent", border: "1px solid #222", color: resent ? "#34c759" : "#fff", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: resending ? "default" : "pointer", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "10px", opacity: resending ? 0.6 : 1, transition: "all 0.2s" }}
          >
            {resending ? "Sending..." : resent ? "Code resent" : "Resend code"}
          </div>

          <div
            onClick={() => navigate("role-select")}
            style={{ padding: "13px", borderRadius: "8px", background: "transparent", border: "1px solid #222", color: "#555", fontSize: "13px", fontWeight: 600, textAlign: "center", cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase" }}
          >
            Back to Sign In
          </div>

        </div>

        <p style={{ fontSize: "11px", color: "#333", marginTop: "1.5rem" }}>If you didn't create an account you can safely ignore this.</p>

      </div>
    </div>
  );
}