-- Emergency fix: Ensure purchase_product_listing logs to currency_transactions
-- Run this if market transactions are NOT showing up in Central Bank

-- This updates the purchase_product_listing function to log all transactions
-- Copy the entire contents of this file into Supabase SQL Editor and run it

\i supabase/migrations/20270125_log_market_transactions.sql
