import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { COUNTRIES, type Country, detectUserCountry, findCountryByPhone, formatE164 } from '../lib/countries';

export interface PhoneInputProps {
  label?: string;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  name?: string;
  required?: boolean;
}

export function PhoneInput({
  label = 'Mobile number',
  value = '',
  onChange,
  error,
  disabled = false,
  placeholder,
  id: explicitId,
  name,
  required,
}: PhoneInputProps) {
  const generatedId = useId();
  const inputId = explicitId ?? name ?? generatedId;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initialize selected country: auto-detect or match from value
  const [selectedCountry, setSelectedCountry] = useState<Country>(() => {
    if (value && value.startsWith('+')) {
      const matched = findCountryByPhone(value);
      if (matched) return matched;
    }
    return detectUserCountry();
  });

  // Extract initial national number from value
  const [nationalNumber, setNationalNumber] = useState<string>(() => {
    if (value && value.startsWith('+')) {
      const prefix = selectedCountry.dialCode;
      if (value.startsWith(prefix)) {
        const raw = value.slice(prefix.length).replace(/\D/g, '').replace(/^0+/, '');
        return raw.slice(0, selectedCountry.maxLength);
      }
    }
    const digits = value.replace(/\D/g, '').replace(/^0+/, '');
    return digits.slice(0, selectedCountry.maxLength);
  });

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredCountries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso.toLowerCase().includes(q) ||
        c.dialCode.includes(q)
    );
  }, [searchQuery]);

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setIsOpen(false);
    setSearchQuery('');
    // Slice national number if it exceeds the new country's maximum length
    const trimmed = nationalNumber.slice(0, country.maxLength);
    setNationalNumber(trimmed);
    const fullE164 = formatE164(country.dialCode, trimmed);
    onChange?.(fullE164);
  };

  const handleNumberChange = (raw: string) => {
    // Only allow digits, strip leading 0s automatically as per user preference
    const digitsOnly = raw.replace(/\D/g, '').replace(/^0+/, '');
    // Strictly restrict typing once max length is reached
    const trimmed = digitsOnly.slice(0, selectedCountry.maxLength);
    setNationalNumber(trimmed);
    const fullE164 = formatE164(selectedCountry.dialCode, trimmed);
    onChange?.(fullE164);
  };

  const currentDigitsCount = nationalNumber.length;
  const isComplete = currentDigitsCount >= selectedCountry.minLength && currentDigitsCount <= selectedCountry.maxLength;
  const requiredLabel = selectedCountry.minLength === selectedCountry.maxLength
    ? `${selectedCountry.maxLength} digits`
    : `${selectedCountry.minLength}-${selectedCountry.maxLength} digits`;

  return (
    <div className="block space-y-1.5 text-sm text-slate-200">
      <div className="flex items-center justify-between">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-200">
            {label} {required && <span className="text-red-400">*</span>}
          </label>
        )}
        <span className="text-xs text-slate-400 font-mono">
          {currentDigitsCount > 0 ? (
            <span className={isComplete ? 'text-emerald-400' : 'text-amber-400'}>
              {currentDigitsCount}/{selectedCountry.maxLength} digits
            </span>
          ) : (
            <span>{requiredLabel}</span>
          )}
        </span>
      </div>

      <div className={`relative flex rounded-sm border bg-input transition-colors ${
        error ? 'border-red-500/60 focus-within:border-red-500' : 'border-white/10 focus-within:border-primary'
      }`}>
        {/* Country Selector Trigger */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen(!isOpen)}
            className="flex h-11 items-center gap-1.5 border-r border-white/10 px-3 text-sm font-medium text-foreground hover:bg-white/5 focus:outline-none disabled:opacity-50"
            aria-label={`Select country code. Currently ${selectedCountry.name} (${selectedCountry.dialCode})`}
            aria-expanded={isOpen}
          >
            <span className="text-base" role="img" aria-label={selectedCountry.name}>
              {selectedCountry.flag}
            </span>
            <span className="text-xs text-slate-300 font-mono">{selectedCountry.dialCode}</span>
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Searchable Dropdown Popup */}
          {isOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-md border border-white/10 bg-slate-900 p-2 shadow-2xl backdrop-blur-md">
              <div className="relative mb-2">
                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search country or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-full rounded border border-white/10 bg-slate-800/80 pl-8 pr-3 text-xs text-foreground placeholder:text-slate-500 focus:border-primary focus:outline-none"
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-0.5">
                {filteredCountries.length === 0 ? (
                  <div className="py-3 text-center text-xs text-slate-400">No country found</div>
                ) : (
                  filteredCountries.map((c) => {
                    const isSelected = c.iso === selectedCountry.iso;
                    return (
                      <button
                        key={c.iso}
                        type="button"
                        onClick={() => handleCountrySelect(c)}
                        className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-white/10 ${
                          isSelected ? 'bg-primary/20 text-primary font-semibold' : 'text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{c.flag}</span>
                          <span className="truncate max-w-[130px]">{c.name}</span>
                        </div>
                        <span className="font-mono text-slate-400">{c.dialCode}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* National Number Input */}
        <input
          id={inputId}
          name={name}
          type="tel"
          inputMode="numeric"
          disabled={disabled}
          maxLength={selectedCountry.maxLength}
          value={nationalNumber}
          onChange={(e) => handleNumberChange(e.target.value)}
          placeholder={placeholder ?? `e.g. ${selectedCountry.example}`}
          className="h-11 w-full bg-transparent px-3 text-sm text-foreground font-mono placeholder:text-slate-500 focus:outline-none disabled:opacity-50"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
        />
      </div>

      {error && (
        <span id={`${inputId}-error`} role="alert" className="block text-xs text-red-300">
          {error}
        </span>
      )}
    </div>
  );
}
