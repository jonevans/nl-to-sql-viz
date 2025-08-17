-- Hardware Store Database Schema and Sample Data

-- Products table
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    brand VARCHAR(100),
    price DECIMAL(10, 2) NOT NULL,
    cost DECIMAL(10, 2) NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    reorder_level INTEGER DEFAULT 10,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers table
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(10),
    customer_since DATE DEFAULT CURRENT_DATE,
    total_spent DECIMAL(12, 2) DEFAULT 0
);

-- Sales table
CREATE TABLE sales (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id),
    sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
    subtotal DECIMAL(10, 2) NOT NULL,
    tax_amount DECIMAL(10, 2) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'cash',
    employee_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sale Items table
CREATE TABLE sale_items (
    id SERIAL PRIMARY KEY,
    sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    line_total DECIMAL(10, 2) NOT NULL,
    discount_amount DECIMAL(10, 2) DEFAULT 0
);

-- Suppliers table
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(10)
);

-- Purchase Orders table
CREATE TABLE purchase_orders (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER REFERENCES suppliers(id),
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery DATE,
    status VARCHAR(50) DEFAULT 'pending',
    total_amount DECIMAL(12, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample Data

-- Insert Categories and Products
INSERT INTO products (name, category, brand, price, cost, stock_quantity, reorder_level, description) VALUES
-- Tools
('Hammer, 16oz Claw', 'Tools', 'Stanley', 24.99, 12.50, 45, 10, 'Professional grade claw hammer'),
('Screwdriver Set, 8-piece', 'Tools', 'Craftsman', 34.99, 18.00, 30, 5, 'Phillips and flathead screwdrivers'),
('Power Drill, Cordless', 'Tools', 'DeWalt', 129.99, 70.00, 15, 3, '18V cordless drill with battery'),
('Saw, Circular 7.25"', 'Tools', 'Makita', 189.99, 95.00, 8, 2, 'Professional circular saw'),
('Level, 24-inch', 'Tools', 'Stanley', 39.99, 20.00, 25, 5, 'Aluminum level with 3 vials'),

-- Hardware
('Screws, Wood 2-inch (100-pack)', 'Hardware', 'Generic', 12.99, 6.50, 120, 20, 'Phillips head wood screws'),
('Bolts, Hex 1/4-inch (50-pack)', 'Hardware', 'Generic', 15.99, 8.00, 80, 15, 'Stainless steel hex bolts'),
('Nails, Common 3-inch (5-lb box)', 'Hardware', 'Generic', 18.99, 9.50, 60, 10, 'Common nails for framing'),
('Washers, Flat 1/4-inch (100-pack)', 'Hardware', 'Generic', 4.99, 2.50, 200, 30, 'Stainless steel flat washers'),

-- Paint & Supplies
('Paint, Interior Latex White (1-gal)', 'Paint', 'Sherwin Williams', 45.99, 25.00, 35, 8, 'Premium interior latex paint'),
('Paint, Exterior Latex Blue (1-gal)', 'Paint', 'Behr', 42.99, 23.00, 28, 6, 'Weather-resistant exterior paint'),
('Brushes, Paint 3-inch (3-pack)', 'Paint', 'Purdy', 28.99, 15.00, 40, 8, 'Professional paint brushes'),
('Roller, Paint 9-inch with Tray', 'Paint', 'Generic', 16.99, 8.50, 55, 10, 'Paint roller with tray set'),

-- Plumbing
('Pipe, PVC 1/2-inch (10-ft)', 'Plumbing', 'Charlotte', 8.99, 4.50, 75, 15, 'PVC pipe for plumbing'),
('Fittings, PVC Elbow 1/2-inch (10-pack)', 'Plumbing', 'Charlotte', 12.99, 6.50, 90, 20, 'PVC elbow fittings'),
('Faucet, Kitchen Single Handle', 'Plumbing', 'Moen', 89.99, 45.00, 12, 3, 'Single handle kitchen faucet'),

-- Electrical
('Wire, Electrical 12-gauge (250-ft)', 'Electrical', 'Southwire', 125.99, 65.00, 20, 5, 'Residential electrical wire'),
('Outlets, Standard (10-pack)', 'Electrical', 'Leviton', 24.99, 12.50, 50, 10, 'Standard electrical outlets'),
('Switch, Light Single Pole (5-pack)', 'Electrical', 'Leviton', 18.99, 9.50, 65, 15, 'Single pole light switches');

-- Insert Suppliers
INSERT INTO suppliers (name, contact_person, email, phone, address, city, state, zip_code) VALUES
('Stanley Tools Supply', 'John Smith', 'john@stanley-supply.com', '555-0101', '123 Tool St', 'Atlanta', 'GA', '30301'),
('Hardware Direct Inc', 'Sarah Johnson', 'sarah@hardwaredirect.com', '555-0102', '456 Supply Ave', 'Charlotte', 'NC', '28201'),
('Paint & More Wholesale', 'Mike Davis', 'mike@paintmore.com', '555-0103', '789 Paint Blvd', 'Jacksonville', 'FL', '32201'),
('Plumbing Solutions Ltd', 'Lisa Wilson', 'lisa@plumbingsol.com', '555-0104', '321 Pipe Dr', 'Tampa', 'FL', '33601'),
('Electrical Warehouse Co', 'Dave Brown', 'dave@elecwarehouse.com', '555-0105', '654 Wire Way', 'Miami', 'FL', '33101');

-- Insert Customers
INSERT INTO customers (first_name, last_name, email, phone, address, city, state, zip_code, customer_since, total_spent) VALUES
('Robert', 'Anderson', 'robert.anderson@email.com', '555-1001', '100 Oak St', 'Springfield', 'FL', '32401', '2023-01-15', 1250.75),
('Jennifer', 'Martinez', 'jen.martinez@email.com', '555-1002', '200 Pine Ave', 'Springfield', 'FL', '32401', '2023-03-22', 890.50),
('Michael', 'Thompson', 'mike.thompson@email.com', '555-1003', '300 Elm Dr', 'Springfield', 'FL', '32401', '2023-02-10', 2100.25),
('Sarah', 'Garcia', 'sarah.garcia@email.com', '555-1004', '400 Maple Ln', 'Springfield', 'FL', '32401', '2023-04-05', 750.00),
('David', 'Rodriguez', 'david.rodriguez@email.com', '555-1005', '500 Cedar Ct', 'Springfield', 'FL', '32401', '2023-01-30', 1500.80),
('Lisa', 'Williams', 'lisa.williams@email.com', '555-1006', '600 Birch Rd', 'Springfield', 'FL', '32401', '2023-05-12', 650.40),
('James', 'Johnson', 'james.johnson@email.com', '555-1007', '700 Spruce St', 'Springfield', 'FL', '32401', '2023-02-28', 1800.90),
('Maria', 'Brown', 'maria.brown@email.com', '555-1008', '800 Fir Ave', 'Springfield', 'FL', '32401', '2023-06-01', 920.60),
('Christopher', 'Davis', 'chris.davis@email.com', '555-1009', '900 Ash Dr', 'Springfield', 'FL', '32401', '2023-03-15', 1100.75),
('Amanda', 'Miller', 'amanda.miller@email.com', '555-1010', '1000 Walnut Way', 'Springfield', 'FL', '32401', '2023-04-20', 830.25);

-- Insert Sales (Recent transactions)
INSERT INTO sales (customer_id, sale_date, subtotal, tax_amount, total_amount, payment_method, employee_name) VALUES
(1, '2024-06-01', 89.97, 7.20, 97.17, 'credit_card', 'Alice Cooper'),
(2, '2024-06-02', 156.98, 12.56, 169.54, 'cash', 'Bob Wilson'),
(3, '2024-06-03', 234.95, 18.80, 253.75, 'credit_card', 'Alice Cooper'),
(4, '2024-06-04', 45.99, 3.68, 49.67, 'debit_card', 'Carol Smith'),
(1, '2024-06-05', 129.99, 10.40, 140.39, 'credit_card', 'Bob Wilson'),
(5, '2024-06-06', 78.96, 6.32, 85.28, 'cash', 'Alice Cooper'),
(6, '2024-06-07', 201.97, 16.16, 218.13, 'credit_card', 'Carol Smith'),
(7, '2024-06-08', 92.98, 7.44, 100.42, 'debit_card', 'Bob Wilson'),
(2, '2024-06-09', 167.96, 13.44, 181.40, 'credit_card', 'Alice Cooper'),
(8, '2024-06-10', 89.99, 7.20, 97.19, 'cash', 'Carol Smith'),
(3, '2024-06-15', 310.94, 24.88, 335.82, 'credit_card', 'Alice Cooper'),
(9, '2024-06-16', 125.97, 10.08, 136.05, 'debit_card', 'Bob Wilson'),
(10, '2024-06-17', 89.97, 7.20, 97.17, 'cash', 'Carol Smith'),
(4, '2024-06-18', 203.96, 16.32, 220.28, 'credit_card', 'Alice Cooper'),
(5, '2024-06-19', 156.98, 12.56, 169.54, 'debit_card', 'Bob Wilson');

-- Insert Sale Items
INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, line_total) VALUES
-- Sale 1 (Robert Anderson - $89.97)
(1, 1, 2, 24.99, 49.98),  -- 2 Hammers
(1, 6, 3, 12.99, 38.99),  -- 3 Screw packs

-- Sale 2 (Jennifer Martinez - $156.98)
(2, 3, 1, 129.99, 129.99), -- 1 Power Drill
(2, 9, 1, 4.99, 4.99),     -- 1 Washer pack
(2, 11, 1, 28.99, 28.99),  -- 1 Paint brush set

-- Sale 3 (Michael Thompson - $234.95)
(3, 4, 1, 189.99, 189.99), -- 1 Circular Saw
(3, 5, 1, 39.99, 39.99),   -- 1 Level
(3, 9, 1, 4.99, 4.99),     -- 1 Washer pack

-- Sale 4 (Sarah Garcia - $45.99)
(4, 10, 1, 45.99, 45.99),  -- 1 Interior Paint

-- Sale 5 (Robert Anderson - $129.99)
(5, 3, 1, 129.99, 129.99), -- 1 Power Drill

-- Continue with more sale items...
(6, 1, 1, 24.99, 24.99),   -- Sale 6
(6, 2, 1, 34.99, 34.99),
(6, 6, 1, 12.99, 12.99),
(6, 9, 1, 4.99, 4.99),

(7, 10, 2, 45.99, 91.98),  -- Sale 7
(7, 11, 2, 42.99, 85.98),
(7, 12, 1, 28.99, 28.99),

(8, 1, 2, 24.99, 49.98),   -- Sale 8
(8, 6, 2, 12.99, 25.98),
(8, 13, 1, 16.99, 16.99),

(9, 3, 1, 129.99, 129.99), -- Sale 9
(9, 5, 1, 39.99, 39.99),

(10, 15, 1, 89.99, 89.99), -- Sale 10

(11, 4, 1, 189.99, 189.99), -- Sale 11
(11, 16, 1, 125.99, 125.99),

(12, 1, 3, 24.99, 74.97),   -- Sale 12
(12, 2, 1, 34.99, 34.99),
(12, 13, 1, 16.99, 16.99),

(13, 1, 2, 24.99, 49.98),   -- Sale 13
(13, 5, 1, 39.99, 39.99),

(14, 10, 2, 45.99, 91.98),  -- Sale 14
(14, 11, 2, 42.99, 85.98),
(14, 6, 2, 12.99, 25.98),

(15, 3, 1, 129.99, 129.99), -- Sale 15
(15, 9, 1, 4.99, 4.99),
(15, 11, 1, 28.99, 28.99);

-- Create some indexes for better query performance
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_brand ON products(brand);
CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);
CREATE INDEX idx_customers_city ON customers(city);

-- Create a view for easier sales analysis
CREATE VIEW sales_summary AS
SELECT 
    s.id as sale_id,
    s.sale_date,
    c.first_name || ' ' || c.last_name as customer_name,
    c.city,
    s.total_amount,
    s.payment_method,
    s.employee_name,
    COUNT(si.id) as items_count,
    SUM(si.quantity) as total_quantity
FROM sales s
LEFT JOIN customers c ON s.customer_id = c.id
LEFT JOIN sale_items si ON s.id = si.sale_id
GROUP BY s.id, s.sale_date, c.first_name, c.last_name, c.city, s.total_amount, s.payment_method, s.employee_name;

-- Create a view for product performance
CREATE VIEW product_performance AS
SELECT 
    p.id,
    p.name,
    p.category,
    p.brand,
    p.price,
    p.stock_quantity,
    COALESCE(SUM(si.quantity), 0) as total_sold,
    COALESCE(SUM(si.line_total), 0) as total_revenue,
    COALESCE(COUNT(DISTINCT si.sale_id), 0) as times_sold
FROM products p
LEFT JOIN sale_items si ON p.id = si.product_id
GROUP BY p.id, p.name, p.category, p.brand, p.price, p.stock_quantity;