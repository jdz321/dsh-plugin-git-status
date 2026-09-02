# Changelog

All notable changes to this project are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/).

Each release targets one DeepSeek Harness version (the plugin peer-depends on
the matching `@deepseek-ai/*` packages); older plugin releases keep working
against their own target version only.

## [Unreleased]

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
