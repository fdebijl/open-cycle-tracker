import Service from '@ember/service';
import { inject as service } from '@ember/service';

import type SessionService from './session';
import type DS from 'ember-data';
import type User from 'open-cycle-tracker/models/user';

export default class CurrentUserService extends Service {
  @service session: SessionService;
  @service store: DS.Store;

  user: User

  async load() {
    const userId = this.session.data.authenticated.id;

    if (userId) {
      this.user = await this.store.findRecord('user', userId);
    }
  }
}

declare module '@ember/service' {
  interface Registry {
    'current-user': CurrentUserService;
  }
}
