const PARAGRAPHS = [
  "FlipCollab was created with a simple idea: collaborations between brands and creators should be easier, faster, and more transparent.",
  "Today, finding the right partnership can be frustrating on both sides. Brands spend countless hours searching for creators who genuinely align with their audience, while creators often struggle to discover opportunities that match their content, values, and goals. Too many great collaborations never happen because the process is scattered across emails, direct messages, spreadsheets, and multiple platforms.",
  "We built FlipCollab to change that.",
  "FlipCollab is a space where creators and brands can connect, discover opportunities, and build meaningful partnerships in one place. Whether you're a growing creator looking for your next collaboration or a brand searching for authentic voices to represent your products, our goal is to make the process straightforward and accessible.",
  "We believe successful collaborations are built on authenticity. The best partnerships happen when creators can remain true to their audience and brands can connect with communities in a genuine way. That's why we're focused on helping people find the right fit rather than simply creating more noise.",
  "As the creator economy continues to grow, we're committed to building tools that help both creators and businesses thrive. We want to remove unnecessary barriers, simplify communication, and create opportunities that might never have existed otherwise.",
  "FlipCollab is more than a platform. It's a community built around creativity, entrepreneurship, and collaboration. Every feature we develop is guided by the belief that great ideas deserve great partnerships.",
  "We're still at the beginning of our journey, and we're constantly improving based on feedback from the people who use our platform. Our mission is to become a trusted place where creators and brands can discover each other, work together, and grow together.",
  "Thank you for being part of the FlipCollab story. We're excited to see the collaborations, campaigns, and success stories that will be created through the connections made here.",
];

export default function AboutPage() {
  return (
    <div style={{ height: "100vh", overflowY: "auto", WebkitOverflowScrolling: "touch", background: "#0a0a0a", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", justifyContent: "center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');`}</style>
      <div style={{ width: "100%", maxWidth: "640px", padding: "4rem 1.5rem 6rem" }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "32px", fontWeight: 800, color: "#fff", marginBottom: "2rem" }}>
          About FlipCollab
        </h1>
        {PARAGRAPHS.map((p, i) => (
          <p key={i} style={{ fontSize: "14px", color: "#999", lineHeight: 1.8, marginBottom: "1.25rem" }}>
            {p}
          </p>
        ))}

        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, color: "#fff", marginTop: "2.5rem", marginBottom: "1rem" }}>
          What FlipCollab does
        </h2>
        <p style={{ fontSize: "14px", color: "#999", lineHeight: 1.8, marginBottom: "1.25rem" }}>
          FlipCollab is a creator collaboration marketplace. Brands create an account, post paid or gifted campaigns describing the content they need, and review creators who apply. Creators create a profile, browse open campaigns, and apply to the ones that fit their audience and niche. Once a brand accepts a creator, the two message each other directly inside FlipCollab to agree on deliverables and timelines. For paid campaigns, the brand's payment is held securely in escrow via Stripe and released to the creator once the agreed content is delivered.
        </p>

        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, color: "#fff", marginTop: "2.5rem", marginBottom: "1rem" }}>
          Your data
        </h2>
        <p style={{ fontSize: "14px", color: "#999", lineHeight: 1.8, marginBottom: "1.25rem" }}>
          To provide this service, FlipCollab collects account information (such as your name and email), profile details you choose to add (bio, niche, social links), messages and campaign content exchanged on the platform, and payment information processed securely through Stripe. This data is used solely to operate your account, match brands with creators, process payments, and enable messaging between the two parties - it is never sold to third parties. Full details are available in our{" "}
          <a href="https://privacy.flipcollab.com" style={{ color: "#fff", textDecoration: "underline" }}>Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
