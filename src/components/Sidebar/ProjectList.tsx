import React from 'react';
import { FolderGit2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const ProjectList: React.FC = () => {
  const { projects, project, setProject, setMobileOpen } = useApp();

  return (
    <div className="flex-1 overflow-auto px-2">
      {projects.map((p) => (
        <button
          key={p.id}
          className={`flex items-center gap-2.5 w-full border-0 bg-transparent text-[rgba(231,224,214,.65)] p-2 rounded-lg text-left cursor-pointer relative hover:bg-[rgba(231,224,214,.08)] hover:text-[#E7E0D6] ${project?.id === p.id ? 'bg-[rgba(231,224,214,.08)] text-[#E7E0D6]' : ''}`}
          onClick={() => {
            setProject(p);
            setMobileOpen(false);
          }}
        >
          <span 
            className="w-7 h-7 rounded-lg grid place-items-center"
            style={{ 
              backgroundColor: `color-mix(in srgb, ${p.color}, transparent 78%)`,
              color: p.color 
            }}
          >
            <FolderGit2 size={17} />
          </span>
          <span className="flex-1 min-w-0">
            <b className="block text-[11px] truncate">{p.name}</b>
            <small className="block text-[8px] text-[rgba(231,224,214,.38)] mt-0.5 truncate">{p.repo}</small>
          </span>
          {project?.id === p.id && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#AEA989] shadow-[0_0_0_3px_rgba(174,169,137,.12)]" />
          )}
        </button>
      ))}
    </div>
  );
};
