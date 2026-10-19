# Tsugi reviewer notes

Tsugi is a Firefox-focused, GPL-3.0-only fork of MALSync. The source code and build instructions are in the submitted source archive and at https://github.com/sebbe60/Tsugi.

## Build

```sh
npm ci
APP_TARGET=firefox npm run build:webextension
```

The Firefox extension is emitted to `dist/firefox`. The submission ZIP is assembled from that directory with `manifest.json` at its root.

## Why broad host access is requested

Tsugi tracks playback on supported user-selected anime and manga sites and supports user-added sites in **My sites**. It needs host access to inject a small content script into the current media page or its embedded player, detect playback, and show a local tracking state. It does not inject into a page until the page matches a configured or user-added site.

## Network use

Tsugi contacts only configured list providers, selected streaming sites, and MALSync/Chibi configuration endpoints to resolve titles, update progress, or retrieve the supported-site configuration. See `PRIVACY.md` for the complete disclosure.

## Firefox data-collection declaration

The Firefox manifest declares `authenticationInfo`, `websiteActivity`, and `websiteContent` as required. Those categories describe only the authentication token, the playback state, and the title/page information that must be transmitted to a provider or configured site to perform the user-requested tracking. Tsugi does not send telemetry, advertising identifiers, or analytics to the developer.

## Test access

The library UI can be opened through the toolbar action without a connected list account. Tracking requires the reviewer to connect a supported list provider and visit a supported site; no reviewer credentials are required.

