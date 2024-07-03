import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

import type SessionService from 'open-cycle-tracker/services/session';

export default class ApplicationRoute extends Route {
  @service session: SessionService

  async beforeModel() {
    await this.session.setup();
  }
}
