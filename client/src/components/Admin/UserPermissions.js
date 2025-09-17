import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Table, 
  Form, 
  Button,
  Badge,
  Alert,
  Modal
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { FiSettings, FiUser, FiSave, FiX } from 'react-icons/fi';

import { usersAPI, rolesAPI } from '../../utils/api';
import Loading from '../Common/Loading';

const UserPermissions = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [permissions, setPermissions] = useState({});
  const [saving, setSaving] = useState(false);
  const [changingRole, setChangingRole] = useState({});

  useEffect(() => {
    fetchUsers(true); // İlk yüklemede force refresh
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const response = await rolesAPI.getAllRoles();
      setRoles(response.data || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  // Sayfa focus olduğunda yenile
  useEffect(() => {
    const handleFocus = () => {
      fetchUsers(true);
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchUsers = async (forceRefresh = false) => {
    try {
      setLoading(true);
      
      // Cache bypass için timestamp ekle
      const timestamp = forceRefresh ? `?t=${Date.now()}` : '';
      const response = await usersAPI.getAllUsers();
      
      // Admin hariç tüm kullanıcıları göster (yeni sistem)
      const nonAdminUsers = response.data.filter(user => 
        !(user.role && user.role.name === 'admin')
      );
      
      console.log('👥 UserPermissions: Fetched users with roles:', 
        nonAdminUsers.slice(0, 3).map(u => ({
          name: u.name,
          role: u.role?.displayName || 'Rol Yok'
        }))
      );
      
      setUsers(nonAdminUsers);
      setError(null);
    } catch (error) {
      console.error('Users fetch error:', error);
      setError('Kullanıcılar yüklenirken hata oluştu');
      toast.error('Kullanıcılar yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPermissions = (user) => {
    setSelectedUser(user);
    // Yeni sistemde yetkileri rolden al
    const userPermissions = user.role?.permissions || {};
    setPermissions({
      canViewAllSales: userPermissions.canViewAllSales || false,
      canViewAllReports: userPermissions.canViewAllReports || false,
      canViewAllEarnings: userPermissions.canViewAllEarnings || false,
      canViewDashboard: userPermissions.canViewDashboard || true,
      canCreateSales: userPermissions.canCreateSales || true,
      canEditSales: userPermissions.canEditSales || false,
      canDeleteSales: userPermissions.canDeleteSales || false
    });
    setShowModal(true);
  };

  const handleRoleChange = async (userId, newRoleId) => {
    const user = users.find(u => u._id === userId);
    const role = roles.find(r => r._id === newRoleId);
    
    if (!role) {
      toast.error('Rol bulunamadı');
      return;
    }
    
    if (!window.confirm(`${user.name} kullanıcısının rolünü "${role.displayName}" olarak değiştirmek istediğinizden emin misiniz?`)) {
      return;
    }

    setChangingRole(prev => ({ ...prev, [userId]: true }));
    try {
      await usersAPI.changeRole(userId, newRoleId);
      toast.success(`${user.name} kullanıcısının rolü "${role.displayName}" olarak güncellendi`);
      
      // Küçük bir delay sonra verileri yenile
      setTimeout(() => {
        fetchUsers(true);
      }, 500);
      
    } catch (error) {
      console.error('Role change error:', error);
      toast.error(error.response?.data?.message || 'Rol değiştirme sırasında hata oluştu');
    } finally {
      setChangingRole(prev => ({ ...prev, [userId]: false }));
    }
  };

  const handlePermissionChange = (permission, value) => {
    setPermissions(prev => ({
      ...prev,
      [permission]: value
    }));
  };

  const handleSavePermissions = async () => {
    try {
      setSaving(true);
      await usersAPI.updatePermissions(selectedUser._id, permissions);
      
      toast.success('Kullanıcı yetkileri başarıyla güncellendi');
      setShowModal(false);
      setSelectedUser(null);
      
      // Kullanıcı listesini yenile (yeni sistemde rolden yetkileri alacak)
      setTimeout(() => {
        fetchUsers(true);
      }, 500);
      
    } catch (error) {
      console.error('Save permissions error:', error);
      toast.error(error.response?.data?.message || 'Yetkiler güncellenirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const getPermissionBadge = (hasPermission) => {
    return hasPermission ? (
      <Badge bg="success">İzinli</Badge>
    ) : (
      <Badge bg="secondary">İzinsiz</Badge>
    );
  };

  if (loading) {
    return <Loading text="Kullanıcı yetkileri yükleniyor..." />;
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>Kullanıcı Yetkileri</h1>
          <p className="text-muted mb-0">
            Kullanıcıların sistem yetkilerini yönetin
          </p>
        </div>
        <Button 
          variant="outline-primary" 
          onClick={() => fetchUsers(true)}
          disabled={loading}
        >
          <FiSettings className="me-2" />
          Yenile
        </Button>
      </div>

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Users Table */}
      <Card>
        <Card.Header>
          <div className="d-flex align-items-center">
            <FiUser className="me-2" />
            <span>Kullanıcılar ({users.length})</span>
          </div>
        </Card.Header>
        <Card.Body>
          {users.length === 0 ? (
            <Alert variant="info" className="mb-0">
              Henüz aktif kullanıcı bulunmamaktadır.
            </Alert>
          ) : (
            <Table responsive striped hover>
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>E-posta</th>
                  <th>Rol</th>
                  <th>Tüm Satışlar</th>
                  <th>Tüm Raporlar</th>
                  <th>Tüm Primler</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user._id}>
                    <td>
                      <div>
                        <strong>{user.name}</strong>
                        <br />
                        <small className="text-muted">
                          {user.role ? user.role.displayName || user.role.name : 'Rol Atanmamış'}
                        </small>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <div className="d-flex flex-column gap-2">
                        {/* Rol Badge */}
                        {user.role ? (
                          <Badge bg={user.role.name === 'admin' ? 'danger' : 'success'}>
                            {user.role.displayName || user.role.name}
                          </Badge>
                        ) : (
                          <Badge bg="secondary">
                            Rol Atanmamış
                          </Badge>
                        )}
                        
                        {/* Rol Değiştirme Dropdown */}
                        <Form.Select
                          size="sm"
                          value={user.role?._id || ''}
                          onChange={(e) => e.target.value && handleRoleChange(user._id, e.target.value)}
                          disabled={changingRole[user._id]}
                          style={{ fontSize: '0.75rem' }}
                        >
                          <option value="">Rol Seç...</option>
                          {roles.filter(role => role.isActive).map(role => (
                            <option key={role._id} value={role._id}>
                              {role.displayName}
                            </option>
                          ))}
                        </Form.Select>
                      </div>
                    </td>
                    <td>
                      {getPermissionBadge(user.role?.permissions?.canViewAllSales)}
                    </td>
                    <td>
                      {getPermissionBadge(user.role?.permissions?.canViewAllReports)}
                    </td>
                    <td>
                      {getPermissionBadge(user.role?.permissions?.canViewAllEarnings)}
                    </td>
                    <td>
                      {user.role?.name === 'visitor' ? (
                        <Badge bg="info">Sadece Görüntüleme</Badge>
                      ) : user.role?.name === 'admin' ? (
                        <Badge bg="danger">Sistem Yöneticisi</Badge>
                      ) : (
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => handleEditPermissions(user)}
                        >
                          <FiSettings className="me-1" />
                          Yetkileri Düzenle
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Edit Permissions Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <FiSettings className="me-2" />
            Kullanıcı Yetkileri - {selectedUser?.name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row>
            <Col md={6}>
              <h6 className="mb-3">Genel Yetkiler</h6>
              <Form.Check
                type="switch"
                id="canViewAllSales"
                label="Tüm Satışları Görüntüleme"
                checked={permissions.canViewAllSales || false}
                onChange={(e) => handlePermissionChange('canViewAllSales', e.target.checked)}
                className="mb-2"
              />
              <Form.Check
                type="switch"
                id="canViewAllReports"
                label="Tüm Raporları Görüntüleme"
                checked={permissions.canViewAllReports || false}
                onChange={(e) => handlePermissionChange('canViewAllReports', e.target.checked)}
                className="mb-2"
              />
              <Form.Check
                type="switch"
                id="canViewAllEarnings"
                label="Tüm Primleri Görüntüleme"
                checked={permissions.canViewAllEarnings || false}
                onChange={(e) => handlePermissionChange('canViewAllEarnings', e.target.checked)}
                className="mb-2"
              />
            </Col>
            <Col md={6}>
              <h6 className="mb-3">Kişisel Yetkiler</h6>
              <Form.Check
                type="switch"
                id="canViewDashboard"
                label="Dashboard Erişimi"
                checked={permissions.canViewDashboard !== false}
                onChange={(e) => handlePermissionChange('canViewDashboard', e.target.checked)}
                className="mb-2"
              />
              <Form.Check
                type="switch"
                id="canCreateSales"
                label="Satış Oluşturma"
                checked={permissions.canCreateSales !== false}
                onChange={(e) => handlePermissionChange('canCreateSales', e.target.checked)}
                className="mb-2"
              />
              <Form.Check
                type="switch"
                id="canEditSales"
                label="Satış Düzenleme"
                checked={permissions.canEditSales || false}
                onChange={(e) => handlePermissionChange('canEditSales', e.target.checked)}
                className="mb-2"
              />
              <Form.Check
                type="switch"
                id="canDeleteSales"
                label="Satış Silme"
                checked={permissions.canDeleteSales || false}
                onChange={(e) => handlePermissionChange('canDeleteSales', e.target.checked)}
                className="mb-2"
              />
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            <FiX className="me-1" />
            İptal
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSavePermissions}
            disabled={saving}
          >
            <FiSave className="me-1" />
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default UserPermissions;