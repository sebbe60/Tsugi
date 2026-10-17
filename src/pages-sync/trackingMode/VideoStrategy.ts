import { qualifiesForTracking } from '../../utils/videoTracking';
import { isIframeUrl } from '../../utils/manifest';
import { hasMissingPermissions } from '../../utils/customDomains';
import { PlayerSingleton } from '../../utils/player';
import { ProgressElement, TrackingModeInterface } from './TrackingModeInterface';
import { videoStrategyErrorElement } from '../messageElements';

export class VideoStrategy implements TrackingModeInterface {
  trackingResolve: (() => void) | null = null;

  private qualified = false;

  private qualifiedAt = 0;

  async waitForTrackingAction() {
    await utils.wait(10 * 1000);
    if (this.qualified && Date.now() - this.qualifiedAt < 2000) return Promise.resolve();
    return new Promise<void>(resolve => {
      this.trackingResolve = resolve;
    });
  }

  listener: ((progress: ProgressElement) => void) | null = null;

  addListener(callback: (progress: ProgressElement) => void): void {
    this.listener = callback;
  }

  errorListener: ((error: HTMLElement | null) => void) | null = null;

  addErrorListener(callback: (error: HTMLElement | null) => void): void {
    this.errorListener = callback;
  }

  playerFoundTimeout: NodeJS.Timeout | null = null;

  start() {
    const syncDuration = Number(api.settings.get('videoDuration')) / 100;
    let playerFound = false;

    let discordTimeout;

    this.playerFoundTimeout = setTimeout(
      async () => {
        if (this.errorListener) {
          const errorDiv = videoStrategyErrorElement(await hasMissingPermissions());
          this.errorListener(errorDiv);

          const iframes = $('iframe')
            .toArray()
            .map(
              el => utils.absoluteLink($(el).attr('src'), window.location.origin) as string | null,
            )
            .filter(el => el)
            .filter(el => !isIframeUrl(el!));

          con.log('No Player found', iframes);
        }
      },
      5 * 60 * 1000,
    );
    PlayerSingleton.getInstance()
      .startTracking()
      .addListener('VideoStrategy', item => {
        const progress = item.current / item.duration;
        this.qualified = qualifiesForTracking(item, syncDuration);
        if (this.qualified) this.qualifiedAt = Date.now();
        if (api.type === 'webextension')
          chrome.runtime.sendMessage({ name: 'trackingHealth', item }).catch(() => {});
        if (this.trackingResolve && this.qualified) {
          this.trackingResolve();
          this.trackingResolve = null;
        }
        if (this.listener) {
          this.listener({
            progress,
            progressTrigger: syncDuration,
            current: item.current,
            total: item.duration,
          });
        }
        if (!playerFound) {
          playerFound = true;
          clearTimeout(this.playerFoundTimeout!);
          if (this.errorListener) {
            this.errorListener(null);
          }
        }
        this.discordState = { duration: item.duration, current: item.current, paused: item.paused };
        clearTimeout(discordTimeout);
        discordTimeout = setTimeout(() => {
          this.discordState = null;
        }, 15 * 1000);
      });
  }

  getResumeText(state: ProgressElement) {
    if (!state.current) return null;
    const minutes = Math.floor(state.current / 60);
    const sec = Math.floor(state.current - minutes * 60);
    return `${minutes}:${String(sec).padStart(2, '0')}`;
  }

  canResume(state: ProgressElement) {
    if (!state.current || state.current < 45) return false;
    return PlayerSingleton.getInstance().canSetTime();
  }

  resumeTo(state: ProgressElement) {
    if (!state.current) return Promise.resolve();
    return PlayerSingleton.getInstance().setTime(state.current);
  }

  protected discordState: { duration: number; current: number; paused: boolean } | null = null;

  getDiscordState() {
    return this.discordState;
  }

  stop() {
    PlayerSingleton.getInstance().removeListener('VideoStrategy');
    clearTimeout(this.playerFoundTimeout!);
  }

  flashOptions() {
    return {
      hoverInfo: true,
      error: false,
      type: 'update',
      minimized: true,
    };
  }
}
