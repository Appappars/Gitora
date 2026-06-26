import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { githubErrorMessage } = require('./githubErrors.cjs');

describe('githubErrorMessage', () => {
  it('explains missing delete_repo permission', () => {
    expect(githubErrorMessage(403, 'Must have admin rights to Repository.', '/repos/me/demo', 'DELETE')).toContain('delete_repo');
  });

  it('keeps normal GitHub messages unchanged', () => {
    expect(githubErrorMessage(404, 'Not Found')).toBe('Not Found');
  });
});
