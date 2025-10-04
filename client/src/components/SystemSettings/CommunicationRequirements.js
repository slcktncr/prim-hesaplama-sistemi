import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Badge, 
  Modal, 
  Form, 
  Alert,
  Row,
  Col,
  Nav,
  Tab
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  FiUsers, 
  FiEdit, 
  FiCheck, 
  FiX, 
  FiAlertTriangle,
  FiInfo,
  FiSettings,
  FiClock,
  FiList
} from 'react-icons/fi';

import { usersAPI, communicationYearAPI } from '../../utils/api';
import { formatDate } from '../../utils/helpers';
import Loading from '../Common/Loading';
import CommunicationTypesManagement from './CommunicationTypesManagement';

const CommunicationRequirements = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({
    requiresCommunicationEntry: true,
    exemptReason: ''
  });
  const [settingsData, setSettingsData] = useState({
    entryDeadlineHour: 23,
    dailyEntryRequired: true,
    penaltySystemActive: true,
    dailyPenaltyPoints: 10,
    maxPenaltyPoints: 100
  });

  useEffect(() => {
    fetchCommunicationSettings();
    fetchYearSettings();
  }, []);

  const fetchCommunicationSettings = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getCommunicationSettings();
      setUsers(response.data || []);
    } catch (error) {
      console.error('Communication settings fetch error:', error);
      toast.error('İletişim ayarları yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const fetchYearSettings = async () => {
    try {
      const response = await communicationYearAPI.getCurrentSettings();
      setSettingsData(response.data.settings);
    } catch (error) {
      console.error('Year settings fetch error:', error);
      toast.error('Yıl ayarları yüklenirken hata oluştu');
    }
  };

  const handleEditRequirement = (user) => {
    setSelectedUser(user);
    setFormData({
      requiresCommunicationEntry: user.requiresCommunicationEntry,
      exemptReason: user.communicationExemptReason || ''
    });
    setShowModal(true);
  };

  const handleSaveRequirement = async () => {
    try {
      if (!formData.requiresCommunicationEntry && !formData.exemptReason.trim()) {
        toast.error('Muafiyet sebebi giriniz');
        return;
      }

      await usersAPI.updateCommunicationRequirement(selectedUser._id, formData);
      
      toast.success(
        formData.requiresCommunicationEntry 
          ? 'İletişim kaydı zorunluluğu aktifleştirildi'
          : 'İletişim kaydı zorunluluğu kaldırıldı'
      );
      
      setShowModal(false);
      fetchCommunicationSettings();
      
    } catch (error) {
      console.error('Update communication requirement error:', error);
      toast.error('Ayar güncellenirken hata oluştu');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedUser(null);
    setFormData({
      requiresCommunicationEntry: true,
      exemptReason: ''
    });
  };

  const handleSaveSettings = async () => {
    try {
      await communicationYearAPI.updateSettings(settingsData);
      toast.success('İletişim ayarları başarıyla güncellendi');
      setShowSettingsModal(false);
      fetchYearSettings();
    } catch (error) {
      console.error('Update settings error:', error);
      toast.error('Ayarlar güncellenirken hata oluştu');
    }
  };

  const handleOpenSettingsModal = () => {
    setShowSettingsModal(true);
  };

  const handleCloseSettingsModal = () => {
    setShowSettingsModal(false);
    fetchYearSettings(); // Reset to original values
  };

  const getStatusBadge = (user) => {
    if (!user.isActive) {
      return <Badge bg="secondary">Pasif</Badge>;
    }
    
    if (user.requiresCommunicationEntry) {
      return <Badge bg="success">Zorunlu</Badge>;
    } else {
      return <Badge bg="warning">Muaf</Badge>;
    }
  };

  const getStatusColor = (user) => {
    if (!user.isActive) return 'table-secondary';
    if (user.requiresCommunicationEntry) return '';
    return 'table-warning';
  };

  if (loading) {
    return <Loading variant="dots" size="large" />;
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4>
            <FiUsers className="me-2" />
            İletişim Yönetimi
          </h4>
          <p className="text-muted mb-0">
            İletişim türleri ve zorunlulukları yönetin
          </p>
        </div>
        <Button 
          variant="outline-primary" 
          onClick={handleOpenSettingsModal}
          className="d-flex align-items-center"
        >
          <FiSettings className="me-2" />
          İletişim Ayarları
        </Button>
      </div>

      {/* Tab Navigation */}
      <Tab.Container defaultActiveKey="requirements">
        <Nav variant="tabs" className="mb-4">
          <Nav.Item>
            <Nav.Link eventKey="requirements">
              <FiUsers className="me-1" />
              Zorunluluklar
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="types">
              <FiList className="me-1" />
              İletişim Türleri
            </Nav.Link>
          </Nav.Item>
        </Nav>

        <Tab.Content>
          <Tab.Pane eventKey="requirements">

      {/* Info Alert */}
      <Alert variant="info" className="mb-4">
        <FiInfo className="me-2" />
        <strong>Bilgi:</strong> İletişim kaydı zorunlu olmayan kullanıcılar günlük veri girişi yapmak zorunda değildir ve ceza puanı almazlar.
      </Alert>

      {/* Users Table */}
      <Card>
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <h6 className="mb-0">Temsilci Listesi</h6>
            <Badge bg="primary">{users.length} temsilci</Badge>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0">
            <thead className="table-light">
              <tr>
                <th>Temsilci</th>
                <th>Email</th>
                <th>Hesap Durumu</th>
                <th>İletişim Zorunluluğu</th>
                <th>Muafiyet Bilgisi</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id} className={getStatusColor(user)}>
                  <td>
                    <div className="fw-bold">{user.name}</div>
                  </td>
                  <td>
                    <small className="text-muted">{user.email}</small>
                  </td>
                  <td>
                    {user.isActive ? (
                      <Badge bg="success">Aktif</Badge>
                    ) : (
                      <Badge bg="secondary">Pasif</Badge>
                    )}
                  </td>
                  <td>
                    {getStatusBadge(user)}
                  </td>
                  <td>
                    {!user.requiresCommunicationEntry && user.communicationExemptReason ? (
                      <div>
                        <div className="small fw-bold text-warning">
                          {user.communicationExemptReason}
                        </div>
                        <div className="small text-muted">
                          {user.communicationExemptBy?.name} - {formatDate(user.communicationExemptAt)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => handleEditRequirement(user)}
                      disabled={!user.isActive}
                    >
                      <FiEdit className="me-1" />
                      Düzenle
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* Edit Modal */}
      <Modal show={showModal} onHide={handleCloseModal}>
        <Modal.Header closeButton>
          <Modal.Title>
            <FiEdit className="me-2" />
            İletişim Zorunluluğu Düzenle
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedUser && (
            <>
              <Alert variant="info" className="mb-3">
                <strong>Temsilci:</strong> {selectedUser.name} ({selectedUser.email})
              </Alert>

              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>İletişim Kaydı Durumu</Form.Label>
                  <div>
                    <Form.Check
                      type="radio"
                      id="required"
                      name="communicationRequirement"
                      label="Zorunlu - Günlük iletişim kaydı girmeli"
                      checked={formData.requiresCommunicationEntry}
                      onChange={() => setFormData(prev => ({ 
                        ...prev, 
                        requiresCommunicationEntry: true,
                        exemptReason: ''
                      }))}
                    />
                    <Form.Check
                      type="radio"
                      id="exempt"
                      name="communicationRequirement"
                      label="Muaf - İletişim kaydı girmek zorunda değil"
                      checked={!formData.requiresCommunicationEntry}
                      onChange={() => setFormData(prev => ({ 
                        ...prev, 
                        requiresCommunicationEntry: false 
                      }))}
                    />
                  </div>
                </Form.Group>

                {!formData.requiresCommunicationEntry && (
                  <Form.Group className="mb-3">
                    <Form.Label>Muafiyet Sebebi *</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={formData.exemptReason}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        exemptReason: e.target.value 
                      }))}
                      placeholder="Neden iletişim kaydı girme zorunluluğu kaldırılıyor?"
                    />
                    <Form.Text className="text-muted">
                      Örnek: Yönetici pozisyonu, farklı görev tanımı, vb.
                    </Form.Text>
                  </Form.Group>
                )}

                {!formData.requiresCommunicationEntry && (
                  <Alert variant="warning">
                    <FiAlertTriangle className="me-2" />
                    <strong>Uyarı:</strong> Bu temsilci artık günlük iletişim kaydı girmek zorunda olmayacak ve ceza puanı almayacaktır.
                  </Alert>
                )}
              </Form>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>
            <FiX className="me-1" />
            İptal
          </Button>
          <Button variant="primary" onClick={handleSaveRequirement}>
            <FiCheck className="me-1" />
            Kaydet
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Settings Modal */}
      <Modal show={showSettingsModal} onHide={handleCloseSettingsModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <FiSettings className="me-2" />
            İletişim Ayarları
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info" className="mb-4">
            <FiInfo className="me-2" />
            <strong>Bilgi:</strong> Bu ayarlar tüm temsilciler için geçerlidir ve anında etkili olur.
          </Alert>

          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FiClock className="me-2" />
                    Son Giriş Saati
                  </Form.Label>
                  <Form.Select
                    value={settingsData.entryDeadlineHour}
                    onChange={(e) => setSettingsData(prev => ({ 
                      ...prev, 
                      entryDeadlineHour: parseInt(e.target.value) 
                    }))}
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>
                        {i.toString().padStart(2, '0')}:00
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Temsilciler bu saate kadar günlük veri girişi yapmalıdır
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Günlük Giriş Zorunluluğu</Form.Label>
                  <div>
                    <Form.Check
                      type="radio"
                      id="dailyRequired"
                      name="dailyEntryRequired"
                      label="Zorunlu - Her gün veri girişi yapılmalı"
                      checked={settingsData.dailyEntryRequired}
                      onChange={() => setSettingsData(prev => ({ 
                        ...prev, 
                        dailyEntryRequired: true 
                      }))}
                    />
                    <Form.Check
                      type="radio"
                      id="dailyOptional"
                      name="dailyEntryRequired"
                      label="Opsiyonel - Veri girişi isteğe bağlı"
                      checked={!settingsData.dailyEntryRequired}
                      onChange={() => setSettingsData(prev => ({ 
                        ...prev, 
                        dailyEntryRequired: false 
                      }))}
                    />
                  </div>
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Ceza Sistemi</Form.Label>
                  <div>
                    <Form.Check
                      type="radio"
                      id="penaltyActive"
                      name="penaltySystemActive"
                      label="Aktif - Ceza puanı sistemi çalışsın"
                      checked={settingsData.penaltySystemActive}
                      onChange={() => setSettingsData(prev => ({ 
                        ...prev, 
                        penaltySystemActive: true 
                      }))}
                    />
                    <Form.Check
                      type="radio"
                      id="penaltyInactive"
                      name="penaltySystemActive"
                      label="Pasif - Ceza puanı sistemi çalışmasın"
                      checked={!settingsData.penaltySystemActive}
                      onChange={() => setSettingsData(prev => ({ 
                        ...prev, 
                        penaltySystemActive: false 
                      }))}
                    />
                  </div>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Günlük Ceza Puanı</Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    value={settingsData.dailyPenaltyPoints}
                    onChange={(e) => setSettingsData(prev => ({ 
                      ...prev, 
                      dailyPenaltyPoints: parseInt(e.target.value) || 0 
                    }))}
                    disabled={!settingsData.penaltySystemActive}
                  />
                  <Form.Text className="text-muted">
                    Veri girişi yapmayan temsilciye günlük verilecek ceza puanı
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Maksimum Ceza Puanı</Form.Label>
                  <Form.Control
                    type="number"
                    min="0"
                    value={settingsData.maxPenaltyPoints}
                    onChange={(e) => setSettingsData(prev => ({ 
                      ...prev, 
                      maxPenaltyPoints: parseInt(e.target.value) || 0 
                    }))}
                    disabled={!settingsData.penaltySystemActive}
                  />
                  <Form.Text className="text-muted">
                    Bu puanı aşan temsilcilerin hesabı pasife alınır
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>

            {settingsData.penaltySystemActive && (
              <Alert variant="warning">
                <FiAlertTriangle className="me-2" />
                <strong>Uyarı:</strong> Ceza sistemi aktif olduğunda, veri girişi yapmayan temsilciler ceza puanı alacaktır.
              </Alert>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseSettingsModal}>
            <FiX className="me-1" />
            İptal
          </Button>
          <Button variant="primary" onClick={handleSaveSettings}>
            <FiCheck className="me-1" />
            Kaydet
          </Button>
        </Modal.Footer>
      </Modal>

          </Tab.Pane>
          
          <Tab.Pane eventKey="types">
            <CommunicationTypesManagement />
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>
    </div>
  );
};

export default CommunicationRequirements;
