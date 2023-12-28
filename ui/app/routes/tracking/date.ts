import Route from '@ember/routing/route';
import RouterService from '@ember/routing/router-service';
import { service } from '@ember/service';
import DS from 'ember-data';

export default class TrackingDateRoute extends Route {
  @service router: RouterService;
  @service store: DS.Store;

  redirect(params: { date_id: string }) {
    const day = this.store.queryRecord('day', {
      date: params.date_id
    });

    this.router.transitionTo('tracking.day', day);
  }
}
