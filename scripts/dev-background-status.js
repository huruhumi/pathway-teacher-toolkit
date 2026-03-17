const { readState, removeState, isPidRunning, OUT_LOG, ERR_LOG } = require('./dev-background-utils');

function main() {
    const state = readState();
    if (!state) {
        console.log('Dev stack is not running.');
        return;
    }

    if (!isPidRunning(state.pid)) {
        removeState();
        console.log('Dev stack is not running. Cleaned up stale PID state.');
        return;
    }

    console.log(`Dev stack is running (PID ${state.pid}).`);
    console.log(`Started: ${state.startedAt}`);
    console.log(`Logs:    ${OUT_LOG}`);
    console.log(`Errors:  ${ERR_LOG}`);
    console.log('Landing: http://localhost:3000/');
}

main();
