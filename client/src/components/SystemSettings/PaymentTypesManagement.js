import React from 'react';
import PaymentMethods from '../Admin/PaymentMethods';

const PaymentTypesManagement = () => {
  return (
    <div>
      <div className="mb-4">
        <h4 className="mb-1">Ödeme Yöntemleri</h4>
        <p className="text-muted mb-0">Sistem genelinde kullanılacak ödeme yöntemlerini yönetin</p>
      </div>
      <PaymentMethods />
    </div>
  );
};

export default PaymentTypesManagement;
