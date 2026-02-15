const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getBudgetStatus,
  getDeadlineStatus,
  buildRiskFlags
} = require('../services/rules/estimation_rules');

test('budget fit classification maps to within_budget, at_risk, and over_budget', () => {
  assert.equal(getBudgetStatus(900, 1000).status, 'within_budget');
  assert.equal(getBudgetStatus(1050, 1000).status, 'at_risk');
  assert.equal(getBudgetStatus(1300, 1000).status, 'over_budget');
});

test('deadline feasibility classification maps to on_track, tight, and unrealistic', () => {
  assert.equal(getDeadlineStatus(8, 20).status, 'on_track');
  assert.equal(getDeadlineStatus(18, 20).status, 'tight');
  assert.equal(getDeadlineStatus(24, 20).status, 'unrealistic');
});

test('risk severity mapping escalates for unrealistic deadline and over budget scenarios', () => {
  const risks = buildRiskFlags({
    projectDescription: 'A detailed implementation plan with payment gateway integration and third-party API dependency.',
    budgetStatus: { status: 'over_budget' },
    deadlineStatus: { status: 'unrealistic' }
  });

  const deadlineRisk = risks.find((risk) => risk.issue === 'Tight deadline');
  const budgetRisk = risks.find((risk) => risk.issue === 'Budget shortfall');

  assert.ok(deadlineRisk);
  assert.equal(deadlineRisk.severity, 'high');
  assert.ok(budgetRisk);
  assert.equal(budgetRisk.severity, 'high');
});
