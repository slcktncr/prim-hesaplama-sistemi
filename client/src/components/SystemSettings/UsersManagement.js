import React from 'react';
import Users from '../Users/Users';

const UsersManagement = () => {
  return (
    <div>
      <div className="mb-4">
        <h4 className="mb-1">Kullanıcı Yönetimi</h4>
        <p className="text-muted mb-0">Sistem kullanıcılarını yönetin</p>
      </div>
      <Users />
    </div>
  );
};

export default UsersManagement;
