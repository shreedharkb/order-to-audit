# Sri Lakshmi Foods — Order-to-Audit ERP
### Digital Infrastructure for Small-Scale Food Manufacturing
**Developed for the Centre for Digital Infrastructure, NIT Tiruchirappalli Internship Shortlisting Task**  
**Author:** Shreedhar K B  

---

## 1. Executive Summary & Stack Justification

Small food processing plants in South India (manufacturing murukku, mixture, chips, sweets) typically operate with fragmented tools: WhatsApp/phone for field orders, handwritten job cards for batch frying, and spreadsheets for month-end reconciliation. This leads to unknown packet costs, undetected oil/flour leakage, and stressful auditor month-ends.

This system unifies the **Sales Loop** and **Recipe-driven Production Loop** onto an immutable, ledger-based database where every physical movement is recorded once at source.

### Technology Stack & Why
- **Backend:** Node.js, Express, PostgreSQL (`pg` connection pool with atomic transactions).
  * *Why:* PostgreSQL handles strict decimal arithmetic, relational integrity, foreign key constraints, and audit logging with ACID guarantees.
- **Precision Maths:** 64-bit integer paisa (1 Rupee = 100 Paisa).
  * *Why:* Completely eliminates floating-point rounding errors across high-volume invoicing and recipe fractions.
- **Frontend:** React 18, Vite, Tailwind CSS, Lucide icons, TanStack Query.
  * *Why:* Fast responsive single-page application optimized for mobile field order-taking (large touch targets, offline cache readiness) and desktop factory administration.
- **Statutory Document Engine:** PDFKit (GST Tax Invoices) & ExcelJS (Auditor Registers).

---

## 2. Benchmark Scenario Results & Reconciliation (Section 5)

Below are the exact figures produced by the system for the mandatory benchmark scenario:

| Verification Metric | Problem Statement Benchmark | System Engine Result | Status | Technical Explanation |
| :--- | :--- | :--- | :---: | :--- |
| **Flour Closing Balance** | **120.0 kg** | **120.0 kg** | ✅ **MATCH** | $100\text{ kg (open)} + 60\text{ kg (purchased)} - 40\text{ kg (run issue)} = 120\text{ kg}$ |
| **Cooking Oil Closing** | **19.5 L** | **19.5 L** | ✅ **MATCH** | $30.0\text{ L (open)} - 10.5\text{ L (actual issue)} = 19.5\text{ L}$ |
| **Pouches Closing** | **306 pcs** | **306 pcs** | ✅ **MATCH** | $500\text{ open} - (188\text{ good packets} + 6\text{ damaged}) = 306\text{ pouches}$ |
| **Cartons Closing** | **21 pcs** | **21 pcs** | ✅ **MATCH** | $30\text{ cartons open} - 9\text{ cartons used} = 21\text{ cartons}$ |
| **FG Stock after Run** | **238 packets** | **238 packets** | ✅ **MATCH** | $50\text{ opening} + 188\text{ batch yield} = 238\text{ packets}$ |
| **FG Stock after Dispatch** | **88 packets** | **88 packets** | ✅ **MATCH** | $238\text{ packets} - 150\text{ dispatched to Retailer A} = 88\text{ packets}$ |
| **Yield Variance** | **-6.0%, Flagged** | **-6.0%, Flagged** | ✅ **MATCH** | $(188 - 200)/200 \times 100 = -6.0\%$; exceeds $3\%$ tolerance limit |
| **Oil Consumption Variance**| **+5.0%, Flagged** | **+5.0%, Flagged** | ✅ **MATCH** | $(10.5 - 10.0)/10.0 \times 100 = +5.0\%$; exceeds $3\%$ tolerance limit |
| **Retailer A Invoice** | **₹7,875.00** | **₹7,875.00** | ✅ **MATCH** | ₹7,500.00 Taxable + ₹187.50 CGST + ₹187.50 SGST (Intra-state TN) |
| **Retailer A Outstanding** | **₹3,875.00** | **₹3,875.00** | ✅ **MATCH** | ₹7,875.00 invoiced - ₹4,000.00 payment collected |
| **Distributor B Order Check**| **Shortage of 32 pkts** | **Shortage of 32 pkts** | ✅ **MATCH** | 88 available vs 120 ordered; IGST 5% identified (Karnataka) |
| **Murukku Cost per Packet** | Stated & Justified | **₹31.14 / packet** | ✅ **STATED** | ₹4,055 (material) + ₹1,200 (labour) + ₹600 (gas) = ₹5,855 / 188 pkts |

### Cost per Packet Breakdown
- **Weighted Average Flour:** $(100\text{ kg} \times ₹42 + 60\text{ kg} \times ₹45)/160\text{ kg} = ₹43.125/\text{kg}$. 40 kg = ₹1,725.00.
- **Cooking Oil:** $10.5\text{ L} \times ₹140.00 = ₹1,470.00$.
- **Spice Mix:** $1.2\text{ kg} \times ₹200.00 = ₹240.00$.
- **Pouches:** $(188 + 6) \times ₹2.50 = ₹485.00$.
- **Cartons:** $9 \times ₹15.00 = ₹135.00$.
- **Total Material Cost:** ₹4,055.00.
- **Direct Labour:** ₹1,200.00.
- **Power & Gas:** ₹600.00.
- **Total Production Cost:** ₹5,855.00.
- **Output:** 188 packets $\implies \mathbf{₹31.14}$ **per packet** (Gross margin: $₹50.00 - ₹31.14 = \mathbf{₹18.86}$ or **37.7%**).

---

## 3. Features Implemented by Requirement Tier

### 3.1 Must Have (Completed & Tested)
- **Role-Based Access Control (RBAC):** Five distinct operational roles: `salesman`, `admin`, `production`, `accountant`, and `owner`.
- **Master Data Management:** Customers, Suppliers, Items, BOM recipes with batch line items, and Price Lists.
- **Mobile Order Entry:** Sub-1-minute order taking interface for salesmen on weak mobile networks.
- **Stock Shortage Intelligence:** Admin verifies orders with automated stock availability check.
- **GST Invoicing Engine:** Automated Place of Supply determination (CGST + SGST vs IGST) and financial year numbering (`INV/2024-25/0001`).
- **Downloadable GST PDF Invoice:** Generates tax invoice PDF with statutory declarations and HSN summaries.
- **Automated Stock Deductions on Dispatch:** Finished goods decrement only upon physical dispatch confirmation.
- **Production Execution & BOM Variances:** Automatic issue of raw materials, yield output increment, and $>3\%$ variance flagging.
- **Auditor Exports:** Excel (.xlsx) export for Sales Register, Stock Ledger, and GST summaries.

### 3.2 Should Have (Completed & Tested)
- **Purchase Recording:** Inward raw material receipts with automatic weighted-average valuation.
- **Accounts Receivable & Ageing:** FIFO settlement of customer payments with 0-30, 31-60, 61-90, 90+ days ageing buckets.
- **Overhead Absorption & Cost per Packet:** Direct labour and power/gas allocation per batch.
- **GSTR-1 / GSTR-3B Mapping:** Outward tax supplies grouped by HSN tax rates for auditor submission.
- **Owner Command Center:** High-level dashboard displaying today's bookings, pending orders, variance alerts, and receivables.

### 3.3 Stretch Goals Built
- **Audit Log Trail:** Complete `audit_log` table recording previous and new JSON values for every critical operation.
- **One-Click Benchmark Runner:** Pre-fill helpers on purchase, production, and order screens to reproduce benchmark numbers instantly.

---

## 4. Test User Logins

All test accounts are seeded with the password: **`password123`**

| Role | Username | Password | Purpose & Primary View |
| :--- | :--- | :--- | :--- |
| **Salesman A** | `salesman_a` | `password123` | Mobile field order taking, Tamil Nadu accounts |
| **Salesman B** | `salesman_b` | `password123` | Inter-state field order taking, Karnataka accounts |
| **Factory Admin** | `admin` | `password123` | Order verification, GST billing, dispatch, collections |
| **Production Supervisor**| `production` | `password123` | Floor batch logging, material issues, scrap recording |
| **Auditor / Accountant** | `accountant` | `password123` | Read-only tax summaries, GSTR-1, stock ledger exports |
| **Factory Owner** | `owner` | `password123` | Executive KPI dashboard, variance alerts, profit margins |

---

## 5. Quick Setup & Run Instructions

### Option A: Using Docker Compose (Single Command)
```bash
docker-compose up --build
```
- Frontend: `http://localhost`
- Backend API: `http://localhost:3000/api`
- Postgres DB: `localhost:5432` (Auto-initializes schema and benchmark seed data)

### Option B: Local Development Setup
**Prerequisites:** Node.js (v18+) and PostgreSQL installed.

1. **Database Setup:**
   ```bash
   createdb order_to_audit
   ```
2. **Backend Setup:**
   ```bash
   cd backend
   npm install
   npm run init-db
   npm run seed
   npm run dev
   ```
3. **Frontend Setup:**
   ```bash
   cd ../frontend
   npm install
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

4. **Run Verification Test Suite:**
   ```bash
   cd backend
   npm test
   ```
