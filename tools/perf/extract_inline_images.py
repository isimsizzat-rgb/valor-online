"""Move base64 images embedded in index.html and asset JS files into real image files.

Each embedded image becomes assets/img/<hash>.<ext> (identical images share one file) and the
source text points at that file instead, so images load only when shown and are cached.
PNG/JPEG are re-encoded to WebP (q90) when that is at least 20% smaller.
Usage (repo root): python3 tools/perf/extract_inline_images.py
"""
import base64, hashlib, io, os, re, sys, urllib.parse
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'img')
MIN_LEN = 4000
EXT = {'png': 'png', 'jpeg': 'jpg', 'jpg': 'jpg', 'webp': 'webp', 'gif': 'gif', 'svg+xml': 'svg'}
PAT = re.compile(r'data:image/(png|jpe?g|webp|gif|svg\+xml)(;base64)?,([A-Za-z0-9+/=%]+)')
os.makedirs(OUT, exist_ok=True)
stats = {'files': 0, 'images': 0, 'unique': set(), 'before': 0, 'after': 0}

def store(mime, data):
    ext = EXT[mime]
    if ext in ('png', 'jpg'):
        try:
            im = Image.open(io.BytesIO(data))
            buf = io.BytesIO()
            im.save(buf, 'WEBP', quality=90, method=6) if im.mode in ('RGB', 'RGBA', 'P', 'LA', 'L') else None
            if buf.tell() and buf.tell() < len(data) * 0.8:
                data, ext = buf.getvalue(), 'webp'
        except Exception:
            pass
    name = hashlib.sha1(data).hexdigest()[:16] + '.' + ext
    path = os.path.join(OUT, name)
    if not os.path.exists(path):
        open(path, 'wb').write(data)
        stats['after'] += len(data)
    stats['unique'].add(name)
    return name

def replace_in(path):
    s = open(path, encoding='utf-8').read()
    rel_dir = os.path.relpath(os.path.join(ROOT, 'assets', 'img'), os.path.dirname(path)) if path.endswith('.css') else 'assets/img'
    changed = False
    def sub(m):
        nonlocal changed
        if len(m.group(0)) < MIN_LEN: return m.group(0)
        mime, b64, payload = m.group(1), m.group(2), m.group(3)
        data = base64.b64decode(payload + '=' * (-len(payload) % 4)) if b64 else urllib.parse.unquote(payload).encode('utf-8')
        stats['images'] += 1; stats['before'] += len(m.group(0)); changed = True
        return rel_dir.replace(os.sep, '/') + '/' + store(mime, data)
    s2 = PAT.sub(sub, s)
    if changed:
        open(path, 'w', encoding='utf-8').write(s2); stats['files'] += 1
    return changed

if __name__ == '__main__':
    targets = [os.path.join(ROOT, 'index.html')] + [os.path.join(d, f) for d, _, fs in os.walk(os.path.join(ROOT, 'assets')) for f in fs if f.endswith(('.js', '.css', '.html'))]
    changed = [os.path.relpath(t, ROOT) for t in targets if replace_in(t)]
    print('files changed:', len(changed))
    for c in changed: print('  ', c)
    print('images replaced: %d, unique files: %d, embedded text %.1f MB -> image files %.1f MB' % (stats['images'], len(stats['unique']), stats['before'] / 1e6, stats['after'] / 1e6))
