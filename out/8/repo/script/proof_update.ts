#!/usr/bin/env tsx
import { execSync } from 'child_process';
import { logMilestone } from '../server/forensic-log';

async function main() {
  console.log('=== Proof Pack Update ===\n');
  
  let allPassed = true;
  
  console.log('Step 1: Running forensic:verify...');
  try {
    const verifyResult = execSync('npx tsx script/verify_forensic_state.ts', { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(verifyResult);
    if (!verifyResult.includes('Result: PASS')) {
      console.log('WARNING: Verification did not explicitly pass');
    }
  } catch (error: any) {
    console.log('FAILED: forensic:verify');
    console.log(error.stdout || error.message);
    allPassed = false;
  }
  
  console.log('\nStep 2: Running state:snapshot...');
  try {
    const snapshotResult = execSync('npx tsx script/snapshot_state.ts', { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(snapshotResult);
  } catch (error: any) {
    console.log('FAILED: state:snapshot');
    console.log(error.stdout || error.message);
    allPassed = false;
  }
  
  console.log('\nStep 3: Running share:build...');
  try {
    const buildResult = execSync('npx tsx script/build_share_pack.ts', { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    console.log(buildResult);
    if (!buildResult.includes('Build: SUCCESS')) {
      console.log('WARNING: Build did not explicitly succeed');
      allPassed = false;
    }
  } catch (error: any) {
    console.log('FAILED: share:build');
    console.log(error.stdout || error.message);
    allPassed = false;
  }
  
  console.log('\n=== Proof Pack Update Complete ===\n');
  
  if (allPassed) {
    const event = logMilestone(
      'PROOF_PACK_UPDATED',
      'Proof pack updated: verify passed, snapshot generated, share pack built',
      ['forensic_state/SNAPSHOT.txt', 'share_pack/']
    );
    console.log('All steps passed');
    console.log('Event logged:', event.event_type);
    console.log('New hash:', event.line_hash);
    process.exit(0);
  } else {
    console.log('Some steps failed - proof pack NOT updated');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Proof update failed:', err);
  process.exit(1);
});
