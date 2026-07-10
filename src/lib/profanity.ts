const BLOCKED_WORDS = [
  "fuck", "shit", "bitch", "asshole", "bastard", "cunt", "dick", "pussy",
  "nigger", "nigga", "faggot", "fag", "whore", "slut", "retard", "rape",
  "cock", "twat", "wanker", "motherfucker", "dumbass", "jackass", "prick",
];

function buildPattern() {
  return new RegExp(`\\b(${BLOCKED_WORDS.join("|")})\\b`, "gi");
}

export function censorProfanity(text: string): string {
  return text.replace(buildPattern(), (match) => match[0] + "*".repeat(match.length - 1));
}

export function containsProfanity(text: string): boolean {
  return buildPattern().test(text);
}
