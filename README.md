# Learning Hub

Оффлайн-сборник тренировочных задач. Плоский список: одна папка, один манифест — без деления на «области». Типы задач: **multiple choice**, **свободный текст**, **сопоставление пар**, **ударения** (новый тип — буквы в квадратиках, над гласными кнопки для выбора ударной), **выбор окончания** (две карточки с двумя формами — выбрать верную).

Чистый HTML / CSS / JS, никакой сборки. Открывается локально (`file://` или через `python3 -m http.server`) и заливается на GitHub Pages как есть.

## Запуск локально

```bash
python3 -m http.server 8000
# открыть http://localhost:8000/
```

Любой статический сервер подойдёт (`npx serve`, `caddy file-server` и т.п.).

## Публикация на GitHub Pages

1. `git init && git add . && git commit -m "feat: learning hub v1"`
2. Создать репозиторий на GitHub.
3. `git remote add origin git@github.com:<user>/<repo>.git && git push -u origin main`
4. Settings → Pages → Branch: `main` / folder: `/` (root).
5. Открыть `https://<user>.github.io/<repo>/`.

Всё, никаких билдов.

## Как добавить задачу

Самый простой способ — сказать Claude Code:

> добавь задание про indefinite articles в английском на A2

Claude подгрузит skill `.claude/skills/add-task/SKILL.md`, прочитает схему, сгенерирует валидный JSON, положит файл в `content/tasks/<slug>.json` и пропатчит `content/tasks/manifest.json`. После `git push` задача появится в хабе.

Можно и вручную:

1. Создать `content/tasks/<slug>.json` по схеме `content/tasks/_schema.json`.
2. Добавить `"<slug>"` в массив `tasks` в `content/tasks/manifest.json`.
3. Сделать commit и push.

Проверить, что всё на месте: открыть `tools/check-manifest.html` в браузере — статическая страница, которая обходит манифест и говорит, какие файлы есть, а каких нет.

## Архитектура

```
index.html              SPA shell (Pico.css + .app обёртка)
assets/js/main.js       bootstrap
assets/js/router.js     hash-router
assets/js/store.js      localStorage namespace + streak
assets/js/engine.js     loadManifest / loadTask / runTask
assets/js/render/*      рендереры по type (multiple-choice, free-text, matching, stress)
assets/js/views/*       страницы: hub, task, progress, about
assets/js/util/*        dom-helper, fetch с no-cache, matcher для free-text
content/tasks/          задачи + manifest.json + _schema.json
.claude/skills/         skills, по которым Claude Code добавляет задачи
tools/check-manifest.html   статический линтер манифеста
```

## Известные ограничения v1

- Drag-and-drop в matching не работает на iOS Safari (тач). Tap-to-select fallback — v2.
- В задачах нельзя вставлять картинки (квота localStorage, риск base64).
- Streak считается по локальной TZ пользователя.
- Пользовательские regex в free-text не поддерживаются — проверка только литералами.