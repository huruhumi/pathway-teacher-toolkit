const UUID_V4_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function randomHex(length: number): string {
    let result = '';
    while (result.length < length) {
        result += Math.floor(Math.random() * 16).toString(16);
    }
    return result.slice(0, length);
}

function fallbackUuidV4(): string {
    const part1 = randomHex(8);
    const part2 = randomHex(4);
    const part3 = `4${randomHex(3)}`;
    const variant = ['8', '9', 'a', 'b'][Math.floor(Math.random() * 4)];
    const part4 = `${variant}${randomHex(3)}`;
    const part5 = randomHex(12);
    return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

export function generateRecordId(): string {
    const c = globalThis.crypto as Crypto | undefined;
    if (c?.randomUUID) {
        return c.randomUUID();
    }
    return fallbackUuidV4();
}

export function isUuidLike(value?: string | null): boolean {
    if (!value) return false;
    return UUID_V4_REGEX.test(value);
}
