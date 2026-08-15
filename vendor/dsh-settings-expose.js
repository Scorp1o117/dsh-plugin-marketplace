/**
 * dsh-host-apiproxy exposes only namespaces listed in its hard-coded
 * WEB_SETTINGS_NAMESPACES allowlist to the Web settings client. A namespace
 * registered by a third-party plugin answers `settings-not-exposed` even
 * though it is registered — upstream explicitly defers letting plugins
 * expose their own configuration.
 *
 * This module idempotently patches that allowlist in the dsh installation
 * actually loaded by the host process, so the plugin's settings section
 * becomes visible in the Web UI without manual edits. A dsh update
 * overwrites the file; the next plugin start re-patches it.
 *
 * NOTE: dsh-host-apiproxy is an ESM package, so it never appears in the
 * CommonJS `Module._cache` (lookup 1 only helps CJS hosts). Lookup 2 anchors
 * on the running dsh bin, which always resolves the apiproxy as the app's
 * own dependency; lookup 3 walks up from `@deepseek-ai/dsh-settings` for
 * other npm layouts. pnpm-installed hosts resolve into an immutable store —
 * the write then fails and the manual instruction below applies.
 *
 * Also note that patching the file only affects the NEXT process start: the
 * running apiproxy already evaluated its allowlist at module load, so a
 * settings channel opened mid-session still answers `settings-not-exposed`
 * until `dsh web` is restarted.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, sep } from "node:path";

/**
 * Ensure `nsName` is present in dsh-host-apiproxy's WEB_SETTINGS_NAMESPACES.
 * No-op when already exposed or when the file cannot be located/patched.
 * @param {import("cordis").Context} ctx
 * @param {string} nsName - settings namespace short name (e.g. "tdai-memory").
 * @param {{info?: Function, warn?: Function}} logger - dsh logger.
 */
export function ensureSettingsNamespaceExposed(ctx, nsName, logger) {
  void ctx;
  try {
    const target = findApiproxyIndex();
    if (!target) {
      logger?.warn?.(`[settings-expose] could not locate dsh-host-apiproxy in this dsh install; the "${nsName}" settings channel will answer "not exposed". Fix: add "${nsName}" to WEB_SETTINGS_NAMESPACES in <dsh>/node_modules/@deepseek-ai/dsh-host-apiproxy/lib/index.js and restart dsh web`);
      return;
    }
    let src;
    try {
      src = readFileSync(target, "utf8");
    } catch (error) {
      logger?.warn?.(`[settings-expose] cannot read ${target}: ${String(error)}`);
      return;
    }
    const body = src.match(/const WEB_SETTINGS_NAMESPACES = \[([\s\S]*?)\];/)?.[1] ?? "";
    if (body.includes(`"${nsName}"`)) return; // already exposed (manual or previous patch)
    const patched = src.replace(/(const WEB_SETTINGS_NAMESPACES = \[[\s\S]*?)(\n\s*\];)/, (_, pre, post) => {
      const trailingComma = /,\s*$/.test(pre) ? "" : ",";
      const sep2 = pre.trimEnd().endsWith("[") ? "" : trailingComma;
      return `${pre}${sep2}\n\t"${nsName}"${post}`;
    });
    if (patched === src) {
      logger?.warn?.(`[settings-expose] allowlist pattern not found in ${target}; add "${nsName}" to WEB_SETTINGS_NAMESPACES manually`);
      return;
    }
    writeFileSync(target, patched, "utf8");
    logger?.info?.(`[settings-expose] added "${nsName}" to WEB_SETTINGS_NAMESPACES (${target}) — restart dsh web: the settings channel opens only in the NEXT process start`);
  } catch (error) {
    logger?.warn?.(`[settings-expose] failed to expose "${nsName}" (${String(error)}); add it to WEB_SETTINGS_NAMESPACES in dsh-host-apiproxy/lib/index.js manually, then restart dsh web`);
  }
}

function findApiproxyIndex() {
  // 1) The host process has already loaded dsh-host-apiproxy: read the real
  //    module path from the CommonJS module cache (any install layout; ESM
  //    hosts — every modern dsh — skip this).
  try {
    const Module = createRequire(import.meta.url)("module");
    const cache = Module._cache ?? {};
    for (const key of Object.keys(cache)) {
      if (key.includes(`${sep}dsh-host-apiproxy${sep}`) && key.endsWith(`${sep}index.js`)) return key;
    }
  } catch { /* fall through */ }
  // 2) Resolve the apiproxy as a dependency of the running dsh app: the bin
  //    (`node <dsh>/lib/bin.js`) anchors the app root in both shipped and
  //    source layouts, and dsh-host-apiproxy is always one of its deps.
  try {
    const appRoot = dirname(dirname(process.argv[1] ?? ""));
    const requireFromApp = createRequire(join(appRoot, "package.json"));
    const entry = requireFromApp.resolve("@deepseek-ai/dsh-host-apiproxy");
    if (entry.endsWith(`${sep}index.js`)) return entry;
  } catch { /* fall through */ }
  // 3) Walk up from @deepseek-ai/dsh-settings: the apiproxy is a scoped
  //    sibling in the same dependency tree (flat/global and nested layouts).
  try {
    const require = createRequire(import.meta.url);
    const settingsEntry = require.resolve("@deepseek-ai/dsh-settings");
    let dir = dirname(settingsEntry);
    while (true) {
      const scoped = join(dir, "@deepseek-ai", "dsh-host-apiproxy", "lib", "index.js");
      if (existsSync(scoped)) return scoped;
      const bare = join(dir, "dsh-host-apiproxy", "lib", "index.js");
      if (existsSync(bare)) return bare;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch { /* fall through */ }
  return "";
}
