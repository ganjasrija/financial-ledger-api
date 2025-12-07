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
        const { userName, accountType, currency } = req.body;
        const account = await accountsService.createAccount(userName, accountType, currency);
        res.status(201).json(account);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create account.' });
    }
});

router.get('/accounts/:accountId', async (req, res) => {
    try {
        const { accountId } = req.params;
        const account = await accountsService.getAccountDetails(accountId);
        if (!account) return res.status(404).json({ error: 'Account not found.' });

        const balance = await accountsService.calculateBalance(accountId);
        res.json({ ...account, balance: balance });
    } catch (error) {
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
    const { sourceAccountId, destinationAccountId, currency, description } = req.body;
    const amount = req.amount;
    let transactionId = null; 

    const client = await database.getClient();
    
    try {
        
        await client.query('BEGIN');
        
    
        await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ'); 

        const sourceAccount = await accountsService.getAccountDetails(sourceAccountId);
        const destinationAccount = await accountsService.getAccountDetails(destinationAccountId);
        
        if (!sourceAccount || !destinationAccount || sourceAccountId === destinationAccountId) {
            throw new Error('Invalid source or destination account.');
        }

        transactionId = await transactionsService.createTransaction(
            { type: 'transfer', sourceAccountId, destinationAccountId, amount: amount.toString(), currency, description },
            client
        );
        
        
        const currentBalanceString = await accountsService.calculateBalance(sourceAccountId, client);
        const currentBalance = new Decimal(currentBalanceString);

        if (currentBalance.lessThan(amount)) {
    
            throw new Error('Insufficient funds. Transaction rolled back.'); 
        }

        
        
        
        await transactionsService.createLedgerEntry(
            { transactionId, accountId: sourceAccountId, entryType: 'DEBIT', amount: amount.toString() },
            client
        );
        
        
        await transactionsService.createLedgerEntry(
            { transactionId, accountId: destinationAccountId, entryType: 'CREDIT', amount: amount.toString() },
            client
        );
        await client.query('COMMIT'); 
        await transactionsService.updateTransactionStatus(transactionId, 'completed'); 
        
        res.status(200).json({ 
            message: 'Transfer completed successfully.', 
            transactionId,
            new_source_balance: currentBalance.minus(amount).toString()
        });

    } catch (error) {
    
        await client.query('ROLLBACK'); 
        
        if (transactionId) {
            await transactionsService.updateTransactionStatus(transactionId, 'failed'); 
        }
        
        if (error.message.includes('Insufficient funds')) {
             return res.status(422).json({ error: error.message });
        }
        
        res.status(500).json({ error: 'Transaction failed due to an internal error or invalid account data.' });
        
    } finally {
        client.release();
    }
});

export default router;