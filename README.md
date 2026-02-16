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

## Example 📖

Here's a quick example to illustrate its usage:

### Start preparation

```
npx npm-cli-gh-issue-preparator startDaemon --projectUrl <projectUrl> --awaitingWorkspaceStatus "Awaiting workspace" --preparationStatus "Preparation" --defaultAgentName "impl"
```

### Notify finished issue preparation

```
npx npm-cli-gh-issue-preparator notifyFinishedIssuePreparation --projectUrl <projectUrl> --issueUrl <issueUrl> --preparationStatus "Preparation" --awaitingQualityCheckStatus "Awaiting quality check"
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT
