const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "STR_003";
const CASE_NAME = "TechStart Inc Disputed Payment #5590";

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

const waitForEmail = async () => {
    console.log("Waiting for user to send email...");
    const API_URL = process.env.VITE_API_URL || 'http://localhost:3001';
    try {
        await fetch(`${API_URL}/email-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sent: false })
        });
    } catch (e) {
        console.error("Failed to reset email status", e);
    }
    while (true) {
        try {
            const response = await fetch(`${API_URL}/email-status`);
            if (response.ok) {
                const { sent } = await response.json();
                if (sent) {
                    console.log("Email Sent!");
                    return true;
                }
            }
        } catch (e) { }
        await delay(2000);
    }
};

(async () => {
    console.log(`Starting ${PROCESS_ID}: ${CASE_NAME}...`);

    writeJson(path.join(PUBLIC_DATA_DIR, `process_${PROCESS_ID}.json`), {
        logs: [],
        keyDetails: {
            vendorName: "TechStart Inc",
            invoiceAmount: "$4,200.00",
            stripeChargeId: "ch_8Yp3NKs5uT7wD2",
            disputeId: "dp_1Qx9MLr4sV6zA8",
            disputeReason: "product_not_received",
            disputeDeadline: "2026-02-28"
        }
    });

    const steps = [
        {
            id: "step-1",
            title_p: "Pulling Stripe charge and checking for disputes...",
            title_s: "ALERT: Active dispute detected on charge ch_8Yp3NKs5uT7wD2",
            reasoning: [
                "Charge ID: ch_8Yp3NKs5uT7wD2",
                "Amount: $4,200.00 USD",
                "Original status: succeeded (now disputed)",
                "Dispute ID: dp_1Qx9MLr4sV6zA8",
                "Dispute reason: product_not_received",
                "⚠️ Response deadline: February 28, 2026"
            ],
            artifacts: [{
                id: "dispute-details",
                type: "json",
                label: "Dispute Details",
                data: {
                    dispute_id: "dp_1Qx9MLr4sV6zA8",
                    charge_id: "ch_8Yp3NKs5uT7wD2",
                    amount: "$4,200.00",
                    reason: "product_not_received",
                    status: "needs_response",
                    evidence_due_by: "2026-02-28T23:59:59Z",
                    customer: "TechStart Inc",
                    card_brand: "Mastercard"
                }
            }]
        },
        {
            id: "step-2",
            title_p: "Navigating Stripe Disputes section to gather evidence...",
            title_s: "Dispute evidence gathered from Stripe Dashboard",
            reasoning: [
                "Dispute dp_1Qx9MLr4sV6zA8 opened on 2026-02-18",
                "Cardholder claim: Product not received",
                "Current evidence status: No evidence submitted yet",
                "Days remaining: 6 days until deadline",
                "Dispute amount: $4,200.00 (full charge)"
            ],
            artifacts: [{
                id: "video-dispute",
                type: "video",
                label: "Stripe Disputes Navigation",
                videoPath: "/data/str_003_stripe_dispute.webm"
            }]
        },
        {
            id: "step-3",
            title_p: "Searching internal records for delivery confirmation...",
            title_s: "Delivery confirmation found - FedEx tracking confirms delivery",
            reasoning: [
                "Order: ORD-2026-0334 for TechStart Inc",
                "Ship date: 2026-02-10",
                "Carrier: FedEx Express",
                "Tracking: 794644790132",
                "Delivery confirmed: 2026-02-12 at 10:34 AM",
                "Signed by: J. Martinez (front desk)",
                "✓ Delivery proof available for dispute response"
            ],
            artifacts: [{
                id: "dispute-evidence-pdf",
                type: "file",
                label: "Dispute Evidence Summary",
                pdfPath: "/data/stripe_dispute_evidence_5590.pdf"
            }]
        },
        {
            id: "step-4",
            title_p: "Pulling customer communication history...",
            title_s: "Communication log reviewed - no prior complaints from customer",
            reasoning: [
                "Last 90 days of customer communication reviewed",
                "No support tickets from TechStart Inc about delivery",
                "No email complaints about missing product",
                "Last communication: Thank you email on 2026-02-13",
                "Conclusion: Dispute may be filed in error or by unauthorized party"
            ]
        },
        {
            id: "step-5",
            title_p: "Compiling evidence package for dispute response...",
            title_s: "Evidence package ready - delivery proof, tracking, and communications compiled",
            reasoning: [
                "Evidence compiled for Stripe dispute response:",
                "1. FedEx delivery confirmation with signature",
                "2. Tracking number: 794644790132",
                "3. Customer communication log (no complaints)",
                "4. Original invoice INV-2026-0167",
                "5. Order fulfillment record ORD-2026-0334",
                "Recommended action: Submit evidence and counter dispute"
            ],
            artifacts: [{
                id: "evidence-package",
                type: "json",
                label: "Dispute Evidence Package",
                data: {
                    dispute_id: "dp_1Qx9MLr4sV6zA8",
                    evidence_items: [
                        "FedEx delivery confirmation (signed)",
                        "Tracking #794644790132",
                        "Customer communication log",
                        "Invoice INV-2026-0167",
                        "Order record ORD-2026-0334"
                    ],
                    recommendation: "Counter dispute - strong delivery evidence",
                    win_probability: "85%"
                }
            }]
        },
        {
            id: "step-6",
            title_p: "Drafting dispute response email for finance team review...",
            title_s: "Draft email ready - review and send to proceed with dispute response",
            reasoning: [
                "Email drafted to finance team with dispute summary",
                "Includes evidence package details and recommendation",
                "Requires human review before submitting to Stripe",
                "⚠️ Waiting for team to review and send the email"
            ],
            artifacts: [{
                id: "dispute-email",
                type: "email_draft",
                label: "Dispute Response - Finance Team Review",
                data: {
                    isIncoming: false,
                    to: "finance-team@stripe-demo.com",
                    cc: "disputes@stripe-demo.com",
                    subject: "ACTION REQUIRED: Dispute Response for TechStart Inc - $4,200.00 (Deadline: Feb 28)",
                    body: "Hi Finance Team,\n\nA dispute has been filed by TechStart Inc for $4,200.00 (Charge: ch_8Yp3NKs5uT7wD2).\n\nDispute Details:\n- Reason: Product not received\n- Dispute ID: dp_1Qx9MLr4sV6zA8\n- Deadline: February 28, 2026\n\nEvidence Found:\n- FedEx delivery confirmation with signature (J. Martinez)\n- Tracking: 794644790132, delivered Feb 12\n- No prior customer complaints in last 90 days\n- Last customer communication was a thank-you email\n\nRecommendation: COUNTER DISPUTE\nEstimated win probability: 85%\n\nPlease review and confirm so I can submit the evidence package to Stripe.\n\nBest,\nPace (AI Agent)"
                }
            }]
        },
        {
            id: "step-7",
            title_p: "Submitting evidence to Stripe dispute portal...",
            title_s: "Evidence submitted to Stripe - dispute response filed successfully",
            reasoning: [
                "Evidence submitted via Stripe API",
                "Dispute status updated: needs_response → under_review",
                "Expected resolution timeline: 60-75 days",
                "Stripe will notify when card network makes decision",
                "Evidence receipt confirmed by Stripe"
            ]
        },
        {
            id: "step-8",
            title_p: "Updating reconciliation records and flagging for follow-up...",
            title_s: "Case resolved - dispute response filed, payment on hold pending resolution",
            reasoning: [
                "Reconciliation status: DISPUTED (response filed)",
                "Payment hold: $4,200.00 reserved pending dispute outcome",
                "Follow-up reminder: Set for April 15, 2026",
                "Dispute evidence: Submitted within SLA (4 hours)",
                "Next steps: Monitor Stripe for dispute decision",
                "Case updated with full audit trail"
            ],
            artifacts: [{
                id: "dispute-recon",
                type: "json",
                label: "Dispute Reconciliation Status",
                data: {
                    status: "DISPUTED - Response Filed",
                    dispute_id: "dp_1Qx9MLr4sV6zA8",
                    charge_id: "ch_8Yp3NKs5uT7wD2",
                    amount_held: "$4,200.00",
                    evidence_submitted: true,
                    response_sla: "Met (within 4 hours)",
                    follow_up_date: "2026-04-15",
                    expected_resolution: "60-75 days"
                }
            }]
        }
    ];

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const isFinal = i === steps.length - 1;

        if (step.id === "step-6") {
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
            await updateProcessListStatus(PROCESS_ID, "Needs Attention", "Draft Review: Dispute Response Email Pending");

            await waitForEmail();

            updateProcessLog(PROCESS_ID, {
                id: step.id,
                title: "Dispute response email sent to finance team",
                status: "success",
                reasoning: step.reasoning || [],
                artifacts: step.artifacts || []
            });
            await updateProcessListStatus(PROCESS_ID, "In Progress", "Email sent - proceeding with dispute submission");
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
