import DS from 'ember-data';
import RouterService from '@ember/routing/router-service';
import Session from 'ember-simple-auth/services/session';
import { service } from '@ember/service';
import ENV from 'open-cycle-tracker/config/environment';
import type User from 'open-cycle-tracker/models/user';

// TODO: Remove ASAP
export default class OldSessionService extends Session<unknown> {
  @service router: RouterService;

  /** The currently logged in user, or null if no one is logged in */
  user: User | null;

  get authed() {
    return !!this.authToken;
  }

  get authToken() {
    return localStorage.getItem('token');
  }

  urlFor(route: 'signup' | 'login' | 'logout') {
    return `${ENV.API_URL}/${route}`;
  }

  async register(username: string, password: string, name: string) {
    await fetch(this.urlFor('signup'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user: {
          email: username,
          password,
          name
        }
      })
    });

    await this.login(username, password);
  }

  async login(username: string, password: string) {
    const response = await fetch(this.urlFor('login'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user: {
          email: username,
          password
        }
      })
    });

    const token = response.headers.get('Authorization');

    if (!token) {
      throw new Error('No token present in login response');
    }

    localStorage.setItem('token', token);

    const body = await response.json();
    // this.user = await this.store.findRecord('user', body.data.user.id);
  }

  async logout() {
    await fetch(this.urlFor('logout'), {
      method: 'POST',
      headers: {
        'Authorization': this.authToken as string
      }
    });

    localStorage.removeItem('token');
    this.user = null;

    this.router.transitionTo('auth.login');
  }
}

// declare module '@ember/service' {
//   interface Registry {
//     'session': SessionService;
//   }
// }
