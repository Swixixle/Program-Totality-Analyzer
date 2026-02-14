#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Simple JSON Schema validator
function validateSchema(data, schema) {
  const errors = [];
  
  function validate(data, schema, path = '') {
    // Check type first
    if (schema.type) {
      const actualType = Array.isArray(data) ? 'array' : typeof data;
      const expectedType = schema.type;
      
      if (expectedType === 'object' && actualType !== 'object') {
        errors.push(`Field ${path} must be an object, got ${actualType}`);
        return;
      }
      if (expectedType === 'string' && actualType !== 'string') {
        errors.push(`Field ${path} must be a string, got ${actualType}`);
        return;
      }
      if (expectedType === 'number' && actualType !== 'number') {
        errors.push(`Field ${path} must be a number, got ${actualType}`);
        return;
      }
      if (expectedType === 'array' && actualType !== 'array') {
        errors.push(`Field ${path} must be an array, got ${actualType}`);
        return;
      }
      if (expectedType === 'boolean' && actualType !== 'boolean') {
        errors.push(`Field ${path} must be a boolean, got ${actualType}`);
        return;
      }
    }
    
    // Check required fields
    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (!(field in data)) {
          errors.push(`Missing required field: ${path}.${field}`);
        }
      }
    }
    
    // Check object properties
    if (schema.type === 'object' && schema.properties) {
      for (const [key, value] of Object.entries(data)) {
        if (schema.properties[key]) {
          validate(value, schema.properties[key], `${path}.${key}`);
        } else if (schema.additionalProperties === false) {
          errors.push(`Unexpected field: ${path}.${key}`);
        }
      }
    }
    
    // Check string patterns
    if (schema.type === 'string' && schema.pattern) {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(data)) {
        errors.push(`Field ${path} does not match pattern ${schema.pattern}: ${data}`);
      }
    }
    
    // Check const values
    if (schema.const !== undefined && data !== schema.const) {
      errors.push(`Field ${path} must be ${schema.const}, got ${data}`);
    }
    
    // Check enum values
    if (schema.enum && !schema.enum.includes(data)) {
      errors.push(`Field ${path} must be one of ${schema.enum.join(', ')}, got ${data}`);
    }
    
    // Check arrays
    if (schema.type === 'array') {
      if (schema.minItems && data.length < schema.minItems) {
        errors.push(`Array ${path} must have at least ${schema.minItems} items`);
      }
      if (schema.items) {
        data.forEach((item, i) => validate(item, schema.items, `${path}[${i}]`));
      }
    }
    
    // Check number constraints
    if (schema.type === 'number') {
      if (schema.minimum !== undefined && data < schema.minimum) {
        errors.push(`Field ${path} must be >= ${schema.minimum}, got ${data}`);
      }
      if (schema.maximum !== undefined && data > schema.maximum) {
        errors.push(`Field ${path} must be <= ${schema.maximum}, got ${data}`);
      }
    }
  }
  
  validate(data, schema);
  return errors;
}

console.log('========================================');
console.log('ELI Schema Validator');
console.log('========================================\n');

// Load schema
const schemaPath = path.join(__dirname, 'contracts', 'eli-output.schema.json');
const samplePath = path.join(__dirname, 'examples', 'eli-output.sample.json');

console.log('Loading schema:', schemaPath);
console.log('Loading sample:', samplePath);
console.log();

try {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const sample = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
  
  console.log('Schema version:', schema.title);
  console.log('Sample schema version:', sample.schema_version);
  console.log();
  
  const errors = validateSchema(sample, schema);
  
  if (errors.length === 0) {
    console.log('✓ Validation PASSED');
    console.log('\nThe sample ELI output conforms to the schema.');
    console.log('\nSample content preview:');
    console.log('  - Decision verdict:', sample.decision.verdict);
    console.log('  - Confidence:', sample.decision.confidence);
    console.log('  - Evidence items:', sample.evidence.length);
    console.log('  - Safety flags:', sample.safety.high_risk_flag ? 'HIGH RISK' : 'normal');
  } else {
    console.log('✗ Validation FAILED');
    console.log('\nErrors found:');
    errors.forEach(err => console.log('  -', err));
    process.exit(1);
  }
  
  console.log('\n========================================');
  console.log('ELI Framework Information');
  console.log('========================================');
  console.log('ELI separates cryptographic proof from inference.');
  console.log('It produces justified, auditable claims from signed artifacts.');
  console.log('\nFor more information, see README.md');
  console.log('========================================\n');
  
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
