# dsh-plugin-marketplace

[![中文文档](https://img.shields.io/badge/%E4%B8%AD%E6%96%87%E6%96%87%E6%A1%A3-blue)](README.zh.md)

**GitHub**: [Scorp1o117/dsh-plugin-marketplace](https://github.com/Scorp1o117/dsh-plugin-marketplace) · **npm**: [dsh-plugin-marketplace](https://www.npmjs.com/package/dsh-plugin-marketplace)

A **plugin marketplace** inside the DeepSeek Harness Web UI: browse
[github.com/topics/dsh-plugin](https://github.com/topics/dsh-plugin) right
from the settings page — no terminal needed.

- **Search** the topic by keyword, **sort** by stars or last update
- **Plugin cards** with description, stars, language, and update date
- **Detail panel**: GitHub README summary, install command, repo/npm links
- Powered by the public GitHub search API (CORS-enabled, no key needed;
  unauthenticated rate limit 60 req/h)
- Zero client dependencies (React only), no build step — hand-written
  ModuleLoader bundle

## Install

In `$DSH_HOME/profiles/web/cordis.patch.yml`:

```yaml
- insert:
    - id: plugin-marketplace
      name: 'dsh-plugin-marketplace'
```

Then restart `dsh web` (new client plugins require a process restart to be
scanned into the browser roster) and open **Settings → Plugin Marketplace**.

## How it works

| Layer | File | Role |
|---|---|---|
| host shell | `index.js` | empty apply — makes the package a loader entry |
| browser half | `client.js` | registers the `settings.section` "marketplace" tab; fetches GitHub search API; renders cards + detail |
| manifest | `package.json` | `dsh.client: { platform: "web" }` + `exports["./client"]` — discovered by `dsh-client-modules` |

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
