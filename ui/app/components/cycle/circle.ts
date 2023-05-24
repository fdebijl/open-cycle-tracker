import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import RouterService from '@ember/routing/router-service';
import ResponsiveService from 'open-cycle-tracker/services/responsive';

import Cycle from 'open-cycle-tracker/models/cycle';
import Day from 'open-cycle-tracker/models/day';

type CycleCircleArgs = {
  cycle: Cycle;
};

export default class CycleCircle extends Component<CycleCircleArgs> {
  @service responsive!: ResponsiveService;
  @service router: RouterService;

  @tracked width = this.responsive.width;
  @tracked height = this.responsive.height;

  get radius() {
    return Math.min(this.width, this.height) / 3;
  }

  constructor(owner: unknown, args: CycleCircleArgs) {
    super(owner, args);

    this.responsive.on('didResize', this.handleResize);
  }

  willDestroy() {
    this.responsive.off('didResize', this.handleResize);
  }

  handleResize = () => {
    this.width = this.responsive.width;
    this.height = this.responsive.height;
  };

  @action
  transitionToDay(day: Day) {
    this.router.transitionTo('tracking.day', day);
  }
}
