-- Subscription Management System - Neon PostgreSQL Schema
-- Migration: 0001_init.sql

CREATE TABLE IF NOT EXISTS admin_users (
  admin_id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  subscription_id SERIAL PRIMARY KEY,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  plan_name TEXT NOT NULL DEFAULT 'Monthly',
  amount_paid NUMERIC(10, 2),
  payment_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  notes TEXT,
  reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_email ON subscriptions(customer_email);
CREATE INDEX IF NOT EXISTS idx_sub_expiry_status ON subscriptions(expiry_date, status);
CREATE INDEX IF NOT EXISTS idx_sub_status ON subscriptions(status);
