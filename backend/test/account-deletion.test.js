const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ACCOUNT_DELETE_CONFIRMATION,
  isValidAccountDeletionConfirmation,
  requiresPasswordForAccountDeletion,
} = require('../dist/lib/account-deletion');

test('account deletion confirmation phrase is exact and case-sensitive', () => {
  assert.equal(ACCOUNT_DELETE_CONFIRMATION, 'DELETE_MY_ACCOUNT');
  assert.equal(isValidAccountDeletionConfirmation('DELETE_MY_ACCOUNT'), true);
  assert.equal(isValidAccountDeletionConfirmation(' delete_my_account '), false);
  assert.equal(isValidAccountDeletionConfirmation(''), false);
  assert.equal(isValidAccountDeletionConfirmation(null), false);
});

test('password confirmation is required only for email/password accounts', () => {
  assert.equal(requiresPasswordForAccountDeletion({}), true);
  assert.equal(requiresPasswordForAccountDeletion({ googleId: null, facebookId: null }), true);
  assert.equal(requiresPasswordForAccountDeletion({ googleId: 'g-1' }), false);
  assert.equal(requiresPasswordForAccountDeletion({ facebookId: 'fb-1' }), false);
});
