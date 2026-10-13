# Changelog

All notable changes to this project are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/).

Each release targets one DeepSeek Harness version (the plugin peer-depends on
the matching `@deepseek-ai/*` packages); older plugin releases keep working
against their own target version only.

## [Unreleased]

## [0.6.0] — 2026-09-30

### Fixed
- The expanded change list no longer shows the composer through it. Its
  background was `--dsw-specific-menu`, which in 0.2.0-rc.2 is the menu *fill*
  (`rgba(248,249,250,0.58)` light / `rgba(67,69,74,0.45)` dark): the shipped
  `MenuSurface` pairs that fill with `backdrop-filter`, but this popover paints
  its own background, so the fill left it translucent. It now uses the opaque
  `--dsw-alias-bg-layer-1` surface — the same token `HoverCard`'s plain panel
  uses — so light and dark are both fully opaque with no literal color and no
  per-scheme branch.
- The menu's scrollbar override declared `--dsw-scrollbar-thumb{,–hover}`,
  names nothing in the theme defines; the live pair is `--dsh-scrollbar-thumb`
  / `--dsh-scrollbar-thumb-hover` (`scrollbar.css`), so the menu inherited the
  global thumb instead of its layer-2 one.

### Changed
- Target DeepSeek Harness `0.2.0-rc.2`; all `@deepseek-ai/*` dependencies
  updated, `cordis` to `4.0.4`, `schemastery` to `3.18.4`.
- **Fixed the startup failure on 0.2.0-rc.2.** The Typert strict codec contract
  replaced the materialized `schema` field with a `create()` factory, so both
  the Host `TYPERT` manifest and the browser Remote contribution now declare
  `create: () => <schema>`; the old shape made `typert-loader` refuse to
  register (`parameter codec has no create() factory`) and aborted startup.
- Host settings migrated to volatile configuration: `settings.installSection`
  was removed, so `refreshIntervalMs` is now declared with `.volatile()` on the
  plugin's own `Config` and read through the committed reference
  (`config.refreshIntervalMs.get()`). The Loader commits a settings write into
  that reference in place, so the panel still picks up a new cadence live.
- Browser settings migrated off the removed `settingsScope` service and the
  removed `settings.plugin.item` slot. The page now binds its Host entry through
  the shared `configForms` service and registers into `plugins.bundle.config`
  (the seat the Plugins page documents for a bundle's configuration), gated by
  `configForms.whileServed`, and renders with the shared
  `SettingsForm`/`SettingsValueField` primitives.
- Product icons renamed to the weight-suffixed set
  (`IconBranchOutlineRegular`, `IconRefreshOutlineRegular`).
- `lib/typert.js` is now typed as the official `TypertContribution`, so a
  descriptor that drifts from the wire contract fails at build time.
- Added a Typert wire-contract test that runs the real `typert-loader`
  validator and registry over both faces.
- Development commands use `npm` (the tracked lockfile) instead of `pnpm`.

### Removed
- The bespoke settings-card component and its stylesheet; the Plugins page's
  shared form primitives replace them.

## [0.5.0] — 2026-09-02

### Changed
- Target DeepSeek Harness `0.1.2-alpha.4`; all `@deepseek-ai/*` dependencies
  updated, `cordis` to `4.0.2`, `schemastery` to `3.18.2`.
- Settings registration migrated to the new settings-provider API
  (`ctx.settings.installSection`); the settings namespace is now a plain
  lowercase string.
- Client type surface migrated off the removed `dsh-client-runtime` package
  (`Context` from `cordis`, `SettingsScope` from `dsh-client-ui-settings`,
  session types from `dsh-api-session-controller` / `dsh-client-ui-session`).
- Client boot edges updated to the restructured web module graph.

## [0.4.0] — 2026-08-21

### Added
- Plugin configuration card in **Settings → Plugins** (like the terminal
  plugin's card): edit the panel auto-refresh interval
  (`refreshIntervalMs`) through the plugin's own settings namespace, with
  save / discard / reset-to-default, an overridden badge, and read-only and
  validation states.
- Saves apply live: the panel reads the interval from the shared settings
  mirror, so the auto-refresh timer restarts immediately after a card save
  (no page reload).

### Changed
- Card copy, layout, and surface tokens aligned with the official plugin
  cards (discard / reset to default / save failed / show-hide settings copy;
  collapse state, field row, footer buttons).

## [0.3.0] — 2026-08-21

### Added
- Configurable panel auto-refresh interval via the Host plugin config
  (`refreshIntervalMs`, default 30000; `0` disables auto-refresh), delivered
  to the panel through a new `gitStatus/getPollConfig` Remote method.
- Auto-refresh pauses while the browser tab is hidden and resumes (with an
  immediate refresh) when it becomes visible again.

### Changed
- Target DeepSeek Harness `0.1.1-rc.1`; `@deepseek-ai/*` dependencies and the
  web shared-module external list updated.

## [0.2.1] — 2026-08-19

### Changed
- Release packaging: build artifacts are no longer committed to the
  repository (`npm publish` builds them via `prepublishOnly`); npm lockfile
  tracked; workspace screenshots added to the README and shipped in the
  package.

## [0.2.0] — 2026-08-19

### Fixed
- `remote.gitStatus` became consumable at runtime: mounting the Remote
  namespace and consuming it are split into provider/consumer child plugins,
  fixing `cannot get property "remote.gitStatus" without inject`.

### Changed
- The change-summary in the tool row renders as plain clickable text (no
  button chrome), and the grouped change list opens upward with the shared
  dropdown card styling, matching the permission and model selectors.

## [0.1.0] / [0.1.1] — 2026-08-19

Initial releases. `0.1.1` shipped with a broken client manifest and is not
usable; upgrade to `0.2.0` or later.
