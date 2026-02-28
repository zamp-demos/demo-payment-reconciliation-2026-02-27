const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "STR_001";
const CASE_NAME = "Acme Corp Subscription Payment #4821";

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

(async () => {
    console.log(`Starting ${PROCESS_ID}: ${CASE_NAME}...`);

    writeJson(path.join(PUBLIC_DATA_DIR, `process_${PROCESS_ID}.json`), {
        logs: [],
        keyDetails: {
            vendorName: "Acme Corp",
            invoiceAmount: "$12,500.00",
            stripeChargeId: "ch_3Qx7KLm8nP2vB1",
            paymentMethod: "Visa ****4242",
            currency: "USD",
            invoiceNumber: "INV-2026-0142"
        }
    });

    const steps = [
        {
            id: "step-1",
            title_p: "Connecting to Stripe API and pulling charge details...",
            title_s: "Stripe charge ch_3Qx7KLm8nP2vB1 retrieved successfully",
            reasoning: [
                "Charge ID: ch_3Qx7KLm8nP2vB1",
                "Amount: $12,500.00 USD",
                "Status: succeeded",
                "Payment method: Visa ending 4242",
                "Created: 2026-02-22T14:30:00Z",
                "Metadata: invoice_number=INV-2026-0142"
            ],
            artifacts: [{
                id: "stripe-charge",
                type: "json",
                label: "Stripe Charge Details",
                data: {
                    id: "ch_3Qx7KLm8nP2vB1",
                    amount: 1250000,
                    amount_display: "$12,500.00",
                    currency: "usd",
                    status: "succeeded",
                    payment_method: "pm_visa_4242",
                    customer: "cus_Acme001",
                    metadata: { invoice_number: "INV-2026-0142", customer_name: "Acme Corp" },
                    created: "2026-02-22T14:30:00Z"
                }
            }]
        },
        {
            id: "step-2",
            title_p: "Navigating Stripe Dashboard to verify payment details...",
            title_s: "Payment verified in Stripe Dashboard - receipt exported",
            reasoning: [
                "Dashboard verification: Payment status confirmed as 'Succeeded'",
                "Receipt downloaded: stripe_receipt_4821.pdf",
                "Balance transaction: txn_1Qx7K verified",
                "Net amount after Stripe fees: $12,137.50 (fee: $362.50, rate: 2.9%)"
            ],
            artifacts: [{
                id: "video-stripe-dashboard",
                type: "video",
                label: "Stripe Dashboard Navigation",
                videoPath: "/data/str_001_stripe_payment.webm"
            }]
        },
        {
            id: "step-3",
            title_p: "Retrieving internal invoice INV-2026-0142 from ERP...",
            title_s: "Internal invoice matched - INV-2026-0142 for Acme Corp",
            reasoning: [
                "Invoice Number: INV-2026-0142",
                "Vendor: Acme Corp",
                "Invoice Amount: $12,500.00",
                "Due Date: 2026-02-28",
                "PO Reference: PO-2026-0089",
                "Payment Terms: Net 30"
            ],
            artifacts: [{
                id: "invoice-pdf",
                type: "file",
                label: "Stripe Payment Receipt",
                pdfPath: "/data/stripe_receipt_acme_4821.pdf"
            }]
        },
        {
            id: "step-4",
            title_p: "Performing amount matching between Stripe charge and invoice...",
            title_s: "Amount match confirmed - $12,500.00 exact match",
            reasoning: [
                "Stripe charge amount: $12,500.00",
                "Internal invoice amount: $12,500.00",
                "Variance: $0.00 (exact match)",
                "Currency: Both USD - no FX conversion needed",
                "Match confidence: 100%"
            ],
            artifacts: [{
                id: "match-report",
                type: "json",
                label: "Amount Match Report",
                data: {
                    stripe_amount: "$12,500.00",
                    invoice_amount: "$12,500.00",
                    variance: "$0.00",
                    match_type: "Exact",
                    currency_match: true,
                    confidence: "100%"
                }
            }]
        },
        {
            id: "step-5",
            title_p: "Validating payment metadata and cross-references...",
            title_s: "All metadata validated - invoice number, customer ID, PO confirmed",
            reasoning: [
                "Invoice number in Stripe metadata: INV-2026-0142 ✓",
                "Customer ID mapping: cus_Acme001 → Acme Corp ✓",
                "PO reference verified: PO-2026-0089 ✓",
                "Payment date within terms: 6 days before due date ✓"
            ]
        },
        {
            id: "step-6",
            title_p: "Checking for duplicate charges or prior reconciliation...",
            title_s: "No duplicates found - first reconciliation for this charge",
            reasoning: [
                "Searched last 90 days of charges for Acme Corp",
                "No matching amount/date combinations found",
                "Invoice INV-2026-0142 has no prior reconciliation record",
                "Charge ID ch_3Qx7KLm8nP2vB1 is unique"
            ]
        },
        {
            id: "step-7",
            title_p: "Recording Stripe fees and calculating net settlement...",
            title_s: "Fee analysis complete - $362.50 processing fee recorded",
            reasoning: [
                "Gross amount: $12,500.00",
                "Stripe fee: $362.50 (2.9% + $0.30)",
                "Net settlement: $12,137.50",
                "Fee posted to GL account 6100-PROCESSING-FEES",
                "Net amount matches expected payout"
            ],
            artifacts: [{
                id: "fee-breakdown",
                type: "json",
                label: "Fee Breakdown",
                data: {
                    gross_amount: "$12,500.00",
                    stripe_percentage: "2.9%",
                    stripe_fixed: "$0.30",
                    total_fee: "$362.50",
                    net_settlement: "$12,137.50",
                    gl_account: "6100-PROCESSING-FEES"
                }
            }]
        },
        {
            id: "step-8",
            title_p: "Generating reconciliation report and closing case...",
            title_s: "Reconciliation complete - Acme Corp payment fully matched",
            reasoning: [
                "Reconciliation status: MATCHED",
                "Stripe charge: ch_3Qx7KLm8nP2vB1 → Invoice: INV-2026-0142",
                "Amount: $12,500.00 (exact match, USD)",
                "Fees recorded: $362.50",
                "Net payout expected: $12,137.50",
                "Case closed with confidence: HIGH"
            ],
            artifacts: [{
                id: "recon-report",
                type: "json",
                label: "Reconciliation Summary",
                data: {
                    status: "RECONCILED",
                    charge_id: "ch_3Qx7KLm8nP2vB1",
                    invoice: "INV-2026-0142",
                    customer: "Acme Corp",
                    amount: "$12,500.00",
                    currency: "USD",
                    fees: "$362.50",
                    net_settlement: "$12,137.50",
                    match_type: "Exact",
                    confidence: "HIGH",
                    processing_time: "18 seconds"
                }
            }]
        }
    ];

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const isFinal = i === steps.length - 1;

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

    console.log(`${PROCESS_ID} Complete: ${CASE_NAME}`);
})();
