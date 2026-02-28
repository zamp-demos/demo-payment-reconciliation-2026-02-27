const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const PUBLIC_DATA_DIR = path.join(PROJECT_ROOT, 'public/data');
const PROCESSES_FILE = path.join(PUBLIC_DATA_DIR, 'processes.json');
const PROCESS_ID = "STR_002";
const CASE_NAME = "GlobalTech GmbH EUR Payment #7203";

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
            vendorName: "GlobalTech GmbH",
            invoiceAmount: "€8,450.00",
            stripeChargeId: "ch_5Rt2MLp9qW4xC3",
            paymentMethod: "SEPA Direct Debit",
            currency: "EUR → USD",
            invoiceNumber: "INV-2026-0198"
        }
    });

    const steps = [
        {
            id: "step-1",
            title_p: "Connecting to Stripe API and pulling EUR charge...",
            title_s: "Stripe charge ch_5Rt2MLp9qW4xC3 retrieved - €8,450.00",
            reasoning: [
                "Charge ID: ch_5Rt2MLp9qW4xC3",
                "Amount: €8,450.00 EUR",
                "Status: succeeded",
                "Payment method: SEPA Direct Debit (DE89370400440532013000)",
                "Created: 2026-02-20T09:15:00Z",
                "Metadata: invoice_number=INV-2026-0198"
            ],
            artifacts: [{
                id: "stripe-charge-eur",
                type: "json",
                label: "Stripe Charge (EUR)",
                data: {
                    id: "ch_5Rt2MLp9qW4xC3",
                    amount: 845000,
                    amount_display: "€8,450.00",
                    currency: "eur",
                    status: "succeeded",
                    payment_method: "SEPA Direct Debit",
                    customer: "cus_GT_GmbH_002",
                    metadata: { invoice_number: "INV-2026-0198" }
                }
            }]
        },
        {
            id: "step-2",
            title_p: "Navigating Stripe Dashboard to check balance transaction and FX rate...",
            title_s: "Balance transaction verified - exchange rate 1.0842 applied",
            reasoning: [
                "Balance transaction: txn_5Rt2ML confirmed",
                "Exchange rate: 1 EUR = 1.0842 USD (Stripe rate)",
                "Converted amount: $9,161.49 USD",
                "Stripe fee: €245.05 EUR",
                "Net settlement: $9,895.68 USD equivalent"
            ],
            artifacts: [{
                id: "video-stripe-fx",
                type: "video",
                label: "Stripe Dashboard - FX Details",
                videoPath: "/data/str_002_stripe_fx.webm"
            }]
        },
        {
            id: "step-3",
            title_p: "Retrieving internal invoice INV-2026-0198...",
            title_s: "Internal invoice found - $9,164.66 USD (booked at market rate)",
            reasoning: [
                "Invoice Number: INV-2026-0198",
                "Vendor: GlobalTech GmbH",
                "Original amount: €8,450.00",
                "Booked USD amount: $9,164.66 (market rate 1.0846 on booking date)",
                "Due Date: 2026-03-05",
                "PO Reference: PO-2026-0112"
            ],
            artifacts: [{
                id: "invoice-pdf-eur",
                type: "file",
                label: "Stripe Payment Receipt (EUR)",
                pdfPath: "/data/stripe_receipt_globaltech_7203.pdf"
            }]
        },
        {
            id: "step-4",
            title_p: "Performing FX reconciliation - comparing Stripe rate vs. booking rate...",
            title_s: "FX variance identified: $3.17 (within tolerance threshold)",
            reasoning: [
                "Stripe converted amount: $9,161.49 (rate: 1.0842)",
                "Internal booked amount: $9,164.66 (rate: 1.0846)",
                "Variance: $3.17 (Stripe rate vs. booking rate)",
                "Tolerance threshold: ±$5.00 or ±0.5%",
                "$3.17 < $5.00 threshold → WITHIN TOLERANCE",
                "Auto-reconcile with FX adjustment note"
            ],
            artifacts: [{
                id: "fx-recon",
                type: "json",
                label: "FX Reconciliation Breakdown",
                data: {
                    source_amount: "€8,450.00",
                    stripe_rate: 1.0842,
                    stripe_usd: "$9,161.49",
                    booking_rate: 1.0846,
                    booked_usd: "$9,164.66",
                    variance: "$3.17",
                    variance_pct: "0.035%",
                    tolerance_check: "PASS (< $5.00)",
                    action: "Auto-reconcile with FX note"
                }
            }]
        },
        {
            id: "step-5",
            title_p: "Recording FX gain/loss to GL account...",
            title_s: "FX loss of $3.17 posted to GL 4200-FX",
            reasoning: [
                "FX loss amount: $3.17",
                "Direction: Loss (Stripe rate < booking rate)",
                "GL account: 4200-FX (Foreign Exchange Gains/Losses)",
                "Journal entry created: JE-2026-0445",
                "Auto-approved (within tolerance)"
            ]
        },
        {
            id: "step-6",
            title_p: "Validating SEPA payment details and settlement timeline...",
            title_s: "SEPA settlement confirmed - funds cleared on 2026-02-22",
            reasoning: [
                "SEPA mandate: active since 2025-06-15",
                "Debit initiated: 2026-02-20",
                "Funds cleared: 2026-02-22 (2 business days)",
                "No SEPA returns or failures detected",
                "Settlement timeline within expected range"
            ]
        },
        {
            id: "step-7",
            title_p: "Checking for duplicate charges and prior reconciliation...",
            title_s: "No duplicates found - clean reconciliation",
            reasoning: [
                "Searched EUR charges for GlobalTech GmbH (90 days)",
                "Previous charge: ch_2Wp8NKr3tR1yA9 on 2026-01-20 (already reconciled)",
                "No amount/date overlaps detected",
                "Invoice INV-2026-0198 not previously reconciled"
            ]
        },
        {
            id: "step-8",
            title_p: "Generating multi-currency reconciliation report...",
            title_s: "Reconciliation complete - GlobalTech EUR payment matched with FX adjustment",
            reasoning: [
                "Reconciliation status: MATCHED (with FX adjustment)",
                "Stripe charge: ch_5Rt2MLp9qW4xC3 → Invoice: INV-2026-0198",
                "Source: €8,450.00 EUR → USD equivalent: $9,161.49",
                "FX variance: $3.17 (auto-approved, within tolerance)",
                "Journal entry: JE-2026-0445 for FX loss",
                "Case closed with confidence: HIGH"
            ],
            artifacts: [{
                id: "recon-summary-eur",
                type: "json",
                label: "Multi-Currency Reconciliation Summary",
                data: {
                    status: "RECONCILED",
                    charge_id: "ch_5Rt2MLp9qW4xC3",
                    invoice: "INV-2026-0198",
                    customer: "GlobalTech GmbH",
                    source_amount: "€8,450.00",
                    converted_amount: "$9,161.49",
                    exchange_rate: 1.0842,
                    fx_variance: "$3.17",
                    fx_journal_entry: "JE-2026-0445",
                    confidence: "HIGH"
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
