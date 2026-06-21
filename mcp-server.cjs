#!/usr/bin/env node

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

const API_ORIGIN = 'https://api.github.com';
const GITHUB_ORIGIN = 'https://github.com';

async function readToken() {
  const home = os.homedir();
  const candidates = [
    path.join(home, 'AppData', 'Roaming', 'gitora', 'github-session'),
    path.join(home, 'AppData', 'Local', 'gitora', 'github-session'),
    path.join(home, '.gitora', 'github-session'),
  ];

  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, 'utf8');
      const trimmed = raw.trim();
      if (trimmed) return trimmed;
    } catch {}
  }
  throw new Error('GitHub token not found. Open Gitora and login first.');
}

async function githubFetch(endpoint, token) {
  const response = await fetch(`${API_ORIGIN}${endpoint}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'Gitora-MCP',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || `GitHub API: ${response.status}`);
  }

  return response.json();
}

const server = new McpServer({
  name: 'gitora',
  version: '0.1.4',
});

server.tool(
  'list_repos',
  'List user GitHub repositories',
  {
    sort: z.enum(['updated', 'created', 'pushed', 'full_name']).optional()
      .describe('Sort order (default: updated)'),
  },
  async ({ sort }) => {
    const token = await readToken();
    const repos = await githubFetch(
      `/user/repos?per_page=100&sort=${sort || 'updated'}`,
      token
    );
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(repos.map(repo => ({
          name: repo.name,
          full_name: repo.full_name,
          private: repo.private,
          description: repo.description,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          language: repo.language,
          updated_at: repo.updated_at,
          url: repo.html_url,
        })), null, 2),
      }],
    };
  }
);

server.tool(
  'get_commits',
  'Get commit history for a repository',
  {
    owner: z.string().describe('Repository owner (user or organization)'),
    repo: z.string().describe('Repository name'),
    branch: z.string().optional().describe('Branch name (default: default branch)'),
    limit: z.number().min(1).max(100).optional()
      .describe('Number of commits to return (default: 30, max: 100)'),
  },
  async ({ owner, repo, branch, limit }) => {
    const token = await readToken();
    const params = new URLSearchParams({ per_page: String(limit || 30) });
    if (branch) params.set('sha', branch);
    const commits = await githubFetch(
      `/repos/${owner}/${repo}/commits?${params}`,
      token
    );
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(commits.map(c => ({
          sha: c.sha,
          short_sha: c.sha.slice(0, 7),
          message: c.commit.message.split('\n')[0],
          full_message: c.commit.message,
          author: c.author?.login || c.commit.author.name,
          date: c.commit.author.date,
          url: c.html_url,
          parents: c.parents.map(p => p.sha),
        })), null, 2),
      }],
    };
  }
);

server.tool(
  'get_branches',
  'List branches in a repository',
  {
    owner: z.string().describe('Repository owner'),
    repo: z.string().describe('Repository name'),
  },
  async ({ owner, repo }) => {
    const token = await readToken();
    const branches = await githubFetch(
      `/repos/${owner}/${repo}/branches?per_page=100`,
      token
    );
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(branches.map(b => ({
          name: b.name,
          tip_sha: b.commit.sha,
          is_default: b.name === 'main' || b.name === 'master',
          url: `${GITHUB_ORIGIN}/${owner}/${repo}/tree/${b.name}`,
        })), null, 2),
      }],
    };
  }
);

server.tool(
  'get_commit_detail',
  'Get detailed commit information including file changes',
  {
    owner: z.string().describe('Repository owner'),
    repo: z.string().describe('Repository name'),
    sha: z.string().describe('Commit SHA'),
  },
  async ({ owner, repo, sha }) => {
    const token = await readToken();
    const commit = await githubFetch(
      `/repos/${owner}/${repo}/commits/${sha}`,
      token
    );
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          sha: commit.sha,
          short_sha: commit.sha.slice(0, 7),
          message: commit.commit.message,
          author: commit.author?.login || commit.commit.author.name,
          date: commit.commit.author.date,
          url: commit.html_url,
          stats: commit.stats,
          files: (commit.files || []).map(f => ({
            name: f.filename,
            status: f.status,
            additions: f.additions,
            deletions: f.deletions,
            changes: f.changes,
          })),
        }, null, 2),
      }],
    };
  }
);

server.tool(
  'search_commits',
  'Search commits by message or author',
  {
    owner: z.string().describe('Repository owner'),
    repo: z.string().describe('Repository name'),
    query: z.string().describe('Search query (matches commit message)'),
    limit: z.number().min(1).max(50).optional()
      .describe('Max results (default: 10)'),
  },
  async ({ owner, repo, query, limit }) => {
    const token = await readToken();
    const result = await githubFetch(
      `/repos/${owner}/${repo}/commits?per_page=100`,
      token
    );
    const q = query.toLowerCase();
    const matched = result.filter(c =>
      c.commit.message.toLowerCase().includes(q)
      || (c.author?.login || '').toLowerCase().includes(q)
      || c.commit.author.name.toLowerCase().includes(q)
    ).slice(0, limit || 10);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(matched.map(c => ({
          sha: c.sha,
          short_sha: c.sha.slice(0, 7),
          message: c.commit.message.split('\n')[0],
          author: c.author?.login || c.commit.author.name,
          date: c.commit.author.date,
          url: c.html_url,
        })), null, 2),
      }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Gitora MCP server running on stdio');
}

main().catch(err => {
  console.error('MCP server error:', err);
  process.exit(1);
});