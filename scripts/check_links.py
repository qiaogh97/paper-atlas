"""Read-only external PDF link check; record failures without changing source data."""
import concurrent.futures
import datetime
import json
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def check(paper):
    result = {'id': paper['id'], 'title': paper['title'], 'url': paper['pdfUrl']}
    try:
        request = urllib.request.Request(paper['pdfUrl'], method='HEAD', headers={'User-Agent': 'PaperAtlas-LinkCheck/1.0'})
        with urllib.request.urlopen(request, timeout=18) as response:
            result.update(status=response.status, content_type=response.headers.get('Content-Type', ''), final_url=response.url)
            result['ok'] = response.status == 200 and 'pdf' in response.headers.get('Content-Type', '').lower()
    except (urllib.error.URLError, OSError) as error:
        result.update(ok=False, status=getattr(error, 'code', None), error=str(error))
    return result


if __name__ == '__main__':
    papers = json.loads((ROOT / 'data/papers.json').read_text())['papers']
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        results = list(pool.map(check, papers))
    output = {'checked_at': datetime.datetime.now().isoformat(), 'total': len(results), 'ok': sum(r['ok'] for r in results), 'results': results}
    (ROOT / 'qa/link-check.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    print(f'PDF links: {output["ok"]}/{len(results)} returned HTTP 200 with PDF content type')
    for result in results:
        if not result['ok']:
            print(result['status'], result['title'], result.get('error',result.get('content_type')))
