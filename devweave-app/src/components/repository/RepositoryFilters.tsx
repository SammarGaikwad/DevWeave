import React from 'react';
import { Search, LayoutGrid, List, Filter } from 'lucide-react';

export type StatusFilter = 'All' | 'Active' | 'Archived' | 'Private' | 'Public';
export type SortOption =
  | 'Recently Updated'
  | 'Name A-Z'
  | 'Name Z-A'
  | 'Most Stars'
  | 'Most Forks';

interface RepositoryFiltersProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
  languageFilter: string;
  onLanguageFilterChange: (lang: string) => void;
  sortOption: SortOption;
  onSortOptionChange: (sort: SortOption) => void;
  viewMode: 'list' | 'grid';
  onViewModeChange: (mode: 'list' | 'grid') => void;
  availableLanguages: string[];
}

export const RepositoryFilters: React.FC<RepositoryFiltersProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  languageFilter,
  onLanguageFilterChange,
  sortOption,
  onSortOptionChange,
  viewMode,
  onViewModeChange,
  availableLanguages,
}) => {
  const statusTabs: StatusFilter[] = ['All', 'Active', 'Archived', 'Private', 'Public'];
  const sortOptions: SortOption[] = [
    'Recently Updated',
    'Name A-Z',
    'Name Z-A',
    'Most Stars',
    'Most Forks',
  ];

  return (
    <div className="space-y-4">
      {/* Top Filter Controls: Search + Dropdowns + View Toggle */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            type="text"
            placeholder="Search repositories by name, description, language..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white text-xs sm:text-sm placeholder-white/40 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/30 transition-all"
          />
        </div>

        {/* Dropdowns & View Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Language Dropdown */}
          <div className="relative flex items-center">
            <Filter className="absolute left-2.5 h-3.5 w-3.5 text-white/40 pointer-events-none" />
            <select
              value={languageFilter}
              onChange={(e) => onLanguageFilterChange(e.target.value)}
              className="pl-8 pr-7 py-2 rounded-xl bg-[#0a0a0a] border border-white/[0.08] text-white/80 text-xs font-medium focus:outline-none focus:border-blue-500/40 cursor-pointer transition-all"
            >
              <option value="All">All Languages</option>
              {availableLanguages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortOption}
            onChange={(e) => onSortOptionChange(e.target.value as SortOption)}
            className="px-3 py-2 rounded-xl bg-[#0a0a0a] border border-white/[0.08] text-white/80 text-xs font-medium focus:outline-none focus:border-blue-500/40 cursor-pointer transition-all"
          >
            {sortOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>

          {/* View Mode Toggle Button Group */}
          <div className="inline-flex items-center p-1 rounded-xl bg-white/[0.03] border border-white/[0.08]">
            <button
              onClick={() => onViewModeChange('list')}
              aria-label="List view"
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => onViewModeChange('grid')}
              aria-label="Grid view"
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs Row */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-white/[0.06]">
        {statusTabs.map((tab) => {
          const isActive = statusFilter === tab;
          return (
            <button
              key={tab}
              onClick={() => onStatusFilterChange(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-blue-500/15 text-white border border-blue-500/30 font-semibold'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>
    </div>
  );
};
