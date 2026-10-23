"""Build the portable website catalog from its frozen source snapshot (stdlib only)."""
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]


def build():
    selection = json.loads((ROOT / 'source/selection.json').read_text())
    links = json.loads((ROOT / 'source/links.json').read_text())
    papers = []
    for key in selection['papers']:
        path = ROOT / 'source/records' / (key.replace('/', '__') + '.json')
        raw = path.read_bytes()
        rec = json.loads(raw)
        assert rec['paper'] == key and rec['status'] == 'ok'
        assert rec['datasets'] and rec['metrics']
        match = re.fullmatch(r'(CVPR|ICCV|ICLR)(\d{4})', rec['venue'])
        assert match, rec['venue']
        link = links[key]
        for name in ('pdf_url', 'paper_url'):
            parsed = urlparse(link[name])
            assert parsed.scheme == 'https' and parsed.netloc in ('openaccess.thecvf.com', 'openreview.net')
        papers.append({
            'id': hashlib.sha256(key.encode()).hexdigest()[:16],
            'title': rec['title'], 'conference': match[1], 'year': int(match[2]),
            'datasets': rec['datasets'], 'metrics': rec['metrics'], 'notes': rec['notes'],
            'pdfUrl': link['pdf_url'], 'paperUrl': link['paper_url'],
            'source': {'paper': key, 'kind': rec['text_source'], 'sha256': hashlib.sha256(raw).hexdigest()},
        })
    assert len(papers) == 205 and len({p['id'] for p in papers}) == 205
    papers.sort(key=lambda p: (-p['year'], p['conference'], p['title'].casefold()))
    catalog = {'schemaVersion': 1, 'snapshot': '2026-10-23', 'total': len(papers),
               'scope': '205 篇已提取到数据集和指标的会议论文；当前为样本库。', 'papers': papers}
    (ROOT / 'data/papers.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
    print(f'Built {len(papers)} papers, {len({d["name"] for p in papers for d in p["datasets"]})} datasets, '
          f'{len({m["name"] for p in papers for m in p["metrics"]})} metrics.')


if __name__ == '__main__':
    build()
