import database from '../database/database.js'; 

export const createTransaction = async (data, client) => {
    const { type, sourceAccountId, destinationAccountId, amount, currency, description } = data;
    const res = await client.query(
        `INSERT INTO transactions (type, source_account_id, destination_account_id, amount, currency, description, status) 
         VALUES ($1, $2, $3, $4, $5, $6, 'pending') 
         RETURNING id`,
        [type, sourceAccountId, destinationAccountId, amount, currency, description]
    );
    return res.rows[0].id;
};

export const createLedgerEntry = async (data, client) => {
    
    const { transactionId, accountId, entryType, amount } = data;
    await client.query(
        `INSERT INTO ledger_entries (transaction_id, account_id, entry_type, amount) 
         VALUES ($1, $2, $3, $4)`,
        [transactionId, accountId, entryType, amount]
    );
};

export const updateTransactionStatus = async (transactionId, status) => {
    // FINAL FIX: This function MUST ONLY use the global database pool.
    // It is called in the router AFTER the transactional client has been released.
    await database.query(
        `UPDATE transactions SET status = $1 WHERE id = $2`,
        [status, transactionId]
    );
};