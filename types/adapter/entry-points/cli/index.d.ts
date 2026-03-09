#!/usr/bin/env node
import { Command } from 'commander';
type ConfigFile = {
  projectUrl?: string;
  awaitingWorkspaceStatus?: string;
  preparationStatus?: string;
  defaultAgentName?: string;
  logFilePath?: string;
  maximumPreparingIssuesCount?: number;
  utilizationPercentageThreshold?: number;
  allowedIssueAuthors?: string;
  awaitingQualityCheckStatus?: string;
  thresholdForAutoReject?: number;
  workflowBlockerResolvedWebhookUrl?: string;
};
declare const loadConfigFile: (configFilePath: string) => ConfigFile;
declare const program: Command;
export { program, loadConfigFile };
//# sourceMappingURL=index.d.ts.map
