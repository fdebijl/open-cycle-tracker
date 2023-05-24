import Model, { attr } from '@ember-data/model';
import Day from './day';

export default class Calendar extends Model {
  // hasMany
  days: Day[];
}

declare module 'ember-data/types/registries/model' {
  export default interface ModelRegistry {
    'calendar': Calendar;
  }
}
