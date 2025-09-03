import React from 'react';
import { FiCode } from 'react-icons/fi';

const DeveloperSignature = () => {
  return (
    <div className="developer-signature">
      <div className="signature-content">
        <FiCode size={16} />
        <span>Developed by</span>
        <strong>Selçuk TUNÇER</strong>
      </div>
    </div>
  );
};

export default DeveloperSignature;
