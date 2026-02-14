#!/usr/bin/env node
/**
 * PROOF TEST: Server-Side Durable Extraction
 * Tests:
 * 1. Large document (100K+ chars) extraction via server job queue
 * 2. Phase transitions visible in logs
 * 3. Completion with valid pack
 */

const BASE_URL = 'http://localhost:5000';

async function main() {
  console.log('=== PROOF TEST: Server-Side Durable Extraction ===\n');
  
  // 1. Generate large document (100K+ chars)
  console.log('1. Generating 100K+ char test document...');
  const paragraph = `On January 15, 2024, John Smith met with Jane Doe at the United States Supreme Court. "The ruling was unprecedented," Smith said. The case involved $50 million in damages. Senator Bob Johnson and Representative Mary Williams attended the hearing. Microsoft Corporation and Google Inc. submitted amicus briefs. The Court ruled 7-2 in favor of the plaintiff. `;
  const text = paragraph.repeat(500);
  console.log(`   Document size: ${text.length.toLocaleString()} characters\n`);
  
  // 2. Submit extraction job
  console.log('2. Submitting extraction job...');
  const submitRes = await fetch(`${BASE_URL}/api/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceText: text,
      metadata: {
        title: 'Proof Test Document',
        author: 'Test Author',
        source_type: 'Legal'
      },
      options: { mode: 'balanced' }
    })
  });
  
  if (!submitRes.ok) {
    console.error('   ERROR: Failed to submit job');
    console.error('   Status:', submitRes.status);
    process.exit(1);
  }
  
  const submitData = await submitRes.json();
  const jobId = submitData.job_id;
  console.log(`   Job ID: ${jobId}\n`);
  
  // 3. Poll for completion
  console.log('3. Polling for completion...');
  const startTime = Date.now();
  let pollCount = 0;
  const maxPolls = 60;
  
  while (pollCount < maxPolls) {
    pollCount++;
    
    const pollRes = await fetch(`${BASE_URL}/api/jobs/${jobId}`);
    if (!pollRes.ok) {
      console.error(`   ERROR: Poll failed with status ${pollRes.status}`);
      process.exit(1);
    }
    
    const job = await pollRes.json();
    console.log(`   Poll ${pollCount}: state=${job.state} progress=${job.progress}%`);
    
    if (job.state === 'complete') {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n4. Extraction completed in ${elapsed}s!`);
      console.log(`   Pack ID: ${job.pack_id}`);
      console.log(`   Entities: ${job.pack.items.entities.length}`);
      console.log(`   Quotes: ${job.pack.items.quotes.length}`);
      console.log(`   Metrics: ${job.pack.items.metrics.length}`);
      console.log(`   Timeline: ${job.pack.items.timeline.length}`);
      console.log(`\n=== PROOF TEST PASSED ===`);
      return;
    }
    
    if (job.state === 'failed') {
      console.error(`   ERROR: Job failed - ${job.error_message}`);
      process.exit(1);
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.error('   ERROR: Timeout waiting for job completion');
  process.exit(1);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
