import RoleChooser from "../components/RoleChooser";
import { startDemoSession } from "../lib/demo/session";
import { withDemoKey } from "../lib/demo/access";
import type { DemoRole } from "../lib/demo/mode";

// The page at /demo. It only lets someone pick which side of FlipCollab to
// look around; /demo/brand and /demo/creator skip it and go straight in.
export default function DemoEntry() {
  const choose = (role: DemoRole) => {
    startDemoSession(role);
    // A full load, so the app boots as that person from the start.
    window.location.assign(withDemoKey(`/demo/${role}`));
  };

  return (
    <RoleChooser
      eyebrow="Try the demo"
      brand={{
        title: "I'm a Brand",
        sub: "Post a campaign and review applications from creators.",
        onChoose: () => choose("brand"),
      }}
      creator={{
        title: "I'm a Creator",
        sub: "Browse campaigns, apply, and see how payment works.",
        onChoose: () => choose("creator"),
      }}
      footer={
        <>
          <p className="rs-foot" style={{ textAlign: "center", fontSize: "13px", color: "#888", lineHeight: 1.6 }}>
            You get a made-up profile with sample campaigns, chats and payments. Nothing is saved, no one else can see it, and no money moves.
          </p>
          <p className="rs-foot-2" style={{ textAlign: "center", fontSize: "13px", color: "#888" }}>
            Ready for the real thing?{" "}
            <a href="/" style={{ color: "#fff", textDecoration: "underline" }}>Create an account</a>
          </p>
        </>
      }
    />
  );
}
