#!/bin/bash

# Colony Hardware Demo Setup Script

echo "Setting up Colony Hardware demo environment..."

# Copy the Colony-specific environment file
cp backend/.env.colony backend/.env

echo "Colony Hardware demo setup complete!"
echo ""
echo "To run the Colony Hardware demo:"
echo "1. Make sure the OPENAI_API_KEY is set in backend/.env"
echo "2. Run: npm run dev"
echo "3. Open http://localhost:3000"
echo ""
echo "Database: colony_hardware_db"
echo "Tables: products, customers, sales_orders"
echo "Total products: 68,830"
echo "Total customers: 14,804"
echo "Total sales orders: 1,795,100"