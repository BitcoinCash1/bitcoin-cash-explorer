#!/usr/bin/env python3
"""Exercise the repository's actual Nginx location files in an isolated container."""
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

root = Path(__file__).resolve().parents[2]
image = os.environ.get('NGINX_TEST_IMAGE', 'nginx:stable-alpine')
files = ['location-api.conf', 'location-api-v1-services.conf',
         'location-testnet4-api.conf', 'location-scalenet-api.conf', 'location-chipnet-api.conf']
locations = '\n'.join((root / 'production/nginx' / file).read_text() for file in files)
zones = sorted(set(re.findall(r'proxy_cache\s+([\w]+);', locations)))
variables = ['bchExplorerMainnet', 'bchExplorerServices', 'bchExplorerTestnet4',
             'bchExplorerScalenet', 'bchExplorerChipnet']
cors = sorted(set(re.findall(r'\$(cors_\w+)', locations)))
config = '''events {}\nhttp {
  access_log off;
  map $arg_trusted $mempool_external { default 1; 1 0; }
'''
config += '\n'.join(f'proxy_cache_path /tmp/{zone} keys_zone={zone}:1m;' for zone in zones)
config += '\nserver { listen 8081; location / { return 204; } }\nserver { listen 8080;\n'
config += '\n'.join(f'set ${name} http://127.0.0.1:8081;' for name in variables)
config += '\n' + '\n'.join(f'set ${name} "";' for name in cors)
config += '\n' + locations + '\nlocation / { return 204; }\n}\n}\n'

def docker(*args):
    return subprocess.check_output(['docker', *args], text=True).strip()

def status(base, path):
    try:
        with urlopen(base + path, timeout=3) as response:
            return response.status
    except HTTPError as error:
        return error.code

with tempfile.TemporaryDirectory(prefix='bch-nginx-') as directory:
    path = Path(directory) / 'nginx.conf'
    path.write_text(config)
    mount = f'{path}:/etc/nginx/nginx.conf:ro'
    docker('run', '--rm', '-v', mount, '--entrypoint', 'nginx', image, '-t')
    container = docker('run', '-d', '--rm', '-v', mount, '-p', '127.0.0.1::8080',
                       '--entrypoint', 'nginx', image, '-g', 'daemon off;')
    try:
        port = json.loads(docker('inspect', container))[0]['NetworkSettings']['Ports']['8080/tcp'][0]['HostPort']
        base = f'http://127.0.0.1:{port}'
        for attempt in range(30):
            try:
                if status(base, '/') == 204:
                    break
            except (URLError, ConnectionError):
                pass
            time.sleep(0.1)
        checks = 0
        for network, denied in [('', 403), ('/testnet4', 404), ('/scalenet', 404), ('/chipnet', 404)]:
            for suffix in ['/api/internal/probe', '/api/v1/internal/probe']:
                canonical = network + suffix
                for path_variant in [canonical, canonical.upper(), canonical.replace('internal', 'InTeRnAl')]:
                    actual = status(base, path_variant)
                    assert actual == denied, (path_variant, actual, denied)
                    checks += 1
            assert status(base, network + '/api/v1/blocks') == 204
            checks += 1
        for path_variant in ['/api/v1/services/internal/probe', '/API/V1/SERVICES/INTERNAL/probe',
                             '/api/v1/services/InTeRnAl/probe']:
            assert status(base, path_variant) == 403
            checks += 1
        for path_variant in ['/api/internal/probe?trusted=1', '/api/v1/internal/probe?trusted=1',
                             '/api/v1/services/health']:
            assert status(base, path_variant) == 204
            checks += 1
        print(f'Passed {checks} actual Nginx request checks across all BCH networks and services')
    finally:
        docker('stop', container)
