const test = require('node:test');
const assert = require('node:assert/strict');

const { startServer } = require('./helpers/server');
const { createEstimate } = require('../services/estimator');

const validInput = {
  projectDescription: 'Build a multi-tenant dashboard with analytics and workflow automation.',
  budget: { amount: 50000, currency: 'USD' },
  deadline: '2031-09-01'
};

test('POST /export/pdf returns binary payload with expected headers', async () => {
  const app = await startServer();

  try {
    const estimateData = createEstimate(validInput);
    const response = await fetch(`http://127.0.0.1:${app.port}/export/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estimateData })
    });

    const body = Buffer.from(await response.arrayBuffer());

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.match(response.headers.get('content-disposition') || '', /attachment; filename="project-estimate-\d{4}-\d{2}-\d{2}\.pdf"/);
    assert.ok(body.length > 0);
  } finally {
    await app.stop();
  }
});

test('POST /export/docx accepts raw estimator input and returns docx headers', async () => {
  const app = await startServer();

  try {
    const response = await fetch(`http://127.0.0.1:${app.port}/export/docx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validInput)
    });

    const body = Buffer.from(await response.arrayBuffer());

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get('content-type'),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    assert.match(response.headers.get('content-disposition') || '', /attachment; filename="project-estimate-\d{4}-\d{2}-\d{2}\.docx"/);
    assert.ok(body.length > 0);
  } finally {
    await app.stop();
  }
});

test('export routes return structured 400 validation errors for malformed payloads', async () => {
  const app = await startServer();

  try {
    const response = await fetch(`http://127.0.0.1:${app.port}/export/pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ budget: { amount: 1000, currency: 'USD' } })
    });

    const data = await response.json();

    assert.equal(response.status, 400);
    assert.equal(data.error, 'ValidationError');
    assert.ok(Array.isArray(data.details));
    assert.ok(data.details.some((detail) => detail.includes('projectDescription')));
  } finally {
    await app.stop();
  }
});

test('unknown routes remain unaffected and return 404', async () => {
  const app = await startServer();

  try {
    const response = await fetch(`http://127.0.0.1:${app.port}/export/unknown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validInput)
    });

    const data = await response.json();

    assert.equal(response.status, 404);
    assert.equal(data.error, 'NotFound');
  } finally {
    await app.stop();
  }
});
