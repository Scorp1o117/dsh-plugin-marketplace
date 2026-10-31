# DSH Plugin Marketplace

[简体中文](README.md) | English

Discover community plugins in [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) and manage plugins installed in the current Web or Desktop profile.

## Features

- **Discover:** browse GitHub projects tagged `dsh-plugin`, search by keyword, sort by stars or update time, and preview READMEs.
- **AI explanations:** use the currently configured model to explain a plugin; availability depends on the model connection.
- **Manage:** install by npm package name, list the profile's direct dependencies, update to latest or confirm an uninstall. Built-in bundles are marked as managed by DSH and cannot be overwritten or removed here; transitive dependencies are not listed as independent plugins.
- **See actual results:** suite and marketplace operations are serialized per profile. Failures display errors and any partial completion before the installed state is refreshed.

> A GitHub repository name may differ from its npm package name. Check the author's package name and instructions before installing; the marketplace does not guarantee the safety of third-party plugins.

## Compatibility and installation

Supports DSH Web / Desktop. The repository declares compatibility with `0.2.0-rc.2`, `0.2.1-rc.1` / `rc.2` / `rc.3` / `rc.4` / `rc.5` and versions matching `>=0.2.0-rc.2 <0.3.0`; see [package.json](package.json) for the complete prerelease range. Node.js `>=20.18` is required.

For Desktop, install its `dsh` command through **Application → Manage dsh Command** first:

```sh
dsh plugin --profile desktop add dsh-plugin-marketplace
```

Replace `desktop` with `web` for Web. Restart DSH and open **Plugins → Installed → dsh-plugin-marketplace**. You can also install it through the [Enhancement Suite](https://github.com/Scorp1o117/dsh-enhancement-suite).

## Usage

1. Browse or search for a community plugin and read its project and installation instructions.
2. Enter its exact npm package name in the management form, for example `package-name` or `@scope/package-name`.
3. Install, update or confirm removal, and check the reported status and errors.
4. Restart DSH after changes, including updating or removing the marketplace itself.

Desktop uses the current Desktop host's CLI and package manager and targets its Desktop profile; Web targets its Web profile. Uninstalling a legacy plugin also removes its manual mount and configuration patches while preserving unrelated YAML settings and comments. The interface follows the DSH language setting.

## Development and feedback

`npm test` covers Desktop routing, installs, updates, uninstall cleanup, built-in protection and failures. [npm](https://www.npmjs.com/package/dsh-plugin-marketplace) · [Issues](https://github.com/Scorp1o117/dsh-plugin-marketplace/issues) · [MIT License](LICENSE).
