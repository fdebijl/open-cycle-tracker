import Route from '@ember/routing/route';

export default class TrackingDaysRoute extends Route.extend({
  // anything which *must* be merged to prototype here
}) {
  model(params: { day_id: string }) {
    return this.store.findRecord('day', params.day_id);
  }
}
