const form = document.getElementById('estimator-form');
const submitButton = form.querySelector('button[type="submit"]');
const defaultSubmitLabel = submitButton ? submitButton.textContent : 'Generate Estimate';
const errorEl = document.getElementById('error');
const resultsEl = document.getElementById('results');
const progressPercentEl = document.getElementById('progressPercent');
const sectionProgressEls = Array.from(document.querySelectorAll('[data-section]'));

const fieldSectionMap = {
  projectDescription: 'scope',
  budgetAmount: 'budget',
  budgetCurrency: 'budget',
  deadline: 'timeline'
};

const outputFields = {
  taskBreakdown: document.getElementById('taskBreakdown'),
  timeline: document.getElementById('timeline'),
  costEstimate: document.getElementById('costEstimate'),
  riskFlags: document.getElementById('riskFlags'),
  proposalDraft: document.getElementById('proposalDraft'),
  rawJson: document.getElementById('rawJson')
};

function validateFormInput(payload) {
  const errors = {
    scope: [],
    budget: [],
    timeline: [],
    fields: {}
  };

  if (!payload.projectDescription || payload.projectDescription.length < 10) {
    const message = 'Project description must be at least 10 characters.';
    errors.scope.push(message);
    errors.fields.projectDescription = message;
  }

  if (Number.isNaN(payload.budget.amount) || payload.budget.amount < 0) {
    const message = 'Budget amount must be a non-negative number.';
    errors.budget.push(message);
    errors.fields.budgetAmount = message;
  }

  if (!payload.budget.currency || payload.budget.currency.length !== 3) {
    const message = 'Currency must be a 3-letter ISO code.';
    errors.budget.push(message);
    errors.fields.budgetCurrency = message;
  }

  if (!payload.deadline) {
    const message = 'Deadline is required.';
    errors.timeline.push(message);
    errors.fields.deadline = message;
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

function createCardMetaRow(icon, label) {
  const row = document.createElement('div');
  row.className = 'result-meta';

  const iconEl = document.createElement('span');
  iconEl.className = 'result-meta-icon';
  iconEl.setAttribute('aria-hidden', 'true');
  iconEl.textContent = icon;

  const labelEl = document.createElement('span');
  labelEl.className = 'result-meta-label';
  labelEl.textContent = label;

  row.append(iconEl, labelEl);
  return row;
}

function createCardPrimaryMetric(label, value) {
  const metric = document.createElement('div');
  metric.className = 'result-primary';

  const labelEl = document.createElement('span');
  labelEl.className = 'result-primary-label';
  labelEl.textContent = label;

  const valueEl = document.createElement('strong');
  valueEl.className = 'result-primary-value';
  valueEl.textContent = value;

  metric.append(labelEl, valueEl);
  return metric;
}

function setCardMetadata(contentId, metadata) {
  const content = document.getElementById(contentId);
  const card = content ? content.closest('.result-card') : null;
  if (!card) {
    return;
  }

  card.querySelector('.result-meta')?.remove();
  card.querySelector('.result-primary')?.remove();

  const heading = card.querySelector('h3');
  if (!heading) {
    return;
  }

  const metaRow = createCardMetaRow(metadata.icon, metadata.metaLabel);
  const primaryMetric = createCardPrimaryMetric(metadata.primaryLabel, metadata.primaryValue);

  heading.insertAdjacentElement('afterend', metaRow);
  metaRow.insertAdjacentElement('afterend', primaryMetric);
}

function summarizeRiskLevel(risks) {
  if (!Array.isArray(risks) || risks.length === 0) {
    return 'No risks';
  }

  const priority = ['critical', 'high', 'medium', 'low'];
  const severities = risks
    .map((risk) => normalizeSeverity(risk?.severity).key)
    .filter((value) => priority.includes(value));

  if (severities.length === 0) {
    return 'Unknown';
  }

  const highest = priority.find((level) => severities.includes(level));
  return normalizeSeverity(highest).label;
}

function decorateProposalDraft(content) {
  const lines = content.split('\n');
  return lines.map((line) => {
    const escaped = line
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');

    let className = 'proposal-line';
    if (/^#{1,3}\s+/.test(line)) {
      className += ' proposal-line--heading';
    } else if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      className += ' proposal-line--list';
    } else if (!line.trim()) {
      className += ' proposal-line--spacer';
    }

    return `<span class="${className}">${escaped || '&nbsp;'}</span>`;
  }).join('');
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

  const totalRow = createSummaryRow('Total', formatCurrency(Number(cost.total), currency));
  totalRow.classList.add('summary-row--total');

  summary.replaceChildren(
    createSummaryRow('Subtotal', formatCurrency(Number(cost.subtotal), currency)),
    createSummaryRow('Contingency', formatCurrency(Number(cost.contingency), currency)),
    totalRow,
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
    item.classList.add(`risk-item--${severity.key}`);
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

  outputFields.proposalDraft.innerHTML = decorateProposalDraft(proposalContent);
  outputFields.rawJson.textContent = JSON.stringify(data, null, 2);

  setCardMetadata('taskBreakdown', {
    icon: '🧩',
    metaLabel: 'Work scope',
    primaryLabel: 'Tasks',
    primaryValue: String(Array.isArray(data.taskBreakdown) ? data.taskBreakdown.length : 0)
  });

  setCardMetadata('timeline', {
    icon: '🗓️',
    metaLabel: 'Delivery cadence',
    primaryLabel: 'Milestones',
    primaryValue: String(Array.isArray(data.timeline) ? data.timeline.length : 0)
  });

  setCardMetadata('costEstimate', {
    icon: '💵',
    metaLabel: 'Budget snapshot',
    primaryLabel: 'Total Cost',
    primaryValue: formatCurrency(Number(data.costEstimate?.total), data.costEstimate?.currency || 'USD')
  });

  setCardMetadata('riskFlags', {
    icon: '⚠️',
    metaLabel: 'Risk outlook',
    primaryLabel: 'Top Severity',
    primaryValue: summarizeRiskLevel(data.riskFlags)
  });

  setCardMetadata('proposalDraft', {
    icon: '📝',
    metaLabel: 'Client-ready narrative',
    primaryLabel: 'Draft Length',
    primaryValue: `${proposalContent.split(/\s+/).filter(Boolean).length} words`
  });

  resultsEl.classList.remove('hidden');
}


function clearFieldErrors() {
  Object.keys(fieldSectionMap).forEach((fieldId) => {
    const input = document.getElementById(fieldId);
    const fieldError = document.querySelector(`[data-error-for="${fieldId}"]`);

    if (input) {
      input.classList.remove('input--error');
      input.removeAttribute('aria-invalid');
    }

    if (fieldError) {
      fieldError.textContent = '';
    }
  });
}

function applyFieldErrors(fieldErrors) {
  Object.entries(fieldErrors).forEach(([fieldId, message]) => {
    const input = document.getElementById(fieldId);
    const fieldError = document.querySelector(`[data-error-for="${fieldId}"]`);

    if (input) {
      input.classList.add('input--error');
      input.setAttribute('aria-invalid', 'true');
    }

    if (fieldError) {
      fieldError.textContent = message;
    }
  });
}

function updateProgressIndicator() {
  const sectionCompletion = {
    scope: Boolean(document.getElementById('projectDescription').value.trim().length >= 10),
    budget: Boolean(document.getElementById('budgetAmount').value) && Boolean(document.getElementById('budgetCurrency').value.trim().length === 3),
    timeline: Boolean(document.getElementById('deadline').value)
  };

  const totalSections = Object.keys(sectionCompletion).length;
  const completedSections = Object.values(sectionCompletion).filter(Boolean).length;
  const completionPercent = Math.round((completedSections / totalSections) * 100);

  if (progressPercentEl) {
    progressPercentEl.textContent = `${completionPercent}%`;
  }

  sectionProgressEls.forEach((sectionEl) => {
    const sectionName = sectionEl.getAttribute('data-section');
    sectionEl.classList.toggle('is-complete', Boolean(sectionCompletion[sectionName]));
  });
}

Object.keys(fieldSectionMap).forEach((fieldId) => {
  const input = document.getElementById(fieldId);
  input?.addEventListener('input', () => {
    if (input.classList.contains('input--error')) {
      input.classList.remove('input--error');
      input.removeAttribute('aria-invalid');
      const fieldError = document.querySelector(`[data-error-for="${fieldId}"]`);
      if (fieldError) {
        fieldError.textContent = '';
      }
    }
    updateProgressIndicator();
  });
});

updateProgressIndicator();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.textContent = '';
  clearFieldErrors();

  const payload = {
    projectDescription: document.getElementById('projectDescription').value.trim(),
    budget: {
      amount: Number(document.getElementById('budgetAmount').value),
      currency: document.getElementById('budgetCurrency').value.trim().toUpperCase()
    },
    deadline: document.getElementById('deadline').value
  };

  const validationErrors = validateFormInput(payload);
  const fieldErrors = validationErrors.fields;
  if (Object.keys(fieldErrors).length) {
    applyFieldErrors(fieldErrors);

    const sectionMessages = [
      ...validationErrors.scope,
      ...validationErrors.budget,
      ...validationErrors.timeline
    ];

    errorEl.textContent = sectionMessages.join(' ');
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
