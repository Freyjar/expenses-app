CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    amount NUMERIC(10,2) NOT NULL,
    merchant VARCHAR(255),
    category VARCHAR(100),
    note TEXT,
    date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'done',
    raw_text TEXT,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS debts (
    id SERIAL PRIMARY KEY,
    person VARCHAR(255) NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    original_amount NUMERIC(10,2) NOT NULL,
    note TEXT,
    status VARCHAR(20) DEFAULT 'unpaid',
    type VARCHAR(10) DEFAULT 'lent',
    date DATE NOT NULL,
    paid_at TIMESTAMP,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hints (
    id SERIAL PRIMARY KEY,
    keyword VARCHAR(100) NOT NULL,
    instruction TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
