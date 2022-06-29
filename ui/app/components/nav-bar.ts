import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import ResponsiveService from 'open-cycle-tracker/services/responsive';

type NavBarArgs = {};

export default class NavBar extends Component<NavBarArgs> {
  @service responsive: ResponsiveService;
}
