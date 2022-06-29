import Component from '@glimmer/component';
import { htmlSafe } from '@ember/template';

type IconArgs = {
  size?: number;
};

export default class Icon extends Component<IconArgs> {
  get size() {
    return this.args.size ?? 60;
  }

  get iconSize() {
    return Math.floor(this.size / 1.6);
  }

  get iconStyle() {
    return htmlSafe(`width: ${this.size}px; height: ${this.size}px;`);
  }
}
