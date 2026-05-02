#!/usr/bin/env node
import { Command } from 'commander';
type ConfigFile = {
  projectUrl?: string;
  awaitingWorkspaceStatus?: string;
  preparationStatus?: string;
  defaultAgentName?: string;
  defaultLlmModelName?: string;
  defaultLlmAgentName?: string;
  logFilePath?: string;
  maximumPreparingIssuesCount?: number;
  utilizationPercentageThreshold?: number;
  allowedIssueAuthors?: string;
  awaitingQualityCheckStatus?: string;
  thresholdForAutoReject?: number;
  workflowBlockerResolvedWebhookUrl?: string;
};
declare const loadConfigFile: (configFilePath: string) => ConfigFile;
declare const parseProjectReadmeConfig: (readme: string) => ConfigFile;
declare const mergeConfigs: (
  configFile: ConfigFile,
  cliOverrides: ConfigFile,
  readmeOverrides: ConfigFile,
) => ConfigFile;
declare const program: Command;
export { program, loadConfigFile, parseProjectReadmeConfig, mergeConfigs };
//# sourceMappingURL=index.d.ts.map
