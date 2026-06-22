const { app, BrowserWindow, ipcMain, safeStorage, shell, dialog } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const ignore = require('ignore');

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

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_TOTAL_SIZE = 1024 * 1024 * 1024;
const ALWAYS_EXCLUDED = new Set(['.git', 'node_modules', '.DS_Store', 'Thumbs.db']);
const EXCLUDED_PATTERNS = ['.env', '.env.*', '*.pem', '*.key', '*.p12', '*.pfx'];

let selectedUploadFolder = null;

async function readGitignore(dirPath) {
  const ig = ignore();
  try {
    const content = await fs.readFile(path.join(dirPath, '.gitignore'), 'utf8');
    ig.add(content.split('\n').filter(line => line.trim() && !line.startsWith('#')));
  } catch {}
  for (const pattern of EXCLUDED_PATTERNS) {
    ig.add(pattern);
  }
  return ig;
}

async function scanFolder(dirPath, ig, rootPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];
  const warnings = [];
  let totalBytes = 0;

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (ALWAYS_EXCLUDED.has(entry.name)) continue;
      if (ig.ignores(relativePath + '/') || ig.ignores(entry.name)) continue;

      try {
        const stat = await fs.lstat(fullPath);
        if (stat.isSymbolicLink()) {
          warnings.push(`Symlink пропущен: ${relativePath}`);
          continue;
        }
      } catch { continue; }

      const sub = await scanFolder(fullPath, ig, rootPath);
      files.push(...sub.files);
      totalBytes += sub.totalBytes;
      warnings.push(...sub.warnings);
    } else {
      if (ig.ignores(relativePath) || ig.ignores(entry.name)) continue;

      try {
        const stat = await fs.lstat(fullPath);
        if (stat.isSymbolicLink()) {
          warnings.push(`Symlink пропущен: ${relativePath}`);
          continue;
        }
        if (stat.size > MAX_FILE_SIZE) {
          warnings.push(`Файл >100 МБ пропущен: ${relativePath}`);
          continue;
        }
        totalBytes += stat.size;
        if (totalBytes > MAX_TOTAL_SIZE) {
          warnings.push(`Общий размер превышает 1 ГБ`);
        }
        files.push({ relativePath, fullPath, size: stat.size });
      } catch { continue; }
    }
  }

  return { files, totalBytes, warnings };
}

async function scanUploadFolder(dirPath) {
  const ig = await readGitignore(dirPath);
  const { files, totalBytes, warnings } = await scanFolder(dirPath, ig, dirPath);
  return { path: dirPath, fileCount: files.length, totalBytes, warnings, files };
}

async function uploadFolderToRepo(owner, repo, folderData) {
  const { files } = folderData;
  if (files.length === 0) return { uploadedCount: 0, skippedCount: 0, status: 'success' };

  const blobShaMap = new Map();
  let uploadedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    try {
      const content = await fs.readFile(file.fullPath);
      const encoding = 'base64';
      const blob = await githubRequest(`/repos/${owner}/${repo}/blobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.toString('base64'),
          encoding,
        }),
      });
      blobShaMap.set(file.relativePath, blob.sha);
      uploadedCount++;
    } catch {
      skippedCount++;
    }
  }

  const treeItems = [];
  for (const [filePath, sha] of blobShaMap) {
    treeItems.push({ path: filePath, mode: '100644', type: 'blob', sha });
  }

  if (treeItems.length === 0) {
    return { uploadedCount, skippedCount, status: 'error' };
  }

  const tree = await githubRequest(`/repos/${owner}/${repo}/trees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tree: treeItems }),
  });

  const commit = await githubRequest(`/repos/${owner}/${repo}/commits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Initial commit',
      tree: tree.sha,
    }),
  });

  await githubRequest(`/repos/${owner}/${repo}/git/refs/heads/main`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: commit.sha, force: true }),
  });

  const status = skippedCount > 0 ? 'partial' : 'success';
  return { uploadedCount, skippedCount, status };
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
  const repo = await githubRequest('/user/repos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      description: typeof input.description === 'string' ? input.description.trim() : '',
      private: Boolean(input.private),
    }),
  });

  const folderPath = typeof input?.folderPath === 'string' ? input.folderPath.trim() : '';
  if (!folderPath) {
    return { repo, uploadStatus: 'none', uploadedCount: 0, skippedCount: 0 };
  }

  const folderData = await scanUploadFolder(folderPath);
  if (folderData.files.length === 0) {
    return { repo, uploadStatus: 'none', uploadedCount: 0, skippedCount: 0 };
  }

  try {
    const [owner] = repo.full_name.split('/');
    const uploadResult = await uploadFolderToRepo(owner, repo.name, folderData);
    return { repo, ...uploadResult };
  } catch (uploadError) {
    return { repo, uploadStatus: 'error', uploadedCount: 0, skippedCount: folderData.fileCount };
  }
}));

ipcMain.handle('app:select-upload-folder', result(async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Выберите папку проекта',
  });

  if (result.canceled || result.filePaths.length === 0) return null;

  const dirPath = result.filePaths[0];
  const folderData = await scanUploadFolder(dirPath);
  selectedUploadFolder = folderData;
  return { path: folderData.path, fileCount: folderData.fileCount, totalBytes: folderData.totalBytes, warnings: folderData.warnings };
}));

ipcMain.handle('app:clear-upload-folder', result(async () => {
  selectedUploadFolder = null;
  return null;
}));

ipcMain.handle('open-external', result(async (_event, url) => {
  if (!isAllowedExternal(url)) throw new Error('Разрешены только ссылки github.com');
  await shell.openExternal(url);
  return null;
}));

ipcMain.handle('app:get-current-version', result(async () => {
  return app.getVersion();
}));

ipcMain.handle('app:get-releases', result(async () => {
  const releases = await githubRequest('/repos/Appappars/Gitora/releases?per_page=20');
  return releases.map(release => ({
    tag: release.tag_name,
    name: release.name,
    body: release.body,
    publishedAt: release.published_at,
    prerelease: release.prerelease,
    assets: release.assets.map(asset => ({
      name: asset.name,
      size: asset.size,
      downloadUrl: asset.browser_download_url,
      downloadCount: asset.download_count,
    })),
  }));
}));

ipcMain.handle('app:download-release', result(async (_event, { url, fileName }) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Не удалось скачать файл');

  const downloadsPath = app.getPath('downloads');
  const filePath = path.join(downloadsPath, fileName);

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(filePath, buffer);

  return filePath;
}));

ipcMain.handle('app:download-archive', result(async (_event, { owner, repo, sha }) => {
  if (!validRepo(owner, repo)) throw new Error('Некорректное имя репозитория');

  const url = `${GITHUB_ORIGIN}/${owner}/${repo}/archive/${sha}.zip`;
  const response = await fetch(url, {
    headers: githubToken ? { Authorization: `Bearer ${githubToken}` } : {},
  });

  if (!response.ok) throw new Error('Не удалось скачать архив');

  const fileName = `${repo}-${sha.slice(0, 7)}.zip`;
  const downloadsPath = app.getPath('downloads');
  const filePath = path.join(downloadsPath, fileName);

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(filePath, buffer);

  return filePath;
}));
