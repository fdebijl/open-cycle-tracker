import Model, { attr } from '@ember-data/model';
import Day from './day';

export default class Cycle extends Model {
  @attr()
  days: Day[];
}


declare module 'ember-data/types/registries/model' {
  export default interface ModelRegistry {
    'Cycle': Cycle;
  }
}
