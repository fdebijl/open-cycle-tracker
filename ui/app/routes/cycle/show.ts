import Route from '@ember/routing/route';
import { service } from '@ember/service';
import DS from 'ember-data';

export default class CycleShowRoute extends Route {
  @service store: DS.Store;

  model(params: { cycle_id: string }) {
    return this.store.findRecord('cycle', params.cycle_id);
  }
}
