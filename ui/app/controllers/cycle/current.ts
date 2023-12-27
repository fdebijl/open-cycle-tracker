import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';

export default class CycleCurrentController extends Controller {
  @tracked isLoading = true;
}

declare module '@ember/controller' {
  interface Registry {
    'cycle/current': CycleCurrentController;
  }
}
