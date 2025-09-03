# Payment Integration Service User Guide

## Overview
Handles payment creation, provider management, and webhook processing (Stripe, Orange Money, AfriMoney).

## Base URL
- Local: http://localhost:3004/api
- Docs: http://localhost:3004/api-docs

## Endpoints
- POST /payments
- GET /payments
- GET /payments/{id}
- GET /providers
- POST /webhooks/stripe (unauthenticated; raw body)

## Authentication
- Bearer JWT via `Authorization: Bearer <token>` for non-webhook routes.

## Notes
- Stripe webhooks require raw body; do not use JSON parser on those routes.

