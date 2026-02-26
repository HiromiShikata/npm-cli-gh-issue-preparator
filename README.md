# npm-cli-gh-issue-preparator

[![Test](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/actions/workflows/test.yml/badge.svg)](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/actions/workflows/test.yml)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)
[![semantic-release: angular](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)

Welcome to npm-cli-gh-issue-preparator, this tool helps you to prepare you task by AI.

## Usage 🛠️

Here's how you can use npm-cli-gh-issue-preparator:

```
Usage: npm-cli-gh-issue-preparator [options] [command]

CLI tool to prepare GitHub issues

Options:
  -h, --help                                display help for command

Commands:
  startDaemon [options]                     Start daemon to prepare GitHub issues
  notifyFinishedIssuePreparation [options]  Notify that issue preparation is finished
  help [command]                            display help for command
```

## Configuration

All parameters can be specified in a YAML config file. See [config.example.yml](./config.example.yml) for a complete example. CLI options override config file values.

## Example 📖

Here's a quick example to illustrate its usage:

### Using config file

```
npx npm-cli-gh-issue-preparator startDaemon --configFilePath ./config.yml
```

### Start preparation (with CLI overrides)

```
npx npm-cli-gh-issue-preparator startDaemon --configFilePath ./config.yml --projectUrl <projectUrl> --awaitingWorkspaceStatus "Awaiting workspace" --preparationStatus "Preparation" --defaultAgentName "impl"
```

### Notify finished issue preparation

```
npx npm-cli-gh-issue-preparator notifyFinishedIssuePreparation --configFilePath ./config.yml --issueUrl <issueUrl>
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT
