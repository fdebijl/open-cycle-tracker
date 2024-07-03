import Route from '@ember/routing/route';
import { service } from '@ember/service';

import type RouterService from '@ember/routing/router-service';
import type SessionService from 'open-cycle-tracker/services/session';

export default class AuthRoute extends Route {
  @service router: RouterService;
  @service session: SessionService

  redirect(model: never, transition: unknown) {
    if ((transition as {targetName: string}).targetName === 'auth.index') {
      this.router.transitionTo('auth.login');
    }
  }

  beforeModel(transition: unknown) {
    this.session.prohibitAuthentication('cycle.current');
  }
}
