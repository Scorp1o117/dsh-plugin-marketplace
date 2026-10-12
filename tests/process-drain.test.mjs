import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runPlugin } from "../runtime.js";

test("an exited CLI succeeds when its descendant retains the output handles", async t => {
  const root = mkdtempSync(join(tmpdir(), "dsh-process-drain-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = join(root, "node_modules", "@deepseek-ai", "dsh", "lib");
  mkdirSync(dir, { recursive: true });
  const bin = join(dir, "bin.js");
  writeFileSync(bin, `const {spawn}=require('node:child_process');
    const fs=require('node:fs');
    if(fs.readFileSync(0,'utf8')!=='')process.exit(2);
    spawn(process.execPath,['-e','setTimeout(()=>{},6000)'],{stdio:'inherit',windowsHide:true});
    console.log('installed');process.exit(0);`);
  const start = Date.now();
  const result = await runPlugin(["add", "test-plugin"], { name: "test", home: root }, {
    argv: [process.execPath, bin], execPath: process.execPath, versions: {}, env: process.env,
  });
  assert.equal(result.code, 0); assert.match(result.stdout, /installed/);
  assert.ok(Date.now() - start < 4500, "waited for the descendant rather than the official CLI exit");
});
