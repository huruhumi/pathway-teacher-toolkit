/**
 * Local NotebookLM MCP Proxy Server
 * 
 * Runs on localhost:3199 and proxies research requests to NotebookLM
 * via the notebooklm-mcp tools (using the stored cookies).
 * 
 * Usage: node scripts/nlm-proxy.mjs
 * 
 * Only for local development — NotebookLM has no public API,
 * so this proxy reads cookies from ~/.notebooklm-mcp/auth.json
 */

import { readFileSync } from 'fs';
import { createServer } from 'http';
import { join } from 'path';
import { homedir } from 'os';

const PORT = 3199;

// --- Cookie management ---
function loadCookies() {
    const authPath = join(homedir(), '.notebooklm-mcp', 'auth.json');
    try {
        const raw = JSON.parse(readFileSync(authPath, 'utf-8'));
        if (raw.cookies && typeof raw.cookies === 'object') {
            return Object.entries(raw.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
        }
        return raw.cookies || '';
    } catch (e) {
        console.error('Failed to load cookies from', authPath);
        throw new Error('NotebookLM cookies not found. Run: notebooklm-mcp-auth');
    }
}

// --- NotebookLM internal API ---
const NLM_BASE = 'https://notebooklm.google.com';

async function nlmFetch(path, body, cookies) {
    // NotebookLM uses a specific RPC-style API
    const resp = await fetch(`${NLM_BASE}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-protobuf',
            'Cookie': cookies,
            'Origin': NLM_BASE,
            'Referer': `${NLM_BASE}/`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'X-Goog-Encode-Response-If-Executable': 'base64',
        },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`NLM ${resp.status}: ${text.slice(0, 200)}`);
    }
    return resp;
}

// --- Use the notebooklm-mcp CLI as subprocess instead ---
// Since NLM's internal API uses protobuf and is hard to reverse-engineer,
// we use the MCP tools via the npm package directly.

import { spawn } from 'child_process';

function runMcpCommand(args) {
    return new Promise((resolve, reject) => {
        // Use npx to run the MCP tool commands
        const proc = spawn('npx', ['notebooklm-mcp', ...args], {
            shell: true,
            timeout: 600000, // 10 min max
        });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', d => stdout += d);
        proc.stderr.on('data', d => stderr += d);
        proc.on('close', code => {
            if (code === 0) resolve(JSON.parse(stdout || '{}'));
            else reject(new Error(`MCP exit ${code}: ${stderr}`));
        });
    });
}

// --- Instead of shelling out to MCP, use the notebooklm-py REST wrapper ---
// The notebooklm-mcp server exposes tools, not a REST API.
// Simplest approach: use fetch to call the notebooklm.google.com UI endpoints
// that the browser uses (JSON-based, not protobuf).

// Actually, the most reliable approach for local use:
// Use the MCP server that's already running in the Claude Code environment.
// But we can't call MCP from a plain Node.js server.

// PRAGMATIC SOLUTION: Use the Gemini API with google_search grounding
// for the "fast" path, and for the "deep" path, make multiple sequential
// grounded queries that simulate deep research by exploring sub-topics.

async function deepResearch(apiKey, topic, lessonPrompts) {
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    // Phase 1: Deep exploration - get comprehensive sub-topics
    console.log(`[deep] Phase 1: Exploring sub-topics for "${topic}"...`);
    const explorationResp = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                role: 'user', parts: [{
                    text:
                        `Research the following topic thoroughly: "${topic}"\n` +
                        `Search for comprehensive information including:\n` +
                        `1. Key scientific/educational facts\n` +
                        `2. Local ecological and geographical context\n` +
                        `3. Historical background\n` +
                        `4. Safety considerations for outdoor education\n` +
                        `5. Seasonal and weather-related notes\n` +
                        `6. Cultural significance\n` +
                        `7. Related educational activities and STEAM connections\n\n` +
                        `Provide a comprehensive research summary with all sources cited as [1], [2], etc.\n` +
                        `Write in the same language as the topic. Be thorough - aim for 2000+ words.`
                }]
            }],
            tools: [{ google_search: {} }],
            systemInstruction: {
                parts: [{
                    text:
                        'You are a thorough research assistant. Search extensively and cite ALL sources. ' +
                        'Do NOT make up facts. Every claim must come from a search result. ' +
                        'Include source URLs at the end.'
                }]
            },
        }),
    });

    if (!explorationResp.ok) {
        const err = await explorationResp.text();
        throw new Error(`Gemini exploration failed: ${err.slice(0, 200)}`);
    }

    const explorationData = await explorationResp.json();
    const explorationContent = explorationData.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    const explorationUrls = extractGroundingUrls(explorationData);

    console.log(`[deep] Phase 1 complete: ${explorationUrls.length} sources found`);

    // Phase 2: Generate per-lesson fact sheets with the exploration as context
    const factSheets = [];
    const allUrls = new Set(explorationUrls);

    for (let i = 0; i < lessonPrompts.length; i++) {
        console.log(`[deep] Phase 2: Generating fact sheet ${i + 1}/${lessonPrompts.length}...`);
        if (i > 0) await sleep(1500);

        const resp = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        role: 'user', parts: [{
                            text:
                                `Here is comprehensive research about "${topic}":\n\n${explorationContent}\n\n---\n\n` +
                                `Based on the research above AND additional search if needed:\n${lessonPrompts[i]}`
                        }]
                    },
                ],
                tools: [{ google_search: {} }],
                systemInstruction: {
                    parts: [{
                        text:
                            'You are generating a factual background knowledge sheet for a specific lesson. ' +
                            'PRIORITIZE the research context provided, then supplement with additional search. ' +
                            'Cite all sources with [1], [2] etc. Do NOT make up facts.'
                    }]
                },
            }),
        });

        if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`Gemini fact sheet ${i + 1} failed: ${err.slice(0, 200)}`);
        }

        const data = await resp.json();
        const content = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
        const urls = extractGroundingUrls(data);
        urls.forEach(u => allUrls.add(u));

        const citations = content.match(/\[\d+\]/g) || [];
        const citationCount = new Set(citations).size;
        const totalSignals = urls.length + citationCount;

        factSheets.push({
            content: content.slice(0, 20000),
            citationCount,
            quality: totalSignals >= 5 ? 'good' : totalSignals >= 2 ? 'low' : 'insufficient',
            sourceRefs: urls.slice(0, 10),
            groundingUrls: urls,
        });
    }

    return {
        factSheets,
        sources: [...allUrls].map(url => ({ title: new URL(url).hostname, url })),
        explorationContent: explorationContent.slice(0, 5000),
    };
}

function extractGroundingUrls(data) {
    const urls = [];
    const meta = data.candidates?.[0]?.groundingMetadata;
    if (meta?.groundingChunks) {
        for (const chunk of meta.groundingChunks) {
            if (chunk.web?.uri) urls.push(chunk.web.uri);
        }
    }
    return [...new Set(urls)];
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function runNotebookLMAuthCheck({ test = true } = {}) {
    return new Promise((resolve, reject) => {
        const args = ['auth', 'check', '--json'];
        if (test) args.push('--test');
        const proc = spawn('notebooklm', args, {
            shell: true,
            timeout: 120000,
        });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { stderr += d.toString(); });
        proc.on('close', (code) => {
            const raw = (stdout || '').trim();
            if (!raw) {
                if (code === 0) return resolve({ ok: false, needsLogin: true, message: 'NotebookLM auth check returned empty output.', details: { stderr } });
                return reject(new Error(`auth check failed (${code}): ${stderr || 'empty output'}`));
            }
            try {
                const parsed = JSON.parse(raw);
                const status = parsed?.status;
                const tokenFetch = parsed?.checks?.token_fetch;
                const detailsError = String(parsed?.details?.error || '').toLowerCase();
                const authExpired =
                    status !== 'ok'
                    || tokenFetch === false
                    || detailsError.includes('authentication expired')
                    || detailsError.includes('accounts.google.com')
                    || detailsError.includes('redirected to:');
                const message = authExpired
                    ? 'NotebookLM 登录状态无效或已过期，请先执行: notebooklm login'
                    : 'NotebookLM auth check passed';
                resolve({
                    ok: !authExpired,
                    needsLogin: authExpired,
                    message,
                    details: parsed,
                });
            } catch (e) {
                if (code === 0) {
                    resolve({
                        ok: false,
                        needsLogin: true,
                        message: 'NotebookLM auth check returned non-JSON output. Please run: notebooklm login',
                        details: { stdout: raw, stderr },
                    });
                    return;
                }
                reject(new Error(`auth check parse failed (${code}): ${stderr || raw}`));
            }
        });
    });
}

// --- HTTP Server ---
function loadApiKey() {
    // Try .env file
    try {
        const envPath = join(process.cwd(), '.env');
        const env = readFileSync(envPath, 'utf-8');
        const match = env.match(/VITE_GEMINI_API_KEY=(.+)/);
        if (match) return match[1].trim();
    } catch { }
    // Try env var
    return process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
}

const server = createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (req.method !== 'POST') { res.writeHead(405); res.end('Method not allowed'); return; }

    let body = '';
    for await (const chunk of req) body += chunk;

    try {
        const parsed = JSON.parse(body);
        const { action } = parsed;

        // --- auth-check: preflight NotebookLM auth validity ---
        if (action === 'auth-check') {
            const result = await runNotebookLMAuthCheck({ test: true });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            return;
        }

        // --- export-slides: SSE stream ---
        if (action === 'export-slides') {
            const { title, handbookPages, stylePrompt, factSheet, factSheetMeta, structurePlan, language, mode, versionPref, roadmapJson } = parsed;
            if (!title || !handbookPages?.length) throw new Error('Missing title or handbookPages');

            // Write input to temp file
            const inputPath = join(process.cwd(), `tmp_export_input_${Date.now()}.json`);
            const outputPath = join(process.cwd(), `tmp_export_output_${Date.now()}.json`);
            const { writeFileSync, unlinkSync, existsSync, readFileSync: readSync } = await import('fs');
            writeFileSync(inputPath, JSON.stringify({ title, handbookPages, stylePrompt, factSheet, factSheetMeta, structurePlan, language, mode, versionPref, roadmapJson }), 'utf-8');
            writeFileSync(outputPath, JSON.stringify({ status: 'starting', progress: 0, message: '启动导出...' }), 'utf-8');

            // SSE headers
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            });

            const sendSSE = (data) => {
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            };

            sendSSE({ status: 'starting', progress: 0, message: '启动 Python 导出进程...' });

            // Spawn Python worker (quote paths for spaces)
            const scriptPath = join(process.cwd(), 'scripts', 'nlm-export-slides.py');
            const proc = spawn('python', [`"${scriptPath}"`, '--input', `"${inputPath}"`, '--output', `"${outputPath}"`], {
                shell: true,
                stdio: ['ignore', 'pipe', 'pipe'],
                timeout: 20 * 60 * 1000, // 20 min
            });

            let lastStatus = '';
            proc.stdout.on('data', d => console.log('[py]', d.toString().trim()));
            proc.stderr.on('data', d => console.error('[py:err]', d.toString().trim()));

            // Poll output file for progress
            const pollInterval = setInterval(() => {
                try {
                    if (existsSync(outputPath)) {
                        const raw = readSync(outputPath, 'utf-8');
                        if (raw !== lastStatus) {
                            lastStatus = raw;
                            const data = JSON.parse(raw);
                            sendSSE(data);
                            if (data.status === 'done' || data.status === 'error') {
                                clearInterval(pollInterval);
                            }
                        }
                    }
                } catch { /* ignore parse errors during write */ }
            }, 2000);

            proc.on('close', (code) => {
                clearInterval(pollInterval);
                // Send final status
                try {
                    const raw = readSync(outputPath, 'utf-8');
                    const data = JSON.parse(raw);
                    sendSSE(data);
                } catch {
                    sendSSE({ status: 'error', progress: 0, message: `Python 进程退出 (code ${code})` });
                }
                res.end();
                // Cleanup temp files
                try { unlinkSync(inputPath); } catch { }
                try { unlinkSync(outputPath); } catch { }
            });

            // Handle client disconnect
            req.on('close', () => {
                clearInterval(pollInterval);
                proc.kill();
                try { unlinkSync(inputPath); } catch { }
                try { unlinkSync(outputPath); } catch { }
            });

            return; // Don't fall through to JSON response
        }

        // --- ensure-resource-guide: check/generate resource guide in notebook ---
        if (action === 'ensure-resource-guide') {
            const { notebookId, userInput } = parsed;
            if (!notebookId) throw new Error('Missing notebookId');

            const scriptPath = join(process.cwd(), 'scripts', 'nlm-resource-guide.py');
            const { existsSync } = await import('fs');
            if (!existsSync(scriptPath)) throw new Error('nlm-resource-guide.py not found');

            // Set API key env for the Python script
            const apiKey = loadApiKey();
            const env = { ...process.env };
            if (apiKey) env.GEMINI_API_KEY = apiKey;

            // Step 1: Check if guide exists
            console.log(`[guide] Checking resource guide for notebook ${notebookId}...`);
            const checkArgs = ['python', [`"${scriptPath}"`, 'check', notebookId], { shell: true, env }];
            const checkResult = await new Promise((resolve, reject) => {
                const proc = spawn(...checkArgs);
                let stdout = '', stderr = '';
                proc.stdout.on('data', d => stdout += d.toString());
                proc.stderr.on('data', d => { stderr += d.toString(); console.log('[guide:check]', d.toString().trim()); });
                proc.on('close', code => {
                    if (code !== 0) return reject(new Error(`Check failed (${code}): ${stderr}`));
                    try { resolve(JSON.parse(stdout.trim())); }
                    catch { reject(new Error(`Bad JSON: ${stdout}`)); }
                });
            });

            if (checkResult.error) throw new Error(checkResult.error);

            if (checkResult.exists) {
                console.log(`[guide] Guide already exists: ${checkResult.sourceId}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'exists', sourceId: checkResult.sourceId }));
                return;
            }

            // Step 2: Generate guide
            console.log(`[guide] No guide found. Generating for ${checkResult.sourcesCount} sources...`);
            const genArgs = ['python', [`"${scriptPath}"`, 'generate', notebookId]];
            if (userInput) {
                genArgs[1].push('--user-input', `'${JSON.stringify(userInput)}'`);
            }
            const genResult = await new Promise((resolve, reject) => {
                const proc = spawn(genArgs[0], genArgs[1], { shell: true, env, timeout: 5 * 60 * 1000 });
                let stdout = '', stderr = '';
                proc.stdout.on('data', d => stdout += d.toString());
                proc.stderr.on('data', d => { stderr += d.toString(); console.log('[guide:gen]', d.toString().trim()); });
                proc.on('close', code => {
                    if (code !== 0) return reject(new Error(`Generate failed (${code}): ${stderr}`));
                    try { resolve(JSON.parse(stdout.trim())); }
                    catch { reject(new Error(`Bad JSON: ${stdout}`)); }
                });
            });

            if (genResult.error) throw new Error(genResult.error);

            console.log(`[guide] Guide created: ${genResult.sourceId} (${genResult.guideLength} chars)`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(genResult));
            return;
        }

        // --- read-resource-guide: read full content of Resource Guide from notebook ---
        if (action === 'read-resource-guide') {
            const { notebookId } = parsed;
            if (!notebookId) throw new Error('Missing notebookId');

            const scriptPath = join(process.cwd(), 'scripts', 'nlm-resource-guide.py');
            const { existsSync } = await import('fs');
            if (!existsSync(scriptPath)) throw new Error('nlm-resource-guide.py not found');

            const apiKey = loadApiKey();
            const env = { ...process.env };
            if (apiKey) env.GEMINI_API_KEY = apiKey;

            console.log(`[read-guide] Reading resource guide from notebook ${notebookId}...`);
            const result = await new Promise((resolve, reject) => {
                const proc = spawn('python', [`"${scriptPath}"`, 'read', notebookId], { shell: true, env, timeout: 3 * 60 * 1000 });
                let stdout = '', stderr = '';
                proc.stdout.on('data', d => stdout += d.toString());
                proc.stderr.on('data', d => { stderr += d.toString(); console.log('[read-guide]', d.toString().trim()); });
                proc.on('close', code => {
                    if (code !== 0) return reject(new Error(`Read failed (${code}): ${stderr}`));
                    try { resolve(JSON.parse(stdout.trim())); }
                    catch { reject(new Error(`Bad JSON from read: ${stdout.slice(0, 200)}`)); }
                });
            });

            console.log(`[read-guide] Done: status=${result.status}, chars=${result.charCount}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            return;
        }

        // --- notebook-query: query notebook sources directly via NLM chat ---
        if (action === 'notebook-query') {
            const { notebookId, lessonPrompts } = parsed;
            if (!notebookId || !lessonPrompts?.length) throw new Error('Missing notebookId or lessonPrompts');

            const scriptPath = join(process.cwd(), 'scripts', 'nlm-resource-guide.py');
            const { existsSync } = await import('fs');
            if (!existsSync(scriptPath)) throw new Error('nlm-resource-guide.py not found');

            console.log(`[query] Querying notebook ${notebookId} with ${lessonPrompts.length} prompts...`);

            const promptsJson = JSON.stringify(lessonPrompts);
            const result = await new Promise((resolve, reject) => {
                const proc = spawn('python', [
                    `"${scriptPath}"`, 'query', notebookId,
                    '--prompts', `'${promptsJson}'`
                ], { shell: true, timeout: 5 * 60 * 1000 });
                let stdout = '', stderr = '';
                proc.stdout.on('data', d => stdout += d.toString());
                proc.stderr.on('data', d => { stderr += d.toString(); console.log('[query]', d.toString().trim()); });
                proc.on('close', code => {
                    if (code !== 0) return reject(new Error(`Query failed (${code}): ${stderr}`));
                    try { resolve(JSON.parse(stdout.trim())); }
                    catch { reject(new Error(`Bad JSON from query: ${stdout.slice(0, 200)}`)); }
                });
            });

            if (result.error) throw new Error(result.error);

            console.log(`[query] Done: ${result.factSheets?.length} fact sheets`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            return;
        }

        // --- Existing actions ---
        const { topic, lessonPrompts } = parsed;
        const apiKey = loadApiKey();
        if (!apiKey) throw new Error('No GEMINI_API_KEY found in .env');

        let result;

        if (action === 'full-pipeline') {
            if (!topic || !lessonPrompts?.length) throw new Error('Missing topic or lessonPrompts');
            result = await deepResearch(apiKey, topic, lessonPrompts);
        } else if (action === 'single-query') {
            // TODO: single query
            throw new Error('single-query not implemented yet');
        } else {
            throw new Error(`Unknown action: ${action}`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
    } catch (err) {
        console.error('Proxy error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
    }
});

server.listen(PORT, () => {
    console.log(`\n🔬 NLM Research Proxy running at http://localhost:${PORT}`);
    console.log(`   Mode: Gemini Deep Research (multi-pass search grounding)`);
    console.log(`   API Key: ${loadApiKey() ? '✅ Found' : '❌ Missing'}\n`);
});
