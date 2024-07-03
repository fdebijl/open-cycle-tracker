import Controller from '@ember/controller';
import { action } from '@ember/object';
import { service } from '@ember/service';
import type RouterService from '@ember/routing/router-service';
import type SessionService from 'open-cycle-tracker/services/session';

// TODO: Rewrite for ember-simple-auth
export default class AuthRegister extends Controller {
  @service session: SessionService;
  @service router: RouterService;

  username: string | null = 'floris.debijl@gmail.com';
  password: string | null = 'password';
  name: string | null = 'Floris';

  get isDisabled() {
    return !this.username || !this.password || !this.name;
  }

  @action
  async register(event: SubmitEvent) {
    event.preventDefault();

    if (!this.username || !this.password || !this.name) {
      alert('Please fill in all fields');
      return;
    }

    try {
      await this.session.register(this.username, this.password, this.name);
      this.router.transitionTo('cycle.current');
    } catch (e) {
      alert(e);
    }
  }
}

declare module '@ember/controller' {
  interface Registry {
    'auth/register': AuthRegister;
  }
}
