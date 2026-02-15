const http = require('http');
const path = require('path');
const { createEstimate } = require('./services/estimator');
const { createPdfBuffer, createDocxBuffer } = require('./services/exporter');
const { loadEnvFile } = require('./loadEnv');

loadEnvFile(path.join(__dirname, '..', '.env'));

const PORT = process.env.PORT || 3001;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
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

function sendBinary(res, statusCode, buffer, contentType, filename) {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': buffer.length,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(buffer);
}

function validateEstimateInput(body) {
  const errors = [];

  if (!body.projectDescription || typeof body.projectDescription !== 'string') {
    errors.push('projectDescription is required and must be a string.');
  }

  if (!body.budget || typeof body.budget !== 'object') {
    errors.push('budget is required and must be an object.');
  } else {
    const hasAmount = Object.prototype.hasOwnProperty.call(body.budget, 'amount');
    const amountType = typeof body.budget.amount;
    if (!hasAmount || (amountType !== 'number' && amountType !== 'string')) {
      errors.push('budget.amount is required and must be a number or numeric string.');
    }
    if (!body.budget.currency || typeof body.budget.currency !== 'string') {
      errors.push('budget.currency is required and must be a string (ISO code).');
    }
  }

  if (!body.deadline || typeof body.deadline !== 'string') {
    errors.push('deadline is required and must be a date string.');
  }

  return errors;
}

function validateEstimateSections(estimateData) {
  const errors = [];

  if (!Array.isArray(estimateData.taskBreakdown) || estimateData.taskBreakdown.length === 0) {
    errors.push('taskBreakdown is required and must be a non-empty array.');
  }

  if (!Array.isArray(estimateData.timeline) || estimateData.timeline.length === 0) {
    errors.push('timeline is required and must be a non-empty array.');
  }

  if (!estimateData.costEstimate || typeof estimateData.costEstimate !== 'object') {
    errors.push('costEstimate is required and must be an object.');
  }

  if (!Array.isArray(estimateData.riskFlags)) {
    errors.push('riskFlags is required and must be an array.');
  }

  if (typeof estimateData.proposalMarkdown !== 'string' && typeof estimateData.proposalPlainText !== 'string' && typeof estimateData.proposalDraft !== 'string') {
    errors.push('One of proposalMarkdown, proposalPlainText, or proposalDraft is required and must be a string.');
  }

  return errors;
}

function resolveExportEstimate(body) {
  const candidate = body && typeof body === 'object' && (body.estimateData || body.estimate || body);
  if (!candidate || typeof candidate !== 'object') {
    return {
      errors: ['Export payload must include an object body or estimateData field.']
    };
  }

  const sectionErrors = validateEstimateSections(candidate);
  if (sectionErrors.length === 0) {
    return { estimateData: candidate };
  }

  const inputErrors = validateEstimateInput(candidate);
  if (inputErrors.length === 0) {
    return { estimateData: createEstimate(candidate) };
  }

  return {
    errors: [
      'Payload must be a full estimate object with generated sections or valid estimator input fields.',
      ...inputErrors
    ]
  };
}

function formatExportFilename(extension) {
  const dateStamp = new Date().toISOString().slice(0, 10);
  return `project-estimate-${dateStamp}.${extension}`;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

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

      const result = createEstimate(body);
      sendJson(res, 200, {
        input: result.normalizedInput,
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

  if (req.method === 'POST' && (req.url === '/export/pdf' || req.url === '/export/docx')) {
    try {
      const body = await parseJsonBody(req);
      const exportPayload = resolveExportEstimate(body);

      if (exportPayload.errors) {
        sendJson(res, 400, {
          error: 'ValidationError',
          message: 'Missing or invalid export payload.',
          details: exportPayload.errors
        });
        return;
      }

      if (req.url === '/export/pdf') {
        const pdfBuffer = createPdfBuffer(exportPayload.estimateData);
        sendBinary(res, 200, pdfBuffer, 'application/pdf', formatExportFilename('pdf'));
        return;
      }

      const docxBuffer = createDocxBuffer(exportPayload.estimateData);
      sendBinary(
        res,
        200,
        docxBuffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        formatExportFilename('docx')
      );
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
