import { upgradeTsugiSites } from '../background/upgradeSites';
import { initWatchRecovery } from '../background/watchRecovery';
import { openTsugiTab } from '../background/desktopTab';
import { initDatabase } from '../background/database';
import { listSyncInit } from '../background/listSync';
import { initProgressScheduler } from '../background/releaseProgress';
import { initSyncTags } from '../background/syncTags';
import { initMessageHandler } from '../background/messageHandler';
import { upgradewWizzards } from '../background/upgradeWizzards';
import { cleanupCustomDomains, initCustomDomain } from '../background/customDomain';
import { registerBackgroundEmitterCleanup } from '../utils/emitter';

try {
  chrome.runtime.onStartup.addListener(() => con.log('Browser started'));
} catch (e) {
  con.error(e);
}

try {
  registerBackgroundEmitterCleanup();
} catch (e) {
  con.error(e);
}

try {
  initMessageHandler();
} catch (e) {
  con.error(e);
}

try {
  initCustomDomain();
} catch (e) {
  con.error(e);
}

try {
  initSyncTags();
} catch (e) {
  con.error(e);
}

try {
  initDatabase();
} catch (e) {
  con.error(e);
}

try {
  listSyncInit();
} catch (e) {
  con.error(e);
}

try {
  initProgressScheduler();
} catch (e) {
  con.error(e);
}

initWatchRecovery();

chrome.action.onClicked.addListener(tab => {
  openTsugiTab(tab).catch(error => con.error('Could not open Tsugi', error));
});

// Notification actions
chrome.notifications.onClicked.addListener(function (notificationId) {
  chrome.tabs.create({ url: notificationId });
});

// Discord Rich Presence
chrome.runtime.onMessageExternal.addListener(function (request, sender, sendResponse) {
  chrome.tabs.sendMessage(
    request.tab,
    { action: 'presence', data: request.info },
    function (response) {
      sendResponse(response);
    },
  );
  return true;
});

chrome.runtime.onInstalled.addListener(async function (details) {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('install.html') }, function (tab) {
      con.info('Open installPage');
    });
  } else if (details.reason === 'update') {
    upgradewWizzards(details.previousVersion).finally(() => cleanupCustomDomains());
  }
  await upgradeTsugiSites().catch(error => con.error('Site list upgrade failed', error));
  await chrome.alarms.clearAll();
  chrome.alarms.create('tsugiWatchRecovery', { periodInMinutes: 1 });
});
