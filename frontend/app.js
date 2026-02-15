const form = document.getElementById('estimator-form');
const submitButton = form.querySelector('button[type="submit"]');
const defaultSubmitLabel = submitButton ? submitButton.textContent : 'Generate decision-ready draft';
const errorEl = document.getElementById('error');
const resultsEl = document.getElementById('results');
const resultsHeadingEl = resultsEl?.querySelector('h2');
const exportPdfButton = document.getElementById('exportPdf');
const exportDocxButton = document.getElementById('exportDocx');
const progressPercentEl = document.getElementById('progressPercent');
const sectionProgressEls = Array.from(document.querySelectorAll('[data-section]'));
let latestPayload = null;
let latestEstimateData = null;

const fieldSectionMap = {
  projectDescription: 'scope',
  budgetAmount: 'budget',
  budgetCurrency: 'budget',
  deadline: 'timeline'
};

const outputFields = {
  kpiTotalCost: document.getElementById('kpiTotalCost'),
  kpiDuration: document.getElementById('kpiDuration'),
  kpiRisk: document.getElementById('kpiRisk'),
  kpiEffortHours: document.getElementById('kpiEffortHours'),
  primaryRecommendation: document.getElementById('primaryRecommendation'),
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

function renderEmptyState({
  title = 'No data yet.',
  guidance = 'Generate a draft to populate this section.',
  actionLabel,
  actionTarget
} = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'empty-state';

  const titleEl = document.createElement('p');
  titleEl.className = 'empty-state__title';
  titleEl.textContent = title;

  const guidanceEl = document.createElement('p');
  guidanceEl.className = 'empty-state__guidance';
  guidanceEl.textContent = guidance;

  wrapper.append(titleEl, guidanceEl);

  if (actionLabel && actionTarget) {
    const action = document.createElement('a');
    action.className = 'empty-state__action';
    action.href = actionTarget;
    action.textContent = actionLabel;
    wrapper.appendChild(action);
  }

  return wrapper;
}

function ensureResultsBanner(type, message) {
  if (!resultsEl) {
    return;
  }

  const existing = resultsEl.querySelector('.results-banner');
  existing?.remove();

  const banner = document.createElement('div');
  banner.className = `results-banner results-banner--${type}`;
  banner.setAttribute('role', 'status');
  banner.textContent = message;

  if (resultsHeadingEl) {
    resultsHeadingEl.insertAdjacentElement('afterend', banner);
  } else {
    resultsEl.prepend(banner);
  }
}

function showResults() {
  resultsEl.classList.remove('hidden');
  resultsEl.classList.remove('is-visible');
  requestAnimationFrame(() => {
    resultsEl.classList.add('is-visible');
  });
}

function renderSkeletonBlock(lines = 3) {
  const block = document.createElement('div');
  block.className = 'skeleton-block';

  for (let index = 0; index < lines; index += 1) {
    const line = document.createElement('span');
    line.className = 'skeleton-line';
    if (index === lines - 1) {
      line.classList.add('skeleton-line--short');
    }
    block.appendChild(line);
  }

  return block;
}

function renderLoadingState() {
  ensureResultsBanner('loading', 'Generating your delivery draft… building scope, milestones, budget, and risk guidance.');

  outputFields.kpiTotalCost.textContent = '…';
  outputFields.kpiDuration.textContent = '…';
  outputFields.kpiRisk.textContent = '…';
  outputFields.kpiEffortHours.textContent = '…';
  outputFields.primaryRecommendation.textContent = 'Analyzing your inputs and preparing an approval-ready recommendation.';

  clearElement(outputFields.taskBreakdown);
  clearElement(outputFields.timeline);
  clearElement(outputFields.costEstimate);
  clearElement(outputFields.riskFlags);
  clearElement(outputFields.proposalDraft);
  clearElement(outputFields.rawJson);

  outputFields.taskBreakdown.appendChild(renderSkeletonBlock(5));
  outputFields.timeline.appendChild(renderSkeletonBlock(4));
  outputFields.costEstimate.appendChild(renderSkeletonBlock(4));
  outputFields.riskFlags.appendChild(renderSkeletonBlock(4));
  outputFields.proposalDraft.appendChild(renderSkeletonBlock(6));

  showResults();
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
    container.appendChild(renderEmptyState({
      title: 'No scoped tasks were generated.',
      guidance: 'Add required features, integrations, and deliverables to generate a clearer scope plan.',
      actionLabel: 'Strengthen scope input',
      actionTarget: '#projectDescription'
    }));
    return container;
  }

  const list = document.createElement('ul');
  list.className = 'task-breakdown-list';

  items.forEach((item) => {
    const row = document.createElement('li');
    row.className = 'task-breakdown-item';

    const title = document.createElement('h4');
    title.className = 'task-breakdown-item__title';
    title.textContent = item.task || item.name || 'Untitled task';

    const meta = document.createElement('div');
    meta.className = 'task-breakdown-item__meta';

    const hours = item.hours ?? item.estimatedHours;
    const hoursTag = document.createElement('span');
    hoursTag.className = 'task-breakdown-tag';
    hoursTag.textContent = Number.isFinite(hours) ? `${hours}h` : 'Hours N/A';

    const dependencyBlock = document.createElement('div');
    dependencyBlock.className = 'task-breakdown-dependencies';

    const dependencyLabel = document.createElement('span');
    dependencyLabel.className = 'task-breakdown-dependencies__label';
    dependencyLabel.textContent = 'Dependencies:';

    const dependencies = Array.isArray(item.dependencies) ? item.dependencies : [];
    const dependencyList = document.createElement('div');
    dependencyList.className = 'task-breakdown-dependencies__list';

    if (dependencies.length) {
      dependencies.forEach((dependency) => {
        const dependencyTag = document.createElement('span');
        dependencyTag.className = 'task-breakdown-tag task-breakdown-tag--subtle';
        dependencyTag.textContent = dependency;
        dependencyList.appendChild(dependencyTag);
      });
    } else {
      const noneTag = document.createElement('span');
      noneTag.className = 'task-breakdown-tag task-breakdown-tag--subtle';
      noneTag.textContent = 'None';
      dependencyList.appendChild(noneTag);
    }

    meta.append(hoursTag);
    dependencyBlock.append(dependencyLabel, dependencyList);
    row.append(title, meta, dependencyBlock);
    list.appendChild(row);
  });

  container.appendChild(list);
  return container;
}

function renderTimeline(timeline) {
  const container = document.createElement('div');

  if (!Array.isArray(timeline) || timeline.length === 0) {
    container.appendChild(renderEmptyState({
      title: 'Timeline milestones are unavailable.',
      guidance: 'Confirm your target date and key phases to produce a more decision-ready schedule.',
      actionLabel: 'Refine timeline target',
      actionTarget: '#deadline'
    }));
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

function summarizeDuration(timeline) {
  if (!Array.isArray(timeline) || timeline.length === 0) {
    return 'TBD';
  }

  const dateValues = timeline.flatMap((milestone) => [
    milestone?.startDate || milestone?.start || milestone?.date || milestone?.targetDate,
    milestone?.endDate || milestone?.end || milestone?.date || milestone?.targetDate
  ]).filter(Boolean);

  const timestamps = dateValues
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length < 2) {
    return `${timeline.length} milestone${timeline.length === 1 ? '' : 's'}`;
  }

  const totalDays = Math.ceil((Math.max(...timestamps) - Math.min(...timestamps)) / (1000 * 60 * 60 * 24));
  if (totalDays < 14) {
    return `${totalDays} day${totalDays === 1 ? '' : 's'}`;
  }

  const totalWeeks = Math.ceil(totalDays / 7);
  return `${totalWeeks} week${totalWeeks === 1 ? '' : 's'}`;
}

function calculateEffortHours(tasks) {
  if (!Array.isArray(tasks)) {
    return 0;
  }

  return tasks.reduce((sum, task) => {
    const hours = Number(task?.hours ?? task?.estimatedHours);
    return sum + (Number.isFinite(hours) ? hours : 0);
  }, 0);
}

function getRecommendedBudgetRange(costEstimate) {
  const total = Number(costEstimate?.total);
  const contingency = Number(costEstimate?.contingency);
  const currency = costEstimate?.currency || 'USD';

  if (!Number.isFinite(total)) {
    return 'Recommended budget range unavailable.';
  }

  const buffer = Number.isFinite(contingency) ? contingency : total * 0.1;
  const minBudget = Math.max(0, total - buffer);
  const maxBudget = total + buffer;

  return `Recommended approval range: ${formatCurrency(minBudget, currency)} – ${formatCurrency(maxBudget, currency)}`;
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
    container.appendChild(renderEmptyState({
      title: 'Cost breakdown is empty.',
      guidance: 'Add a valid budget and currency so the plan can generate an approval-ready cost view.',
      actionLabel: 'Review budget guardrails',
      actionTarget: '#budgetAmount'
    }));
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
    container.appendChild(renderEmptyState({
      title: 'No explicit risks detected.',
      guidance: 'Add dependencies or constraints to surface risks before stakeholder review.',
      actionLabel: 'Add decision risks',
      actionTarget: '#projectDescription'
    }));
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

function getProposalContent(data) {
  return (typeof data?.proposalMarkdown === 'string' && data.proposalMarkdown.trim())
    || (typeof data?.proposalPlainText === 'string' && data.proposalPlainText.trim())
    || (typeof data?.proposalDraft === 'string' && data.proposalDraft.trim())
    || 'No proposal draft generated yet.';
}

function setExportButtonsState({
  disabled = false,
  loadingFormat = null
} = {}) {
  const controls = [
    { button: exportPdfButton, label: 'Export PDF', format: 'pdf' },
    { button: exportDocxButton, label: 'Export DOCX', format: 'docx' }
  ];

  controls.forEach(({ button, label, format }) => {
    if (!button) {
      return;
    }

    const isLoading = loadingFormat === format;
    button.disabled = disabled;
    button.textContent = isLoading ? `Exporting ${format.toUpperCase()}…` : label;
    button.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  });
}

function getExportFileName(response, format) {
  const contentDisposition = response.headers.get('content-disposition') || '';
  const filenameMatch = contentDisposition.match(/filename\*?=(?:UTF-8''|\")?([^\";]+)/i);

  if (filenameMatch?.[1]) {
    return decodeURIComponent(filenameMatch[1].replace(/"/g, '')).trim();
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  return `project-estimate-${timestamp}.${format}`;
}

async function exportEstimate(format) {
  if (!latestEstimateData) {
    ensureResultsBanner('loading', 'Generate a draft before exporting your proposal.');
    return;
  }

  const proposalContent = getProposalContent(latestEstimateData);
  const exportPayload = {
    ...latestEstimateData,
    proposalContent,
    proposalDraft: proposalContent
  };

  setExportButtonsState({ disabled: true, loadingFormat: format });
  ensureResultsBanner('loading', `Preparing your ${format.toUpperCase()} export…`);

  try {
    const response = await fetch(`http://localhost:3001/export/${format}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(exportPayload)
    });

    if (!response.ok) {
      let message = `Export failed (${response.status}).`;
      try {
        const payload = await response.json();
        message = payload.message || message;
      } catch {
        // Ignore parsing failure and keep fallback message.
      }
      throw new Error(message);
    }

    const fileBlob = await response.blob();
    const fileUrl = URL.createObjectURL(fileBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = fileUrl;
    downloadLink.download = getExportFileName(response, format);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    URL.revokeObjectURL(fileUrl);

    ensureResultsBanner('success', `${format.toUpperCase()} export is ready. Your download has started.`);
  } catch (error) {
    ensureResultsBanner('error', `Could not export ${format.toUpperCase()}: ${error.message}`);
  } finally {
    setExportButtonsState({ disabled: false });
  }
}

function renderEstimate(data) {
  latestEstimateData = data;
  const totalCost = formatCurrency(Number(data.costEstimate?.total), data.costEstimate?.currency || 'USD');
  const riskLevel = summarizeRiskLevel(data.riskFlags);
  const effortHours = calculateEffortHours(data.taskBreakdown);

  outputFields.kpiTotalCost.textContent = totalCost;
  outputFields.kpiDuration.textContent = summarizeDuration(data.timeline);
  outputFields.kpiRisk.textContent = riskLevel;
  outputFields.kpiEffortHours.textContent = `${effortHours}h`;
  outputFields.primaryRecommendation.textContent = getRecommendedBudgetRange(data.costEstimate);

  clearElement(outputFields.taskBreakdown);
  clearElement(outputFields.timeline);
  clearElement(outputFields.costEstimate);
  clearElement(outputFields.riskFlags);

  outputFields.taskBreakdown.appendChild(renderTaskBreakdown(data.taskBreakdown));
  outputFields.timeline.appendChild(renderTimeline(data.timeline));
  outputFields.costEstimate.appendChild(renderCostEstimate(data.costEstimate));
  outputFields.riskFlags.appendChild(renderRiskFlags(data.riskFlags));

  const proposalContent = getProposalContent(data);

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
    primaryLabel: 'Budget Ask',
    primaryValue: formatCurrency(Number(data.costEstimate?.total), data.costEstimate?.currency || 'USD')
  });

  setCardMetadata('riskFlags', {
    icon: '⚠️',
    metaLabel: 'Risk outlook',
    primaryLabel: 'Top Risk',
    primaryValue: summarizeRiskLevel(data.riskFlags)
  });

  setCardMetadata('proposalDraft', {
    icon: '📝',
    metaLabel: 'Client-ready narrative',
    primaryLabel: 'Draft Length',
    primaryValue: `${proposalContent.split(/\s+/).filter(Boolean).length} words`
  });

  ensureResultsBanner('success', 'Draft ready. Review the plan below, then refine inputs to tighten scope and reduce revisions.');
  showResults();
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
setExportButtonsState({ disabled: true });

exportPdfButton?.addEventListener('click', () => {
  exportEstimate('pdf');
});

exportDocxButton?.addEventListener('click', () => {
  exportEstimate('docx');
});

function showRequestFailure(message) {
  errorEl.textContent = `Could not generate the draft: ${message} `;
  const retryButton = document.createElement('button');
  retryButton.type = 'button';
  retryButton.className = 'error-retry-btn';
  retryButton.textContent = 'Try again';
  retryButton.addEventListener('click', () => {
    form.requestSubmit();
  });

  errorEl.appendChild(retryButton);
}

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

  latestPayload = payload;

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Generating draft…';
  }
  setExportButtonsState({ disabled: true });

  renderLoadingState();

  try {
    const response = await fetch('http://localhost:3001/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(latestPayload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'The draft request failed.');
    }

    renderEstimate(data);
    setExportButtonsState({ disabled: false });
  } catch (error) {
    showRequestFailure(error.message);
    resultsEl.classList.add('hidden');
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = defaultSubmitLabel;
    }
    setExportButtonsState({ disabled: !latestEstimateData });
  }
});
