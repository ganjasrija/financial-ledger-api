import database from '../database/database.js';

export const createAccount = async (name, initialBalance) => {
    const res = await database.query(
        `INSERT INTO accounts (name, balance) 
         VALUES ($1, $2) 
         RETURNING id, name, balance`,
        [name, initialBalance]
    );
    return res.rows[0];
};

export const getAccountDetails = async (accountId) => {
    
    const res = await database.query(
        'SELECT id, name, balance FROM accounts WHERE id = $1', 
        [accountId]
    );
    return res.rows[0];
};


export const getLedgerEntriesByAccount = async (accountId) => {
    const res = await database.query(
        `SELECT * FROM ledger_entries WHERE account_id = $1 ORDER BY created_at DESC`,
        [accountId]
    );
    return res.rows;
};

