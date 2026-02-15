const test = require('node:test');
const assert = require('node:assert/strict');

const { startServer } = require('./helpers/server');

const validPayload = {
  projectDescription: 'Build a customer portal with role-based access, reporting dashboard, and Stripe integration.',
  budget: { amount: 25000, currency: 'USD' },
  deadline: '2030-08-01'
};

test('POST /estimate returns all required response fields', async () => {
  const app = await startServer();

  try {
    const response = await fetch(`http://127.0.0.1:${app.port}/estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload)
    });

    const data = await response.json();

    assert.equal(response.status, 200);

    const requiredFields = [
      'input',
      'normalizedInput',
      'taskBreakdown',
      'timeline',
      'costEstimate',
      'riskFlags',
      'estimationSignals',
      'proposalDraft',
      'proposalMarkdown',
      'proposalPlainText'
    ];

    for (const field of requiredFields) {
      assert.ok(Object.prototype.hasOwnProperty.call(data, field), `missing field: ${field}`);
    }

    assert.ok(Array.isArray(data.taskBreakdown));
    assert.ok(Array.isArray(data.timeline));
    assert.ok(Array.isArray(data.riskFlags));
    assert.equal(typeof data.proposalMarkdown, 'string');
  } finally {
    await app.stop();
  }
});

test('malformed model output still returns a safe structured response', async () => {
  const app = await startServer({ SIMULATE_MALFORMED_MODEL_OUTPUT: '1' });

  try {
    const response = await fetch(`http://127.0.0.1:${app.port}/estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload)
    });

    const data = await response.json();

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(data.taskBreakdown));
    assert.ok(data.taskBreakdown.length > 0);
    assert.ok(data.taskBreakdown.every((item) => typeof item.task === 'string'));
  } finally {
    await app.stop();
  }
});
