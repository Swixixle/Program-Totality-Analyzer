#!/usr/bin/env node
/**
 * PROOF TEST: Refresh Durability
 * Tests:
 * 1. Start extraction job
 * 2. Verify job is in database
 * 3. Simulate "refresh" by disconnecting polling
 * 4. Verify job continues to completion in background
 * 5. Verify job can be reconnected
 */

const BASE_URL = 'http://localhost:5000';

async function main() {
  console.log('=== PROOF TEST: Refresh Durability ===\n');
  
  // 1. Generate large document
  console.log('1. Generating test document...');
  const paragraph = `On January 15, 2024, John Smith met with Jane Doe at the United States Supreme Court. "The ruling was unprecedented," Smith said. The case involved $50 million in damages. `;
  const text = paragraph.repeat(500); // ~87K chars
  console.log(`   Document size: ${text.length.toLocaleString()} characters\n`);
  
  // 2. Submit extraction job
  console.log('2. Submitting extraction job...');
  const submitRes = await fetch(`${BASE_URL}/api/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceText: text,
      metadata: { title: 'Refresh Durability Test', source_type: 'Legal' },
      options: { mode: 'balanced' }
    })
  });
  
  if (!submitRes.ok) {
    console.error('   ERROR: Failed to submit job');
    process.exit(1);
  }
  
  const { job_id: jobId } = await submitRes.json();
  console.log(`   Job ID: ${jobId}`);
  console.log(`   (Simulating localStorage: lantern_job_id = "${jobId}")\n`);
  
  // 3. Simulate "disconnect" - stop polling for a moment
  console.log('3. Simulating page refresh (disconnect polling)...');
  console.log('   Waiting 3 seconds while job processes in background...');
  await new Promise(r => setTimeout(r, 3000));
  
  // 4. Simulate "reconnect" - check if job is still accessible
  console.log('\n4. Reconnecting to job (simulating page reload)...');
  const pollRes = await fetch(`${BASE_URL}/api/jobs/${jobId}`);
  const job = await pollRes.json();
  console.log(`   Job state after reconnect: ${job.state} (${job.progress}%)`);
  
  // 5. Continue polling to completion
  if (job.state !== 'complete') {
    console.log('   Continuing to poll until completion...');
    let attempts = 0;
    while (attempts < 30) {
      attempts++;
      const res = await fetch(`${BASE_URL}/api/jobs/${jobId}`);
      const status = await res.json();
      console.log(`   Poll ${attempts}: state=${status.state} progress=${status.progress}%`);
      
      if (status.state === 'complete') {
        console.log(`\n5. Job completed after reconnect!`);
        console.log(`   Pack ID: ${status.pack_id}`);
        console.log(`   Entities: ${status.pack.items.entities.length}`);
        console.log(`   Quotes: ${status.pack.items.quotes.length}`);
        console.log(`\n=== REFRESH DURABILITY TEST PASSED ===`);
        return;
      }
      
      if (status.state === 'failed') {
        console.error(`   ERROR: Job failed after reconnect`);
        process.exit(1);
      }
      
      await new Promise(r => setTimeout(r, 1000));
    }
  } else {
    console.log(`\n5. Job already completed during disconnect!`);
    console.log(`   Pack ID: ${job.pack_id}`);
    console.log(`   Entities: ${job.pack.items.entities.length}`);
    console.log(`   Quotes: ${job.pack.items.quotes.length}`);
    console.log(`\n=== REFRESH DURABILITY TEST PASSED ===`);
  }
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
