const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  github: {
    login: (token) => ipcRenderer.invoke('github:login', token),
    restoreSession: () => ipcRenderer.invoke('github:restore-session'),
    logout: () => ipcRenderer.invoke('github:logout'),
    getRepos: () => ipcRenderer.invoke('github:repos'),
    getRepository: (owner, repo) => ipcRenderer.invoke('github:repository', { owner, repo }),
    createRepo: (name, description, isPrivate, folderPath) =>
      ipcRenderer.invoke('github:create-repo', { name, description, private: isPrivate, folderPath }),
  },
  app: {
    getCurrentVersion: () => ipcRenderer.invoke('app:get-current-version'),
    getReleases: () => ipcRenderer.invoke('app:get-releases'),
    downloadRelease: (url, fileName) => ipcRenderer.invoke('app:download-release', { url, fileName }),
    downloadArchive: (owner, repo, sha) => ipcRenderer.invoke('app:download-archive', { owner, repo, sha }),
    selectUploadFolder: () => ipcRenderer.invoke('app:select-upload-folder'),
    clearUploadFolder: () => ipcRenderer.invoke('app:clear-upload-folder'),
  },
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
});