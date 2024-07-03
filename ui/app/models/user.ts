import Model, { attr, hasMany, type AsyncHasMany } from '@ember-data/model';

import type Cycle from './cycle';

export default class User extends Model {
  @attr('string')
  name: string;

  @attr()
  info: Record<string, unknown>;

  @attr()
  settings: Record<string, unknown>;

  @hasMany('cycle')
  cycles: AsyncHasMany<Cycle>
}

declare module 'ember-data/types/registries/model' {
  export default interface ModelRegistry {
    'user': User;
  }
}
