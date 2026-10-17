import { PageInterface } from '../../pageInterface';

export const AniCult: PageInterface = {
  name: 'AniCult',
  domain: 'https://anicult.vercel.app',
  languages: ['English'],
  type: 'anime',
  urls: {
    match: ['*://anicult.vercel.app/*'],
    player: {
      megaplay: ['*://megaplay.buzz/*', '*://vidwish.live/*'],
      anixo: ['*://anixo.buzz/*'],
      megavid: ['*://megavid.buzz/*'],
    },
  },
  search: 'https://anicult.vercel.app/search?q={searchterm}',
  sync: {
    isSyncPage($c) {
      return $c.url().urlPart(3).equals('watch').run();
    },
    getTitle($c) {
      return $c.querySelector('.player-title').ifNotReturn().text().trim().run();
    },
    getIdentifier($c) {
      return $c.url().urlPart(4).run();
    },
    getEpisode($c) {
      return $c.url().urlPart(5).number().run();
    },
    getOverviewUrl($c) {
      return $c.querySelector('.player-title').getAttribute('href').urlAbsolute().run();
    },
    getMalUrl($c) {
      return $c.providerUrlUtility({ anilistId: $c.url().urlPart(4).number().run() }).run();
    },
  },
  overview: {
    isOverviewPage($c) {
      return $c.url().urlPart(3).equals('anime').run();
    },
    getTitle($c) {
      return $c.querySelector('.detail-hero-title').ifNotReturn().text().trim().run();
    },
    getIdentifier($c) {
      return $c.url().urlPart(4).run();
    },
    getImage($c) {
      return $c.querySelector('.detail-hero-cover img').getAttribute('src').ifNotReturn().run();
    },
    getMalUrl($c) {
      return $c.providerUrlUtility({ anilistId: $c.url().urlPart(4).number().run() }).run();
    },
    uiInjection($c) {
      return $c.querySelector('.detail-hero-actions').uiAfter().run();
    },
  },
  lifecycle: {
    setup($c) {
      return $c.addStyle(require('./style.less?raw').toString()).run();
    },
    ready($c) {
      return $c.detectURLChanges($c.trigger().run()).domReady().trigger().run();
    },
    syncIsReady($c) {
      return $c
        .waitUntilTrue(
          $c
            .and(
              $c
                .querySelector('.player-title')
                .ifNotReturn()
                .getAttribute('href')
                .urlPart(2)
                .equals($c.url().urlPart(4).run())
                .run(),
              $c
                .querySelector('.player-episode')
                .ifNotReturn()
                .text()
                .regex('([0-9]+)', 1)
                .number()
                .equals($c.url().urlPart(5).number().run())
                .run(),
            )
            .run(),
        )
        .trigger()
        .run();
    },
  },
};
