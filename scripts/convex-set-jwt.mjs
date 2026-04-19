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
  const backups = fs
    .readdirSync(root)
    .filter((f) => f.startsWith(".env.local.backup") || f === ".env.local.bak-for-buildtest");
  console.error(
    "缺少 .env.local。Convex CLI 要靠它识别「是哪个项目」，否则连不上 Production。\n\n做法任选其一：\n" +
      "  1) 在项目根执行：npx convex dev  （会生成/更新 .env.local）\n" +
      "  2) 从备份恢复，例如：cp .env.local.backup-日期 .env.local\n" +
      (backups.length
        ? `  当前目录里可能的备份：${backups.join(", ")}\n`
        : "") +
      "\n然后再执行：npm run convex:auth-keys-apply:prod",
  );
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
