# v0.5.3 validation — 2026-10-14

- Inspected the actual Desktop 0.2.0-rc.2 bundled settings client: `ConfigForms.get(entryId)` caches provider-owned controllers, and the provider disposes them on shutdown. Page cleanup now removes only its own subscription.
- All 30 tests passed, including repeated unmount/remount followed by install/update/remove/refresh/AI writes, repository-specific failure rendering, stalled-write timeouts, and acknowledgement/unmount timer cleanup. `node --check client.js` and `git diff --check` passed.
- Installed the packed 0.5.3 tarball through the real packaged Desktop CLI into an isolated Desktop profile and started the packaged runtime. Marketplace registered and the page displayed v0.5.3 with the correct profile inventory.
- Browser navigation from the marketplace to the plugin list and back, followed by refresh, produced a persisted `installState.status: ok`. Patch SHA256 changed from `38EE2BED3EEC35C4072315E2FEA2B0EA0F911DF05D761B37B8F8C607225C35C3` to `1930487211316609B56B35BF64BE7726B774A4F49ED292614C2F82F12FFC51E8`.
- An AI request after that navigation reached the Host and persisted a matching repository result. The isolated profile has no configured model, so it returned `model produced no text`; successful model generation is covered by the streaming runtime regression test.

# v0.5.2 validation — 2026-10-12

- Full npm test passed (26 tests), including pinned-version update arguments, structural YAML cleanup, failed operations, built-in protection, HMR and profile serialization.
- npm pack contents include management.js, runtime.js, client.js, locale metadata and bundle patch.
- Installed tarballs through the real Desktop bundled CLI in an isolated profile and started them using the installed Desktop 0.2.0-rc.2 runtime.
- Settings-channel refresh, invalid-package rejection, installation, update and uninstall of dsh-motion-ui all reached the expected real installed state.
- Browser showed the active Desktop inventory, explicit npm-name input, update/uninstall controls and protected built-in bundles.

- Automated Desktop package management closes stdin and sets CI mode. A previously hanging Soul installation completed successfully in 5 seconds with the corrected subprocess options.

- Subprocess capture uses null stdin and a bounded output drain after the official CLI exits. The six-plugin suite installation completed through the real Host request channel with the corrected packaged backend.

## 2026-10-17: 0.5.4, DSH 0.2.1-rc.1

- Full npm test command passed in a fresh npm dependency tree using the published DSH 0.2.1-rc.1 packages (30 Node test-runner cases, plus any script assertions). No skipped test-runner cases.
- Packed package installed with the official DSH CLI into an isolated Web profile. Configuration composition succeeded; the Web service started and authenticated HTTP returned 200. All six plugin bundles appeared enabled in the running UI.
- engines.dsh and every DSH peer range accept 0.2.0-rc.2 and 0.2.1-rc.1; unverified 0.2.1 alpha releases remain excluded.
- Reasoning page was opened, left, reopened, edited, saved, and refreshed. The saved value persisted and automatic reasoning augmentation remained off. Backend regressions cover repeated reconciliation after native removal, explicit opt-in, preserved custom declarations, and gateway-only writes.
- New packaged Desktop 0.2.1 was not exercised; these results verify Web. Motion UI was excluded from the adaptation.
