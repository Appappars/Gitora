const { app, BrowserWindow, ipcMain, safeStorage, shell } = require('electron');
const fs = require('fs/promises');
const path = require('path');

const isDev = process.argv.includes('--dev');
const GITHUB_ORIGIN = 'https://github.com';
const API_ORIGIN = 'https://api.github.com';
const REPO_PART = /^[A-Za-z0-9_.-]+$/;

let mainWindow;
let githubToken = null;

function tokenPath() {
  return path.join(app.getPath('userData'), 'github-session');
}

async function saveToken(token) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Защищённое хранилище ОС недоступно');
  }
  const encrypted = safeStorage.encryptString(token).toString('base64');
  await fs.writeFile(tokenPath(), encrypted, { encoding: 'utf8', mode: 0o600 });
}

async function restoreToken() {
  try {
    const encrypted = await fs.readFile(tokenPath(), 'utf8');
    githubToken = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
    return githubToken;
  } catch {
    githubToken = null;
    return null;
  }
}

async function clearToken() {
  githubToken = null;
  await fs.rm(tokenPath(), { force: true });
}

function githubHeaders(token = githubToken) {
  if (!token) throw new Error('GitHub не подключён');
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': 'Gitora-App',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function githubRequest(endpoint, options = {}, token = githubToken) {
  const response = await fetch(`${API_ORIGIN}${endpoint}`, {
    ...options,
    headers: {
      ...githubHeaders(token),
      ...options.headers,
    },
  });

  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (response.ok) return data;

  const remaining = response.headers.get('x-ratelimit-remaining');
  if (response.status === 403 && remaining === '0') {
    throw new Error('Лимит GitHub API исчерпан. Попробуйте позже');
  }
  throw new Error(data?.message || `GitHub API: ${response.status}`);
}

function validRepo(owner, repo) {
  return REPO_PART.test(owner) && REPO_PART.test(repo);
}

function result(handler) {
  return async (...args) => {
    try {
      return { success: true, data: await handler(...args) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Неизвестная ошибка' };
    }
  };
}

function isAllowedExternal(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' && url.origin === GITHUB_ORIGIN;
  } catch {
    return false;
  }
}

function isAllowedNavigation(rawUrl) {
  if (!isDev) return false;
  try {
    return new URL(rawUrl).origin === 'http://localhost:5173';
  } catch {
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 320,
    minHeight: 560,
    title: 'Gitora',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    backgroundColor: '#261732',
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternal(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url)) event.preventDefault();
  });

  if (isDev) {
    void mainWindow.loadURL('http://localhost:5173');
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await restoreToken();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('github:login', result(async (_event, token) => {
  const cleanToken = typeof token === 'string' ? token.trim() : '';
  if (!cleanToken) throw new Error('Введите GitHub-токен');
  const user = await githubRequest('/user', {}, cleanToken);
  await saveToken(cleanToken);
  githubToken = cleanToken;
  return user;
}));

ipcMain.handle('github:restore-session', result(async () => {
  if (!githubToken) return null;
  try {
    return await githubRequest('/user');
  } catch (error) {
    await clearToken();
    throw error;
  }
}));

ipcMain.handle('github:logout', result(async () => {
  await clearToken();
  return null;
}));

ipcMain.handle('github:repos', result(async () => (
  githubRequest('/user/repos?per_page=100&sort=updated')
)));

ipcMain.handle('github:repository', result(async (_event, { owner, repo }) => {
  if (!validRepo(owner, repo)) throw new Error('Некорректное имя репозитория');
  const [commits, branches] = await Promise.all([
    githubRequest(`/repos/${owner}/${repo}/commits?per_page=50`),
    githubRequest(`/repos/${owner}/${repo}/branches?per_page=100`),
  ]);
  return { commits, branches };
}));

ipcMain.handle('github:create-repo', result(async (_event, input) => {
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  if (!name || !REPO_PART.test(name)) throw new Error('Некорректное имя репозитория');
  return githubRequest('/user/repos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      description: typeof input.description === 'string' ? input.description.trim() : '',
      private: Boolean(input.private),
    }),
  });
}));

ipcMain.handle('open-external', result(async (_event, url) => {
  if (!isAllowedExternal(url)) throw new Error('Разрешены только ссылки github.com');
  await shell.openExternal(url);
  return null;
}));
