import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import DS from 'ember-data';
import Cycle from 'open-cycle-tracker/models/cycle';

export default class CycleController extends Controller.extend({
  // anything which *must* be merged to prototype here
}) {
  @service store: DS.Store;

  _mockCycle: Cycle;

  subtractDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
  }

  addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  get cycle(): Cycle {
    if (this._mockCycle) {
      return this._mockCycle;
    }

    const today = new Date();
    this._mockCycle = this.store.createRecord('cycle', {
      days: [
        this.store.createRecord('day', { id: 1, type: 'Period', order: 0, date: this.subtractDays(today, 3) }),
        this.store.createRecord('day', { id: 2, type: 'Period', order: 1, date: this.subtractDays(today, 2) }),
        this.store.createRecord('day', { id: 3, type: 'Period', order: 2, date: this.subtractDays(today, 1) }),
        this.store.createRecord('day', { id: 4, type: 'Period', order: 3, date: today }),
        this.store.createRecord('day', { type: 'None', order: 4, date: this.addDays(today, 1) }),
        this.store.createRecord('day', { type: 'None', order: 5, date: this.addDays(today, 2) }),
        this.store.createRecord('day', { type: 'None', order: 6, date: this.addDays(today, 3) }),
        this.store.createRecord('day', { type: 'None', order: 7, date: this.addDays(today, 4) }),
        this.store.createRecord('day', { type: 'None', order: 8, date: this.addDays(today, 5) }),
        this.store.createRecord('day', { type: 'None', order: 9, date: this.addDays(today, 6) }),
        this.store.createRecord('day', { type: 'Fertile', order: 10, date: this.addDays(today, 7) }),
        this.store.createRecord('day', { type: 'Fertile', order: 11, date: this.addDays(today, 8) }),
        this.store.createRecord('day', { type: 'Fertile', order: 12, date: this.addDays(today, 9) }),
        this.store.createRecord('day', { type: 'Fertile', order: 13, date: this.addDays(today, 10) }),
        this.store.createRecord('day', { type: 'Fertile', order: 14, date: this.addDays(today, 11) }),
        this.store.createRecord('day', { type: 'Fertile', order: 15, date: this.addDays(today, 12) }),
        this.store.createRecord('day', { type: 'Fertile', order: 16, date: this.addDays(today, 13) }),
        this.store.createRecord('day', { type: 'None', order: 17, date: this.addDays(today, 14) }),
        this.store.createRecord('day', { type: 'None', order: 18, date: this.addDays(today, 15) }),
        this.store.createRecord('day', { type: 'None', order: 19, date: this.addDays(today, 16) }),
        this.store.createRecord('day', { type: 'None', order: 20, date: this.addDays(today, 17) }),
        this.store.createRecord('day', { type: 'None', order: 21, date: this.addDays(today, 18) }),
        this.store.createRecord('day', { type: 'None', order: 22, date: this.addDays(today, 19) }),
        this.store.createRecord('day', { type: 'None', order: 23, date: this.addDays(today, 20) }),
        this.store.createRecord('day', { type: 'None', order: 24, date: this.addDays(today, 21) }),
        this.store.createRecord('day', { type: 'PMS', order: 25, date: this.addDays(today, 22) }),
        this.store.createRecord('day', { type: 'PMS', order: 26, date: this.addDays(today, 23) }),
        this.store.createRecord('day', { type: 'PMS', order: 27, date: this.addDays(today, 24) }),
        this.store.createRecord('day', { type: 'PMS', order: 28, date: this.addDays(today, 25) }),
      ]
    });

    return this._mockCycle;
  }
}

declare module '@ember/controller' {
  interface Registry {
    'cycle': CycleController;
  }
}
