#!/usr/bin/env python3
"""Локальный сервер: статика + авторизация + сброс пароля по email."""

import hashlib
import json
import os
import random
import secrets
import smtplib
import time
from email.mime.text import MIMEText
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

PORT = 8080
BASE_DIR = Path(__file__).parent.resolve()
DATA_DIR = BASE_DIR / 'data'
USERS_FILE = DATA_DIR / 'users.json'
RESET_FILE = DATA_DIR / 'reset_tokens.json'
SMTP_FILE = DATA_DIR / 'smtp.json'

RESET_TTL = 15 * 60  # 15 минут


def ensure_data_dir():
    DATA_DIR.mkdir(exist_ok=True)
    if not USERS_FILE.exists():
        USERS_FILE.write_text('[]', encoding='utf-8')
    if not RESET_FILE.exists():
        RESET_FILE.write_text('{}', encoding='utf-8')


def load_json(path, default):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError):
        return default


def save_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


def normalize_login(login):
    return login.strip().lower()


def hash_password(password, salt):
    raw = (salt + password).encode('utf-8')
    return hashlib.sha256(raw).hexdigest()


def find_user(users, login):
    normalized = normalize_login(login)
    for user in users:
        if user.get('login') == normalized:
            return user
        display = user.get('displayLogin', '')
        if display and normalize_login(display) == normalized:
            return user
    return None


def public_user(user):
    return {
        'id': user['id'],
        'login': user['login'],
        'displayLogin': user.get('displayLogin', user['login']),
        'email': user.get('email', '')
    }


def load_smtp():
    if not SMTP_FILE.exists():
        return None
    try:
        cfg = json.loads(SMTP_FILE.read_text(encoding='utf-8'))
        required = ['host', 'port', 'user', 'password', 'from']
        if all(cfg.get(k) for k in required):
            return cfg
    except (OSError, json.JSONDecodeError):
        pass
    return None


def send_reset_email(to_email, login, code):
    smtp = load_smtp()
    if not smtp:
        return False, None

    body = (
        f'Здравствуйте!\n\n'
        f'Код для сброса пароля в «Учёт параметров бассейна»:\n\n'
        f'  {code}\n\n'
        f'Логин: {login}\n'
        f'Код действует 15 минут.\n\n'
        f'Если вы не запрашивали сброс — просто проигнорируйте это письмо.'
    )
    msg = MIMEText(body, 'plain', 'utf-8')
    msg['Subject'] = 'Сброс пароля — бассейн'
    msg['From'] = smtp['from']
    msg['To'] = to_email

    try:
        with smtplib.SMTP(smtp['host'], int(smtp['port'])) as server:
            if smtp.get('tls', True):
                server.starttls()
            server.login(smtp['user'], smtp['password'])
            server.send_message(msg)
        return True, None
    except Exception as exc:
        return False, str(exc)


def json_response(handler, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Content-Length', str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def read_json_body(handler):
    length = int(handler.headers.get('Content-Length', 0))
    if length <= 0:
        return {}
    raw = handler.rfile.read(length)
    try:
        return json.loads(raw.decode('utf-8'))
    except json.JSONDecodeError:
        return {}


class PoolHandler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f'[{self.log_date_time_string()}] {fmt % args}')

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/health':
            json_response(self, 200, {'ok': True})
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        body = read_json_body(self)

        if path == '/api/register':
            self.handle_register(body)
        elif path == '/api/login':
            self.handle_login(body)
        elif path == '/api/forgot-password':
            self.handle_forgot(body)
        elif path == '/api/reset-password':
            self.handle_reset(body)
        elif path == '/api/migrate-local':
            self.handle_migrate(body)
        elif path == '/api/update-email':
            self.handle_update_email(body)
        else:
            self.send_error(404)

    def handle_register(self, body):
        login = (body.get('login') or '').strip()
        password = body.get('password') or ''
        email = (body.get('email') or '').strip().lower()
        normalized = normalize_login(login)

        if len(normalized) < 3:
            json_response(self, 400, {'ok': False, 'error': 'Логин — минимум 3 символа.'})
            return
        if len(password) < 4:
            json_response(self, 400, {'ok': False, 'error': 'Пароль — минимум 4 символа.'})
            return
        if '@' not in email or len(email) < 5:
            json_response(self, 400, {'ok': False, 'error': 'Укажите корректный email.'})
            return

        users = load_json(USERS_FILE, [])
        if find_user(users, normalized):
            json_response(self, 400, {'ok': False, 'error': 'Такой логин уже занят.'})
            return
        if any(u.get('email', '').lower() == email for u in users):
            json_response(self, 400, {'ok': False, 'error': 'Этот email уже используется.'})
            return

        salt = secrets.token_hex(8)
        user = {
            'id': secrets.token_hex(8),
            'login': normalized,
            'displayLogin': login.strip(),
            'email': email,
            'salt': salt,
            'passwordHash': hash_password(password, salt)
        }
        users.append(user)
        save_json(USERS_FILE, users)
        json_response(self, 200, {'ok': True, 'user': public_user(user)})

    def handle_login(self, body):
        login = body.get('login') or ''
        password = body.get('password') or ''
        users = load_json(USERS_FILE, [])
        user = find_user(users, login)

        if not user:
            json_response(self, 401, {'ok': False, 'error': 'Неверный логин или пароль.'})
            return

        salt = user.get('salt', '')
        valid = hash_password(password, salt) == user.get('passwordHash')
        if not valid and salt:
            valid = hash_password(password, '') == user.get('passwordHash')
        if not valid:
            json_response(self, 401, {'ok': False, 'error': 'Неверный логин или пароль.'})
            return

        json_response(self, 200, {'ok': True, 'user': public_user(user)})

    def handle_forgot(self, body):
        login = body.get('login') or ''
        email = (body.get('email') or '').strip().lower()
        users = load_json(USERS_FILE, [])
        user = find_user(users, login)

        if not user or user.get('email', '').lower() != email:
            json_response(self, 200, {
                'ok': True,
                'message': 'Если логин и email совпадают, код отправлен на почту.'
            })
            return

        code = f'{random.randint(100000, 999999)}'
        tokens = load_json(RESET_FILE, {})
        tokens[user['login']] = {
            'code': code,
            'expires': time.time() + RESET_TTL,
            'email': email
        }
        save_json(RESET_FILE, tokens)

        sent, err = send_reset_email(email, user.get('displayLogin', user['login']), code)
        payload = {
            'ok': True,
            'message': 'Код отправлен на вашу почту. Проверьте входящие и спам.'
        }
        if not sent:
            payload['devMode'] = True
            payload['devCode'] = code
            payload['message'] = (
                'Почта не настроена. Код показан ниже (настройте data/smtp.json для отправки писем).'
            )
            if err:
                payload['smtpError'] = err
        json_response(self, 200, payload)

    def handle_reset(self, body):
        login = body.get('login') or ''
        code = (body.get('code') or '').strip()
        new_password = body.get('newPassword') or ''

        if len(new_password) < 4:
            json_response(self, 400, {'ok': False, 'error': 'Новый пароль — минимум 4 символа.'})
            return

        users = load_json(USERS_FILE, [])
        user = find_user(users, login)
        if not user:
            json_response(self, 400, {'ok': False, 'error': 'Неверный код или логин.'})
            return

        tokens = load_json(RESET_FILE, {})
        token = tokens.get(user['login'])
        if not token or token.get('code') != code or token.get('expires', 0) < time.time():
            json_response(self, 400, {'ok': False, 'error': 'Неверный или просроченный код.'})
            return

        salt = secrets.token_hex(8)
        user['salt'] = salt
        user['passwordHash'] = hash_password(new_password, salt)
        save_json(USERS_FILE, users)
        del tokens[user['login']]
        save_json(RESET_FILE, tokens)
        json_response(self, 200, {'ok': True, 'message': 'Пароль изменён. Теперь можно войти.'})

    def handle_migrate(self, body):
        incoming = body.get('users') or []
        if not isinstance(incoming, list):
            json_response(self, 400, {'ok': False})
            return

        users = load_json(USERS_FILE, [])
        added = 0
        for item in incoming:
            if not isinstance(item, dict) or not item.get('login') or not item.get('passwordHash'):
                continue
            if find_user(users, item['login']):
                continue
            users.append({
                'id': item.get('id') or secrets.token_hex(8),
                'login': normalize_login(item['login']),
                'displayLogin': item.get('displayLogin') or item['login'],
                'email': (item.get('email') or '').lower(),
                'salt': item.get('salt', ''),
                'passwordHash': item['passwordHash']
            })
            added += 1

        save_json(USERS_FILE, users)
        json_response(self, 200, {'ok': True, 'added': added})

    def handle_update_email(self, body):
        user_id = body.get('userId') or ''
        login = body.get('login') or ''
        email = (body.get('email') or '').strip().lower()

        if '@' not in email or len(email) < 5:
            json_response(self, 400, {'ok': False, 'error': 'Укажите корректный email.'})
            return

        users = load_json(USERS_FILE, [])
        user = None
        if user_id:
            user = next((u for u in users if u.get('id') == user_id), None)
        if not user:
            user = find_user(users, login)
        if not user:
            json_response(self, 404, {'ok': False, 'error': 'Пользователь не найден.'})
            return

        if any(u.get('email', '').lower() == email and u.get('id') != user.get('id') for u in users):
            json_response(self, 400, {'ok': False, 'error': 'Этот email уже используется.'})
            return

        user['email'] = email
        save_json(USERS_FILE, users)
        json_response(self, 200, {'ok': True, 'user': public_user(user)})


def main():
    ensure_data_dir()
    os.chdir(BASE_DIR)
    server = ThreadingHTTPServer(('127.0.0.1', PORT), PoolHandler)
    smtp_ok = load_smtp() is not None
    print(f'Сервер запущен: http://localhost:{PORT}')
    print('Не закрывайте это окно. Остановка: Ctrl+C')
    if smtp_ok:
        print('Почта для сброса пароля: настроена (data/smtp.json)')
    else:
        print('Почта не настроена — код сброса показывается на экране.')
        print('Скопируйте data/smtp.json.example → data/smtp.json для отправки писем.')
    server.serve_forever()


if __name__ == '__main__':
    main()
