function parseReadyMarkers(raw, fallbackMarkers) {
    if (!raw || !String(raw).trim()) {
        return fallbackMarkers;
    }

    const markers = String(raw)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    return markers.length ? markers : fallbackMarkers;
}

function createReadinessDetector({
    markers = ['ready in', 'Local:'],
    extraMatchers = [],
} = {}) {
    return function isReadyOutput(text) {
        if (!text) return false;
        if (markers.some((marker) => text.includes(marker))) return true;
        if (extraMatchers.some((matcher) => matcher(text))) return true;
        return false;
    };
}

module.exports = {
    parseReadyMarkers,
    createReadinessDetector,
};
