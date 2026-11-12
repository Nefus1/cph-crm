#!/usr/bin/env python3
"""CPH folder connector. Outbound HTTPS only; no local web server or shell commands."""
import argparse
import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import stat
import time
import urllib.error
import urllib.request
from urllib.parse import urlparse
import uuid

MARKER = '.cph-matter.json'

class SetupError(Exception):
    pass

def _reparse(path):
    return path.is_symlink() or bool(getattr(path.lstat(), 'st_file_attributes', 0) & getattr(stat, 'FILE_ATTRIBUTE_REPARSE_POINT', 0x400))

def safe_path(root, relative):
    if not isinstance(relative, str) or not relative or '\\' in relative:
        raise SetupError('invalid_path')
    parts = relative.split('/')
    for part in parts:
        stem = part.split('.')[0].upper()
        if (not part or part in ('.', '..') or part[-1] in '. ' or
            any(c in '<>:"|?*' or ord(c) < 32 for c in part) or
            stem in {'CON', 'PRN', 'AUX', 'NUL'} or
            stem in {f'{p}{i}' for p in ('COM', 'LPT') for i in range(1, 10)}):
            raise SetupError('invalid_path')
    target = root.joinpath(*parts)
    cursor = root
    for part in parts:
        cursor = cursor / part
        if cursor.exists() or cursor.is_symlink():
            if _reparse(cursor):
                raise SetupError('invalid_path')
    if not target.resolve().is_relative_to(root.resolve()):
        raise SetupError('invalid_path')
    return target

def create_case(base, payload):
    base = Path(base)
    # Never recreate a missing sync root on an unavailable drive.
    if not base.is_dir() or _reparse(base):
        raise SetupError('root_unavailable')
    if os.path.normcase(os.path.normpath(str(base))) != os.path.normcase(os.path.normpath(payload['root'])):
        raise SetupError('invalid_path')
    matter_id = str(uuid.UUID(payload['matterId']))
    target = safe_path(base, payload['relativePath'])
    if len(payload['relativePath'].split('/')) != 1:
        raise SetupError('invalid_path')
    folders = payload['folders']
    files = payload['files']
    if len(folders) > 100 or len(files) > 50 or MARKER in files:
        raise SetupError('invalid_path')
    for rel in [*folders, *files]:
        safe_path(target, rel)
    try:
        target.mkdir()
        created = True
    except FileExistsError:
        created = False
    marker = safe_path(target, MARKER)
    identity = {'matterId': matter_id, 'templateVersion': payload['templateVersion']}
    if created:
        # An incomplete marker fails closed on retry rather than adopting an unknown folder.
        with marker.open('x', encoding='utf-8') as stream:
            json.dump(identity, stream)
            stream.flush()
            os.fsync(stream.fileno())
    else:
        try:
            if json.loads(marker.read_text(encoding='utf-8')) != identity:
                raise SetupError('folder_collision')
        except (OSError, ValueError):
            raise SetupError('folder_collision') from None
    for rel in folders:
        safe_path(target, rel).mkdir(parents=True, exist_ok=True)
    for rel, content in files.items():
        path = safe_path(target, rel)
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with path.open('x', encoding='utf-8') as stream:
                stream.write(content)
        except FileExistsError:
            if not path.is_file():
                raise SetupError('folder_collision') from None
    return target

class Connector:
    def __init__(self, config):
        parsed = urlparse(config['crm_url'])
        if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError('crm_url must be an HTTPS URL')
        self.url = config['crm_url'].rstrip('/')
        self.root = config['base_cases_dir']
        self.token = config['token']
        if len(self.token) != 64 or any(c not in '0123456789abcdef' for c in self.token):
            raise ValueError('Invalid connector token')
        # Never forward the device credential through a redirect.
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, headers, newurl):
                return None
        self.opener = urllib.request.build_opener(NoRedirect())

    def call(self, operation, data=None):
        request = urllib.request.Request(self.url + '/api/connector/' + operation,
            data=json.dumps(data or {}).encode(),
            headers={'Authorization': 'Bearer ' + self.token, 'Content-Type': 'application/json'}, method='POST')
        with self.opener.open(request, timeout=30) as response:
            return json.load(response)

    def tick(self):
        self.call('heartbeat')
        job = self.call('claim').get('job')
        if not job:
            return
        result = {'id': job['id'], 'leaseToken': job['leaseToken']}
        try:
            create_case(self.root, job['payload'])
        except SetupError as exc:
            result['error'] = str(exc)
        except PermissionError:
            result['error'] = 'permission_denied'
        except Exception:
            result['error'] = 'connector_error'
        self.call('failure' if 'error' in result else 'complete', result)
        logging.info('Job %s: %s', job['id'], result.get('error', 'complete'))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', default=str(Path(__file__).with_name('config.json')))
    parser.add_argument('--once', action='store_true')
    args = parser.parse_args()
    config_path = Path(args.config).resolve()
    handler = RotatingFileHandler(config_path.with_name('connector.log'), maxBytes=1_000_000, backupCount=3, encoding='utf-8')
    logging.basicConfig(level=logging.INFO, handlers=[handler], format='%(asctime)s %(message)s')
    worker = Connector(json.loads(config_path.read_text(encoding='utf-8')))
    failures = 0
    while True:
        try:
            worker.tick()
            failures = 0
        except urllib.error.HTTPError as exc:
            logging.warning('Connection HTTP status: %s', exc.code)
            if exc.code == 401:
                raise SystemExit('Connector revoked or token invalid. Register it again in CRM settings.') from None
            failures += 1
        except Exception:
            # No client details, file paths, or credentials in network error logs.
            logging.warning('CRM unavailable; retrying')
            failures += 1
        if args.once:
            return
        time.sleep(min(300, 15 * 2 ** min(failures, 5)))

if __name__ == '__main__':
    main()
