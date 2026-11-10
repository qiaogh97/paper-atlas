"""Freeze source-checked extraction records for the public site; corpus stays read-only."""
import collections
import copy
import datetime
import hashlib
import json
from pathlib import Path
import re
import sys
import unicodedata
from urllib.parse import quote, urlparse

SITE=Path(__file__).resolve().parents[1]
WORK=SITE.parent
sys.path.insert(0,str(WORK/'pipeline'))
from validate_records import check
from common import norm

def canonical(record):
    return json.dumps(record,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()

def title_key(value):return re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFKD',value).casefold())

def main():
    corpus=(WORK/'conference_paper').resolve()
    oldlinks=json.loads((SITE/'source/links.json').read_text());linkmap={};titles={}
    for line in (corpus/'iclr_download/ICLR2026_urls.txt').read_text().splitlines():
        if line.startswith('#'):continue
        cells=line.split('\t')
        if len(cells)>=7:linkmap[('ICLR2026',Path(cells[5]).stem)]={'pdf_url':cells[4],'paper_url':cells[4].replace('/pdf?','/forum?'),'mode':'direct'}
    for base in ('eccv_download','neurips_download'):
        for catalog in (corpus/base/'.state').glob('*/catalog.json'):
            for row in json.loads(catalog.read_text()):
                linkmap[(catalog.parent.name,Path(row['filename']).stem)]={'pdf_url':row['pdf_url'],'paper_url':row['paper_url'],'mode':'direct'}
    for path in (WORK/'site_publish_work/20261103').glob('iclr-*-orals-posters.json'):
        year=re.search(r'iclr-(\d{4})',path.name)[1]
        value=json.loads(path.read_text());rows=value.get('results',[]) if isinstance(value,dict) else value
        for row in rows:
            paper_url=row.get('paper_url','')
            pdf=row.get('paper_pdf_url') or row.get('pdf_url') or (paper_url.replace('/forum?','/pdf?') if urlparse(paper_url).hostname=='openreview.net' else None)
            if not pdf or urlparse(pdf).hostname!='openreview.net':continue
            title=row.get('name') or row.get('title') or ''
            titles[('ICLR'+year,title_key(title))]={'pdf_url':pdf,'paper_url':pdf.replace('/pdf?','/forum?'),'mode':'direct'}
    def links(record):
        paper=record['paper'];venue=record['venue'];stem=Path(paper).name
        if paper in oldlinks:return {**oldlinks[paper],'mode':'direct'}
        if (venue,stem) in linkmap:return linkmap[(venue,stem)]
        if venue.startswith(('CVPR','ICCV')):
            if venue.startswith('ICCV'):stem=re.sub(r'^\d+_','',stem)
            base='https://openaccess.thecvf.com/content/'+venue
            return {'pdf_url':base+'/papers/'+quote(stem)+'.pdf','paper_url':base+'/html/'+quote(stem)+'.html','mode':'direct'}
        for candidate in (record['title'],re.sub(r'^\d+_','',stem)):
            if (venue,title_key(candidate)) in titles:return titles[(venue,title_key(candidate))]
        if venue.startswith('ICLR'):
            url='https://openreview.net/search?term='+quote(record['title'])+'&content=all&group=all&source=all'
            return {'paper_url':url,'pdf_url':url,'mode':'search'}
        raise ValueError('No official link mapping')
    published={};excluded=[]
    def accept(record,quality,flags,raw_sha):
        checked=copy.deepcopy(record)
        errors=check(checked,{k:record[k] for k in ('paper','venue','text_source')})
        if errors:raise ValueError('; '.join(errors[:4]))
        published[record['paper']]={'record':checked,'quality':quality,'reviewFlags':flags,'links':links(checked),
            'recordSha256':hashlib.sha256(canonical(checked)).hexdigest(),'originalSha256':raw_sha}
    for paper in json.loads((SITE/'source/selection.json').read_text())['papers']:
        p=SITE/'source/records'/(paper.replace('/','__')+'.json');raw=p.read_bytes()
        try:accept(json.loads(raw),'legacy',[],hashlib.sha256(raw).hexdigest())
        except Exception as exc:excluded.append({'paper':paper,'reason':str(exc)})
    index=(WORK/'qwen_repair/20261028_review/effective_index.jsonl').read_bytes();rows=[json.loads(line) for line in index.splitlines()]
    for i,row in enumerate(rows):
        if row['status'] not in ('validated','needs_review'):continue
        try:
            p=WORK/row['record_path'];raw=p.read_bytes();rec=json.loads(raw);text=norm((WORK/rec['text_path']).read_text())
            if hashlib.sha256(text.encode()).hexdigest()!=row['text_sha256']:raise ValueError('Full source hash changed')
            accept(rec,row['status'],list(dict.fromkeys(row.get('errors',[])+row.get('review_flags',[]))),hashlib.sha256(raw).hexdigest())
        except Exception as exc:excluded.append({'paper':row['paper'],'reason':str(exc)})
        if i%2000==0:print('checked',i,'published',len(published),flush=True)
    destination=SITE/'source/snapshot';destination.mkdir(exist_ok=True);buckets=collections.defaultdict(list)
    for paper,entry in sorted(published.items()):buckets[hashlib.sha256(paper.encode()).hexdigest()[:2]].append(entry)
    chunks=[]
    for bucket,entries in sorted(buckets.items()):
        path=destination/(bucket+'.jsonl');raw=b''.join(json.dumps(x,ensure_ascii=False,separators=(',',':')).encode()+b'\n' for x in entries);path.write_bytes(raw)
        chunks.append({'path':str(path.relative_to(SITE/'source')),'sha256':hashlib.sha256(raw).hexdigest(),'count':len(entries)})
    now=datetime.datetime.now().astimezone()
    meta={'schemaVersion':2,'snapshot':now.date().isoformat(),'snapshotId':now.strftime('%Y%m%dT%H%M%S%z'),'generatedAt':now.isoformat(),
        'total':len(published),'stateCounts':dict(collections.Counter(x['quality'] for x in published.values())),
        'venueCounts':dict(collections.Counter(x['record']['venue'] for x in published.values())),
        'linkModes':dict(collections.Counter(x['links']['mode'] for x in published.values())),
        'inputIndexSha256':hashlib.sha256(index).hexdigest(),'chunks':chunks,'upstreamAttempted':len(rows),
        'upstreamFailed':sum(x['status']=='failed' for x in rows),'excludedRecords':len(excluded),
        'scope':'已处理且具有可校验原文证据的记录；待核结果保留明确标记。'}
    (SITE/'source/snapshot.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
    audit=WORK/'site_publish_work'/meta['snapshotId'];audit.mkdir(parents=True,exist_ok=True)
    (audit/'excluded_records.json').write_text(json.dumps(excluded,ensure_ascii=False,indent=2)+'\n');(audit/'snapshot.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in meta.items() if k!='chunks'},ensure_ascii=False),flush=True)

if __name__=='__main__':main()
