// Builds the Chrome extension package: static app build + extension files -> public/audifiya-extension.zip
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const out = path.join(root, "dist-extension");
const run = (c, cwd = root) => execSync(c, { stdio: "inherit", cwd });

run("bunx vite build --config vite.extension.config.ts");
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, "dist/client"), out, { recursive: true });
for (const f of ["_headers", "google44eb0d093d1e7217.html", "robots.txt", "sitemap.xml", "audifiya-extension.zip"]) {
  fs.rmSync(path.join(out, f), { force: true });
}
fs.cpSync(path.join(root, "extension"), out, { recursive: true });

// MV3 forbids inline scripts: move each one into its own file, keeping order.
const htmlPath = path.join(out, "index.html");
let html = fs.readFileSync(htmlPath, "utf8");
let n = 0;
html = html.replace(/<script([^>]*)>([\s\S]*?)<\/script>/g, (m, attrs, body) => {
  if (/\bsrc=/.test(attrs) || /application\/ld\+json/.test(attrs) || !body.trim()) {
    return /application\/ld\+json/.test(attrs) ? "" : m;
  }
  const name = `inline-${n++}.js`;
  fs.writeFileSync(path.join(out, name), body);
  const keep = attrs.replace(/\s*type="module"/, "");
  return `<script${keep} src="/${name}"></script>`;
});
html = html.replace(/<link rel="manifest"[^>]*>/, "");
fs.writeFileSync(htmlPath, html);

const zip = path.join(root, "public/audifiya-extension.zip");
fs.rmSync(zip, { force: true });
run(`nix run nixpkgs#zip -- -qr ${zip} .`, out);
fs.rmSync(path.join(root, "dist"), { recursive: true, force: true });
console.log("Extension packaged:", zip, `(${n} inline scripts externalized)`);
