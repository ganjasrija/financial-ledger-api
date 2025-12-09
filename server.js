import express from 'express';
import 'dotenv/config';
import transactionRoutes from './routes/transactions.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());


app.use('/', transactionRoutes); 

app.listen(port, () => {
    console.log(`Financial Ledger API listening at http://localhost:${port}`);
});