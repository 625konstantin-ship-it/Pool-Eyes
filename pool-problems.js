function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderRecommendationsHtml(recs) {
  return recs.map(r =>
    `<div class="rec-item ${r.level}"><strong>${escapeHtml(r.title)}</strong>${escapeHtml(r.text)}</div>`
  ).join('');
}

function buildProblemRecommendations(problemIds) {
  if (!problemIds || problemIds.length === 0) return [];

  const problems = typeof getPoolProblems === 'function' ? getPoolProblems() : [];
  const recs = [];
  problemIds.forEach(id => {
    const problem = problems.find(p => p.id === id);
    if (problem) {
      problem.recommendations.forEach(r => {
        recs.push({ ...r, title: `${problem.label}: ${r.title}` });
      });
    }
  });
  return recs;
}
