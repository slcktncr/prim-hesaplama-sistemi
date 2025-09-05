import React, { useState, useRef, useEffect } from 'react';
import { Form, Dropdown, Badge } from 'react-bootstrap';
import { FiChevronDown, FiX } from 'react-icons/fi';

const MultiSelectDropdown = ({ 
  options = [], 
  selectedValues = [], 
  onChange, 
  placeholder = "Seçim yapın...", 
  label,
  valueKey = 'value',
  labelKey = 'label'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleItemClick = (value, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const isSelected = selectedValues.includes(value);
    let newValues;
    
    if (isSelected) {
      newValues = selectedValues.filter(v => v !== value);
    } else {
      newValues = [...selectedValues, value];
    }
    
    onChange(newValues);
  };

  const handleSelectAll = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (selectedValues.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map(option => option[valueKey]));
    }
  };

  const handleRemoveItem = (value, e) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(selectedValues.filter(v => v !== value));
  };

  const getSelectedLabels = () => {
    return selectedValues.map(value => {
      const option = options.find(opt => opt[valueKey] === value);
      return option ? option[labelKey] : value;
    });
  };

  const selectedLabels = getSelectedLabels();
  const allSelected = selectedValues.length === options.length && options.length > 0;

  return (
    <div className="position-relative" ref={dropdownRef}>
      {label && <Form.Label>{label}</Form.Label>}
      
      {/* Selected items display */}
      {selectedLabels.length > 0 && (
        <div className="mb-2">
          {selectedLabels.map((label, index) => (
            <Badge 
              key={index} 
              bg="primary" 
              className="me-1 mb-1"
              style={{ cursor: 'pointer' }}
            >
              {label}
              <FiX 
                className="ms-1" 
                size={12}
                onClick={(e) => handleRemoveItem(selectedValues[index], e)}
              />
            </Badge>
          ))}
        </div>
      )}
      
      {/* Dropdown trigger */}
      <div
        className="form-control d-flex justify-content-between align-items-center"
        style={{ cursor: 'pointer', minHeight: '38px' }}
        onClick={handleToggle}
      >
        <span className={selectedLabels.length === 0 ? 'text-muted' : ''}>
          {selectedLabels.length === 0 
            ? placeholder 
            : `${selectedLabels.length} öğe seçildi`
          }
        </span>
        <FiChevronDown className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {/* Dropdown menu */}
      {isOpen && (
        <div 
          className="position-absolute w-100 bg-white border rounded shadow-sm mt-1"
          style={{ zIndex: 1050, maxHeight: '200px', overflowY: 'auto' }}
        >
          {/* Select All option */}
          <div
            className="px-3 py-2 border-bottom bg-light"
            style={{ cursor: 'pointer' }}
            onClick={handleSelectAll}
          >
            <Form.Check
              type="checkbox"
              label={allSelected ? "Tümünü Kaldır" : "Tümünü Seç"}
              checked={allSelected}
              readOnly
            />
          </div>

          {/* Options */}
          {options.map((option) => (
            <div
              key={option[valueKey]}
              className="px-3 py-2 hover-bg-light"
              style={{ cursor: 'pointer' }}
              onClick={(e) => handleItemClick(option[valueKey], e)}
            >
              <Form.Check
                type="checkbox"
                label={option[labelKey]}
                checked={selectedValues.includes(option[valueKey])}
                readOnly
              />
            </div>
          ))}
        </div>
      )}

      <style>{`
        .hover-bg-light:hover {
          background-color: #f8f9fa !important;
        }
        .transition-transform {
          transition: transform 0.2s ease;
        }
        .rotate-180 {
          transform: rotate(180deg);
        }
      `}</style>
    </div>
  );
};

export default MultiSelectDropdown;
