import DS from 'ember-data';
import Day from './day';

export default class Calendar extends DS.Model.extend({

}) {
  // hasMany
  day: Day;
}

// DO NOT DELETE: this is how TypeScript knows how to look up your models.
declare module 'ember-data/types/registries/model' {
  export default interface ModelRegistry {
    'calendar': Calendar;
  }
}
