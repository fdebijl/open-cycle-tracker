import Component from '@glimmer/component';
import type Category from 'open-cycle-tracker/models/category';

interface CategoryRowArgs {
  category: Category;
}

export default class CategoryRow extends Component<CategoryRowArgs> {}
