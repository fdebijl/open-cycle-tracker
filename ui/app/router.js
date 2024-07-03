import EmberRouter from '@ember/routing/router';
import config from 'open-cycle-tracker/config/environment';

export default class Router extends EmberRouter {
  location = config.locationType;
  rootURL = config.rootURL;
}

Router.map(function () {
  // Public Routes
  this.route('auth', function() {
    this.route('login');
    this.route('logout');
    this.route('register');
  });

  // Authenticated Routes
  this.route('authenticated', { path: '' }, function() {
    this.route('index', { path: '/', resetNamespace: true });
    this.route('cycle', { resetNamespace: true}, function() {
      this.route('current');
      this.route('show', { path: '/:cycle_id' });
    });
    this.route('info', { resetNamespace: true});
    this.route('settings', { resetNamespace: true});
    this.route('calendar', { resetNamespace: true});

    this.route('tracking', { resetNamespace: true}, function() {
      this.route('day', { path: '/days/:day_id' });
      this.route('date', { path: '/dates/:date_id' });
    });
  });

  // TODO: Add templates for this route
  this.route('not-found', { path: '/*' });
});
