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
    deleteRepo: (owner, repo) => ipcRenderer.invoke('github:delete-repo', { owner, repo }),
    updateRepo: (owner, repo, data) => ipcRenderer.invoke('github:update-repo', { owner, repo, data }),
    createBranch: (owner, repo, name, fromSha) => ipcRenderer.invoke('github:create-branch', { owner, repo, name, fromSha }),
    deleteBranch: (owner, repo, branch) => ipcRenderer.invoke('github:delete-branch', { owner, repo, branch }),
    renameBranch: (owner, repo, branch, newName) => ipcRenderer.invoke('github:rename-branch', { owner, repo, branch, newName }),
    getPullRequests: (owner, repo, state) => ipcRenderer.invoke('github:pull-requests', { owner, repo, state }),
    getPullRequest: (owner, repo, number) => ipcRenderer.invoke('github:pull-request', { owner, repo, number }),
    createPullRequest: (owner, repo, title, body, head, base) => ipcRenderer.invoke('github:create-pull-request', { owner, repo, title, body, head, base }),
    getIssues: (owner, repo, state) => ipcRenderer.invoke('github:issues', { owner, repo, state }),
    getIssue: (owner, repo, number) => ipcRenderer.invoke('github:issue', { owner, repo, number }),
    createIssue: (owner, repo, title, body, labels) => ipcRenderer.invoke('github:create-issue', { owner, repo, title, body, labels }),
    searchCommits: (owner, repo, query, author, since, until) => ipcRenderer.invoke('github:search-commits', { owner, repo, query, author, since, until }),
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