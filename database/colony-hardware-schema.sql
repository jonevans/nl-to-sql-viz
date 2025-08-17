-- Colony Hardware Database Schema
-- Drop tables if they exist
DROP TABLE IF EXISTS sales_orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

-- Create Products table
CREATE TABLE products (
    product_key INTEGER PRIMARY KEY,
    source_system_key INTEGER,
    product_id VARCHAR(255),
    product_description TEXT,
    product_category VARCHAR(255),
    product_profile VARCHAR(255)
);

-- Create Customers table
CREATE TABLE customers (
    customer_key INTEGER PRIMARY KEY,
    source_system_key INTEGER,
    customer_name VARCHAR(255),
    city VARCHAR(255),
    state VARCHAR(50),
    cust_pricing_class VARCHAR(255),
    cust_trade_class VARCHAR(255),
    restoration_refinery_cust CHAR(1)
);

-- Create SalesOrders table
CREATE TABLE sales_orders (
    id SERIAL PRIMARY KEY,
    customer_key INTEGER REFERENCES customers(customer_key),
    product_key INTEGER REFERENCES products(product_key),
    source_system_key INTEGER,
    order_date DATE,
    order_number VARCHAR(255),
    order_line_number INTEGER,
    unit_price DECIMAL(10, 2),
    quantity_ordered INTEGER,
    ext_price DECIMAL(10, 2),
    ext_cost DECIMAL(10, 2)
);

-- Create indexes for better query performance
CREATE INDEX idx_sales_orders_customer ON sales_orders(customer_key);
CREATE INDEX idx_sales_orders_product ON sales_orders(product_key);
CREATE INDEX idx_sales_orders_date ON sales_orders(order_date);
CREATE INDEX idx_products_category ON products(product_category);
CREATE INDEX idx_customers_state ON customers(state);
CREATE INDEX idx_customers_city ON customers(city);