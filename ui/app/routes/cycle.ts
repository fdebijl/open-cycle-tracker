import Route from '@ember/routing/route';
import { service } from '@ember/service';
import type RouterService from '@ember/routing/router-service';

export default class CycleRoute extends Route {
  @service router: RouterService;

  redirect() {
    this.router.transitionTo('cycle.current');
  }
}
