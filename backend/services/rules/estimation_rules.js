const HOURS_PER_DAY = 6;
const DEFAULT_TEAM_VELOCITY_HOURS_PER_WEEK = 30;

const TASK_SIZING_TIERS = {
  S: { minHours: 1, maxHours: 8 },
  M: { minHours: 9, maxHours: 24 },
  L: { minHours: 25, maxHours: 56 },
  XL: { minHours: 57, maxHours: Number.POSITIVE_INFINITY }
};

function getTaskTier(estimatedHours) {
  if (estimatedHours <= TASK_SIZING_TIERS.S.maxHours) return 'S';
  if (estimatedHours <= TASK_SIZING_TIERS.M.maxHours) return 'M';
  if (estimatedHours <= TASK_SIZING_TIERS.L.maxHours) return 'L';
  return 'XL';
}

function buildTaskSizing(taskBreakdown) {
  return taskBreakdown.map((task) => {
    const tier = getTaskTier(task.estimatedHours);
    return {
      task: task.task,
      estimatedHours: task.estimatedHours,
      tier,
      defaultRange: TASK_SIZING_TIERS[tier]
    };
  });
}

function hoursToTimeline(totalHours, teamVelocityHoursPerWeek = DEFAULT_TEAM_VELOCITY_HOURS_PER_WEEK) {
  const safeVelocity = teamVelocityHoursPerWeek > 0 ? teamVelocityHoursPerWeek : DEFAULT_TEAM_VELOCITY_HOURS_PER_WEEK;
  const requiredWeeks = totalHours > 0 ? totalHours / safeVelocity : 0;
  const requiredDays = requiredWeeks * 5;

  return {
    totalHours,
    teamVelocityHoursPerWeek: safeVelocity,
    requiredWeeks: Number(requiredWeeks.toFixed(2)),
    requiredDays: Number(requiredDays.toFixed(1))
  };
}

function getBudgetStatus(estimatedTotalCost, providedBudget) {
  if (providedBudget <= 0) {
    return { status: 'over_budget', utilization: null, shortfall: estimatedTotalCost };
  }

  const utilization = estimatedTotalCost / providedBudget;

  if (utilization <= 0.95) {
    return {
      status: 'within_budget',
      utilization: Number(utilization.toFixed(2)),
      shortfall: 0
    };
  }

  if (utilization <= 1.1) {
    return {
      status: 'at_risk',
      utilization: Number(utilization.toFixed(2)),
      shortfall: Number(Math.max(0, estimatedTotalCost - providedBudget).toFixed(2))
    };
  }

  return {
    status: 'over_budget',
    utilization: Number(utilization.toFixed(2)),
    shortfall: Number(Math.max(0, estimatedTotalCost - providedBudget).toFixed(2))
  };
}

function getDeadlineStatus(requiredDays, availableDays) {
  if (availableDays <= 0) {
    return {
      status: 'unrealistic',
      slackDays: Number((-requiredDays).toFixed(1))
    };
  }

  const ratio = requiredDays / availableDays;
  const slackDays = availableDays - requiredDays;

  if (ratio <= 0.8) {
    return {
      status: 'on_track',
      slackDays: Number(slackDays.toFixed(1))
    };
  }

  if (ratio <= 1) {
    return {
      status: 'tight',
      slackDays: Number(slackDays.toFixed(1))
    };
  }

  return {
    status: 'unrealistic',
    slackDays: Number(slackDays.toFixed(1))
  };
}

function detectUnclearScope(projectDescription) {
  if (!projectDescription || projectDescription.length < 80) {
    return true;
  }

  return /(tbd|etc\.|and more|something like|to be decided|as needed)/i.test(projectDescription);
}

function detectExternalDependencies(projectDescription) {
  return /(third[- ]party|vendor|integration|dependency|api|payment gateway|external service)/i.test(projectDescription);
}

function buildRiskFlags({ projectDescription, budgetStatus, deadlineStatus }) {
  const flags = [];

  if (detectUnclearScope(projectDescription)) {
    flags.push({
      severity: 'medium',
      issue: 'Unclear scope',
      mitigation: 'Run a scoping workshop, define acceptance criteria, and baseline assumptions.'
    });
  }

  if (deadlineStatus.status !== 'on_track') {
    flags.push({
      severity: deadlineStatus.status === 'unrealistic' ? 'high' : 'medium',
      issue: 'Tight deadline',
      mitigation: 'Reduce scope to MVP, parallelize workstreams, and lock milestone decisions weekly.'
    });
  }

  if (budgetStatus.status !== 'within_budget') {
    flags.push({
      severity: budgetStatus.status === 'over_budget' ? 'high' : 'medium',
      issue: 'Budget shortfall',
      mitigation: 'Prioritize highest-value features and phase non-critical deliverables into later releases.'
    });
  }

  if (detectExternalDependencies(projectDescription)) {
    flags.push({
      severity: 'medium',
      issue: 'External dependencies',
      mitigation: 'Confirm third-party SLAs, identify fallback options, and track integration blockers early.'
    });
  }

  if (flags.length === 0) {
    flags.push({
      severity: 'low',
      issue: 'No immediate execution risks detected',
      mitigation: 'Maintain weekly checkpoints to keep scope, schedule, and budget aligned.'
    });
  }

  return flags;
}

function deriveEstimationSignals({ projectDescription, taskBreakdown, costEstimate, budgetAmount, availableDurationDays }) {
  const taskSizing = buildTaskSizing(taskBreakdown);
  const totalHours = taskBreakdown.reduce((sum, task) => sum + task.estimatedHours, 0);
  const timelineModel = hoursToTimeline(totalHours);
  const budgetStatus = getBudgetStatus(costEstimate.total, budgetAmount);
  const deadlineStatus = getDeadlineStatus(timelineModel.requiredDays, availableDurationDays);
  const riskFlags = buildRiskFlags({ projectDescription, budgetStatus, deadlineStatus });

  return {
    sizingTiers: TASK_SIZING_TIERS,
    taskSizing,
    timelineModel,
    budgetStatus,
    deadlineStatus,
    riskFlags
  };
}

module.exports = {
  TASK_SIZING_TIERS,
  DEFAULT_TEAM_VELOCITY_HOURS_PER_WEEK,
  buildTaskSizing,
  hoursToTimeline,
  getBudgetStatus,
  getDeadlineStatus,
  buildRiskFlags,
  deriveEstimationSignals
};
