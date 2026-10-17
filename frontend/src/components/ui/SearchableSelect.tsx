import * as React from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  allowClear?: boolean;
  id?: string;
  testId?: string;
  'data-testid'?: string;
}

export function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search options...',
  label,
  error,
  disabled = false,
  required = false,
  className,
  allowClear = false,
  id,
  testId,
  'data-testid': dataTestId,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = React.useMemo(() => {
    return options.find((opt) => opt.value === value) || null;
  }, [options, value]);

  const filteredOptions = React.useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  // Click outside to close
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when opened
  React.useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setHighlightedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 30);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1 < filteredOptions.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filteredOptions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[highlightedIndex] && !filteredOptions[highlightedIndex].disabled) {
        onChange(filteredOptions[highlightedIndex].value);
        setIsOpen(false);
      }
    }
  };

  return (
    <div ref={containerRef} className={cn('relative w-full space-y-1.5', className)} id={id}>
      {/* Hidden native select for form accessibility and automated test compatibility */}
      <select
        tabIndex={-1}
        data-testid={testId || dataTestId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only pointer-events-none absolute -left-[9999px]"
        disabled={disabled}
        required={required}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>

      {label && (
        <label className="block text-xs font-medium text-slate-300">
          {label} {required && <span className="text-[#fbb945]">*</span>}
        </label>
      )}

      {/* Main Trigger (Brand Underline, no border-radius) */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex h-10 w-full rounded-none border-0 border-b-2 border-[#2d3139] bg-[#141519]/90 px-3 py-2 text-xs text-left transition-all duration-200 cursor-pointer select-none items-center justify-between',
          'hover:border-slate-600 focus:border-[#985184] focus:bg-[#181a22] focus:outline-none',
          isOpen && 'border-[#985184] bg-[#181a22]',
          error && 'border-rose-500 focus:border-rose-500',
          disabled && 'opacity-50 cursor-not-allowed bg-transparent'
        )}
      >
        <span className={cn('truncate mr-2', selectedOption ? 'text-slate-100 font-medium' : 'text-slate-500')}>
          {selectedOption ? (
            <span className="flex items-center gap-2 truncate">
              <span className="truncate">{selectedOption.label}</span>
              {selectedOption.sublabel && (
                <span className="text-[10px] text-slate-400 font-mono truncate">({selectedOption.sublabel})</span>
              )}
            </span>
          ) : (
            placeholder
          )}
        </span>

        <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
          {allowClear && selectedOption && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-0.5 hover:text-white rounded hover:bg-white/10"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={cn('w-4 h-4 transition-transform duration-200 text-slate-400', isOpen && 'rotate-180 text-[#985184]')}
          />
        </div>
      </button>

      {/* Dropdown Floating Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 bg-[#181a20] border border-[#2d3139] shadow-2xl rounded-none overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
          {/* Top Search Input */}
          <div className="p-2 border-b border-[#2d3139] bg-[#141519] flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none"
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Options Scrollable List */}
          <div ref={listRef} className="max-h-56 overflow-y-auto divide-y divide-[#2d3139]/40 py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={opt.value}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (!opt.disabled) {
                        onChange(opt.value);
                        setIsOpen(false);
                      }
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={cn(
                      'px-3 py-2 text-xs flex items-center justify-between cursor-pointer transition-colors',
                      isSelected
                        ? 'bg-[#985184]/20 text-white font-semibold'
                        : isHighlighted
                        ? 'bg-white/5 text-slate-100'
                        : 'text-slate-300 hover:bg-white/5',
                      opt.disabled && 'opacity-40 cursor-not-allowed pointer-events-none'
                    )}
                  >
                    <div className="flex flex-col truncate pr-2">
                      <span className="truncate">{opt.label}</span>
                      {opt.sublabel && (
                        <span className="text-[10px] text-slate-400 font-mono truncate">{opt.sublabel}</span>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#fbb945] shrink-0" />}
                  </div>
                );
              })
            ) : (
              <div className="py-6 px-4 text-center">
                <p className="text-xs text-slate-400">No matching options</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Try a different search term</p>
              </div>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-[11px] text-rose-400">{error}</p>}
    </div>
  );
}
