import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyState,filterPapers,facetCounts,readState,stateSearch,csvText} from '../core.js';
const catalog=JSON.parse(readFileSync(new URL('../data/papers.json',import.meta.url)));
const papers=catalog.papers;
const fixture=[
 {id:'a',title:'Alpha Vision',conference:'CVPR',year:2023,datasets:[{name:'COCO',role:'benchmark'},{name:'ImageNet',role:'pretrain'}],metrics:[{name:'AP'}],pdfUrl:'https://example.com/a.pdf',paperUrl:'https://example.com/a'},
 {id:'b',title:'Beta Vision',conference:'ICLR',year:2025,datasets:[{name:'ImageNet',role:'benchmark'}],metrics:[{name:'Accuracy'}],pdfUrl:'https://example.com/b.pdf',paperUrl:'https://example.com/b'},
 {id:'c',title:'Gamma Model',conference:'CVPR',year:2024,datasets:[{name:'COCO',role:'benchmark'}],metrics:[{name:'AP'},{name:'AP'}],pdfUrl:'https://example.com/c.pdf',paperUrl:'https://example.com/c'}
];
test('published snapshot contains unique records with matching lazy evidence',()=>{
 assert.equal(papers.length,catalog.total);assert.ok(papers.length>10000);assert.equal(new Set(papers.map(p=>p.id)).size,papers.length);
 const shards=new Map();
 for(const p of papers){
  assert.ok(p.title&&Array.isArray(p.datasets)&&Array.isArray(p.metrics));
  assert.ok(['validated','needs_review','legacy'].includes(p.quality));
  assert.ok(new URL(p.pdfUrl).protocol==='https:');
  const bucket=p.id.slice(0,2);
  if(!shards.has(bucket))shards.set(bucket,JSON.parse(readFileSync(new URL(`../data/details/${bucket}.json`,import.meta.url))));
  const detail=shards.get(bucket)[p.id];assert.equal(detail.title,p.title);assert.equal(detail.quality,p.quality);
  for(const entry of [...detail.datasets,...detail.metrics]){assert.ok(entry.anchor.trim().length>=15);assert.ok(entry.line>0);}
 }
 assert.ok(papers.some(p=>p.conference==='ECCV'&&p.year===2022));assert.ok(papers.some(p=>p.conference==='NeurIPS'));
});
test('quality filter and URL preserve pending status without treating it as checked',()=>{
 const checked=filterPapers(papers,{...emptyState(),quality:'validated'});
 assert.equal(checked.length,catalog.stateCounts.validated);
 assert.ok(checked.every(p=>p.quality==='validated'));
 assert.equal(readState('?quality=needs_review',papers).quality,'needs_review');
});
test('OR within each group and AND across groups',()=>{
 assert.deepEqual(filterPapers(fixture,{...emptyState(),datasets:['COCO','ImageNet'],metrics:['AP'],conferences:['CVPR'],years:['2023']}).map(p=>p.id),['a']);
 assert.equal(filterPapers(fixture,{...emptyState(),conferences:['CVPR','ICLR']}).length,3);
});
test('dataset role must belong to selected dataset, not another dataset',()=>{
 assert.deepEqual(filterPapers(fixture,{...emptyState(),datasets:['ImageNet'],role:'benchmark'}).map(p=>p.id),['b']);
 assert.deepEqual(filterPapers(fixture,{...emptyState(),datasets:['COCO'],role:'pretrain'}),[]);
});
test('search title, dataset, metric, year, and conference without case sensitivity',()=>{
 assert.equal(filterPapers(fixture,{...emptyState(),q:'alpha vision'}).length,1);
 assert.equal(filterPapers(fixture,{...emptyState(),q:'IMAGENET'}).length,2);
 assert.equal(filterPapers(fixture,{...emptyState(),q:'ap'}).length,2);
 assert.equal(filterPapers(fixture,{...emptyState(),q:'2025'}).length,1);
 assert.equal(filterPapers(fixture,{...emptyState(),q:'CVPR'}).length,2);
});
test('facets count unique papers and respect other filter groups',()=>{
 assert.equal(facetCounts(fixture,emptyState(),'metrics').get('AP'),2);
 assert.equal(facetCounts(fixture,{...emptyState(),years:['2023']},'datasets').get('COCO'),1);
 assert.equal(facetCounts(fixture,{...emptyState(),datasets:['ImageNet']},'datasets').get('COCO'),2);
});
test('URL state round-trips special metric names and validates invalid values',()=>{
 const s={...emptyState(),datasets:[papers[0].datasets[0].name],metrics:[papers[0].metrics[0].name],years:[String(papers[0].year)],q:'J&F / 3D',sort:'title',page:2};
 assert.deepEqual(readState(stateSearch(s),papers),s);
 assert.deepEqual(readState('?years=1999&datasets=fake&page=NaN&sort=unknown&role=fake',papers),emptyState());
});
test('sorting orders are stable by year and title',()=>{
 assert.deepEqual(filterPapers(fixture,emptyState()).map(p=>p.id),['b','c','a']);
 assert.deepEqual(filterPapers(fixture,{...emptyState(),sort:'oldest'}).map(p=>p.id),['a','c','b']);
 assert.deepEqual(filterPapers(fixture,{...emptyState(),sort:'title'}).map(p=>p.id),['a','b','c']);
});
test('CSV preserves commas, quotes, Unicode, all rows and protects formula cells',()=>{
 const csv=csvText([{...fixture[0],title:'=SUM(1,2) "论文"'}]);
 assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=SUM(1,2) ""论文"""'));assert.equal(csv.split('\r\n').length,2);
 assert.equal(csvText(papers).split('\r\n').length,papers.length+1);
});
