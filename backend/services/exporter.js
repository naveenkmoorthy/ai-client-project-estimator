function toDocumentText(estimateData) {
  const projectSummary = estimateData.normalizedInput || estimateData.input || estimateData;
  const projectDescription = projectSummary.projectDescription || 'N/A';
  const deadline = projectSummary.deadline || 'N/A';
  const budget = projectSummary.budget || {};
  const budgetText = `${budget.amount ?? 'N/A'} ${budget.currency || ''}`.trim();

  const taskBreakdown = (estimateData.taskBreakdown || [])
    .map((task) => `- ${task.task} (${task.estimatedHours}h): ${task.description}`)
    .join('\n');

  const timeline = (estimateData.timeline || [])
    .map((item) => `- ${item.date}: ${item.milestone}`)
    .join('\n');

  const costEstimate = estimateData.costEstimate || {};
  const risks = (estimateData.riskFlags || [])
    .map((risk) => `- [${String(risk.severity || '').toUpperCase()}] ${risk.issue} | Mitigation: ${risk.mitigation}`)
    .join('\n');

  const proposal = estimateData.proposalMarkdown || estimateData.proposalPlainText || estimateData.proposalDraft || 'N/A';

  return [
    'Project Estimate Export',
    '',
    'Project Overview',
    `Description: ${projectDescription}`,
    `Deadline: ${deadline}`,
    `Budget: ${budgetText}`,
    '',
    'Task Breakdown',
    taskBreakdown || '- N/A',
    '',
    'Timeline',
    timeline || '- N/A',
    '',
    'Cost Estimate',
    `Subtotal: ${costEstimate.subtotal ?? 'N/A'} ${costEstimate.currency || ''}`.trim(),
    `Contingency: ${costEstimate.contingency ?? 'N/A'} ${costEstimate.currency || ''}`.trim(),
    `Total: ${costEstimate.total ?? 'N/A'} ${costEstimate.currency || ''}`.trim(),
    '',
    'Risk Flags',
    risks || '- N/A',
    '',
    'Proposal',
    proposal
  ].join('\n');
}

function createPdfBuffer(estimateData) {
  const documentText = toDocumentText(estimateData);
  return Buffer.from(`%PDF-1.4\n${documentText}\n%%EOF\n`, 'utf8');
}

function createDocxBuffer(estimateData) {
  const documentText = toDocumentText(estimateData);
  return Buffer.from(documentText, 'utf8');
}

module.exports = {
  createPdfBuffer,
  createDocxBuffer
};
