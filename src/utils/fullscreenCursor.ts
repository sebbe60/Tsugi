const SCOPE = 'tsugi:cursor-fullscreen';
const STATUS = 'tsugi:cursor-playback';
const READY = 'tsugi:cursor-ready';
const ATTRIBUTE = 'data-tsugi-idle-cursor';

/** One controller per frame; frame messages carry playback/fullscreen state only. */
export function createFullscreenCursor(doc: Document, win: Window, idleMs = 2000) {
  let enabled = false;
  let inheritedFullscreen = false;
  let root: Element | null = null;
  let marked: Element | null = null;
  let canHide = false;
  let lastActivity = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let style: HTMLStyleElement | undefined;
  let reportedPlaying: boolean | undefined;
  let disposed = false;
  const childPlaying = new Map<MessageEventSource, boolean>();
  const childScope = new Map<Window, boolean>();
  const frames = () => Array.from(doc.querySelectorAll('iframe'));
  const inside = (element: Element) => !!root && (root === element || root.contains(element));
  const videos = () => Array.from(doc.querySelectorAll('video'));
  const playing = (video: HTMLVideoElement) => !video.paused && !video.ended;

  function clearTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }
  function show() {
    marked?.removeAttribute(ATTRIBUTE);
    marked = null;
  }
  function hide() {
    if (disposed || !enabled || !canHide || !root) return;
    if (!style?.isConnected) {
      style = doc.createElement('style');
      // Outrank player classes without changing their inline styles or saved cursor values.
      const scope = `[${ATTRIBUTE}][${ATTRIBUTE}][${ATTRIBUTE}]`;
      style.textContent = `${scope}, ${scope} * { cursor: none !important; }`;
      (doc.head || doc.documentElement).appendChild(style);
    }
    root.setAttribute(ATTRIBUTE, '');
    marked = root;
  }
  function arm() {
    clearTimer();
    if (canHide)
      timer = setTimeout(
        () => {
          timer = undefined;
          hide();
        },
        Math.max(0, idleMs - (Date.now() - lastActivity)),
      );
  }
  function activity() {
    if (!root) return;
    lastActivity = Date.now();
    show();
    arm();
  }
  // Mutation callbacks run after the controller has finished initializing.
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  const observer = new MutationObserver(() => update());
  function update() {
    if (disposed) return;
    const next = doc.fullscreenElement || (inheritedFullscreen ? doc.documentElement : null);
    if (next !== root) {
      show();
      root = next;
      lastActivity = Date.now();
      observer.disconnect();
      if (root) observer.observe(root, { childList: true, subtree: true });
    }
    const currentFrames = frames();
    const frameWindows = new Set(currentFrames.map(frame => frame.contentWindow).filter(Boolean));
    childScope.forEach((_, child) => {
      if (!frameWindows.has(child)) childScope.delete(child);
    });
    childPlaying.forEach((_, child) => {
      if (!currentFrames.some(frame => frame.contentWindow === child)) childPlaying.delete(child);
    });
    const allPlaying =
      videos().some(playing) ||
      currentFrames.some(frame => !!frame.contentWindow && childPlaying.get(frame.contentWindow));
    if (win.parent !== win && allPlaying !== reportedPlaying) {
      reportedPlaying = allPlaying;
      win.parent.postMessage({ type: STATUS, playing: allPlaying }, '*');
    }
    currentFrames.forEach(frame => {
      const child = frame.contentWindow;
      const fullscreen = inside(frame);
      if (child && childScope.get(child) !== fullscreen) {
        childScope.set(child, fullscreen);
        child.postMessage({ type: SCOPE, fullscreen }, '*');
      }
    });
    canHide =
      enabled &&
      !!root &&
      (videos().some(video => inside(video) && playing(video)) ||
        currentFrames.some(
          frame => inside(frame) && !!frame.contentWindow && childPlaying.get(frame.contentWindow),
        ));
    if (!canHide) {
      show();
      clearTimer();
    } else arm();
  }
  function message(event: MessageEvent) {
    if (
      event.source === win.parent &&
      win.parent !== win &&
      event.data?.type === SCOPE &&
      typeof event.data.fullscreen === 'boolean'
    ) {
      inheritedFullscreen = event.data.fullscreen;
      update();
    } else if ((event.data?.type === STATUS || event.data?.type === READY) && event.source) {
      const frame = frames().find(value => value.contentWindow === event.source);
      if (!frame?.contentWindow) return;
      if (event.data.type === STATUS && typeof event.data.playing === 'boolean')
        childPlaying.set(event.source, event.data.playing);
      if (event.data.type === READY) childScope.delete(frame.contentWindow);
      update();
    }
  }
  const stateEvents = ['fullscreenchange', 'play', 'pause', 'ended', 'emptied', 'loadedmetadata'];
  const activityEvents = ['mousemove', 'pointerdown', 'keydown', 'focusin'];
  stateEvents.forEach(event => doc.addEventListener(event, update, true));
  activityEvents.forEach(event => doc.addEventListener(event, activity, true));
  win.addEventListener('message', message);
  if (win.parent !== win) win.parent.postMessage({ type: READY }, '*');
  update();
  return {
    setEnabled(value: boolean) {
      enabled = value;
      activity();
      update();
    },
    dispose() {
      disposed = true;
      clearTimer();
      show();
      style?.remove();
      observer.disconnect();
      stateEvents.forEach(event => doc.removeEventListener(event, update, true));
      activityEvents.forEach(event => doc.removeEventListener(event, activity, true));
      win.removeEventListener('message', message);
      if (win.parent !== win && reportedPlaying)
        win.parent.postMessage({ type: STATUS, playing: false }, '*');
    },
  };
}
