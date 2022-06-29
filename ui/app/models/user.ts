import DS from 'ember-data';
import Calendar from './calendar';
import Cycle from './cycle';
import Info from './info';

export default class User extends DS.Model.extend({

}) {
  // attr
  name: string;
  // hasOne
  info: Info;
  // hasMany
  cycles: Cycle[];
  // hasOne
  calendar: Calendar;
  // hasOne
  settings: object;
}

// DO NOT DELETE: this is how TypeScript knows how to look up your models.
declare module 'ember-data/types/registries/model' {
  export default interface ModelRegistry {
    'user': User;
  }
}
