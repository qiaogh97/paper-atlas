import { ROLES, normalize, emptyState, filterPapers, facetCounts, readState, stateSearch, csvText } from './core.js';

const $ = selector => document.querySelector(selector);
const PAGE_SIZE = 12;
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let papers = [], state = emptyState(), results = [], toastTimer;
const facetSearch = { datasets: '', metrics: '' };
const dom = { list: $('#paper-list'), count: $('#result-count'), pagination: $('#pagination'), dialog: $('#paper-dialog'), content: $('#dialog-content') };

function badge(paper) { return `<span class="venue-badge" data-venue="${paper.conference}">${paper.conference}</span><span>${paper.year}</span>`; }
function tag(name, group, extra = '') { return `<button class="tag ${extra}" data-group="${group}" data-value="${escape(name)}" title="筛选 ${escape(name)}">${escape(name)}</button>`; }
function renderTags(values, group, limit) {
  const names = [...new Set(values.map(item => item.name))];
  return names.slice(0, limit).map(name => tag(name, group, group === 'metrics' ? 'metric' : '')).join('') + (names.length > limit ? `<button class="tag more-tag" data-more>+${names.length - limit}</button>` : '');
}
function card(paper, index) {
  return `<article class="paper-card" data-id="${paper.id}"><div class="paper-meta">${badge(paper)}<span class="meta-separator">●</span><span>${paper.source.kind==='cache'?'仅缓存来源':'会议论文'}</span><span class="paper-index">${String(index + 1).padStart(3,'0')}</span></div><h4><button class="title-button" data-detail>${escape(paper.title)}</button></h4><div class="tag-row"><span class="tag-label">数据集</span><div class="tags">${renderTags(paper.datasets,'datasets',6)}</div></div><div class="tag-row"><span class="tag-label">实验指标</span><div class="tags">${renderTags(paper.metrics,'metrics',7)}</div></div><div class="card-bottom"><button class="evidence-button" data-detail><span aria-hidden="true">✓</span> 查看提取证据</button><div class="paper-links"><a class="paper-page" href="${escape(paper.paperUrl)}" target="_blank" rel="noopener noreferrer">论文原文 ↗</a><a class="pdf-link" href="${escape(paper.pdfUrl)}" target="_blank" rel="noopener noreferrer" aria-label="下载 PDF：${escape(paper.title)}">下载 PDF ↓</a></div></div></article>`;
}
function options(group, search = '') {
  const counts = facetCounts(papers, state, group);
  const all = group === 'conferences' ? ['CVPR','ICCV','ICLR'] : group === 'years' ? ['2026','2025','2024','2023'] : [...new Set(papers.flatMap(p => group === 'datasets' ? p.datasets.map(d => d.name) : p.metrics.map(m => m.name)))];
  if (group === 'datasets' || group === 'metrics') all.sort((a,b) => Number(state[group].includes(b)) - Number(state[group].includes(a)) || (counts.get(b) || 0) - (counts.get(a) || 0) || a.localeCompare(b,'en'));
  return all.filter(name => !search || normalize(name).includes(normalize(search))).map(name => {
    const selected = state[group].includes(name), count = counts.get(name) || 0, disabled = !count && !selected;
    const input = `<input type="checkbox" data-group="${group}" value="${escape(name)}" ${selected?'checked':''} ${disabled?'disabled':''}>`;
    return group === 'years' ? `<label class="year-option">${input}<span>${escape(name)}</span></label>` : `<label class="facet-option ${disabled?'is-disabled':''}">${input}<span class="facet-name">${escape(name)}</span><span class="facet-count">${count}</span></label>`;
  }).join('') || '<p class="facet-empty">没有匹配的名称</p>';
}
function renderFacets() {
  for (const [group,id] of [['conferences','conference'],['years','year'],['datasets','dataset'],['metrics','metric']]) {
    const element = $(`#${id}-options`), top = element.scrollTop;
    element.innerHTML = options(group, facetSearch[group] || '');
    element.scrollTop = top;
  }
  $('#role').value = state.role;
}
function renderActive() {
  const chips = [];
  if (state.q) chips.push(`<button class="filter-chip" data-remove="q">搜索：${escape(state.q)}<span>×</span></button>`);
  for (const group of ['conferences','years','datasets','metrics']) for (const value of state[group]) chips.push(`<button class="filter-chip" data-remove="${group}" data-value="${escape(value)}">${escape(value)}<span>×</span></button>`);
  if (state.role) chips.push(`<button class="filter-chip" data-remove="role">${ROLES[state.role]}<span>×</span></button>`);
  $('#active-filters').innerHTML = chips.join('');
}
function renderPagination() {
  const pages = Math.ceil(results.length / PAGE_SIZE);
  if (pages <= 1) { dom.pagination.innerHTML = ''; return; }
  const visible = new Set([1,pages,state.page-1,state.page,state.page+1]);
  let html = `<button data-page="${state.page-1}" ${state.page===1?'disabled':''} aria-label="上一页">←</button>`, last = 0;
  for (const page of [...visible].filter(n => n>=1 && n<=pages).sort((a,b)=>a-b)) {
    if (last && page-last>1) html += '<span aria-hidden="true">…</span>';
    html += `<button data-page="${page}" class="${page===state.page?'current':''}" ${page===state.page?'aria-current="page"':''} aria-label="第 ${page} 页">${page}</button>`; last=page;
  }
  html += `<button data-page="${state.page+1}" ${state.page===pages?'disabled':''} aria-label="下一页">→</button><span class="page-info">第 ${state.page} / ${pages} 页 · 每页 ${PAGE_SIZE} 篇</span>`;
  dom.pagination.innerHTML = html;
}
function render({historyMode = 'push', scroll = false} = {}) {
  results = filterPapers(papers,state);
  state.page = Math.min(state.page,Math.max(1,Math.ceil(results.length/PAGE_SIZE)));
  $('#query').value = state.q; $('#sort').value = state.sort;
  dom.count.innerHTML = `找到 <strong>${results.length}</strong> 篇论文 <span>/ ${papers.length} 篇</span>`;
  const start = (state.page-1)*PAGE_SIZE;
  dom.list.innerHTML = results.length ? results.slice(start,start+PAGE_SIZE).map((p,i)=>card(p,start+i)).join('') : '<div class="empty-state"><div class="empty-icon">⌕</div><h4>暂时没有匹配的论文</h4><p>试试减少筛选条件，或换一个数据集、指标名称。</p><button data-clear>清除全部筛选</button></div>';
  renderFacets(); renderActive(); renderPagination();
  $('#export-button').disabled = !results.length;
  const query = stateSearch(state), url = location.pathname + (query?'?'+query:'') + location.hash;
  if (historyMode === 'replace') history.replaceState(null,'',url);
  else if (historyMode === 'push' && url !== location.pathname+location.search+location.hash) history.pushState(null,'',url);
  if (scroll) $('#results').scrollIntoView({behavior:'smooth',block:'start'});
}
function update(patch, resetPage = true) { Object.assign(state,patch); if(resetPage) state.page=1; render(); }
function toggle(group,value) { update({[group]:state[group].includes(value)?state[group].filter(v=>v!==value):[...state[group],value]}); }
function clear() {
  state=emptyState();facetSearch.datasets='';facetSearch.metrics='';$('#dataset-search').value='';$('#metric-search').value='';render();
}
function evidence(item, dataset) {
  return `<div class="evidence-item"><strong>${escape(item.name)}</strong>${dataset?`<span class="role-badge">${ROLES[item.role]}</span>`:''}<details><summary>查看原文证据${item.line?' · 第 '+item.line+' 行':''}</summary><blockquote>${escape(item.anchor)}</blockquote></details></div>`;
}
function showPaper(id) {
  const paper=papers.find(p=>p.id===id); if(!paper)return;
  $('#dialog-label').textContent='论文详情 · 数据集与指标';
  dom.content.innerHTML=`<div class="dialog-body"><div class="paper-meta">${badge(paper)}</div><h2 id="dialog-title">${escape(paper.title)}</h2><div class="detail-links"><a href="${escape(paper.pdfUrl)}" target="_blank" rel="noopener noreferrer">下载 PDF ↓</a><a href="${escape(paper.paperUrl)}" target="_blank" rel="noopener noreferrer">论文原文 ↗</a><button class="outline-button" data-copy="${paper.id}">复制论文链接</button></div><h3>数据集 <span class="facet-count">${paper.datasets.length} 条 · 按用途保留</span></h3>${paper.datasets.map(d=>evidence(d,true)).join('')}<h3>实验指标 <span class="facet-count">${paper.metrics.length} 条</span></h3>${paper.metrics.map(m=>evidence(m,false)).join('')}${paper.notes?`<h3>提取说明</h3><p class="detail-notes">${escape(paper.notes)}</p>`:''}<p>名称与证据保留自本批论文提取结果；行号对应归一化文本。${paper.source.kind==='cache'?'本篇仅有缓存来源，实验信息可能不完整。':''}</p></div>`;
  dom.dialog.showModal();
}
function showAbout() {
  $('#dialog-label').textContent='关于 PaperAtlas';
  dom.content.innerHTML=`<div class="dialog-body"><p class="eyebrow">RESEARCH, CONNECTED.</p><h2 id="dialog-title">让每一条研究线索，都有出处。</h2><p>PaperAtlas 是一个无需注册的论文索引。你可以从数据集与实验指标出发，结合会议和年份，找到与你研究相关的论文。</p><div class="about-grid"><div><strong>205</strong><span>首批论文</span></div><div><strong>2023–2026</strong><span>收录年份</span></div></div><h3>数据与筛选口径</h3><p>当前仅收录首批 205 篇同时提取到数据集和指标的论文，来自 CVPR、ICCV 与 ICLR。它是样本库，不代表这些会议的完整论文集。名称按原始提取结果保留；大小写、缩写与版本写法可能不同，暂未自动合并。</p><p>同一筛选组内采用“或”，不同筛选组之间采用“且”。数据集用途会同时约束所选数据集，例如选择“预训练来源”后，只会匹配被标记为预训练用途的数据集。</p><p>指标是论文层面的名称集合，不表示每一个指标均在每一个数据集上报告；本版不展示分数或构建排行榜。</p><h3>证据与链接</h3><p>详情中的原文片段来自论文提取记录；名称均通过逐字锚点校验，但这不替代人工语义复核。PDF 由 CVF 或 OpenReview 官方站点提供。外部站点可能限制访问。</p><h3>开放使用</h3><p>浏览、筛选、分享筛选地址和导出当前全部匹配结果均无需账户。检索在浏览器本地完成。数据快照：2026-10-23。</p></div>`;
  dom.dialog.showModal();
}
function toast(message) { $('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2500); }

$('#search-form').addEventListener('submit',event=>{event.preventDefault();update({q:$('#query').value.trim()});});
$('#query').addEventListener('input',event=>{state.q=event.target.value;state.page=1;render({historyMode:'replace'});});
$('#reset-filters').addEventListener('click',clear);
$('#sort').addEventListener('change',event=>update({sort:event.target.value}));
$('#role').addEventListener('change',event=>update({role:event.target.value}));
$('#filters').addEventListener('change',event=>{if(event.target.matches('input[data-group]'))toggle(event.target.dataset.group,event.target.value);});
for (const [group,id] of [['datasets','dataset'],['metrics','metric']]) $(`#${id}-search`).addEventListener('input',event=>{facetSearch[group]=event.target.value;$(`#${id}-options`).innerHTML=options(group,event.target.value);});
$('#active-filters').addEventListener('click',event=>{const button=event.target.closest('[data-remove]');if(!button)return;const group=button.dataset.remove;update({[group]:Array.isArray(state[group])?state[group].filter(v=>v!==button.dataset.value):''});});
dom.list.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-clear'))return clear();
  if(button.dataset.group)return toggle(button.dataset.group,button.dataset.value);
  const article=button.closest('[data-id]');if(article)showPaper(article.dataset.id);
});
$('.quick-search').addEventListener('click',event=>{const button=event.target.closest('[data-quick]');if(button)update({q:button.dataset.quick});});
dom.pagination.addEventListener('click',event=>{const button=event.target.closest('[data-page]');if(button&&!button.disabled){state.page=Number(button.dataset.page);render({scroll:true});}});
$('#about-button').addEventListener('click',showAbout);
$('#close-dialog').addEventListener('click',()=>dom.dialog.close());
dom.dialog.addEventListener('click',event=>{if(event.target===dom.dialog){const r=dom.dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dom.dialog.close();}});
dom.content.addEventListener('click',async event=>{const b=event.target.closest('[data-copy]');if(!b)return;try{await navigator.clipboard.writeText(papers.find(p=>p.id===b.dataset.copy).paperUrl);toast('论文链接已复制');}catch{toast('复制未完成，可在「论文原文」上复制链接');}});
$('#mobile-filter').addEventListener('click',()=>{const open=$('#filters').classList.toggle('mobile-open');$('#mobile-filter').setAttribute('aria-expanded',String(open));});
$('#export-button').addEventListener('click',()=>{const blob=new Blob([csvText(results)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`paperatlas-${results.length}-papers.csv`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(`已导出 ${results.length} 篇论文`);});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!dom.dialog.open&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){event.preventDefault();$('#query').focus();}});
window.addEventListener('popstate',()=>{state=readState(location.search,papers);render({historyMode:'none'});});

try {
  const response=await fetch(new URL('./data/papers.json',import.meta.url));if(!response.ok)throw new Error('HTTP '+response.status);
  const data=await response.json();papers=data.papers;if(!papers.length)throw new Error('Empty catalog');
  $('#stat-papers').textContent=papers.length;$('#stat-datasets').textContent=new Set(papers.flatMap(p=>p.datasets.map(d=>d.name))).size;$('#stat-metrics').textContent=new Set(papers.flatMap(p=>p.metrics.map(m=>m.name))).size;
  state=readState(location.search,papers);render({historyMode:'replace'});
} catch(error) {
  dom.count.textContent='论文数据未载入';dom.list.innerHTML='<div class="empty-state"><h4>论文库暂时无法载入</h4><p>请通过本地服务器访问本站，然后刷新重试。</p><button id="reload-page">重新加载</button></div>';$('#reload-page').addEventListener('click',()=>location.reload());console.error(error);
}
