# HALO-RECEIPTS

AI Receipts - Forensic Verification System for AI Conversation Transcripts

[![Run on Replit](https://replit.com/badge/github/Swixixle/HALO-RECEIPTS)](https://replit.com/github/Swixixle/HALO-RECEIPTS)

## Overview

AI Receipts is a forensic verification system for AI conversation transcripts. It provides cryptographic verification of receipt capsules, immutable storage, and forensic analysis capabilities.

For detailed documentation, see [replit.md](./replit.md)

## Quick Start

### Run on Replit (Recommended for Quick Setup)

1. Click the "Run on Replit" badge above
2. Follow the setup guide in [docs/REPLIT_SETUP.md](./docs/REPLIT_SETUP.md)

### Local Development

1. **Prerequisites**
   - Node.js 20+
   - PostgreSQL database
   - npm or yarn

2. **Installation**
   ```bash
   npm install
   ```

3. **Configuration**
   - Copy `.env.example` to `.env`
   - Update `DATABASE_URL` with your PostgreSQL connection string
   - Set other environment variables as needed

4. **Database Setup**
   ```bash
   npm run db:push
   ```

5. **Run Development Server**
   ```bash
   npm run dev
   ```

The application will start on port 5000 (http://localhost:5000)

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - Type check with TypeScript
- `npm run db:push` - Push database schema changes

## Technology Stack

- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Express.js + Node.js 20
- **Database**: PostgreSQL with Drizzle ORM
- **Validation**: Zod schemas
- **Cryptography**: Node.js crypto (SHA-256)

## Documentation

- [Full Documentation](./replit.md) - Complete API and feature documentation
- [Replit Setup Guide](./docs/REPLIT_SETUP.md) - Step-by-step Replit deployment
- [Receipt Capsule v2 Proposal](./docs/RECEIPT_CAPSULE_V2.md) - Future schema evolution

## Core Features

- **Receipt Verification**: Validates AI conversation receipts using SHA-256 hash verification
- **Canonicalization (c14n-v1)**: Deterministic JSON canonicalization for consistent hashing
- **Immutable Storage**: Verified receipts are locked and cannot be modified
- **Kill Switch**: Irreversible control to permanently disable interpretation for a receipt
- **Interpretation System**: Categorized as FACT, INTERPRETATION, or UNCERTAINTY (append-only)
- **Tri-Sensor Analysis**: Parallel analysis with interpreter, summarizer, and claim extractor

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

---

### User Information
- **Current User's Login:** Swixixle
