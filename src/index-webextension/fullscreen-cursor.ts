import { createFullscreenCursor } from '../utils/fullscreenCursor';

const KEY = 'settings/tsugiFullscreenCursor';
const cursor = createFullscreenCursor(document, window);
chrome.storage.sync.get(KEY).then(store => cursor.setEnabled(store[KEY] !== false));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes[KEY]) cursor.setEnabled(changes[KEY].newValue !== false);
});
window.addEventListener('pagehide', event => {
  if (!event.persisted) cursor.dispose();
});
