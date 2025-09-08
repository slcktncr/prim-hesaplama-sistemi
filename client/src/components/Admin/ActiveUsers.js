import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Button, Badge, Alert, Spinner, Dropdown, Modal, Form } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { FiUsers, FiUser, FiShield, FiMoreVertical, FiEdit, FiCheck, FiX, FiEye } from 'react-icons/fi';
import { usersAPI } from '../../utils/api';

const ActiveUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'salesperson',
    isActive: true
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await usersAPI.getAllUsers();
      setUsers(response.data);
    } catch (error) {
      console.error('Users fetch error:', error);
      toast.error('Kullanıcılar yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    const user = users.find(u => u._id === userId);
    const roleText = newRole === 'admin' ? 'Admin' : 
                     newRole === 'visitor' ? 'Ziyaretçi' : 'Satış Temsilcisi';
    
    if (!window.confirm(`${user.name} kullanıcısının rolünü "${roleText}" olarak değiştirmek istediğinizden emin misiniz?`)) {
      return;
    }

    setActionLoading(prev => ({ ...prev, [userId]: 'role' }));
    try {
      await usersAPI.changeRole(userId, newRole);
      toast.success(`Kullanıcı rolü ${roleText} olarak güncellendi`);
      fetchUsers();
    } catch (error) {
      console.error('Role change error:', error);
      toast.error(error.response?.data?.message || 'Rol değiştirme sırasında hata oluştu');
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: null }));
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setFormData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      role: user.role || 'salesperson',
      isActive: user.isActive !== false
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    
    try {
      setActionLoading(prev => ({ ...prev, [editingUser._id]: 'update' }));
      await usersAPI.updateUser(editingUser._id, formData);
      toast.success('Kullanıcı bilgileri başarıyla güncellendi');
      fetchUsers();
      setShowEditModal(false);
      setEditingUser(null);
    } catch (error) {
      console.error('Update user error:', error);
      toast.error(error.response?.data?.message || 'Kullanıcı güncellenirken hata oluştu');
    } finally {
      setActionLoading(prev => ({ ...prev, [editingUser._id]: null }));
    }
  };

  const handleCloseModal = () => {
    setShowEditModal(false);
    setEditingUser(null);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      role: 'salesperson',
      isActive: true
    });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '200px' }}>
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Yükleniyor...</span>
        </Spinner>
      </Container>
    );
  }

  return (
    <Container fluid>
      <Row>
        <Col>
          <Card>
            <Card.Header className="bg-success text-white">
              <div className="d-flex align-items-center">
                <FiUsers className="me-2" />
                <h5 className="mb-0">Aktif Kullanıcılar</h5>
                <Badge bg="dark" className="ms-2">{users.length}</Badge>
              </div>
            </Card.Header>
            <Card.Body>
              {users.length === 0 ? (
                <Alert variant="info" className="text-center">
                  <FiUser size={48} className="mb-3" />
                  <h6>Aktif kullanıcı bulunmuyor</h6>
                  <p className="mb-0">Henüz onaylanmış kullanıcı bulunmamaktadır.</p>
                </Alert>
              ) : (
                <div className="table-responsive">
                  <Table striped hover>
                    <thead>
                      <tr>
                        <th>Ad Soyad</th>
                        <th>Email</th>
                        <th>Rol</th>
                        <th>Kayıt Tarihi</th>
                        <th>İşlemler</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user._id}>
                          <td>
                            <strong>{user.name}</strong>
                          </td>
                          <td>{user.email}</td>
                          <td>
                            <Badge bg={
                              user.role === 'admin' ? 'danger' : 
                              user.role === 'visitor' ? 'secondary' : 'primary'
                            }>
                              {user.role === 'admin' ? 'Admin' : 
                               user.role === 'visitor' ? 'Ziyaretçi' : 'Satış Temsilcisi'}
                            </Badge>
                          </td>
                          <td>{formatDate(user.createdAt)}</td>
                          <td>
                            <Dropdown align="end">
                              <Dropdown.Toggle 
                                variant="outline-secondary" 
                                size="sm"
                                disabled={actionLoading[user._id]}
                              >
                                {actionLoading[user._id] ? (
                                  <Spinner animation="border" size="sm" />
                                ) : (
                                  <FiMoreVertical />
                                )}
                              </Dropdown.Toggle>

                              <Dropdown.Menu>
                                <Dropdown.Item 
                                  onClick={() => handleEditUser(user)}
                                >
                                  <FiEdit className="me-2" />
                                  Düzenle
                                </Dropdown.Item>
                                
                                <Dropdown.Divider />
                                <Dropdown.Header>Rol Değiştir</Dropdown.Header>
                                
                                {user.role !== 'admin' && (
                                  <Dropdown.Item 
                                    onClick={() => handleRoleChange(user._id, 'admin')}
                                  >
                                    <FiShield className="me-2" />
                                    Admin Yap
                                  </Dropdown.Item>
                                )}
                                
                                {user.role !== 'salesperson' && (
                                  <Dropdown.Item 
                                    onClick={() => handleRoleChange(user._id, 'salesperson')}
                                  >
                                    <FiUser className="me-2" />
                                    Satış Temsilcisi Yap
                                  </Dropdown.Item>
                                )}
                                
                                {user.role !== 'visitor' && (
                                  <Dropdown.Item 
                                    onClick={() => handleRoleChange(user._id, 'visitor')}
                                  >
                                    <FiEye className="me-2" />
                                    Ziyaretçi Yap
                                  </Dropdown.Item>
                                )}
                              </Dropdown.Menu>
                            </Dropdown>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Edit User Modal */}
      <Modal show={showEditModal} onHide={handleCloseModal} size="lg">
        <Form onSubmit={handleUpdateUser}>
          <Modal.Header closeButton>
            <Modal.Title>Kullanıcı Bilgilerini Düzenle</Modal.Title>
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
                    required
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
                    required
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Email *</Form.Label>
                  <Form.Control
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Rol *</Form.Label>
                  <Form.Select
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                    required
                  >
                    <option value="salesperson">Satış Temsilcisi</option>
                    <option value="visitor">Ziyaretçi</option>
                    <option value="admin">Admin</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={12}>
                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label="Aktif kullanıcı"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  />
                  <Form.Text className="text-muted">
                    Pasif kullanıcılar sisteme giriş yapamaz
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              <FiX className="me-2" />
              İptal
            </Button>
            <Button 
              variant="primary" 
              type="submit"
              disabled={actionLoading[editingUser?._id] === 'update'}
            >
              {actionLoading[editingUser?._id] === 'update' ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Güncelleniyor...
                </>
              ) : (
                <>
                  <FiCheck className="me-2" />
                  Güncelle
                </>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default ActiveUsers;
