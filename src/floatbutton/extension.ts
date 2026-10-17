export function floatClick(page) {
  if (api.settings.get('floatButtonCorrection')) {
    con.log('Open correction');
    page.openCorrectionUi();
  } else {
    openMinimal(() => con.log('Opened Tsugi'), page.singleObj?.url);
  }
}

export function openMinimal(callback, url?: string) {
  chrome.runtime.sendMessage({ name: 'minimalWindow', url }, callback);
}
