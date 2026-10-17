import { Minimal } from './_minimal/minimalClass';
import { openMinimal } from './floatbutton/extension';
import { isFirefox } from './utils/general';
import { router } from './_minimal/router';

api.settings.init().then(() => {
  try {
    const mode = $('html').attr('mode');
    con.log('Mode', mode);
    if (mode === 'popup') {
      openMinimal(function (response) {
        $('html').css('height', '0');
        if (!isFirefox()) {
          window.close();
        }
      });
      return;
    }
  } catch (e) {
    con.error(e);
  }

  router().afterEach((to, from, failure) => {
    if (window.parent === window || failure) return;
    chrome.runtime.sendMessage({
      name: 'content',
      item: { action: 'pwaPath', data: { path: to.fullPath } },
    });
  });

  const minimalObj = new Minimal($('html'));

  // Desktop tabs receive their initial route from the background launcher.
  if ($('html').attr('mode') === 'window') return;

  checkFill(minimalObj, true);

  $(window).focus(() => {
    checkFill(minimalObj);
  });
});

function checkFill(minimalObj: Minimal, home = false) {
  con.log('CheckFill');
  if (!chrome.tabs) {
    con.error('Can not check for tabs');
    return;
  }
  chrome.tabs.query({ active: true }, tabs => {
    con.m('tabs').log(tabs);
    tabs.forEach(el => {
      chrome.tabs.sendMessage(el.id!, { action: 'TabMalUrl' }, response => {
        if (chrome.runtime.lastError) return;
        if (response && response.url) {
          con.log('Fill', response);
          minimalObj.fill(response, home);
        }
      });
    });
  });
}
