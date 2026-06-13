import Session from 'ember-simple-auth/services/session';
import ENV from 'open-cycle-tracker/config/environment';

type DeviseSessionData = {
  authenticator: string;
  token: string;
  id: string;
  email: string;
  name: string;
}

const DEFAULT_AUTHENTICATOR = 'authenticator:devise';

export default class SessionService extends Session<DeviseSessionData> {
  authenticator = DEFAULT_AUTHENTICATOR;

  urlFor(route: 'signup' | 'login' | 'logout') {
    return `${ENV.API_URL}/${route}`;
  }

  async authenticate(username: string, password: string): Promise<void> {
    return super.authenticate(this.authenticator, username, password);
  }

  async register(username: string, password: string, name: string): Promise<void> {
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

    await this.authenticate(username, password);
  }
}

declare module '@ember/service' {
  interface Registry {
    'session': SessionService;
  }
}
