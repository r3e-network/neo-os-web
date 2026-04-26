/**
 * Select Component - Enhanced with design system tokens
 * Supports single selection, search, and custom rendering
 */

import React, {
  forwardRef,
  useCallback,
  useId,
  useState,
  useMemo,
  useRef,
  useEffect,
} from "react";
import { cn } from "@/lib/utils";
import { keyboardNavigation } from "@/lib/design-system/a11y";
import {
  useFocusTrap,
  generateAriaId,
  isFocusable,
} from "@/lib/design-system/a11y";

export type SelectSize = "sm" | "md" | "lg";
export type SelectVariant = "default" | "filled" | "outline";

export interface SelectOption {
  /** Option value */
  value: string;
  /** Option label */
  label: string;
  /** Option disabled */
  disabled?: boolean;
  /** Option icon */
  icon?: React.ReactNode;
  /** Option description */
  description?: string;
}

export interface SelectProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "size" | "onChange" | "value"
> {
  /** Value */
  value?: string;
  /** Select options */
  options: SelectOption[];
  /** Placeholder text */
  placeholder?: string;
  /** Select size */
  size?: SelectSize;
  /** Select variant */
  variant?: SelectVariant;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Label text */
  label?: string;
  /** Whether the label is required */
  required?: boolean;
  /** Whether to show search input */
  searchable?: boolean;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Whether to show clear button */
  clearable?: boolean;
  /** Callback when value changes */
  onChange?: (value: string) => void;
  /** Callback when search changes */
  onSearch?: (search: string) => void;
}

// ============================================================================
// Size Styles
// ============================================================================

const sizeStyles: Record<SelectSize, string> = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-4 py-2.5 text-base rounded-xl",
  lg: "px-4 py-3 text-lg rounded-xl",
};

// ============================================================================
// Select Component
// ============================================================================

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      options,
      placeholder = "Select an option",
      size = "md",
      variant = "default",
      error,
      helperText,
      label,
      required,
      searchable = false,
      searchPlaceholder = "Search...",
      clearable = false,
      onChange,
      onSearch,
      className,
      disabled,
      id,
      value,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const selectId = id || generatedId;
    const listboxId = generateAriaId("select-listbox");
    const helperId = `${selectId}-helper`;
    const errorId = `${selectId}-error`;

    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const listboxRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Use focus trap when dropdown is open
    useFocusTrap({
      active: isOpen,
      initialFocus: searchable ? "#select-search" : undefined,
      returnFocus: true,
    });

    // Filter options based on search
    const filteredOptions = useMemo(() => {
      if (!searchable || !search) return options;
      const lowerSearch = search.toLowerCase();
      return options.filter(
        (option) =>
          option.label.toLowerCase().includes(lowerSearch) ||
          option.value.toLowerCase().includes(lowerSearch),
      );
    }, [options, search, searchable]);

    // Get selected option
    const selectedOption = useMemo(
      () => options.find((opt) => opt.value === value),
      [options, value],
    );

    // Handle keyboard navigation
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (disabled) return;

        switch (e.key) {
          case "Enter":
          case " ":
            e.preventDefault();
            if (isOpen && highlightedIndex >= 0) {
              const option = filteredOptions[highlightedIndex];
              if (option && !option.disabled) {
                onChange?.(option.value);
                setIsOpen(false);
                setSearch("");
              }
            } else {
              setIsOpen(true);
            }
            break;

          case "Escape":
            e.preventDefault();
            setIsOpen(false);
            setSearch("");
            break;

          case "ArrowUp":
            e.preventDefault();
            if (!isOpen) {
              setIsOpen(true);
            } else {
              setHighlightedIndex((prev) =>
                prev <= 0 ? filteredOptions.length - 1 : prev - 1,
              );
            }
            break;

          case "ArrowDown":
            e.preventDefault();
            if (!isOpen) {
              setIsOpen(true);
            } else {
              setHighlightedIndex((prev) =>
                prev >= filteredOptions.length - 1 ? 0 : prev + 1,
              );
            }
            break;

          case "Home":
            e.preventDefault();
            if (isOpen) setHighlightedIndex(0);
            break;

          case "End":
            e.preventDefault();
            if (isOpen) setHighlightedIndex(filteredOptions.length - 1);
            break;
        }
      },
      [disabled, isOpen, highlightedIndex, filteredOptions, onChange],
    );

    // Handle search input change
    const handleSearchChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        onSearch?.(e.target.value);
        setHighlightedIndex(0);
      },
      [onSearch],
    );

    // Handle option click
    const handleOptionClick = useCallback(
      (option: SelectOption) => {
        if (option.disabled) return;
        onChange?.(option.value);
        setIsOpen(false);
        setSearch("");
      },
      [onChange],
    );

    // Handle clear
    const handleClear = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange?.("");
        setSearch("");
      },
      [onChange],
    );

    // Close on outside click
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false);
          setSearch("");
        }
      };

      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
      }

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isOpen]);

    // Scroll highlighted option into view
    useEffect(() => {
      if (isOpen && highlightedIndex >= 0 && listboxRef.current) {
        const optionElements =
          listboxRef.current.querySelectorAll("[role='option']");
        optionElements[highlightedIndex]?.scrollIntoView({ block: "nearest" });
      }
    }, [highlightedIndex, isOpen]);

    const sizeStyle = useMemo(() => sizeStyles[size], [size]);

    return (
      <div className="w-full" ref={containerRef}>
        {label && (
          <label
            id={`${selectId}-label`}
            htmlFor={selectId}
            className="block text-sm font-medium text-gray-300 mb-1.5"
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          {/* Trigger Button */}
          <button
            type="button"
            id={selectId}
            ref={(node) => {
              // The Select component renders a <button> as its trigger but exposes
              // a ref typed as HTMLSelectElement for form-compatibility. Cast once here.
              if (typeof ref === "function") {
                ref(node as unknown as HTMLSelectElement);
              } else if (ref) {
                (
                  ref as React.MutableRefObject<HTMLSelectElement | null>
                ).current = node as unknown as HTMLSelectElement;
              }
            }}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-labelledby={label ? `${selectId}-label` : undefined}
            className={cn(
              "w-full flex items-center justify-between text-left transition-all duration-200",
              "bg-gray-800 border border-gray-700 text-white rounded-xl",
              "focus:outline-none focus:border-neo focus:ring-1 focus:ring-neo",
              sizeStyle,
              error && "border-red-500 focus:border-red-500",
              disabled && "opacity-50 cursor-not-allowed",
              className,
            )}
            onClick={() => !disabled && setIsOpen(!isOpen)}
            onKeyDown={handleKeyDown}
            {...props}
          >
            <span className={cn(!selectedOption && "text-gray-500")}>
              {selectedOption?.label || placeholder}
            </span>

            <div className="flex items-center gap-2">
              {clearable && value && !disabled && (
                <span
                  className="text-gray-400 hover:text-white"
                  onClick={handleClear}
                  role="button"
                  tabIndex={-1}
                  aria-label="Clear selection"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              )}
              <svg
                className={cn(
                  "w-5 h-5 text-gray-400 transition-transform duration-200",
                  isOpen && "rotate-180",
                )}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </button>

          {/* Dropdown Listbox */}
          {isOpen && (
            <div
              ref={listboxRef}
              id={listboxId}
              role="listbox"
              aria-label={label || placeholder}
              className={cn(
                "absolute z-50 w-full mt-2 py-1",
                "bg-gray-800 border border-gray-700 rounded-xl shadow-xl",
                "max-h-60 overflow-auto",
                "animate-fade-in-down",
              )}
              onKeyDown={handleKeyDown}
            >
              {searchable && (
                <div className="px-2 py-2 border-b border-gray-700">
                  <input
                    id="select-search"
                    type="text"
                    value={search}
                    onChange={handleSearchChange}
                    placeholder={searchPlaceholder}
                    className={cn(
                      "w-full px-3 py-2 text-sm",
                      "bg-gray-900 border border-gray-700 rounded-lg",
                      "text-white placeholder-gray-500",
                      "focus:outline-none focus:border-neo",
                    )}
                    autoFocus
                  />
                </div>
              )}

              {filteredOptions.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500">
                  No options found
                </div>
              ) : (
                filteredOptions.map((option, index) => (
                  <div
                    key={option.value}
                    role="option"
                    aria-selected={value === option.value}
                    aria-disabled={option.disabled}
                    tabIndex={option.disabled ? -1 : 0}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2 cursor-pointer",
                      "transition-colors duration-150",
                      value === option.value && "bg-neo/10 text-neo",
                      highlightedIndex === index && "bg-gray-700",
                      !option.disabled && "hover:bg-gray-700",
                      option.disabled && "opacity-50 cursor-not-allowed",
                    )}
                    onClick={() => handleOptionClick(option)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    {option.icon && <span>{option.icon}</span>}
                    <div className="flex-1">
                      <div className="text-sm">{option.label}</div>
                      {option.description && (
                        <div className="text-xs text-gray-500">
                          {option.description}
                        </div>
                      )}
                    </div>
                    {value === option.value && (
                      <svg
                        className="w-4 h-4 text-neo"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Helper/Error Text */}
        {(error || helperText) && (
          <p
            id={error ? errorId : helperId}
            className={cn(
              "mt-1.5 text-sm",
              error ? "text-red-400" : "text-gray-500",
            )}
            role={error ? "alert" : undefined}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  },
);

Select.displayName = "Select";
