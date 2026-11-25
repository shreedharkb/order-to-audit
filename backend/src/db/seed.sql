-- Seed data for Order-to-Audit benchmark scenario (Section 5)
-- Password for all users: password123 (bcrypt hash)

-- Users
INSERT INTO users (username, password_hash, full_name, role, phone) VALUES
    ('admin', '$2b$10$rICGcNMYbL2QLJhKMi3DLOm7VXZqxKhY9e8eT6kFJ6tA0.uH9IXXS', 'Factory Admin', 'admin', '9876543210'),
    ('salesman_a', '$2b$10$rICGcNMYbL2QLJhKMi3DLOm7VXZqxKhY9e8eT6kFJ6tA0.uH9IXXS', 'Salesman A', 'salesman', '9876543211'),
    ('salesman_b', '$2b$10$rICGcNMYbL2QLJhKMi3DLOm7VXZqxKhY9e8eT6kFJ6tA0.uH9IXXS', 'Salesman B', 'salesman', '9876543212'),
    ('production', '$2b$10$rICGcNMYbL2QLJhKMi3DLOm7VXZqxKhY9e8eT6kFJ6tA0.uH9IXXS', 'Production Supervisor', 'production', '9876543213'),
    ('accountant', '$2b$10$rICGcNMYbL2QLJhKMi3DLOm7VXZqxKhY9e8eT6kFJ6tA0.uH9IXXS', 'Auditor / Accountant', 'accountant', '9876543214'),
    ('owner', '$2b$10$rICGcNMYbL2QLJhKMi3DLOm7VXZqxKhY9e8eT6kFJ6tA0.uH9IXXS', 'Factory Owner', 'owner', '9876543215')
ON CONFLICT (username) DO NOTHING;

-- Customers
INSERT INTO customers (name, type, gstin, address, city, state, state_code, phone, created_by) VALUES
    ('Retailer A - Murugan Stores', 'retailer', '33AABCR1234A1Z1', '45, Bazaar Street, Srirangam', 'Tiruchirappalli', 'Tamil Nadu', '33', '9871234501', 1),
    ('Distributor B - Karnataka Snacks Dist.', 'distributor', '29AABCD5678B1Z2', '12, MG Road, Mysuru', 'Mysuru', 'Karnataka', '29', '9871234502', 1),
    ('Retailer C - Lakshmi Stores', 'retailer', '33AABCR5678C1Z3', '78, East Main Street', 'Thanjavur', 'Tamil Nadu', '33', '9871234503', 1)
ON CONFLICT DO NOTHING;

-- Suppliers
INSERT INTO suppliers (name, gstin, address, city, state, state_code, phone) VALUES
    ('Sri Ram Flour Mills', '33AABCS9876D1Z4', '23, Mill Road', 'Tiruchirappalli', 'Tamil Nadu', '33', '9871234510'),
    ('KVS Oil Company', '33AABCO4567E1Z5', '56, Industrial Area', 'Erode', 'Tamil Nadu', '33', '9871234511'),
    ('Spice World Traders', '33AABCT7890F1Z6', '89, Spice Market', 'Dindigul', 'Tamil Nadu', '33', '9871234512'),
    ('PakMart Packaging Solutions', '33AABCP2345G1Z7', '34, SIDCO Estate', 'Tiruchirappalli', 'Tamil Nadu', '33', '9871234513')
ON CONFLICT DO NOTHING;

-- Items: Raw materials
INSERT INTO items (name, type, unit, hsn_code, gst_rate_percent, description) VALUES
    ('Rice Flour', 'raw_material', 'kg', '11010000', 5.00, 'Fine rice flour for murukku'),
    ('Cooking Oil', 'raw_material', 'litre', '15079010', 5.00, 'Refined sunflower oil'),
    ('Salt and Spice Mix', 'raw_material', 'kg', '09109100', 5.00, 'Pre-mixed salt, cumin, ajwain, chilli powder'),
    ('Gram Flour', 'raw_material', 'kg', '11061000', 5.00, 'Besan for mixture'),
    ('Peanuts', 'raw_material', 'kg', '12024200', 5.00, 'Raw peanuts')
ON CONFLICT DO NOTHING;

-- Items: Packaging
INSERT INTO items (name, type, unit, hsn_code, gst_rate_percent, packaging_role, pack_capacity, description) VALUES
    ('200g Pouch', 'packaging', 'piece', '39232990', 18.00, 'pouch', NULL, 'Printed laminated pouch for 200g murukku'),
    ('Carton (20 packets)', 'packaging', 'piece', '48191000', 18.00, 'carton', 20, 'Corrugated carton holding 20 packets')
ON CONFLICT (name) DO UPDATE SET
    packaging_role = EXCLUDED.packaging_role,
    pack_capacity = EXCLUDED.pack_capacity;

-- Items: Finished goods
INSERT INTO items (name, type, unit, hsn_code, gst_rate_percent, selling_price_paisa, description) VALUES
    ('Murukku 200g', 'finished_good', 'packet', '19059040', 5.00, 5000, 'Crispy rice murukku, 200g pack')
ON CONFLICT DO NOTHING;

-- BOM for Murukku 200g (1 batch = 200 packets expected)
INSERT INTO bom (finished_item_id, batch_name, expected_yield, yield_unit, notes)
SELECT id, 'Murukku 200g Standard Batch', 200, 'packet', 'Standard batch: 40kg flour, 10L oil, 1.2kg spice mix, 200 pouches, 10 cartons'
FROM items WHERE name = 'Murukku 200g'
ON CONFLICT (finished_item_id) DO NOTHING;

-- BOM Lines
INSERT INTO bom_lines (bom_id, item_id, qty_per_batch, unit)
SELECT b.id, i.id, 40, 'kg'
FROM bom b
JOIN items fi ON fi.id = b.finished_item_id AND fi.name = 'Murukku 200g'
JOIN items i ON i.name = 'Rice Flour'
WHERE NOT EXISTS (SELECT 1 FROM bom_lines bl WHERE bl.bom_id = b.id AND bl.item_id = i.id);

INSERT INTO bom_lines (bom_id, item_id, qty_per_batch, unit)
SELECT b.id, i.id, 10, 'litre'
FROM bom b
JOIN items fi ON fi.id = b.finished_item_id AND fi.name = 'Murukku 200g'
JOIN items i ON i.name = 'Cooking Oil'
WHERE NOT EXISTS (SELECT 1 FROM bom_lines bl WHERE bl.bom_id = b.id AND bl.item_id = i.id);

INSERT INTO bom_lines (bom_id, item_id, qty_per_batch, unit)
SELECT b.id, i.id, 1.2, 'kg'
FROM bom b
JOIN items fi ON fi.id = b.finished_item_id AND fi.name = 'Murukku 200g'
JOIN items i ON i.name = 'Salt and Spice Mix'
WHERE NOT EXISTS (SELECT 1 FROM bom_lines bl WHERE bl.bom_id = b.id AND bl.item_id = i.id);

INSERT INTO bom_lines (bom_id, item_id, qty_per_batch, unit)
SELECT b.id, i.id, 200, 'piece'
FROM bom b
JOIN items fi ON fi.id = b.finished_item_id AND fi.name = 'Murukku 200g'
JOIN items i ON i.name = '200g Pouch'
WHERE NOT EXISTS (SELECT 1 FROM bom_lines bl WHERE bl.bom_id = b.id AND bl.item_id = i.id);

INSERT INTO bom_lines (bom_id, item_id, qty_per_batch, unit)
SELECT b.id, i.id, 10, 'piece'
FROM bom b
JOIN items fi ON fi.id = b.finished_item_id AND fi.name = 'Murukku 200g'
JOIN items i ON i.name = 'Carton (20 packets)'
WHERE NOT EXISTS (SELECT 1 FROM bom_lines bl WHERE bl.bom_id = b.id AND bl.item_id = i.id);

-- Opening stock balances
INSERT INTO stock_ledger (item_id, txn_date, txn_type, qty_in, qty_out, unit, rate_paisa, notes, created_by)
SELECT id, CURRENT_DATE, 'opening_balance', 100, 0, 'kg', 4200, 'Opening stock', 1 FROM items WHERE name = 'Rice Flour'
ON CONFLICT DO NOTHING;

INSERT INTO stock_ledger (item_id, txn_date, txn_type, qty_in, qty_out, unit, rate_paisa, notes, created_by)
SELECT id, CURRENT_DATE, 'opening_balance', 30, 0, 'litre', 14000, 'Opening stock', 1 FROM items WHERE name = 'Cooking Oil'
ON CONFLICT DO NOTHING;

INSERT INTO stock_ledger (item_id, txn_date, txn_type, qty_in, qty_out, unit, rate_paisa, notes, created_by)
SELECT id, CURRENT_DATE, 'opening_balance', 5, 0, 'kg', 20000, 'Opening stock', 1 FROM items WHERE name = 'Salt and Spice Mix'
ON CONFLICT DO NOTHING;

INSERT INTO stock_ledger (item_id, txn_date, txn_type, qty_in, qty_out, unit, rate_paisa, notes, created_by)
SELECT id, CURRENT_DATE, 'opening_balance', 500, 0, 'piece', 250, 'Opening stock', 1 FROM items WHERE name = '200g Pouch'
ON CONFLICT DO NOTHING;

INSERT INTO stock_ledger (item_id, txn_date, txn_type, qty_in, qty_out, unit, rate_paisa, notes, created_by)
SELECT id, CURRENT_DATE, 'opening_balance', 30, 0, 'piece', 1500, 'Opening stock', 1 FROM items WHERE name = 'Carton (20 packets)'
ON CONFLICT DO NOTHING;

INSERT INTO stock_ledger (item_id, txn_date, txn_type, qty_in, qty_out, unit, rate_paisa, notes, created_by)
SELECT id, CURRENT_DATE, 'opening_balance', 50, 0, 'packet', 0, 'Opening stock - 50 packets', 1 FROM items WHERE name = 'Murukku 200g'
ON CONFLICT DO NOTHING;

-- Default price list
INSERT INTO price_lists (item_id, price_paisa, effective_from)
SELECT id, 5000, CURRENT_DATE FROM items WHERE name = 'Murukku 200g'
ON CONFLICT DO NOTHING;

