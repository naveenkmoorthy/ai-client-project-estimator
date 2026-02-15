const fs = require('fs');
const path = require('path');

const DAY_MS = 24 * 60 * 60 * 1000;
const { deriveEstimationSignals } = require('./rules/estimation_rules');
const proposalTemplatePath = path.resolve(__dirname, '../../shared/templates/proposal.md');
const proposalTemplate = fs.readFileSync(proposalTemplatePath, 'utf8');

function normalizeInput(rawInput) {
  const normalizedDescription = String(rawInput.projectDescription || '').trim();
  const budgetAmount = parseBudgetAmount(rawInput.budget);
  const budgetCurrency = parseBudgetCurrency(rawInput.budget);
  const parsedDeadline = parseDeadline(rawInput.deadline);

  return {
    projectDescription: normalizedDescription,
    budget: {
      amount: budgetAmount,
      currency: budgetCurrency
    },
    deadline: parsedDeadline.isoDate,
    metadata: {
      availableDurationDays: parsedDeadline.availableDurationDays,
      availableDurationWeeks: Number((parsedDeadline.availableDurationDays / 7).toFixed(1)),
      isPastDeadline: parsedDeadline.availableDurationDays < 0
    }
  };
}

function parseBudgetAmount(budget) {
  const raw = budget && Object.prototype.hasOwnProperty.call(budget, 'amount') ? budget.amount : NaN;

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }

  if (typeof raw === 'string') {
    const cleaned = raw.replace(/[^0-9.-]+/g, '');
    const parsed = Number.parseFloat(cleaned);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

function parseBudgetCurrency(budget) {
  const rawCurrency = budget && budget.currency;
  if (typeof rawCurrency !== 'string' || !rawCurrency.trim()) {
    return 'USD';
  }

  const currency = rawCurrency.trim().toUpperCase();
  return currency.slice(0, 3);
}

function parseDeadline(rawDeadline) {
  const parsed = new Date(rawDeadline);
  const now = new Date();

  if (Number.isNaN(parsed.getTime())) {
    const fallbackDate = new Date(now.getTime() + 30 * DAY_MS);
    return {
      isoDate: fallbackDate.toISOString().slice(0, 10),
      availableDurationDays: 30
    };
  }

  const diffMs = parsed.getTime() - now.getTime();
  const availableDurationDays = Math.ceil(diffMs / DAY_MS);

  return {
    isoDate: parsed.toISOString().slice(0, 10),
    availableDurationDays
  };
}

function safeJsonParse(value) {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function runStructuredStage({ stageName, schemaReminder, context, generator, validate, fallback }) {
  const maxAttempts = 2;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const modelOutput = generator({ attempt, stageName, schemaReminder, context });
      const parsedOutput = safeJsonParse(modelOutput);

      if (!validate(parsedOutput)) {
        throw new Error(`${stageName} output did not match schema.`);
      }

      return parsedOutput;
    } catch (error) {
      lastError = error;
    }
  }

  return {
    ...fallback,
    _fallbackReason: lastError ? lastError.message : `${stageName} failed.`
  };
}

function validateTaskBreakdown(data) {
  return Array.isArray(data)
    && data.length > 0
    && data.every((item) => item
      && typeof item.task === 'string'
      && typeof item.description === 'string'
      && typeof item.estimatedHours === 'number');
}

function validateTimeline(data) {
  return Array.isArray(data)
    && data.length > 0
    && data.every((item) => item
      && typeof item.milestone === 'string'
      && typeof item.date === 'string');
}

function validateCostEstimate(data) {
  return Boolean(data)
    && typeof data.subtotal === 'number'
    && typeof data.contingency === 'number'
    && typeof data.total === 'number'
    && typeof data.currency === 'string';
}

function validateRiskFlags(data) {
  return Array.isArray(data)
    && data.length > 0
    && data.every((item) => item
      && ['low', 'medium', 'high'].includes(item.severity)
      && typeof item.issue === 'string'
      && typeof item.mitigation === 'string');
}

function generateTaskBreakdown(projectDescription) {
  return runStructuredStage({
    stageName: 'generateTaskBreakdown',
    schemaReminder: 'Return JSON array of {task, description, estimatedHours:number}.',
    context: { projectDescription },
    validate: validateTaskBreakdown,
    fallback: [
      {
        task: 'Discovery & Scoping',
        description: 'Review requirements and confirm assumptions.',
        estimatedHours: 8
      },
      {
        task: 'Implementation',
        description: 'Deliver the core feature set in iterative milestones.',
        estimatedHours: 40
      }
    ],
    generator: ({ context, attempt }) => {
      const complexityBoost = Math.max(0, Math.ceil(context.projectDescription.length / 120));
      const output = [
        {
          task: 'Requirements & Planning',
          description: 'Clarify acceptance criteria and implementation details.',
          estimatedHours: 6 + complexityBoost
        },
        {
          task: 'Development',
          description: 'Build and refine the requested product functionality.',
          estimatedHours: 24 + complexityBoost * 3
        },
        {
          task: 'QA & Handoff',
          description: 'Test, fix issues, and prepare delivery documentation.',
          estimatedHours: 10 + complexityBoost
        }
      ];

      if (attempt === 1 && process.env.SIMULATE_MALFORMED_MODEL_OUTPUT === '1') {
        return '{not valid json';
      }

      return output;
    }
  });
}

function generateTimeline(taskBreakdown, deadline) {
  return runStructuredStage({
    stageName: 'generateTimeline',
    schemaReminder: 'Return JSON array of {milestone, date}.',
    context: { taskBreakdown, deadline },
    validate: validateTimeline,
    fallback: [
      { milestone: 'Project Kickoff', date: deadline },
      { milestone: 'Final Delivery', date: deadline }
    ],
    generator: ({ context }) => {
      const milestoneCount = Math.max(2, context.taskBreakdown.length);
      const endDate = new Date(context.deadline);
      const startDate = new Date();
      const intervalMs = Math.max(DAY_MS, (endDate.getTime() - startDate.getTime()) / milestoneCount);

      return context.taskBreakdown.map((task, index) => {
        const milestoneDate = new Date(startDate.getTime() + intervalMs * (index + 1));
        const clampedDate = milestoneDate > endDate ? endDate : milestoneDate;

        return {
          milestone: task.task,
          date: clampedDate.toISOString().slice(0, 10)
        };
      });
    }
  });
}

function generateCostEstimate(taskBreakdown, budget) {
  return runStructuredStage({
    stageName: 'generateCostEstimate',
    schemaReminder: 'Return JSON object {subtotal, contingency, total, currency}.',
    context: { taskBreakdown, budget },
    validate: validateCostEstimate,
    fallback: {
      subtotal: budget.amount,
      contingency: 0,
      total: budget.amount,
      currency: budget.currency
    },
    generator: ({ context }) => {
      const totalHours = context.taskBreakdown.reduce((sum, task) => sum + task.estimatedHours, 0);
      const hourlyRate = totalHours > 0 ? context.budget.amount / totalHours : context.budget.amount;
      const subtotal = Number((hourlyRate * totalHours * 0.9).toFixed(2));
      const contingency = Number((subtotal * 0.1).toFixed(2));

      return {
        subtotal,
        contingency,
        total: Number((subtotal + contingency).toFixed(2)),
        currency: context.budget.currency
      };
    }
  });
}

function generateProposalDraft(allSections) {
  const tasks = allSections.taskBreakdown.map((task) => `- ${task.task}`).join('\n');

  const signalsContext = [
    `Budget status: ${allSections.estimationSignals.budgetStatus.status}.`,
    `Deadline status: ${allSections.estimationSignals.deadlineStatus.status}.`,
    `Required duration: ${allSections.estimationSignals.timelineModel.requiredWeeks} weeks (${allSections.estimationSignals.timelineModel.requiredDays} days).`,
    `Detected risks: ${allSections.riskFlags.map((risk) => risk.issue).join(', ')}.`
  ].join(' ');

  return [
    'Proposed Approach:',
    tasks,
    '',
    `Target delivery date: ${allSections.deadline}.`,
    `Estimated total: ${allSections.costEstimate.total} ${allSections.costEstimate.currency}.`,
    `Key risks identified: ${allSections.riskFlags.length}.`,
    '',
    'AI Prompt Context:',
    signalsContext
  ].join('\n');
}

function formatCurrency(value, currency) {
  return `${Number(value).toFixed(2)} ${currency}`;
}

function mapEstimatorOutputsToTemplateVariables(allSections) {
  const hasDescription = Boolean(allSections.projectDescription);
  const hasBudget = allSections.budget && allSections.budget.amount > 0;
  const hasTimeline = Array.isArray(allSections.timeline) && allSections.timeline.length > 0;
  const assumptions = [];

  if (!hasDescription) {
    assumptions.push('- Project details are limited, so effort estimates are based on a standard web delivery workflow.');
  }

  if (!hasBudget) {
    assumptions.push(`- Budget was not provided or is zero, so pricing is modeled from estimated effort in ${allSections.costEstimate.currency}.`);
  }

  if (!hasTimeline) {
    assumptions.push(`- Milestone dates are provisional and currently aligned to the stated deadline (${allSections.deadline}).`);
  }

  const explicitAssumptions = assumptions.length > 0
    ? assumptions.join('\n')
    : '- Assumptions are based on the provided project description, budget, and deadline inputs.';

  const workBreakdown = allSections.taskBreakdown
    .map((task) => `- **${task.task}** (${task.estimatedHours}h): ${task.description}`)
    .join('\n');

  const timelineAndMilestones = allSections.timeline
    .map((item) => `- ${item.date}: ${item.milestone}`)
    .join('\n');

  const risksAndMitigations = allSections.riskFlags.length > 0
    ? allSections.riskFlags
      .map((risk) => `- **${risk.severity.toUpperCase()}**: ${risk.issue} Mitigation: ${risk.mitigation}`)
      .join('\n')
    : '- No material risks identified at this stage. Mitigation planning will continue during kickoff.';

  return {
    executiveSummary: `This proposal outlines a focused delivery plan for ${hasDescription ? 'the requested initiative' : 'the scoped project'}. The current estimate targets completion by ${allSections.deadline} with a total projected investment of ${formatCurrency(allSections.costEstimate.total, allSections.costEstimate.currency)}.`,
    scopeAndAssumptions: [
      '- Scope includes planning, implementation, QA, and delivery handoff.',
      explicitAssumptions
    ].join('\n'),
    workBreakdown,
    timelineAndMilestones,
    pricingAndPaymentAssumptions: [
      `- Subtotal: ${formatCurrency(allSections.costEstimate.subtotal, allSections.costEstimate.currency)}.`,
      `- Contingency: ${formatCurrency(allSections.costEstimate.contingency, allSections.costEstimate.currency)}.`,
      `- Total estimate: ${formatCurrency(allSections.costEstimate.total, allSections.costEstimate.currency)}.`,
      '- Payment assumption: 50% at kickoff and 50% upon final delivery acceptance.'
    ].join('\n'),
    risksAndMitigations,
    nextSteps: [
      '- Confirm scope priorities and acceptance criteria.',
      '- Approve timeline and budget assumptions.',
      '- Schedule kickoff and begin execution.'
    ].join('\n')
  };
}

function renderTemplate(template, variables) {
  return Object.entries(variables).reduce((output, [key, value]) => {
    return output.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }, template);
}

function markdownToPlainText(markdown) {
  return markdown
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^-\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function createEstimate(rawInput) {
  const normalizedInput = normalizeInput(rawInput);
  const taskBreakdown = generateTaskBreakdown(normalizedInput.projectDescription);
  const timeline = generateTimeline(taskBreakdown, normalizedInput.deadline);
  const costEstimate = generateCostEstimate(taskBreakdown, normalizedInput.budget);
  const estimationSignals = deriveEstimationSignals({
    projectDescription: normalizedInput.projectDescription,
    taskBreakdown,
    costEstimate,
    budgetAmount: normalizedInput.budget.amount,
    availableDurationDays: normalizedInput.metadata.availableDurationDays
  });
  const riskFlags = runStructuredStage({
    stageName: 'validateRuleRiskFlags',
    schemaReminder: 'Return JSON array of {severity: low|medium|high, issue, mitigation}.',
    context: { riskFlags: estimationSignals.riskFlags },
    validate: validateRiskFlags,
    fallback: estimationSignals.riskFlags,
    generator: ({ context }) => context.riskFlags
  });

  const proposalDraft = generateProposalDraft({
    ...normalizedInput,
    taskBreakdown,
    timeline,
    costEstimate,
    riskFlags,
    estimationSignals
  });

  const proposalVariables = mapEstimatorOutputsToTemplateVariables({
    ...normalizedInput,
    taskBreakdown,
    timeline,
    costEstimate,
    riskFlags,
    estimationSignals
  });
  const proposalMarkdown = renderTemplate(proposalTemplate, proposalVariables);
  const proposalPlainText = markdownToPlainText(proposalMarkdown);

  return {
    normalizedInput,
    taskBreakdown,
    timeline,
    costEstimate,
    riskFlags,
    estimationSignals,
    proposalDraft,
    proposalMarkdown,
    proposalPlainText
  };
}

module.exports = {
  normalizeInput,
  generateTaskBreakdown,
  generateTimeline,
  generateCostEstimate,
  generateProposalDraft,
  mapEstimatorOutputsToTemplateVariables,
  renderTemplate,
  markdownToPlainText,
  createEstimate
};
