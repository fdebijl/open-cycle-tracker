import Model, { attr } from '@ember-data/model';

enum CycleDayType {
  None,
  PMS,
  Period,
  Fertile
}

export default class Day extends Model {
  date: Date;
  order: number;
  type: CycleDayType;
  // Factors

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
