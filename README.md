# dsh-plugin-marketplace

[![中文文档](https://img.shields.io/badge/%E4%B8%AD%E6%96%87%E6%96%87%E6%A1%A3-blue)](README.zh.md)

**GitHub**: [Scorp1o117/dsh-plugin-marketplace](https://github.com/Scorp1o117/dsh-plugin-marketplace) · **npm**: [dsh-plugin-marketplace](https://www.npmjs.com/package/dsh-plugin-marketplace)

[![Enhancement Suite](https://img.shields.io/badge/part%20of-Enhancement%20Suite-3964fe)](https://github.com/Scorp1o117/dsh-enhancement-suite) [![npm](https://img.shields.io/npm/v/dsh-enhancement-suite)](https://www.npmjs.com/package/dsh-enhancement-suite)

Part of the [DeepSeek Harness Enhancement Suite](https://github.com/Scorp1o117/dsh-enhancement-suite) — Vision · Soul/Persona · Long-term Memory · Plugin Marketplace.

A **plugin marketplace** inside the DeepSeek Harness Web UI: browse
[github.com/topics/dsh-plugin](https://github.com/topics/dsh-plugin) right
from the settings page — no terminal needed.

- **Search** the topic by keyword, **sort** by stars or last update
- **Plugin cards** with description, stars, language, and update date
- **Detail panel**: GitHub README summary, install command, repo/npm links
- **AI explain**: one click asks the configured default model what a plugin
  roughly does, answered in the UI — no need to read the README yourself
- Powered by the public GitHub search API (CORS-enabled, no key needed;
  unauthenticated rate limit 60 req/h)
- Zero client dependencies (React only), no build step — hand-written
  ModuleLoader bundle

## Install

As a profile bundle (recommended):

```
dsh plugin --profile web add dsh-plugin-marketplace
```

or via the package's `dsh.bundle.patch` layer — add `dsh-plugin-marketplace`
to `dsh.profile.bundles` in `$DSH_HOME/profiles/web/package.json`.

Manual mount in `$DSH_HOME/profiles/web/cordis.patch.yml`:

```yaml
- insert:
    - id: plugin-marketplace
      name: 'dsh-plugin-marketplace'
```

> **Upgrading from ≤ 0.2.2?** If you previously mounted the plugin manually,
> **remove that row from `cordis.patch.yml`** before switching to the bundle
> install — the bundle layer already inserts the entry, and two entries with
> the same id abort boot with `duplicate loader entry id: plugin-marketplace`.
> The two ways are alternatives, not both.

Then restart `dsh web` (new client plugins require a process restart to be
scanned into the browser roster) and open **Settings → Plugin Marketplace**.

**If the install button answers `settings namespace "plugin-marketplace" is
not exposed to configuration clients`**: the host apiproxy only lets a
hard-coded allowlist through, and this plugin patches that allowlist on its
first boot — the running process still answers `settings-not-exposed` until
`dsh web` is restarted. Restart once; if the error persists, check the boot
log for `[settings-expose]` lines (the fix line names the file to edit —
`WEB_SETTINGS_NAMESPACES` in `dsh-host-apiproxy/lib/index.js`).

## How it works

| Layer | File | Role |
|---|---|---|
| host shell | `index.js` | settings-backed install + AI-explain flows; `dsh.bundle.patch` makes the package a proper profile bundle |
| browser half | `client.js` | registers the `settings.section` "marketplace" tab; fetches GitHub search API; renders cards + detail; "AI explain" button |
| manifest | `package.json` | `dsh.bundle: { patch: "./cordis.patch.yml" }` + `dsh.client: { platform: "web" }` + `exports["./client"]` — discovered by `dsh-client-modules` |

The browser half needs no `dsh.client.inject` packages: it only uses `react`
(provided by the web runtime) and the `slots` / `locale` client services.

## Notes

- The GitHub search API returns at most 1000 results; the topic currently has
  280+ repos, so paging covers everything.
- READMEs are fetched per plugin on demand and truncated to ~1200 chars.
- If you see "rate-limited", wait an hour or run the web through a proxy that
  adds a GitHub token.

## License

MIT
