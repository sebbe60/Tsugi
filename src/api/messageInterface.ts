export interface xhrI {
  name: 'xhr';
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string | { url: string; data?: any; headers?: any; retryRateLimit?: boolean };
}
export interface xhrResponseI {
  finalUrl: string;
  responseText: string;
  status: number;
}

export interface trackingHealthMessage {
  name: 'trackingHealth';
  item: import('../utils/player').PlayerTime;
}

export interface videoTime {
  name: 'videoTime';
  item: { current: number; duration: number; paused: boolean; ended?: boolean };
}

export interface content {
  name: 'content';
  item: any;
}

export interface videoTimeSet {
  name: 'videoTimeSet';
  time?: number;
  timeAdd?: boolean;
  sender?: chrome.runtime.MessageSender;
}

export interface iframeDone {
  name: 'iframeDone';
  id: string;
  epList: any;
  len?: number;
  error?: any;
}

export interface minimalWindow {
  name: 'minimalWindow';
  url?: string;
}

export interface notification {
  url: string;
  title: string;
  text: string;
  image?: string;
  sticky?: boolean;
}

export interface notificationMessage {
  name: 'notification';
  options: notification;
}

export interface databaseMessage {
  name: 'database';
  options: {
    call: string;
    param: object;
  };
}

export interface watchHistoryMessage {
  name: 'watchHistory';
  entry: import('../utils/watchHistory').WatchProgress;
}

export type watchActivityMessage =
  | { name: 'playbackCheckpoint'; entry: import('../utils/watchActivity').PlaybackCheckpoint }
  | { name: 'prepareWatchSync'; intent: import('../utils/watchActivity').SyncIntent }
  | { name: 'completeWatchSync' | 'failWatchSync' | 'cancelWatchSync'; id: string }
  | { name: 'retryWatchSyncs' };

export type sendMessageI =
  | watchActivityMessage
  | trackingHealthMessage
  | watchHistoryMessage
  | xhrI
  | iframeDone
  | videoTime
  | videoTimeSet
  | minimalWindow
  | content
  | notificationMessage
  | databaseMessage;

export type responseMessageI = xhrResponseI;
