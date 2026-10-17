/** Every extension launcher opens the Watching home page in a regular tab. */
export async function openTsugiTab(sourceTab?: chrome.tabs.Tab) {
  if (!sourceTab) {
    [sourceTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  }

  const baseUrl = chrome.runtime.getURL('window.html');
  const homeUrl = `${baseUrl}#/library/watching`;
  // Chrome withholds tab URLs without the broad tabs permission. Its runtime
  // contexts expose only our own extension documents and survive worker restarts.
  let existingTabId: number | undefined;
  if (typeof chrome.runtime.getContexts === 'function') {
    const contexts = await chrome.runtime.getContexts({ contextTypes: ['TAB'] });
    existingTabId = contexts.find(
      context =>
        context.frameId === 0 &&
        context.documentUrl?.split('#')[0] === baseUrl &&
        (sourceTab?.windowId === undefined || context.windowId === sourceTab.windowId),
    )?.tabId;
  } else {
    const tabs = await chrome.tabs.query({
      url: `${baseUrl}*`,
      ...(sourceTab?.windowId !== undefined ? { windowId: sourceTab.windowId } : {}),
    });
    existingTabId = tabs.find(tab => tab.id !== undefined)?.id;
  }

  if (existingTabId !== undefined && existingTabId >= 0) {
    return chrome.tabs.update(existingTabId, {
      active: true,
      url: homeUrl,
    });
  }

  return chrome.tabs.create({
    url: homeUrl,
    active: true,
    ...(sourceTab?.windowId !== undefined ? { windowId: sourceTab.windowId } : {}),
  });
}
