import Controller from '@ember/controller';
import { action } from '@ember/object';
import { service } from '@ember/service';
import type SessionService from 'open-cycle-tracker/services/session';
import type RouterService from '@ember/routing/router-service';

export default class AuthLogin extends Controller {
  @service session: SessionService;
  @service router: RouterService;

  username: string | null = 'floris.debijl@gmail.com';
  password: string | null = 'password';

  get isDisabled() {
    return !this.username || !this.password;
  }

  @action
  async login(event: SubmitEvent) {
    event.preventDefault();

    if (!this.username || !this.password) {
      alert('Please fill in both username and password');
      return;
    }

    try {
      await this.session.authenticate(this.username, this.password);
      this.router.transitionTo('cycle.current');
    } catch (e) {
      // TODO: Show a more user-friendly error message and handle bad credentials
      alert(e);
    }
  }
}

declare module '@ember/controller' {
  interface Registry {
    'auth/login': AuthLogin;
  }
}
