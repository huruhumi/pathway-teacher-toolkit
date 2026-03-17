const RESET = '\x1b[0m';

function createColoredTag({ color, name, suffix = '' } = {}) {
    return `${color}[${name}${suffix}]${RESET}`;
}

function logWithColoredTag({ color, name, message }) {
    console.log(`${createColoredTag({ color, name })} ${message}`);
}

function logErrorWithColoredTag({ color, name, message, suffix = '' }) {
    console.error(`${createColoredTag({ color, name, suffix })} ${message}`);
}

module.exports = {
    RESET,
    createColoredTag,
    logWithColoredTag,
    logErrorWithColoredTag,
};
