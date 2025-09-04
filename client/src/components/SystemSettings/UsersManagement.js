import React from 'react';
import ActiveUsers from '../Admin/ActiveUsers';

const UsersManagement = () => {
  return (
    <div>
      <div className="mb-4">
        <h4 className="mb-1">Kullanıcı Yönetimi</h4>
        <p className="text-muted mb-0">Sistem kullanıcılarını yönetin</p>
      </div>
      <ActiveUsers />
    </div>
  );
};

export default UsersManagement;
