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

// Снимок всего экрана Windows — чтобы при сбое увидеть окно или сообщение об ошибке
function desktopShot(file) {
  const ps = `Add-Type -AssemblyName System.Windows.Forms,System.Drawing;` +
    `$b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds;` +
    `$bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height;` +
    `$g=[System.Drawing.Graphics]::FromImage($bmp);$g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size);` +
    `$bmp.Save('${file}')`;
  try { execSync(`powershell -NoProfile -Command "${ps}"`); } catch (e) { console.log('Снимок экрана не удался:', e.message); }
}

function processes() {
  try {
    return execSync('tasklist /FO CSV /NH', { encoding: 'utf8' })
      .split('\n').filter((l) => /Zametno|msedgewebview2/i.test(l))
      .map((l) => l.split('","')[0].replace('"', '')).join(', ') || 'нет';
  } catch { return '?'; }
}

async function launch() {
  const child = spawn(exe, [], {
    env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9222' },
    detached: true,
    stdio: 'ignore',
  });
  child.on('exit', (code) => console.log('Процесс программы завершился, код:', code));
  child.unref();
  let last = '';
  for (let i = 1; i <= 90; i++) {
    await sleep(1000);
    try {
      const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
      last = JSON.stringify(targets.map((t) => ({ type: t.type, url: t.url })));
      const page = targets.find((t) => t.type === 'page' && /tauri/.test(t.url));
      if (page) { console.log(`Окно найдено через ${i} с:`, page.url); return page; }
    } catch (e) { last = 'отладка не отвечает: ' + e.message; }
    if (i % 10 === 0) console.log(`${i} с — процессы: ${processes()}; отладка: ${last}`);
  }
  desktopShot('win-0-desktop.png');
  throw new Error('Окно программы не появилось за 90 секунд. Последний ответ отладки: ' + last);
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
