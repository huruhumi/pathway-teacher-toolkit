const { APPS } = require('./app-registry');
const { SCRIPT_DEFAULTS } = require('./script-defaults');
const {
    toWorkspaceApps,
    parsePositiveIntEnv,
    readAppSelection,
    runSequentialAppTask,
    runMain,
} = require('./app-task-runner');

/**
 * Staggered Build Runner
 *
 * Runs app builds sequentially with a configurable memory cap.
 * Override with BUILD_MAX_OLD_SPACE (in MB) and filter apps with BUILD_APPS=planner,essay.
 */

const apps = toWorkspaceApps(APPS);

const maxOldSpace = parsePositiveIntEnv('BUILD_MAX_OLD_SPACE', SCRIPT_DEFAULTS.build.maxOldSpaceMb);
const { selected: filteredApps } = readAppSelection({
    apps,
    envName: 'BUILD_APPS',
});

async function main() {
    await runSequentialAppTask({
        tag: 'build',
        actionLabel: 'Building',
        summaryNoun: 'builds',
        apps: filteredApps,
        maxOldSpace,
        createNpmArgs() {
            return ['run', 'build'];
        },
    });
}

runMain('build', main);
