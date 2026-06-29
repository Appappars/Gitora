import React, { useEffect, useState } from 'react';
import { FolderOpen, Palette, Settings, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { applyThemePreference, ThemePreference } from '../../lib/theme';

interface Settings {
  theme: ThemePreference;
  commitLimit: number;
  downloadMode: 'downloads' | 'defaultFolder' | 'ask';
  downloadDirectory: string;
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  commitLimit: 50,
  downloadMode: 'downloads',
  downloadDirectory: '',
};

export const SettingsModal: React.FC = () => {
  const { setSettingsOpen, loading, notify } = useApp();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('gitora-settings');
    if (saved) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      } catch {}
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) close();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, setSettingsOpen]);

  const close = () => {
    if (loading || closing) return;
    setClosing(true);
    window.setTimeout(() => setSettingsOpen(false), 150);
  };

  const save = () => {
    localStorage.setItem('gitora-settings', JSON.stringify(settings));
    applyThemePreference(settings.theme);
    notify('Настройки сохранены');
    close();
  };

  const selectDownloadFolder = async () => {
    if (!window.electronAPI) {
      notify('Выбор папки доступен в приложении Gitora');
      return;
    }
    const result = await window.electronAPI.app.selectDownloadFolder();
    if (result?.success && result.data) {
      setSettings({
        ...settings,
        downloadMode: 'defaultFolder',
        downloadDirectory: result.data,
      });
    } else if (result?.error) {
      notify(result.error);
    }
  };

  return (
    <div
      className="modal-overlay fixed inset-0 backdrop-blur-sm grid place-items-center z-50 p-3 sm:p-5"
      data-closing={closing}
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && close()}
    >
      <div
        className="modal-panel w-[min(440px,100%)] max-h-[calc(100vh-24px)] overflow-auto rounded-2xl p-6 sm:p-7 relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <button className="absolute right-4 top-4 w-8 h-8 grid place-items-center" aria-label="Закрыть" onClick={close}>
          <X size={19} />
        </button>
        <div className="w-[47px] h-[47px] rounded-[13px] bg-[#E7E0D6] grid place-items-center">
          <Settings size={25} />
        </div>
        <h2 id="settings-title" className="text-[23px] font-semibold mt-4 mb-1">Настройки</h2>
        <p className="text-[11px] text-[#7D7482] leading-relaxed mb-5">
          Настройте внешний вид и поведение приложения
        </p>

        <div className="space-y-6">
          <div>
            <label className="text-xs font-bold block mb-2">Тема</label>
            <div className="grid grid-cols-3 gap-2">
              {(['light', 'dark', 'system'] as const).map((theme) => (
                <button
                  key={theme}
                  className={`h-[40px] border rounded-lg text-xs flex items-center justify-center gap-1.5 ${settings.theme === theme ? 'bg-[#E7E0D6] border-[#AEA989]' : 'border-[rgba(38,23,50,.12)]'}`}
                  onClick={() => {
                    const nextSettings = { ...settings, theme };
                    setSettings(nextSettings);
                    localStorage.setItem('gitora-settings', JSON.stringify(nextSettings));
                    applyThemePreference(theme);
                  }}
                >
                  {theme === 'light' ? 'Светлая' : theme === 'dark' ? 'Тёмная' : 'Системная'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold block mb-2">
              Лимит коммитов
              <span className="text-[#7D7482] font-normal ml-1">(для загрузки)</span>
            </label>
            <select
              value={settings.commitLimit}
              onChange={(event) => setSettings({ ...settings, commitLimit: Number(event.target.value) })}
              className="focus-surface w-full h-[42px] border border-[rgba(38,23,50,.12)] bg-[#F3EFE9] rounded-lg px-3 text-sm"
            >
              <option value={25}>25 коммитов</option>
              <option value={50}>50 коммитов</option>
              <option value={100}>100 коммитов</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold block mb-2">Папка для скачивания версий</label>
            <div className="grid gap-2">
              <button
                type="button"
                className={`min-h-[42px] border rounded-lg px-3 text-sm text-left flex items-center justify-between gap-3 ${settings.downloadMode === 'downloads' ? 'bg-[#E7E0D6] border-[#AEA989]' : 'border-[rgba(38,23,50,.12)]'}`}
                onClick={() => setSettings({ ...settings, downloadMode: 'downloads' })}
              >
                <span>
                  <b className="block text-xs">Системная папка загрузок</b>
                  <small className="block text-[10px] text-[#7D7482] mt-0.5">Файлы сохраняются в Downloads</small>
                </span>
              </button>
              <button
                type="button"
                className={`min-h-[42px] border rounded-lg px-3 text-sm text-left flex items-center justify-between gap-3 ${settings.downloadMode === 'ask' ? 'bg-[#E7E0D6] border-[#AEA989]' : 'border-[rgba(38,23,50,.12)]'}`}
                onClick={() => setSettings({ ...settings, downloadMode: 'ask' })}
              >
                <span>
                  <b className="block text-xs">Спрашивать каждый раз</b>
                  <small className="block text-[10px] text-[#7D7482] mt-0.5">Перед скачиванием откроется окно сохранения</small>
                </span>
              </button>
              <div className={`border rounded-lg p-3 ${settings.downloadMode === 'defaultFolder' ? 'bg-[#E7E0D6] border-[#AEA989]' : 'border-[rgba(38,23,50,.12)]'}`}>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="h-9 px-3 bg-[#261732] text-[#E7E0D6] rounded-lg text-[11px] font-semibold flex items-center gap-2"
                    onClick={() => void selectDownloadFolder()}
                  >
                    <FolderOpen size={15} />
                    Выбрать папку
                  </button>
                  <button
                    type="button"
                    className="h-9 px-3 border border-[rgba(38,23,50,.12)] rounded-lg text-[11px] font-semibold"
                    onClick={() => setSettings({ ...settings, downloadMode: 'defaultFolder' })}
                    disabled={!settings.downloadDirectory}
                  >
                    Использовать
                  </button>
                </div>
                <p className="mt-2 text-[10px] text-[#7D7482] break-all">
                  {settings.downloadDirectory || 'Папка по умолчанию не выбрана'}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[rgba(38,23,50,.08)]">
            <h3 className="text-xs font-bold mb-2">О приложении</h3>
            <div className="text-[11px] text-[#7D7482] space-y-1">
              <p>Gitora — визуальный граф истории Git</p>
              <p>Версия: 0.1.11</p>
              <p>Разработано совместно Sabinchous и Appappars</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-6">
          <button type="button" className="px-4 py-2 border border-[rgba(38,23,50,.12)] rounded-lg text-sm font-semibold" onClick={close}>
            Отмена
          </button>
          <button
            className="px-4 py-2 bg-[#261732] text-[#E7E0D6] rounded-lg text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
            onClick={save}
          >
            <Palette size={16} />
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};
