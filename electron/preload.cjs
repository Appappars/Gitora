const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  github: {
    login: (token) => ipcRenderer.invoke('github:login', token),
    restoreSession: () => ipcRenderer.invoke('github:restore-session'),
    logout: () => ipcRenderer.invoke('github:logout'),
    getRepos: () => ipcRenderer.invoke('github:repos'),
    getRepository: (owner, repo) => ipcRenderer.invoke('github:repository', { owner, repo }),
    createRepo: (name, description, isPrivate) =>
      ipcRenderer.invoke('github:create-repo', { name, description, private: isPrivate }),
  },
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
});
