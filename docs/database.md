# SecureEdgeAI Database Specification

Local offline storage architecture.

## 1. Table: `users`
Holds local user profiles and biometric face descriptors.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| **id** | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique row identifier |
| **name** | TEXT | NOT NULL | User's full name |
| **employee_id** | TEXT | UNIQUE, NOT NULL | Company employee registration code (e.g. SE-2026) |
| **embedding** | TEXT | NOT NULL | Stringified JSON array containing the 192-dimensional floating-point biometric features |
| **created_at** | DATETIME | DEFAULT CURRENT_TIMESTAMP | Date and time of local enrollment |

## 2. Security and Constraints
- **Uniqueness**: `employee_id` is unique to prevent duplicate profiles for a single employee on a device.
- **Biometric Serialization**: Biometric float arrays are represented as JSON arrays `[0.023, -0.198, ..., 0.054]` for safe column reads/writes.
- **Transaction Safety**: Wrap DB executions in try-catch handlers to fallback to an in-memory repository if SQLite becomes unavailable.
