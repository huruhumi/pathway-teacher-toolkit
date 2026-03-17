function createScriptLogger(tag) {
    const prefix = `[${tag}]`;

    return {
        info(message) {
            console.log(`${prefix} ${message}`);
        },
        warn(message) {
            console.warn(`${prefix} ${message}`);
        },
        error(message) {
            console.error(`${prefix} ${message}`);
        },
    };
}

module.exports = {
    createScriptLogger,
};
