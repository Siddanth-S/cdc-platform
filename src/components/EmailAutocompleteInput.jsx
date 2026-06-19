import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SPOC_EMAILS } from '../data/spocDirectory';
import { formatName as formatDisplayName } from '../utils/profileParser';

const ITEM_HEIGHT = 52;
const VISIBLE_ITEMS = 7;

// Live name -> email lookup for assigning Primary/Secondary SPOCs. Stays a
// plain text input under the hood so a HEAD can still paste any email
// (including ones not in SPOC_EMAILS) - the dropdown is just a shortcut.
// Every caller lives inside a modal with its own overflow-y:auto, which would
// clip an absolutely-positioned dropdown after just 1-2 rows. Rendering
// through a portal anchored to the input's viewport position avoids that.
export default function EmailAutocompleteInput({ value, onChange, placeholder, required }) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const inputRef = useRef(null);

  const query = value.trim().toLowerCase();
  const suggestions = query
    ? SPOC_EMAILS.filter(email => email.toLowerCase().includes(query)).slice(0, 8)
    : [];

  const updatePosition = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const desired = VISIBLE_ITEMS * ITEM_HEIGHT + 16;
    const openUpward = spaceBelow < 180 && spaceAbove > spaceBelow;

    setDropdownStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      zIndex: 2000,
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + 6, maxHeight: Math.min(desired, Math.max(spaceAbove - 12, 140)) }
        : { top: rect.bottom + 6, maxHeight: Math.min(desired, Math.max(spaceBelow - 12, 140)) }),
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  const openDropdown = () => {
    updatePosition();
    setIsOpen(true);
  };

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
    <>
      <input
        ref={inputRef}
        required={required}
        type="text"
        autoComplete="off"
        className="input-field"
        value={value}
        onChange={e => {
          onChange(e.target.value);
          openDropdown();
          setHighlightedIndex(0);
        }}
        onFocus={openDropdown}
        onBlur={() => setTimeout(() => setIsOpen(false), 120)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      {isOpen && suggestions.length > 0 && dropdownStyle && createPortal(
        <div className="spoc-autocomplete-dropdown" style={dropdownStyle}>
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
        </div>,
        document.body
      )}
    </>
  );
}
