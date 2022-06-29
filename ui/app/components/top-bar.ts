import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import ResponsiveService from 'open-cycle-tracker/services/responsive';

type TopBarArgs = {};

export default class TopBar extends Component<TopBarArgs> {
  @service responsive: ResponsiveService;
}
