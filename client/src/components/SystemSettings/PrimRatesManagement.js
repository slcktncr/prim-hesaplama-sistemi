import React from 'react';
import PrimSettings from '../Prims/PrimSettings';

const PrimRatesManagement = () => {
  return (
    <div>
      <div className="mb-4">
        <h4 className="mb-1">Prim Oranları</h4>
        <p className="text-muted mb-0">Sistem genelindeki prim oranlarını yönetin</p>
      </div>
      <PrimSettings />
    </div>
  );
};

export default PrimRatesManagement;
