import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const clientSource = await readFile(new URL('../client.js', import.meta.url), 'utf8');

test('a settled write is verified, not assumed', () => {
  // The scope contract is "settle after the write and any recovery read", so a
  // write the Host refused (settings/conflict) still resolves. Checking only
  // `status === "ready"` passes after such a refusal — the namespace stays
  // registered and the recovery read re-renders it as ready — so the section's
  // own value has to be compared.
  assert.match(clientSource, /JSON\.stringify\(snap\.value\[field\]\) !== JSON\.stringify\(value\)/);
  assert.match(clientSource, /code: "settings-not-applied"/);
});

test('every write path reports a structured {ok, error?} result', () => {
  // Callers surface `result.error` verbatim; a path that rejected instead would
  // escape the UI's error handling.
  assert.match(clientSource, /return \{ ok: false, error: \{ message: String\(e && e\.message \|\| e\) \} \}/);
  assert.match(clientSource, /function writeField\(scope, api, field, value\)/);
});

test('the raw channel fallback also returns the Host result verbatim', () => {
  assert.match(clientSource, /response && response\.result\) \? response\.result/);
});
