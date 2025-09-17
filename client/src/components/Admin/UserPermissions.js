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

import { usersAPI } from '../../utils/api';
import Loading from '../Common/Loading';

const UserPermissions = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [permissions, setPermissions] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getAllUsers();
      // Admin hariç tüm kullanıcıları göster (yeni sistem)
      const nonAdminUsers = response.data.filter(user => 
        !(user.role && user.role.name === 'admin')
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
    setPermissions(user.permissions || {
      canViewAllSales: false,
      canViewAllReports: false,
      canViewAllPrims: false,
      canViewDashboard: true,
      canManageOwnSales: true,
      canViewOwnReports: true,
      canViewOwnPrims: true
    });
    setShowModal(true);
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
      
      // Kullanıcı listesini güncelle
      setUsers(prev => prev.map(user => 
        user._id === selectedUser._id 
          ? { ...user, permissions }
          : user
      ));
      
      toast.success('Kullanıcı yetkileri başarıyla güncellendi');
      setShowModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Save permissions error:', error);
      toast.error('Yetkiler güncellenirken hata oluştu');
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
                      <div className="d-flex flex-column gap-1">
                        {/* Yeni rol sistemi */}
                        {user.role ? (
                          <Badge bg={user.role.name === 'admin' ? 'danger' : 'success'}>
                            {user.role.displayName || user.role.name}
                          </Badge>
                        ) : (
                          <Badge bg="secondary">
                            Rol Atanmamış
                          </Badge>
                        )}
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
                id="canViewAllPrims"
                label="Tüm Primleri Görüntüleme"
                checked={permissions.canViewAllPrims || false}
                onChange={(e) => handlePermissionChange('canViewAllPrims', e.target.checked)}
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
                id="canManageOwnSales"
                label="Kendi Satışlarını Yönetme"
                checked={permissions.canManageOwnSales !== false}
                onChange={(e) => handlePermissionChange('canManageOwnSales', e.target.checked)}
                className="mb-2"
              />
              <Form.Check
                type="switch"
                id="canViewOwnReports"
                label="Kendi Raporlarını Görüntüleme"
                checked={permissions.canViewOwnReports !== false}
                onChange={(e) => handlePermissionChange('canViewOwnReports', e.target.checked)}
                className="mb-2"
              />
              <Form.Check
                type="switch"
                id="canViewOwnPrims"
                label="Kendi Primlerini Görüntüleme"
                checked={permissions.canViewOwnPrims !== false}
                onChange={(e) => handlePermissionChange('canViewOwnPrims', e.target.checked)}
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