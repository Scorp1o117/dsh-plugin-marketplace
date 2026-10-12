import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AsyncLocalStorage } from "node:async_hooks";
import { readInventory, performOperation, installManagement } from "../management.js";

function fixture(t) {
  const home = mkdtempSync(join(tmpdir(), "dsh-management-"));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const profile = { name: "desktop", home, dir: join(home, "profiles", "desktop") };
  mkdirSync(profile.dir, { recursive: true });
  const manifest = { dependencies: { "test-plugin": "1.0.0" }, dsh: { profile: { bundles: ["@deepseek-ai/dsh-base", "test-plugin"] } } };
  const save = () => writeFileSync(join(profile.dir, "package.json"), JSON.stringify(manifest));
  function installed(name, version = "1.0.0") {
    const dir = join(profile.dir, "node_modules", name); mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name, version, dsh: { bundle: { patch: "./cordis.patch.yml" } } }));
  }
  installed("test-plugin"); save();
  writeFileSync(join(profile.dir, "cordis.patch.yml"), "# keep comment\n- insert:\n    - id: legacy\n      name: test-plugin\n      config:\n        nested: true\n    - id: sibling\n      name: other-plugin\n- update: legacy\n  config:\n    value: 1\n- update: sibling\n  config:\n    value: 2\n");
  return { profile, manifest, save, installed };
}

test("inventory includes managed dependencies and protects built-in bundles", t => {
  const { profile } = fixture(t);
  assert.deepEqual(readInventory(profile).packages.map(p => [p.name, p.managed, p.version]), [["@deepseek-ai/dsh-base", false, ""], ["test-plugin", true, "1.0.0"]]);
});

test("update uses @latest to cross a pinned range and verifies installed output", async t => {
  const f = fixture(t); let args;
  await performOperation({ action: "update", pkg: "test-plugin" }, f.profile, { execute: async command => {
    args = command; f.installed("test-plugin", "2.0.0"); return { code: 0 };
  } });
  assert.deepEqual(args, ["add", "test-plugin@latest"]);
  assert.equal(readInventory(f.profile).packages[1].version, "2.0.0");
});

test("uninstall removes dependency, bundle, full legacy mount and related patches, preserving siblings", async t => {
  const f = fixture(t);
  await performOperation({ action: "remove", pkg: "test-plugin" }, f.profile, { execute: async args => {
    assert.deepEqual(args, ["remove", "test-plugin"]); delete f.manifest.dependencies["test-plugin"];
    f.manifest.dsh.profile.bundles = ["@deepseek-ai/dsh-base"]; f.save(); return { code: 0 };
  } });
  const patch = readFileSync(join(f.profile.dir, "cordis.patch.yml"), "utf8");
  assert.doesNotMatch(patch, /test-plugin|legacy|nested/);
  assert.match(patch, /other-plugin/); assert.match(patch, /update: sibling/); assert.match(patch, /keep comment/);
});

test("invalid package names, built-ins and absent dependencies never reach the CLI", async t => {
  const { profile } = fixture(t);
  const execute = () => assert.fail("must not spawn");
  for (const pkg of ["../outside", "name;echo", "name --flag", "foo/bar", "@scope/../../x"]) {
    await assert.rejects(performOperation({ pkg }, profile, { execute }), /invalid package/);
  }
  for (const action of ["install", "update", "remove"]) await assert.rejects(performOperation({ action, pkg: "@deepseek-ai/dsh-base" }, profile, { execute }), /built-in|profile-managed/);
  await assert.rejects(performOperation({ action: "remove", pkg: "absent" }, profile, { execute }), /profile-managed/);
});

test("failed uninstall leaves the original profile patch intact", async t => {
  const { profile } = fixture(t); const path = join(profile.dir, "cordis.patch.yml"), before = readFileSync(path, "utf8");
  await assert.rejects(performOperation({ action: "remove", pkg: "test-plugin" }, profile, { execute: async () => ({ code: 1, stderr: "network failure" }) }), /network failure/);
  assert.equal(readFileSync(path, "utf8"), before);
});

test("suite update only updates installed suite packages; profile operations serialize", async t => {
  const f = fixture(t); const calls = []; let active = 0;
  const execute = async args => { assert.equal(active++, 0); calls.push(args); await new Promise(r => setTimeout(r, 15)); active--; return { code: 0 }; };
  await Promise.all([
    performOperation({ action: "suite-update", pkg: "~suite" }, f.profile, { packages: ["test-plugin", "missing-plugin"], execute }),
    performOperation({ action: "update", pkg: "test-plugin" }, f.profile, { execute }),
  ]);
  assert.deepEqual(calls, [["add", "test-plugin@latest"], ["add", "test-plugin@latest"]]);
});

test("management runs outside HMR, acknowledges once and cancels after unload", async t => {
  const { profile } = fixture(t); const transaction = new AsyncLocalStorage();
  const config = { install: { pkg: "bad package", ts: 1 } }; const handlers = [], disposers = []; let writes = 0;
  const settings = { update: async (_ns, patch) => {
    assert.equal(transaction.getStore(), undefined); writes++; Object.assign(config, patch);
    for (const handler of handlers) transaction.run(true, () => handler("test-manager"));
  } };
  installManagement({ get: name => name === "profileContext" ? profile : settings, logger: { warn() {} },
    on: (_event, fn) => handlers.push(fn), effect: fn => disposers.push(fn()) }, { get: () => config }, "test-manager");
  t.after(() => disposers.forEach(fn => fn()));
  await new Promise(r => setTimeout(r, 50));
  assert.equal(config.installState.status, "error"); assert.equal(config.install.ts, 0); assert.equal(writes, 2);
  disposers.forEach(fn => fn()); config.install = { pkg: "bad package", ts: 2 }; handlers.forEach(fn => fn("test-manager"));
  await new Promise(r => setTimeout(r, 20)); assert.equal(writes, 2);
});
