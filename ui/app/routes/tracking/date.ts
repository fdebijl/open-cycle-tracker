import Route from '@ember/routing/route';

export default class TrackingDateRoute extends Route.extend({
  // anything which *must* be merged to prototype here
}) {
  redirect(params: { date_id: string }) {
    return this.store.queryRecord('day', {
      date: params.date_id
    });

    // Redirect to tracking.days with retrieved day
  }
}
