import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('package.json', () => {
  it('is publishable (not private)', () => {
    const packageJsonPath = resolve(__dirname, '..', 'package.json');
    const contents = readFileSync(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(contents);

    expect(pkg.private).not.toBe(true);
  });
});
