"""Rebuild the portable search index and lazy evidence shards (stdlib only)."""
import collections
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parents[1]
HOSTS={'openaccess.thecvf.com','openreview.net','www.ecva.net','eccv.ecva.net','media.eventhosts.cc','proceedings.neurips.cc','papers.nips.cc'}

def build():
    meta=json.loads((ROOT/'source/snapshot.json').read_text());papers=[];details=collections.defaultdict(dict)
    for chunk in meta['chunks']:
        raw=(ROOT/'source'/chunk['path']).read_bytes()
        assert hashlib.sha256(raw).hexdigest()==chunk['sha256'],'Snapshot shard changed'
        rows=[json.loads(line) for line in raw.splitlines()];assert len(rows)==chunk['count']
        for row in rows:
            rec=row['record'];key=rec['paper'];match=re.fullmatch(r'(CVPR|ICCV|ICLR|ECCV|NeurIPS)(\d{4})',rec['venue'])
            assert match and rec['title'].strip()
            canonical=json.dumps(rec,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
            assert hashlib.sha256(canonical).hexdigest()==row['recordSha256']
            for name in ('pdf_url','paper_url'):
                url=urlparse(row['links'][name]);assert url.scheme=='https' and url.hostname in HOSTS,url
            ident=hashlib.sha256(key.encode()).hexdigest()[:16]
            detail={'id':ident,'title':rec['title'],'conference':match[1],'year':int(match[2]),
                'datasets':rec['datasets'],'metrics':rec['metrics'],'notes':rec['notes'],
                'pdfUrl':row['links']['pdf_url'],'paperUrl':row['links']['paper_url'],'linkMode':row['links']['mode'],
                'quality':row['quality'],'recordStatus':rec['status'],'reviewFlags':row['reviewFlags'],
                'source':{'paper':key,'kind':rec['text_source'],'sha256':row['recordSha256'],'originalSha256':row['originalSha256']}}
            details[ident[:2]][ident]=detail
            papers.append({**{k:detail[k] for k in ('id','title','conference','year','pdfUrl','paperUrl','linkMode','quality','recordStatus')},
                'datasets':[{'name':d['name'],'role':d['role']} for d in rec['datasets']],
                'metrics':[{'name':m['name']} for m in rec['metrics']], 'source':{'kind':rec['text_source']},'warningCount':len(row['reviewFlags'])})
    assert len(papers)==meta['total'] and len({p['id'] for p in papers})==meta['total']
    papers.sort(key=lambda p:(-p['year'],p['conference'],p['title'].casefold()))
    out=ROOT/'data/details';out.mkdir(parents=True,exist_ok=True)
    for bucket,rows in details.items():(out/(bucket+'.json')).write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':'))+'\n')
    catalog={k:v for k,v in meta.items() if k not in ('chunks','inputIndexSha256')};catalog['papers']=papers
    (ROOT/'data/papers.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+'\n')
    print(f'Built {len(papers)} searchable papers and {len(details)} evidence shards.')

if __name__=='__main__':build()
