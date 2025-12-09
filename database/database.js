import pkg from 'pg';
import 'dotenv/config'; 

const { Pool } = pkg;

const pool = new Pool({
    user: process.env.DB_USER,
    // CORRECTED: Ensure 'host' uses DB_HOST variable
    host: process.env.DB_HOST, 
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT, 10), 
    
    max: 20, 
    connectionTimeoutMillis: 5000, 
});

pool.on('error', (err) => {
  console.error('CRITICAL: Unexpected error on idle client', err);
});

export default {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(), 
};