-- schema.sql (FINAL CORRECTED VERSION)

-- 1. Create the Accounts table
-- This table holds the current balance for all tracked accounts.
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

---

-- 2. Create the Transactions table
-- This table records the high-level details of every transfer, deposit, or withdrawal.
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    
    -- NOTE: Removed FOREIGN KEY constraint here to allow '0' for external accounts (deposits/withdrawals)
    source_account_id INTEGER NOT NULL,
    
    -- NOTE: Removed FOREIGN KEY constraint here to allow '0' for external accounts (deposits/withdrawals)
    destination_account_id INTEGER NOT NULL,
    
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- Used by your logic to track status (pending, completed, failed)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

---

-- 3. Create the Ledger Entries table
-- This table tracks the double-entry records (DEBIT/CREDIT) for auditing and integrity.
CREATE TABLE IF NOT EXISTS ledger_entries (
    id SERIAL PRIMARY KEY,
    
    -- We can link these back to the main transaction and account for audit purposes
    transaction_id INTEGER REFERENCES transactions(id),
    account_id INTEGER REFERENCES accounts(id),
    
    entry_type VARCHAR(10) NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT')),
    amount NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);