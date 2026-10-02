import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { join } from "node:path";
import test from "node:test";
import { activeProfile, cliEntry, runInstall, writeState } from "../runtime.js";
import { apply } from "../index.js";

const runtime = (overrides = {}) => ({
  argv: ["electron"], execPath: join("/app", "Harness"),
  versions: { electron: "40" }, env: {}, resourcesPath: "/app/resources", ...overrides,
});
const profile = { name: "mktest", dir: join("/isolated", "profiles", "mktest"), home: join("/isolated") };

test("active Host profile overrides stale argv/env and unrelated installed profiles", () => {
  const ctx = { get: (name) => name === "profileContext" ? { dir: profile.dir, home: profile.home } : undefined };
  assert.deepEqual(activeProfile(ctx, runtime({ argv: ["node", "cli.js", "--profile", "web"], env: { DSH_PROFILE: "desktop", DSH_HOME: "/wrong" } })), profile);
  assert.deepEqual(activeProfile({ get: (name) => name === "settings" ? { documentPath: join(profile.dir, "cordis.patch.yml") } : undefined }, runtime()), profile);
  assert.equal(activeProfile({ get: () => undefined }, runtime()).name, "desktop");
  assert.equal(activeProfile({ get: () => undefined }, runtime({ versions: {}, argv: ["node", "bin.js", "--profile=mktest"] })).name, "mktest");
});

test("packaged Electron without argv[1] uses its bundled CLI and Node environment", async () => {
  const rt = runtime();
  const entry = join(rt.resourcesPath, "app.asar", "dsh", "node_modules", "@deepseek-ai", "dsh-desktop-host", "lib", "cli.js");
  let called = 0;
  const result = await runInstall("test-package", profile, rt, (exe, args, options, callback) => {
    called++;
    assert.equal(exe, rt.execPath);
    assert.deepEqual(args, ["--expose-internals", entry, "plugin", "--profile", "mktest", "add", "test-package"]);
    assert.equal(options.env.ELECTRON_RUN_AS_NODE, "1");
    assert.equal(options.env.DSH_HOME, profile.home);
    assert.equal(options.windowsHide, true);
    callback({ code: 1 }, "", "package not found");
  }, (file) => file === entry);
  assert.equal(called, 1);
  assert.equal(result.code, 1);
  assert.equal(result.stderr, "package not found");
});

test("desktop Node child replaces host index.js with cli.js, ordinary Web retains bin.js", () => {
  const host = join("/runtime", "node_modules", "@deepseek-ai", "dsh-desktop-host", "lib", "index.js");
  const cli = join("/runtime", "node_modules", "@deepseek-ai", "dsh-desktop-host", "lib", "cli.js");
  assert.equal(cliEntry(runtime({ argv: ["electron", host], resourcesPath: undefined }), (file) => file === cli), cli);
  const bin = join("/runtime", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js");
  assert.equal(cliEntry(runtime({ argv: ["node", bin], versions: {} }), (file) => file === bin), bin);
});

test("macOS packaged Node child locates Resources beside the MacOS binary directory", () => {
  const rt = runtime({ resourcesPath: undefined, execPath: join("/Applications", "Harness.app", "Contents", "MacOS", "Harness") });
  const entry = join("/Applications", "Harness.app", "Contents", "Resources", "app.asar", "dsh", "node_modules", "@deepseek-ai", "dsh-desktop-host", "lib", "cli.js");
  assert.equal(cliEntry(rt, (candidate) => candidate === entry), entry);
});

test("missing CLI and synchronous spawn exceptions become explicit installation errors", async () => {
  const missing = await runInstall("test", profile, runtime(), () => assert.fail("must not spawn"), () => false);
  assert.match(missing.stderr, /cannot locate/);
  const thrown = await runInstall("test", profile, runtime(), () => { throw new TypeError("spawn refused"); }, () => true);
  assert.equal(thrown.code, 1);
  assert.equal(thrown.stderr, "spawn refused");
});

test("state writes retry nested HMR and false refusals, and propagate permanent failure", async () => {
  let attempts = 0;
  const waits = [];
  const patch = { installState: { status: "running" } };
  await writeState({ update: async (_ns, actual) => {
    assert.equal(actual, patch);
    attempts++;
    if (attempts === 1) throw new Error("HMR transactions cannot be nested");
    if (attempts === 2) return false;
  } }, "plugin-marketplace", patch, async (ms) => waits.push(ms));
  assert.equal(attempts, 3);
  assert.deepEqual(waits, [400, 800]);
  attempts = 0;
  await assert.rejects(writeState({ update: async () => { attempts++; throw new Error("permanent"); } }, "plugin-marketplace", patch, async () => {}), /permanent/);
  assert.equal(attempts, 6);
});

test("event consumption waits for HMR completion and reports both request failures", async (t) => {
  let inTransaction = true;
  const transaction = new AsyncLocalStorage();
  let writes = 0;
  let listener;
  let dispose;
  const config = { install: { pkg: "invalid package", ts: 1 }, aiExplain: { repo: "owner/repo", ts: 2 } };
  const warnings = [];
  const settings = { update: async (_ns, patch) => {
    assert.equal(inTransaction, false, "write started inside settings HMR");
    assert.equal(transaction.getStore(), undefined, "timer inherited the HMR transaction context");
    writes++;
    Object.assign(config, patch);
    listener("plugin-marketplace");
  } };
  const ctx = {
    on: (_event, handler) => { listener = handler; },
    effect: (fn) => { dispose = fn(); },
    get: (name) => name === "settings" ? settings : undefined,
    logger: { info() {}, warn: (warning) => warnings.push(warning) },
  };
  t.after(() => dispose());
  apply(ctx, { get: () => config });
  transaction.run(true, () => listener("plugin-marketplace"));
  assert.equal(writes, 0);
  inTransaction = false;
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(config.installState.status, "error");
  assert.equal(config.installState.pkg, "invalid package");
  assert.equal(config.install.pkg, "");
  assert.equal(config.aiExplainResult.status, "error");
  assert.equal(config.aiExplainResult.repo, "owner/repo");
  assert.equal(config.aiExplain.repo, "");
  assert.equal(writes, 2, "state events must not replay consumed requests");
  assert.deepEqual(warnings, []);
});

test("unload cancels pending request consumption", async () => {
  let dispose;
  let writes = 0;
  apply({ on() {}, effect: (fn) => { dispose = fn(); }, get: () => ({ update: async () => { writes++; } }), logger: { warn() {} } }, { install: { pkg: "invalid package", ts: 1 } });
  dispose();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(writes, 0);
});

test("AI explanation streams through the selected model and clears its request", async (t) => {
  const config = { aiExplain: { repo: "owner/example", desc: "description", readme: "readme", ts: 1 } };
  const states = [];
  let dispose;
  const ctx = {
    on() {}, effect: (fn) => { dispose = fn(); },
    get: () => ({ update: async (_ns, patch) => { Object.assign(config, patch); states.push(patch.aiExplainResult.status); } }),
    logger: { info() {}, warn: (message) => assert.fail(message) },
    agentDefaultModel: { currentSelection: () => ({ provider: "stub", model: "test" }) },
    llm: { async *stream(options) {
      assert.equal(options.provider, "stub");
      assert.equal(options.model, "test");
      assert.equal(options.purpose, "plugin-marketplace-explain");
      yield { type: "block-start", index: 0, blockType: "text" };
      yield { type: "text-delta", index: 0, text: "测试解释。" };
      yield { type: "block-end", index: 0, block: { type: "text", text: "测试解释。" } };
      yield { type: "finish", reason: "stop" };
    } },
  };
  t.after(() => dispose());
  apply(ctx, { get: () => config });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(states, ["running", "ok"]);
  assert.equal(config.aiExplainResult.text, "测试解释。");
  assert.equal(config.aiExplain.repo, "");
});
