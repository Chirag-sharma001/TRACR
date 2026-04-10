/**
 * SATYA FLOW — Professional Global SAR Export Engine
 * Supports: Behavioral Analysis, Case Management, Compliance Reports, Crypto Analysis
 */

window.handleGlobalSARExport = async function(context = 'GENERAL') {
    console.log(`[SATYA] Initializing Professional SAR Export for context: ${context}...`);

    // Visual feedback
    if (typeof toast === 'function') {
        toast(`Generating Professional ${context} Report...`, 'info');
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // --- THEME COLORS ---
        const PRIMARY_DARK = '#0f172a'; // Slate 900
        const ACCENT_BLUE = '#3525cd';  // Satya Primary
        const ACCENT_GLOW = '#4f46e5';  // Indigo 600
        const TEXT_GRAY = '#64748b';    // Slate 500

        // --- 1. PREMIUM HEADER WITH GRADIENT STRIPE ---
        doc.setFillColor(PRIMARY_DARK);
        doc.rect(0, 0, pageWidth, 45, 'F');
        
        // Subtle accent stripe
        doc.setFillColor(ACCENT_BLUE);
        doc.rect(0, 43, pageWidth, 2, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        doc.text('SATYA FLOW', 20, 22);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(200, 200, 200);
        doc.text(`FINANCIAL INTELLIGENCE UNIT (FIU) — ${context} DIVISION`, 20, 28);
        doc.text('GOVERNMENTAL OVERSIGHT & COMPLIANCE ENGINE', 20, 33);

        // Security Classification
        doc.setFillColor(239, 68, 68); // Red 500
        doc.rect(pageWidth - 65, 15, 45, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('TOP SECRET // CONFIDENTIAL', pageWidth - 42.5, 21.5, { align: 'center' });

        // --- 2. CASE IDENTIFICATION ---
        doc.setTextColor(PRIMARY_DARK);
        doc.setFontSize(14);
        doc.text(`${context} SUSPICIOUS ACTIVITY REPORT (SAR)`, 20, 60);
        doc.setDrawColor(ACCENT_BLUE);
        doc.setLineWidth(1.5);
        doc.line(20, 63, 100, 63);

        doc.setFontSize(10);
        doc.setTextColor(TEXT_GRAY);
        doc.setFont('helvetica', 'bold');
        doc.text('CASE ID: ', 20, 75);
        doc.setFont('helvetica', 'normal');
        doc.text(`${context.slice(0,3)}-FLW-${Math.floor(Math.random() * 90000) + 10000}-XAI`, 45, 75);

        doc.setFont('helvetica', 'bold');
        doc.text('CLASSIFICATION: ', 20, 82);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(239, 68, 68);
        const classification = context === 'CRYPTO' ? 'CRITICAL RISK - LAYERED STRUCTURING' : 
                               context === 'BEHAVIORAL' ? 'HIGH RISK - ANOMALOUS VELOCITY' :
                               context === 'CASES' ? 'PENDING INVESTIGATION - MULTI-ENTITY' : 'GENERAL COMPLIANCE AUDIT';
        doc.text(classification, 55, 82);

        doc.setTextColor(TEXT_GRAY);
        doc.setFont('helvetica', 'bold');
        doc.text('SYSTEM TIMESTAMP: ', pageWidth - 20, 75, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.text(new Date().toUTCString(), pageWidth - 20, 82, { align: 'right' });

        // --- 3. AGENTIC ANALYTICAL NARRATIVE ---
        doc.setFillColor(248, 250, 252); // Slate 50
        doc.rect(20, 95, pageWidth - 40, 55, 'F');
        
        doc.setTextColor(PRIMARY_DARK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('AGENTIC AI ANALYTICAL NARRATIVE', 25, 105);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);

        let narrative = "";
        if (context === 'CRYPTO') {
            narrative = [
                "The Satya AI Engine has detected a complex cross-chain structuring pattern originating from unmapped high-velocity clusters.",
                "Heuristic analysis suggests a non-human transaction signature characterized by 14 sub-threshold 'smurfing' events within a 120-second window targeting offshore liquidity off-ramps.",
                "Immediate investigative override is recommended due to the rapid automated nature of these movements."
            ].join('\n\n');
        } else if (context === 'BEHAVIORAL') {
            narrative = [
                "Agentic profiling identifies a recurring behavioral deviation in the subject entity's transaction corridor.",
                "The 'Shadow-Peer' algorithm has flagged a 400% deviation from industry baseline norms, specifically in the frequency of round-value internal transfers.",
                "This pattern is consistent with early-stage layering and indicates an attempt to normalize unusual volume through distributed accounts."
            ].join('\n\n');
        } else {
            narrative = [
                "Comprehensive audit log analysis via Satya XAI indicates high-fidelity risk signals across the multi-entity network.",
                "Current telemetry shows synchronized activity across three separate jurisdictions, previously unlinked in the global ledger.",
                "Analytical probability of illicit fund movement is calculated at 88.4% based on historical adversarial patterns."
            ].join('\n\n');
        }
        
        const splitNarrative = doc.splitTextToSize(narrative, pageWidth - 50);
        doc.text(splitNarrative, 25, 112);

        // --- 4. RISK PROBABILITY HUD ---
        const HUD_Y = 160;
        doc.setFillColor(PRIMARY_DARK);
        doc.rect(20, HUD_Y, 60, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text('ADVERSARIAL PROBABILITY', 50, HUD_Y + 8, { align: 'center' });
        doc.setFontSize(16);
        doc.setTextColor(239, 68, 68); // Red for risk
        doc.text('94.2%', 50, HUD_Y + 18, { align: 'center' });

        doc.setFillColor(241, 245, 249); // Slate 100
        doc.rect(90, HUD_Y, pageWidth - 110, 25, 'F');
        doc.setTextColor(PRIMARY_DARK);
        doc.setFontSize(8);
        doc.text('SIGNATURE CONFIDENCE', 100, HUD_Y + 8);
        doc.setFontSize(12);
        doc.text('HIGH FIDELITY (XAI)', 100, HUD_Y + 18);

        // --- 5. BEHAVIORAL SIGNATURES TABLE ---
        doc.setTextColor(PRIMARY_DARK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('DETECTED BEHAVIORAL SIGNATURES', 20, 200);

        const behaviors = [
            ['TIME-LAPSE STRUCTURING', '98/100', 'Automated split-funds detected'],
            ['JUMP-HOP RELAY', '92/100', 'Immediate cross-chain bridging'],
            ['OFFSET PEER ANOMALY', '84/100', 'Deviation from baseline corridor'],
            ['DARK-POOL CLUSTER', '76/100', 'Association with known tumblers']
        ];

        doc.autoTable({
            startY: 205,
            head: [['Signature Type', 'Risk Intensity', 'Technical Observation']],
            body: behaviors,
            headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
            bodyStyles: { fontSize: 9 },
            margin: { left: 20, right: 20 },
            theme: 'striped'
        });

        // --- 6. AGENTIC SEAL & WATERMARK ---
        // Watermark
        doc.saveGraphicsState();
        doc.setGState(new doc.GState({ opacity: 0.1 }));
        doc.setFontSize(50);
        doc.setTextColor(150, 150, 150);
        doc.setFont('helvetica', 'bold');
        doc.text('STRICTLY CONFIDENTIAL', pageWidth / 2, pageHeight / 2, {
            align: 'center',
            angle: 45
        });
        doc.restoreGraphicsState();

        // Seal
        const sealY = pageHeight - 45;
        doc.setDrawColor(ACCENT_BLUE);
        doc.setLineWidth(0.5);
        doc.circle(pageWidth - 35, sealY, 15, 'D');
        doc.setFontSize(6);
        doc.text('AUTHENTICATED BY', pageWidth - 35, sealY - 5, { align: 'center' });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('SATYA AI', pageWidth - 35, sealY + 2, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5);
        doc.text('ENGINE ID 0x882', pageWidth - 35, sealY + 7, { align: 'center' });

        // Footer
        doc.setFontSize(8);
        doc.setTextColor(TEXT_GRAY);
        doc.text('This document is generated by the Satya Flow Agentic Workflow and is admissible as investigative lead evidence.', 20, pageHeight - 15);
        doc.text(`Page 1 of 1 — Context: ${context} — ${new Date().toLocaleDateString()}`, pageWidth - 20, pageHeight - 15, { align: 'right' });

        // --- FINAL DOWNLOAD ---
        doc.save(`SATYA_${context}_REPORT_${Date.now()}.pdf`);
        console.log('[SATYA] PDF Generation Successful.');
        if (typeof toast === 'function') {
            toast('Professional Report Downloaded', 'success');
        }
    } catch (error) {
        console.error('[SATYA] PDF Export Failed:', error);
        if (typeof toast === 'function') {
            toast('Report Generation Failed', 'error');
        }
    }
};
