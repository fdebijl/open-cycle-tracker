import { Router } from '@ember/routing';
import Route from '@ember/routing/route';
import { service } from '@ember/service';
import DS from 'ember-data';

export default class TrackingIndexRoute extends Route {
  @service router: Router;
  @service store: DS.Store;

  async redirect() {
    const today = await this.store.queryRecord('day', {
      filter: {
        today: true
      }
    });

    if (today) {
      this.router.transitionTo('tracking.day', today.id);
    } else {
      // TODO: Handle no today
    }
  }
}
