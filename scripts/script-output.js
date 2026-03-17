function printBlankLine() {
    console.log('');
}

function printSection(title) {
    console.log(title);
}

function printAlignedUrls(items, { nameWidth = 8 } = {}) {
    for (const item of items) {
        console.log(`${item.name.padEnd(nameWidth)} ${item.url}`);
    }
}

module.exports = {
    printBlankLine,
    printSection,
    printAlignedUrls,
};
