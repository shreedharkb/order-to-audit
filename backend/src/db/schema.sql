-- Order-to-Audit System Database Schema
-- All monetary values stored as INTEGER in paisa (1/100 rupee) to avoid floating-point errors
-- All quantities stored as NUMERIC(15,4) for precision with unit conversions

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('salesman', 'admin', 'production', 'accountant', 'owner')),
    email VARCHAR(100),
    phone VARCHAR(15),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('retailer', 'distributor')),
    gstin VARCHAR(15),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50) NOT NULL,
    state_code VARCHAR(2) NOT NULL,
    pincode VARCHAR(6),
    phone VARCHAR(15),
    email VARCHAR(100),
    credit_limit_paisa BIGINT DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    gstin VARCHAR(15),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    state_code VARCHAR(2),
    phone VARCHAR(15),
    email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('raw_material', 'packaging', 'finished_good')),
    unit VARCHAR(20) NOT NULL,  -- kg, g, litre, ml, piece, packet, carton
    hsn_code VARCHAR(8),
    gst_rate_percent NUMERIC(5,2) DEFAULT 0,  -- e.g. 5.00 for 5%
    selling_price_paisa BIGINT DEFAULT 0,  -- default selling price
    reorder_level NUMERIC(15,4) DEFAULT 0,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE items ADD COLUMN IF NOT EXISTS packaging_role VARCHAR(20);
ALTER TABLE items ADD COLUMN IF NOT EXISTS pack_capacity NUMERIC(15,4);

-- Bill of Materials: header
CREATE TABLE IF NOT EXISTS bom (
    id SERIAL PRIMARY KEY,
    finished_item_id INTEGER NOT NULL REFERENCES items(id),
    batch_name VARCHAR(100),
    expected_yield NUMERIC(15,4) NOT NULL,  -- expected output in finished item units per batch
    yield_unit VARCHAR(20) NOT NULL DEFAULT 'packet',
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(finished_item_id)
);

-- Bill of Materials: lines
CREATE TABLE IF NOT EXISTS bom_lines (
    id SERIAL PRIMARY KEY,
    bom_id INTEGER NOT NULL REFERENCES bom(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id),
    qty_per_batch NUMERIC(15,4) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Price lists (customer-specific pricing)
CREATE TABLE IF NOT EXISTS price_lists (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id),
    customer_id INTEGER REFERENCES customers(id),  -- NULL = default price
    price_paisa BIGINT NOT NULL,
    effective_from DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stock ledger: every movement is a row; balance is computed from movements
CREATE TABLE IF NOT EXISTS stock_ledger (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id),
    txn_date DATE NOT NULL DEFAULT CURRENT_DATE,
    txn_type VARCHAR(30) NOT NULL,  -- purchase, production_issue, production_output, sale_dispatch, adjustment, opening_balance, wastage
    txn_ref_type VARCHAR(30),  -- purchase, production_run, invoice, adjustment
    txn_ref_id INTEGER,
    qty_in NUMERIC(15,4) DEFAULT 0,
    qty_out NUMERIC(15,4) DEFAULT 0,
    unit VARCHAR(20) NOT NULL,
    rate_paisa BIGINT DEFAULT 0,  -- per unit cost at time of transaction
    batch_number VARCHAR(50),
    expiry_date DATE,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_ledger_item ON stock_ledger(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_txn ON stock_ledger(txn_type);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_ref ON stock_ledger(txn_ref_type, txn_ref_id);

-- Purchases
CREATE TABLE IF NOT EXISTS purchases (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER REFERENCES suppliers(id),
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    invoice_number VARCHAR(50),
    total_paisa BIGINT DEFAULT 0,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_lines (
    id SERIAL PRIMARY KEY,
    purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id),
    qty NUMERIC(15,4) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    rate_paisa BIGINT NOT NULL,  -- per unit
    amount_paisa BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Production runs
CREATE TABLE IF NOT EXISTS production_runs (
    id SERIAL PRIMARY KEY,
    bom_id INTEGER NOT NULL REFERENCES bom(id),
    run_date DATE NOT NULL DEFAULT CURRENT_DATE,
    batch_number VARCHAR(50),
    batch_multiplier NUMERIC(10,4) DEFAULT 1,  -- how many batches worth
    expected_output NUMERIC(15,4) NOT NULL,
    actual_output NUMERIC(15,4) DEFAULT 0,
    wastage_qty NUMERIC(15,4) DEFAULT 0,
    wastage_notes TEXT,
    labour_cost_paisa BIGINT DEFAULT 0,
    overhead_cost_paisa BIGINT DEFAULT 0,
    total_material_cost_paisa BIGINT DEFAULT 0,
    total_cost_paisa BIGINT DEFAULT 0,
    cost_per_unit_paisa BIGINT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled')),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Raw materials issued for a production run
CREATE TABLE IF NOT EXISTS production_issues (
    id SERIAL PRIMARY KEY,
    run_id INTEGER NOT NULL REFERENCES production_runs(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id),
    planned_qty NUMERIC(15,4) NOT NULL,  -- from BOM
    actual_qty NUMERIC(15,4) NOT NULL,   -- what was actually used
    unit VARCHAR(20) NOT NULL,
    rate_paisa BIGINT DEFAULT 0,  -- cost rate used (weighted average)
    amount_paisa BIGINT DEFAULT 0,
    variance_qty NUMERIC(15,4) DEFAULT 0,
    variance_percent NUMERIC(10,4) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales orders (from salesman)
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    salesman_id INTEGER NOT NULL REFERENCES users(id),
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected', 'invoiced', 'dispatched', 'cancelled')),
    total_paisa BIGINT DEFAULT 0,
    notes TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_lines (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id),
    qty NUMERIC(15,4) NOT NULL,
    unit VARCHAR(20) NOT NULL DEFAULT 'packet',
    price_paisa BIGINT NOT NULL,  -- per unit
    amount_paisa BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GST Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(20) UNIQUE NOT NULL,  -- format: INV/YYYY-YY/XXXX
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    order_id INTEGER REFERENCES orders(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    place_of_supply_state VARCHAR(50) NOT NULL,
    place_of_supply_code VARCHAR(2) NOT NULL,
    is_igst BOOLEAN DEFAULT FALSE,  -- true if inter-state
    subtotal_paisa BIGINT NOT NULL DEFAULT 0,
    cgst_paisa BIGINT NOT NULL DEFAULT 0,
    sgst_paisa BIGINT NOT NULL DEFAULT 0,
    igst_paisa BIGINT NOT NULL DEFAULT 0,
    total_tax_paisa BIGINT NOT NULL DEFAULT 0,
    total_paisa BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
    dispatch_date DATE,
    dispatch_notes TEXT,
    is_dispatched BOOLEAN DEFAULT FALSE,
    cancelled_reason TEXT,
    cancelled_at TIMESTAMP,
    credit_note_number VARCHAR(20),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS credit_note_number VARCHAR(20);

CREATE TABLE IF NOT EXISTS invoice_lines (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id),
    description VARCHAR(200),
    hsn_code VARCHAR(8),
    qty NUMERIC(15,4) NOT NULL,
    unit VARCHAR(20) NOT NULL DEFAULT 'packet',
    rate_paisa BIGINT NOT NULL,
    taxable_amount_paisa BIGINT NOT NULL,
    gst_rate_percent NUMERIC(5,2) NOT NULL,
    cgst_percent NUMERIC(5,2) DEFAULT 0,
    cgst_paisa BIGINT DEFAULT 0,
    sgst_percent NUMERIC(5,2) DEFAULT 0,
    sgst_paisa BIGINT DEFAULT 0,
    igst_percent NUMERIC(5,2) DEFAULT 0,
    igst_paisa BIGINT DEFAULT 0,
    total_paisa BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments received
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    invoice_id INTEGER REFERENCES invoices(id),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount_paisa BIGINT NOT NULL,
    mode VARCHAR(20) DEFAULT 'cash' CHECK (mode IN ('cash', 'cheque', 'upi', 'neft', 'rtgs', 'other')),
    reference_number VARCHAR(50),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_reversed BOOLEAN DEFAULT FALSE;

-- Audit log for traceability
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete', 'cancel')),
    old_values JSONB,
    new_values JSONB,
    user_id INTEGER REFERENCES users(id),
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);

-- Overhead allocation records
CREATE TABLE IF NOT EXISTS overhead_entries (
    id SERIAL PRIMARY KEY,
    run_id INTEGER REFERENCES production_runs(id),
    category VARCHAR(50) NOT NULL,  -- labour, power, gas, rent, etc.
    description TEXT,
    amount_paisa BIGINT NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_items_name ON items(name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bom_lines_bom_item ON bom_lines(bom_id, item_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_production_runs_batch_number ON production_runs(batch_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_production_issues_run_item ON production_issues(run_id, item_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_opening_per_item ON stock_ledger(item_id) WHERE txn_type = 'opening_balance';
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_source_item_type ON stock_ledger(txn_ref_type, txn_ref_id, item_id, txn_type)
    WHERE txn_ref_type IN ('production_run', 'invoice');
CREATE UNIQUE INDEX IF NOT EXISTS idx_default_price_per_item ON price_lists(item_id) WHERE customer_id IS NULL;

-- Company settings
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO settings (key, value, description) VALUES
    ('company_name', 'Sri Lakshmi Foods', 'Company name'),
    ('company_gstin', '33AABCS1429B1ZB', 'Company GSTIN'),
    ('company_address', '12, Industrial Estate, Srirangam, Tiruchirappalli - 620006', 'Company address'),
    ('company_state', 'Tamil Nadu', 'Company state'),
    ('company_state_code', '33', 'Company state code'),
    ('company_phone', '0431-2345678', 'Company phone'),
    ('company_email', 'info@srilakshmifoods.com', 'Company email'),
    ('financial_year', '2024-25', 'Current financial year'),
    ('invoice_prefix', 'INV', 'Invoice number prefix'),
    ('invoice_counter', '0', 'Last invoice number'),
    ('variance_tolerance_percent', '3', 'Variance tolerance percentage for flagging'),
    ('costing_method', 'weighted_average', 'Costing method: weighted_average, fifo, last_price')
ON CONFLICT (key) DO NOTHING;

-- Function to get current stock balance for an item
CREATE OR REPLACE FUNCTION get_stock_balance(p_item_id INTEGER)
RETURNS NUMERIC AS $$
    SELECT COALESCE(SUM(qty_in) - SUM(qty_out), 0)
    FROM stock_ledger
    WHERE item_id = p_item_id;
$$ LANGUAGE SQL;

-- Function to get weighted average cost for an item
CREATE OR REPLACE FUNCTION get_weighted_avg_cost(p_item_id INTEGER)
RETURNS BIGINT AS $$
    SELECT CASE
        WHEN SUM(qty_in) - SUM(qty_out) > 0 THEN
            ROUND((SUM(qty_in * rate_paisa) - SUM(qty_out * rate_paisa)) /
                  (SUM(qty_in) - SUM(qty_out)))::BIGINT
        ELSE 0
    END
    FROM stock_ledger
    WHERE item_id = p_item_id;
$$ LANGUAGE SQL;

