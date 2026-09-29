// «Заметно» — автоматическая проверка установленной программы для Windows.
// © 2026 Кобызев С. Е. Все права защищены.
//
// Запускает программу с включённой отладкой WebView2, создаёт заметку,
// перезапускает программу и убеждается, что заметка сохранилась.
// Запуск: node check.mjs "C:\...\Zametno.exe"

import { spawn, execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const exe = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  spawn(exe, [], {
    env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9222' },
    detached: true,
    stdio: 'ignore',
  }).unref();
  for (let i = 0; i < 90; i++) {
    await sleep(1000);
    try {
      const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
      const page = targets.find((t) => t.type === 'page' && /tauri/.test(t.url));
      if (page) return page;
    } catch { /* программа ещё запускается */ }
  }
  throw new Error('Окно программы не появилось за 90 секунд');
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    const n = ++id;
    pending.set(n, resolve);
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  return new Promise((resolve) => { ws.onopen = () => resolve({ ws, send }); });
}

async function run(send, expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error('Ошибка на странице: ' + JSON.stringify(r.result.exceptionDetails));
  return r.result.result.value;
}

async function waitReady(send) {
  for (let i = 0; i < 30; i++) {
    const ok = await run(send, "document.readyState === 'complete' && typeof saveBtn !== 'undefined'").catch(() => false);
    if (ok) return;
    await sleep(1000);
  }
  throw new Error('Страница программы не загрузилась');
}

async function screenshot(send, file) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(file, Buffer.from(r.result.data, 'base64'));
}

function close() {
  try { execSync('taskkill /IM Zametno.exe', { stdio: 'ignore' }); } catch { /* уже закрыта */ }
  execSync('powershell -NoProfile -Command "Start-Sleep -Seconds 5"');
  try { execSync('taskkill /IM Zametno.exe /F /T', { stdio: 'ignore' }); } catch { /* уже закрыта */ }
}

// 1. Первый запуск: создаём заметку
let page = await launch();
let { ws, send } = await connect(page.webSocketDebuggerUrl);
await waitReady(send);
const info = await run(send, `({
  title: document.title,
  desktop: !!window.__TAURI__,
  saveCommand: typeof (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke),
  copyright: document.querySelector('.app-footer').innerText.trim()
})`);
console.log('Программа запущена:', JSON.stringify(info));
if (!info.desktop) throw new Error('Страница не видит, что открыта в программе для Windows');

await run(send, "note.value = 'Proverka EXE'; saveBtn.click(); status.textContent");
await sleep(1500);
await screenshot(send, 'win-1-saved.png');
ws.close();
await sleep(3000); // даём браузерному движку записать данные на диск
close();

// 2. Повторный запуск: заметка должна быть на месте
page = await launch();
({ ws, send } = await connect(page.webSocketDebuggerUrl));
await waitReady(send);
const kept = await run(send, "notes.some((n) => n.text === 'Proverka EXE')");
await run(send, "document.querySelector('.list-panel').scrollIntoView()");
await sleep(500);
await screenshot(send, 'win-2-after-restart.png');
await run(send, "themeBtn.click()");
await sleep(500);
await screenshot(send, 'win-3-dark.png');
ws.close();
close();

if (!kept) {
  console.log('ОШИБКА: заметка не найдена после перезапуска программы');
  process.exit(1);
}
console.log('ПРОВЕРКА ПРОЙДЕНА: заметка сохранилась после перезапуска программы');
process.exit(0);
