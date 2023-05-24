import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import ResponsiveService from 'open-cycle-tracker/services/responsive';

type NavBarArgs = {};

export default class NavBar extends Component<NavBarArgs> {
  @service responsive: ResponsiveService;

  // Get the latest Day for this user and pass that along to the tracking page
}
