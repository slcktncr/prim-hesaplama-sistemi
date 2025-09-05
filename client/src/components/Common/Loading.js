import React from 'react';
import './Loading.css';

const Loading = ({ size = 'medium', text = '', variant = 'pulse' }) => {
  const renderLoader = () => {
    switch (variant) {
      case 'dots':
        return (
          <div className={`modern-loading dots ${size}`}>
            <div className="dot"></div>
            <div className="dot"></div>
            <div className="dot"></div>
          </div>
        );
      case 'ripple':
        return (
          <div className={`modern-loading ripple ${size}`}>
            <div></div>
            <div></div>
          </div>
        );
      case 'pulse':
      default:
        return (
          <div className={`modern-loading pulse ${size}`}>
            <div className="pulse-ring"></div>
            <div className="pulse-ring"></div>
            <div className="pulse-ring"></div>
          </div>
        );
    }
  };

  return (
    <div className="loading-container">
      <div className="loading-wrapper">
        {renderLoader()}
        {text && <div className="loading-text">{text}</div>}
      </div>
    </div>
  );
};

export default Loading;
