const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "STR_004";
const CASE_NAME = "CloudServ LLC Partial Refund Mismatch";

const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : []);
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 4));
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const updateProcessLog = (processId, logEntry, keyDetailsUpdate = {}) => {
    const processFile = path.join(PUBLIC_DATA_DIR, `process_${processId}.json`);
    let data = { logs: [], keyDetails: {}, sidebarArtifacts: [] };
    if (fs.existsSync(processFile)) data = readJson(processFile);
    if (logEntry) {
        const existingIdx = logEntry.id ? data.logs.findIndex(l => l.id === logEntry.id) : -1;
        if (existingIdx !== -1) {
            data.logs[existingIdx] = { ...data.logs[existingIdx], ...logEntry };
        } else {
            data.logs.push(logEntry);
        }
    }
    if (keyDetailsUpdate && Object.keys(keyDetailsUpdate).length > 0) {
        data.keyDetails = { ...data.keyDetails, ...keyDetailsUpdate };
    }
    writeJson(processFile, data);
};

const updateProcessListStatus = async (processId, status, currentStatus) => {
    const apiUrl = process.env.VITE_API_URL || 'http://localhost:3001';
    try {
        const response = await fetch(`${apiUrl}/api/update-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: processId, status, currentStatus })
        });
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
    } catch (e) {
        try {
            const processes = JSON.parse(fs.readFileSync(PROCESSES_FILE, 'utf8'));
            const idx = processes.findIndex(p => p.id === String(processId));
            if (idx !== -1) {
                processes[idx].status = status;
                processes[idx].currentStatus = currentStatus;
                fs.writeFileSync(PROCESSES_FILE, JSON.stringify(processes, null, 4));
            }
        } catch (err) { }
    }
};

const waitForSignal = async (signalId) => {
    console.log(`Waiting for human signal: ${signalId}...`);
    const signalFile = path.join(__dirname, '../interaction-signals.json');

    for (let i = 0; i < 15; i++) {
        try {
            if (fs.existsSync(signalFile)) {
                const content = fs.readFileSync(signalFile, 'utf8');
                if (!content) continue;
                const signals = JSON.parse(content);
                if (signals[signalId]) {
                    delete signals[signalId];
                    const tempSignal = signalFile + '.' + Math.random().toString(36).substring(7) + '.tmp';
                    fs.writeFileSync(tempSignal, JSON.stringify(signals, null, 4));
                    fs.renameSync(tempSignal, signalFile);
                }
                break;
            }
        } catch (e) { await delay(Math.floor(Math.random() * 200) + 100); }
    }

    while (true) {
        try {
            if (fs.existsSync(signalFile)) {
                const content = fs.readFileSync(signalFile, 'utf8');
                if (content) {
                    const signals = JSON.parse(content);
                    if (signals[signalId]) {
                        console.log(`Signal ${signalId} received!`);
                        delete signals[signalId];
                        const tempSignal = signalFile + '.' + Math.random().toString(36).substring(7) + '.tmp';
                        fs.writeFileSync(tempSignal, JSON.stringify(signals, null, 4));
                        fs.renameSync(tempSignal, signalFile);
                        return true;
                    }
                }
            }
        } catch (e) { }
        await delay(1000);
    }
};

(async () => {
    console.log(`Starting ${PROCESS_ID}: ${CASE_NAME}...`);

    writeJson(path.join(PUBLIC_DATA_DIR, `process_${PROCESS_ID}.json`), {
        logs: [],
        keyDetails: {
            vendorName: "CloudServ LLC",
            originalPayment: "$5,000.00",
            stripeChargeId: "ch_2Wp8NKr3tR1yA9",
            stripeRefund1: "$500.00 (Jan 15)",
            stripeRefund2: "$350.00 (Jan 22)",
            internalCredit: "$1,000.00",
            discrepancy: "$150.00"
        }
    });

    const steps = [
        {
            id: "step-1",
            title_p: "Pulling Stripe charge and refund history for CloudServ LLC...",
            title_s: "Charge ch_2Wp8NKr3tR1yA9 found with 2 partial refunds totaling $850.00",
            reasoning: [
                "Charge ID: ch_2Wp8NKr3tR1yA9",
                "Original amount: $5,000.00 USD",
                "Refund 1: re_4Hs7JLn2rP9xB3 - $500.00 (January 15, 2026)",
                "Refund 2: re_6Kt9MLo4tR1yC5 - $350.00 (January 22, 2026)",
                "Total refunded: $850.00",
                "Net charge amount: $4,150.00"
            ],
            artifacts: [{
                id: "refund-history",
                type: "json",
                label: "Stripe Refund History",
                data: {
                    charge_id: "ch_2Wp8NKr3tR1yA9",
                    original_amount: "$5,000.00",
                    refunds: [
                        { id: "re_4Hs7JLn2rP9xB3", amount: "$500.00", date: "2026-01-15", reason: "Service credit - January" },
                        { id: "re_6Kt9MLo4tR1yC5", amount: "$350.00", date: "2026-01-22", reason: "Partial service credit" }
                    ],
                    total_refunded: "$850.00",
                    net_amount: "$4,150.00"
                }
            }]
        },
        {
            id: "step-2",
            title_p: "Navigating Stripe Dashboard to verify refund details...",
            title_s: "Refund details confirmed in Stripe - two separate partial refunds",
            reasoning: [
                "Refund 1 verified: $500.00 on Jan 15 (status: succeeded)",
                "Refund 2 verified: $350.00 on Jan 22 (status: succeeded)",
                "Both refunds processed to original Visa ****8910",
                "Customer received refunds within 5-10 business days",
                "Stripe dashboard confirms no additional pending refunds"
            ],
            artifacts: [{
                id: "video-refund",
                type: "video",
                label: "Stripe Refund History Navigation",
                videoPath: "/data/str_004_stripe_refund.webm"
            }]
        },
        {
            id: "step-3",
            title_p: "Retrieving internal credit memo for CloudServ LLC...",
            title_s: "Internal credit memo found - CM-2026-0078 for $1,000.00 (single entry)",
            reasoning: [
                "Credit Memo: CM-2026-0078",
                "Customer: CloudServ LLC",
                "Credit amount: $1,000.00 (single line item)",
                "Issued: January 12, 2026",
                "Reason: Service level agreement credit",
                "Status: Applied to account"
            ],
            artifacts: [{
                id: "credit-memo-pdf",
                type: "file",
                label: "Internal Credit Memo",
                pdfPath: "/data/credit_memo_cloudserv.pdf"
            }]
        },
        {
            id: "step-4",
            title_p: "Comparing Stripe refunds against internal credit memo...",
            title_s: "MISMATCH DETECTED: Stripe total ($850) vs. internal credit ($1,000) - $150 discrepancy",
            reasoning: [
                "Stripe total refunds: $500.00 + $350.00 = $850.00",
                "Internal credit memo: $1,000.00",
                "Discrepancy: $150.00 (internal credit > Stripe refunds)",
                "⚠️ This exceeds the $1.00 tolerance for refund matching",
                "Root cause analysis: Two Stripe refunds issued in tranches but internal system recorded as single $1,000 credit",
                "Possible explanation: Third refund tranche of $150 not yet issued on Stripe"
            ],
            artifacts: [{
                id: "mismatch-report",
                type: "json",
                label: "Refund Mismatch Analysis",
                data: {
                    stripe_refund_total: "$850.00",
                    internal_credit_total: "$1,000.00",
                    discrepancy: "$150.00",
                    direction: "Internal credit exceeds Stripe refunds",
                    tolerance: "$1.00",
                    result: "OUTSIDE TOLERANCE",
                    possible_causes: [
                        "Third refund tranche pending on Stripe",
                        "Internal credit amount incorrect",
                        "Stripe refund partially failed"
                    ]
                }
            }]
        },
        {
            id: "step-5",
            title_p: "Analyzing refund pattern and recommending resolution...",
            title_s: "Recommendation: Split internal credit to match Stripe tranches, issue remaining $150 refund",
            reasoning: [
                "Analysis: Internal recorded single credit of $1,000",
                "Stripe issued 2 partial refunds totaling $850",
                "Remaining $150 needs to be issued as third refund on Stripe",
                "Recommended action:",
                "1. Split internal credit CM-2026-0078 into three line items",
                "2. Match $500 and $350 to existing Stripe refunds",
                "3. Issue remaining $150 refund on Stripe",
                "⚠️ Requires human approval to adjust credit memo"
            ],
            artifacts: [{
                id: "resolution-plan",
                type: "json",
                label: "Proposed Resolution",
                data: {
                    action: "Split credit memo + issue remaining refund",
                    adjustments: [
                        { line: 1, amount: "$500.00", match: "re_4Hs7JLn2rP9xB3" },
                        { line: 2, amount: "$350.00", match: "re_6Kt9MLo4tR1yC5" },
                        { line: 3, amount: "$150.00", action: "Issue new Stripe refund" }
                    ],
                    requires_approval: true
                }
            }]
        },
        {
            id: "step-6",
            title_p: "Applying approved adjustment - splitting credit memo and issuing $150 refund...",
            title_s: "Credit memo split into 3 line items, $150 refund queued on Stripe",
            reasoning: [
                "Credit memo CM-2026-0078 updated:",
                "Line 1: $500.00 → matched to re_4Hs7JLn2rP9xB3",
                "Line 2: $350.00 → matched to re_6Kt9MLo4tR1yC5",
                "Line 3: $150.00 → new Stripe refund re_9Np2QLr6vX3zE7",
                "All three lines now reconciled",
                "New refund processing: 5-10 business days"
            ]
        },
        {
            id: "step-7",
            title_p: "Verifying all refunds reconcile to credit memo total...",
            title_s: "Full reconciliation confirmed - $500 + $350 + $150 = $1,000",
            reasoning: [
                "Stripe refund 1: $500.00 ✓ (matched)",
                "Stripe refund 2: $350.00 ✓ (matched)",
                "Stripe refund 3: $150.00 ✓ (newly issued)",
                "Total Stripe refunds: $1,000.00",
                "Internal credit total: $1,000.00",
                "Variance: $0.00 - FULLY RECONCILED"
            ]
        },
        {
            id: "step-8",
            title_p: "Generating reconciliation report and closing case...",
            title_s: "Case resolved - partial refund mismatch corrected and fully reconciled",
            reasoning: [
                "Reconciliation status: RECONCILED (after adjustment)",
                "Original discrepancy: $150.00 (now resolved)",
                "Resolution: Credit memo split + additional Stripe refund issued",
                "Human approval: Received and logged",
                "All three refund tranches matched to credit memo lines",
                "Case closed with full audit trail"
            ],
            artifacts: [{
                id: "final-recon",
                type: "json",
                label: "Final Reconciliation Report",
                data: {
                    status: "RECONCILED",
                    charge_id: "ch_2Wp8NKr3tR1yA9",
                    customer: "CloudServ LLC",
                    original_payment: "$5,000.00",
                    credit_memo: "CM-2026-0078",
                    refund_lines: [
                        { stripe_refund: "re_4Hs7JLn2rP9xB3", amount: "$500.00", status: "Matched" },
                        { stripe_refund: "re_6Kt9MLo4tR1yC5", amount: "$350.00", status: "Matched" },
                        { stripe_refund: "re_9Np2QLr6vX3zE7", amount: "$150.00", status: "Newly issued" }
                    ],
                    total_refunded: "$1,000.00",
                    net_charge: "$4,000.00",
                    resolution: "Credit memo split + additional refund"
                }
            }]
        }
    ];

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const isFinal = i === steps.length - 1;

        if (step.id === "step-5") {
            updateProcessLog(PROCESS_ID, {
                id: step.id,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                title: step.title_p,
                status: "processing"
            });
            await updateProcessListStatus(PROCESS_ID, "In Progress", step.title_p);
            await delay(2000);

            updateProcessLog(PROCESS_ID, {
                id: step.id,
                title: step.title_s,
                status: "warning",
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            await updateProcessListStatus(PROCESS_ID, "Needs Attention", step.title_s);

            await waitForSignal("APPROVE_REFUND_ADJUSTMENT");
            await updateProcessListStatus(PROCESS_ID, "In Progress", "Approved: Proceeding with credit memo split and refund");
            await delay(1500);
        } else {
            updateProcessLog(PROCESS_ID, {
                id: step.id,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                title: step.title_p,
                status: "processing"
            });
            await updateProcessListStatus(PROCESS_ID, "In Progress", step.title_p);
            await delay(2000);

            updateProcessLog(PROCESS_ID, {
                id: step.id,
                title: step.title_s,
                status: isFinal ? "completed" : "success",
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            await updateProcessListStatus(PROCESS_ID, isFinal ? "Done" : "In Progress", step.title_s);
            await delay(1500);
        }
    }

    console.log(`${PROCESS_ID} Complete: ${CASE_NAME}`);
})();
