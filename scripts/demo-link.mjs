// Makes a private demo link, or fingerprints a key you already have.
//
//   node scripts/demo-link.mjs                new random key, its link and its line
//   node scripts/demo-link.mjs hash <key>     the line for a key you already have
//
// Paste the printed line into ALLOWED in src/lib/demo/access.ts and publish.
// Send the person the link. Delete the line later to switch that link off.
import { createHash, randomBytes } from "node:crypto";

const args = process.argv.slice(2);
const key = args[0] === "hash" ? args[1] : randomBytes(16).toString("base64url");
if (!key) {
  console.error("Give the key to fingerprint: node scripts/demo-link.mjs hash <key>");
  process.exit(1);
}
const print = createHash("sha256").update(key).digest("hex");

console.log("");
console.log("Link to send:");
console.log(`  https://flipcollab.com/demo?k=${key}`);
console.log("");
console.log("Line to add to ALLOWED in src/lib/demo/access.ts:");
console.log(`  "${print}",`);
console.log("");
