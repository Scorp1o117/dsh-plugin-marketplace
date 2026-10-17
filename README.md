# dsh-plugin-marketplace

## DSH 0.2.1-rc.1

Supports DSH 0.2.1-rc.1. Compatibility is declared through `engines.dsh` and matching peer ranges, including this exact prerelease. The existing 0.2.0-rc.2 support is retained.

Browse GitHub's dsh-plugin topic and manage plugins in the active DSH Web or Desktop profile. Version 0.5.2 requires DSH 0.2.0-rc.2 or later 0.2.x.

```sh
dsh plugin --profile desktop add dsh-plugin-marketplace@0.5.2
```

Use the Desktop-provided dsh command (Application → Manage dsh Command); use --profile web for Web. Restart DSH, then open **Plugins → Installed → dsh-plugin-marketplace**.

## Plugin management

The configuration page lists the active profile's direct dependencies and built-in bundles. Enter an npm package name (including scoped names) to install, update individual installed packages to latest, refresh the list, or uninstall with an inline confirmation. Updates explicitly resolve package@latest, including dependencies pinned to an older version. Built-in bundles are listed as managed by DSH and cannot be overwritten or removed here. Transitive libraries are not independent profile plugins.

Operations use the official CLI carried by the current Host. Desktop uses its bundled Electron CLI and package manager with its own profile; it does not invoke the global Web CLI or the Desktop Host entry as a CLI. Operations are serialized across the suite and marketplace. Results refresh the actual installed inventory; a failed batch reports its failure and any partial installed state. Restart DSH after package changes, including updating or uninstalling this marketplace itself.

Bundle registration/removal is reconciled by DSH. Legacy manual mounts and their configuration patches are removed structurally on uninstall. Unrelated YAML configuration and comments are preserved. Settings requests are acknowledged outside HMR and consumed once; pending work is cancelled on unload.

The GitHub browser retains explicit search, star/update sorting, README previews and AI explanations using the configured model. Package names inferred from repository names should be checked against the author's installation instructions; the management form also accepts an explicit npm name. Both Chinese and English follow the DSH language setting.

## Validation

npm test covers Desktop CLI routing, state writes, HMR, localization, pinned updates, uninstall cleanup, built-in protection, failed operations and serialization.
