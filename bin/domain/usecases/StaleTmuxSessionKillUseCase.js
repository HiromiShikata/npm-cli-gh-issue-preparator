"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaleTmuxSessionKillUseCase = exports.DEFAULT_IDLE_THRESHOLD_SECONDS = exports.DEFAULT_EXCLUDED_STATUS = void 0;
exports.DEFAULT_EXCLUDED_STATUS = 'In Tmux by human';
exports.DEFAULT_IDLE_THRESHOLD_SECONDS = 24 * 60 * 60;
class StaleTmuxSessionKillUseCase {
    constructor(projectRepository, issueRepository, localCommandRunner) {
        this.projectRepository = projectRepository;
        this.issueRepository = issueRepository;
        this.localCommandRunner = localCommandRunner;
        this.run = async (params) => {
            const liveSessions = await this.listLiveSessions();
            const project = await this.projectRepository.getByUrl(params.projectUrl);
            const openIssues = await this.issueRepository.getAllOpened(project);
            const issueBySessionName = new Map();
            for (const issue of openIssues) {
                issueBySessionName.set(this.deriveSessionName(issue.url), issue);
            }
            const nowEpochSeconds = Math.floor(params.now.getTime() / 1000);
            const killCandidates = [];
            for (const session of liveSessions) {
                const reason = this.evaluateKillReason(session, issueBySessionName.get(session.sessionName) ?? null, nowEpochSeconds, params.excludedStatus, params.idleThresholdSeconds);
                if (reason !== null) {
                    killCandidates.push({ sessionName: session.sessionName, reason });
                }
            }
            console.log(`Stale tmux session cleanup: ${killCandidates.length} kill candidate(s) of ${liveSessions.length} live session(s).`);
            for (const candidate of killCandidates) {
                console.log(`Kill candidate: ${candidate.sessionName} (${candidate.reason})`);
            }
            for (const candidate of killCandidates) {
                await this.localCommandRunner.runCommand('tmux', [
                    'kill-session',
                    '-t',
                    candidate.sessionName,
                ]);
                console.log(`Killed tmux session: ${candidate.sessionName} (${candidate.reason})`);
            }
        };
        this.listLiveSessions = async () => {
            const result = await this.localCommandRunner.runCommand('tmux', [
                'list-sessions',
                '-F',
                '#{session_name} #{session_activity}',
            ]);
            return result.stdout
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line.length > 0)
                .map((line) => {
                const separatorIndex = line.lastIndexOf(' ');
                const sessionName = line.slice(0, separatorIndex);
                const activityEpochSeconds = Number(line.slice(separatorIndex + 1));
                return { sessionName, activityEpochSeconds };
            });
        };
        this.deriveSessionName = (issueUrl) => issueUrl.replace(/[.:]/g, '_');
        this.evaluateKillReason = (session, issue, nowEpochSeconds, excludedStatus, idleThresholdSeconds) => {
            if (issue !== null) {
                if (issue.status !== excludedStatus) {
                    return `mapped to open issue ${issue.url} with status "${issue.status ?? 'null'}" which is not the excluded status "${excludedStatus}"`;
                }
                if (issue.nextActionDate !== null) {
                    return `mapped to open issue ${issue.url} which has a next action date set`;
                }
                if (issue.nextActionHour !== null) {
                    return `mapped to open issue ${issue.url} which has a next action hour set`;
                }
                return null;
            }
            const idleSeconds = nowEpochSeconds - session.activityEpochSeconds;
            if (idleSeconds >= idleThresholdSeconds) {
                return `maps to no open issue and has been idle for ${idleSeconds} seconds (threshold ${idleThresholdSeconds} seconds)`;
            }
            return null;
        };
    }
}
exports.StaleTmuxSessionKillUseCase = StaleTmuxSessionKillUseCase;
//# sourceMappingURL=StaleTmuxSessionKillUseCase.js.map