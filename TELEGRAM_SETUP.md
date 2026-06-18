# Telegram-напоминания — настройка

Бот присылает сообщение в Telegram, если по бассейну давно не было измерений или записей о химии/работах.

## Как это работает

1. На сайте нажимаете **«Подключить Telegram»** → открывается бот → **Start**
2. Выбираете интервал (3–30 дней) и время (например 09:00)
3. Включаете напоминания
4. Раз в час сервер проверяет: если пора — бот пишет в Telegram

---

## Шаг 1 — Создать бота

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Команда `/newbot`
3. Имя: `Учёт бассейна` (любое)
4. Username: например `PoolEyesKyiv_bot` (должен заканчиваться на `_bot`)
5. **Сохраните токен** — строка вида `7123456789:AAH...`

---

## Шаг 2 — SQL в Supabase

**SQL Editor** → выполните файл `supabase/telegram.sql`

---

## Шаг 3 — Edge Functions (серверная часть)

Нужен [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
cd "/Users/macbook/Desktop/проэкт"
supabase login
supabase link --project-ref kmqsoinofupuqzdttnbm
```

### Секреты (Project Settings → Edge Functions → Secrets)

| Секрет | Значение |
|--------|----------|
| `TELEGRAM_BOT_TOKEN` | токен от BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | любая случайная строка (например UUID) |
| `CRON_SECRET` | другая случайная строка |

`SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` Supabase подставляет автоматически.

### Деплой функций

```bash
supabase functions deploy telegram-webhook --no-verify-jwt
supabase functions deploy send-reminders --no-verify-jwt
```

### Webhook для Telegram

Подставьте свой токен и секрет:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -d "url=https://kmqsoinofupuqzdttnbm.supabase.co/functions/v1/telegram-webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Проверка:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

---

## Шаг 4 — Расписание (cron)

Функция `send-reminders` должна вызываться **каждый час** (проверяет локальное время пользователя).

### Вариант A — cron-job.org (проще)

1. Зарегистрируйтесь на [cron-job.org](https://cron-job.org)
2. Новая задача: **Every hour**
3. URL: `https://kmqsoinofupuqzdttnbm.supabase.co/functions/v1/send-reminders`
4. Method: **POST**
5. Header: `Authorization: Bearer <CRON_SECRET>`

### Вариант B — pg_cron в Supabase

Если включено расширение `pg_cron` и `pg_net`:

```sql
select cron.schedule(
  'pool-telegram-reminders',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://kmqsoinofupuqzdttnbm.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ВАШ_CRON_SECRET',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

---

## Шаг 5 — config.js на сайте

Добавьте имя бота **без @**:

```js
const TELEGRAM_BOT_USERNAME = 'PoolEyesKyiv_bot';
```

Загрузите на GitHub: `config.js`, `index.html`, `app.js`, `supabase-db.js`, `styles.css`

---

## Шаг 6 — Проверка

1. Войдите на сайт
2. Раздел **Telegram-напоминания** → **Подключить Telegram**
3. В боте нажмите **Start** → должно прийти «Готово, … Telegram подключён»
4. На сайте **Проверить подключение**
5. Интервал **3 дня**, время **текущий час + 1**, включите напоминания → **Сохранить**
6. Дождитесь часа или вызовите cron вручную:

```bash
curl -X POST "https://kmqsoinofupuqzdttnbm.supabase.co/functions/v1/send-reminders" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

---

## Команды бота

| Команда | Действие |
|---------|----------|
| `/status` | Текущие настройки напоминаний |
| `/help` | Справка |

---

## Частые проблемы

**«Telegram-бот ещё не настроен»** — не указан `TELEGRAM_BOT_USERNAME` в `config.js`

**Бот не отвечает на Start** — webhook не установлен или неверный `TELEGRAM_WEBHOOK_SECRET`

**Напоминания не приходят** — не настроен cron, не включены напоминания на сайте, или недавно уже было измерение/запись

**Ошибка при сохранении настроек** — не выполнен `supabase/telegram.sql`
