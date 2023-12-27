import Component from '@glimmer/component';

interface FieldArgs {
  identifier: string;
  type: string;
  label: string;
  value: string | number;
  placeholder: string;
  disabled: boolean;
}

export default class Field extends Component<FieldArgs> {}
