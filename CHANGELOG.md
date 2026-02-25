## [1.16.1](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.16.0...v1.16.1) (2026-02-25)


### Bug Fixes

* **core:** verify required status checks before reporting CI as passed ([e8a3426](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/e8a3426ca3363f28f42664b6a9925f0fa282a991))

# [1.16.0](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.15.1...v1.16.0) (2026-02-24)


### Features

* **core:** add utilizationPercentageThreshold CLI option to startDaemon ([746aaba](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/746aaba045108e2e8d10846562958ebe5923e2dd))

## [1.15.1](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.15.0...v1.15.1) (2026-02-24)


### Bug Fixes

* **core:** support PR URLs when changing status in GitHub project ([c6ea157](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/c6ea157c1698131b22eeb55d7b43e785b51550fc))

# [1.15.0](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.14.0...v1.15.0) (2026-02-23)


### Features

* **core:** skip aw command when issue nextActionDate is tomorrow or future ([610b6e7](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/610b6e74f7e31d3746943df1bcbc73754db9f3e7))

# [1.14.0](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.13.0...v1.14.0) (2026-02-23)


### Features

* **core:** skip aw command for issues with dependency or future nextActionHour ([7d3adfb](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/7d3adfbfec6695aa01e572652ad15eda361a6f70)), closes [#59](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/issues/59)

# [1.13.0](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.12.0...v1.13.0) (2026-02-18)


### Features

* **core:** add retry comment to skip auto-escalation ([38c3302](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/38c330264356833a28b8364db937140b152eea62))

# [1.12.0](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.11.0...v1.12.0) (2026-02-17)


### Features

* **core:** change ANY_CI_JOB_FAILED to ANY_CI_JOB_FAILED_OR_IN_PROGRESS ([9e3cb16](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/9e3cb163b88e0c069edaaadf67cd23ceee41ff9d))

# [1.11.0](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.10.2...v1.11.0) (2026-02-16)


### Features

* **core:** skip aw command if claude usage over threshold and fix report detection ([ffbca9e](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/ffbca9ee4dd35889d0548ccdb9009f19a184142a))

## [1.10.2](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.10.1...v1.10.2) (2026-02-16)


### Bug Fixes

* **readme:** update section title from 'Start daemon' to 'Start preparation'fix ([6fbd069](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/6fbd069cf531a021e48ece7f0ac85f8cdeb183c1))

## [1.10.1](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.10.0...v1.10.1) (2026-02-13)


### Bug Fixes

* **core:** skip PR checks for issues with category label ([8f69604](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/8f6960443da3a0ed4485391acce0984bb5d2db4a))
* **core:** skip PR checks for issues with category label and fix max count loop ([1a439ba](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/1a439ba2a38466e2bf2fe09cbec84853533bd233))

# [1.10.0](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.9.0...v1.10.0) (2026-02-13)


### Features

* **core:** add PR status checking to notify finished issue preparation ([72e5562](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/72e556229200a14669240e37da75da60a34530c0))

# [1.9.0](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.8.0...v1.9.0) (2026-02-11)


### Features

* **core:** use getStoryObjectMap from tower-defence library ([980aed8](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/980aed86127965c68d38e1336ef007aad5d810ee)), closes [#82](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/issues/82)

# [1.8.0](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.7.1...v1.8.0) (2026-02-09)


### Features

* **core:** add findRelatedOpenPRs method to IssueRepository interface ([50de650](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/50de650520a68a0ece086c1d1f6d971dd579a455))

## [1.7.1](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.7.0...v1.7.1) (2026-02-04)


### Bug Fixes

* **ci:** add token fallback for dependabot PRs in workflows ([3a1fc86](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/3a1fc86eb89aed7cd8ea356cce1b0a8c489f3475))

# [1.7.0](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.6.0...v1.7.0) (2026-01-31)


### Features

* **core:** add Comment domain entity with author, content, createdAt ([8e3e861](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/8e3e8617284f818cf72f9e4c33afac9748b2661a))

# [1.6.0](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.5.0...v1.6.0) (2026-01-26)


### Features

* **core:** add prepareStatus method to ProjectRepository ([931b2ed](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/931b2ed9e4298235b48afa0b6a82d81a49ea78d2))

# [1.5.0](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.4.0...v1.5.0) (2026-01-20)


### Features

* **cli:** add maximumPreparingIssuesCount as cli parameter for startDaemon ([a3f1e98](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/a3f1e985c65cdda426538abd5d1552344f33da0e))

# [1.4.0](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.3.0...v1.4.0) (2026-01-14)


### Features

* **cli:** add logFilePath to cli parameter ([8e7dba7](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/8e7dba7608cac085883c7beaeca1cd5de490f46e))

# [1.3.0](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.2.0...v1.3.0) (2026-01-12)


### Bug Fixes

* prevent command injection in xfce4-terminal spawn ([0a4e008](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/0a4e008749b293cd1f1d311ad08adfc9f37033c3))


### Features

* **src:** create CopilotRepository ([c79ed81](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/c79ed8127342a5aa58fc2f83b10334bbb0fc6a0d)), closes [#38](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/issues/38)

# [1.2.0](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.1.0...v1.2.0) (2026-01-12)


### Features

* **src:** add isClaudeAvailable method to rotate Claude credentials ([7b966bd](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/7b966bd123eb9474fd9f675e7addb4b54b509abe))

# [1.1.0](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.0.4...v1.1.0) (2026-01-12)


### Features

* **core:** add Claude usage repository for OAuth API integration ([57ab791](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/57ab7914f9574a4e6746183457e643dac47f7261))

## [1.0.4](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.0.3...v1.0.4) (2026-01-10)


### Bug Fixes

* **ci:** add GH_TOKEN to test workflow and fix test expectations ([86dbac0](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/86dbac0bd66e0806531a26338b225ddec22c7826))

## [1.0.3](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.0.2...v1.0.3) (2025-12-14)


### Bug Fixes

* change aw paramter order ([d42dfc5](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/d42dfc5b6f298939edcc5fa3208c5601f042d503))
* start preparation until maximum setting ([ed2feb2](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/ed2feb2f3a7fab53422e47481d3d44dfddf4a53b))

## [1.0.2](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.0.1...v1.0.2) (2025-12-14)


### Bug Fixes

* failed to get all fields ([f236af7](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/f236af7cab059d8b63bc81743bd59127b28933cb))

## [1.0.1](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.0.0...v1.0.1) (2025-12-14)


### Bug Fixes

* failed to load PR and over 100 items ([dd1c216](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/dd1c2164e3ed1b8dcfa1b4de75395f875a8d0de2))

# 1.0.0 (2025-12-14)


### Features

* implement first version ([e696b0a](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/e696b0a9bdd614313d807c8cfad368b62e471b5e))

## [1.0.8](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.0.7...v1.0.8) (2025-01-28)


### Bug Fixes

* avoid to trigger initialize job in template repo ([d73e95c](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/d73e95c709f3dabab5712cef45da1abc9a2589ba))

## [1.0.7](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.0.6...v1.0.7) (2025-01-25)


### Bug Fixes

* **deps:** update dependency commander to v13.1.0 ([dde16f1](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/dde16f102132c30b6a801d3cbf266992cdf9f86a))

## [1.0.6](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/compare/v1.0.5...v1.0.6) (2025-01-11)


### Bug Fixes

* **deps:** update dependency commander to v13 ([836ba31](https://github.com/HiromiShikata/npm-cli-gh-issue-preparator/commit/836ba310db09c24a2ecbfaca27ee34577e209d48))
