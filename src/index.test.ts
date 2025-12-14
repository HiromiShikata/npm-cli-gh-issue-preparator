import { program } from './index';

describe('index', () => {
  it('should export program from CLI module', () => {
    expect(program).toBeDefined();
  });
});
