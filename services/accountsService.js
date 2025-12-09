import database from '../database/database.js';

// Creates a new account, inserting the initial balance directly into the 'balance' column.
export const createAccount = async (name, initialBalance) => {
    const res = await database.query(
        `INSERT INTO accounts (name, balance) 
         VALUES ($1, $2) 
         RETURNING id, name, balance`,
        [name, initialBalance]
    );
    return res.rows[0];
};

// **FIXED FUNCTION:** Retrieves account details, explicitly selecting columns
// to prevent issues with data type handling (like the Decimal library conflict).
export const getAccountDetails = async (accountId) => {
    // FIX: Explicitly select id, name, and balance. This is the fix for the 500 error.
    const res = await database.query(
        'SELECT id, name, balance FROM accounts WHERE id = $1', 
        [accountId]
    );
    return res.rows[0];
};

// Retrieves all ledger entries for an account.
export const getLedgerEntriesByAccount = async (accountId) => {
    const res = await database.query(
        `SELECT * FROM ledger_entries WHERE account_id = $1 ORDER BY created_at DESC`,
        [accountId]
    );
    return res.rows;
};

// Note: The old calculateBalance function has been removed from the service file.