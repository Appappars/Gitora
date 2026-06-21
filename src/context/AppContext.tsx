import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Branch,
  Commit,
  GitHubCommit,
  GitHubRepo,
  GitHubUser,
  Project,
} from '../types';
import { computeGraphLayout, GraphLayoutResult } from '../lib/graphLayout';

interface AppState {
  project: Project | null;
  selectedCommit: Commit | null;
  branchFilter: string;
  mobileOpen: boolean;
  createOpen: boolean;
  loginOpen: boolean;
  toast: string;
  projects: Project[];
  commits: Commit[];
  branches: Branch[];
  user: GitHubUser | null;
  connected: boolean;
  loading: boolean;
  error: string | null;
  graphLayout: GraphLayoutResult | null;
}

interface AppContextType extends AppState {
  setProject: (project: Project | null) => void;
  setSelectedCommit: (commit: Commit | null) => void;
  setBranchFilter: (filter: string) => void;
  setMobileOpen: (open: boolean) => void;
  setCreateOpen: (open: boolean) => void;
  setLoginOpen: (open: boolean) => void;
  notify: (text: string) => void;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  createRepo: (name: string, description: string, isPrivate: boolean) => Promise<boolean>;
  openExternal: (url: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);
const PROJECT_COLORS = ['#AEA989', '#8E7CA3', '#C58C75', '#5D7659'];
const BRANCH_COLORS = ['#261732', '#C58C75', '#8E7CA3', '#5D7659', '#AEA989', '#A26E60'];

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};

function mapProjects(repos: GitHubRepo[]): Project[] {
  return repos.map((repo, index) => ({
    id: String(repo.id),
    name: repo.name,
    repo: repo.full_name,
    color: PROJECT_COLORS[index % PROJECT_COLORS.length],
    commits: 0,
    branches: 0,
    updated: new Date(repo.updated_at).toLocaleDateString('ru-RU'),
  }));
}

function mapCommits(data: GitHubCommit[], layout: GraphLayoutResult): Commit[] {
  const commitBySha = new Map(data.map(commit => [commit.sha, commit]));
  return layout.nodes.map((node, index) => ({
    id: node.sha,
    x: node.x,
    y: node.y,
    lane: node.lane,
    row: node.row,
    branch: node.branch,
    label: node.message,
    author: node.author,
    time: node.date,
    hash: node.sha.slice(0, 7),
    text: commitBySha.get(node.sha)?.commit.message ?? node.message,
    files: 0,
    plus: 0,
    minus: 0,
    merge: node.isMerge,
    current: index === 0,
    parents: node.parents,
  }));
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [project, setProject] = useState<Project | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null);
  const [branchFilter, setBranchFilter] = useState('all');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [graphLayout, setGraphLayout] = useState<GraphLayoutResult | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const requestId = useRef(0);
  const initialized = useRef(false);

  const notify = (text: string) => {
    window.clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = window.setTimeout(() => setToast(''), 2600);
  };

  const showError = (message?: string) => {
    setError(message || 'Неизвестная ошибка');
    window.setTimeout(() => setError(null), 5000);
  };

  const loadRepos = async () => {
    const result = await window.electronAPI?.github.getRepos();
    if (!result?.success || !result.data) {
      showError(result?.error || 'Не удалось загрузить репозитории');
      return;
    }
    const nextProjects = mapProjects(result.data);
    setProjects(nextProjects);
    setProject(current => current
      ? nextProjects.find(item => item.id === current.id) ?? nextProjects[0] ?? null
      : nextProjects[0] ?? null);
  };

  const login = async (token: string) => {
    if (!window.electronAPI) {
      showError('Авторизация доступна в приложении Gitora');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await window.electronAPI.github.login(token);
    if (result.success && result.data) {
      setUser(result.data);
      setConnected(true);
      setLoginOpen(false);
      await loadRepos();
    } else {
      showError(result.error || 'Не удалось подключить GitHub');
    }
    setLoading(false);
  };

  const logout = async () => {
    await window.electronAPI?.github.logout();
    requestId.current += 1;
    setConnected(false);
    setUser(null);
    setProjects([]);
    setProject(null);
    setCommits([]);
    setBranches([]);
    setSelectedCommit(null);
    setGraphLayout(null);
    notify('GitHub отключён');
  };

  const createRepo = async (name: string, description: string, isPrivate: boolean) => {
    setLoading(true);
    try {
      const result = await window.electronAPI?.github.createRepo(name, description, isPrivate);
      if (!result?.success) {
        showError(result?.error || 'Не удалось создать репозиторий');
        return false;
      }
      notify(`Проект «${name}» создан в GitHub`);
      await loadRepos();
      return true;
    } finally {
      setLoading(false);
    }
  };

  const openExternal = async (url: string) => {
    const result = await window.electronAPI?.openExternal(url);
    if (!result?.success) showError(result?.error || 'Не удалось открыть ссылку');
  };

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const restore = async () => {
      if (!window.electronAPI) {
        setLoginOpen(true);
        return;
      }
      setLoading(true);
      const result = await window.electronAPI.github.restoreSession();
      if (result.success && result.data) {
        setUser(result.data);
        setConnected(true);
        await loadRepos();
      } else {
        setLoginOpen(true);
      }
      setLoading(false);
    };
    void restore();
    return () => window.clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    if (!project || !connected || !window.electronAPI) return;
    const currentRequest = ++requestId.current;
    const [owner, repo] = project.repo.split('/');
    setLoading(true);
    setError(null);
    setBranchFilter('all');
    setSelectedCommit(null);
    setGraphLayout(null);
    setCommits([]);
    setBranches([]);

    void window.electronAPI.github.getRepository(owner, repo).then(result => {
      if (currentRequest !== requestId.current) return;
      if (!result.success || !result.data) {
        showError(result.error || 'Не удалось загрузить репозиторий');
        return;
      }

      const repository = result.data;
      const nextBranches = repository.branches.map((branch, index): Branch => ({
        name: branch.name,
        tipSha: branch.commit.sha,
        color: branch.name === 'main' || branch.name === 'master'
          ? '#261732'
          : BRANCH_COLORS[(index + 1) % BRANCH_COLORS.length],
      }));
      const layout = computeGraphLayout(repository.commits, nextBranches);
      setBranches(nextBranches);
      setGraphLayout(layout);
      setCommits(mapCommits(repository.commits, layout));
      setProjects(current => current.map(item => (
        item.id === project.id
          ? { ...item, commits: repository.commits.length, branches: nextBranches.length }
          : item
      )));
    }).finally(() => {
      if (currentRequest === requestId.current) setLoading(false);
    });
  }, [project?.id, connected]);

  return (
    <AppContext.Provider value={{
      project,
      selectedCommit,
      branchFilter,
      mobileOpen,
      createOpen,
      loginOpen,
      toast,
      projects,
      commits,
      branches,
      user,
      connected,
      loading,
      error,
      graphLayout,
      setProject,
      setSelectedCommit,
      setBranchFilter,
      setMobileOpen,
      setCreateOpen,
      setLoginOpen,
      notify,
      login,
      logout,
      createRepo,
      openExternal,
    }}>
      {children}
    </AppContext.Provider>
  );
};
