import Session from 'ember-simple-auth/services/session';

type DeviseSessionData = {
  token: string;
}

const DEFAULT_AUTHENTICATOR = 'authenticator:devise';

// TODO: Maintain current_user: https://github.com/mainmatter/ember-simple-auth/blob/master/guides/managing-current-user.md
export default class SessionService extends Session<DeviseSessionData> {
  authenticator = DEFAULT_AUTHENTICATOR;

  authenticate(username: string, password: string): Promise<void> {
    return super.authenticate(this.authenticator, username, password);
  }

  async register(username: string, password: string, name: string): Promise<void> {
    // TODO: Register
  }
}

declare module '@ember/service' {
  interface Registry {
    'session': SessionService;
  }
}
