export const ROLES = { benchmark: '主实验基准', pretrain: '预训练来源', construction: '构建来源', qualitative: '定性测试', other: '其他用途' };
export const normalize = value => String(value).normalize('NFKC').toLocaleLowerCase().trim();
export const QUALITIES = { validated: '检查通过', needs_review: '待核结果', legacy: '历史样本' };
export const emptyState = () => ({ q: '', conferences: [], years: [], datasets: [], metrics: [], role: '', quality: '', sort: 'newest', page: 1 });
export function matches(paper, state, omit = '') {
  if (state.q && !(paper.searchText || normalize([paper.title, paper.conference, paper.year, ...paper.datasets.map(d => d.name), ...paper.metrics.map(m => m.name)].join(' '))).includes(normalize(state.q))) return false;
  if (state.quality && paper.quality !== state.quality) return false;
  if (omit !== 'conferences' && state.conferences.length && !state.conferences.includes(paper.conference)) return false;
  if (omit !== 'years' && state.years.length && !state.years.includes(String(paper.year))) return false;
  const datasets = paper.datasets.filter(d => !state.role || d.role === state.role);
  if (state.role && !datasets.length) return false;
  if (omit !== 'datasets' && state.datasets.length && !datasets.some(d => state.datasets.includes(d.name))) return false;
  if (omit !== 'metrics' && state.metrics.length && !paper.metrics.some(m => state.metrics.includes(m.name))) return false;
  return true;
}
export function filterPapers(papers, state) {
  return papers.filter(p => matches(p, state)).sort((a, b) => {
    if (state.sort === 'title') return a.title.localeCompare(b.title, 'en');
    return (state.sort === 'oldest' ? a.year - b.year : b.year - a.year) || a.title.localeCompare(b.title, 'en');
  });
}
export function facetCounts(papers, state, group) {
  const counts = new Map();
  for (const p of papers.filter(p => matches(p, state, group))) {
    const values = group === 'conferences' ? [p.conference] : group === 'years' ? [String(p.year)] : group === 'datasets' ? p.datasets.filter(d => !state.role || state.role === d.role).map(d => d.name) : p.metrics.map(m => m.name);
    for (const value of new Set(values)) counts.set(value, (counts.get(value) || 0) + 1);
  }
  return counts;
}
export function readState(search, papers) {
  const params = new URLSearchParams(search), state = emptyState();
  state.q = (params.get('q') || '').slice(0, 300);
  const allowed = {conferences: new Set(papers.map(p => p.conference)), years: new Set(papers.map(p => String(p.year))), datasets: new Set(papers.flatMap(p => p.datasets.map(d => d.name))), metrics: new Set(papers.flatMap(p => p.metrics.map(m => m.name)))};
  for (const group of Object.keys(allowed)) state[group] = [...new Set(params.getAll(group))].filter(v => allowed[group].has(v));
  if (Object.hasOwn(ROLES, params.get('role'))) state.role = params.get('role');
  if (Object.hasOwn(QUALITIES, params.get('quality'))) state.quality = params.get('quality');
  if (['newest', 'oldest', 'title'].includes(params.get('sort'))) state.sort = params.get('sort');
  const page = Number(params.get('page'));
  state.page = Number.isSafeInteger(page) && page > 0 ? page : 1;
  return state;
}
export function stateSearch(state) {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  for (const group of ['conferences','years','datasets','metrics']) for (const value of state[group]) params.append(group, value);
  if (state.role) params.set('role', state.role);
  if (state.quality) params.set('quality', state.quality);
  if (state.sort !== 'newest') params.set('sort', state.sort);
  if (state.page > 1) params.set('page', state.page);
  return params.toString();
}
export function csvText(papers) {
  const cell = value => '"' + String(value).replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""') + '"';
  const rows = [['论文名称','会议','年份','数据集','实验指标','论文页面','PDF下载链接','提取状态'], ...papers.map(p => [p.title,p.conference,p.year,p.datasets.map(d => `${d.name} (${ROLES[d.role]})`).join('; '),p.metrics.map(m => m.name).join('; '),p.paperUrl,p.pdfUrl,QUALITIES[p.quality] || '历史样本'])];
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
}
