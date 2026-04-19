/**
 * Generates JWT key pair and sets JWT_PRIVATE_KEY + JWKS on the deployment.
 * Uses NAME=value form so PEM is not parsed as flags.
 *
 * Usage:
 *   node scripts/convex-set-jwt.mjs           → dev deployment (.env.local)
 *   node scripts/convex-set-jwt.mjs --prod    → production deployment (same project)
 */
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const useProd = process.argv.includes("--prod");
const envPath = path.join(root, ".env.local");
if (!fs.existsSync(envPath)) {
  console.error("Missing .env.local — run npx convex dev and link a project first.");
  process.exit(1);
}

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });
const jwtPrivate = privateKey.trimEnd().replace(/\n/g, " ");

function convexEnvSet(nameValue) {
  const args = ["convex", "env", "set"];
  if (useProd) args.push("--prod");
  args.push(nameValue);
  const r = spawnSync("npx", args, {
    cwd: root,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

convexEnvSet(`JWT_PRIVATE_KEY=${jwtPrivate}`);
convexEnvSet(`JWKS=${jwks}`);
console.log(
  useProd
    ? "OK (production). Verify: npx convex env list --prod"
    : "OK (dev). Verify: npx convex env list",
);
