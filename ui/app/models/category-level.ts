import Model, { attr, belongsTo, type AsyncBelongsTo } from '@ember-data/model';

import type Category from './category';

export default class CategoryLevel extends Model {
  @belongsTo('category')
  category: AsyncBelongsTo<Category>;

  @attr('string')
  name: string;

  @attr('string')
  color: string;
}

declare module 'ember-data/types/registries/model' {
  export default interface ModelRegistry {
    'category-level': CategoryLevel;
  }
}
