import { helper } from '@ember/component/helper';
import { htmlSafe } from '@ember/template';

import Day from 'open-cycle-tracker/models/day';

export function circleStyle([ day, dayCount, radius = 200 ]: [ day: Day, dayCount: number, radius: number ]) {
  let angle = ((2 * Math.PI) / dayCount) * (day.order + 2) - 90
  let x = Math.round((radius / 1.4) + radius * Math.cos(angle)), y = Math.round((radius / 1.4) + radius * Math.sin(angle));
  return htmlSafe(`margin-left: calc(${x}px - 0.5em); margin-top: calc(${y}px - 0.5em)`);
}

export default helper(circleStyle);
