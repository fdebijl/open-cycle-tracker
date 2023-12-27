import Component from '@glimmer/component';

interface SpinnerArgs {
  dotCount: number;
}

export default class Spinner extends Component<SpinnerArgs> {
  get dotCount() {
    return this.args.dotCount || 20;
  }

  duration = 0.75;
  pause = 1.5;

  colors = [
    null,
    '#E76666',
    '#E76666',
    '#D4CEEC',
    '#D4CEEC',
    '#D4CEEC',
    '#D4CEEC',
    '#778CFA',
    '#778CFA',
    '#778CFA',
    '#778CFA',
    '#D4CEEC',
    '#D4CEEC',
    '#D4CEEC',
    '#D4CEEC',
    '#D4CEEC',
    '#D4CEEC',
    '#D4CEEC',
    '#FBC87B',
    '#FBC87B',
    '#FBC87B',
  ]
}
