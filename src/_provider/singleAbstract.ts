import * as definitions from './definitions';
import { confirmTrackingNotice } from '../utils/trackingNotice';

import { ProgressRelease } from '../utils/progressRelease';
import { predictionXhrGET, ProgressItem } from '../background/releaseProgressUtils';

import { emitter, globalEmit } from '../utils/emitter';
import { SafeError } from '../utils/errors';
import { returnYYYYMMDD } from '../utils/general';
import { buildProviderUrl } from '../utils/slugs';
import { errorMessage as _errorMessage } from './Errors';
import { point10 } from './ScoreMode/point10';
import { SyncTypes } from './helper';
import { Progress } from '../utils/progress';

Object.seal(emitter);

export abstract class SingleAbstract {
  constructor(protected url: string) {
    this.handleUrl(url);
    this.logger = con.m('[S]', '#348fff');
    return this;
  }

  protected logger;

  protected type: definitions.contentType | null = null;

  protected syncMethod: definitions.syncMethod = 'normal';

  protected persistenceState?: ReturnType<SingleAbstract['getStateEl']>;

  protected undoState;

  private historyEpisode: number | undefined;

  protected lastError;

  protected askCompleted = false;

  public abstract shortName: string;

  protected abstract authenticationUrl: string;

  protected rewatchingSupport = true;

  protected consideringSupport = false;

  protected datesSupport = true;

  protected ids = {
    mal: NaN,
    ani: NaN,
    kitsu: {
      id: NaN,
      slug: '',
    },
    simkl: NaN,
    baka: NaN,
  };

  protected options: {
    u: string;
    c: any;
    r: any;
    p: any;
  } | null = null;

  protected abstract handleUrl(url: string);

  public getType() {
    return this.type;
  }

  public getUrl() {
    return this.url;
  }

  public supportsRewatching() {
    return this.rewatchingSupport;
  }

  public supportsConsidering() {
    return this.consideringSupport;
  }

  public supportsDates() {
    return this.datesSupport;
  }

  public abstract getCacheKey();

  public abstract getPageId();

  public getApiCacheKey(): string | number {
    return this.getKey(['ANILIST']);
  }

  public getRulesCacheKey(): string | number {
    return this.getKey(['ANILIST', 'KITSU'], false);
  }

  abstract _setStatus(status: definitions.status): void;

  public setStatus(status: definitions.status): SingleAbstract {
    status = Number(status);
    this._setStatus(status);
    return this;
  }

  abstract _getStatus(): definitions.status | number;

  public getStatus(): definitions.status {
    if (!this.isOnList()) return definitions.status.NoState;
    return this._getStatus();
  }

  abstract _setStartDate(startDate: definitions.startFinishDate): void;

  public setStartDate(startDate: definitions.startFinishDate): SingleAbstract {
    if (this.supportsDates()) {
      this._setStartDate(startDate);
    }
    return this;
  }

  abstract _getStartDate(): definitions.startFinishDate;

  public getStartDate(): definitions.startFinishDate {
    if (this.supportsDates()) {
      return this._getStartDate();
    }
    return null;
  }

  abstract _setFinishDate(finishDate: definitions.startFinishDate): void;

  public setFinishDate(finishDate: definitions.startFinishDate): SingleAbstract {
    if (this.supportsDates()) {
      this._setFinishDate(finishDate);
    }
    return this;
  }

  abstract _getFinishDate(): definitions.startFinishDate;

  public getFinishDate(): definitions.startFinishDate {
    if (this.supportsDates()) {
      return this._getFinishDate();
    }
    return null;
  }

  abstract _setRewatchCount(rewatchCount: definitions.rewatchCount): void;

  public setRewatchCount(rewatchCount: definitions.rewatchCount): SingleAbstract {
    if (this.supportsRewatching()) {
      this._setRewatchCount(rewatchCount);
    }
    return this;
  }

  abstract _getRewatchCount(): definitions.rewatchCount | null;

  public getRewatchCount(): definitions.rewatchCount | null {
    if (this.supportsRewatching()) {
      return this._getRewatchCount();
    }
    return null;
  }

  public getScoreMode() {
    return point10;
  }

  abstract _setScore(score: definitions.score): void;

  /**
   * @deprecated Use setAbsoluteScore instead
   */
  public setScore(score: definitions.score): SingleAbstract {
    score = parseInt(`${score}`);
    if (!score) score = 0;
    this._setScore(score);
    return this;
  }

  abstract _getScore(): definitions.score;

  /**
   * @deprecated Use getAbsoluteScore instead
   */
  public getScore(): definitions.score {
    const score = this._getScore();
    if (!score) return 0;
    return score;
  }

  abstract _setAbsoluteScore(score: definitions.score100): void;

  public setAbsoluteScore(score: definitions.score100): SingleAbstract {
    score = parseInt(`${score}`);
    this._setAbsoluteScore(score);
    return this;
  }

  abstract _getAbsoluteScore(): definitions.score100;

  public getAbsoluteScore(): definitions.score100 {
    const score = this._getAbsoluteScore();
    if (!score) return 0;
    return score;
  }

  abstract _setEpisode(episode: number): void;

  public setEpisode(episode: number): SingleAbstract {
    episode = parseInt(`${episode}`);
    if (this.getTotalEpisodes() && episode > this.getTotalEpisodes() && this.finishedAiring())
      episode = this.getTotalEpisodes();
    this._setEpisode(episode);
    return this;
  }

  abstract _getEpisode(): number;

  public getEpisode(): number {
    return this._getEpisode();
  }

  abstract _setVolume(volume: number): void;

  public setVolume(volume: number): SingleAbstract {
    this._setVolume(volume);
    return this;
  }

  abstract _getVolume(): number;

  public getVolume(): number {
    return this._getVolume();
  }

  abstract _setTags(tags: string): void;

  abstract _getTags(): string;

  public setStreamingUrl(streamingUrl: string): SingleAbstract {
    if (this.options) {
      this.options.u = streamingUrl;
    }
    return this;
  }

  public getStreamingUrl(): string | undefined {
    if (this.options && this.options.u) {
      return this.options.u;
    }

    return undefined;
  }

  public cleanTags() {
    this.options = null;
  }

  protected progress?: ProgressRelease;

  protected progressXhr?: ProgressItem[];

  public async initProgress() {
    const xhr = await predictionXhrGET(this.getType()!, this.getApiCacheKey());
    return new ProgressRelease(this.getCacheKey(), this.getType()!)
      .init({
        uid: this.getCacheKey(),
        apiCacheKey: this.getApiCacheKey(),
        title: this.getTitle(),
        cacheKey: this.getCacheKey(),
        progressMode: this.getProgressMode(),
        watchedEp: this.getEpisode(),
        single: this,
        xhr,
      })
      .then(progress => {
        this.updateProgress = false;
        this.progress = progress;
        this.progressXhr = xhr;
      });
  }

  public getProgress() {
    if (!this.progress) return null;
    return this.progress;
  }

  public getProgressFormatted() {
    if (!this.progressXhr || !this.progressXhr.length) return [];
    return this.progressXhr.map(el => new Progress(el, this.getType()!));
  }

  public getProgressOptions() {
    return this.getProgressFormatted().filter(el => el.getState() !== 'complete');
  }

  public getProgressCompleted() {
    return this.getProgressFormatted().filter(el => el.getState() === 'complete');
  }

  private updateProgress = false;

  public getProgressMode(): string {
    if (this.options && this.options.p) {
      return this.options.p;
    }

    return '';
  }

  public setProgressMode(mode: string): void {
    if (this.options) {
      this.options.p = mode;
      this.updateProgress = true;
    }
    if (!api.settings.get('malTags')) {
      utils
        .setEntrySettings(this.type, this.getCacheKey(), this.options, this._getTags())
        .then(() => this.initProgress());
    }
  }

  public getProgressKey() {
    let mode = this.getProgressMode();

    if (!mode) {
      if (this.getType() === 'anime') {
        mode = api.settings.get('progressIntervalDefaultAnime');
      } else {
        mode = api.settings.get('progressIntervalDefaultManga');
      }
    }

    if (!mode) return null;

    const res = /^([^/]*)\/(.*)$/.exec(mode);

    if (!res) return null;

    return {
      key: mode,
      lang: res[1],
      type: res[2],
    };
  }

  public getPageRelations(): { name: string; icon: string; link: string }[] {
    const name = this.shortName;
    const res: { name: string; icon: string; link: string }[] = [];

    if (this.ids.mal && name !== 'MAL') {
      res.push({
        name: 'MAL',
        icon: 'https://cdn.myanimelist.net/images/favicon.ico',
        link: buildProviderUrl('MAL', this.type!, this.ids.mal),
      });
    }

    if (this.ids.ani && name !== 'AniList') {
      res.push({
        name: 'AniList',
        icon: 'https://anilist.co/img/icons/favicon-32x32.png',
        link: buildProviderUrl('ANILIST', this.type!, this.ids.ani),
      });
    }

    if (this.ids.kitsu.id && name !== 'Kitsu') {
      res.push({
        name: 'Kitsu',
        icon: 'https://kitsu.app/favicon-32x32-3e0ecb6fc5a6ae681e65dcbc2bdf1f17.png',
        link: buildProviderUrl('KITSU', this.type!, this.ids.kitsu.id),
      });
    }

    if (this.ids.simkl && name !== 'Simkl') {
      res.push({
        name: 'Simkl',
        icon: 'https://eu.simkl.in/img_favicon/v2/favicon-32x32.png',
        link: buildProviderUrl('SIMKL', this.type!, this.ids.simkl),
      });
    }

    return res;
  }

  public fillRelations(): Promise<void> {
    return Promise.resolve();
  }

  abstract _update(): Promise<void>;

  public update(): Promise<void> {
    this.logger.log('[SINGLE]', 'Update info', this.ids);
    this.lastError = null;
    return this._update()
      .catch(e => {
        this.lastError = e;
        throw e;
      })
      .then(() => {
        this.persistenceState = this.getStateEl();
        this.historyEpisode = this.getEpisode();

        return utils.getEntrySettings(this.type, this.getCacheKey(), this._getTags());
      })
      .then(options => {
        this.options = options;
        this.registerEvent();
        this.emitUpdate('state');
      });
  }

  abstract _sync(): Promise<void>;

  public getHistoryStartEpisode(): number | undefined {
    if (
      this.persistenceState?.status === definitions.status.Completed &&
      this.getStatus() === definitions.status.Rewatching &&
      this.getEpisode() === 1
    )
      return 0;
    return this.historyEpisode ?? this.persistenceState?.episode;
  }

  public async sync(): Promise<void> {
    this.logger.log('[SINGLE]', 'Sync', this.ids);
    this.lastError = null;
    this._setTags(
      await utils.setEntrySettings(this.type, this.getCacheKey(), this.options, this._getTags()),
    );
    this.fixDates();
    const previousEpisode = this.historyEpisode ?? this.persistenceState?.episode;
    const previousStatus = this.persistenceState?.status;
    return this._sync()
      .catch(e => {
        this.lastError = e;
        throw e;
      })
      .then(async () => {
        const episode = this.getEpisode();
        const fromEpisode =
          previousStatus === definitions.status.Completed &&
          this.getStatus() === definitions.status.Rewatching &&
          episode === 1
            ? 0
            : previousEpisode;
        this.historyEpisode = episode;
        if (
          api.type === 'webextension' &&
          this.type === 'anime' &&
          this.getSyncMethod() !== 'listSync' &&
          fromEpisode !== undefined &&
          episode > fromEpisode
        ) {
          try {
            const result = await chrome.runtime.sendMessage({
              name: 'watchHistory',
              entry: {
                mediaKey: `anime/${this.getCacheKey()}`,
                title: this.getTitle(),
                url: this.getUrl(),
                image: this.getImage(),
                fromEpisode,
                toEpisode: episode,
                rewatchCount: this.getRewatchCount() || 0,
              },
            });
            if (result?.error) con.error('Episode synced, but local history could not be saved');
          } catch (error) {
            con.error('Could not save watch history', error);
          }
        }
        this.undoState = this.persistenceState;
        if (this.updateProgress) this.initProgress();
        this._onList = true;
        this.emitUpdate();
      });
  }

  public emitUpdate(action: 'update' | 'state' = 'update') {
    globalEmit(`${action}.${this.getCacheKey()}`, {
      id: this.getPageId(),
      type: this.getType(),
      cacheKey: this.getCacheKey(),
      state: this.getStateEl(),
      meta: {
        title: this.getTitle(),
        image: this.getImage(),
        malId: this.getMalId(),
        totalEp: this.getTotalEpisodes(),
        url: this.getUrl(),
      },
    });
  }

  abstract _delete(): Promise<void>;

  public async delete(): Promise<void> {
    return this._delete().then(() => {
      this._onList = false;
      globalEmit(`delete.${this.getCacheKey()}`, {
        id: this.getPageId(),
        type: this.getType(),
        cacheKey: this.getCacheKey(),
      });
    });
  }

  protected globalUpdateEvent;

  public destroy() {
    this.globalUpdateEvent?.off();
  }

  protected registerEvent() {
    if (!this.globalUpdateEvent) {
      this.globalUpdateEvent = emitter.on(
        `update.${this.getCacheKey()}`,
        data => this.updateEvent(data),
        { objectify: true },
      );
    }
  }

  protected updateEvent(data) {
    if (this.isDirty()) {
      this.logger.log('Ignore event');
      return;
    }

    if (data && data.state) {
      this.setStateEl(data.state);
      this.persistenceState = this.getStateEl();
      emitter.emit('syncPage_fillUi');
    }
  }

  public isDirty(): boolean {
    return (
      JSON.stringify(this.persistenceState) !== JSON.stringify(this.getStateEl()) ||
      this.updateProgress
    );
  }

  public isValueDirty(key: keyof ReturnType<SingleAbstract['getStateEl']>): boolean {
    if (!this._onList) {
      return true;
    }
    if (this.persistenceState) {
      return this.persistenceState[key] !== this.getStateEl()[key];
    }
    return false;
  }

  public undo(): Promise<void> {
    this.logger.log('[SINGLE]', 'Undo', this.undoState);
    if (!this.undoState) throw new SafeError('No undo state found');
    if (!this.undoState.onList) {
      // @ts-ignore
      if (typeof this.delete === 'undefined') throw new Error('Deleting an entry is not supported');
      // @ts-ignore
      return this.delete().then(() => {
        this.setStateEl(this.undoState);
        this.undoState = null;
      });
    }
    this.setStateEl(this.undoState);
    return this.sync().then(() => {
      this.undoState = null;
    });
  }

  abstract _getTitle(raw: boolean): string;

  public getTitle(raw = false) {
    return this._getTitle(raw);
  }

  abstract _getTotalEpisodes(): number;

  public getTotalEpisodes() {
    let eps = this._getTotalEpisodes();
    if (!eps) eps = 0;
    return eps;
  }

  abstract _getTotalVolumes(): number;

  public getTotalVolumes() {
    return this._getTotalVolumes();
  }

  protected _onList = false;

  public isOnList() {
    return this._onList;
  }

  protected _authenticated = false;

  public isAuthenticated() {
    return this._authenticated;
  }

  abstract _getDisplayUrl(): string;

  public getDisplayUrl(): string {
    return this._getDisplayUrl();
  }

  public getMalUrl(): string | null {
    if (!Number.isNaN(this.ids.mal)) {
      return buildProviderUrl('MAL', this.getType()!, this.ids.mal);
    }
    return null;
  }

  public getMalId(): number | null {
    if (!Number.isNaN(this.ids.mal)) {
      return this.ids.mal;
    }
    return null;
  }

  public getIds() {
    return this.ids;
  }

  abstract _getImage(): string;

  public getImage(): string {
    return this._getImage();
  }

  public setImage?(url: string): void;

  abstract _getRating(): Promise<string>;

  public getRating(): Promise<string> {
    return this._getRating().then(rating => {
      if (!rating) return 'N/A';
      return rating;
    });
  }

  public setResumeWatching(url: string, ep: number) {
    return utils.setResumeWaching(url, ep, this.type, this.getCacheKey());
  }

  public getResumeWatching(): { url: string; ep: number } | null {
    if (this.options && this.options.r) return this.options.r;
    return null;
  }

  public setContinueWatching(url: string, ep: number) {
    return utils.setContinueWaching(url, ep, this.type, this.getCacheKey());
  }

  public getContinueWatching(): { url: string; ep: number } | null {
    if (this.options && this.options.c) return this.options.c;
    return null;
  }

  public increaseRewatchCount(): void {
    //  do nothing
  }

  public finishedAiring(): boolean {
    return true;
  }

  getStateEl() {
    return {
      onList: this.isOnList(),
      episode: this.getEpisode(),
      volume: this.getVolume(),
      status: this.getStatus(),
      startDate: this.getStartDate(),
      finishDate: this.getFinishDate(),
      rewatchCount: this.getRewatchCount(),
      score: this.getScore(),
      absoluteScore: this.getAbsoluteScore(),
      tags: this._getTags(),
    };
  }

  setStateEl(state) {
    this._onList = state.onList;
    this.setEpisode(state.episode);
    this.setVolume(state.volume);
    this.setStatus(state.status);
    this.setStartDate(state.startDate);
    this.setFinishDate(state.finishDate);
    this.setRewatchCount(state.rewatchCount);
    this.setScore(state.score);
    if (state.absoluteScore) this.setAbsoluteScore(state.absoluteScore);
  }

  getStateDiff() {
    const persistance = this.getStateEl();
    if (persistance && this.undoState) {
      const diff: any = {};
      for (const key in persistance) {
        if (persistance[key] !== this.undoState[key]) {
          diff[key] = persistance[key];
        }
      }
      return diff;
    }
    return undefined;
  }

  public getSyncMethod(): definitions.syncMethod {
    return this.syncMethod;
  }

  public setSyncMethod(method: definitions.syncMethod) {
    this.syncMethod = method;
  }

  private fixDates() {
    if (!this.supportsDates() || this.getSyncMethod() === 'listSync') {
      return;
    }

    const today = returnYYYYMMDD();
    if (
      this.getStartDate() === null &&
      this._getStatus() === definitions.status.Watching &&
      this._getEpisode() > 0
    ) {
      this.setStartDate(today);
    }

    if (this.getFinishDate() === null && this._getStatus() === definitions.status.Completed) {
      this.setFinishDate(today);

      if (this.getStartDate() === null) {
        this.setStartDate(today);
      }
    }
  }

  public async lifeCycleHook(state: 'afterCheckSync' | 'beforeSync') {
    if (this.askCompleted) {
      if (
        (state === 'afterCheckSync' &&
          this.getType() !== 'anime' &&
          api.settings.get('askBefore')) ||
        (state === 'beforeSync' && (this.getType() === 'anime' || !api.settings.get('askBefore')))
      ) {
        this.askCompleted = false;
        if (this.getStatus() === definitions.status.Rewatching) {
          await this.finishRewatchingMessage();
        } else {
          await this.finishWatchingMessage();
        }
      }
    }
  }

  public async checkSync(episode: number, volume?: number): Promise<boolean> {
    const curEpisode = this.getEpisode();
    const curStatus = this.getStatus();
    const curVolume = this.getVolume();

    if (curStatus === definitions.status.Completed) {
      if (episode === 1) {
        return this.startRewatchingMessage();
      }
      return false;
    }

    if (
      curEpisode >= episode &&
      // Novel Volume
      !(
        typeof volume !== 'undefined' &&
        (curVolume || volume > 1 || !episode) &&
        volume > curVolume
      )
    ) {
      return false;
    }

    if (episode && episode === this.getTotalEpisodes() && this.finishedAiring()) {
      this.askCompleted = true;
      return true;
    }

    if (curStatus !== definitions.status.Watching && curStatus !== definitions.status.Rewatching) {
      return this.startWatchingMessage();
    }

    return true;
  }

  public async startWatchingMessage() {
    const accepted = await confirmTrackingNotice(
      {
        heading: this.getType() === 'anime' ? 'Start watching?' : 'Start reading?',
        title: this.getTitle(),
        detail: 'Tsugi will track your progress and update your list as you watch or read.',
      },
      'Start tracking',
    );
    if (accepted) {
      this.setStatus(definitions.status.Watching);
      this.setStartDate(returnYYYYMMDD());
    }
    return accepted;
  }

  public async finishWatchingMessage(): Promise<boolean> {
    let score = String(this.getScoreCheckboxValue());
    const accepted = await confirmTrackingNotice(
      {
        heading: 'Mark as completed?',
        title: this.getTitle(),
        detail: 'Your progress is ready to sync. Add a rating now, or leave it for later.',
        rating: {
          value: score,
          options: this.getScoreCheckbox().map(option => ({
            ...option,
            value: String(option.value),
          })),
          onChange: value => {
            score = value;
          },
        },
      },
      'Complete & sync',
    );
    if (accepted) {
      this.setStatus(definitions.status.Completed);
      this.setFinishDate(returnYYYYMMDD());
      if (!this.getStartDate()) this.setStartDate(returnYYYYMMDD());
      if (Number(score) > 0) this.handleScoreCheckbox(score);
    } else if (
      this.getStatus() !== definitions.status.Watching &&
      this.getStatus() !== definitions.status.Rewatching
    ) {
      // Declining completion still keeps the observed progress in Watching.
      this.setStatus(definitions.status.Watching);
      if (!this.getStartDate()) this.setStartDate(returnYYYYMMDD());
    }
    return accepted;
  }

  public async startRewatchingMessage(): Promise<boolean> {
    const accepted = await confirmTrackingNotice(
      {
        heading: this.getType() === 'anime' ? 'Watch it again?' : 'Read it again?',
        title: this.getTitle(),
        detail: 'Start a new run while keeping your previous completion.',
      },
      'Start tracking again',
    );
    if (accepted) this.setStatus(definitions.status.Rewatching);
    return accepted;
  }

  public async finishRewatchingMessage(): Promise<boolean> {
    const accepted = await confirmTrackingNotice(
      {
        heading: 'Finish this rewatch?',
        title: this.getTitle(),
        detail: 'Sync your progress and add this run to your rewatch count.',
      },
      'Complete & sync',
    );
    if (accepted) {
      this.setStatus(definitions.status.Completed);
      this.increaseRewatchCount();
    }
    return accepted;
  }

  public getScoreCheckbox() {
    return this.getScoreMode().getOptions();
  }

  public getScoreCheckboxValue() {
    return this.getScoreMode().valueToOptionValue(this.getAbsoluteScore());
  }

  public handleScoreCheckbox(value) {
    this.setAbsoluteScore(this.getScoreMode().optionValueToValue(value));
  }

  public getDisplayScoreCheckbox() {
    const curScore = this.getScoreCheckboxValue();
    const labelEl = this.getScoreCheckbox().filter(el => el.value === curScore);
    if (labelEl.length) return labelEl[0].label;
    return '';
  }

  public getStatusCheckbox() {
    const statusEs = [
      {
        value: definitions.status.Watching.toString(),
        label: api.storage.lang(`UI_Status_watching_${this.getType()}`),
      },
      {
        value: definitions.status.Completed.toString(),
        label: api.storage.lang('UI_Status_Completed'),
      },
      { value: definitions.status.Onhold.toString(), label: api.storage.lang('UI_Status_OnHold') },
      {
        value: definitions.status.Dropped.toString(),
        label: api.storage.lang('UI_Status_Dropped'),
      },
      {
        value: definitions.status.PlanToWatch.toString(),
        label: api.storage.lang(`UI_Status_planTo_${this.getType()}`),
      },
    ];

    if (this.supportsRewatching()) {
      statusEs.push({
        value: definitions.status.Rewatching.toString(),
        label: api.storage.lang(`UI_Status_Rewatching_${this.getType()}`),
      });
    }
    if (this.supportsConsidering()) {
      statusEs.push({
        value: definitions.status.Considering.toString(),
        label: api.storage.lang('UI_Status_Considering'),
      });
    }

    return statusEs;
  }

  public handleStatusCheckbox(value) {
    this.setStatus(value);
  }

  public getStatusCheckboxValue() {
    return this.getStatus();
  }

  public getKey(allowed: SyncTypes[], forceMal = true) {
    if (forceMal && this.ids.mal) return this.ids.mal;
    if (this.ids.ani && allowed.includes('ANILIST')) return `anilist:${this.ids.ani}`;
    if (this.ids.kitsu.id && allowed.includes('KITSU')) return `kitsu:${this.ids.kitsu.id}`;
    if (this.ids.simkl && allowed.includes('SIMKL')) return `simkl:${this.ids.simkl}`;
    if (this.ids.baka && allowed.includes('MANGABAKA')) return `mangabaka:${this.ids.baka}`;
    return this.ids.mal;
  }

  public getLastError() {
    return this.lastError;
  }

  public getLastErrorMessage() {
    return this.errorMessage(this.getLastError());
  }

  flashmError(error) {
    utils.flashm(this.errorMessage(error), { error: true, type: 'error' });
  }

  errorMessage(error) {
    return _errorMessage(error, this.authenticationUrl);
  }
}
