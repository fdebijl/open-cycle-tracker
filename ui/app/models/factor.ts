import Model, { attr, hasMany, type AsyncHasMany, type AsyncBelongsTo, belongsTo } from '@ember-data/model';

import type Day from './day';
import type Category from './category';

export default class Factor extends Model {
  @belongsTo('day')
  day: AsyncBelongsTo<Day>;

  @belongsTo('category')
  category: AsyncBelongsTo<Category>;

  @attr('string')
  level: string;
}

declare module 'ember-data/types/registries/model' {
  export default interface ModelRegistry {
    'factor': Factor;
  }
}
