import { module, test } from 'qunit';
import { setupTest } from 'ember-qunit';

module('Unit | Route | day/:day', function(hooks) {
  setupTest(hooks);

  test('it exists', function(assert) {
    let route = this.owner.lookup('route:day/:day');
    assert.ok(route);
  });
});
