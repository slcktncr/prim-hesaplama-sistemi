import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Button, Badge, Alert, Spinner, Dropdown } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { FiUsers, FiUser, FiShield, FiMoreVertical } from 'react-icons/fi';
import API from '../../utils/api';

const ActiveUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await API.get('/users');
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
    const roleText = newRole === 'admin' ? 'Admin' : 'Satış Temsilcisi';
    
    if (!window.confirm(`${user.name} kullanıcısının rolünü "${roleText}" olarak değiştirmek istediğinizden emin misiniz?`)) {
      return;
    }

    setActionLoading(prev => ({ ...prev, [userId]: 'role' }));
    try {
      await API.put(`/users/${userId}/role`, { role: newRole });
      toast.success(`Kullanıcı rolü ${roleText} olarak güncellendi`);
      fetchUsers();
    } catch (error) {
      console.error('Role change error:', error);
      toast.error(error.response?.data?.message || 'Rol değiştirme sırasında hata oluştu');
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: null }));
    }
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
                            <Badge bg={user.role === 'admin' ? 'danger' : 'primary'}>
                              {user.role === 'admin' ? 'Admin' : 'Satış Temsilcisi'}
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
    </Container>
  );
};

export default ActiveUsers;
