export type TrackingNotice = {
  kind: 'tracking' | 'success' | 'error' | 'pending' | 'resume' | 'confirm';
  heading: string;
  title: string;
  detail: string;
  rating?: {
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
  };
  onRemove?: () => void;
  onDismiss?: () => void;
  actions?: { label: string; run: () => void }[];
};

let dismissPrompt: (() => void) | undefined;
let dismissFullscreen: (() => void) | undefined;

let dismissCurrent: (() => void) | undefined;

export function dismissTrackingNotice() {
  dismissCurrent?.();
  dismissPrompt?.();
  dismissFullscreen?.();
}

/** Separate from page styles and the legacy collapsed progress panel. */
export function showTrackingNotice(notice: TrackingNotice, options: { fullscreen?: boolean } = {}) {
  const prompt = notice.kind === 'confirm';
  const fullscreen = Boolean(options.fullscreen);
  if (!prompt && !fullscreen && dismissPrompt) return () => {};
  if (prompt) {
    dismissCurrent?.();
    dismissPrompt?.();
  } else if (fullscreen) dismissFullscreen?.();
  else dismissCurrent?.();
  let id = 'tsugi-tracking-notice';
  if (fullscreen) id = 'tsugi-fullscreen-notice';
  else if (prompt) id = 'tsugi-tracking-prompt';
  document.getElementById(id)?.remove();
  if (!fullscreen && notice.kind === 'tracking' && document.fullscreenElement) return () => {};

  const host = document.createElement('div');
  host.id = id;
  host.style.cssText =
    'all:initial;position:fixed;inset:auto;margin:0;right:24px;bottom:24px;z-index:2147483647;max-width:calc(100vw - 32px);width:400px;color-scheme:dark;';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `
    :host{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;color:#fff;text-align:left;line-height:1.45}
    *{box-sizing:border-box}button{font:inherit;cursor:pointer}
    .card{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;color:#fff;text-align:left;line-height:1.45;background:#080808;border:1px solid #353535;border-radius:18px;padding:20px;box-shadow:0 8px 24px #0003,0 24px 64px #0004}
    .top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
    .brand{display:flex;align-items:center;gap:9px;font-size:13px;font-weight:700;color:#fff}
    .brand-mask{display:block;width:32px;height:32px;object-fit:contain;flex:none}
    .close{border:0;background:transparent;color:#aaa;font-size:23px;line-height:20px;padding:0 2px;border-radius:4px}
    .body{display:flex;gap:14px;align-items:flex-start}
    .icon{flex:none;width:40px;height:40px;display:grid;place-items:center;border:1px solid #505050;border-radius:50%;color:#fff}
    .success .icon{border-color:#52d990;color:#52d990}
    .error .icon{border-color:#aaa}
    .pending .icon{border-color:#e9bd69;color:#e9bd69}
    svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}
    h2{font:700 19px/1.25 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0 0 5px;color:#fff;letter-spacing:-.3px}
    .title{font-size:14px;color:#e3e3e3;margin:0;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .detail{font-size:12px;color:#aaa;margin:6px 0 0}
    .rating{display:grid;gap:6px;margin:16px 0 0 54px;color:#aaa;font-size:12px}.rating select{font:inherit;font-size:14px;background:#191919;color:#fff;border:1px solid #505050;border-radius:8px;padding:9px;width:100%;color-scheme:dark}
    .actions{display:flex;gap:8px;margin:17px 0 0 54px;flex-wrap:wrap}
    .action{border:1px solid #505050;border-radius:8px;padding:7px 12px;background:#fff;color:#080808;font-size:12px;font-weight:650}
    .action+.action{background:transparent;color:#fff}
    button:hover{filter:brightness(.86)}button:focus-visible{outline:2px solid #fff;outline-offset:3px}
    @media(max-width:480px){.card{padding:16px}.actions{margin-left:0}}
  `;
  shadow.appendChild(style);
  const card = document.createElement('section');
  card.className = `card ${notice.kind}`;
  let role = notice.kind === 'error' ? 'alert' : 'status';
  if (prompt) role = 'dialog';
  card.setAttribute('role', role);
  if (prompt) card.setAttribute('aria-label', notice.heading);
  card.setAttribute('aria-live', notice.kind === 'error' ? 'assertive' : 'polite');
  card.setAttribute('aria-atomic', 'true');
  const top = document.createElement('div');
  top.className = 'top';
  const brand = document.createElement('span');
  brand.className = 'brand';
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    const mask = document.createElement('img');
    mask.className = 'brand-mask';
    mask.src = chrome.runtime.getURL('icons/tsugi-mask-side.png');
    mask.alt = '';
    mask.width = 32;
    mask.height = 32;
    brand.appendChild(mask);
  }
  const brandName = document.createElement('span');
  brandName.textContent = 'Tsugi';
  brand.appendChild(brandName);
  const close = document.createElement('button');
  close.className = 'close';
  close.type = 'button';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Dismiss notification');
  top.appendChild(brand);
  top.appendChild(close);
  const body = document.createElement('div');
  body.className = 'body';
  const icon = document.createElement('span');
  icon.className = 'icon';
  icon.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const paths = {
    success: 'M5 12l4 4L19 6',
    pending: 'M12 5v7l4 2',
    tracking: 'M9 5l10 7-10 7V5',
    resume: 'M9 5l10 7-10 7V5',
    confirm: 'M9 5l10 7-10 7V5',
    error: 'M12 5v9m0 4h.01',
  };
  path.setAttribute('d', paths[notice.kind]);
  svg.appendChild(path);
  icon.appendChild(svg);
  const copy = document.createElement('div');
  const heading = document.createElement('h2');
  heading.textContent = notice.heading;
  const title = document.createElement('p');
  title.className = 'title';
  title.textContent = notice.title;
  const detail = document.createElement('p');
  detail.className = 'detail';
  detail.textContent = notice.detail;
  copy.appendChild(heading);
  copy.appendChild(title);
  copy.appendChild(detail);
  body.appendChild(icon);
  body.appendChild(copy);
  card.appendChild(top);
  card.appendChild(body);
  if (notice.rating) {
    const label = document.createElement('label');
    label.className = 'rating';
    label.textContent = 'Your rating · optional';
    const select = document.createElement('select');
    notice.rating.options.forEach(option => {
      const item = document.createElement('option');
      item.value = option.value;
      item.textContent = option.label;
      select.appendChild(item);
    });
    select.value = notice.rating.value;
    select.addEventListener('change', () => notice.rating?.onChange(select.value));
    label.appendChild(select);
    card.appendChild(label);
  }
  if (notice.actions?.length) {
    const actions = document.createElement('div');
    actions.className = 'actions';
    notice.actions.forEach(action => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'action';
      button.textContent = action.label;
      button.addEventListener('click', () => {
        action.run();
        dismiss();
      });
      actions.appendChild(button);
    });
    card.appendChild(actions);
  }
  shadow.appendChild(card);
  document.documentElement.appendChild(host);
  if (fullscreen) {
    // A popover joins the top layer, including when the video itself is fullscreen.
    host.setAttribute('popover', 'manual');
    if (typeof host.showPopover === 'function') host.showPopover();
    else document.fullscreenElement?.appendChild(host);
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  let removed = false;
  const dismiss = () => {
    if (removed) return;
    removed = true;
    clearTimeout(timeout);
    document.removeEventListener('fullscreenchange', visibility);
    host.remove();
    if (dismissCurrent === dismiss) dismissCurrent = undefined;
    if (dismissPrompt === dismiss) dismissPrompt = undefined;
    if (dismissFullscreen === dismiss) dismissFullscreen = undefined;
    notice.onRemove?.();
  };
  const duration = notice.kind === 'success' ? 12000 : 7000;
  const schedule = () => {
    clearTimeout(timeout);
    if (notice.kind !== 'error' && notice.kind !== 'resume' && !prompt)
      timeout = setTimeout(dismiss, fullscreen ? 4500 : duration);
  };
  const visibility = () => {
    const hidden = !fullscreen && Boolean(document.fullscreenElement);
    if (fullscreen && !document.fullscreenElement) {
      dismiss();
      return;
    }
    host.style.display = hidden ? 'none' : 'block';
    clearTimeout(timeout);
    if (!hidden) schedule();
  };
  close.addEventListener('click', () => {
    dismiss();
    notice.onDismiss?.();
  });
  card.addEventListener('mouseenter', () => clearTimeout(timeout));
  card.addEventListener('mouseleave', schedule);
  card.addEventListener('focusin', () => clearTimeout(timeout));
  card.addEventListener('focusout', event => {
    if (!card.contains(event.relatedTarget as Node | null)) schedule();
  });
  document.addEventListener('fullscreenchange', visibility);
  if (prompt) dismissPrompt = dismiss;
  else if (fullscreen) dismissFullscreen = dismiss;
  else dismissCurrent = dismiss;
  visibility();
  return dismiss;
}

/** One decision at a time; replacing or navigating away cancels the old decision. */
export function confirmTrackingNotice(
  notice: Omit<TrackingNotice, 'kind' | 'actions' | 'onRemove'>,
  acceptLabel: string,
): Promise<boolean> {
  return new Promise(resolve => {
    showTrackingNotice({
      ...notice,
      kind: 'confirm',
      onRemove: () => resolve(false),
      actions: [
        { label: acceptLabel, run: () => resolve(true) },
        { label: 'Not now', run: () => resolve(false) },
      ],
    });
  });
}
