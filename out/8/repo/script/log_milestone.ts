#!/usr/bin/env tsx
import { logMilestone } from '../server/forensic-log';

const eventType = process.argv[2] || 'MILESTONE';
const summary = process.argv[3] || 'Milestone logged';
const evidencePtrs = process.argv.slice(4);

const event = logMilestone(eventType, summary, evidencePtrs);
console.log('Event logged:', JSON.stringify(event, null, 2));
