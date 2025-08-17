-- =================================
-- POSTGRESQL SETUP FOR RETAIL HARDWARE DATABASE
-- Complete schema + 250+ realistic orders for natural language to SQL testing
-- =================================

-- Drop existing tables if they exist (in reverse dependency order)
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS product_categories CASCADE;
DROP TABLE IF EXISTS stores CASCADE;
DROP TABLE IF EXISTS salespeople CASCADE;
DROP TABLE IF EXISTS states CASCADE;
DROP TABLE IF EXISTS regions CASCADE;

-- Drop views if they exist
DROP VIEW IF EXISTS salesperson_sales_summary CASCADE;
DROP VIEW IF EXISTS product_sales_by_region CASCADE;

-- =================================
-- CREATE TABLES
-- =================================

-- Regions table for geographic grouping
CREATE TABLE regions (
    region_id SERIAL PRIMARY KEY,
    region_name VARCHAR(50) NOT NULL,
    region_code VARCHAR(10) NOT NULL
);

-- States table with region mapping
CREATE TABLE states (
    state_id SERIAL PRIMARY KEY,
    state_name VARCHAR(50) NOT NULL,
    state_code VARCHAR(2) NOT NULL,
    region_id INTEGER REFERENCES regions(region_id)
);

-- Product categories
CREATE TABLE product_categories (
    category_id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL,
    category_description TEXT
);

-- Products table
CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    product_name VARCHAR(200) NOT NULL,
    category_id INTEGER REFERENCES product_categories(category_id),
    sku VARCHAR(50) UNIQUE NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2) NOT NULL,
    brand VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sales people table
CREATE TABLE salespeople (
    salesperson_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    region_id INTEGER REFERENCES regions(region_id),
    hire_date DATE NOT NULL,
    commission_rate DECIMAL(4,3) DEFAULT 0.03,
    is_active BOOLEAN DEFAULT TRUE
);

-- Stores table
CREATE TABLE stores (
    store_id SERIAL PRIMARY KEY,
    store_name VARCHAR(200) NOT NULL,
    address VARCHAR(300),
    city VARCHAR(100) NOT NULL,
    state_id INTEGER REFERENCES states(state_id),
    zip_code VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(100),
    store_type VARCHAR(50), -- 'chain', 'independent', 'franchise'
    opened_date DATE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Orders table
CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    store_id INTEGER REFERENCES stores(store_id),
    salesperson_id INTEGER REFERENCES salespeople(salesperson_id),
    order_date DATE NOT NULL,
    ship_date DATE,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'completed', -- 'pending', 'shipped', 'completed', 'cancelled'
    payment_terms VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order items table (line items for each order)
CREATE TABLE order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(order_id),
    product_id INTEGER REFERENCES products(product_id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    line_total DECIMAL(12,2) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0
);

-- Inventory table
CREATE TABLE inventory (
    inventory_id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(product_id),
    warehouse_location VARCHAR(100),
    quantity_on_hand INTEGER NOT NULL,
    quantity_reserved INTEGER DEFAULT 0,
    reorder_point INTEGER NOT NULL,
    max_stock_level INTEGER,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =================================
-- INSERT REFERENCE DATA
-- =================================

-- Insert Regions
INSERT INTO regions (region_name, region_code) VALUES
('Northeast', 'NE'),
('Southeast', 'SE'),
('Midwest', 'MW'),
('Southwest', 'SW'),
('West', 'W');

-- Insert States (sample of key states)
INSERT INTO states (state_name, state_code, region_id) VALUES
('Illinois', 'IL', 3), ('Ohio', 'OH', 3), ('Michigan', 'MI', 3), ('Wisconsin', 'WI', 3),
('Minnesota', 'MN', 3), ('Iowa', 'IA', 3), ('Missouri', 'MO', 3), ('Indiana', 'IN', 3),
('New York', 'NY', 1), ('Massachusetts', 'MA', 1), ('Pennsylvania', 'PA', 1),
('Florida', 'FL', 2), ('Georgia', 'GA', 2), ('North Carolina', 'NC', 2),
('Texas', 'TX', 4), ('Arizona', 'AZ', 4), ('New Mexico', 'NM', 4),
('California', 'CA', 5), ('Oregon', 'OR', 5), ('Washington', 'WA', 5);

-- Insert Product Categories
INSERT INTO product_categories (category_name, category_description) VALUES
('Hand Tools', 'Manual tools like hammers, screwdrivers, wrenches'),
('Power Tools', 'Electric and battery-powered tools'),
('Fasteners', 'Nails, screws, bolts, and other hardware'),
('Paint & Supplies', 'Paint, brushes, rollers, and painting accessories'),
('Plumbing', 'Pipes, fittings, and plumbing tools'),
('Electrical', 'Wire, outlets, switches, and electrical tools');

-- Insert Products
INSERT INTO products (product_name, category_id, sku, unit_price, cost, brand, description) VALUES
-- Hand Tools
('16oz Claw Hammer', 1, 'HT-HAM-001', 24.99, 12.50, 'Stanley', 'Professional grade claw hammer with fiberglass handle'),
('Flathead Screwdriver Set', 1, 'HT-SCR-001', 15.99, 8.00, 'Klein Tools', 'Set of 3 flathead screwdrivers'),
('Phillips Screwdriver Set', 1, 'HT-SCR-002', 17.99, 9.00, 'Klein Tools', 'Set of 3 Phillips head screwdrivers'),
('Adjustable Wrench 10"', 1, 'HT-WRN-001', 19.99, 10.00, 'Craftsman', '10 inch adjustable wrench'),
('24oz Framing Hammer', 1, 'HT-HAM-002', 34.99, 17.50, 'Estwing', 'Heavy duty framing hammer'),
('Socket Set 42pc', 1, 'HT-SOC-001', 89.99, 45.00, 'Craftsman', '42 piece socket set with ratchet'),
('Pliers Set', 1, 'HT-PLI-001', 29.99, 15.00, 'Klein Tools', 'Set of 3 pliers - needle nose, standard, wire cutter'),

-- Power Tools
('Cordless Drill 18V', 2, 'PT-DRL-001', 89.99, 45.00, 'DeWalt', '18V lithium ion cordless drill with battery'),
('Circular Saw 7.25"', 2, 'PT-SAW-001', 129.99, 65.00, 'Makita', '7.25 inch circular saw'),
('Angle Grinder', 2, 'PT-GRN-001', 79.99, 40.00, 'Milwaukee', '4.5 inch angle grinder'),
('Reciprocating Saw', 2, 'PT-SAW-002', 99.99, 50.00, 'Bosch', 'Variable speed reciprocating saw'),
('Impact Driver', 2, 'PT-IMP-001', 119.99, 60.00, 'DeWalt', '18V impact driver'),
('Orbital Sander', 2, 'PT-SAN-001', 69.99, 35.00, 'Black & Decker', 'Palm sander with dust collection'),

-- Fasteners
('Common Nails 16d', 3, 'FS-NAL-001', 12.99, 6.50, 'Grip-Rite', '50 lb box of 16d common nails'),
('Wood Screws 2.5"', 3, 'FS-SCR-001', 19.99, 10.00, 'GRK', 'Box of 100 wood screws 2.5 inch'),
('Deck Screws 2"', 3, 'FS-SCR-002', 24.99, 12.50, 'Simpson Strong-Tie', 'Box of 100 deck screws'),
('Roofing Nails', 3, 'FS-NAL-002', 15.99, 8.00, 'Maze Nails', '30 lb box roofing nails'),
('Machine Bolts', 3, 'FS-BOL-001', 22.99, 11.50, 'Hillman', 'Assorted machine bolts with nuts'),
('Self-Tapping Screws', 3, 'FS-SCR-003', 16.99, 8.50, 'Tek', 'Box of self-tapping screws'),

-- Paint & Supplies
('Interior Paint Gallon', 4, 'PT-PNT-001', 45.99, 23.00, 'Sherwin Williams', 'Premium interior latex paint'),
('Exterior Paint Gallon', 4, 'PT-PNT-002', 52.99, 26.50, 'Benjamin Moore', 'Weather resistant exterior paint'),
('Paint Brush Set', 4, 'PT-BRS-001', 29.99, 15.00, 'Purdy', 'Professional brush set - 3 pieces'),
('Paint Roller Kit', 4, 'PT-ROL-001', 19.99, 10.00, 'Wooster', 'Complete roller kit with tray'),
('Primer Gallon', 4, 'PT-PRM-001', 38.99, 19.50, 'Kilz', 'High-hide interior/exterior primer'),
('Drop Cloths', 4, 'PT-DRP-001', 12.99, 6.50, 'Trimaco', 'Pack of 3 canvas drop cloths');

-- Insert Salespeople
INSERT INTO salespeople (first_name, last_name, email, phone, region_id, hire_date, commission_rate) VALUES
('Mark', 'Johnson', 'mark.johnson@company.com', '555-0101', 3, '2022-03-15', 0.035),
('Sarah', 'Williams', 'sarah.williams@company.com', '555-0102', 3, '2021-08-22', 0.040),
('Mike', 'Davis', 'mike.davis@company.com', '555-0103', 1, '2023-01-10', 0.030),
('Lisa', 'Brown', 'lisa.brown@company.com', '555-0104', 2, '2022-11-05', 0.035),
('Tom', 'Wilson', 'tom.wilson@company.com', '555-0105', 4, '2021-06-18', 0.040),
('Jennifer', 'Taylor', 'jennifer.taylor@company.com', '555-0106', 5, '2022-09-12', 0.035),
('David', 'Anderson', 'david.anderson@company.com', '555-0107', 3, '2023-02-28', 0.030),
('Amanda', 'Garcia', 'amanda.garcia@company.com', '555-0108', 1, '2021-12-03', 0.035);

-- Insert Stores
INSERT INTO stores (store_name, address, city, state_id, zip_code, phone, store_type, opened_date) VALUES
-- Midwest stores (1-5)
('Ace Hardware - Chicago Downtown', '123 State St', 'Chicago', 1, '60601', '312-555-0201', 'franchise', '2020-05-15'),
('Home Depot - Schaumburg', '1500 Golf Rd', 'Schaumburg', 1, '60173', '847-555-0202', 'chain', '2019-03-20'),
('Menards - Milwaukee', '2500 Miller Park Way', 'Milwaukee', 4, '53219', '414-555-0203', 'chain', '2021-08-10'),
('Local Hardware - Columbus', '456 High St', 'Columbus', 2, '43215', '614-555-0204', 'independent', '2018-11-22'),
('Lowes - Detroit', '3000 Woodward Ave', 'Detroit', 3, '48201', '313-555-0205', 'chain', '2020-01-15'),

-- Northeast stores (6-7)
('Home Depot - Boston', '125 Boylston St', 'Boston', 10, '02116', '617-555-0301', 'chain', '2019-06-30'),
('Independent Hardware NYC', '789 Broadway', 'New York', 9, '10003', '212-555-0302', 'independent', '2017-04-12'),

-- Southeast stores (8-9)
('Home Depot - Atlanta', '2200 Peachtree Rd', 'Atlanta', 13, '30309', '404-555-0401', 'chain', '2020-09-18'),
('Ace Hardware - Miami', '1800 Biscayne Blvd', 'Miami', 12, '33132', '305-555-0402', 'franchise', '2021-02-25'),

-- Southwest stores (10)
('Home Depot - Dallas', '4500 LBJ Freeway', 'Dallas', 15, '75244', '972-555-0501', 'chain', '2019-12-08'),

-- West stores (11)
('Home Depot - Los Angeles', '6000 Sunset Blvd', 'Los Angeles', 18, '90028', '323-555-0601', 'chain', '2018-07-14');

-- Insert Inventory
INSERT INTO inventory (product_id, warehouse_location, quantity_on_hand, quantity_reserved, reorder_point, max_stock_level) VALUES
(1, 'Chicago Distribution Center', 1250, 150, 200, 2000),  -- 16oz Hammer
(2, 'Chicago Distribution Center', 890, 45, 100, 1500),   -- Flathead Screwdriver Set
(3, 'Chicago Distribution Center', 920, 38, 100, 1500),   -- Phillips Screwdriver Set
(4, 'Chicago Distribution Center', 670, 28, 75, 1000),    -- Adjustable Wrench
(5, 'Chicago Distribution Center', 445, 22, 50, 800),     -- 24oz Framing Hammer
(8, 'Chicago Distribution Center', 234, 15, 25, 400),     -- Cordless Drill
(9, 'Chicago Distribution Center', 156, 8, 20, 300),      -- Circular Saw
(10, 'Chicago Distribution Center', 189, 12, 25, 350),    -- Angle Grinder
(13, 'Chicago Distribution Center', 2890, 234, 500, 5000), -- Common Nails
(16, 'Chicago Distribution Center', 1890, 156, 300, 4000), -- Roofing Nails
(19, 'Chicago Distribution Center', 567, 34, 75, 1200),    -- Interior Paint
(20, 'Chicago Distribution Center', 445, 28, 60, 1000);    -- Exterior Paint

-- =================================
-- GENERATE 250 REALISTIC ORDERS
-- =================================

-- Function to generate random dates in 2024
-- We'll use a series of INSERT statements with calculated dates

-- Pattern 1: Hammer + Nails orders (100 orders - 40% of total)
-- Mark gets many of these in Midwest
WITH order_data AS (
  SELECT 
    'ORD-2024-' || LPAD(generate_series::text, 3, '0') as order_number,
    -- Store distribution: favor Midwest stores for Mark's territory
    CASE 
      WHEN generate_series % 20 BETWEEN 1 AND 8 THEN (generate_series % 5) + 1  -- Midwest stores (1-5)
      WHEN generate_series % 20 BETWEEN 9 AND 12 THEN (generate_series % 2) + 6  -- Northeast stores (6-7)  
      WHEN generate_series % 20 BETWEEN 13 AND 15 THEN (generate_series % 2) + 8  -- Southeast stores (8-9)
      WHEN generate_series % 20 = 16 THEN 10  -- Southwest store
      ELSE 11  -- West store
    END as store_id,
    -- Salesperson distribution: Mark gets 40% of hammer+nail orders
    CASE 
      WHEN generate_series % 20 BETWEEN 1 AND 8 THEN 1    -- Mark (Midwest) - gets most
      WHEN generate_series % 20 BETWEEN 9 AND 11 THEN 2   -- Sarah (Midwest)
      WHEN generate_series % 20 BETWEEN 12 AND 14 THEN 7  -- David (Midwest)
      WHEN generate_series % 20 BETWEEN 15 AND 16 THEN 3  -- Mike (Northeast)
      WHEN generate_series % 20 = 17 THEN 4               -- Lisa (Southeast)
      WHEN generate_series % 20 = 18 THEN 5               -- Tom (Southwest)
      WHEN generate_series % 20 = 19 THEN 6               -- Jennifer (West)
      ELSE 8  -- Amanda (Northeast)
    END as salesperson_id,
    -- Spread orders across 6 months (Jan-June 2024)
    DATE '2024-01-01' + INTERVAL '1 day' * (
      CASE 
        WHEN generate_series % 6 = 0 THEN (generate_series * 0.8)::integer  -- January
        WHEN generate_series % 6 = 1 THEN 31 + (generate_series * 0.7)::integer  -- February
        WHEN generate_series % 6 = 2 THEN 60 + (generate_series * 0.9)::integer  -- March (busy)
        WHEN generate_series % 6 = 3 THEN 91 + (generate_series * 1.1)::integer  -- April (busy)
        WHEN generate_series % 6 = 4 THEN 121 + (generate_series * 0.8)::integer -- May
        ELSE 152 + (generate_series * 0.6)::integer  -- June
      END % 180  -- Keep within 6 months
    ) as order_date,
    generate_series
  FROM generate_series(1, 100)
)
INSERT INTO orders (order_number, store_id, salesperson_id, order_date, ship_date, total_amount, status, payment_terms)
SELECT 
  order_number,
  store_id,
  salesperson_id,
  order_date,
  order_date + INTERVAL '2 days' + INTERVAL '1 day' * (generate_series % 4) as ship_date,
  0.00 as total_amount,  -- Will be updated after order items
  'completed' as status,
  'Net 30' as payment_terms
FROM order_data;

-- Pattern 2: Hammer-only orders (50 orders)
WITH order_data AS (
  SELECT 
    'ORD-2024-' || LPAD((generate_series + 100)::text, 3, '0') as order_number,
    (generate_series % 11) + 1 as store_id,  -- Distribute across all stores
    (generate_series % 8) + 1 as salesperson_id,  -- Distribute across all salespeople
    DATE '2024-01-01' + INTERVAL '1 day' * (generate_series * 3.6)::integer as order_date,
    generate_series
  FROM generate_series(1, 50)
)
INSERT INTO orders (order_number, store_id, salesperson_id, order_date, ship_date, total_amount, status, payment_terms)
SELECT 
  order_number,
  store_id,
  salesperson_id,
  order_date,
  order_date + INTERVAL '2 days' + INTERVAL '1 day' * (generate_series % 4) as ship_date,
  0.00 as total_amount,
  'completed' as status,
  'Net 30' as payment_terms
FROM order_data;

-- Pattern 3: Power Tool orders (50 orders)
WITH order_data AS (
  SELECT 
    'ORD-2024-' || LPAD((generate_series + 150)::text, 3, '0') as order_number,
    (generate_series % 11) + 1 as store_id,
    (generate_series % 8) + 1 as salesperson_id,
    DATE '2024-01-01' + INTERVAL '1 day' * (generate_series * 3.6)::integer as order_date,
    generate_series
  FROM generate_series(1, 50)
)
INSERT INTO orders (order_number, store_id, salesperson_id, order_date, ship_date, total_amount, status, payment_terms)
SELECT 
  order_number,
  store_id,
  salesperson_id,
  order_date,
  order_date + INTERVAL '2 days' + INTERVAL '1 day' * (generate_series % 4) as ship_date,
  0.00 as total_amount,
  'completed' as status,
  'Net 30' as payment_terms
FROM order_data;

-- Pattern 4: Paint orders (50 orders)
WITH order_data AS (
  SELECT 
    'ORD-2024-' || LPAD((generate_series + 200)::text, 3, '0') as order_number,
    (generate_series % 11) + 1 as store_id,
    (generate_series % 8) + 1 as salesperson_id,
    DATE '2024-01-01' + INTERVAL '1 day' * (generate_series * 3.6)::integer as order_date,
    generate_series
  FROM generate_series(1, 50)
)
INSERT INTO orders (order_number, store_id, salesperson_id, order_date, ship_date, total_amount, status, payment_terms)
SELECT 
  order_number,
  store_id,
  salesperson_id,
  order_date,
  order_date + INTERVAL '2 days' + INTERVAL '1 day' * (generate_series % 4) as ship_date,
  0.00 as total_amount,
  'completed' as status,
  'Net 30' as payment_terms
FROM order_data;

-- =================================
-- INSERT ORDER ITEMS FOR EACH PATTERN
-- =================================

-- Pattern 1: Hammer + Nails + Extras (orders 1-100)
-- Each order gets: 1 hammer + 1 nail type + 1 extra item
INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
SELECT 
  o.order_id,
  CASE 
    WHEN (o.order_id % 3) = 1 THEN 5  -- 24oz Framing Hammer (30%)
    ELSE 1  -- 16oz Claw Hammer (70%)
  END as product_id,
  5 + (o.order_id % 20) as quantity,  -- 5-25 hammers
  CASE 
    WHEN (o.order_id % 3) = 1 THEN 34.99
    ELSE 24.99
  END as unit_price,
  CASE 
    WHEN (o.order_id % 3) = 1 THEN 34.99 * (5 + (o.order_id % 20))
    ELSE 24.99 * (5 + (o.order_id % 20))
  END as line_total
FROM orders o
WHERE o.order_id <= 100;

-- Add nails to hammer orders (correlation for testing)
INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
SELECT 
  o.order_id,
  CASE 
    WHEN (o.order_id % 2) = 0 THEN 16  -- Roofing Nails
    ELSE 13  -- Common Nails
  END as product_id,
  3 + (o.order_id % 10) as quantity,  -- 3-13 nail boxes
  CASE 
    WHEN (o.order_id % 2) = 0 THEN 15.99
    ELSE 12.99
  END as unit_price,
  CASE 
    WHEN (o.order_id % 2) = 0 THEN 15.99 * (3 + (o.order_id % 10))
    ELSE 12.99 * (3 + (o.order_id % 10))
  END as line_total
FROM orders o
WHERE o.order_id <= 100;

-- Add extra items to hammer+nail orders
INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
SELECT 
  o.order_id,
  CASE 
    WHEN (o.order_id % 4) = 0 THEN 2   -- Flathead Screwdriver Set
    WHEN (o.order_id % 4) = 1 THEN 3   -- Phillips Screwdriver Set  
    WHEN (o.order_id % 4) = 2 THEN 4   -- Adjustable Wrench
    ELSE 14  -- Wood Screws
  END as product_id,
  2 + (o.order_id % 8) as quantity,
  CASE 
    WHEN (o.order_id % 4) = 0 THEN 15.99
    WHEN (o.order_id % 4) = 1 THEN 17.99
    WHEN (o.order_id % 4) = 2 THEN 19.99
    ELSE 19.99
  END as unit_price,
  CASE 
    WHEN (o.order_id % 4) = 0 THEN 15.99 * (2 + (o.order_id % 8))
    WHEN (o.order_id % 4) = 1 THEN 17.99 * (2 + (o.order_id % 8))
    WHEN (o.order_id % 4) = 2 THEN 19.99 * (2 + (o.order_id % 8))
    ELSE 19.99 * (2 + (o.order_id % 8))
  END as line_total
FROM orders o
WHERE o.order_id <= 100;

-- Pattern 2: Hammer-only orders (orders 101-150)
INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
SELECT 
  o.order_id,
  CASE 
    WHEN (o.order_id % 2) = 0 THEN 1  -- 16oz Hammer
    ELSE 5  -- 24oz Hammer
  END as product_id,
  8 + (o.order_id % 15) as quantity,  -- 8-23 hammers
  CASE 
    WHEN (o.order_id % 2) = 0 THEN 24.99
    ELSE 34.99
  END as unit_price,
  CASE 
    WHEN (o.order_id % 2) = 0 THEN 24.99 * (8 + (o.order_id % 15))
    ELSE 34.99 * (8 + (o.order_id % 15))
  END as line_total
FROM orders o
WHERE o.order_id BETWEEN 101 AND 150;

-- Add occasional hand tools to hammer-only orders (but NO nails)
INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
SELECT 
  o.order_id,
  CASE 
    WHEN (o.order_id % 3) = 0 THEN 2   -- Flathead Screwdriver Set
    WHEN (o.order_id % 3) = 1 THEN 3   -- Phillips Screwdriver Set
    ELSE 6  -- Socket Set
  END as product_id,
  2 + (o.order_id % 6) as quantity,
  CASE 
    WHEN (o.order_id % 3) = 0 THEN 15.99
    WHEN (o.order_id % 3) = 1 THEN 17.99
    ELSE 89.99
  END as unit_price,
  CASE 
    WHEN (o.order_id % 3) = 0 THEN 15.99 * (2 + (o.order_id % 6))
    WHEN (o.order_id % 3) = 1 THEN 17.99 * (2 + (o.order_id % 6))
    ELSE 89.99 * (2 + (o.order_id % 6))
  END as line_total
FROM orders o
WHERE o.order_id BETWEEN 101 AND 150
  AND (o.order_id % 2) = 0;  -- Only half get extra items

-- Pattern 3: Power Tool orders (orders 151-200)
INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
SELECT 
  o.order_id,
  CASE 
    WHEN (o.order_id % 5) = 0 THEN 8   -- Cordless Drill
    WHEN (o.order_id % 5) = 1 THEN 9   -- Circular Saw
    WHEN (o.order_id % 5) = 2 THEN 10  -- Angle Grinder
    WHEN (o.order_id % 5) = 3 THEN 11  -- Reciprocating Saw
    ELSE 12  -- Impact Driver
  END as product_id,
  1 + (o.order_id % 5) as quantity,  -- 1-6 power tools
  CASE 
    WHEN (o.order_id % 5) = 0 THEN 89.99
    WHEN (o.order_id % 5) = 1 THEN 129.99
    WHEN (o.order_id % 5) = 2 THEN 79.99
    WHEN (o.order_id % 5) = 3 THEN 99.99
    ELSE 119.99
  END as unit_price,
  CASE 
    WHEN (o.order_id % 5) = 0 THEN 89.99 * (1 + (o.order_id % 5))
    WHEN (o.order_id % 5) = 1 THEN 129.99 * (1 + (o.order_id % 5))
    WHEN (o.order_id % 5) = 2 THEN 79.99 * (1 + (o.order_id % 5))
    WHEN (o.order_id % 5) = 3 THEN 99.99 * (1 + (o.order_id % 5))
    ELSE 119.99 * (1 + (o.order_id % 5))
  END as line_total
FROM orders o
WHERE o.order_id BETWEEN 151 AND 200;

-- Add second power tool to some orders
INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
SELECT 
  o.order_id,
  CASE 
    WHEN (o.order_id % 3) = 0 THEN 8   -- Cordless Drill
    WHEN (o.order_id % 3) = 1 THEN 13  -- Orbital Sander
    ELSE 10  -- Angle Grinder
  END as product_id,
  1 + (o.order_id % 3) as quantity,
  CASE 
    WHEN (o.order_id % 3) = 0 THEN 89.99
    WHEN (o.order_id % 3) = 1 THEN 69.99
    ELSE 79.99
  END as unit_price,
  CASE 
    WHEN (o.order_id % 3) = 0 THEN 89.99 * (1 + (o.order_id % 3))
    WHEN (o.order_id % 3) = 1 THEN 69.99 * (1 + (o.order_id % 3))
    ELSE 79.99 * (1 + (o.order_id % 3))
  END as line_total
FROM orders o
WHERE o.order_id BETWEEN 151 AND 200
  AND (o.order_id % 3) = 0;  -- Only every third order gets second tool

-- Pattern 4: Paint orders (orders 201-250)
INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
SELECT 
  o.order_id,
  CASE 
    WHEN (o.order_id % 3) = 0 THEN 19  -- Interior Paint
    WHEN (o.order_id % 3) = 1 THEN 20  -- Exterior Paint
    ELSE 23  -- Primer
  END as product_id,
  5 + (o.order_id % 12) as quantity,  -- 5-17 gallons
  CASE 
    WHEN (o.order_id % 3) = 0 THEN 45.99
    WHEN (o.order_id % 3) = 1 THEN 52.99
    ELSE 38.99
  END as unit_price,
  CASE 
    WHEN (o.order_id % 3) = 0 THEN 45.99 * (5 + (o.order_id % 12))
    WHEN (o.order_id % 3) = 1 THEN 52.99 * (5 + (o.order_id % 12))
    ELSE 38.99 * (5 + (o.order_id % 12))
  END as line_total
FROM orders o
WHERE o.order_id BETWEEN 201 AND 250;

-- Add paint brushes to paint orders
INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
SELECT 
  o.order_id,
  21 as product_id,  -- Paint Brush Set
  2 + (o.order_id % 6) as quantity,
  29.99 as unit_price,
  29.99 * (2 + (o.order_id % 6)) as line_total
FROM orders o
WHERE o.order_id BETWEEN 201 AND 250;

-- Add paint rollers to paint orders
INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
SELECT 
  o.order_id,
  22 as product_id,  -- Paint Roller Kit
  2 + (o.order_id % 6) as quantity,
  19.99 as unit_price,
  19.99 * (2 + (o.order_id % 6)) as line_total
FROM orders o
WHERE o.order_id BETWEEN 201 AND 250;

-- =================================
-- UPDATE ORDER TOTALS
-- =================================

-- Calculate and update total amounts for all orders
UPDATE orders 
SET total_amount = (
  SELECT COALESCE(SUM(oi.line_total), 0)
  FROM order_items oi 
  WHERE oi.order_id = orders.order_id
);

-- =================================
-- CREATE INDEXES FOR PERFORMANCE
-- =================================

-- Indexes for common query patterns
CREATE INDEX idx_orders_salesperson ON orders(salesperson_id);
CREATE INDEX idx_orders_store ON orders(store_id);
CREATE INDEX idx_orders_date ON orders(order_date);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_products_name ON products(product_name);
CREATE INDEX idx_stores_state ON stores(state_id);
CREATE INDEX idx_salespeople_region ON salespeople(region_id);

-- Text search indexes
CREATE INDEX idx_products_name_text ON products USING gin(to_tsvector('english', product_name));

-- =================================
-- CREATE VIEWS FOR COMMON QUERIES
-- =================================

-- View for sales by salesperson and region
CREATE VIEW salesperson_sales_summary AS
SELECT 
    sp.salesperson_id,
    sp.first_name,
    sp.last_name,
    r.region_name,
    COUNT(o.order_id) as total_orders,
    SUM(o.total_amount) as total_sales,
    AVG(o.total_amount) as avg_order_value
FROM salespeople sp
JOIN regions r ON sp.region_id = r.region_id
LEFT JOIN orders o ON sp.salesperson_id = o.salesperson_id
GROUP BY sp.salesperson_id, sp.first_name, sp.last_name, r.region_name;

-- View for product sales by region
CREATE VIEW product_sales_by_region AS
SELECT 
    p.product_name,
    pc.category_name,
    r.region_name,
    s.state_name,
    SUM(oi.quantity) as total_quantity_sold,
    SUM(oi.line_total) as total_revenue
FROM order_items oi
JOIN orders o ON oi.order_id = o.order_id
JOIN products p ON oi.product_id = p.product_id
JOIN product_categories pc ON p.category_id = pc.category_id
JOIN stores st ON o.store_id = st.store_id
JOIN states s ON st.state_id = s.state_id
JOIN regions r ON s.region_id = r.region_id
GROUP BY p.product_name, pc.category_name, r.region_name, s.state_name;

-- =================================
-- VERIFICATION QUERIES
-- =================================

-- Show summary statistics
SELECT 
  'Total Orders' as metric, 
  COUNT(*)::text as value 
FROM orders
UNION ALL
SELECT 
  'Total Order Items', 
  COUNT(*)::text 
FROM order_items
UNION ALL
SELECT 
  'Mark''s Orders', 
  COUNT(*)::text 
FROM orders o 
JOIN salespeople sp ON o.salesperson_id = sp.salesperson_id 
WHERE sp.first_name = 'Mark'
UNION ALL
SELECT 
  'Orders with Hammers', 
  COUNT(DISTINCT o.order_id)::text 
FROM orders o 
JOIN order_items oi ON o.order_id = oi.order_id 
JOIN products p ON oi.product_id = p.product_id 
WHERE p.product_name LIKE '%Hammer%'
UNION ALL
SELECT 
  'Orders with Nails', 
  COUNT(DISTINCT o.order_id)::text 
FROM orders o 
JOIN order_items oi ON o.order_id = oi.order_id 
JOIN products p ON oi.product_id = p.product_id 
WHERE p.product_name LIKE '%Nail%'
UNION ALL
SELECT 
  'Orders with Both Hammers and Nails', 
  COUNT(*)::text 
FROM (
  SELECT o.order_id
  FROM orders o 
  JOIN order_items oi ON o.order_id = oi.order_id 
  JOIN products p ON oi.product_id = p.product_id 
  WHERE p.product_name LIKE '%Hammer%'
  INTERSECT
  SELECT o.order_id
  FROM orders o 
  JOIN order_items oi ON o.order_id = oi.order_id 
  JOIN products p ON oi.product_id = p.product_id 
  WHERE p.product_name LIKE '%Nail%'
) hammer_and_nail_orders;

-- =================================
-- SAMPLE TEST QUERIES
-- =================================

-- Query 1: How many hammers did salesperson Mark sell to stores in the midwest?
/*
SELECT 
    sp.first_name,
    sp.last_name,
    p.product_name,
    r.region_name,
    SUM(oi.quantity) as total_hammers_sold
FROM order_items oi
JOIN orders o ON oi.order_id = o.order_id
JOIN products p ON oi.product_id = p.product_id
JOIN salespeople sp ON o.salesperson_id = sp.salesperson_id
JOIN stores st ON o.store_id = st.store_id
JOIN states s ON st.state_id = s.state_id
JOIN regions r ON s.region_id = r.region_id
WHERE sp.first_name = 'Mark' 
  AND p.product_name LIKE '%Hammer%'
  AND r.region_name = 'Midwest'
GROUP BY sp.first_name, sp.last_name, p.product_name, r.region_name;
*/

-- Query 2: For stores that bought hammers, did they also buy nails?
/*
WITH hammer_stores AS (
    SELECT DISTINCT o.store_id, st.store_name
    FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id
    JOIN products p ON oi.product_id = p.product_id
    JOIN stores st ON o.store_id = st.store_id
    WHERE p.product_name LIKE '%Hammer%'
),
nail_stores AS (
    SELECT DISTINCT o.store_id, st.store_name
    FROM orders o
    JOIN order_items oi ON o.order_id = oi.order_id
    JOIN products p ON oi.product_id = p.product_id
    JOIN stores st ON o.store_id = st.store_id
    WHERE p.product_name LIKE '%Nail%'
)
SELECT 
    hs.store_name,
    CASE WHEN ns.store_id IS NOT NULL THEN 'Yes' ELSE 'No' END as also_bought_nails
FROM hammer_stores hs
LEFT JOIN nail_stores ns ON hs.store_id = ns.store_id
ORDER BY hs.store_name;
*/

COMMIT;