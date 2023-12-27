import Route from '@ember/routing/route';
import type RouterService from '@ember/routing/router-service';
import { service } from '@ember/service';

export default class AuthRoute extends Route {
  @service router: RouterService;

  redirect(model: never, transition: unknown) {
    if ((transition as {targetName: string}).targetName === 'auth.index') {
      this.router.transitionTo('auth.login');
    }
  }
}
