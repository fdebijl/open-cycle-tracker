import DS from 'ember-data';

export default class Day extends DS.Model.extend({

}) {
  // date
  // factors
}

// DO NOT DELETE: this is how TypeScript knows how to look up your models.
declare module 'ember-data/types/registries/model' {
  export default interface ModelRegistry {
    'day': Day;
  }
}
