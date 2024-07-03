import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

import type SessionService from 'open-cycle-tracker/services/session';
import type Transition from '@ember/routing/-private/transition';

export default class AuthenticatedRoute extends Route {
  @service session: SessionService

  beforeModel(transition: Transition) {
    this.session.requireAuthentication(transition, 'auth.login');
  }
}
