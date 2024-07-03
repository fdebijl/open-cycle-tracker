import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { alias } from 'macro-decorators';

import type User from 'open-cycle-tracker/models/user';
import type SessionService from 'open-cycle-tracker/services/session';

export default class InfoController extends Controller {
  @service session: SessionService;

  @alias('session.user.info') info: Record<string, unknown>;

  @action
  setInfo(key: string, value: string) {
    this.info[key] = value;
    // TODO: Persist current user info
  }
}

declare module '@ember/controller' {
  interface Registry {
    'info': InfoController;
  }
}
