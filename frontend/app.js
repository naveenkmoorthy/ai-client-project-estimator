const form = document.getElementById('estimator-form');
const errorEl = document.getElementById('error');
const resultsEl = document.getElementById('results');

const outputFields = {
  taskBreakdown: document.getElementById('taskBreakdown'),
  timeline: document.getElementById('timeline'),
  costEstimate: document.getElementById('costEstimate'),
  riskFlags: document.getElementById('riskFlags'),
  proposalDraft: document.getElementById('proposalDraft')
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

function renderEstimate(data) {
  outputFields.taskBreakdown.textContent = JSON.stringify(data.taskBreakdown, null, 2);
  outputFields.timeline.textContent = JSON.stringify(data.timeline, null, 2);
  outputFields.costEstimate.textContent = JSON.stringify(data.costEstimate, null, 2);
  outputFields.riskFlags.textContent = JSON.stringify(data.riskFlags, null, 2);
  outputFields.proposalDraft.textContent = data.proposalDraft || '';
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
  }
});
