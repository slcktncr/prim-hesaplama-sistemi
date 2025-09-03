import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Button, Badge, Alert, Spinner } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { FiCheck, FiX, FiClock, FiUser } from 'react-icons/fi';
import API from '../../utils/api';

const PendingUsers = () => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      const response = await API.get('/users/pending');
      setPendingUsers(response.data);
    } catch (error) {
      console.error('Pending users fetch error:', error);
      toast.error('Bekleyen kullanıcılar yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId) => {
    setActionLoading(prev => ({ ...prev, [userId]: 'approving' }));
    try {
      await API.put(`/users/${userId}/approve`);
      toast.success('Kullanıcı başarıyla onaylandı');
      fetchPendingUsers();
    } catch (error) {
      console.error('Approve error:', error);
      toast.error(error.response?.data?.message || 'Onaylama sırasında hata oluştu');
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: null }));
    }
  };

  const handleReject = async (userId) => {
    if (!window.confirm('Bu kullanıcı kaydını reddetmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
      return;
    }

    setActionLoading(prev => ({ ...prev, [userId]: 'rejecting' }));
    try {
      await API.delete(`/users/${userId}/reject`);
      toast.success('Kullanıcı kaydı reddedildi');
      fetchPendingUsers();
    } catch (error) {
      console.error('Reject error:', error);
      toast.error(error.response?.data?.message || 'Reddetme sırasında hata oluştu');
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: null }));
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
            <Card.Header className="bg-warning text-dark">
              <div className="d-flex align-items-center">
                <FiClock className="me-2" />
                <h5 className="mb-0">Onay Bekleyen Kullanıcılar</h5>
                <Badge bg="dark" className="ms-2">{pendingUsers.length}</Badge>
              </div>
            </Card.Header>
            <Card.Body>
              {pendingUsers.length === 0 ? (
                <Alert variant="info" className="text-center">
                  <FiUser size={48} className="mb-3" />
                  <h6>Onay bekleyen kullanıcı bulunmuyor</h6>
                  <p className="mb-0">Tüm kullanıcı kayıtları onaylanmış durumda.</p>
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
                      {pendingUsers.map((user) => (
                        <tr key={user._id}>
                          <td>
                            <strong>{user.firstName} {user.lastName}</strong>
                          </td>
                          <td>{user.email}</td>
                                                <td>
                        <Badge bg="primary">
                          Satış Temsilcisi
                        </Badge>
                        <div className="mt-1">
                          <small className="text-muted">
                            Admin yetkisi onay sonrası verilebilir
                          </small>
                        </div>
                      </td>
                          <td>{formatDate(user.createdAt)}</td>
                          <td>
                            <div className="d-flex gap-2">
                              <Button
                                variant="success"
                                size="sm"
                                onClick={() => handleApprove(user._id)}
                                disabled={actionLoading[user._id]}
                              >
                                {actionLoading[user._id] === 'approving' ? (
                                  <Spinner animation="border" size="sm" />
                                ) : (
                                  <>
                                    <FiCheck className="me-1" />
                                    Onayla
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleReject(user._id)}
                                disabled={actionLoading[user._id]}
                              >
                                {actionLoading[user._id] === 'rejecting' ? (
                                  <Spinner animation="border" size="sm" />
                                ) : (
                                  <>
                                    <FiX className="me-1" />
                                    Reddet
                                  </>
                                )}
                              </Button>
                            </div>
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

export default PendingUsers;
