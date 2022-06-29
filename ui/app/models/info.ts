import DS from 'ember-data';

export default class Info extends DS.Model.extend({

}) {
  duration: number;
}

// DO NOT DELETE: this is how TypeScript knows how to look up your models.
declare module 'ember-data/types/registries/model' {
  export default interface ModelRegistry {
    'info': Info;
  }
}
