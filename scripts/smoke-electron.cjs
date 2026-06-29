const { app, BrowserWindow, ipcMain } = require('electron');
const os = require('os');
const path = require('path');

app.setPath('userData', path.join(os.tmpdir(), `gitora-smoke-${process.pid}`));

const user = { login: 'smoke-user', name: 'Smoke User', avatar_url: '' };
const repo = {
  id: 1,
  name: 'smoke-repo',
  full_name: 'smoke-user/smoke-repo',
  private: false,
  description: '',
  stargazers_count: 0,
  forks_count: 0,
  updated_at: '2026-06-21T12:00:00Z',
};
const commit = (sha, message, date, parents) => ({
  sha,
  commit: { message, author: { name: 'Smoke User', date } },
  author: { login: 'smoke-user', avatar_url: '' },
  parents: parents.map(parent => ({ sha: parent })),
});

ipcMain.handle('github:restore-session', async () => ({ success: true, data: user }));
ipcMain.handle('github:login', async () => ({ success: false, error: 'Disabled in smoke test' }));
ipcMain.handle('github:logout', async () => ({ success: true, data: null }));
ipcMain.handle('github:repos', async () => ({ success: true, data: [repo] }));
ipcMain.handle('github:repository', async () => ({
  success: true,
  data: {
    branches: [{ name: 'main', commit: { sha: 'third' } }],
    commits: [
      commit('third', 'Third commit', '2026-06-21T12:00:00Z', ['second']),
      commit('second', 'Second commit', '2026-06-21T11:00:00Z', ['first']),
      commit('first', 'First commit', '2026-06-21T10:00:00Z', []),
    ],
  },
}));
ipcMain.handle('github:create-repo', async () => ({ success: false, error: 'Disabled in smoke test' }));
ipcMain.handle('github:create-release', async () => ({ success: false, error: 'Disabled in smoke test' }));
ipcMain.handle('open-external', async () => ({ success: false, error: 'Disabled in smoke test' }));
ipcMain.handle('app:get-current-version', async () => ({ success: true, data: 'smoke' }));
ipcMain.handle('app:get-releases', async () => ({ success: true, data: [] }));
ipcMain.handle('app:download-release', async () => ({ success: false, error: 'Disabled in smoke test' }));
ipcMain.handle('app:download-archive', async () => ({ success: false, error: 'Disabled in smoke test' }));
ipcMain.handle('app:select-release-asset', async () => ({ success: true, data: null }));

app.whenReady().then(async () => {
  const errors = [];
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, '../electron/preload.cjs'),
    },
  });

  window.webContents.on('console-message', (details) => {
    if (details.level === 'error') errors.push(details.message);
  });

  try {
    await window.loadFile(path.join(__dirname, '../dist/index.html'));
    const state = await window.webContents.executeJavaScript(`
      (async () => {
        const deadline = Date.now() + 5000;
        while (!document.querySelector('button[aria-label^="Third commit"]') && Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 25));
        }
        const node = document.querySelector('button[aria-label^="Third commit"]');
        const graphSvg = [...document.querySelectorAll('svg')].find(svg => svg.getAttribute('width') === '800');
        const edge = graphSvg?.querySelector('path');
        const nodeRect = node?.getBoundingClientRect();
        const svgRect = graphSvg?.getBoundingClientRect();
        const edgeStart = edge?.getPointAtLength(0);
        const alignmentError = nodeRect && svgRect && edgeStart
          ? Math.hypot(
              nodeRect.left + nodeRect.width / 2 - (svgRect.left + edgeStart.x),
              nodeRect.top + nodeRect.height / 2 - (svgRect.top + edgeStart.y)
            )
          : null;
        node?.click();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const panel = document.querySelector('aside[aria-label]');
        const panelBeforeScroll = panel?.getBoundingClientRect();
        window.scrollTo(0, Math.min(500, document.documentElement.scrollHeight));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const panelAfterScroll = panel?.getBoundingClientRect();
        const panelStaysVisible = Boolean(
          panelBeforeScroll
          && panelAfterScroll
          && panelAfterScroll.top >= 65
          && panelAfterScroll.bottom <= innerHeight + 1
          && panelAfterScroll.top <= panelBeforeScroll.top
        );
        return {
        title: document.title,
        rootChildren: document.querySelector('#root')?.childElementCount ?? 0,
        hasGitora: document.body.innerText.toLowerCase().includes('gitora'),
        graphVisible: Boolean(node && edge),
        alignmentError,
        panelStaysVisible,
        panelBeforeTop: panelBeforeScroll?.top ?? null,
        panelAfterTop: panelAfterScroll?.top ?? null
        };
      })()
    `);

    if (
      !state.rootChildren
      || !state.hasGitora
      || !state.graphVisible
      || state.alignmentError === null
      || state.alignmentError > 0.5
      || !state.panelStaysVisible
      || errors.length
    ) {
      throw new Error(JSON.stringify({ state, errors }));
    }
    console.log(JSON.stringify(state));
    app.exit(0);
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
});
