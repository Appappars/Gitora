import React, { useEffect, useState } from 'react';
import { Check, FolderGit2, Github, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const CreateModal: React.FC = () => {
  const { setCreateOpen, createRepo, loading } = useApp();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) setCreateOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [loading, setCreateOpen]);

  const close = () => !loading && setCreateOpen(false);

  return (
    <div
      className="fixed inset-0 bg-[rgba(38,23,50,.58)] backdrop-blur-sm grid place-items-center z-50 p-3 sm:p-5"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div
        className="w-[min(440px,100%)] max-h-[calc(100vh-24px)] overflow-auto bg-white rounded-2xl p-6 sm:p-7 relative shadow-[0_18px_50px_rgba(38,23,50,.13)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-title"
      >
        <button className="absolute right-4 top-4 w-8 h-8 grid place-items-center" aria-label="Закрыть" onClick={close}>
          <X size={19} />
        </button>
        <div className="w-[47px] h-[47px] rounded-[13px] bg-[#E7E0D6] grid place-items-center">
          <FolderGit2 size={25} />
        </div>
        <h2 id="create-title" className="text-[23px] font-semibold mt-4 mb-1">Новый репозиторий</h2>
        <p className="text-[11px] text-[#7D7482] leading-relaxed mb-5">Репозиторий будет создан в вашем аккаунте GitHub.</p>

        <form onSubmit={async (event) => {
          event.preventDefault();
          if (await createRepo(name.trim(), description.trim(), isPrivate)) setCreateOpen(false);
        }}>
          <label className="block text-xs font-bold">
            Название
            <input
              autoFocus
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="studio-website"
              className="block w-full h-[42px] border border-[rgba(38,23,50,.12)] bg-[#F3EFE9] rounded-lg px-3 text-sm mt-2"
            />
          </label>

          <label className="block text-xs font-bold mt-4">
            Описание
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={350}
              rows={3}
              className="block w-full resize-none border border-[rgba(38,23,50,.12)] bg-[#F3EFE9] rounded-lg p-3 text-sm mt-2"
            />
          </label>

          <fieldset className="mt-4">
            <legend className="text-xs font-bold">Видимость</legend>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[true, false].map(value => (
                <button
                  key={String(value)}
                  type="button"
                  aria-pressed={isPrivate === value}
                  className={`h-[40px] border rounded-lg text-xs flex items-center justify-center gap-1.5 ${isPrivate === value ? 'bg-[#E7E0D6] border-[#AEA989]' : 'border-[rgba(38,23,50,.12)]'}`}
                  onClick={() => setIsPrivate(value)}
                >
                  {isPrivate === value && <Check size={15} />}
                  {value ? 'Приватный' : 'Публичный'}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-6">
            <button type="button" className="px-4 py-2 border border-[rgba(38,23,50,.12)] rounded-lg text-sm font-semibold" onClick={close}>
              Отмена
            </button>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="px-4 py-2 bg-[#261732] text-[#E7E0D6] rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <Github size={16} />
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
