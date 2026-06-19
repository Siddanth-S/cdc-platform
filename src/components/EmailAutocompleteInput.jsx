import { useState } from 'react';
import { SPOC_EMAILS } from '../data/spocDirectory';

const formatDisplayName = (email) => {
  const namePart = email.split('@')[0].split('.')[0].replace(/[0-9]/g, '');
  return namePart.charAt(0).toUpperCase() + namePart.slice(1);
};

// Live name -> email lookup for assigning Primary/Secondary SPOCs. Stays a
// plain text input under the hood so a HEAD can still paste any email
// (including ones not in SPOC_EMAILS) - the dropdown is just a shortcut.
export default function EmailAutocompleteInput({ value, onChange, placeholder, required }) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const query = value.trim().toLowerCase();
  const suggestions = query
    ? SPOC_EMAILS.filter(email => email.toLowerCase().includes(query)).slice(0, 8)
    : [];

  const selectSuggestion = (email) => {
    onChange(email);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!isOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectSuggestion(suggestions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        required={required}
        type="text"
        autoComplete="off"
        className="input-field"
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setIsOpen(true);
          setHighlightedIndex(0);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 120)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      {isOpen && suggestions.length > 0 && (
        <div className="spoc-autocomplete-dropdown">
          {suggestions.map((email, i) => (
            <button
              key={email}
              type="button"
              className={`spoc-autocomplete-item ${i === highlightedIndex ? 'active' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); selectSuggestion(email); }}
              onMouseEnter={() => setHighlightedIndex(i)}
            >
              <span className="spoc-autocomplete-name">{formatDisplayName(email)}</span>
              <span className="spoc-autocomplete-email">{email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
