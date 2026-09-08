PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner','employee','affiliate','member')),
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    email TEXT COLLATE NOCASE UNIQUE,
    country TEXT NOT NULL DEFAULT 'TR',
    phone TEXT NOT NULL DEFAULT '',
    birth_date TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked')),
    permissions TEXT NOT NULL DEFAULT '[]',
    promo_code TEXT COLLATE NOCASE UNIQUE,
    affiliate_id TEXT REFERENCES users(id),
    referral_code TEXT NOT NULL DEFAULT '',
    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0 AND reserved <= balance),
    daily_limit INTEGER,
    session_minutes INTEGER NOT NULL DEFAULT 120,
    excluded_until TEXT,
    session_version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    last_login TEXT
);
CREATE INDEX IF NOT EXISTS users_affiliate ON users(affiliate_id, created_at);

CREATE TABLE IF NOT EXISTS content (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    data TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS content_category ON content(type, sort_order);

CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    direction TEXT NOT NULL CHECK (direction IN ('deposit','withdraw','adjustment')),
    amount INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','completed','cancelled')),
    method TEXT NOT NULL DEFAULT '',
    destination TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    request_key TEXT NOT NULL,
    created_at TEXT NOT NULL,
    resolved_at TEXT,
    resolved_by TEXT REFERENCES users(id),
    UNIQUE (user_id, request_key)
);
CREATE INDEX IF NOT EXISTS transactions_user ON transactions(user_id, created_at);

CREATE TABLE IF NOT EXISTS bets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    stake INTEGER NOT NULL CHECK (stake > 0),
    odds REAL NOT NULL,
    selections TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','won','lost','cancelled')),
    payout INTEGER NOT NULL DEFAULT 0,
    request_key TEXT NOT NULL,
    created_at TEXT NOT NULL,
    resolved_at TEXT,
    UNIQUE(user_id, request_key)
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    sender TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unread',
    incoming INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    kind TEXT NOT NULL CHECK(kind IN ('image','identity')),
    path TEXT NOT NULL,
    mime TEXT NOT NULL,
    original_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit (
    id TEXT PRIMARY KEY,
    actor_id TEXT,
    action TEXT NOT NULL,
    target_id TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limits (
    id TEXT PRIMARY KEY,
    attempts INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    expires_at INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0
);