const test = require('node:test');
const assert = require('node:assert/strict');
const { getProjectStatus } = require('../src/index');

test('getProjectStatus returns upload confirmation', () => {
  assert.equal(getProjectStatus(), 'Project uploaded successfully');
});
