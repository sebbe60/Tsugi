import { PlayerSingleton, PlayerTime } from './player';
import { showTrackingNotice } from './trackingNotice';
import {
  PlaybackActivity,
  PendingWatchSync,
  PlaybackCheckpoint,
  playbackKey,
  playbackTime,
  SYNC_QUEUE_PREFIX,
} from './watchActivity';

type SessionMeta = Omit<PlaybackCheckpoint, 'position' | 'duration' | 'sessionId' | 'startedAt'>;
type State = 'tracking' | 'syncing' | 'pending' | 'synced' | 'blocked';

export class PlaybackSession {
  private host = document.createElement('div');
  private button = document.createElement('button');
  private tip = document.createElement('span');
  private rail = document.createElement('span');
  private state: State = 'tracking';
  private sessionId = crypto.randomUUID();
  private startedAt = Date.now();
  private latest: PlayerTime | undefined;
  private lastHeard = Date.now();
  private lastSaved = 0;
  private lastPosition = -1;
  private played = false;
  private stopped = false;
  private resumeApplied = false;
  private timer: ReturnType<typeof setInterval>;
  private requestedResume: number | null;
  private reason = '';

  constructor(
    private meta: SessionMeta,
    private syncNow: () => void,
  ) {
    const requested = new URL(window.location.href).searchParams.get('tsugi_resume');
    this.requestedResume =
      requested !== null && Number.isFinite(Number(requested)) && Number(requested) >= 0
        ? Number(requested)
        : null;
    // Old isolated-world scripts stop on extension reload; their DOM can remain.
    document.getElementById('tsugi-quiet-tracker')?.remove();
    document.getElementById('tsugi-tracking-notice')?.remove();
    this.host.id = 'tsugi-quiet-tracker';
    this.host.style.cssText =
      'all:initial;position:fixed;z-index:2147483646;display:none;color-scheme:dark;';
    const shadow = this.host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      .anchor{position:relative;font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:white}
      button{display:grid;place-items:center;position:relative;padding:5px;width:36px;height:36px;border:1px solid #ffffff36;border-radius:11px;background:#080808db;cursor:pointer}
      button:focus-visible{outline:2px solid white;outline-offset:3px}img{display:block;width:26px;height:26px;object-fit:contain}
      .dot{position:absolute;right:2px;bottom:2px;width:7px;height:7px;background:#52d990;border:2px solid #080808;border-radius:50%}
      .pending .dot,.syncing .dot{background:#e9bd69}.stale .dot,.blocked .dot{background:#f18d8d}
      .tip{display:none;position:absolute;right:0;top:44px;width:254px;max-width:calc(100vw - 40px);padding:12px 14px;box-sizing:border-box;border:1px solid #424242;border-radius:10px;background:#080808;color:#fff;box-shadow:0 6px 24px #0005;white-space:normal}
      .anchor:hover .tip,.anchor:focus-within .tip{display:block}
      .track{display:block;height:3px;background:#333;border-radius:3px;margin-top:9px;overflow:hidden}.fill{display:block;height:100%;background:#fff;width:0}
    `;
    shadow.appendChild(style);
    const anchor = document.createElement('span');
    anchor.className = 'anchor';
    this.button.type = 'button';
    this.button.setAttribute('aria-describedby', 'tsugi-tracker-tip');
    const mask = document.createElement('img');
    mask.src = chrome.runtime.getURL('icons/tsugi-mask-side.png');
    mask.alt = '';
    const dot = document.createElement('span');
    dot.className = 'dot';
    this.button.appendChild(mask);
    this.button.appendChild(dot);
    this.tip.className = 'tip';
    this.tip.id = 'tsugi-tracker-tip';
    this.tip.setAttribute('role', 'tooltip');
    const track = document.createElement('span');
    track.className = 'track';
    this.rail.className = 'fill';
    track.appendChild(this.rail);
    anchor.appendChild(this.button);
    anchor.appendChild(this.tip);
    anchor.appendChild(track);
    shadow.appendChild(anchor);
    document.documentElement.appendChild(this.host);
    this.button.addEventListener('click', () => {
      showTrackingNotice({
        kind: this.noticeKind(),
        heading: this.label(),
        title: this.meta.title,
        detail:
          this.state === 'synced'
            ? 'Confirmed by your list service.'
            : this.reason || 'Playback is saved here so you can resume from History.',
        actions:
          this.state === 'synced' || this.state === 'blocked'
            ? []
            : [{ label: this.state === 'pending' ? 'Retry sync' : 'Sync now', run: this.syncNow }],
      });
    });
    PlayerSingleton.getInstance()
      .startTracking()
      .addListener('TsugiPlayback', item => this.observe(item));
    chrome.storage.onChanged.addListener(this.changed);
    window.addEventListener('pagehide', this.flush);
    window.addEventListener('online', this.online);
    this.timer = setInterval(() => this.render(), 2000);
    this.render();
    chrome.storage.local
      .get(playbackKey(meta))
      .then(store => {
        const activity = store[playbackKey(meta)] as PlaybackActivity | undefined;
        if (activity?.syncState === 'pending') this.setState('pending');
      })
      .catch(() => {});
  }

  private observe(item: PlayerTime) {
    if (
      this.stopped ||
      !Number.isFinite(item.duration) ||
      item.duration <= 60 ||
      !Number.isFinite(item.current)
    )
      return;
    this.latest = item;
    this.lastHeard = Date.now();
    if (!item.paused) this.played = true;
    if (
      this.requestedResume !== null &&
      !this.resumeApplied &&
      PlayerSingleton.getInstance().canSetTime()
    ) {
      this.resumeApplied = true;
      PlayerSingleton.getInstance()
        .setTime(Math.min(this.requestedResume, item.duration - 3))
        .catch(() => {
          this.resumeApplied = false;
        });
    }
    if (
      this.played &&
      item.current >= 5 &&
      Math.abs(item.current - this.lastPosition) >= 1 &&
      (Date.now() - this.lastSaved >= 5000 || item.paused || item.ended)
    )
      this.flush();
    this.render();
  }

  private flush = () => {
    const item = this.latest;
    if (
      !item ||
      !this.played ||
      item.current < 5 ||
      (this.lastSaved > 0 && Math.abs(item.current - this.lastPosition) < 1)
    )
      return;
    this.lastSaved = Date.now();
    this.lastPosition = item.current;
    chrome.runtime
      .sendMessage({
        name: 'playbackCheckpoint',
        entry: {
          ...this.meta,
          sessionId: this.sessionId,
          startedAt: this.startedAt,
          position: Math.min(item.current, item.duration),
          duration: item.duration,
        },
      })
      .catch(() => {});
  };

  private online = () => {
    chrome.runtime.sendMessage({ name: 'retryWatchSyncs' }).catch(() => {});
  };

  private changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local') return;
    const activity = changes[playbackKey(this.meta)]?.newValue as PlaybackActivity | undefined;
    if (activity?.sessionId === this.sessionId && activity.syncState === 'synced')
      this.setState('synced');
    if (
      activity?.sessionId === this.sessionId &&
      activity.syncState === 'partial' &&
      this.state === 'pending'
    )
      this.setState('tracking');
    Object.entries(changes)
      .filter(([key]) => key.startsWith(SYNC_QUEUE_PREFIX))
      .forEach(([, change]) => {
        const item = change.newValue as PendingWatchSync | undefined;
        if (
          item?.entry.mediaKey === this.meta.mediaKey &&
          item.entry.toEpisode === this.meta.episode &&
          item.entry.rewatchCount === this.meta.rewatchCount
        ) {
          this.reason = item.reason;
          let next: State = 'pending';
          if (item.state === 'blocked') next = 'blocked';
          else if (item.state === 'sending') next = 'syncing';
          this.setState(next);
        }
      });
  };

  private noticeKind(): 'tracking' | 'pending' | 'success' {
    if (this.state === 'synced') return 'success';
    if (this.state === 'pending' || this.state === 'blocked') return 'pending';
    return 'tracking';
  }

  setState(state: State) {
    const recovered = state === 'synced' && (this.state === 'pending' || this.state === 'blocked');
    this.state = state;
    if (state === 'synced') this.reason = '';
    this.render();
    if (recovered)
      showTrackingNotice({
        kind: 'success',
        heading: `Episode ${this.meta.episode} synced`,
        title: this.meta.title,
        detail: 'The saved update has now been confirmed by your list service.',
      });
  }

  private label() {
    if (this.state === 'pending') return `Episode ${this.meta.episode} · waiting to sync`;
    if (this.state === 'blocked') return `Episode ${this.meta.episode} · sync needs attention`;
    if (this.state === 'synced') return `Episode ${this.meta.episode} synced`;
    if (this.state === 'syncing') return `Syncing episode ${this.meta.episode}…`;
    if (Date.now() - this.lastHeard > 18000) return 'Tracking disconnected · check the player';
    if (!this.latest) return 'Waiting for the player';
    return `Tracking episode ${this.meta.episode} · ${Math.floor((this.latest.current / this.latest.duration) * 100)}% watched${this.latest.paused ? ' · paused' : ''}`;
  }

  private render() {
    const candidates = [
      ...Array.from(document.querySelectorAll('video')),
      ...Array.from(document.querySelectorAll('iframe')),
    ]
      .map(el => el.getBoundingClientRect())
      .filter(r => r.width > 180 && r.height > 100)
      .sort((a, b) => b.width * b.height - a.width * a.height);
    const rect = candidates[0];
    const hidden =
      this.stopped ||
      document.fullscreenElement ||
      document.querySelector('#tsugi-tracking-notice, #tsugi-tracking-prompt') ||
      !rect ||
      rect.bottom <= 0 ||
      rect.top >= window.innerHeight;
    this.host.style.display = hidden ? 'none' : 'block';
    if (rect) {
      this.host.style.left = `${Math.max(8, Math.min(window.innerWidth - 44, rect.right - 48))}px`;
      this.host.style.top = `${Math.max(8, rect.top + 12)}px`;
    }
    const label = this.label();
    this.button.setAttribute('aria-label', `${label}. Open tracking actions.`);
    this.button.className = `${this.state} ${this.state === 'tracking' && Date.now() - this.lastHeard > 18000 ? 'stale' : ''}`;
    this.tip.textContent = this.latest
      ? `${label} · ${playbackTime(this.latest.current)} / ${playbackTime(this.latest.duration)}`
      : label;
    this.rail.style.width = `${this.latest ? Math.min(100, (this.latest.current / this.latest.duration) * 100) : 0}%`;
  }

  stop() {
    this.flush();
    this.stopped = true;
    clearInterval(this.timer);
    PlayerSingleton.getInstance().removeListener('TsugiPlayback');
    chrome.storage.onChanged.removeListener(this.changed);
    window.removeEventListener('pagehide', this.flush);
    window.removeEventListener('online', this.online);
    this.host.remove();
  }
}
