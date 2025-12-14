import { execSync } from 'child_process';

describe('commander program', () => {
  it('should output help contents', () => {
    const output = execSync(
      'npx ts-node ./src/adapter/entry-points/cli/index.ts -h',
    ).toString();

    expect(output.trim()).toEqual(`Usage: Example CLI [options] <path>

This is an example

Arguments:
  path        Path of example

Options:
  -h, --help  display help for command`);
  });
  it('should output file contents', () => {
    const output = execSync(
      'npx ts-node ./src/adapter/entry-points/cli/index.ts ./testdata/src/domain/entities',
    ).toString();

    expect(output.trim()).toEqual(
      JSON.stringify('./testdata/src/domain/entities'),
    );
  });
});
