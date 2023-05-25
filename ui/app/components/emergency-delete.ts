import { action } from '@ember/object';
import { htmlSafe } from '@ember/template';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

interface EmergencyDeleteArgs {}

export default class EmergencyDelete extends Component<EmergencyDeleteArgs> {
  timeout: any;
  @tracked counter = 0;
  @tracked triggered = false;

  get buttonGradient() {
    if (this.triggered) {
      return htmlSafe('background: #E33434');
    }

    return htmlSafe(`background: linear-gradient(90deg, #E33434 ${this.counter}%, #E76666 ${this.counter}%)`);
  }

  @action
  onRelease() {
    clearInterval(this.timeout);
    this.counter = 0;
  }

  @action
  onHoldDown() {
    this.timeout = setInterval(() => {
      this.counter++;

      if (this.counter === 100) {
        // TODO: Call the emergency delete endpoint
        this.triggered = true;
        this.onRelease();
      }
    }, 30);
  }
}
