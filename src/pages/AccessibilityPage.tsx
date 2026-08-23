const SECTIONS = [
  { t: "1. Our Commitment", b: "FlipCollab is committed to making our platform usable by everyone, including people with disabilities. We're actively working to improve accessibility across the app." },
  { t: "2. Conformance Target", b: "We aim to meet WCAG 2.1 Level AA. This is a partial conformance statement — not every screen has been fully audited yet, and some areas may not meet this standard in full." },
  { t: "3. Measures We've Taken", b: "Legible font sizing and colour contrast on our core screens, descriptive labels on primary actions, and support for browser and OS-level text resizing and zoom." },
  { t: "4. Known Limitations", b: "Some custom interactive elements (e.g. card-style buttons, in-app modals) may not yet behave optimally with screen readers or full keyboard-only navigation. We're addressing these incrementally — see the feedback section below to report a specific barrier." },
  { t: "5. Assistive Technology Compatibility", b: "FlipCollab is built to work with recent versions of major screen readers (VoiceOver, TalkBack, NVDA, JAWS) on up-to-date versions of Chrome, Safari, Firefox, and Edge." },
  { t: "6. Feedback", b: "If you hit an accessibility barrier anywhere in FlipCollab, tell us: hello@flipcollab.com. Please include the page you were on and, if possible, a screenshot or description of the assistive technology you were using — it helps us fix it faster." },
  { t: "7. Ongoing Effort", b: "Accessibility is not a one-time project. We review and update this statement as the app changes and as we resolve reported issues." },
  { t: "8. Contact", b: "hello@flipcollab.com" },
];

export default function AccessibilityPage() {
  return (
    <div style={{ height: "100vh", overflowY: "auto", WebkitOverflowScrolling: "touch", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", justifyContent: "center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>
      <div style={{ width: "100%", maxWidth: "640px", padding: "4rem 1.5rem 6rem" }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "32px", fontWeight: 800, color: "#fff", marginBottom: "0.5rem" }}>
          Accessibility Statement
        </h1>
        <p style={{ color: "#999", fontSize: "11px", marginBottom: "1.5rem" }}>Last updated: August 2026</p>
        <p style={{ fontSize: "13px", color: "#aaa", lineHeight: 1.6, marginBottom: "2rem" }}>
          This statement describes FlipCollab's current approach to digital accessibility and how to reach us if something isn't working for you.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {SECTIONS.map(({ t, b }) => (
            <div key={t}>
              <span style={{ color: "#fff", fontWeight: 600, fontSize: "13px", display: "block", marginBottom: "4px" }}>{t}</span>
              <span style={{ color: "#aaa", fontSize: "13px", lineHeight: 1.6 }}>{b}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
