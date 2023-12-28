import Route from '@ember/routing/route';
import { service } from '@ember/service';
import DS from 'ember-data';

export default class TrackingDayRoute extends Route {
  @service store: DS.Store;

  async model(params: { day_id: string }) {
    return {
      day: await this.store.findRecord('day', params.day_id),
      categories: await this.store.findAll('category')
    }
  }
}
