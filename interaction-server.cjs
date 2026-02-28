try { require('dotenv').config(); } catch(e) {}

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3001;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const SRC_DIR = path.join(__dirname, 'src');
const FEEDBACK_QUEUE_PATH = path.join(__dirname, 'feedbackQueue.json');
const KB_VERSIONS_PATH = path.join(DATA_DIR, 'kbVersions.json');
const SNAPSHOTS_DIR = path.join(DATA_DIR, 'snapshots');

// Initialize files
if (!fs.existsSync(path.join(DATA_DIR, 'processes.json'))) {
    const base = path.join(DATA_DIR, 'base_processes.json');
    if (fs.existsSync(base)) fs.copyFileSync(base, path.join(DATA_DIR, 'processes.json'));
}
if (!fs.existsSync(path.join(__dirname, 'interaction-signals.json'))) {
    fs.writeFileSync(path.join(__dirname, 'interaction-signals.json'), JSON.stringify({ APPROVE_REFUND_ADJUSTMENT: false }, null, 4));
}
if (!fs.existsSync(FEEDBACK_QUEUE_PATH)) fs.writeFileSync(FEEDBACK_QUEUE_PATH, '[]');
if (!fs.existsSync(KB_VERSIONS_PATH)) fs.writeFileSync(KB_VERSIONS_PATH, '[]');
if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });

let state = { sent: false, confirmed: false, signals: {} };
const runningProcesses = new Map();

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

const mimeTypes = {
    '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.webm': 'video/webm',
    '.mp4': 'video/mp4', '.woff': 'font/woff', '.woff2': 'font/woff2',
    '.md': 'text/markdown', '.ico': 'image/x-icon'
};

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch (e) { resolve(body); }
        });
        req.on('error', reject);
    });
}

async function callGemini(messages, systemPrompt) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: process.env.VITE_MODEL || 'gemini-2.5-flash' });

    const chat = model.startChat({
        history: messages.slice(0, -1).map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        })),
        systemInstruction: systemPrompt
    });

    const lastMsg = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMsg.content);
    return result.response.text();
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const cleanPath = url.pathname;

    if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders);
        return res.end();
    }

    // --- RESET ---
    if (cleanPath === '/reset') {
        state = { sent: false, confirmed: false, signals: {} };
        console.log('Demo Reset Triggered');

        const signalFile = path.join(__dirname, 'interaction-signals.json');
        fs.writeFileSync(signalFile, JSON.stringify({
            APPROVE_REFUND_ADJUSTMENT: false
        }, null, 4));

        runningProcesses.forEach((proc, id) => {
            try { process.kill(-proc.pid, 'SIGKILL'); } catch (e) { }
        });
        runningProcesses.clear();

        exec('pkill -9 -f "node(.*)simulation_scripts" || true', (err) => {
            setTimeout(() => {
                const processesPath = path.join(DATA_DIR, 'processes.json');
                const cases = [
                    {
                        id: "STR_001",
                        name: "Acme Corp Subscription Payment #4821",
                        category: "Payment Reconciliation",
                        stockId: "PAY-2026-001",
                        year: new Date().toISOString().split('T')[0],
                        status: "In Progress",
                        currentStatus: "Initializing...",
                        vendorName: "Acme Corp",
                        invoiceAmount: "$12,500.00",
                        paymentMethod: "Credit Card",
                        currency: "USD"
                    },
                    {
                        id: "STR_002",
                        name: "GlobalTech GmbH EUR Payment #7203",
                        category: "Payment Reconciliation",
                        stockId: "PAY-2026-002",
                        year: new Date().toISOString().split('T')[0],
                        status: "In Progress",
                        currentStatus: "Initializing...",
                        vendorName: "GlobalTech GmbH",
                        invoiceAmount: "€8,450.00",
                        paymentMethod: "Bank Transfer",
                        currency: "EUR"
                    },
                    {
                        id: "STR_003",
                        name: "TechStart Inc Disputed Payment #5590",
                        category: "Payment Reconciliation",
                        stockId: "PAY-2026-003",
                        year: new Date().toISOString().split('T')[0],
                        status: "In Progress",
                        currentStatus: "Initializing...",
                        vendorName: "TechStart Inc",
                        invoiceAmount: "$4,200.00",
                        paymentMethod: "ACH Transfer",
                        currency: "USD"
                    },
                    {
                        id: "STR_004",
                        name: "CloudServ LLC Partial Refund Mismatch",
                        category: "Payment Reconciliation",
                        stockId: "PAY-2026-004",
                        year: new Date().toISOString().split('T')[0],
                        status: "In Progress",
                        currentStatus: "Initializing...",
                        vendorName: "CloudServ LLC",
                        invoiceAmount: "$5,000.00",
                        paymentMethod: "Credit Card",
                        currency: "USD"
                    }
                ];
                fs.writeFileSync(processesPath, JSON.stringify(cases, null, 4));

                // Reset process log files
                cases.forEach(c => {
                    fs.writeFileSync(path.join(DATA_DIR, `process_${c.id}.json`), JSON.stringify({ logs: [], keyDetails: {}, sidebarArtifacts: [] }, null, 4));
                });

                fs.writeFileSync(FEEDBACK_QUEUE_PATH, '[]');
                fs.writeFileSync(KB_VERSIONS_PATH, '[]');

                const scripts = [
                    { file: 'stripe_story_1_happy_path.cjs', id: 'STR_001' },
                    { file: 'stripe_story_2_happy_path.cjs', id: 'STR_002' },
                    { file: 'stripe_story_3_needs_attention_email.cjs', id: 'STR_003' },
                    { file: 'stripe_story_4_needs_attention_signal.cjs', id: 'STR_004' }
                ];

                let totalDelay = 0;
                scripts.forEach((script) => {
                    setTimeout(() => {
                        const scriptPath = path.join(__dirname, 'simulation_scripts', script.file);
                        const child = exec(
                            `node "${scriptPath}" > "${scriptPath}.log" 2>&1`,
                            (error) => {
                                if (error && error.code !== 0) {
                                    console.error(`${script.file} error:`, error.message);
                                }
                                runningProcesses.delete(script.id);
                            }
                        );
                        runningProcesses.set(script.id, child);
                    }, totalDelay * 1000);
                    totalDelay += 2;
                });
            }, 1000);
        });

        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'ok' }));
    }

    // --- EMAIL STATUS ---
    if (cleanPath === '/email-status') {
        if (req.method === 'GET') {
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ sent: state.sent }));
        }
        if (req.method === 'POST') {
            const body = await parseBody(req);
            state.sent = body.sent;
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ status: 'ok' }));
        }
    }

    // --- SIGNAL ---
    if (cleanPath === '/signal' && req.method === 'POST') {
        const body = await parseBody(req);
        const signalFile = path.join(__dirname, 'interaction-signals.json');
        let signals = {};
        try { signals = JSON.parse(fs.readFileSync(signalFile, 'utf8')); } catch (e) { }
        signals[body.signal] = true;
        const tmp = signalFile + '.' + Math.random().toString(36).substring(7) + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(signals, null, 4));
        fs.renameSync(tmp, signalFile);
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'ok' }));
    }

    if (cleanPath === '/signal-status' && req.method === 'GET') {
        const signalFile = path.join(__dirname, 'interaction-signals.json');
        let signals = {};
        try { signals = JSON.parse(fs.readFileSync(signalFile, 'utf8')); } catch (e) { }
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(signals));
    }

    // --- UPDATE STATUS ---
    if (cleanPath === '/api/update-status' && req.method === 'POST') {
        const body = await parseBody(req);
        const processesPath = path.join(DATA_DIR, 'processes.json');
        try {
            const processes = JSON.parse(fs.readFileSync(processesPath, 'utf8'));
            const idx = processes.findIndex(p => p.id === String(body.id));
            if (idx !== -1) {
                processes[idx].status = body.status;
                processes[idx].currentStatus = body.currentStatus;
                fs.writeFileSync(processesPath, JSON.stringify(processes, null, 4));
            }
        } catch (e) { }
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'ok' }));
    }

    // --- CHAT (dual contract) ---
    if (cleanPath === '/api/chat' && req.method === 'POST') {
        try {
            const parsed = await parseBody(req);
            let messages, systemPrompt;

            if (parsed.messages && parsed.systemPrompt) {
                messages = parsed.messages;
                systemPrompt = parsed.systemPrompt;
            } else {
                const history = (parsed.history || []).map(h => ({
                    role: h.role === 'assistant' ? 'assistant' : 'user',
                    content: h.content
                }));
                messages = [...history, { role: 'user', content: parsed.message }];
                systemPrompt = `You are a helpful AI assistant. Use the following knowledge base to answer questions:\n\n${parsed.knowledgeBase}`;
            }

            const response = await callGemini(messages, systemPrompt);
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ response }));
        } catch (e) {
            res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: e.message }));
        }
    }

    // --- FEEDBACK QUESTIONS ---
    if (cleanPath === '/api/feedback/questions' && req.method === 'POST') {
        try {
            const { feedback, knowledgeBase } = await parseBody(req);
            const prompt = `Based on this feedback about the knowledge base, generate exactly 3 clarifying questions to better understand what changes are needed.\n\nKnowledge Base:\n${knowledgeBase}\n\nFeedback: ${feedback}\n\nReturn ONLY a JSON array of 3 question strings, like: ["Q1?", "Q2?", "Q3?"]`;
            const messages = [{ role: 'user', content: prompt }];
            const response = await callGemini(messages, 'You are a helpful assistant that generates clarifying questions. Always return valid JSON.');
            const questions = JSON.parse(response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ questions }));
        } catch (e) {
            res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: e.message }));
        }
    }

    // --- FEEDBACK SUMMARIZE ---
    if (cleanPath === '/api/feedback/summarize' && req.method === 'POST') {
        try {
            const { feedback, questions, answers, knowledgeBase } = await parseBody(req);
            const qaText = questions.map((q, i) => `Q: ${q}\nA: ${answers[i] || 'No answer'}`).join('\n\n');
            const prompt = `Summarize this feedback and the Q&A into a clear, actionable proposal for updating the knowledge base.\n\nOriginal Feedback: ${feedback}\n\nClarifying Q&A:\n${qaText}\n\nCurrent Knowledge Base:\n${knowledgeBase}\n\nProvide a concise summary of what should change.`;
            const messages = [{ role: 'user', content: prompt }];
            const summary = await callGemini(messages, 'You are a helpful assistant that summarizes feedback into actionable proposals.');
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ summary }));
        } catch (e) {
            res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: e.message }));
        }
    }

    // --- FEEDBACK QUEUE ---
    if (cleanPath === '/api/feedback/queue') {
        if (req.method === 'GET') {
            const queue = JSON.parse(fs.readFileSync(FEEDBACK_QUEUE_PATH, 'utf8'));
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ queue }));
        }
        if (req.method === 'POST') {
            const item = await parseBody(req);
            const queue = JSON.parse(fs.readFileSync(FEEDBACK_QUEUE_PATH, 'utf8'));
            queue.push({ ...item, status: 'pending', timestamp: new Date().toISOString() });
            fs.writeFileSync(FEEDBACK_QUEUE_PATH, JSON.stringify(queue, null, 4));
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ status: 'ok' }));
        }
    }

    // --- FEEDBACK QUEUE DELETE ---
    if (cleanPath.startsWith('/api/feedback/queue/') && req.method === 'DELETE') {
        const id = cleanPath.split('/').pop();
        let queue = JSON.parse(fs.readFileSync(FEEDBACK_QUEUE_PATH, 'utf8'));
        queue = queue.filter(item => item.id !== id);
        fs.writeFileSync(FEEDBACK_QUEUE_PATH, JSON.stringify(queue, null, 4));
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'ok' }));
    }

    // --- FEEDBACK APPLY ---
    if (cleanPath === '/api/feedback/apply' && req.method === 'POST') {
        try {
            const { feedbackId } = await parseBody(req);
            const queue = JSON.parse(fs.readFileSync(FEEDBACK_QUEUE_PATH, 'utf8'));
            const item = queue.find(i => i.id === feedbackId);
            if (!item) {
                res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Feedback not found' }));
            }

            const kbPath = path.join(SRC_DIR, 'data', 'knowledgeBase.md');
            const currentKB = fs.readFileSync(kbPath, 'utf8');

            // Save before snapshot
            const beforeFile = `snapshot_before_${Date.now()}.md`;
            fs.writeFileSync(path.join(SNAPSHOTS_DIR, beforeFile), currentKB);

            const prompt = `Apply the following change to the knowledge base. Return ONLY the updated markdown content.\n\nChange to apply: ${item.summary}\n\nCurrent knowledge base:\n${currentKB}`;
            const updatedKB = await callGemini([{ role: 'user', content: prompt }], 'You update knowledge base documents. Return only the updated markdown, no explanations.');

            fs.writeFileSync(kbPath, updatedKB);

            // Save after snapshot
            const afterFile = `snapshot_after_${Date.now()}.md`;
            fs.writeFileSync(path.join(SNAPSHOTS_DIR, afterFile), updatedKB);

            // Update versions
            const versions = JSON.parse(fs.readFileSync(KB_VERSIONS_PATH, 'utf8'));
            versions.push({
                id: versions.length + 1,
                timestamp: new Date().toISOString(),
                snapshotFile: afterFile,
                previousFile: beforeFile,
                changes: [item.summary]
            });
            fs.writeFileSync(KB_VERSIONS_PATH, JSON.stringify(versions, null, 4));

            // Remove from queue
            const updatedQueue = queue.filter(i => i.id !== feedbackId);
            fs.writeFileSync(FEEDBACK_QUEUE_PATH, JSON.stringify(updatedQueue, null, 4));

            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: true, content: updatedKB }));
        } catch (e) {
            res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: e.message }));
        }
    }

    // --- KB CONTENT ---
    if (cleanPath === '/api/kb/content' && req.method === 'GET') {
        const versionId = url.searchParams.get('versionId');
        if (versionId) {
            const versions = JSON.parse(fs.readFileSync(KB_VERSIONS_PATH, 'utf8'));
            const version = versions.find(v => String(v.id) === String(versionId));
            if (version) {
                const snapshotPath = path.join(SNAPSHOTS_DIR, version.snapshotFile);
                if (fs.existsSync(snapshotPath)) {
                    const content = fs.readFileSync(snapshotPath, 'utf8');
                    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ content }));
                }
            }
            res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Version not found' }));
        }
        const kbPath = path.join(SRC_DIR, 'data', 'knowledgeBase.md');
        const content = fs.existsSync(kbPath) ? fs.readFileSync(kbPath, 'utf8') : '';
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ content }));
    }

    // --- KB VERSIONS ---
    if (cleanPath === '/api/kb/versions' && req.method === 'GET') {
        const versions = JSON.parse(fs.readFileSync(KB_VERSIONS_PATH, 'utf8'));
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ versions }));
    }

    // --- KB SNAPSHOT ---
    if (cleanPath.startsWith('/api/kb/snapshot/') && req.method === 'GET') {
        const filename = cleanPath.split('/').pop();
        const filePath = path.join(SNAPSHOTS_DIR, filename);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            res.writeHead(200, { ...corsHeaders, 'Content-Type': 'text/markdown' });
            return res.end(content);
        }
        res.writeHead(404, corsHeaders);
        return res.end('Not found');
    }

    // --- KB UPDATE ---
    if (cleanPath === '/api/kb/update' && req.method === 'POST') {
        const { content } = await parseBody(req);
        const kbPath = path.join(SRC_DIR, 'data', 'knowledgeBase.md');
        fs.writeFileSync(kbPath, content);
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'ok' }));
    }

    // --- DEBUG ---
    if (cleanPath === '/debug-paths') {
        const files = fs.existsSync(DATA_DIR) ? fs.readdirSync(DATA_DIR) : [];
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ DATA_DIR, files }));
    }

    // --- STATIC FILES ---
    let filePath = path.join(PUBLIC_DIR, cleanPath === '/' ? 'index.html' : cleanPath);
    if (!fs.existsSync(filePath) && !path.extname(filePath)) {
        filePath = path.join(PUBLIC_DIR, 'index.html');
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        const fileContent = fs.readFileSync(filePath);
        res.writeHead(200, { ...corsHeaders, 'Content-Type': contentType });
        return res.end(fileContent);
    }

    res.writeHead(404, corsHeaders);
    res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Stripe Payment Reconciliation demo server running on port ${PORT}`);
});
