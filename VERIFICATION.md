# v0.5.1 validation — 2026-10-12

- Full npm test passed (25 tests), including pinned-version update arguments, structural YAML cleanup, failed operations, built-in protection, HMR and profile serialization.
- npm pack contents include management.js, runtime.js, client.js, locale metadata and bundle patch.
- Installed tarballs through the real Desktop bundled CLI in an isolated profile and started them using the installed Desktop 0.2.0-rc.2 runtime.
- Settings-channel refresh, invalid-package rejection, installation, update and uninstall of dsh-motion-ui all reached the expected real installed state.
- Browser showed the active Desktop inventory, explicit npm-name input, update/uninstall controls and protected built-in bundles.

- Automated Desktop package management closes stdin and sets CI mode. A previously hanging Soul installation completed successfully in 5 seconds with the corrected subprocess options.
