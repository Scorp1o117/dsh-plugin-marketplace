import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import os from "node:os";

const require = createRequire(import.meta.url);

/** Prefer the active Host profile; never infer it from other installed profiles. */
function activeProfile(ctx, runtime = process) {
  const profile = ctx.get("profileContext");
  const document = ctx.get("settings")?.documentPath;
  const dir = profile?.dir || (document ? dirname(document) : "");
  if (dir) return { name: profile?.name || basename(dir), dir, home: profile?.home || dirname(dirname(dir)) };
  const i = runtime.argv.indexOf("--profile");
  const inline = runtime.argv.find((arg) => arg.startsWith("--profile="));
  const name = (i >= 0 ? runtime.argv[i + 1] : "") || inline?.slice(10)
    || runtime.env.DSH_PROFILE || (runtime.versions?.electron ? "desktop" : "web");
  const home = runtime.env.DSH_HOME?.trim() || join(os.homedir(), ".dsh");
  return { name, home, dir: join(home, "profiles", name) };
}

/** Desktop Host index.js is not a CLI; use its sibling cli.js instead. */
function cliEntry(runtime = process, exists = existsSync) {
  const candidates = [];
  const boot = runtime.argv[1];
  if (typeof boot === "string") {
    if (/[\\/]dsh-desktop-host[\\/]lib[\\/]index\.js$/.test(boot)) {
      candidates.push(join(dirname(boot), "cli.js"));
    } else if (/[\\/]dsh[\\/]lib[\\/]bin\.js$/.test(boot)
      || /[\\/]dsh-desktop-host[\\/]lib[\\/]cli\.js$/.test(boot)) candidates.push(boot);
  }
  if (runtime.resourcesPath) candidates.push(join(runtime.resourcesPath,
    "app.asar", "dsh", "node_modules", "@deepseek-ai", "dsh-desktop-host", "lib", "cli.js"));
  // In Electron's Node child resourcesPath can be absent, but execPath is still
  // the app binary. macOS stores resources next to MacOS; Windows/Linux beside it.
  if (runtime.versions?.electron) {
    for (const resources of [join(dirname(runtime.execPath), "resources"), join(dirname(runtime.execPath), "..", "Resources")]) {
      candidates.push(join(resources, "app.asar", "dsh", "node_modules", "@deepseek-ai", "dsh-desktop-host", "lib", "cli.js"));
    }
  }
  if (!runtime.versions?.electron) {
    try { candidates.push(join(dirname(require.resolve("@deepseek-ai/dsh/package.json")), "lib", "bin.js")); } catch { /* optional CLI */ }
  }
  return candidates.find((candidate) => exists(candidate));
}

function runInstall(pkg, profile, runtime = process, execute = execFile, exists = existsSync) {
  const bin = cliEntry(runtime, exists);
  if (!bin) return Promise.resolve({ code: 1, stdout: "", stderr: "cannot locate the dsh CLI entry" });
  const args = [...(runtime.versions?.electron ? ["--expose-internals"] : []),
    bin, "plugin", "--profile", profile.name, "add", pkg];
  return new Promise((resolve) => {
    try {
      execute(runtime.execPath, args, {
        env: { ...runtime.env, DSH_HOME: profile.home, ELECTRON_RUN_AS_NODE: "1" },
        timeout: 5 * 60 * 1000,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
      }, (error, stdout, stderr) => resolve({ code: error ? (error.code ?? 1) : 0, stdout, stderr }));
    } catch (error) {
      resolve({ code: 1, stdout: "", stderr: String(error.message || error) });
    }
  });
}

/** Let the current HMR transaction finish, and retry transient write refusals. */
async function writeState(settings, ns, patch, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))) {
  if (!settings) throw new Error("settings service unavailable");
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const result = await settings.update(ns, patch);
      if (result === false) throw new Error("settings state write refused");
      return;
    } catch (error) {
      if (attempt === 6) throw error;
      await wait(400 * attempt);
    }
  }
}

export { activeProfile, cliEntry, runInstall, writeState };
