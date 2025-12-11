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
1. System Architecture and Database Schema
The system uses a Three-Tier Architecture, with PostgreSQL acting as the crucial data integrity layer.

The schema is built around the ledger_entries table, which is the immutable source of truth.

2. How Double-Entry Bookkeeping is Implemented
Ledger Core: The system enforces double-entry through the ledger_entries table, which is designed to be append-only (immutable).

Transaction Pairing: Every financial transaction (e.g., a transfer) is required to generate exactly two corresponding entries: one DEBIT and one CREDIT, ensuring the ledger remains balanced (sum of all debits = sum of all credits).

3. Strategy for Ensuring ACID Properties
The Atomicity and Durability of financial transactions are guaranteed through the explicit use of database transactions:

Transaction Wrapping: All critical financial operations (transfers, withdrawals) are executed within a single SQL transaction block (BEGIN; ... COMMIT;).

Error Handling (Rollback): If any step within the transaction fails (e.g., a concurrency lock fails or an overdraft is detected), the entire transaction is explicitly aborted using ROLLBACK. This prevents any partial or corrupted data from being permanently written, ensuring data Consistency.

4. Rationale Behind Transaction Isolation Level (Concurrency Safety)
To prevent the most common bug in financial APIs—the race condition leading to overdrafts—a strict locking strategy is employed:

Isolation Choice: We use Pessimistic Locking via the SQL command SELECT ... FOR UPDATE.

Rationale: This command acquires an exclusive lock on the account's row immediately when the balance is being checked. Any subsequent concurrent request must wait until the first transaction either COMMITs or ROLLBACKs. This guarantees that the balance check is based on the most current data, safely handling high-volume concurrent requests.

5. Balance Calculations and Negative Balance Prevention
Balance Calculation: The account balance is never stored as a column (denormalization). Consistency is guaranteed by always calculating the balance dynamically using the aggregate function: SUM(amount) from the immutable ledger_entries table.

Negative Balance Prevention: The check for sufficient funds is performed inside the locked transaction (Section 4). If the new computed balance is negative, the application immediately throws an error, forcing a database ROLLBACK, and returns a 422 Unprocessable Entity response to the client.

API Endpoints and Testing Artifacts
The integrity and functionality of all endpoints are fully demonstrated and testable using the following file:

FinanceAPI.postman_collection.json

(This file contains the critical 422 Overdraft Rollback test, which proves the negative balance prevention and database rollback feature.)