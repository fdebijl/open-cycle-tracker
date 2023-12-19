import Model, { hasMany, type AsyncHasMany, type SyncHasMany } from '@ember-data/model';
import type Day from './day';

// This might not have to be a model, since we can just load all the Days by day.date in the calendar view
export default class Calendar extends Model {
  @hasMany('day')
  days: AsyncHasMany<Day>
}

declare module 'ember-data/types/registries/model' {
  export default interface ModelRegistry {
    'calendar': Calendar;
  }
}
