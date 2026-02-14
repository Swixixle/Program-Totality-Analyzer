# Replit Setup Guide

This guide will help you set up and run the HALO-RECEIPTS application on Replit.

## Quick Start

1. **Fork/Import this repository to Replit**
   - Go to [Replit](https://replit.com)
   - Click "Create Repl" → "Import from GitHub"
   - Paste the repository URL

2. **Set up PostgreSQL Database**
   - Click the "Tools" sidebar in Replit
   - Add "PostgreSQL" database
   - The `DATABASE_URL` will be automatically added to your Secrets

3. **Configure Environment Variables**
   - Go to the "Secrets" tab (lock icon in sidebar)
   - Add the following secrets:
     - `DATABASE_URL` - (auto-populated by PostgreSQL tool)
     - `API_KEY` - Your API key (or use `dev-test-key-12345` for development)
     - `SESSION_SECRET` - A random string for session security
     - `NODE_ENV` - Set to `development` or `production`
   
   Optional variables:
   - `TRANSCRIPT_MODE` - Display mode: `full`, `redacted`, or `hidden` (default: `full`)
   - `PORT` - Port number (default: `5000`)

4. **Initialize the Database**
   ```bash
   npm install
   npm run db:push
   ```

5. **Run the Application**
   - Click the "Run" button at the top
   - Or run manually: `npm run dev`

The application will start on port 5000 and should be accessible via the Replit webview.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - Type check with TypeScript
- `npm run db:push` - Push database schema changes

## Development Notes

### Database Migrations
When you make changes to the database schema:
```bash
npm run db:push
```

### API Authentication
In development mode (`NODE_ENV=development`), the API accepts `dev-test-key-12345` as a valid API key. For production, set a secure `API_KEY` in your environment variables.

### GitHub Integration
If you're using GitHub connectors (optional), Replit will automatically provide:
- `REPLIT_CONNECTORS_HOSTNAME`
- `REPL_IDENTITY`
- `WEB_REPL_RENEWAL`

## Troubleshooting

### Database Connection Issues
1. Ensure PostgreSQL is added from the Tools sidebar
2. Check that `DATABASE_URL` is in your Secrets
3. Try running `npm run db:push` to initialize the schema

### Port Conflicts
The app runs on port 5000 by default. If you need to change it, set the `PORT` environment variable in Secrets.

### Build Errors
If you encounter build errors:
```bash
rm -rf node_modules package-lock.json
npm install
```

## Production Deployment

For production deployment on Replit:
1. Set `NODE_ENV=production` in Secrets
2. Set a secure `API_KEY`
3. Set a secure `SESSION_SECRET`
4. Run `npm run build` to create the production build
5. Use the deployment configuration in `.replit`

## Support

For more information about the application features, see [replit.md](./replit.md) or the main [README.md](./README.md).
