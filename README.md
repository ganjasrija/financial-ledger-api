FINANCIAL LEDGER API - TRANSACTION INTEGRITY SYSTEM
This project is a RESTful API simulating a secure, double-entry financial ledger built using Node.js and PostgreSQL. The primary focus is on implementing data integrity, atomicity, and concurrency safety for all core financial transactions.

Setup and Local Development
This application is containerized using Docker Compose for simplicity and consistency.

Prerequisites
Docker and Docker Compose installed.

Steps to Run
Clone the Repository: Download or clone this project to your local machine.

Build and Start Services: Run the following command in the root directory of the project.

Bash

docker compose up --build -d
Verify Status: Check that both the app and db services are running.

Bash

docker compose ps
Access API: The API will be available at http://localhost:3000.

DESIGN DECISIONS AND INTEGRITY RATIONALE
1. System Architecture
The application uses a Three-Tier Architecture to separate concerns between the user, business logic, and data persistence.

Application Tier: The Node.js/Express server executes business logic and manages database transactions.

Data Tier: PostgreSQL stores all account and immutable ledger data, enforcing integrity constraints.

2. Double-Entry Bookkeeping Model
The core financial principle is enforced by the database structure:

How Implemented: All financial events are recorded as paired entries (DEBIT and CREDIT) in the ledger_entries table. This ensures the system remains in balance.

Immutability: The ledger is append-only; past entries cannot be modified or deleted.

3. Database Schema
The database schema is designed to enforce relational integrity and immutability.

4. Strategy for ACID Properties and Transactions
All financial operations meet the ACID properties (Atomicity, Consistency, Isolation, Durability):

Atomicity & Rollback: All financial operations are wrapped in explicit database transactions (BEGIN; ... COMMIT;). If any part of the operation fails (e.g., insufficient funds), the entire transaction is explicitly rolled back (ROLLBACK), guaranteeing data integrity.

5. Concurrency Safety and Isolation
Race Condition Prevention: To prevent concurrent requests from allowing overdrafts, a strong isolation strategy is used.

Locking: Before checking the balance or performing a debit, the system uses the database locking mechanism: SELECT ... FOR UPDATE. This locks the account record, forcing parallel requests to wait, thereby preventing race conditions.

6. Balance Calculation and Negative Balance Prevention
Balance Calculation: The account balance is never stored as a column. It is always calculated dynamically as the sum of all associated ledger_entries, guaranteeing consistency.

Negative Balance Prevention: The balance check occurs inside the secure, locked transaction. If the operation would result in a negative balance, the transaction is immediately rolled back, and the API returns a 422 Unprocessable Entity error.

API Endpoints and Testing Artifacts
The integrity and functionality of all endpoints are fully demonstrated and testable using the following file:

FinanceAPI.postman_collection.json

(This file contains the critical 422 Overdraft Rollback test, which proves the negative balance prevention and database rollback feature.)