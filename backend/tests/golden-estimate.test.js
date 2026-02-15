const test = require('node:test');
const assert = require('node:assert/strict');

const { createEstimate } = require('../services/estimator');

const sampleProject = {
  projectDescription: 'Create a B2B onboarding workflow with admin review, notifications, analytics, and third-party CRM integration.',
  budget: { amount: 18000, currency: 'USD' },
  deadline: '2030-06-15'
};

test('golden test: proposal markdown preserves stable section structure', () => {
  const result = createEstimate(sampleProject);
  const markdown = result.proposalMarkdown;

  const expectedSections = [
    '# Project Proposal',
    '## 1. Executive summary',
    '## 2. Scope and assumptions',
    '## 3. Work breakdown',
    '## 4. Timeline and milestones',
    '## 5. Pricing and payment assumptions',
    '## 6. Risks and mitigations',
    '## 7. Next steps'
  ];

  for (const section of expectedSections) {
    assert.ok(markdown.includes(section), `missing section: ${section}`);
  }

  const sectionPositions = expectedSections.map((section) => markdown.indexOf(section));
  const sortedPositions = [...sectionPositions].sort((a, b) => a - b);
  assert.deepEqual(sectionPositions, sortedPositions);
});
