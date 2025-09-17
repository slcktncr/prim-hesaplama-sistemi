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
  Modal,
  InputGroup,
  Spinner
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  FiUsers, 
  FiEdit, 
  FiTrash2, 
  FiSearch, 
  FiPlus,
  FiSave,
  FiX,
  FiEye,
  FiEyeOff,
  FiRefreshCw
} from 'react-icons/fi';

import { usersAPI, rolesAPI } from '../../utils/api';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: '',
    isActive: true
  });

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getAllUsers();
      setUsers(response.data || []);
      setError(null);
    } catch (error) {
      console.error('Users fetch error:', error);
      setError('Kullanıcılar yüklenirken hata oluştu');
      toast.error('Kullanıcılar yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await rolesAPI.getAllRoles();
      setRoles(response.data || []);
    } catch (error) {
      console.error('Roles fetch error:', error);
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setFormData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      password: '', // Şifre boş bırakılır, değiştirmek istemeyebilir
      role: user.role?._id || '',
      isActive: user.isActive !== false
    });
    setShowModal(true);
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: '',
      isActive: true
    });
    setShowModal(true);
  };

  const handleSaveUser = async () => {
    try {
      setSaving(true);

      // Validation
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.role) {
        toast.error('Lütfen tüm zorunlu alanları doldurun');
        return;
      }

      if (!editingUser && !formData.password) {
        toast.error('Yeni kullanıcı için şifre zorunludur');
        return;
      }

      const userData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        role: formData.role,
        isActive: formData.isActive
      };

      // Şifre sadece doldurulmuşsa gönder
      if (formData.password) {
        userData.password = formData.password;
      }

      if (editingUser) {
        // Güncelleme
        await usersAPI.updateUser(editingUser._id, userData);
        toast.success('Kullanıcı bilgileri başarıyla güncellendi');
      } else {
        // Yeni kullanıcı
        await usersAPI.createUser(userData);
        toast.success('Kullanıcı başarıyla oluşturuldu');
      }

      setShowModal(false);
      setEditingUser(null);
      fetchUsers();

    } catch (error) {
      console.error('Save user error:', error);
      toast.error(error.response?.data?.message || 'Kullanıcı kaydedilirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`${userName} kullanıcısını silmek istediğinizden emin misiniz?`)) {
      return;
    }

    setActionLoading(prev => ({ ...prev, [userId]: 'delete' }));
    try {
      await usersAPI.deleteUser(userId);
      toast.success('Kullanıcı başarıyla silindi');
      fetchUsers();
    } catch (error) {
      console.error('Delete user error:', error);
      toast.error(error.response?.data?.message || 'Kullanıcı silinirken hata oluştu');
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: null }));
    }
  };

  const handleToggleActive = async (userId, userName, currentStatus) => {
    const action = currentStatus ? 'pasifleştir' : 'aktifleştir';
    if (!window.confirm(`${userName} kullanıcısını ${action}mek istediğinizden emin misiniz?`)) {
      return;
    }

    setActionLoading(prev => ({ ...prev, [userId]: 'toggle' }));
    try {
      await usersAPI.updateUser(userId, { isActive: !currentStatus });
      toast.success(`Kullanıcı başarıyla ${action}ildi`);
      fetchUsers();
    } catch (error) {
      console.error('Toggle user status error:', error);
      toast.error(error.response?.data?.message || 'Kullanıcı durumu değiştirilirken hata oluştu');
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: null }));
    }
  };

  const handleBulkApproveAndActivate = async () => {
    const pendingUsers = users.filter(user => !user.isApproved || !user.isActive);
    
    if (pendingUsers.length === 0) {
      toast.info('Onaylanacak veya aktifleştirilecek kullanıcı bulunamadı');
      return;
    }

    if (!window.confirm(`${pendingUsers.length} kullanıcıyı onaylayıp aktifleştirmek istediğinizden emin misiniz?`)) {
      return;
    }

    setLoading(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const user of pendingUsers) {
        try {
          let needsUpdate = false;
          const updateData = {};

          // Onaylanmamışsa onayla
          if (!user.isApproved) {
            console.log(`🔄 Approving user: ${user.name}`);
            await usersAPI.approveUser(user._id);
            needsUpdate = true;
          }
          
          // Aktif değilse aktifleştir (sadece onaylanmış kullanıcı için)
          if (!user.isActive && (user.isApproved || needsUpdate)) {
            console.log(`🔄 Activating user: ${user.name}`);
            updateData.isActive = true;
          }

          // Eğer sadece aktifleştirme gerekiyorsa
          if (Object.keys(updateData).length > 0) {
            await usersAPI.updateUser(user._id, updateData);
          }

          successCount++;
          console.log(`✅ Successfully processed user: ${user.name}`);
        } catch (error) {
          console.error(`❌ Error processing user ${user.name}:`, error);
          console.error('Error details:', error.response?.data);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} kullanıcı başarıyla onaylandı ve aktifleştirildi`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} kullanıcı işlenirken hata oluştu`);
      }

      // Kullanıcı listesini yenile
      setTimeout(() => {
        fetchUsers();
      }, 500);
    } catch (error) {
      console.error('Bulk approve error:', error);
      toast.error('Toplu onaylama sırasında hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Filtreleme
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !selectedRole || user.role?._id === selectedRole;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" />
        <p className="mt-2">Kullanıcılar yükleniyor...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4>
            <FiUsers className="me-2" />
            Kullanıcı Yönetimi
          </h4>
          <p className="text-muted mb-0">
            Sistem kullanıcılarını yönetin
          </p>
        </div>
        <div className="d-flex gap-2">
          <Button 
            variant="outline-primary" 
            onClick={fetchUsers}
            disabled={loading}
          >
            <FiRefreshCw className="me-2" />
            Yenile
          </Button>
          <Button 
            variant="success" 
            onClick={handleBulkApproveAndActivate}
            disabled={loading}
          >
            <FiEye className="me-2" />
            Tümünü Onayla & Aktifleştir
          </Button>
          <Button 
            variant="primary" 
            onClick={handleCreateUser}
          >
            <FiPlus className="me-2" />
            Yeni Kullanıcı
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <Card.Body>
          <Row>
            <Col md={6}>
              <InputGroup>
                <InputGroup.Text>
                  <FiSearch />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Kullanıcı adı veya e-posta ile ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={4}>
              <Form.Select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value="">Tüm Roller</option>
                {roles.filter(role => role.isActive).map(role => (
                  <option key={role._id} value={role._id}>
                    {role.displayName}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={2}>
              <div className="text-muted">
                <strong>{filteredUsers.length}</strong> kullanıcı
                <br />
                <small>
                  {users.filter(u => !u.isApproved || !u.isActive).length} bekliyor
                </small>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Users Table */}
      <Card>
        <Card.Header>
          <h5 className="mb-0">Kullanıcılar ({filteredUsers.length})</h5>
        </Card.Header>
        <Card.Body>
          {filteredUsers.length === 0 ? (
            <Alert variant="info" className="mb-0">
              {searchTerm || selectedRole ? 'Filtreye uygun kullanıcı bulunamadı.' : 'Henüz kullanıcı bulunmamaktadır.'}
            </Alert>
          ) : (
            <Table responsive striped hover>
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>E-posta</th>
                  <th>Rol</th>
                  <th>Durum</th>
                  <th>Onay</th>
                  <th>Kayıt Tarihi</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user._id}>
                    <td>
                      <div>
                        <strong>{user.name}</strong>
                        <br />
                        <small className="text-muted">
                          {user.firstName} {user.lastName}
                        </small>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      {user.role ? (
                        <Badge bg={
                          user.role.name === 'admin' ? 'danger' : 
                          user.role.name === 'visitor' ? 'secondary' : 'primary'
                        }>
                          {user.role.displayName}
                        </Badge>
                      ) : (
                        <Badge bg="warning">Rol Atanmamış</Badge>
                      )}
                    </td>
                    <td>
                      <Badge bg={user.isActive ? 'success' : 'secondary'}>
                        {user.isActive ? 'Aktif' : 'Pasif'}
                      </Badge>
                    </td>
                    <td>
                      <Badge bg={user.isApproved ? 'success' : 'warning'}>
                        {user.isApproved ? 'Onaylandı' : 'Bekliyor'}
                      </Badge>
                    </td>
                    <td>
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString('tr-TR') : '-'}
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                          disabled={actionLoading[user._id]}
                        >
                          <FiEdit />
                        </Button>
                        <Button
                          variant={user.isActive ? 'outline-warning' : 'outline-success'}
                          size="sm"
                          onClick={() => handleToggleActive(user._id, user.name, user.isActive)}
                          disabled={actionLoading[user._id]}
                        >
                          {actionLoading[user._id] === 'toggle' ? (
                            <Spinner size="sm" animation="border" />
                          ) : user.isActive ? (
                            <FiEyeOff />
                          ) : (
                            <FiEye />
                          )}
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleDeleteUser(user._id, user.name)}
                          disabled={actionLoading[user._id] || user.role?.name === 'admin'}
                        >
                          {actionLoading[user._id] === 'delete' ? (
                            <Spinner size="sm" animation="border" />
                          ) : (
                            <FiTrash2 />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Edit/Create User Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {editingUser ? (
              <>
                <FiEdit className="me-2" />
                Kullanıcı Düzenle - {editingUser.name}
              </>
            ) : (
              <>
                <FiPlus className="me-2" />
                Yeni Kullanıcı Oluştur
              </>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Ad *</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="Kullanıcının adı"
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Soyad *</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Kullanıcının soyadı"
                />
              </Form.Group>
            </Col>
          </Row>

          <Form.Group className="mb-3">
            <Form.Label>E-posta *</Form.Label>
            <Form.Control
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="kullanici@email.com"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>
              Şifre {!editingUser && '*'}
              {editingUser && <small className="text-muted"> (Boş bırakılırsa değiştirilmez)</small>}
            </Form.Label>
            <Form.Control
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              placeholder={editingUser ? "Yeni şifre (opsiyonel)" : "Kullanıcı şifresi"}
            />
          </Form.Group>

          <Row>
            <Col md={8}>
              <Form.Group className="mb-3">
                <Form.Label>Rol *</Form.Label>
                <Form.Select
                  value={formData.role}
                  onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                >
                  <option value="">Rol seçiniz...</option>
                  {roles.filter(role => role.isActive).map(role => (
                    <option key={role._id} value={role._id}>
                      {role.displayName}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Durum</Form.Label>
                <Form.Check
                  type="switch"
                  id="isActive"
                  label={formData.isActive ? 'Aktif' : 'Pasif'}
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                />
              </Form.Group>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            <FiX className="me-2" />
            İptal
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSaveUser}
            disabled={saving}
          >
            {saving ? (
              <Spinner size="sm" animation="border" className="me-2" />
            ) : (
              <FiSave className="me-2" />
            )}
            {editingUser ? 'Güncelle' : 'Oluştur'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default UserManagement;
