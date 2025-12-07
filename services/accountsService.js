import database from '../database/database.js';

export const calculateBalance = async (accountId, client = database) => {
    const res = await client.query(
        `
        SELECT 
            COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE -amount END), 0) AS balance
        FROM ledger_entries
        WHERE account_id = $1;
        `,
        [accountId]
    );
    return res.rows[0].balance;
};

export const createAccount = async (userName, accountType, currency) => {
    const res = await database.query(
        `INSERT INTO accounts (user_name, account_type, currency) 
         VALUES ($1, $2, $3) 
         RETURNING id, user_name, account_type, currency, status, created_at`,
        [userName, accountType, currency]
    );
    return res.rows[0];
};

export const getAccountDetails = async (accountId) => {
    const res = await database.query('SELECT * FROM accounts WHERE id = $1', [accountId]);
    return res.rows[0];
};

export const getLedgerEntriesByAccount = async (accountId) => {
    const res = await database.query(
        `SELECT * FROM ledger_entries WHERE account_id = $1 ORDER BY created_at DESC`,
        [accountId]
    );
    return res.rows;
};