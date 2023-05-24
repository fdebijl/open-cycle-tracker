import Model, { attr } from '@ember-data/model';

import Calendar from './calendar';
import Cycle from './cycle';
import Info from './info';

export default class User extends Model {
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


declare module 'ember-data/types/registries/model' {
  export default interface ModelRegistry {
    'user': User;
  }
}
