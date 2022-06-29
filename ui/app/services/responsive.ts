import Service from '@ember/service';
import { on } from '@ember-decorators/object';
import { computed } from '@ember/object';
import { gte, lt, readOnly } from '@ember/object/computed';
import { debounce } from '@ember/runloop';

export const MAX_PHONE_WIDTH = 480;
export const MAX_NOTEPAD_WIDTH = 640;
export const MIN_DESKTOP_WIDTH = 840;
export const MIN_LAYOUT_WIDTH = 1024;
export const MIN_LARGE_WIDTH = 1200;

export const MAX_PHONE_HEIGHT = 640;
export const MIN_DESKTOP_HEIGHT = 720;
export const MIN_LAYOUT_HEIGHT = 850;
export const MIN_LARGE_HEIGHT = 960;

export default class ResponsiveService extends Service.extend({
  // anything which *must* be merged to prototype here
}) {
  width: number = 0;
  height: number = 0;

  @on('init')
  bindResize() {
    this.set('_boundResize', this.onResize.bind(this));
    window.addEventListener('resize', this['_boundResize']);
  }

  @on('init', 'didResize')
  setWidth() {
    this.set('width', Math.max(document.documentElement.clientWidth, window.innerWidth || 0));
  }

  @on('init', 'didResize')
  setHeight() {
    this.set('height', Math.max(document.documentElement.clientHeight, window.innerHeight || 0));
  }

  @lt('width', MAX_PHONE_WIDTH) isPhoneWidth: boolean;
  @lt('width', MAX_NOTEPAD_WIDTH) isNotepadWidth: boolean;
  @gte('width', MIN_DESKTOP_WIDTH) isDesktopWidth: boolean;
  @gte('width', MIN_LAYOUT_WIDTH) isLayoutWidth: boolean;
  @gte('width', MIN_LARGE_WIDTH) isLargeWidth: boolean;

  @readOnly('isPhoneWidth') isPhone: boolean;
  @readOnly('isNotepadWidth') isNotepad: boolean;
  @readOnly('isTabletWidth') isTablet: boolean;
  @readOnly('isDesktopWidth') isDesktop: boolean;
  @readOnly('isLayoutWidth') isLayout: boolean;
  @readOnly('isLargeWidth') isLarge: boolean;

  @computed('width', 'height')
  get isLandscape() {
    return this.width > this.height;
  }

  onResize() {
    debounce(this, () => {
      if (!this.isDestroyed) {
        this['trigger']('didResize');
      }
    }, 100);
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'responsive': ResponsiveService;
  }
}
