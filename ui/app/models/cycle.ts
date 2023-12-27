import Model, { hasMany, type AsyncHasMany, belongsTo, type AsyncBelongsTo } from '@ember-data/model';
import type Day from './day';
import type User from './user';

export default class Cycle extends Model {
  @hasMany('day')
  days: AsyncHasMany<Day>

  @belongsTo('user')
  user: AsyncBelongsTo<User>;

  get daysUntilNextPeriod() {
    const today = new Date();
    const lastDay = this.days.lastObject;
    if (lastDay) {
      const daysUntilLastDay = Math.ceil((lastDay.date.getTime() - today.getTime()) / (1000 * 3600 * 24));
      return daysUntilLastDay;
    } else {
      return 0;
    }
  }

  // Move this to i18n or component
  get daysUntilNextPeriodLabel() {
    const daysUntilNextPeriod = this.daysUntilNextPeriod;

    if (daysUntilNextPeriod < 0) {
      return `Your period is ${daysUntilNextPeriod} days late`;
    } else if (daysUntilNextPeriod == 0) {
      return 'Your period may start today';
    } else if (daysUntilNextPeriod == 1) {
      return 'Your period may start tomorrow';
    } else {
      return `${daysUntilNextPeriod} days until next period`;
    }
  }

  async populateDays(count = 28): Promise<void> {
    const today = new Date();

    for (let i = 0; i < count; i++) {
      const day = this.store.createRecord('day', {
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() + i),
        cycle: this,
        order: i + 1,
        dayType: 'none'
      });

      await day.save();
    }
  }
}


declare module 'ember-data/types/registries/model' {
  export default interface ModelRegistry {
    'Cycle': Cycle;
  }
}
