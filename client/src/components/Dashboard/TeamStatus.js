import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Table, 
  Badge, 
  Button,
  Alert,
  Modal,
  Form
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  FiUsers, 
  FiUserCheck, 
  FiUserX, 
  FiHeart,
  FiRefreshCw,
  FiEdit,
  FiClock,
  FiCalendar
} from 'react-icons/fi';

import { dailyStatusAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { formatDate, formatDateTime, formatLocalDate } from '../../utils/helpers';
import Loading from '../Common/Loading';

const TeamStatus = () => {
  const { user } = useAuth();
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [adminFormData, setAdminFormData] = useState({
    status: 'mesaide',
    statusNote: '',
    date: formatLocalDate(new Date())
  });

  useEffect(() => {
    fetchTeamStatus();
    
    // Her 5 dakikada bir otomatik yenile
    const interval = setInterval(fetchTeamStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchTeamStatus = async () => {
    try {
      setLoading(true);
      const response = await dailyStatusAPI.getTeamStatus();
      setTeamData(response.data);
    } catch (error) {
      console.error('Team status fetch error:', error);
      toast.error('Takım durumları yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminStatusChange = async () => {
    try {
      const response = await dailyStatusAPI.adminSetStatus(
        selectedUser._id,
        adminFormData.status,
        adminFormData.statusNote,
        adminFormData.date
      );
      
      toast.success(response.data.message);
      setShowAdminModal(false);
      fetchTeamStatus();
      
    } catch (error) {
      console.error('Admin status change error:', error);
      toast.error(error.response?.data?.message || 'Durum değiştirilemedi');
    }
  };

  const openAdminModal = (teamMember) => {
    setSelectedUser(teamMember);
    setAdminFormData({
      status: teamMember.status,
      statusNote: teamMember.statusNote || '',
      date: formatLocalDate(new Date())
    });
    setShowAdminModal(true);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'mesaide':
        return <FiUserCheck className="text-success" />;
      case 'izinli':
        return <FiUserX className="text-warning" />;
      case 'hastalik':
        return <FiHeart className="text-danger" />;
      default:
        return <FiUsers className="text-secondary" />;
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      'mesaide': 'success',
      'izinli': 'warning',
      'hastalik': 'danger'
    };
    
    const labels = {
      'mesaide': 'Mesaide',
      'izinli': 'İzinli',
      'hastalik': 'Hastalık'
    };

    return (
      <Badge bg={variants[status] || 'secondary'}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (loading) {
    return <Loading variant="dots" size="large" />;
  }

  if (!teamData) {
    return (
      <Alert variant="warning">
        <FiUsers className="me-2" />
        Takım durumu bilgileri yüklenemedi.
      </Alert>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4>
            <FiUsers className="me-2" />
            Takım Durumları
          </h4>
          <p className="text-muted mb-0">
            Bugün ({formatDate(teamData.date)}) takım üyelerinin durumları
          </p>
        </div>
        <Button variant="outline-primary" onClick={fetchTeamStatus}>
          <FiRefreshCw className="me-1" />
          Yenile
        </Button>
      </div>

      {/* Statistics Cards */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="border-success">
            <Card.Body className="text-center">
              <FiUserCheck size={24} className="text-success mb-2" />
              <h3 className="text-success mb-1">{teamData.stats.mesaide}</h3>
              <small className="text-muted">Mesaide</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-warning">
            <Card.Body className="text-center">
              <FiUserX size={24} className="text-warning mb-2" />
              <h3 className="text-warning mb-1">{teamData.stats.izinli}</h3>
              <small className="text-muted">İzinli</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-danger">
            <Card.Body className="text-center">
              <FiHeart size={24} className="text-danger mb-2" />
              <h3 className="text-danger mb-1">{teamData.stats.hastalik}</h3>
              <small className="text-muted">Hastalık</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="border-primary">
            <Card.Body className="text-center">
              <FiUsers size={24} className="text-primary mb-2" />
              <h3 className="text-primary mb-1">{teamData.stats.total}</h3>
              <small className="text-muted">Toplam</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Team Status Table */}
      <Card>
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <h6 className="mb-0">Takım Üyeleri</h6>
            <Badge bg="primary">{teamData.teamStatus.length} kişi</Badge>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0">
            <thead className="table-light">
              <tr>
                <th>Temsilci</th>
                <th>Durum</th>
                <th>Not</th>
                <th>Ayarlanma Zamanı</th>
                <th>Ceza Muafiyeti</th>
                {user?.role && user.role.name === 'admin' && <th>İşlemler</th>}
              </tr>
            </thead>
            <tbody>
              {teamData.teamStatus.map((member) => (
                <tr key={member._id}>
                  <td>
                    <div>
                      <div className="fw-bold d-flex align-items-center">
                        {getStatusIcon(member.status)}
                        <span className="ms-2">{member.name}</span>
                      </div>
                      <small className="text-muted">{member.email}</small>
                    </div>
                  </td>
                  <td>
                    {getStatusBadge(member.status)}
                  </td>
                  <td>
                    {member.statusNote ? (
                      <small className="text-muted">{member.statusNote}</small>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td>
                    {member.statusSetAt ? (
                      <small className="text-muted">
                        <FiClock className="me-1" />
                        {formatDateTime(member.statusSetAt)}
                      </small>
                    ) : (
                      <small className="text-muted">Varsayılan</small>
                    )}
                  </td>
                  <td>
                    {member.isPenaltyExempt ? (
                      <Badge bg="success" className="small">Muaf</Badge>
                    ) : (
                      <Badge bg="secondary" className="small">Normal</Badge>
                    )}
                  </td>
                  {user?.role && user.role.name === 'admin' && (
                    <td>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => openAdminModal(member)}
                      >
                        <FiEdit className="me-1" />
                        Düzenle
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* Admin Status Change Modal */}
      {user?.role && user.role.name === 'admin' && (
        <Modal show={showAdminModal} onHide={() => setShowAdminModal(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title>
              <FiEdit className="me-2" />
              Durum Düzenle - {selectedUser?.name}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {selectedUser && (
              <>
                <Alert variant="info" className="mb-3">
                  <strong>Kullanıcı:</strong> {selectedUser.name} ({selectedUser.email})
                </Alert>

                <Form>
                  <Form.Group className="mb-3">
                    <Form.Label>Tarih</Form.Label>
                    <Form.Control
                      type="date"
                      value={adminFormData.date}
                      onChange={(e) => setAdminFormData(prev => ({ 
                        ...prev, 
                        date: e.target.value 
                      }))}
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Durum</Form.Label>
                    <Form.Select
                      value={adminFormData.status}
                      onChange={(e) => setAdminFormData(prev => ({ 
                        ...prev, 
                        status: e.target.value 
                      }))}
                    >
                      <option value="mesaide">Mesaide</option>
                      <option value="izinli">İzinli</option>
                      <option value="hastalik">Hastalık İzni</option>
                      <option value="resmi_tatil">Resmi Tatil</option>
                    </Form.Select>
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Not</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={adminFormData.statusNote}
                      onChange={(e) => setAdminFormData(prev => ({ 
                        ...prev, 
                        statusNote: e.target.value 
                      }))}
                      placeholder="Durum açıklaması (isteğe bağlı)"
                      maxLength={200}
                    />
                  </Form.Group>

                  {adminFormData.status !== 'mesaide' && (
                    <Alert variant="warning">
                      <strong>Uyarı:</strong> Bu durumda kullanıcı günlük iletişim kaydı girmek zorunda olmayacak ve ceza puanı almayacaktır.
                    </Alert>
                  )}
                </Form>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowAdminModal(false)}>
              İptal
            </Button>
            <Button variant="primary" onClick={handleAdminStatusChange}>
              Kaydet
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
};

export default TeamStatus;
