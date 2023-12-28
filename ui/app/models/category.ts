import Model, { attr, hasMany, type AsyncHasMany } from '@ember-data/model';

import type Factor from './factor';

export default class Category extends Model {
  @hasMany('factor')
  factors: AsyncHasMany<Factor>;

  @attr('string')
  name: string;

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
