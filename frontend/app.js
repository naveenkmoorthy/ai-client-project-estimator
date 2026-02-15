const form = document.getElementById('estimator-form');
const submitButton = form.querySelector('button[type="submit"]');
const defaultSubmitLabel = submitButton ? submitButton.textContent : 'Generate Estimate';
const errorEl = document.getElementById('error');
const resultsEl = document.getElementById('results');

const outputFields = {
  taskBreakdown: document.getElementById('taskBreakdown'),
  timeline: document.getElementById('timeline'),
  costEstimate: document.getElementById('costEstimate'),
  riskFlags: document.getElementById('riskFlags'),
  proposalDraft: document.getElementById('proposalDraft'),
  rawJson: document.getElementById('rawJson')
};

function validateFormInput(payload) {
  const errors = [];

  if (!payload.projectDescription || payload.projectDescription.length < 10) {
    errors.push('Project description must be at least 10 characters.');
  }

  if (Number.isNaN(payload.budget.amount) || payload.budget.amount < 0) {
    errors.push('Budget amount must be a non-negative number.');
  }

  if (!payload.budget.currency || payload.budget.currency.length !== 3) {
    errors.push('Currency must be a 3-letter ISO code.');
  }

  if (!payload.deadline) {
    errors.push('Deadline is required.');
  }

  return errors;
}

function clearElement(element) {
  element.textContent = '';
}

function renderEmptyState(message = 'No items') {
  const placeholder = document.createElement('p');
  placeholder.className = 'empty-state';
  placeholder.textContent = message;
  return placeholder;
}

function formatCurrency(value, currency = 'USD') {
  if (!Number.isFinite(value)) {
    return 'N/A';
  }

  const normalizedCurrency = typeof currency === 'string' ? currency.toUpperCase() : 'USD';

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalizedCurrency,
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    return `${normalizedCurrency} ${value.toFixed(2)}`;
  }
}

function formatDate(value) {
  if (!value) {
    return 'TBD';
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(parsedDate);
}

function normalizeSeverity(severity) {
  const key = typeof severity === 'string' ? severity.toLowerCase() : 'unknown';
  const severityMap = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    critical: 'Critical'
  };

  return {
    key,
    label: severityMap[key] || 'Unknown'
  };
}

function renderTaskBreakdown(items) {
  const container = document.createElement('div');

  if (!Array.isArray(items) || items.length === 0) {
    container.appendChild(renderEmptyState());
    return container;
  }

  const table = document.createElement('table');
  table.className = 'result-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Task', 'Hours', 'Dependencies'].forEach((title) => {
    const th = document.createElement('th');
    th.textContent = title;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  const tbody = document.createElement('tbody');
  items.forEach((item) => {
    const row = document.createElement('tr');

    const taskCell = document.createElement('td');
    taskCell.textContent = item.task || item.name || 'Untitled task';

    const hoursCell = document.createElement('td');
    const hours = item.hours ?? item.estimatedHours;
    hoursCell.textContent = Number.isFinite(hours) ? `${hours}` : 'N/A';

    const depsCell = document.createElement('td');
    const dependencies = Array.isArray(item.dependencies) ? item.dependencies : [];
    depsCell.textContent = dependencies.length ? dependencies.join(', ') : 'None';

    row.append(taskCell, hoursCell, depsCell);
    tbody.appendChild(row);
  });

  table.append(thead, tbody);
  container.appendChild(table);
  return container;
}

function renderTimeline(timeline) {
  const container = document.createElement('div');

  if (!Array.isArray(timeline) || timeline.length === 0) {
    container.appendChild(renderEmptyState());
    return container;
  }

  const list = document.createElement('ul');
  list.className = 'milestone-list';

  timeline.forEach((milestone) => {
    const item = document.createElement('li');
    item.className = 'milestone-item';

    const name = document.createElement('span');
    name.className = 'milestone-name';
    name.textContent = milestone.name || milestone.milestone || 'Untitled milestone';

    const date = document.createElement('span');
    date.className = 'milestone-date';
    const start = milestone.startDate || milestone.start;
    const end = milestone.endDate || milestone.end;
    if (start || end) {
      date.textContent = `${formatDate(start)} → ${formatDate(end)}`;
    } else {
      date.textContent = formatDate(milestone.date || milestone.targetDate || milestone.range);
    }

    item.append(name, date);
    list.appendChild(item);
  });

  container.appendChild(list);
  return container;
}

function createSummaryRow(label, value) {
  const row = document.createElement('div');
  row.className = 'summary-row';

  const labelEl = document.createElement('span');
  labelEl.className = 'summary-label';
  labelEl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.className = 'summary-value';
  valueEl.textContent = value;

  row.append(labelEl, valueEl);
  return row;
}

function renderCostEstimate(cost) {
  const container = document.createElement('div');

  if (!cost || typeof cost !== 'object') {
    container.appendChild(renderEmptyState());
    return container;
  }

  const summary = document.createElement('div');
  summary.className = 'summary-list';
  const currency = cost.currency || 'USD';

  summary.append(
    createSummaryRow('Subtotal', formatCurrency(Number(cost.subtotal), currency)),
    createSummaryRow('Contingency', formatCurrency(Number(cost.contingency), currency)),
    createSummaryRow('Total', formatCurrency(Number(cost.total), currency)),
    createSummaryRow('Currency', currency)
  );

  container.appendChild(summary);
  return container;
}

function renderRiskFlags(risks) {
  const container = document.createElement('div');

  if (!Array.isArray(risks) || risks.length === 0) {
    container.appendChild(renderEmptyState());
    return container;
  }

  const list = document.createElement('ul');
  list.className = 'risk-list';

  risks.forEach((risk) => {
    const item = document.createElement('li');
    item.className = 'risk-item';

    const text = document.createElement('span');
    text.className = 'risk-text';
    const issue = typeof risk?.issue === 'string' ? risk.issue.trim() : '';
    const mitigation = typeof risk?.mitigation === 'string' ? risk.mitigation.trim() : '';
    const legacyText =
      (typeof risk?.flag === 'string' && risk.flag.trim()) ||
      (typeof risk?.description === 'string' && risk.description.trim()) ||
      '';

    if (issue && mitigation) {
      text.textContent = `${issue} (Mitigation: ${mitigation})`;
    } else {
      text.textContent = issue || mitigation || legacyText || 'Unspecified risk';
    }

    const badge = document.createElement('span');
    const severity = normalizeSeverity(risk.severity);
    badge.className = `risk-badge risk-badge--${severity.key}`;
    badge.textContent = severity.label;

    item.append(text, badge);
    list.appendChild(item);
  });

  container.appendChild(list);
  return container;
}

function renderEstimate(data) {
  clearElement(outputFields.taskBreakdown);
  clearElement(outputFields.timeline);
  clearElement(outputFields.costEstimate);
  clearElement(outputFields.riskFlags);

  outputFields.taskBreakdown.appendChild(renderTaskBreakdown(data.taskBreakdown));
  outputFields.timeline.appendChild(renderTimeline(data.timeline));
  outputFields.costEstimate.appendChild(renderCostEstimate(data.costEstimate));
  outputFields.riskFlags.appendChild(renderRiskFlags(data.riskFlags));

  const proposalContent =
    (typeof data.proposalMarkdown === 'string' && data.proposalMarkdown.trim())
    || (typeof data.proposalPlainText === 'string' && data.proposalPlainText.trim())
    || (typeof data.proposalDraft === 'string' && data.proposalDraft.trim())
    || 'No proposal draft generated.';

  outputFields.proposalDraft.textContent = proposalContent;
  outputFields.rawJson.textContent = JSON.stringify(data, null, 2);

  resultsEl.classList.remove('hidden');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.textContent = '';

  const payload = {
    projectDescription: document.getElementById('projectDescription').value.trim(),
    budget: {
      amount: Number(document.getElementById('budgetAmount').value),
      currency: document.getElementById('budgetCurrency').value.trim().toUpperCase()
    },
    deadline: document.getElementById('deadline').value
  };

  const validationErrors = validateFormInput(payload);
  if (validationErrors.length) {
    errorEl.textContent = validationErrors.join(' ');
    resultsEl.classList.add('hidden');
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Generating…';
  }

  try {
    const response = await fetch('http://localhost:3001/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Estimate request failed.');
    }

    renderEstimate(data);
  } catch (error) {
    errorEl.textContent = `Request failed: ${error.message}`;
    resultsEl.classList.add('hidden');
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = defaultSubmitLabel;
    }
  }
});
