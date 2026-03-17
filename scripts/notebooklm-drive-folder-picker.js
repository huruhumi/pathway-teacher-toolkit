const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const readline = require('readline/promises');
const { stdin: input, stdout: output } = require('process');
const { GoogleAuth } = require('google-auth-library');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'packages', 'shared', 'config', 'textbook-level-registry.json');
const DEFAULT_CREDENTIALS_PATH = path.join(ROOT, '.secrets', 'google-drive-service-account.json');

const FAMILY_KEYS = ['trailblazer', 'reflect', 'pathways'];

const IMPORTABLE_MIME_MAP = {
    'application/vnd.google-apps.document': 'google-doc',
    'application/vnd.google-apps.presentation': 'google-slides',
    'application/vnd.google-apps.spreadsheet': 'google-sheets',
    'application/pdf': 'pdf',
};

function parseArgs(argv) {
    const args = {
        folder: '',
        family: '',
        level: '',
        dryRun: false,
        maxFiles: 5000,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === '--folder') {
            args.folder = (argv[i + 1] || '').trim();
            i += 1;
        } else if (token === '--family') {
            args.family = (argv[i + 1] || '').trim().toLowerCase();
            i += 1;
        } else if (token === '--level') {
            args.level = (argv[i + 1] || '').trim();
            i += 1;
        } else if (token === '--max-files') {
            const n = Number(argv[i + 1] || 5000);
            args.maxFiles = Number.isFinite(n) && n > 0 ? Math.floor(n) : 5000;
            i += 1;
        } else if (token === '--dry-run') {
            args.dryRun = true;
        } else if (token === '--help' || token === '-h') {
            printHelp();
            process.exit(0);
        }
    }

    return args;
}

function printHelp() {
    console.log('NotebookLM Drive folder picker');
    console.log('');
    console.log('Usage:');
    console.log('  npm run nlm:folder-pick');
    console.log('  npm run nlm:folder-pick -- --family trailblazer --folder <drive_folder_url>');
    console.log('  npm run nlm:folder-pick -- --family reflect --level reflect-3 --folder <id> --dry-run');
    console.log('');
    console.log('Options:');
    console.log('  --folder <drive_folder_id_or_url>');
    console.log('  --family trailblazer|reflect|pathways');
    console.log('  --level levelKey[,levelKey2]');
    console.log('  --max-files 5000');
    console.log('  --dry-run');
}

function readReadyLevels() {
    const all = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    return all.filter((entry) => entry.status === 'ready' && entry.notebookId);
}

function extractFolderId(raw) {
    const text = (raw || '').trim();
    if (!text) return '';
    const m = text.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    if (/^[a-zA-Z0-9_-]{10,}$/.test(text)) return text;
    return '';
}

async function promptIfMissing(args, readyLevels) {
    const rl = readline.createInterface({ input, output });
    try {
        if (!args.family || !FAMILY_KEYS.includes(args.family)) {
            console.log('');
            console.log('Choose textbook family:');
            console.log('1) trailblazer');
            console.log('2) reflect');
            console.log('3) pathways');
            const choice = (await rl.question('Enter 1/2/3 [1]: ')).trim() || '1';
            const map = { '1': 'trailblazer', '2': 'reflect', '3': 'pathways' };
            args.family = map[choice] || 'trailblazer';
        }

        if (!args.folder) {
            console.log('');
            args.folder = (await rl.question('Paste Google Drive folder URL or folder ID: ')).trim();
        }

        const familyLevels = readyLevels.filter((entry) => entry.levelKey.startsWith(`${args.family}-`));
        if (!args.level) {
            console.log('');
            console.log(`Levels in ${args.family}:`);
            familyLevels.forEach((entry, idx) => {
                console.log(`${idx + 1}) ${entry.levelKey} - ${entry.displayName}`);
            });
            const typed = (await rl.question('Choose levels (all / 1,2 / levelKey): ')).trim() || 'all';
            if (typed.toLowerCase() === 'all') {
                args.level = familyLevels.map((entry) => entry.levelKey).join(',');
            } else {
                const tokens = parseCsv(typed);
                const selected = [];
                for (const token of tokens) {
                    const asIndex = Number(token);
                    if (!Number.isNaN(asIndex) && asIndex >= 1 && asIndex <= familyLevels.length) {
                        selected.push(familyLevels[asIndex - 1].levelKey);
                    } else {
                        selected.push(token);
                    }
                }
                args.level = [...new Set(selected)].join(',');
            }
        }
    } finally {
        rl.close();
    }
}

async function buildAccessToken() {
    const keyFileFromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';
    const keyFile = keyFileFromEnv && fs.existsSync(keyFileFromEnv)
        ? keyFileFromEnv
        : (fs.existsSync(DEFAULT_CREDENTIALS_PATH) ? DEFAULT_CREDENTIALS_PATH : '');

    const auth = new GoogleAuth({
        keyFile: keyFile || undefined,
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    try {
        const client = await auth.getClient();
        const token = await client.getAccessToken();
        const text = typeof token === 'string' ? token : token?.token;
        if (!text) {
            throw new Error('empty token');
        }
        return text;
    } catch (error) {
        const baseMessage = String(error?.message || error);
        throw new Error(
            `Google Drive authentication failed. ${baseMessage}\n` +
            `Fix options:\n` +
            `1) Put service account JSON at: ${DEFAULT_CREDENTIALS_PATH}\n` +
            `2) Or set env GOOGLE_APPLICATION_CREDENTIALS to your JSON path\n` +
            `3) Share the target Drive folder with that service account email (Viewer).`
        );
    }
}

async function driveRequest(token, pathPart, queryParams = {}) {
    const url = new URL(`https://www.googleapis.com/drive/v3/${pathPart}`);
    Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, String(value));
        }
    });

    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = data?.error?.message || `HTTP ${res.status}`;
        throw new Error(`Drive API error: ${msg}`);
    }
    return data;
}

async function listFolderFilesRecursively(token, rootFolderId, maxFiles) {
    const rootMeta = await driveRequest(token, `files/${rootFolderId}`, {
        fields: 'id,name,mimeType',
        supportsAllDrives: 'true',
    });

    if (rootMeta.mimeType !== 'application/vnd.google-apps.folder') {
        throw new Error('Provided ID is not a Drive folder.');
    }

    const folders = [{ id: rootMeta.id, path: rootMeta.name }];
    const visitedFolders = new Set();
    const files = [];

    while (folders.length > 0) {
        const current = folders.shift();
        if (visitedFolders.has(current.id)) continue;
        visitedFolders.add(current.id);

        let pageToken = '';
        do {
            const page = await driveRequest(token, 'files', {
                q: `'${current.id}' in parents and trashed = false`,
                pageSize: 1000,
                pageToken,
                includeItemsFromAllDrives: 'true',
                supportsAllDrives: 'true',
                fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime,shortcutDetails)',
            });

            for (const item of page.files || []) {
                const mimeType = item.mimeType;
                if (mimeType === 'application/vnd.google-apps.folder') {
                    folders.push({ id: item.id, path: `${current.path}/${item.name}` });
                    continue;
                }

                if (mimeType === 'application/vnd.google-apps.shortcut') {
                    const targetId = item.shortcutDetails?.targetId;
                    const targetMime = item.shortcutDetails?.targetMimeType;
                    if (targetMime === 'application/vnd.google-apps.folder') {
                        if (targetId) folders.push({ id: targetId, path: `${current.path}/${item.name}` });
                        continue;
                    }
                    files.push({
                        id: targetId || item.id,
                        name: item.name,
                        mimeType: targetMime || mimeType,
                        size: item.size ? Number(item.size) : 0,
                        modifiedTime: item.modifiedTime || '',
                        path: current.path,
                        isShortcut: true,
                    });
                } else {
                    files.push({
                        id: item.id,
                        name: item.name,
                        mimeType,
                        size: item.size ? Number(item.size) : 0,
                        modifiedTime: item.modifiedTime || '',
                        path: current.path,
                        isShortcut: false,
                    });
                }

                if (files.length >= maxFiles) {
                    return { rootName: rootMeta.name, files, truncated: true };
                }
            }

            pageToken = page.nextPageToken || '';
        } while (pageToken);
    }

    return { rootName: rootMeta.name, files, truncated: false };
}

function parseCsv(raw) {
    return (raw || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

function normalizeText(text) {
    return (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function parseLevelNeedle(displayName) {
    const base = displayName.replace(/\([^)]*\)/g, '').trim();
    return normalizeText(base);
}

function splitSelection(raw, maxIndex) {
    const text = (raw || '').trim().toLowerCase();
    if (!text || text === 'all') return Array.from({ length: maxIndex }, (_, i) => i + 1);
    if (text === 'none') return [];

    const result = new Set();
    const parts = text.split(',').map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
        const range = part.match(/^(\d+)-(\d+)$/);
        if (range) {
            const a = Number(range[1]);
            const b = Number(range[2]);
            const start = Math.min(a, b);
            const end = Math.max(a, b);
            for (let i = start; i <= end; i += 1) {
                if (i >= 1 && i <= maxIndex) result.add(i);
            }
            continue;
        }
        const n = Number(part);
        if (!Number.isNaN(n) && n >= 1 && n <= maxIndex) {
            result.add(n);
        }
    }
    return [...result].sort((a, b) => a - b);
}

function toNotebookMime(driveMime) {
    return IMPORTABLE_MIME_MAP[driveMime] || null;
}

function formatBytes(bytes) {
    const b = Number(bytes) || 0;
    if (b <= 0) return '-';
    if (b < 1024) return `${b}B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)}MB`;
    return `${(b / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}

function runNotebooklmAddDrive({ fileId, title, notebookId, mimeType, dryRun }) {
    const args = ['source', 'add-drive', fileId, title, '-n', notebookId, '--mime-type', mimeType];
    if (dryRun) {
        console.log(`[dry-run] notebooklm ${args.join(' ')}`);
        return { ok: true };
    }
    const result = spawnSync('notebooklm', args, {
        cwd: ROOT,
        encoding: 'utf8',
    });
    if (result.status !== 0) {
        return { ok: false, error: (result.stderr || result.stdout || 'Unknown notebooklm error').trim() };
    }
    return { ok: true };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const readyLevels = readReadyLevels();
    await promptIfMissing(args, readyLevels);

    const folderId = extractFolderId(args.folder);
    if (!folderId) {
        throw new Error('Invalid Drive folder URL/ID.');
    }

    const selectedLevelKeys = parseCsv(args.level);
    const levelsByKey = new Map(readyLevels.map((entry) => [entry.levelKey, entry]));
    const selectedLevels = selectedLevelKeys
        .map((key) => levelsByKey.get(key))
        .filter((entry) => !!entry && entry.levelKey.startsWith(`${args.family}-`));

    if (selectedLevels.length === 0) {
        throw new Error('No valid levels selected in this family.');
    }

    console.log('\n[step] Reading Drive folder files recursively...');
    const token = await buildAccessToken();
    const { rootName, files, truncated } = await listFolderFilesRecursively(token, folderId, args.maxFiles);
    console.log(`[ok] Folder: ${rootName}, files scanned: ${files.length}${truncated ? ' (truncated by max-files)' : ''}`);

    const familyNeedle = normalizeText(args.family);
    const importableFiles = files
        .filter((f) => toNotebookMime(f.mimeType))
        .filter((f) => normalizeText(`${f.path} ${f.name}`).includes(familyNeedle));

    if (importableFiles.length === 0) {
        console.log('[warn] No importable files found for selected family in this folder.');
        return;
    }

    const levelNeedles = selectedLevels.map((entry) => ({
        entry,
        needle: parseLevelNeedle(entry.displayName),
    }));

    const grouped = new Map(selectedLevels.map((entry) => [entry.levelKey, []]));
    const unmatched = [];

    for (const file of importableFiles) {
        const hay = normalizeText(`${file.path} ${file.name}`);
        const matched = levelNeedles
            .filter((item) => item.needle && hay.includes(item.needle))
            .sort((a, b) => b.needle.length - a.needle.length)[0];
        if (matched) {
            grouped.get(matched.entry.levelKey).push(file);
        } else {
            unmatched.push(file);
        }
    }

    console.log('\n[summary] Matched files by level:');
    selectedLevels.forEach((entry, idx) => {
        const count = grouped.get(entry.levelKey).length;
        console.log(`${idx + 1}) ${entry.levelKey} - ${entry.displayName}: ${count}`);
    });
    console.log(`unmatched: ${unmatched.length}`);

    const rl = readline.createInterface({ input, output });
    let totalImported = 0;
    let totalFailed = 0;
    try {
        for (const entry of selectedLevels) {
            const filesForLevel = grouped.get(entry.levelKey);
            if (!filesForLevel || filesForLevel.length === 0) continue;

            console.log(`\n[level] ${entry.levelKey} -> ${entry.notebookId}`);
            filesForLevel.forEach((file, i) => {
                const mime = toNotebookMime(file.mimeType);
                console.log(
                    `${i + 1}. [${mime}] ${file.path}/${file.name} (${formatBytes(file.size)})${file.isShortcut ? ' [shortcut]' : ''}`
                );
            });

            const typed = await rl.question('Choose files (all / none / 1,2,5-8) [all]: ');
            const picks = splitSelection(typed || 'all', filesForLevel.length);
            if (picks.length === 0) {
                console.log('[skip] none selected');
                continue;
            }

            for (const pick of picks) {
                const file = filesForLevel[pick - 1];
                const notebookMime = toNotebookMime(file.mimeType);
                if (!notebookMime) continue;
                const title = file.name.length > 120 ? file.name.slice(0, 120) : file.name;
                const result = runNotebooklmAddDrive({
                    fileId: file.id,
                    title,
                    notebookId: entry.notebookId,
                    mimeType: notebookMime,
                    dryRun: args.dryRun,
                });
                if (result.ok) totalImported += 1;
                else {
                    totalFailed += 1;
                    console.log(`[fail] ${file.name}: ${result.error}`);
                }
            }
        }
    } finally {
        rl.close();
    }

    console.log('\n[done] Folder picker import finished.');
    console.log(`- Imported: ${totalImported}`);
    console.log(`- Failed: ${totalFailed}`);
    if (unmatched.length > 0) {
        console.log(`- Unmatched files (not auto-assigned to selected levels): ${unmatched.length}`);
    }
}

main().catch((error) => {
    console.error(`[error] ${error?.message || error}`);
    process.exit(1);
});
