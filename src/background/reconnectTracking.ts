import { doesUrlMatchPatterns } from 'webext-patterns';

/** Reattach tracking after an extension reload without reloading a playing page. */
export async function reconnectTrackingTabs(scripts: chrome.scripting.RegisteredContentScript[]) {
  const mainScripts = scripts.filter(script => script.js?.includes('content/content-script.js'));
  const playerScripts = scripts.filter(script => script.js?.includes('content/iframe.js'));
  if (!mainScripts.length) return;
  const matches = [...new Set(mainScripts.flatMap(script => script.matches || []))];
  const tabs = await chrome.tabs.query({ url: matches });
  await Promise.all(
    tabs.map(async tab => {
      if (tab.id === undefined || !tab.url) return;
      const main = mainScripts.find(script =>
        doesUrlMatchPatterns(tab.url!, ...(script.matches || [])),
      );
      if (!main) return;
      try {
        const frames = await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          func: () => {
            const scope = globalThis as typeof globalThis & {
              doubleLoad?: boolean;
              __tsugiIframeLoaded?: boolean;
            };
            return {
              url: window.location.href,
              mainLoaded: !!scope.doubleLoad,
              playerLoaded: !!scope.__tsugiIframeLoaded,
            };
          },
        });
        await frames
          .sort((a, b) => a.frameId - b.frameId)
          .reduce(async (previous, frame) => {
            await previous;
            if (!frame.result) return;
            let config: chrome.scripting.RegisteredContentScript | undefined;
            if (frame.frameId === 0 && !frame.result.mainLoaded) {
              config = main;
            } else if (!frame.result.playerLoaded) {
              config = playerScripts.find(script =>
                doesUrlMatchPatterns(frame.result!.url, ...(script.matches || [])),
              );
            }
            if (!config?.js?.length) return;
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id!, frameIds: [frame.frameId] },
                files: config.js,
              });
            } catch (error) {
              con.error('Could not reconnect tracking frame', error);
            }
          }, Promise.resolve());
      } catch (error) {
        // Closed tabs and browser-protected frames must not block other watch pages.
        con.error('Could not reconnect tracking tab', error);
      }
    }),
  );
}
