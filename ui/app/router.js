import EmberRouter from '@ember/routing/router';
import config from 'open-cycle-tracker/config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  // Public Routes
  this.route('login');
  this.route('register');

  // Authenticated Routes
  this.route('cycle', function() {
    this.route('current');
    this.route('show', { path: '/:cycle_id' });
  });
  this.route('info');
  this.route('settings');
  this.route('calendar');

  this.route('tracking', function() {
    this.route('day', { path: '/days/:day_id' });
    this.route('date', { path: '/dates/:date_id' });
  });

  this.route('not-found', { path: '/*' });
});
