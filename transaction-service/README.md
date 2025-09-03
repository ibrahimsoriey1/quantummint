# Transaction Service User Guide

## Overview
Provides APIs to create and list transactions, and to query wallet balances.

## Base URL
- Local: http://localhost:3003/api
- Docs: http://localhost:3003/api-docs

## Endpoints
- GET /transactions
- POST /transactions
- GET /transactions/{id}
- GET /balances/{walletId}

## Authentication
- Bearer JWT via `Authorization: Bearer <token>`

## Errors
- Standard JSON error with `success`, `status`, and `message` fields.





