import React from 'react';
import { Search, X, Database } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  onClear: () => void;
  placeholder?: string;
  searchSource?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onClear,
  placeholder = 'Search emails by subject, recipient, body or sender via Elasticsearch...',
  searchSource,
}) => {
  return (
    <div className="relative w-full max-w-xl">
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-24 py-2 text-xs bg-[#0D131F]/90 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all"
        />

        {value && (
          <button
            onClick={onClear}
            className="absolute right-16 p-1 text-slate-400 hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        <div className="absolute right-2 px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-400 bg-slate-800/80 border border-slate-700">
          ES Search
        </div>
      </div>
    </div>
  );
};
