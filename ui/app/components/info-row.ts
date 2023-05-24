import Component from '@glimmer/component';
import { action } from '@ember/object';
import { guidFor } from '@ember/object/internals';

type InputEvent = Event & { target: HTMLInputElement };

type InputType = "button" | "checkbox" | "color" | "date" | "datetime-local" | "email" | "file" | "hidden" | "image" | "month" | "number" | "password" | "radio" | "range" | "reset" | "search" | "submit" | "tel" | "text" | "time" | "url" | "week";

interface InfoRowArgs {
  label: string;
  unit: string;
  inputType: InputType;
  description: string;
  value: string;
  placeholder: string;
  disabled: boolean
  setValue: (value: string) => void;

}

export default class InfoRow extends Component<InfoRowArgs> {
  elementId = `${guidFor(this)}__element`;

  @action
  setValue(e: InputEvent) {
    this.args.setValue?.(e.target?.value);
  }
}
