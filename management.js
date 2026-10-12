import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { AsyncResource } from "node:async_hooks";
import { parseDocument, isSeq, isMap } from "yaml";
import z from "@deepseek-ai/schemastery";
import { activeProfile, runPlugin, writeState } from "./runtime.js";

/** Settings fields shared by marketplace and suite management pages. */
export const managementFields = {
  install: z.object({ pkg: z.string().default(""), action: z.string().default("install"), ts: z.number().default(0) }),
  installState: z.object({ status: z.string().default("idle"), message: z.string().default(""), pkg: z.string().default(""), ts: z.number().default(0) }),
  inventory: z.object({ profile: z.string().default(""), packages: z.array(z.object({
    name: z.string(), version: z.string(), managed: z.boolean(), bundle: z.boolean(),
  })) }),
};

export const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;

/** Read direct profile dependencies and built-in bundle entries, never transitive libraries. */
export function readInventory(profile) {
  const manifest = JSON.parse(readFileSync(join(profile.dir, "package.json"), "utf8"));
  const deps = manifest.dependencies || {};
  const bundles = manifest.dsh?.profile?.bundles || [];
  const names = [...new Set([...Object.keys(deps), ...bundles])].sort();
  return { profile: profile.name, packages: names.map(name => {
    if (!PACKAGE_NAME.test(name)) throw new Error(`invalid profile dependency: ${name}`);
    let installed;
    try { installed = JSON.parse(readFileSync(join(profile.dir, "node_modules", name, "package.json"), "utf8")); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    return { name, version: installed?.version || "", managed: Object.hasOwn(deps, name), bundle: bundles.includes(name) };
  }) };
}

/** Remove explicit legacy mounts and their patches without touching sibling YAML configuration. */
export function removeManualMount(pkg, profile, write = true) {
  const path = join(profile.dir, "cordis.patch.yml");
  if (!existsSync(path)) return null;
  const doc = parseDocument(readFileSync(path, "utf8"));
  if (doc.errors.length) throw new Error(`cannot edit profile YAML: ${doc.errors[0].message}`);
  if (!isSeq(doc.contents)) throw new Error("profile patch must be a YAML sequence");
  const ids = new Set();
  for (const patch of doc.contents.items) {
    if (isMap(patch) && patch.get("name") === pkg && patch.get("id")) ids.add(patch.get("id"));
    const insert = isMap(patch) ? patch.get("insert", true) : undefined;
    if (!isSeq(insert)) continue;
    insert.items = insert.items.filter(row => {
      if (!isMap(row) || row.get("name") !== pkg) return true;
      if (row.get("id")) ids.add(row.get("id"));
      return false;
    });
  }
  doc.contents.items = doc.contents.items.filter(patch => {
    if (!isMap(patch)) return true;
    if (patch.get("name") === pkg || ids.has(patch.get("id"))) return false;
    const insert = patch.get("insert", true);
    if (isSeq(insert) && !insert.items.length && patch.items.length === 1) return false;
    for (const key of ["update", "remove", "replace"]) {
      const target = patch.get(key);
      if (typeof target === "string" && [...ids].some(id => target === id || target.startsWith(id + "."))) return false;
    }
    return true;
  });
  if (!ids.size) return null;
  const result = doc.toString();
  if (write) writeFileSync(path, result, "utf8");
  return result;
}

/** Run one validated operation. Updates explicitly cross pinned version ranges. */
export async function performOperation(request, profile, options = {}) {
  // Suite and marketplace can resolve different package copies in one Host.
  const key = Symbol.for("dsh-plugin-marketplace.profile-operations");
  const locks = globalThis[key] ||= new Map();
  const previous = locks.get(profile.dir) || Promise.resolve();
  const operation = previous.catch(() => {}).then(() => performUnlocked(request, profile, options));
  locks.set(profile.dir, operation);
  try { return await operation; }
  finally { if (locks.get(profile.dir) === operation) locks.delete(profile.dir); }
}

async function performUnlocked(request, profile, options) {
  const execute = options.execute || runPlugin;
  const inventory = readInventory(profile);
  const action = request.action || "install";
  if (action === "refresh") return;
  const suite = options.packages || [];
  let names;
  if (action === "suite-install") names = suite;
  else if (action === "suite-update") names = suite.filter(name => inventory.packages.some(p => p.name === name && p.managed));
  else if (["install", "update", "remove"].includes(action)) names = [request.pkg];
  else throw new Error(`unknown plugin action: ${action}`);
  if (!names.length) throw new Error("no packages selected");
  for (const pkg of names) {
    if (!PACKAGE_NAME.test(pkg)) throw new Error(`invalid package name: ${pkg}`);
    const row = inventory.packages.find(p => p.name === pkg);
    if ((action === "remove" || action === "update") && !row?.managed) throw new Error(`not a profile-managed dependency: ${pkg}`);
    if (action === "install" && row && !row.managed) throw new Error(`built-in bundle is managed by DSH: ${pkg}`);
    // Parse before uninstalling so malformed YAML cannot leave a missing mount.
    const cleaned = action === "remove" ? removeManualMount(pkg, profile, false) : null;
    const args = action === "remove" ? ["remove", pkg] : ["add", `${pkg}@latest`];
    const result = await execute(args, profile);
    if (result.code !== 0) throw new Error(`${pkg}: ${(result.stderr || result.stdout || `exit ${result.code}`).trim().slice(-1800)}`);
    if (cleaned !== null) removeManualMount(pkg, profile);
    if (action !== "remove") {
      const manifest = JSON.parse(readFileSync(join(profile.dir, "node_modules", pkg, "package.json"), "utf8"));
      if (!manifest.dsh?.bundle?.patch) {
        const path = join(profile.dir, "cordis.patch.yml");
        const doc = parseDocument(existsSync(path) ? readFileSync(path, "utf8") : "[]");
        if (doc.errors.length || !isSeq(doc.contents)) throw new Error("cannot mount plugin in invalid profile YAML");
        const hasMount = doc.contents.items.some(patch => {
          const rows = isMap(patch) ? patch.get("insert", true) : undefined;
          return isSeq(rows) && rows.items.some(row => isMap(row) && row.get("name") === pkg);
        });
        if (!hasMount) {
          doc.add({ insert: [{ id: pkg.replace(/[^a-z0-9-]/g, "-"), name: pkg }] });
          writeFileSync(path, doc.toString(), "utf8");
        }
      }
    }
    const after = readInventory(profile);
    if (action === "remove" ? after.packages.some(p => p.name === pkg) : !after.packages.some(p => p.name === pkg && p.version)) {
      throw new Error(`package operation did not produce the requested installed state: ${pkg}`);
    }
  }
}

/** Consume requests outside settings HMR, serialize mutations, and refresh the actual profile inventory. */
export function installManagement(ctx, config, ns, options = {}) {
  const resource = new AsyncResource(`${ns}-management`);
  let disposed = false, running = false, timer, lastTs = 0, first = true;
  const current = () => typeof config.get === "function" ? config.get() : config;
  const schedule = () => {
    if (disposed || running || timer !== undefined) return;
    timer = setTimeout(() => { timer = undefined; resource.runInAsyncScope(() => void consume()); }, 0);
  };
  async function consume() {
    if (disposed || running) return;
    const req = current()?.install;
    const pending = req?.ts && req.ts !== lastTs && (req.pkg || req.action === "refresh");
    if (!first && !pending) return;
    running = true; first = false;
    try {
      const profile = activeProfile(ctx);
      const settings = ctx.get("settings");
      if (pending) {
        lastTs = req.ts;
        await writeState(settings, ns, { install: { pkg: "", action: "install", ts: 0 }, installState: {
          status: "running", message: req.action || "install", pkg: req.pkg, ts: req.ts,
        } });
        await performOperation(req, profile, options);
      }
      if (!disposed) await writeState(settings, ns, { inventory: readInventory(profile), ...(pending ? { installState: {
        status: "ok", message: req.action === "refresh" ? "refreshed" : "Completed. Restart DSH to load changes.", pkg: req.pkg, ts: req.ts,
      } } : {}) });
    } catch (error) {
      ctx.logger.warn(`[${ns}] ${error.message}`);
      if (!disposed) {
        const patch = { installState: { status: "error", message: error.message, pkg: req?.pkg || "", ts: req?.ts || Date.now() } };
        // A batch may have completed some packages before a later failure.
        try { patch.inventory = readInventory(activeProfile(ctx)); } catch { /* original failure already names the unreadable profile */ }
        try { await writeState(ctx.get("settings"), ns, patch); } catch (stateError) { ctx.logger.warn(`[${ns}] ${stateError.message}`); }
      }
    } finally {
      running = false;
      schedule();
    }
  }
  ctx.on("settings/document-updated", id => { if (id === ns) schedule(); });
  ctx.effect(() => () => { disposed = true; clearTimeout(timer); resource.emitDestroy(); });
  schedule();
}
