import { Router } from 'express';
import { Decimal } from 'decimal.js';
import * as accountsService from '../services/accountsService.js';
import * as transactionsService from '../services/transactionsService.js';
import database from '../database/database.js';

const router = Router();


const parseAmount = (req, res, next) => {
    try {
        const amount = new Decimal(req.body.amount);
        if (amount.lessThanOrEqualTo(0) || amount.decimalPlaces() > 2) {
            return res.status(400).json({ error: "Invalid amount. Must be positive with max 2 decimal places." });
        }
        req.amount = amount; 
        next();
    } catch (e) {
        return res.status(400).json({ error: "Amount is required and must be a valid number." });
    }
};



router.post('/accounts', async (req, res) => {
    try {
        const { name, initial_balance } = req.body; 
        const account = await accountsService.createAccount(name, initial_balance);
        res.status(201).json(account);
    } catch (error) {
        console.error('Account creation error:', error);
        res.status(500).json({ error: 'Failed to create account.' });
    }
});

router.get('/accounts', async (req, res) => {
    try {
        const resDb = await database.query(
            'SELECT id, name, balance::TEXT AS balance FROM accounts ORDER BY id DESC'
        );
        res.status(200).json(resDb.rows);
    } catch (error) {
        console.error('List Accounts Error:', error);
        res.status(500).json({ error: 'Failed to list accounts.' });
    }
});

router.get('/accounts/:accountId', async (req, res) => {
    try {
        const { accountId } = req.params;
        const resDb = await database.query(
            'SELECT id, name, balance::TEXT AS balance FROM accounts WHERE id = $1', 
            [accountId]
        );
        const account = resDb.rows[0];
        
        if (!account) return res.status(404).json({ error: 'Account not found.' });

        res.status(200).json(account); 
    } catch (error) {
        console.error('CRITICAL GET Account Error:', error); 
        res.status(500).json({ error: 'Failed to retrieve account.' });
    }
});

router.get('/accounts/:accountId/ledger', async (req, res) => {
    try {
        const { accountId } = req.params;
        const entries = await accountsService.getLedgerEntriesByAccount(accountId);
        res.json(entries);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve ledger entries.' });
    }
});

router.post('/transfers', parseAmount, async (req, res) => {
    const { source_account_id, destination_account_id, currency, description } = req.body; 
    const amount = req.amount;
    let transactionId = null; 
    let finalStatus = 'failed';
    let responseBody = null;

    const client = await database.getClient(); 
    
    try {
        await client.query('BEGIN');
        await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ'); 
        
        
        const sourceAccountRes = await client.query( 
            'SELECT id, balance FROM accounts WHERE id = $1 FOR UPDATE',
            [source_account_id]
        );
        const destinationAccountRes = await client.query(
            'SELECT id FROM accounts WHERE id = $1 FOR UPDATE', 
            [destination_account_id]
        );
        
        if (sourceAccountRes.rows.length === 0 || destinationAccountRes.rows.length === 0 || source_account_id === destination_account_id) {
            throw new Error('Invalid source or destination account.');
        }

        const currentBalance = new Decimal(sourceAccountRes.rows[0].balance);

        
        if (currentBalance.lessThan(amount)) {
            throw new Error('Insufficient funds. Transaction rolled back.'); 
        }

        
        transactionId = await transactionsService.createTransaction(
            { type: 'transfer', sourceAccountId: source_account_id, destinationAccountId: destination_account_id, amount: amount.toString(), currency, description },
            client
        );
        

        await client.query(
            'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
            [amount.toString(), source_account_id]
        );
        

        await client.query(
            'UPDATE accounts SET balance = balance + $1 WHERE id = $2', 
            [amount.toString(), destination_account_id]
        );
        

        await transactionsService.createLedgerEntry(
            { transactionId, accountId: source_account_id, entryType: 'DEBIT', amount: amount.toString() },
            client
        );
        
        await transactionsService.createLedgerEntry(
            { transactionId, accountId: destination_account_id, entryType: 'CREDIT', amount: amount.toString() },
            client
        );
        
    
        await client.query('COMMIT'); 
        finalStatus = 'completed'; 
        
        responseBody = {
            message: 'Transfer completed successfully.', 
            transactionId,
            new_source_balance: currentBalance.minus(amount).toString()
        };
        
        res.status(201).json(responseBody);

    } catch (error) {
        
        await client.query('ROLLBACK'); 
        
        
        if (error.message.includes('Insufficient funds')) {
             responseBody = { error: error.message };
             return res.status(422).json(responseBody); 
        }


        if (error.message.includes('Invalid')) {
             responseBody = { error: error.message };
             return res.status(400).json(responseBody);
        }
        
    
        console.error('Final Transaction Error (500):', error); 
        responseBody = { error: 'Transaction failed due to an internal error or invalid account data.' };
        return res.status(500).json(responseBody);
        
    } finally {
        if (client) { 
            client.release();
        }

        if (transactionId) {
            try {
                await transactionsService.updateTransactionStatus(transactionId, finalStatus); 
            } catch (statusError) {
                console.error('Async Status Update Failed:', statusError);
            }
        }
    }
});


router.post('/deposits', parseAmount, async (req, res) => {
    const { account_id, currency, description } = req.body;
    const amount = req.amount;
    let transactionId = null;
    let initialBalance = null; 
    let finalStatus = 'failed';
    let responseBody = null; 

    const client = await database.getClient();
    
    try {
        await client.query('BEGIN');

        const accountRes = await client.query(
            'SELECT id, balance FROM accounts WHERE id = $1 FOR UPDATE',
            [account_id] 
        );
        
        if (accountRes.rows.length === 0) {
            throw new Error('Invalid destination account.');
        }

        initialBalance = new Decimal(accountRes.rows[0].balance);

        transactionId = await transactionsService.createTransaction(
            { type: 'deposit', sourceAccountId: 0, destinationAccountId: account_id, amount: amount.toString(), currency, description },
            client
        );
        
    
        await client.query(
            'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
            [amount.toString(), account_id]
        );
    
        await transactionsService.createLedgerEntry(
            { transactionId, accountId: account_id, entryType: 'CREDIT', amount: amount.toString() },
            client
        );
        
        await client.query('COMMIT'); 
        finalStatus = 'completed';
        
        responseBody = { 
            message: 'Deposit completed successfully.', 
            transactionId,
            new_balance: initialBalance.plus(amount).toString()
        };

        res.status(201).json(responseBody);

    } catch (error) {
        await client.query('ROLLBACK'); 
        
        if (error.message.includes('Invalid')) {
             responseBody = { error: error.message };
             return res.status(400).json(responseBody); 
        }
        
        console.error('Deposit Transaction Error (500):', error); 
        responseBody = { error: 'Deposit failed due to an internal error.' };
        return res.status(500).json(responseBody);
        
    } finally {
        if (client) { 
            client.release();
        }
        
        if (transactionId) {
            try {
                await transactionsService.updateTransactionStatus(transactionId, finalStatus);
            } catch (statusError) {
                console.error('Async Status Update Failed:', statusError);
            }
        }
    }
});


router.post('/withdrawals', parseAmount, async (req, res) => {
    const { account_id, currency, description } = req.body;
    const amount = req.amount;
    let transactionId = null;
    let currentBalance = null; 
    let finalStatus = 'failed';
    let responseBody = null; 

    const client = await database.getClient();
    
    try {
        await client.query('BEGIN');
        await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ'); 


        const accountRes = await client.query(
            'SELECT id, balance FROM accounts WHERE id = $1 FOR UPDATE',
            [account_id]
        );
        
        if (accountRes.rows.length === 0) {
            throw new Error('Invalid source account.');
        }

        currentBalance = new Decimal(accountRes.rows[0].balance);


        if (currentBalance.lessThan(amount)) {
            throw new Error('Insufficient funds. Transaction rolled back.'); 
        }

        
        transactionId = await transactionsService.createTransaction(
            { type: 'withdrawal', sourceAccountId: account_id, destinationAccountId: 0, amount: amount.toString(), currency, description },
            client
        );
        

        await client.query(
            'UPDATE accounts SET balance = balance - $1 WHERE id = $2',
            [amount.toString(), account_id]
        );
        
    
        await transactionsService.createLedgerEntry(
            { transactionId, accountId: account_id, entryType: 'DEBIT', amount: amount.toString() },
            client
        );
        
        await client.query('COMMIT'); 
        finalStatus = 'completed';
        
        responseBody = {
            message: 'Withdrawal completed successfully.', 
            transactionId,
            new_source_balance: currentBalance.minus(amount).toString()
        };

        res.status(201).json(responseBody);
        
    } catch (error) {
        await client.query('ROLLBACK'); 
        
        
        if (error.message.includes('Insufficient funds')) {
             responseBody = { error: error.message };
             return res.status(422).json(responseBody); 
        }
        

        if (error.message.includes('Invalid')) {
             responseBody = { error: error.message };
             return res.status(400).json(responseBody);
        }
        
        console.error('Withdrawal Transaction Error (500):', error); 
        responseBody = { error: 'Withdrawal failed due to an internal error.' };
        return res.status(500).json(responseBody);
        
    } finally {
        if (client) { 
            client.release();
        }

        if (transactionId) {
            try {
                await transactionsService.updateTransactionStatus(transactionId, finalStatus);
            } catch (statusError) {
                console.error('Async Status Update Failed:', statusError);
            }
        }
    }
});

export default router;