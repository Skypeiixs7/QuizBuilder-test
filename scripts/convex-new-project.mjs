/**
 * Backs up and removes .env.local so this folder is no longer tied to the previous Convex deployment.
 * Next step (manual): run `npx convex dev` → "create a new project" → configure new Dashboard env vars.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const envLocal = path.join(root, ".env.local");

if (!fs.existsSync(envLocal)) {
  console.log("No .env.local found — already unlinked locally.");
  process.exit(0);
}

const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const bak = path.join(root, `.env.local.backup-${stamp}`);
fs.copyFileSync(envLocal, bak);
fs.unlinkSync(envLocal);
console.log(`Backed up: ${path.basename(bak)}`);
console.log("Removed: .env.local");
console.log("");
console.log("Next steps:");
console.log("  1. npx convex dev");
console.log('  2. Choose "create a new project" (new Convex project = separate from production).');
console.log("  3. npm run convex:auth-keys → paste JWT_PRIVATE_KEY + JWKS into the NEW project (Dev) env.");
console.log("  4. Copy .env.example → .env.local and fill AUTH_GOOGLE_* if you use Google.");
console.log("  5. npm run dev → http://localhost:3010");
