#!/usr/bin/env python3
"""Erzeugt sw.js mit der aktuellen Dateiliste und einer neuen Version.
Aufruf im Kiosk-Ordner:  python3 tools/build-sw.py"""
import glob, os, hashlib, json
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
files = ['./', 'index.html', 'manifest.webmanifest', 'css/explorer.css', 'css/kiosk.css', 'js/explorer.js', 'js/kiosk.js',
         'icon-180.png', 'icon-192.png', 'icon-512.png', 'assets/fonts/SuisseIntl-Regular-WebS.woff2', 'assets/fonts/SuisseIntl-Bold-WebS.woff2', 'assets/fonts/SuisseIntl-Medium-WebS.woff2',
         ]
files += sorted(glob.glob('assets/intro/1920/*.avif')) + sorted(glob.glob('assets/intro/1920/*.jpg')) + sorted(glob.glob('assets/video/*.mp4'))
files += sorted(glob.glob('assets/video/*.avif')) + sorted(glob.glob('assets/video/*.jpg'))
h = hashlib.sha1()
for f in files:
    if f != './': h.update(open(f, 'rb').read())
version = 'explorer-' + h.hexdigest()[:8]
tpl = open('tools/sw.template.js', encoding='utf-8').read()
open('sw.js', 'w', encoding='utf-8').write(tpl.replace('__VERSION__', version).replace('__PRECACHE__', json.dumps(files, indent=1)))
print(f'sw.js geschrieben: {version}, {len(files)} Dateien')
