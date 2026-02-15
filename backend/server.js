const http = require('http');

const PORT = process.env.PORT || 3001;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';

    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error('Payload too large'));
        req.socket.destroy();
      }
    });

    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', () => reject(new Error('Request stream error')));
  });
}

function validateEstimateInput(body) {
  const errors = [];

  if (!body.projectDescription || typeof body.projectDescription !== 'string') {
    errors.push('projectDescription is required and must be a string.');
  }

  if (!body.budget || typeof body.budget !== 'object') {
    errors.push('budget is required and must be an object.');
  } else {
    if (typeof body.budget.amount !== 'number' || Number.isNaN(body.budget.amount)) {
      errors.push('budget.amount is required and must be a number.');
    }
    if (!body.budget.currency || typeof body.budget.currency !== 'string') {
      errors.push('budget.currency is required and must be a string (ISO code).');
    }
  }

  if (!body.deadline || typeof body.deadline !== 'string') {
    errors.push('deadline is required and must be an ISO date string.');
  } else if (Number.isNaN(Date.parse(body.deadline))) {
    errors.push('deadline must be a valid ISO date string.');
  }

  return errors;
}

function buildMockEstimate(input) {
  const { budget } = input;
  const subtotal = budget.amount * 0.9;
  const contingency = budget.amount * 0.1;

  return {
    taskBreakdown: [
      { task: 'Discovery', description: 'Clarify goals and scope.', estimatedHours: 8 },
      { task: 'Build', description: 'Implement core features.', estimatedHours: 40 }
    ],
    timeline: [
      { milestone: 'Kickoff', date: input.deadline },
      { milestone: 'Delivery', date: input.deadline }
    ],
    costEstimate: {
      subtotal,
      contingency,
      total: subtotal + contingency,
      currency: budget.currency
    },
    riskFlags: [
      { severity: 'medium', issue: 'Scope creep', mitigation: 'Add change-control checkpoints.' }
    ],
    proposalDraft: 'This is a placeholder proposal draft. Replace with model-generated content.'
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/estimate') {
    try {
      const body = await parseJsonBody(req);
      const errors = validateEstimateInput(body);

      if (errors.length > 0) {
        sendJson(res, 400, {
          error: 'ValidationError',
          message: 'Missing or invalid estimator input.',
          details: errors
        });
        return;
      }

      const result = buildMockEstimate(body);
      sendJson(res, 200, {
        input: {
          projectDescription: body.projectDescription,
          budget: body.budget,
          deadline: body.deadline
        },
        ...result
      });
    } catch (error) {
      sendJson(res, 400, {
        error: 'BadRequest',
        message: error.message || 'Unable to process request.'
      });
    }
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  sendJson(res, 404, { error: 'NotFound', message: 'Route not found.' });
});

server.listen(PORT, () => {
  console.log(`Estimator backend listening on http://localhost:${PORT}`);
});
