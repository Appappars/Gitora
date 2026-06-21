export interface Project {
  id: string;
  name: string;
  repo: string;
  color: string;
  commits: number;
  branches: number;
  updated: string;
}

export interface Commit {
  id: string;
  x: number;
  y: number;
  lane: number;
  row: number;
  branch: string;
  label: string;
  author: string;
  time: string;
  hash: string;
  text: string;
  files: number;
  plus: number;
  minus: number;
  merge?: boolean;
  current?: boolean;
  parents: string[];
}

export interface Branch {
  name: string;
  color: string;
  tipSha: string;
}

export interface GitHubUser {
  login: string;
  name: string;
  avatar_url: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  author: {
    login: string;
    avatar_url: string;
  } | null;
  parents: { sha: string }[];
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
  };
}

export interface GitHubApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface RepositoryData {
  commits: GitHubCommit[];
  branches: GitHubBranch[];
}

export interface ReleaseAsset {
  name: string;
  size: number;
  downloadUrl: string;
  downloadCount: number;
}

export interface Release {
  tag: string;
  name: string;
  body: string;
  publishedAt: string;
  prerelease: boolean;
  assets: ReleaseAsset[];
}

export interface ElectronAPI {
  github: {
    login: (token: string) => Promise<GitHubApiResult<GitHubUser>>;
    restoreSession: () => Promise<GitHubApiResult<GitHubUser | null>>;
    logout: () => Promise<GitHubApiResult<null>>;
    getRepos: () => Promise<GitHubApiResult<GitHubRepo[]>>;
    getRepository: (owner: string, repo: string) => Promise<GitHubApiResult<RepositoryData>>;
    createRepo: (
      name: string,
      description: string,
      isPrivate: boolean,
    ) => Promise<GitHubApiResult<GitHubRepo>>;
  };
  app: {
    getCurrentVersion: () => Promise<GitHubApiResult<string>>;
    getReleases: () => Promise<GitHubApiResult<Release[]>>;
    downloadRelease: (url: string, fileName: string) => Promise<GitHubApiResult<string>>;
    downloadArchive: (owner: string, repo: string, sha: string) => Promise<GitHubApiResult<string>>;
  };
  openExternal: (url: string) => Promise<GitHubApiResult<null>>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
