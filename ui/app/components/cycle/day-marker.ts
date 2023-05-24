import Component from '@glimmer/component';
import { htmlSafe } from '@ember/template';
import Day from 'open-cycle-tracker/models/day';

type DayMarkerArgs = {
  day: Day;
};

export default class DayMarker extends Component<DayMarkerArgs> {
}
