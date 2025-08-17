# Colony Hardware Analytics Demo

This is the Colony Hardware-specific version of the Natural Language to SQL application.

## Database Information

- **Database Name**: colony_hardware_db
- **Total Products**: 68,830 hardware and tool products
- **Total Customers**: 14,804 customers across multiple states
- **Total Sales Orders**: 1,795,100 transactions from 2023

## Quick Setup

1. Ensure you're on the colony-hardware branch:
   ```bash
   git checkout colony-hardware
   ```

2. Set up the Colony Hardware environment:
   ```bash
   ./colony-hardware-setup.sh
   ```

3. Start the application:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000

## Sample Queries

Try these natural language queries:

- "Show me the top selling products in Michigan"
- "What are the sales trends for cleaning supplies?"
- "Which customers have the highest order volumes?"
- "Show me total sales by product category"
- "What are the most popular fasteners?"
- "Show monthly sales trends for 2023"
- "List the top 10 customers by revenue"
- "What products in the POWER TOOLS category sell the most?"
- "Show sales distribution across different states"
- "Which products have the highest profit margins?"

## Data Schema

### Products Table
- `product_key`: Unique identifier
- `product_description`: Product name/description
- `product_category`: Category (e.g., "FASTENERS", "POWER TOOLS & ACCESSORIES")
- `product_profile`: Additional product classification

### Customers Table
- `customer_key`: Unique identifier
- `customer_name`: Customer name
- `city`: Customer city
- `state`: State code (e.g., "MI" for Michigan)
- `cust_pricing_class`: Pricing classification
- `cust_trade_class`: Trade classification

### Sales Orders Table
- `customer_key`: Links to customer
- `product_key`: Links to product
- `order_date`: Date of order (2023 data)
- `order_number`: Unique order identifier
- `unit_price`: Price per unit
- `quantity_ordered`: Number of units
- `ext_price`: Extended price (total sale amount)
- `ext_cost`: Cost basis

## Key Features

- Natural language to SQL conversion optimized for hardware retail queries
- Pre-configured with Colony Hardware's product categories and customer base
- Visualizations tailored for sales analysis and inventory insights
- Michigan-focused customer analytics

## Switching Between Versions

To switch back to the generic demo:
```bash
git checkout main
cp backend/.env.generic backend/.env
npm run dev
```

To switch to Colony Hardware demo:
```bash
git checkout colony-hardware
./colony-hardware-setup.sh
npm run dev
```