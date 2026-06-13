import Model, { attr, hasMany, type AsyncHasMany } from '@ember-data/model';

import type CategoryLevel from './category-level';

export default class Category extends Model {
  // @hasMany('factor')
  // factors: AsyncHasMany<Factor>;

  @hasMany('category-level')
  levels: AsyncHasMany<CategoryLevel>;

  @attr('string')
  name: string;

  @attr('string')
  icon: string;

  @attr('string')
  color: string;

  @attr('boolean')
  global: boolean;
}

declare module 'ember-data/types/registries/model' {
  export default interface ModelRegistry {
    'category': Category;
  }
}
