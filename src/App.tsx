import React from 'react';
import {
  Box,
  ChevronRight,
  Code2,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  History,
  Link2,
  Menu,
} from 'lucide-react';
import { useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Graph } from './components/Graph/Graph';
import { DetailPanel } from './components/DetailPanel/DetailPanel';
import { CreateModal } from './components/Modal/CreateModal';
import { LoginModal } from './components/Modal/LoginModal';
import { UpdatesModal } from './components/Modal/UpdatesModal';
import { Toast } from './components/common/Toast';

export const App: React.FC = () => {
  const {
    project,
    mobileOpen,
    setMobileOpen,
    createOpen,
    loginOpen,
    branchFilter,
    setBranchFilter,
    toast,
    notify,
    loading,
    error,
    user,
    connected,
    projects,
    branches,
    commits,
    setLoginOpen,
    openExternal,
  } = useApp();

  const copyRepositoryUrl = async () => {
    if (!project) return;
    await navigator.clipboard.writeText(`https://github.com/${project.repo}`);
    notify('Ссылка на репозиторий скопирована');
  };

  return (
    <div className="min-h-screen bg-[#F3EFE9] text-[#261732]">
      <Sidebar />

      {mobileOpen && (
        <button
          className="md:hidden fixed inset-0 bg-[rgba(38,23,50,.42)] z-10"
          aria-label="Закрыть меню"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <main className="md:ml-60 min-w-0 min-h-screen flex flex-col">
        <header className="h-[58px] border-b border-[rgba(38,23,50,.12)] flex items-center gap-2 px-3 sm:px-6 bg-[rgba(243,239,233,.92)] backdrop-blur-[14px] sticky top-0 z-10">
          <button
            className="md:hidden w-8 h-8 flex-none grid place-items-center rounded-lg"
            aria-label="Открыть меню"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={21} />
          </button>

          <div className="min-w-0 flex items-center gap-1.5 text-[11px]">
            <span className="text-[#7D7482]">Проекты</span>
            {project && (
              <>
                <ChevronRight size={14} className="flex-none" />
                <b className="truncate">{project.name}</b>
              </>
            )}
          </div>

          <button
            className="ml-auto w-8 h-8 flex-none rounded-full overflow-hidden bg-[#261732] text-[#E7E0D6] text-[9px] font-extrabold grid place-items-center"
            aria-label={connected ? `GitHub: ${user?.login}` : 'Подключить GitHub'}
            onClick={() => !connected && setLoginOpen(true)}
          >
            {user?.avatar_url
              ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              : '??'}
          </button>
        </header>

        {!connected ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 rounded-2xl bg-[#261732] grid place-items-center mx-auto mb-6">
                <GitBranch size={40} className="text-[#E7E0D6]" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-3">Gitora</h1>
              <p className="text-sm text-[#7D7482] leading-relaxed mb-6">
                Визуальный граф истории Git-репозиториев. Подключите GitHub, чтобы видеть коммиты, ветки и слияния в одном месте.
              </p>
              <button
                className="h-11 px-6 bg-[#261732] text-[#E7E0D6] rounded-lg text-sm font-semibold"
                onClick={() => setLoginOpen(true)}
              >
                Подключить GitHub
              </button>
            </div>
          </div>
        ) : !project ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 rounded-2xl bg-[#E7E0D6] grid place-items-center mx-auto mb-4">
                <Box size={32} className="text-[#7D7482]" />
              </div>
              <h2 className="text-xl font-bold mb-2">Нет репозиториев</h2>
              <p className="text-sm text-[#7D7482]">
                {projects.length
                  ? 'Выберите репозиторий в боковой панели.'
                  : 'Создайте новый репозиторий кнопкой в боковой панели.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            <section className="px-4 sm:px-8 py-6 sm:py-8 flex flex-col lg:flex-row lg:justify-between lg:items-end gap-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] text-[#7D7482] font-semibold">
                  <span className="w-[23px] h-[23px] rounded-md bg-[#E7E0D6] grid place-items-center">
                    <Box size={14} />
                  </span>
                  <span className="truncate">{project.repo}</span>
                </div>
                <h1 className="text-[28px] sm:text-[32px] leading-none tracking-tight mt-3 mb-2 truncate">{project.name}</h1>
                <p className="text-[11px] text-[#7D7482]">История проекта и связи между ветками.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="h-[34px] border border-[rgba(38,23,50,.12)] bg-white rounded-lg flex items-center gap-2 px-3 text-[11px] font-semibold"
                  onClick={() => void copyRepositoryUrl()}
                >
                  <Link2 size={17} />
                  Копировать ссылку
                </button>
                <button
                  className="h-[34px] bg-[#261732] text-[#E7E0D6] rounded-lg flex items-center gap-2 px-4 text-[11px] font-semibold"
                  onClick={() => void openExternal(`https://github.com/${project.repo}`)}
                >
                  <Code2 size={17} />
                  GitHub
                  <ExternalLink size={14} />
                </button>
              </div>
            </section>

            <section className="mx-4 sm:mx-8 mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-0 p-4 bg-white rounded-xl border border-[rgba(38,23,50,.12)]">
              {[
                [<GitCommitHorizontal size={17} />, commits.length || '—', 'коммитов'],
                [<GitBranch size={17} />, branches.length || '—', 'веток'],
                [<History size={17} />, project.updated || '—', 'обновлено'],
              ].map(([icon, value, label], index) => (
                <div key={String(label)} className={`flex items-center gap-3 sm:px-4 ${index < 2 ? 'sm:border-r sm:border-[rgba(38,23,50,.12)]' : ''}`}>
                  <span className="text-[#7D7482]">{icon}</span>
                  <span>
                    <b className="block text-sm">{value}</b>
                    <small className="block text-[10px] text-[#7D7482]">{label}</small>
                  </span>
                </div>
              ))}
            </section>

            <section className="mx-4 sm:mx-8 mb-4 border border-[rgba(38,23,50,.12)] rounded-xl bg-white min-h-[500px] flex flex-col flex-1">
              <div className="min-h-[52px] border-b border-[rgba(38,23,50,.12)] rounded-t-xl flex items-center justify-between gap-3 px-4 py-2">
                <b className="text-xs">Граф коммитов</b>
                {branches.length > 0 && (
                  <label className="h-[34px] border border-[rgba(38,23,50,.12)] rounded-lg flex items-center px-2.5 gap-1.5 bg-white">
                    <GitBranch size={15} />
                    <span className="sr-only">Фильтр ветки</span>
                    <select
                      value={branchFilter}
                      onChange={(event) => setBranchFilter(event.target.value)}
                      className="max-w-36 border-0 bg-transparent text-[10px] font-bold outline-none"
                    >
                      <option value="all">Все ветки</option>
                      {branches.map(branch => (
                        <option key={branch.name} value={branch.name}>{branch.name}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <div className="flex min-h-[445px] flex-1">
                <div className="flex-1 min-w-0 overflow-auto">
                  <Graph />
                </div>
                <DetailPanel />
              </div>
            </section>
          </>
        )}
      </main>

      {loginOpen && <LoginModal />}
      {createOpen && <CreateModal />}
      <UpdatesModal />
      <Toast message={toast} />

      {loading && (
        <div className="fixed inset-0 bg-[rgba(38,23,50,.3)] backdrop-blur-sm grid place-items-center z-50" role="status">
          <div className="bg-white rounded-xl p-6 shadow-lg flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-[#AEA989] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold">Загрузка…</span>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-5 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 bg-[#A16C62] text-white px-4 py-3 rounded-lg shadow-lg z-[110] text-sm" role="alert">
          {error}
        </div>
      )}
    </div>
  );
};
