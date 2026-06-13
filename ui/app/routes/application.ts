import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

import type CurrentUserService from 'open-cycle-tracker/services/current-user';
import type SessionService from 'open-cycle-tracker/services/session';

export default class ApplicationRoute extends Route {
  @service session: SessionService
  @service currentUser: CurrentUserService;

  async beforeModel() {
    await this.session.setup();
    await this._loadCurrentUser();
  }

  private async _loadCurrentUser() {
    try {
      await this.currentUser.load();
    } catch(err) {
      await this.session.invalidate();
    }
  }
}
