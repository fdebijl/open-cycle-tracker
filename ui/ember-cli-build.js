'use strict';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const EmberApp = require('ember-cli/lib/broccoli/ember-app');

module.exports = function (defaults) {
  const app = new EmberApp(defaults, {
    sassOptions: {
      extension: 'sass'
    }
  });


  return app.toTree();
};
