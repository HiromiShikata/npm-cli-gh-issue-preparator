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

Parameters are resolved using a 3-tier priority system (highest to lowest):

1. **GitHub Project README** (highest priority) -- YAML extracted from `<details><summary>config</summary>` section
2. **CLI arguments** -- passed via command line options
3. **Config YAML file** (lowest priority) -- base configuration loaded via `--configFilePath`

All parameters can be specified in a YAML config file. See [config.example.yml](./config.example.yml) for a complete example.

### GitHub Project README Config

The GitHub Project README can contain a collapsible `<details>` section with YAML configuration that overrides both CLI arguments and config file values:

```
<details>
<summary>config</summary>

maximumPreparingIssuesCount: 2
utilizationPercentageThreshold: 99
defaultAgentName: 'custom-agent'
</details>
```

Only the content inside the `<details><summary>config</summary>` section is parsed as YAML. Other content in the README is ignored. `projectUrl` and `configFilePath` cannot be set via Project README since the README is fetched using these values.

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

### Notify finished issue preparation with webhook notification

```
npx npm-cli-gh-issue-preparator notifyFinishedIssuePreparation --configFilePath ./config.yml --issueUrl <issueUrl> --workflowBlockerResolvedWebhookUrl 'https://example.com/webhook?url={URL}&message={MESSAGE}'
```

When a workflow blocker issue's status changes to awaiting quality check, a GET request is sent to the specified webhook URL. The `{URL}` and `{MESSAGE}` placeholders are replaced with URL-encoded values.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT
