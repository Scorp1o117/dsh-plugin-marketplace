/**
 * dsh-plugin-marketplace — node half.
 *
 * Host side of the marketplace: owns a `plugin-marketplace` settings
 * namespace used as a message channel between the browser UI and this
 * process. The client writes an `install` request; the settings watch here
 * spawns `dsh plugin --profile <p> add <pkg>` (npm install into the profile)
 * and appends the mount row to the profile's cordis.patch.yml, then reports
 * progress/result back through `installState`.
 *
 * The settings section UI itself lives in the browser half (exports["./client"]).
 */
import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import z from "@deepseek-ai/schemastery";
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import { ensureSettingsNamespaceExposed } from "./vendor/dsh-settings-expose.js";

/** Cordis plugin name. */
const name = "plugin-marketplace";
/** Settings namespace owned by this plugin (Web UI settings section + install channel). */
const NS = settingsNamespace("plugin-marketplace");

/** Runtime schema: the install request + the install state report. */
const Config = z.object({
  install: z.object({
    /** npm package name to install ("" = no pending request). */
    pkg: z.string().default(""),
    /** client-set timestamp; host dedups on it. */
    ts: z.number().default(0),
  }),
  installState: z.object({
    status: z.string().default("idle"), // idle | running | ok | error
    message: z.string().default(""),
    ts: z.number().default(0),
  }),
});

/** npm package-name shape (scope/name, no spaces, no path chars). */
const PKG_NAME = /^@?[a-z0-9][a-z0-9-._]*(?:\/[a-z0-9][a-z0-9-._]*)?$/;

function apply(ctx, config) {
  let sourceGetter = null;
  let lastTs = 0;

  // ── settings-backed configuration ─────────────────────────────────────────
  // The browser half edits this namespace; `onChange` fires on every write,
  // which is what turns an `install` request into a real install.
  installSettingsSection(ctx, NS, Config, config, {
    setSource: (getter) => {
      sourceGetter = getter;
    },
    onChange: () => {
      void maybeRunInstall();
    },
  });

  // dsh-host-apiproxy hard-codes which namespaces the Web client may touch;
  // patch the allowlist idempotently so the client can write install requests.
  ensureSettingsNamespaceExposed(ctx, "plugin-marketplace", ctx.logger);

  /** Resolved current config (settings layer over the entry). */
  function current() {
    return sourceGetter ? sourceGetter() : config;
  }

  /** Write the install-state report (and clear the consumed request). */
  async function report(status, message, pkg) {
    const settings = ctx.get("settings");
    if (!settings) return;
    const ts = Date.now();
    await settings.update(NS, {
      installState: { status, message, ts, pkg: pkg || "" },
      install: { pkg: "", ts: 0 },
    }).catch((error) => {
      ctx.logger.warn(`[plugin-marketplace] state write failed: ${String(error)}`);
    });
  }

  /** Find the active profile name from the process args ("web" default). */
  function profileName() {
    const argv = process.argv;
    const i = argv.indexOf("--profile");
    if (i >= 0 && argv[i + 1]) return argv[i + 1];
    return "web";
  }

  /** The dsh CLI entry used to boot this process (its own bin.js). */
  function dshBin() {
    return process.argv[1];
  }

  /** Append a mount row for `pkg` to cordis.patch.yml (idempotent). */
  function ensureMounted(pkg, profile) {
    const dshHome = process.env.DSH_HOME || join(os.homedir(), ".dsh");
    const patchPath = join(dshHome, "profiles", profile, "cordis.patch.yml");
    if (!existsSync(patchPath)) return " (patch file not found; mount manually)";
    const id = pkg.replace(/^@[^/]+\//, "").replace(/[^a-z0-9-]/g, "-") || pkg;
    let src = readFileSync(patchPath, "utf8");
    if (src.includes(`name: '${pkg}'`) || src.includes(`name: "${pkg}"`)) return " (already mounted)";
    // Append under the first `- insert:` list; match its indentation (4 spaces
    // is the convention used by dsh profiles).
    const insertAt = src.search(/^- insert:\s*$/m);
    const row = `\n    - id: ${id}\n      name: '${pkg}'`;
    if (insertAt >= 0) {
      src = src.slice(0, insertAt + "- insert:".length) + row + src.slice(insertAt + "- insert:".length);
    } else {
      src += `\n- insert:${row}\n`;
    }
    writeFileSync(patchPath, src, "utf8");
    return " (mounted in cordis.patch.yml)";
  }

  /** Run the install; resolve {code, stdout, stderr}. */
  function runInstall(pkg, profile) {
    const bin = dshBin();
    const node = process.execPath;
    return new Promise((resolve) => {
      execFile(node, [bin, "plugin", "--profile", profile, "add", pkg], {
        timeout: 5 * 60 * 1000,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
      }, (error, stdout, stderr) => {
        resolve({ code: error ? (error.code ?? 1) : 0, stdout, stderr });
      });
    });
  }

  async function maybeRunInstall() {
    try {
      const cfg = current();
      const req = cfg?.install;
      if (!req || !req.pkg || req.ts === lastTs || req.ts === 0) return;
      lastTs = req.ts;
      const pkg = String(req.pkg).trim();
      if (!PKG_NAME.test(pkg)) {
        await report("error", `invalid package name: ${pkg}`, pkg);
        return;
      }
      const profile = profileName();
      ctx.logger.info(`[plugin-marketplace] installing ${pkg} (profile=${profile})…`);
      await report("running", `installing ${pkg}…`, pkg);
      const result = await runInstall(pkg, profile);
      if (result.code !== 0) {
        const tail = (result.stderr || result.stdout || "").trim().split("\n").slice(-3).join(" ");
        ctx.logger.warn(`[plugin-marketplace] install failed (${result.code}): ${tail}`);
        await report("error", `install failed: ${tail || "unknown error"}`, pkg);
        return;
      }
      const mountNote = ensureMounted(pkg, profile);
      ctx.logger.info(`[plugin-marketplace] ${pkg} installed${mountNote}`);
      await report("ok", `${pkg} installed${mountNote}. Restart dsh web to load it.`, pkg);
    } catch (error) {
      ctx.logger.warn(`[plugin-marketplace] install flow failed: ${String(error)}`);
      await report("error", String(error instanceof Error ? error.message : error));
    }
  }
}

export { Config, apply, name };
