// Finds the web build output (TanStack Start/Nitro puts it in different places
// depending on setup) and copies it to ./app-web for electron-builder.
import { existsSync, readdirSync, rmSync, cpSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const candidates = [".output/public", "dist/client", "dist"];
const entryFiles = ["index.html", "_shell.html"];
const target = join(root, "app-web");

const found = candidates.find((dir) =>
  entryFiles.some((file) => existsSync(join(root, dir, file)))
);

if (!found) {
  console.error("\n[prepare-electron-web] No index.html or _shell.html found in the build output.\n");
  for (const dir of [".output", ".output/public", "dist", "dist/client"]) {
    const full = join(root, dir);
    console.error(
      `  ${dir}: ` + (existsSync(full) ? readdirSync(full).slice(0, 15).join(", ") || "(empty)" : "(missing)")
    );
  }
  console.error("\nPaste this output so the SPA/prerender config can be adjusted.\n");
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
cpSync(join(root, found), target, { recursive: true });
console.log(`[prepare-electron-web] Copied ${found} -> app-web`);
