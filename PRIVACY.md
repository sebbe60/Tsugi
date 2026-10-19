# Tsugi Privacy Policy

Effective date: 19 October 2026

Tsugi is a Firefox extension maintained by Sebbe and based on MALSync. It helps you track anime and manga progress on sites you choose and connects only to the list services you configure.

## Data stored in Firefox

Tsugi stores settings, site preferences, watched-episode history, playback checkpoints, hidden discovery titles, and failed-sync recovery items in your Firefox profile through the extension storage API. This data stays in the browser profile unless it is included in a progress update you choose to sync to a connected list service.

## Data sent to services

When you connect a supported list service, Tsugi sends the information needed to look up a title or update your progress, such as a title, episode or chapter number, status, score, and authentication token. Depending on the service you enable, requests may go to MyAnimeList, AniList, Kitsu, SIMKL, Shikimori, MangaBaka, or their documented APIs.

Tsugi also contacts the MALSync and Chibi configuration services to obtain supported-site configuration. When matching a title or resolving a streaming link, it may send a title search query to a supported streaming or metadata service. Tsugi does not sell, rent, or use this information for advertising.

## Website access

Tsugi requests access to websites so it can detect media playback and apply the sites you add in **My sites**. It reads the page information needed for title matching and playback progress. It does not collect browsing history outside that purpose.

## Your choices

You can disconnect list services, remove custom sites, clear extension data, or uninstall Tsugi through Firefox's Add-ons Manager. Removing the extension deletes its local browser storage; it does not undo progress already synced to a connected service.

## Contact and source

Source code, issue tracking, and support are available at https://github.com/sebbe60/Tsugi.

