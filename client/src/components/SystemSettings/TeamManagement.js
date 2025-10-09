import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Badge,
  Alert,
  Spinner,
  Row,
  Col,
  Tabs,
  Tab
} from 'react-bootstrap';
import {
  FiUsers,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiUserPlus,
  FiUserMinus,
  FiTrendingUp,
  FiSettings
} from 'react-icons/fi';
import api from '../../utils/api';

const TeamManagement = () => {
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    teamLeader: '',
    members: [],
    performanceSettings: {
      phoneCallTarget: 50,
      inPersonMeetingTarget: 10,
      salesTarget: 5,
      meetingToSalesRatio: 0.5,
      phoneToMeetingRatio: 0.2
    },
    isActive: true
  });

  useEffect(() => {
    fetchTeams();
    fetchUsers();
  }, []);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const response = await api.get('/teams');
      setTeams(response.data.data);
      setError(null);
    } catch (err) {
      console.error('Takım listesi hatası:', err);
      setError('Takımlar yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      // Sadece aktif kullanıcıları filtrele
      const activeUsers = response.data.data.filter(user => user.isActive);
      setUsers(activeUsers);
    } catch (err) {
      console.error('Kullanıcı listesi hatası:', err);
    }
  };

  const handleShowModal = (team = null) => {
    if (team) {
      setEditingTeam(team);
      setFormData({
        name: team.name || '',
        description: team.description || '',
        teamLeader: team.teamLeader?._id || '',
        members: team.members?.map(m => m._id) || [],
        performanceSettings: team.performanceSettings || {
          phoneCallTarget: 50,
          inPersonMeetingTarget: 10,
          salesTarget: 5,
          meetingToSalesRatio: 0.5,
          phoneToMeetingRatio: 0.2
        },
        isActive: team.isActive !== undefined ? team.isActive : true
      });
    } else {
      setEditingTeam(null);
      setFormData({
        name: '',
        description: '',
        teamLeader: '',
        members: [],
        performanceSettings: {
          phoneCallTarget: 50,
          inPersonMeetingTarget: 10,
          salesTarget: 5,
          meetingToSalesRatio: 0.5,
          phoneToMeetingRatio: 0.2
        },
        isActive: true
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTeam(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingTeam) {
        await api.put(`/teams/${editingTeam._id}`, formData);
        setSuccess('Takım başarıyla güncellendi');
      } else {
        await api.post('/teams', formData);
        setSuccess('Takım başarıyla oluşturuldu');
      }
      
      fetchTeams();
      handleCloseModal();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Takım kaydetme hatası:', err);
      setError(err.response?.data?.message || 'Takım kaydedilirken hata oluştu');
    }
  };

  const handleDelete = async (teamId) => {
    if (!window.confirm('Bu takımı silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      await api.delete(`/teams/${teamId}`);
      setSuccess('Takım başarıyla silindi');
      fetchTeams();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Takım silme hatası:', err);
      setError(err.response?.data?.message || 'Takım silinirken hata oluştu');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('performanceSettings.')) {
      const key = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        performanceSettings: {
          ...prev.performanceSettings,
          [key]: type === 'number' ? parseFloat(value) : value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleMemberSelect = (e) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
    setFormData(prev => ({
      ...prev,
      members: selectedOptions
    }));
  };

  if (loading) {
    return (
      <div className="text-center p-5">
        <Spinner animation="border" />
        <p className="mt-2">Yükleniyor...</p>
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
            Takım Yönetimi
          </h4>
          <p className="text-muted mb-0">
            Takımları oluşturun, yönetin ve performanslarını izleyin
          </p>
        </div>
        <Button variant="primary" onClick={() => handleShowModal()}>
          <FiPlus className="me-2" />
          Yeni Takım
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Teams Table */}
      <Card>
        <Card.Body>
          {teams.length === 0 ? (
            <div className="text-center py-5">
              <FiUsers size={48} className="text-muted mb-3" />
              <p className="text-muted">Henüz takım oluşturulmamış</p>
              <Button variant="primary" onClick={() => handleShowModal()}>
                İlk Takımı Oluştur
              </Button>
            </div>
          ) : (
            <Table responsive hover>
              <thead>
                <tr>
                  <th>Takım Adı</th>
                  <th>Takım Lideri</th>
                  <th>Üye Sayısı</th>
                  <th>Durum</th>
                  <th>Hedefler</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {teams.map(team => (
                  <tr key={team._id}>
                    <td>
                      <strong>{team.name}</strong>
                      {team.description && (
                        <div className="text-muted small">{team.description}</div>
                      )}
                    </td>
                    <td>
                      {team.teamLeader ? (
                        <div>
                          {team.teamLeader.name || `${team.teamLeader.firstName} ${team.teamLeader.lastName}`}
                          <div className="text-muted small">{team.teamLeader.email}</div>
                        </div>
                      ) : (
                        <span className="text-muted">Atanmamış</span>
                      )}
                    </td>
                    <td>
                      <Badge bg="info">{team.members?.length || 0} Kişi</Badge>
                    </td>
                    <td>
                      <Badge bg={team.isActive ? 'success' : 'secondary'}>
                        {team.isActive ? 'Aktif' : 'Pasif'}
                      </Badge>
                    </td>
                    <td>
                      <small>
                        <div>📞 {team.performanceSettings?.phoneCallTarget || 0} arama</div>
                        <div>👥 {team.performanceSettings?.inPersonMeetingTarget || 0} görüşme</div>
                        <div>💰 {team.performanceSettings?.salesTarget || 0} satış</div>
                      </small>
                    </td>
                    <td>
                      <div className="d-flex gap-2">
                        <Button
                          size="sm"
                          variant="outline-primary"
                          onClick={() => handleShowModal(team)}
                          title="Düzenle"
                        >
                          <FiEdit2 />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline-danger"
                          onClick={() => handleDelete(team._id)}
                          title="Sil"
                        >
                          <FiTrash2 />
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

      {/* Create/Edit Modal */}
      <Modal show={showModal} onHide={handleCloseModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {editingTeam ? 'Takımı Düzenle' : 'Yeni Takım Oluştur'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Tabs defaultActiveKey="basic" className="mb-3">
              <Tab eventKey="basic" title="Temel Bilgiler">
                <Form.Group className="mb-3">
                  <Form.Label>Takım Adı *</Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="Takım adını girin"
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Açıklama</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Takım açıklaması (opsiyonel)"
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Takım Lideri *</Form.Label>
                  <Form.Select
                    name="teamLeader"
                    value={formData.teamLeader}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Takım lideri seçin</option>
                    {users.map(user => (
                      <option key={user._id} value={user._id}>
                        {user.name || `${user.firstName} ${user.lastName}`} - {user.email}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Takım Üyeleri</Form.Label>
                  <Form.Select
                    multiple
                    name="members"
                    value={formData.members}
                    onChange={handleMemberSelect}
                    size={8}
                  >
                    {users.map(user => (
                      <option key={user._id} value={user._id}>
                        {user.name || `${user.firstName} ${user.lastName}`} - {user.email}
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text className="text-muted">
                    Birden fazla seçim için Ctrl (Windows) veya Cmd (Mac) tuşu ile tıklayın.
                    Takım lideri otomatik olarak üyelere eklenir.
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label="Takım Aktif"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleInputChange}
                  />
                </Form.Group>
              </Tab>

              <Tab eventKey="performance" title="Performans Hedefleri">
                <Alert variant="info">
                  <FiSettings className="me-2" />
                  Bu hedefler performans analizlerinde referans olarak kullanılır.
                </Alert>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Günlük Telefon Görüşme Hedefi</Form.Label>
                      <Form.Control
                        type="number"
                        name="performanceSettings.phoneCallTarget"
                        value={formData.performanceSettings.phoneCallTarget}
                        onChange={handleInputChange}
                        min="0"
                      />
                      <Form.Text className="text-muted">
                        Günlük beklenen telefon görüşmesi sayısı
                      </Form.Text>
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Günlük Birebir Görüşme Hedefi</Form.Label>
                      <Form.Control
                        type="number"
                        name="performanceSettings.inPersonMeetingTarget"
                        value={formData.performanceSettings.inPersonMeetingTarget}
                        onChange={handleInputChange}
                        min="0"
                      />
                      <Form.Text className="text-muted">
                        Günlük beklenen birebir görüşme sayısı
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Günlük Satış Hedefi</Form.Label>
                      <Form.Control
                        type="number"
                        name="performanceSettings.salesTarget"
                        value={formData.performanceSettings.salesTarget}
                        onChange={handleInputChange}
                        min="0"
                      />
                      <Form.Text className="text-muted">
                        Günlük beklenen satış adedi
                      </Form.Text>
                    </Form.Group>
                  </Col>

                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Birebir → Satış Dönüşüm Hedefi</Form.Label>
                      <Form.Control
                        type="number"
                        step="0.01"
                        name="performanceSettings.meetingToSalesRatio"
                        value={formData.performanceSettings.meetingToSalesRatio}
                        onChange={handleInputChange}
                        min="0"
                        max="1"
                      />
                      <Form.Text className="text-muted">
                        Hedef oran (0-1 arası, örn: 0.5 = %50)
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Telefon → Birebir Dönüşüm Hedefi</Form.Label>
                      <Form.Control
                        type="number"
                        step="0.01"
                        name="performanceSettings.phoneToMeetingRatio"
                        value={formData.performanceSettings.phoneToMeetingRatio}
                        onChange={handleInputChange}
                        min="0"
                        max="1"
                      />
                      <Form.Text className="text-muted">
                        Hedef oran (0-1 arası, örn: 0.2 = %20)
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>

                <Alert variant="warning" className="mt-3">
                  <strong>Not:</strong> Sistem bu hedeflere göre otomatik olarak risk ve başarı analizleri yapar.
                  Birebir görüşme sayısı fazla ama satış düşükse risk seviyesi yükselir.
                </Alert>
              </Tab>
            </Tabs>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              İptal
            </Button>
            <Button variant="primary" type="submit">
              {editingTeam ? 'Güncelle' : 'Oluştur'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default TeamManagement;

