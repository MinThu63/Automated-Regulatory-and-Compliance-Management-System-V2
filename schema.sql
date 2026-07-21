-- Create database if it doesn't exist, then use it
CREATE DATABASE IF NOT EXISTS `SOI-2026-0039-MinThu`;
USE `SOI-2026-0039-MinThu`;

-- 1. users
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('Compliance Officer', 'Internal Auditor', 'Admin') NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. regulatory_sources
CREATE TABLE IF NOT EXISTS regulatory_sources (
    source_id INT AUTO_INCREMENT PRIMARY KEY,
    source_name VARCHAR(100) NOT NULL,
    base_url VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. regulations
CREATE TABLE IF NOT EXISTS regulations (
    reg_id INT AUTO_INCREMENT PRIMARY KEY,
    source_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    version DECIMAL(5,2) DEFAULT 1.0,
    published_date DATETIME,
    source_url VARCHAR(500),
    ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES regulatory_sources(source_id) ON DELETE CASCADE
);

-- 4. regulation_changes
CREATE TABLE IF NOT EXISTS regulation_changes (
    change_id INT AUTO_INCREMENT PRIMARY KEY,
    reg_id INT NOT NULL,
    previous_version DECIMAL(5,2) NOT NULL,
    new_version DECIMAL(5,2) NOT NULL,
    semantic_differences TEXT NOT NULL,
    impact_score ENUM('Low', 'Medium', 'High', 'Critical') NOT NULL,
    explicit_deadline DATE NULL,
    affected_areas TEXT NULL,
    change_diff TEXT NULL,
    old_content MEDIUMTEXT NULL,
    new_content MEDIUMTEXT NULL,
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reg_id) REFERENCES regulations(reg_id) ON DELETE CASCADE
);

-- 5. alerts
CREATE TABLE IF NOT EXISTS alerts (
    alert_id INT AUTO_INCREMENT PRIMARY KEY,
    reg_id INT NOT NULL,
    change_id INT,
    severity_level ENUM('Immediate Action Required', 'Review Recommended', 'Informational') NOT NULL,
    department VARCHAR(100) NULL,
    status ENUM('Unread', 'Read', 'Dismissed') DEFAULT 'Unread',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reg_id) REFERENCES regulations(reg_id) ON DELETE CASCADE,
    FOREIGN KEY (change_id) REFERENCES regulation_changes(change_id) ON DELETE SET NULL
);

-- 6. internal_policies
CREATE TABLE IF NOT EXISTS internal_policies (
    policy_id INT AUTO_INCREMENT PRIMARY KEY,
    policy_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 7. compliance_gaps
CREATE TABLE IF NOT EXISTS compliance_gaps (
    gap_id INT AUTO_INCREMENT PRIMARY KEY,
    reg_id INT NOT NULL,
    policy_id INT NOT NULL,
    gap_description TEXT NOT NULL,
    status ENUM('Open', 'In Review', 'Remediated') DEFAULT 'Open',
    identified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reg_id) REFERENCES regulations(reg_id) ON DELETE CASCADE,
    FOREIGN KEY (policy_id) REFERENCES internal_policies(policy_id) ON DELETE CASCADE
);

-- 8. tasks
CREATE TABLE IF NOT EXISTS tasks (
    task_id INT AUTO_INCREMENT PRIMARY KEY,
    alert_id INT,
    gap_id INT,
    assigned_to INT NULL,
    department VARCHAR(100) NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    deadline DATETIME NOT NULL,
    status ENUM('Pending', 'In Progress', 'Completed') DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (alert_id) REFERENCES alerts(alert_id) ON DELETE CASCADE,
    FOREIGN KEY (gap_id) REFERENCES compliance_gaps(gap_id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 9. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    target_table VARCHAR(50) NOT NULL,
    target_id INT NOT NULL,
    description TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 10. departments
CREATE TABLE IF NOT EXISTS departments (
    dept_id INT AUTO_INCREMENT PRIMARY KEY,
    dept_name VARCHAR(100) NOT NULL,
    dept_description TEXT,
    responsible_categories VARCHAR(500) NOT NULL,
    default_assignee INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (default_assignee) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 11. task_gaps (junction table — one task links to multiple gaps)
CREATE TABLE IF NOT EXISTS task_gaps (
    task_id INT NOT NULL,
    gap_id INT NOT NULL,
    PRIMARY KEY (task_id, gap_id),
    FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
    FOREIGN KEY (gap_id) REFERENCES compliance_gaps(gap_id) ON DELETE CASCADE
);

-- 11b. task_alerts (junction table — one task links to multiple regulatory-change alerts)
CREATE TABLE IF NOT EXISTS task_alerts (
    task_id INT NOT NULL,
    alert_id INT NOT NULL,
    PRIMARY KEY (task_id, alert_id),
    FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE,
    FOREIGN KEY (alert_id) REFERENCES alerts(alert_id) ON DELETE CASCADE
);

-- 12. policy_proposals (AI-generated policy proposals awaiting human review)
CREATE TABLE IF NOT EXISTS policy_proposals (
    proposal_id INT AUTO_INCREMENT PRIMARY KEY,
    proposal_type ENUM('New Policy', 'Policy Update') NOT NULL,
    target_policy_id INT NULL,
    policy_name VARCHAR(255) NOT NULL,
    proposed_description TEXT NOT NULL,
    reasoning TEXT NOT NULL,
    related_gap_ids VARCHAR(500),
    status ENUM('Pending', 'Accepted', 'Rejected') DEFAULT 'Pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    FOREIGN KEY (target_policy_id) REFERENCES internal_policies(policy_id) ON DELETE CASCADE
);

-- 13. policy_versions
CREATE TABLE IF NOT EXISTS policy_versions (
    version_id INT AUTO_INCREMENT PRIMARY KEY,
    policy_id INT NOT NULL,
    policy_name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    version_number INT NOT NULL DEFAULT 1,
    changed_by INT NOT NULL,
    change_reason VARCHAR(500),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (policy_id) REFERENCES internal_policies(policy_id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(user_id) ON DELETE CASCADE
);

-- =============================================
-- Seed Data
-- =============================================

INSERT IGNORE INTO users (username, email, password, role) VALUES 
('Alex Tan', 'officer@gldb.com', '$2b$10$xtJXo9NyK54qbDW88jeisefWGdzzrt9IvqJBY.5DJHceoucS27Dp2', 'Compliance Officer'),
('Sarah Lee', 'auditor@gldb.com', '$2b$10$xtJXo9NyK54qbDW88jeisefWGdzzrt9IvqJBY.5DJHceoucS27Dp2', 'Internal Auditor'),
('Admin User', 'admin@gldb.com', '$2b$10$xtJXo9NyK54qbDW88jeisefWGdzzrt9IvqJBY.5DJHceoucS27Dp2', 'Admin');

INSERT IGNORE INTO regulatory_sources (source_name, base_url) VALUES 
('MAS', 'https://www.mas.gov.sg/regulation'),
('FATF', 'https://www.fatf-gafi.org/en/publications.html'),
('FinCEN', 'https://www.fincen.gov/news-room'),
('ECB', 'https://www.bankingsupervision.europa.eu/press/publications'),
('FCA', 'https://www.fca.org.uk/publications');

INSERT IGNORE INTO regulations (source_id, title, category, content, version) VALUES 
(1, 'MAS Notice 626 - Prevention of Money Laundering and Countering the Financing of Terrorism', 'AML', 'Sets out requirements for banks relating to CDD, EDD, ongoing monitoring, suspicious transaction reporting, record keeping, and wire transfer obligations.', 2.0);

INSERT IGNORE INTO internal_policies (policy_name, description) VALUES 
-- === AML/CFT POLICIES & PROCEDURES ===
('GLDB AML/CFT Compliance Policy', 'Automated eKYC and Enhanced Due Diligence (EDD) procedures for MSME onboarding, including AI-driven biometric verification, UBO screening, and shell company detection via third-party identity systems (e.g., Chekk). Mandates senior management approval for high-risk customer relationships.\n\nPROCEDURES:\n1. Initial Risk Assessment: Classify all new customers as Low/Medium/High risk using the GLDB Risk Scoring Matrix (factors: country, industry, transaction volume, PEP status).\n2. Standard CDD: Collect certified copies of ACRA BizFile, director IDs, and proof of business address. Verify against MAS CFTS sanctions list within 24 hours.\n3. Enhanced Due Diligence (EDD): For High-risk customers — conduct source of wealth verification, obtain senior management sign-off, and schedule 6-monthly relationship reviews.\n4. Ongoing Monitoring: Review all customer risk profiles annually. Trigger re-assessment if transaction patterns deviate >30% from declared business profile.\n5. Record Retention: Maintain all CDD records for minimum 5 years after account closure per MAS Notice 626.'),

('GLDB KYC Onboarding Policy', 'Standard procedure for verifying MSME identities using digital document acquisition, biometric verification, and cross-referencing against localized internal blacklists and international sanctions lists.\n\nPROCEDURES:\n1. Document Collection: Obtain ACRA BizFile profile, Certificate of Incorporation, Memorandum & Articles of Association, and director/shareholder identification documents.\n2. Identity Verification: Run biometric facial recognition against government-issued ID. Verify company registration number against ACRA live database.\n3. UBO Identification: Identify all individuals with ≥25% ownership or significant control. Obtain their NRIC/passport copies and proof of address.\n4. Sanctions Screening: Screen all directors, UBOs, and the company against MAS CFTS list, UN Consolidated List, OFAC SDN list, and EU sanctions list.\n5. PEP Screening: Check all individuals against Dow Jones or World-Check PEP databases. Flag any matches for EDD.\n6. Approval Workflow: Low-risk accounts auto-approved after system checks pass. Medium-risk requires L2 compliance review within 48 hours. High-risk requires Head of Compliance sign-off.'),

('GLDB Transaction Monitoring Policy', 'Continuous monitoring of all transactions using automated systems to detect suspicious activity, trade-based money laundering patterns, and shell company indicators. Includes escalation procedures for flagged transactions.\n\nPROCEDURES:\n1. Real-Time Screening: All outgoing transfers screened against sanctions lists before execution. Block and hold any matches for manual review.\n2. Rule-Based Alerts: System generates alerts for: transactions >SGD 20,000, multiple transfers to same beneficiary within 24h, transactions to/from high-risk jurisdictions, structuring patterns (multiple sub-threshold transfers).\n3. Alert Triage: L1 analysts review within 4 hours. Categorize as False Positive, Escalate, or File STR. Document decision rationale.\n4. STR Filing: Suspicious Transaction Reports filed with STRO within 1 business day of determination. Use STRO e-filing portal. Retain internal copy for 5 years.\n5. Trade-Based ML Detection: Flag invoices with pricing anomalies >20% from market rate, goods inconsistent with customer profile, or circular trade patterns.\n6. Monthly Review: Compliance team reviews all dismissed alerts monthly to identify false-negative patterns.'),

('GLDB Suspicious Transaction Reporting Procedure', 'Detailed step-by-step procedure for identifying, escalating, and filing Suspicious Transaction Reports (STRs) with the Suspicious Transaction Reporting Office (STRO) under MAS Notice 626.\n\nPROCEDURES:\n1. Detection: Transaction monitoring system flags potential suspicious activity OR employee identifies red flags during routine operations.\n2. Initial Assessment: L1 Compliance Analyst reviews flagged transaction within 4 hours. Gather customer profile, transaction history, and counterparty details.\n3. Escalation: If suspicion confirmed, escalate to L2 Senior Analyst with completed internal assessment form (SAR-INT-01).\n4. STR Decision: L2 Analyst determines within 24 hours whether STR filing is warranted. Document reasoning regardless of decision.\n5. Filing: Complete STRO e-filing form within 1 business day of STR decision. Include: customer ID, transaction details, basis for suspicion, supporting documents.\n6. Tipping Off Prevention: Do NOT inform the customer or any third party about the STR filing. Continue normal business relationship unless instructed otherwise by STRO.\n7. Record Keeping: Retain all STR documentation, internal assessments, and correspondence for minimum 5 years.'),

('GLDB Sanctions Screening Policy', 'Procedures for screening customers, transactions, and counterparties against international sanctions lists to prevent prohibited dealings.\n\nPROCEDURES:\n1. Customer Screening: Screen all customers and UBOs at onboarding and daily thereafter against: MAS CFTS List, UN Security Council Consolidated List, OFAC SDN List, EU Consolidated List, and HMT Sanctions List.\n2. Transaction Screening: All payment instructions screened in real-time before execution. Match against sanctioned entities, vessels, and jurisdictions.\n3. Match Handling: System-generated potential matches reviewed by Sanctions Analyst within 2 hours. True matches escalated to Head of Compliance immediately.\n4. Blocking & Reporting: Confirmed sanctions hits result in immediate transaction block. Report to MAS within 1 business day. Freeze relevant accounts pending MAS guidance.\n5. False Positive Management: Document all false positives with rationale. Update internal whitelist quarterly after senior review.\n6. List Updates: Sanctions lists refreshed daily at 0600 SGT. Emergency updates (e.g., new UNSC resolution) applied within 4 hours of publication.'),

-- === DATA PRIVACY & PDPA ===
('GLDB Data Privacy and PDPA Policy', 'Compliance with the Singapore Personal Data Protection Act (PDPA) 2012. Enforces consent-based data collection, data minimization for corporate onboarding, and explicit mechanisms for data subject rights including access, correction, and portability of MSME director and UBO personal data.\n\nPROCEDURES:\n1. Consent Collection: Obtain explicit written consent before collecting personal data. Use GLDB Consent Form (PDPA-CF-01) with clear purpose limitation statement.\n2. Data Minimization: Only collect personal data necessary for the stated purpose. Do not retain NRIC numbers unless legally required (Banking Act exemption).\n3. Access Requests: Respond to data access requests within 30 days. Provide data in machine-readable format. Log all requests in PDPA-REQ register.\n4. Correction Requests: Process corrections within 30 days. Notify all third parties who received the incorrect data.\n5. Data Breach Response: Notify PDPC within 3 calendar days if breach affects ≥500 individuals or is of significant scale. Notify affected individuals without unreasonable delay.\n6. Cross-Border Transfer: Only transfer personal data to jurisdictions with comparable data protection standards OR with binding contractual clauses in place.\n7. Retention & Disposal: Delete personal data when no longer needed for business or legal purpose. Use certified data destruction methods.'),

-- === GREEN FINANCE & ESG ===
('GLDB Green Finance Framework', 'Criteria and risk assessment procedures for approving green supply chain loans and ESG-aligned financing products. Includes environmental risk scenario analysis requirements aligned with MAS Environmental Risk Management Guidelines.\n\nPROCEDURES:\n1. Green Classification: Assess loan applications against GLDB Green Taxonomy (aligned with MAS Guidelines on Environmental Risk Management). Categories: renewable energy, clean transport, sustainable agriculture, pollution prevention.\n2. Environmental Due Diligence: For loans >SGD 500K, conduct Environmental Impact Assessment (EIA). Obtain third-party ESG rating where available.\n3. Use of Proceeds Monitoring: Quarterly verification that green loan proceeds are used for stated environmental purpose. Require borrower to submit utilization reports.\n4. Climate Risk Stress Testing: Annual scenario analysis using NGFS climate scenarios. Assess portfolio exposure to physical and transition risks.\n5. Greenwashing Prevention: Verify all sustainability claims with documentary evidence. Reject applications with unsubstantiated environmental benefit claims.'),

-- === CREDIT & LIQUIDITY RISK ===
('GLDB Credit and Liquidity Risk Policy', 'Risk management framework for uncollateralized business term loans and supply chain finance products. Covers credit risk assessment, liquidity ratio monitoring, and capital adequacy requirements aligned with Basel III and MAS prudential standards.\n\nPROCEDURES:\n1. Credit Assessment: All loan applications scored using GLDB Internal Rating Model (factors: financial statements, industry risk, management quality, repayment history). Minimum score of C+ required for approval.\n2. Concentration Limits: Single borrower exposure capped at 5% of capital base. Industry concentration capped at 25%. Country exposure limits per Board-approved matrix.\n3. Liquidity Coverage Ratio (LCR): Maintain LCR ≥100% at all times. Daily monitoring by Treasury. Escalate to ALCO if LCR drops below 110%.\n4. Net Stable Funding Ratio (NSFR): Maintain NSFR ≥100%. Monthly reporting to MAS. Quarterly Board reporting.\n5. Capital Adequacy: Maintain CAR ≥12.5% (above MAS minimum of 10%). Monthly calculation. Trigger recovery plan if CAR drops below 13%.'),

-- === CYBERSECURITY & TRM ===
('GLDB Cybersecurity and TRM Policy', 'Alignment with MAS Technology Risk Management (TRM) Guidelines. Includes Vulnerability Disclosure Policy (VDP) for ethical security researchers, rules of engagement prohibiting DDoS/phishing/social engineering, and incident response procedures.\n\nPROCEDURES:\n1. Access Control: Enforce multi-factor authentication (MFA) for all staff accessing production systems. Review access rights quarterly. Remove access within 24 hours of staff departure.\n2. Vulnerability Management: Weekly automated vulnerability scans. Critical vulnerabilities patched within 72 hours. High within 2 weeks. Penetration testing annually by independent firm.\n3. Incident Response: Follow GLDB-IRP-01 playbook. Severity 1 (data breach): notify MAS within 1 hour, activate crisis team. Severity 2 (service disruption): restore within 4 hours.\n4. Data Loss Prevention: DLP rules on all email gateways and endpoints. Block transmission of NRIC, account numbers, and passwords via unencrypted channels.\n5. Third-Party Security: All vendors accessing GLDB systems must complete security questionnaire (VEN-SEC-01). Annual reassessment. Contractual right to audit.\n6. Business Continuity: Annual DR drill. RPO ≤4 hours, RTO ≤2 hours for critical systems. Backup to secondary Azure region.'),

-- === WHOLESALE BANKING OPERATIONS ===
('GLDB Wholesale Banking Operations Policy', 'Compliance with MAS Digital Wholesale Bank (DWB) license conditions. Restricts all banking services, deposit-taking, and loan products exclusively to non-retail customers (SMEs, MSMEs, corporate clients). Enforces minimum paid-up capital of S$100 million and high deposit minimums for individual exceptions.\n\nPROCEDURES:\n1. Customer Eligibility Check: Before onboarding, verify entity is a registered business (ACRA/equivalent). Individual customers ONLY accepted if deposit ≥SGD 250,000.\n2. Product Restrictions: No retail savings accounts, no credit cards, no personal loans. Only corporate current accounts, business term loans, trade finance, and supply chain financing.\n3. Capital Monitoring: CFO reports paid-up capital position monthly to Board. Maintain ≥SGD 100M at all times. Trigger capital plan if buffer falls below SGD 10M.\n4. MAS Reporting: Submit MAS 610/613/617 returns on schedule. Monthly prudential returns. Annual audited accounts within 5 months of financial year-end.\n5. License Condition Compliance: Annual self-assessment against all 47 DWB license conditions. Report any breaches to MAS within 14 days.'),

-- === OPERATIONAL GUIDELINES ===
('GLDB Wire Transfer Policy', 'Procedures for processing domestic and cross-border wire transfers in compliance with FATF Recommendation 16 (Wire Transfers) and MAS Notice 626 requirements on originator/beneficiary information.\n\nPROCEDURES:\n1. Originator Information: All outgoing transfers must include: originator name, account number, and address (or national ID). For transfers >SGD 1,500: full originator details mandatory.\n2. Beneficiary Information: Must include beneficiary name and account number. For cross-border transfers: beneficiary address or national ID required.\n3. Intermediary Obligations: When acting as intermediary bank, retain all originator/beneficiary information with the transfer. Do not strip information from payment messages.\n4. Missing Information: Reject or hold transfers with incomplete originator/beneficiary details. Report to compliance if pattern of incomplete transfers from same corridor.\n5. SWIFT Compliance: Use MT103 format for cross-border transfers. Ensure Field 50 (originator) and Field 59 (beneficiary) fully populated.\n6. Threshold Monitoring: Flag all individual transfers ≥SGD 20,000 and aggregate transfers to same beneficiary ≥SGD 50,000/month for enhanced review.'),

('GLDB Record Keeping and Retention Policy', 'Framework for retaining customer records, transaction records, and compliance documentation as required by MAS Notice 626, PDPA, and Banking Act.\n\nPROCEDURES:\n1. CDD Records: Retain all customer identification and verification documents for minimum 5 years after account closure or end of business relationship.\n2. Transaction Records: Retain records of all transactions (domestic and international) for minimum 5 years from date of transaction. Include amount, currency, date, parties involved.\n3. STR Records: Retain all STR filings, supporting documents, and internal assessments for minimum 5 years from filing date. Store in restricted-access compliance archive.\n4. Correspondence: Retain all regulatory correspondence, MAS inspection reports, and internal audit findings for 7 years.\n5. Digital Storage: All records stored in encrypted Azure Blob Storage with geo-redundancy. Access restricted to authorized compliance staff. Audit trail on all access.\n6. Disposal: Records past retention period destroyed using NIST 800-88 compliant methods. Disposal logged in GLDB Records Destruction Register.'),

('GLDB Third-Party Risk Management Policy', 'Procedures for assessing, onboarding, and monitoring third-party vendors and service providers to ensure they meet GLDB security, compliance, and operational standards.\n\nPROCEDURES:\n1. Vendor Classification: Classify all vendors as Critical (access to customer data or core systems), Important (operational dependency), or Standard (no data/system access).\n2. Due Diligence: Critical vendors: full security assessment, financial stability check, regulatory compliance review, on-site inspection. Important vendors: security questionnaire + reference checks. Standard: self-declaration.\n3. Contractual Requirements: All vendor contracts must include: data protection clauses, right to audit, incident notification (within 24h), business continuity requirements, and termination provisions.\n4. Ongoing Monitoring: Critical vendors reviewed annually. Track SLA performance, security incident history, and financial health. Important vendors reviewed bi-annually.\n5. Exit Strategy: Maintain documented exit plan for all Critical vendors. Test data migration capability annually. Ensure no single vendor dependency for core services.'),

-- === TRAINING MATERIALS ===
('GLDB AML/CFT Staff Training Program', 'Mandatory training program for all GLDB employees on Anti-Money Laundering and Counter-Financing of Terrorism obligations, red flag identification, and reporting procedures.\n\nTRAINING MODULES:\n1. Module 1 — AML Fundamentals (All Staff, Annual): Money laundering stages (placement, layering, integration), terrorism financing methods, Singapore legal framework (CDSA, TSOFA, MAS Notice 626). Duration: 2 hours. Assessment: 80% pass mark required.\n2. Module 2 — KYC & CDD Procedures (Onboarding Team, Bi-Annual): Hands-on training on customer identification, UBO verification, risk scoring, and EDD triggers. Includes case studies of recent MAS enforcement actions. Duration: 4 hours.\n3. Module 3 — Transaction Monitoring & STR Filing (Compliance Team, Quarterly): Alert triage procedures, STR drafting, STRO portal usage, tipping-off prohibition, case study exercises. Duration: 3 hours.\n4. Module 4 — Sanctions Compliance (All Staff, Annual): Sanctions list overview, screening procedures, match handling, escalation protocols. Duration: 1.5 hours.\n5. Module 5 — Red Flags for Relationship Managers (Business Team, Bi-Annual): Trade-based ML indicators, shell company red flags, unusual transaction patterns, customer behavior changes. Duration: 2 hours.\n6. Completion Tracking: HR maintains training completion register. Non-completion escalated to department head after 30 days. Compliance certification renewed annually.'),

('GLDB Cybersecurity Awareness Training', 'Mandatory cybersecurity training for all staff aligned with MAS TRM Guidelines on security awareness and social engineering prevention.\n\nTRAINING MODULES:\n1. Module 1 — Phishing & Social Engineering (All Staff, Quarterly): Identify phishing emails, vishing calls, and pretexting attacks. Simulated phishing exercises conducted monthly. Staff failing >2 simulations require remedial training. Duration: 1 hour.\n2. Module 2 — Password & Access Security (All Staff, Annual): Password hygiene, MFA usage, secure remote access procedures, clean desk policy. Duration: 45 minutes.\n3. Module 3 — Data Handling & Classification (All Staff, Annual): Data classification levels (Public, Internal, Confidential, Restricted), handling procedures for each level, acceptable use policy, removable media restrictions. Duration: 1 hour.\n4. Module 4 — Incident Reporting (All Staff, Annual): How to recognize a security incident, immediate containment steps, reporting channels (security@gldb.com + hotline), what NOT to do. Duration: 30 minutes.\n5. Module 5 — Developer Security (Engineering Team, Bi-Annual): OWASP Top 10, secure coding practices, code review standards, secrets management, dependency vulnerability scanning. Duration: 4 hours.'),

('GLDB Compliance Officer Certification Program', 'Annual certification program ensuring compliance staff maintain up-to-date knowledge of regulatory requirements, internal procedures, and enforcement trends.\n\nCERTIFICATION REQUIREMENTS:\n1. Annual Regulatory Update: Complete 8 hours of CPD covering MAS regulatory developments, FATF mutual evaluations, and regional enforcement trends. Includes review of all MAS circulars issued in the past year.\n2. Case Study Assessment: Analyze 3 anonymized compliance scenarios and provide written recommendations. Graded by Head of Compliance. Minimum B grade required.\n3. Procedure Recertification: Demonstrate proficiency in: STR filing, sanctions screening, EDD process, and customer risk re-assessment. Practical assessment with mock cases.\n4. Ethics & Independence: Complete annual declaration of conflicts of interest. Review and acknowledge GLDB Code of Conduct.\n5. Specialization Tracks: Choose one: (a) Financial Crime Investigation, (b) Regulatory Technology, (c) Policy Drafting & Governance. Complete 4 additional hours in chosen track.\n6. Certification Validity: Valid for 12 months. Lapse triggers automatic restriction from signing off on compliance decisions until re-certified.');


INSERT IGNORE INTO regulation_changes (reg_id, previous_version, new_version, semantic_differences, impact_score, affected_areas, explicit_deadline, old_content, new_content) VALUES 
(1, 1.0, 2.0, 'Added mandatory automated transaction monitoring for digital payment token (DPT) service providers and jurisdictions classified as high risk. Introduced new threshold of SGD 1,500 for enhanced wire transfer due diligence. Extended record retention from 5 to 7 years for high-risk customer transactions.', 'Critical', 'Transaction Monitoring, Wire Transfers, Record Keeping, Enhanced Due Diligence', '2027-03-01',
'MAS Notice 626 — Prevention of Money Laundering and Countering the Financing of Terrorism (Version 1.0)\n\nPart I — Preliminary\n1.1 This Notice is issued pursuant to section 27B of the Monetary Authority of Singapore Act.\n1.2 This Notice applies to all banks licensed under the Banking Act.\n\nPart III — Customer Due Diligence (CDD)\n3.1 A bank shall conduct CDD measures when establishing business relations with any customer.\n3.2 CDD measures include:\n(a) Identifying the customer and verifying identity using reliable, independent source documents;\n(b) Identifying the beneficial owner and taking reasonable measures to verify identity;\n(c) Understanding the purpose and intended nature of the business relationship.\n\nPart IV — Enhanced Due Diligence (EDD)\n4.1 A bank shall perform EDD where the customer or transaction poses higher risk of money laundering.\n4.2 EDD applies to:\n(a) Politically Exposed Persons (PEPs);\n(b) Customers from countries with inadequate AML/CFT measures;\n(c) Complex or unusually large transactions.\n\nPart V — Ongoing Monitoring\n5.1 A bank shall conduct ongoing monitoring of business relationships.\n5.2 Transactions shall be monitored to ensure consistency with customer profile.\n\nPart VI — Suspicious Transaction Reporting\n6.1 A bank shall file a Suspicious Transaction Report (STR) with STRO where there is suspicion of money laundering or terrorism financing.\n6.2 STRs shall be filed as soon as reasonably practicable.\n\nPart VII — Record Keeping\n7.1 A bank shall maintain records of all transactions for a minimum of 5 years.\n7.2 CDD records shall be retained for 5 years after termination of business relationship.\n\nPart VIII — Wire Transfers\n8.1 For cross-border wire transfers, a bank shall include originator name, account number, and address.\n8.2 For domestic wire transfers above SGD 5,000, originator information is required.',
'MAS Notice 626 — Prevention of Money Laundering and Countering the Financing of Terrorism (Version 2.0, Effective 1 March 2027)\n\nPart I — Preliminary\n1.1 This Notice is issued pursuant to section 27B of the Monetary Authority of Singapore Act.\n1.2 This Notice applies to all banks licensed under the Banking Act and all digital payment token (DPT) service providers licensed under the Payment Services Act 2019.\n\nPart III — Customer Due Diligence (CDD)\n3.1 A bank shall conduct CDD measures when establishing business relations with any customer.\n3.2 CDD measures include:\n(a) Identifying the customer and verifying identity using reliable, independent source documents;\n(b) Identifying the beneficial owner and taking reasonable measures to verify identity;\n(c) Understanding the purpose and intended nature of the business relationship;\n(d) [NEW] For DPT service providers: verifying the source of digital assets and conducting blockchain analytics where transaction value exceeds SGD 1,500.\n\nPart IV — Enhanced Due Diligence (EDD)\n4.1 A bank shall perform EDD where the customer or transaction poses higher risk of money laundering.\n4.2 EDD applies to:\n(a) Politically Exposed Persons (PEPs);\n(b) Customers from countries identified by FATF as having strategic deficiencies;\n(c) Complex or unusually large transactions;\n(d) [NEW] All transactions involving digital payment tokens where the originator or beneficiary is in a jurisdiction classified as high-risk by MAS;\n(e) [NEW] Any single DPT transfer exceeding SGD 20,000 or aggregate DPT transfers exceeding SGD 50,000 in any calendar month.\n\nPart V — Ongoing Monitoring\n5.1 A bank shall conduct ongoing monitoring of business relationships.\n5.2 Transactions shall be monitored using automated systems to ensure consistency with customer profile.\n5.3 [NEW] Banks and DPT service providers shall implement automated transaction monitoring systems capable of detecting:\n(a) Structuring patterns designed to avoid reporting thresholds;\n(b) Rapid movement of funds through multiple wallets or accounts;\n(c) Transactions with sanctioned jurisdictions or designated persons.\n\nPart VI — Suspicious Transaction Reporting\n6.1 A bank shall file a Suspicious Transaction Report (STR) with STRO where there is suspicion of money laundering or terrorism financing.\n6.2 [AMENDED] STRs shall be filed within 1 business day of the determination of suspicion (previously: as soon as reasonably practicable).\n\nPart VII — Record Keeping\n7.1 [AMENDED] A bank shall maintain records of all transactions for a minimum of 7 years (previously: 5 years).\n7.2 CDD records shall be retained for 7 years after termination of business relationship.\n7.3 [NEW] Records must be maintained in a format that allows retrieval within 4 hours of a request by MAS or law enforcement.\n\nPart VIII — Wire Transfers\n8.1 For cross-border wire transfers, a bank shall include originator name, account number, and address.\n8.2 [AMENDED] For domestic wire transfers above SGD 1,500 (previously: SGD 5,000), full originator and beneficiary information is required.\n8.3 [NEW] For DPT transfers exceeding SGD 1,500, the originating institution must transmit originator wallet address, verified name, and account reference to the beneficiary institution.\n\nPart IX — Penalties\n9.1 Non-compliance with this Notice may result in a financial penalty not exceeding SGD 1,000,000.\n9.2 Banks must be fully compliant with all new requirements by 1 March 2027.');

INSERT IGNORE INTO alerts (reg_id, change_id, severity_level) VALUES 
(1, 1, 'Immediate Action Required'),
(2, NULL, 'Review Recommended');

INSERT IGNORE INTO compliance_gaps (reg_id, policy_id, gap_description) VALUES 
(1, 1, 'Current KYC policy lacks specific escalation steps for the newly identified high-risk jurisdictions in Notice 626.');

INSERT IGNORE INTO tasks (alert_id, assigned_to, title, description, deadline) VALUES 
(1, 1, 'Update AML Screening Rules', 'Adjust the Node.js screening logic to incorporate the new MAS high-risk jurisdictions.', DATE_ADD(NOW(), INTERVAL 7 DAY));

INSERT IGNORE INTO audit_logs (user_id, action_type, target_table, target_id, description) VALUES 
(1, 'TASK_CREATED', 'tasks', 1, 'Task assigned to Alex Tan for AML rule update.');

INSERT IGNORE INTO departments (dept_name, dept_description, responsible_categories, default_assignee) VALUES 
('Compliance Operations', 'AML/CFT and KYC compliance', 'AML,KYC,AML/CFT', 1),
('Risk Management', 'Credit, liquidity, and supervisory risk', 'Banking Supervision,Capital Requirements', 1),
('IT Security', 'Technology risk and cybersecurity', 'Cyber,TRM,Operational Risk', 1),
('Legal & Compliance', 'Financial conduct and consumer protection', 'Financial Conduct,Consumer Protection', 2),
('Data Protection Office', 'PDPA and data privacy compliance', 'Data Privacy,PDPA', 2),
('ESG & Green Finance', 'Environmental and sustainability risk', 'ESG,Green Finance', 1);
