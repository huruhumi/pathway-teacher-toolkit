const { APPS } = require('./app-registry');
const { SCRIPT_DEFAULTS } = require('./script-defaults');
const {
    toWorkspaceApps,
    parsePositiveIntEnv,
    readAppSelection,
    exitIfEmptySelection,
    runSequentialAppTask,
    runMain,
} = require('./app-task-runner');

/**
 * Sequential app typecheck runner.
 *
 * Optional environment overrides:
 * - TYPECHECK_APPS=planner,essay
 * - TYPECHECK_MAX_OLD_SPACE=2048
 */

const apps = toWorkspaceApps(APPS);

const maxOldSpace = parsePositiveIntEnv('TYPECHECK_MAX_OLD_SPACE', SCRIPT_DEFAULTS.typecheck.maxOldSpaceMb);
const { rawValue: appFilterRaw, selected: filteredApps } = readAppSelection({
    apps,
    envName: 'TYPECHECK_APPS',
});

async function main() {
    exitIfEmptySelection({
        tag: 'typecheck',
        envName: 'TYPECHECK_APPS',
        filterValue: appFilterRaw,
        selected: filteredApps,
    });

    await runSequentialAppTask({
        tag: 'typecheck',
        actionLabel: 'Checking',
        summaryNoun: 'checks',
        apps: filteredApps,
        maxOldSpace,
        createNpmArgs() {
            return ['exec', '--', 'tsc', '--noEmit'];
        },
    });
}

runMain('typecheck', main);
