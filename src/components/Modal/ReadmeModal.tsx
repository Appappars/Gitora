import React, { useEffect, useState } from 'react';
import { BookOpen, Save, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Branch } from '../../types';

interface ReadmeModalProps {
  branches: Branch[];
  repoFullName: string;
}

export const ReadmeModal: React.FC<ReadmeModalProps> = ({ branches, repoFullName }) => {
  const { setReadmeOpen, getReadme, saveReadme, loading } = useApp();
  const [owner, repo] = repoFullName.split('/');
  const [branch, setBranch] = useState(branches[0]?.name || 'main');
  const [content, setContent] = useState('');
  const [message, setMessage] = useState('Обновлён README');

  useEffect(() => {
    void getReadme(owner, repo, branch).then(setContent);
  }, [owner, repo, branch]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) setReadmeOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [loading, setReadmeOpen]);

  const close = () => !loading && setReadmeOpen(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await saveReadme(owner, repo, branch, content, message);
    if (ok) setReadmeOpen(false);
  };

  return (
    <div
      className="fixed inset-0 bg-[rgba(38,23,50,.58)] backdrop-blur-sm grid place-items-center z-50 p-3 sm:p-5"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div
        className="w-[min(720px,100%)] max-h-[calc(100vh-24px)] overflow-auto bg-white rounded-2xl p-6 sm:p-7 relative shadow-[0_18px_50px_rgba(38,23,50,.13)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="readme-title"
      >
        <button className="absolute right-4 top-4 w-8 h-8 grid place-items-center" aria-label="Закрыть" onClick={close}>
          <X size={19} />
        </button>
        <div className="w-[47px] h-[47px] rounded-[13px] bg-[#E7E0D6] grid place-items-center">
          <BookOpen size={25} />
        </div>
        <h2 id="readme-title" className="text-[23px] font-semibold mt-4 mb-1">README</h2>
        <p className="text-[11px] text-[#7D7482] leading-relaxed mb-5">
          Файл <b className="text-[#261732]">README.md</b> в <b className="text-[#261732]">{repoFullName}</b>
        </p>

        <form onSubmit={submit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block text-xs font-bold">
              Ветка
              <input
                list="readme-branches"
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
                className="block w-full h-[42px] border border-[rgba(38,23,50,.12)] bg-[#F3EFE9] rounded-lg px-3 text-sm mt-2"
              />
              <datalist id="readme-branches">
                {branches.map(item => <option key={item.name} value={item.name} />)}
              </datalist>
            </label>

            <label className="block text-xs font-bold">
              Сообщение коммита
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="block w-full h-[42px] border border-[rgba(38,23,50,.12)] bg-[#F3EFE9] rounded-lg px-3 text-sm mt-2"
              />
            </label>
          </div>

          <label className="block text-xs font-bold mt-4">
            Markdown
            <textarea
              autoFocus
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={14}
              className="block w-full resize-y min-h-[260px] border border-[rgba(38,23,50,.12)] bg-[#F3EFE9] rounded-lg p-3 text-sm mt-2 font-mono"
              placeholder={`# ${repo}\n\nОписание проекта.`}
            />
          </label>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-6">
            <button type="button" className="px-4 py-2 border border-[rgba(38,23,50,.12)] rounded-lg text-sm font-semibold" onClick={close}>
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="px-4 py-2 bg-[#261732] text-[#E7E0D6] rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <Save size={16} />
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
