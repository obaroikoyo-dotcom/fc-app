import RoleChooser from "../components/RoleChooser";
import { type Page } from "../App";

interface Props { navigate: (p: Page) => void; }

export default function RoleSelect({ navigate }: Props) {
  return (
    <RoleChooser
      eyebrow="Who are you?"
      brand={{
        title: "I'm a Brand",
        sub: "Post campaigns and find creators who match your product.",
        onChoose: () => navigate("brand-onboarding"),
      }}
      creator={{
        title: "I'm a Creator",
        sub: "Apply to brand campaigns and grow your creator portfolio.",
        onChoose: () => navigate("creator-onboarding"),
      }}
      footer={
        <p className="rs-foot" style={{ textAlign: "center", fontSize: "13px", color: "#888" }}>
          Already have an account?{" "}
          <span
            onClick={() => navigate("login")}
            style={{ color: "#fff", cursor: "pointer", textDecoration: "underline" }}
          >
            Log in
          </span>
        </p>
      }
    />
  );
}
