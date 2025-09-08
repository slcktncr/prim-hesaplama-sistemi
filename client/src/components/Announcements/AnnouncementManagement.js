import React, { useState, useEffect } from 'react';
import { 
  Card, Table, Button, Modal, Form, Badge, Alert, 
  Spinner, Row, Col, Dropdown, ProgressBar 
} from 'react-bootstrap';
import { 
  FaPlus, FaEdit, FaTrash, FaEye, FaBell, FaUsers, 
  FaClock, FaCheck, FaTimes, FaExclamationTriangle 
} from 'react-icons/fa';
import { announcementsAPI, usersAPI } from '../../utils/api';
import { toast } from 'react-toastify';

const AnnouncementManagement = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'info',
    priority: 'medium',
    targetUsers: [],
    expiresAt: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [announcementsRes, usersRes] = await Promise.all([
        announcementsAPI.getAdminAll(),
        usersAPI.getAllUsers()
      ]);
      
      setAnnouncements(announcementsRes.data);
      setUsers(usersRes.data.filter(u => u.isActive));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleShowModal = (announcement = null) => {
    if (announcement) {
      setEditingAnnouncement(announcement);
      setFormData({
        title: announcement.title,
        content: announcement.content,
        type: announcement.type,
        priority: announcement.priority,
        targetUsers: announcement.targetUsers.map(u => u._id) || [],
        expiresAt: announcement.expiresAt ? 
          new Date(announcement.expiresAt).toISOString().slice(0, 16) : ''
      });
    } else {
      setEditingAnnouncement(null);
      setFormData({
        title: '',
        content: '',
        type: 'info',
        priority: 'medium',
        targetUsers: [],
        expiresAt: ''
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingAnnouncement(null);
    setFormData({
      title: '',
      content: '',
      type: 'info',
      priority: 'medium',
      targetUsers: [],
      expiresAt: ''
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUserSelection = (userId) => {
    setFormData(prev => ({
      ...prev,
      targetUsers: prev.targetUsers.includes(userId)
        ? prev.targetUsers.filter(id => id !== userId)
        : [...prev.targetUsers, userId]
    }));
  };

  const handleSelectAllUsers = () => {
    setFormData(prev => ({
      ...prev,
      targetUsers: prev.targetUsers.length === users.length ? [] : users.map(u => u._id)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error('Başlık ve içerik zorunludur');
      return;
    }

    try {
      const submitData = {
        ...formData,
        expiresAt: formData.expiresAt || null
      };

      if (editingAnnouncement) {
        await announcementsAPI.update(editingAnnouncement._id, submitData);
        toast.success('Duyuru güncellendi');
      } else {
        await announcementsAPI.create(submitData);
        toast.success('Duyuru oluşturuldu');
      }

      handleCloseModal();
      fetchData();
    } catch (error) {
      console.error('Error saving announcement:', error);
      toast.error('İşlem başarısız');
    }
  };

  const handleDelete = async (announcementId) => {
    if (!window.confirm('Bu duyuruyu silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      await announcementsAPI.delete(announcementId);
      toast.success('Duyuru silindi');
      fetchData();
    } catch (error) {
      console.error('Error deleting announcement:', error);
      toast.error('Silme işlemi başarısız');
    }
  };

  const handleToggleActive = async (announcement) => {
    try {
      await announcementsAPI.update(announcement._id, {
        isActive: !announcement.isActive
      });
      toast.success(`Duyuru ${announcement.isActive ? 'devre dışı' : 'aktif'} edildi`);
      fetchData();
    } catch (error) {
      console.error('Error toggling announcement status:', error);
      toast.error('İşlem başarısız');
    }
  };

  const getTypeColor = (type) => {
    const colors = {
      info: 'primary',
      success: 'success',
      warning: 'warning',
      danger: 'danger'
    };
    return colors[type] || 'primary';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'secondary',
      medium: 'primary',
      high: 'warning',
      urgent: 'danger'
    };
    return colors[priority] || 'primary';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2">Veriler yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">
            <FaBell className="me-2 text-primary" />
            Duyuru Yönetimi
          </h2>
          <p className="text-muted mb-0">Sistem duyurularını yönetin</p>
        </div>
        
        <Button variant="primary" onClick={() => handleShowModal()}>
          <FaPlus className="me-2" />
          Yeni Duyuru
        </Button>
      </div>

      <Card className="shadow-sm">
        <Card.Body>
          {announcements.length === 0 ? (
            <Alert variant="info" className="text-center">
              <FaBell className="mb-2" size={32} />
              <p className="mb-0">Henüz duyuru bulunmuyor.</p>
            </Alert>
          ) : (
            <div className="table-responsive">
              <Table hover>
                <thead>
                  <tr>
                    <th>Başlık</th>
                    <th>Tür</th>
                    <th>Öncelik</th>
                    <th>Hedef</th>
                    <th>Okunma</th>
                    <th>Durum</th>
                    <th>Tarih</th>
                    <th>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {announcements.map((announcement) => (
                    <tr key={announcement._id}>
                      <td>
                        <div>
                          <div className="fw-bold">{announcement.title}</div>
                          <small className="text-muted">
                            {announcement.content.length > 50 
                              ? `${announcement.content.substring(0, 50)}...`
                              : announcement.content
                            }
                          </small>
                        </div>
                      </td>
                      <td>
                        <Badge bg={getTypeColor(announcement.type)} className="text-uppercase">
                          {announcement.type}
                        </Badge>
                      </td>
                      <td>
                        <Badge bg={getPriorityColor(announcement.priority)}>
                          {announcement.priority.toUpperCase()}
                        </Badge>
                      </td>
                      <td>
                        <div className="d-flex align-items-center gap-1">
                          <FaUsers size={14} />
                          <span>{announcement.totalUsers}</span>
                        </div>
                      </td>
                      <td>
                        <div>
                          <div className="d-flex align-items-center gap-2 mb-1">
                            <span className="small">{announcement.readCount} okundu</span>
                            {typeof announcement.totalUsers === 'number' && (
                              <Badge bg="info" className="small">
                                %{announcement.readPercentage}
                              </Badge>
                            )}
                          </div>
                          {typeof announcement.totalUsers === 'number' && (
                            <ProgressBar 
                              now={announcement.readPercentage} 
                              size="sm"
                              variant={announcement.readPercentage > 75 ? 'success' : 
                                     announcement.readPercentage > 50 ? 'warning' : 'danger'}
                            />
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="d-flex flex-column gap-1">
                          <Badge bg={announcement.isActive ? 'success' : 'secondary'}>
                            {announcement.isActive ? 'Aktif' : 'Pasif'}
                          </Badge>
                          {announcement.expiresAt && (
                            <Badge bg="warning" className="small">
                              <FaClock className="me-1" />
                              {new Date(announcement.expiresAt) < new Date() ? 'Süresi Doldu' : 'Süreli'}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td>
                        <small className="text-muted">
                          {formatDate(announcement.createdAt)}
                        </small>
                      </td>
                      <td>
                        <Dropdown>
                          <Dropdown.Toggle variant="outline-secondary" size="sm">
                            İşlemler
                          </Dropdown.Toggle>
                          <Dropdown.Menu>
                            <Dropdown.Item onClick={() => handleShowModal(announcement)}>
                              <FaEdit className="me-2" />
                              Düzenle
                            </Dropdown.Item>
                            <Dropdown.Item onClick={() => handleToggleActive(announcement)}>
                              {announcement.isActive ? (
                                <>
                                  <FaTimes className="me-2" />
                                  Devre Dışı Bırak
                                </>
                              ) : (
                                <>
                                  <FaCheck className="me-2" />
                                  Aktif Et
                                </>
                              )}
                            </Dropdown.Item>
                            <Dropdown.Divider />
                            <Dropdown.Item 
                              className="text-danger"
                              onClick={() => handleDelete(announcement._id)}
                            >
                              <FaTrash className="me-2" />
                              Sil
                            </Dropdown.Item>
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

      {/* Create/Edit Modal */}
      <Modal show={showModal} onHide={handleCloseModal} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {editingAnnouncement ? 'Duyuru Düzenle' : 'Yeni Duyuru Oluştur'}
          </Modal.Title>
        </Modal.Header>
        
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Row>
              <Col md={8}>
                <Form.Group className="mb-3">
                  <Form.Label>Başlık *</Form.Label>
                  <Form.Control
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="Duyuru başlığı"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Son Geçerlilik Tarihi</Form.Label>
                  <Form.Control
                    type="datetime-local"
                    name="expiresAt"
                    value={formData.expiresAt}
                    onChange={handleInputChange}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>İçerik *</Form.Label>
              <Form.Control
                as="textarea"
                rows={5}
                name="content"
                value={formData.content}
                onChange={handleInputChange}
                placeholder="Duyuru içeriği..."
                required
              />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Tür</Form.Label>
                  <Form.Select
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                  >
                    <option value="info">Bilgi</option>
                    <option value="success">Başarı</option>
                    <option value="warning">Uyarı</option>
                    <option value="danger">Hata/Tehlike</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Öncelik</Form.Label>
                  <Form.Select
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                  >
                    <option value="low">Düşük</option>
                    <option value="medium">Orta</option>
                    <option value="high">Yüksek</option>
                    <option value="urgent">Acil</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <Form.Label>Hedef Kullanıcılar</Form.Label>
                <Button
                  variant="link"
                  size="sm"
                  className="text-decoration-none p-0"
                  onClick={handleSelectAllUsers}
                >
                  {formData.targetUsers.length === users.length ? 'Hiçbirini Seçme' : 'Tümünü Seç'}
                </Button>
              </div>
              
              <Alert variant="info" className="small">
                Hiçbir kullanıcı seçilmezse duyuru tüm kullanıcılara gönderilir.
              </Alert>
              
              <div 
                className="border rounded p-3" 
                style={{ maxHeight: '200px', overflowY: 'auto' }}
              >
                {users.map((user) => (
                  <Form.Check
                    key={user._id}
                    type="checkbox"
                    id={`user-${user._id}`}
                    label={`${user.name} (${user.email})`}
                    checked={formData.targetUsers.includes(user._id)}
                    onChange={() => handleUserSelection(user._id)}
                    className="mb-2"
                  />
                ))}
              </div>
              
              <small className="text-muted">
                {formData.targetUsers.length === 0 
                  ? 'Tüm kullanıcılar' 
                  : `${formData.targetUsers.length} kullanıcı seçildi`
                }
              </small>
            </Form.Group>
          </Modal.Body>
          
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              İptal
            </Button>
            <Button variant="primary" type="submit">
              {editingAnnouncement ? 'Güncelle' : 'Oluştur'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default AnnouncementManagement;
