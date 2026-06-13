import { action } from '@ember/object';
import DS from 'ember-data';
import Route from '@ember/routing/route';
import { service } from '@ember/service';

import type Cycle from 'open-cycle-tracker/models/cycle';
import type Transition from '@ember/routing/-private/transition';
import type CycleCurrentController from 'open-cycle-tracker/controllers/cycle/current';

export default class CycleCurrentRoute extends Route {
  @service store: DS.Store;

  async model(): Promise<Cycle> {
    try {
      const currentCycle: Cycle = await this.store.queryRecord('cycle', {
        filter: {
          current: true
        }
      });

      if (currentCycle) {
        const days = await currentCycle.days;

        if (days.get('length') > 0) {
          return currentCycle;
        }
      }
    } catch(e) {
      console.error(e);
    }

    const newCycle: Cycle = this.store.createRecord('cycle');
    await newCycle.save();
    await newCycle.populateDays();

    return newCycle;
  }
}
