import Model, { attr, belongsTo, type AsyncBelongsTo, hasMany, type AsyncHasMany } from '@ember-data/model';
import type Cycle from './cycle';
import type Factor from './factor';

type CycleDayType = 'none' | 'period' | 'fertile' | 'ovulation' | 'pms';

export default class Day extends Model {
  @attr('date')
  date: Date;

  @attr('number')
  order: number;

  @attr('string')
  dayType: CycleDayType;

  @belongsTo('cycle')
  cycle: AsyncBelongsTo<Cycle>;

  @hasMany('factor')
  factors: AsyncHasMany<Factor>;

  get isToday() {
    const today = new Date()
    return this.date.getDate() == today.getDate() &&
           this.date.getMonth() == today.getMonth() &&
           this.date.getFullYear() == today.getFullYear()
  }
}

declare module 'ember-data/types/registries/model' {
  export default interface ModelRegistry {
    'day': Day;
  }
}
