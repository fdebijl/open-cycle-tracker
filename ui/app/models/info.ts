import Model, { attr } from '@ember-data/model';

export default class Info extends Model {
  duration: number;
}


declare module 'ember-data/types/registries/model' {
  export default interface ModelRegistry {
    'info': Info;
  }
}
