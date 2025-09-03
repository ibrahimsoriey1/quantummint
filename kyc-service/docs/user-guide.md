# KYC Service User Guide

## Overview
Manages KYC profiles, document uploads, and verification flows.

## Base URL
- Local: http://localhost:3005/api
- Docs: http://localhost:3005/api-docs

## Endpoints
- GET /kyc/profile
- POST /kyc/profile
- POST /documents (multipart/form-data)
- GET /documents
- POST /verifications

## Authentication
- Bearer JWT via `Authorization: Bearer <token>`

