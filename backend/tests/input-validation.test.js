const test = require('node:test');
const assert = require('node:assert/strict');

const { startServer } = require('./helpers/server');
const { normalizeInput } = require('../services/estimator');

test('returns 400 when required fields are missing', async () => {
  const app = await startServer();

  try {
    const response = await fetch(`http://127.0.0.1:${app.port}/estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const data = await response.json();

    assert.equal(response.status, 400);
    assert.equal(data.error, 'ValidationError');
    assert.equal(data.details.length, 3);
    assert.ok(data.details.some((item) => item.includes('projectDescription')));
    assert.ok(data.details.some((item) => item.includes('budget is required')));
    assert.ok(data.details.some((item) => item.includes('deadline is required')));
  } finally {
    await app.stop();
  }
});

test('invalid budget format is normalized to safe default amount', () => {
  const normalized = normalizeInput({
    projectDescription: 'Build a landing page',
    budget: { amount: 'not-a-number', currency: 'usd' },
    deadline: '2030-01-01'
  });

  assert.equal(normalized.budget.amount, 0);
  assert.equal(normalized.budget.currency, 'USD');
});

test('invalid deadline is normalized to fallback ISO date', () => {
  const normalized = normalizeInput({
    projectDescription: 'Build a landing page',
    budget: { amount: 2000, currency: 'USD' },
    deadline: 'not-a-date'
  });

  assert.match(normalized.deadline, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(normalized.metadata.availableDurationDays, 30);
});
