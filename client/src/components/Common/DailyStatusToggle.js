import React, { useState, useEffect } from 'react';
import { 
  Dropdown, 
  Badge, 
  Modal, 
  Form, 
  Button, 
  Alert,
  Spinner
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  FiClock, 
  FiUser, 
  FiUserCheck, 
  FiUserX, 
  FiHeart,
  FiCheck,
  FiX,
  FiRefreshCw
} from 'react-icons/fi';

import { dailyStatusAPI } from '../../utils/api';

const DailyStatusToggle = () => {
  const [currentStatus, setCurrentStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    status: 'mesaide',
    statusNote: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCurrentStatus();
  }, []);

  const fetchCurrentStatus = async () => {
    try {
      setLoading(true);
      const response = await dailyStatusAPI.getMyStatus();
      setCurrentStatus(response.data);
    } catch (error) {
      console.error('Status fetch error:', error);
      // Hata durumunda varsayılan değer
      setCurrentStatus({
        status: 'mesaide',
        statusDisplay: 'Mesaide',
        isSet: false,
        canChange: true
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async () => {
    try {
      setSaving(true);
      
      const response = await dailyStatusAPI.setStatus(formData.status, formData.statusNote);
      
      toast.success(response.data.message);
      setCurrentStatus({
        ...response.data,
        isSet: true,
        canChange: true
      });
      
      setShowModal(false);
      setFormData({ status: 'mesaide', statusNote: '' });
      
    } catch (error) {
      console.error('Status change error:', error);
      toast.error(error.response?.data?.message || 'Durum değiştirilemedi');
    } finally {
      setSaving(false);
    }
  };

  const openModal = (status = 'mesaide') => {
    setFormData({
      status: status,
      statusNote: ''
    });
    setShowModal(true);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'mesaide':
        return <FiUserCheck className="me-1" />;
      case 'izinli':
        return <FiUserX className="me-1" />;
      case 'hastalik':
        return <FiHeart className="me-1" />;
      default:
        return <FiUser className="me-1" />;
    }
  };

  const getStatusVariant = (status) => {
    switch (status) {
      case 'mesaide':
        return 'success';
      case 'izinli':
        return 'warning';
      case 'hastalik':
        return 'danger';
      default:
        return 'secondary';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'mesaide':
        return 'Mesaide';
      case 'izinli':
        return 'İzinli';
      case 'hastalik':
        return 'Hastalık';
      default:
        return 'Bilinmiyor';
    }
  };

  if (loading) {
    return (
      <div className="d-flex align-items-center">
        <Spinner animation="border" size="sm" className="me-2" />
        <small>Yükleniyor...</small>
      </div>
    );
  }

  if (!currentStatus || !currentStatus.canChange) {
    return null; // İletişim kaydı zorunluluğu olmayan kullanıcılar için gösterme
  }

  return (
    <>
      <Dropdown align="end">
        <Dropdown.Toggle 
          variant="outline-light" 
          size="sm" 
          className="d-flex align-items-center border-0"
          style={{ backgroundColor: 'transparent' }}
        >
          {getStatusIcon(currentStatus.status)}
          <Badge bg={getStatusVariant(currentStatus.status)} className="me-2">
            {getStatusText(currentStatus.status)}
          </Badge>
          <FiClock size={14} />
        </Dropdown.Toggle>

        <Dropdown.Menu>
          <Dropdown.Header>
            <FiClock className="me-2" />
            Günlük Durum
          </Dropdown.Header>
          
          <Dropdown.Item 
            onClick={() => openModal('mesaide')}
            className={currentStatus.status === 'mesaide' ? 'active' : ''}
          >
            <FiUserCheck className="me-2 text-success" />
            Mesaide
            {currentStatus.status === 'mesaide' && (
              <FiCheck className="ms-auto text-success" />
            )}
          </Dropdown.Item>
          
          <Dropdown.Item 
            onClick={() => openModal('izinli')}
            className={currentStatus.status === 'izinli' ? 'active' : ''}
          >
            <FiUserX className="me-2 text-warning" />
            İzinli
            {currentStatus.status === 'izinli' && (
              <FiCheck className="ms-auto text-success" />
            )}
          </Dropdown.Item>
          
          <Dropdown.Item 
            onClick={() => openModal('hastalik')}
            className={currentStatus.status === 'hastalik' ? 'active' : ''}
          >
            <FiHeart className="me-2 text-danger" />
            Hastalık İzni
            {currentStatus.status === 'hastalik' && (
              <FiCheck className="ms-auto text-success" />
            )}
          </Dropdown.Item>
          
          <Dropdown.Divider />
          
          <Dropdown.Item onClick={fetchCurrentStatus}>
            <FiRefreshCw className="me-2" />
            Yenile
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>

      {/* Status Change Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {getStatusIcon(formData.status)}
            Durum Değiştir - {getStatusText(formData.status)}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info" className="mb-3">
            <strong>Bilgi:</strong> Durumunuzu "{getStatusText(formData.status)}" olarak ayarlıyorsunuz.
            {formData.status !== 'mesaide' && (
              <div className="mt-2">
                <small>
                  ⚠️ Bu durumda günlük iletişim kaydı girme zorunluluğunuz olmayacak ve ceza puanı almayacaksınız.
                </small>
              </div>
            )}
          </Alert>

          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Durum</Form.Label>
              <Form.Select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="mesaide">Mesaide</option>
                <option value="izinli">İzinli</option>
                <option value="hastalik">Hastalık İzni</option>
              </Form.Select>
            </Form.Group>

            {formData.status !== 'mesaide' && (
              <Form.Group className="mb-3">
                <Form.Label>Not (İsteğe Bağlı)</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={formData.statusNote}
                  onChange={(e) => setFormData(prev => ({ ...prev, statusNote: e.target.value }))}
                  placeholder="İzin sebebi, hastalık durumu vb. (isteğe bağlı)"
                  maxLength={200}
                />
                <Form.Text className="text-muted">
                  {formData.statusNote.length}/200 karakter
                </Form.Text>
              </Form.Group>
            )}

            {formData.status === 'mesaide' && (
              <Alert variant="success">
                <strong>Mesaide:</strong> Normal çalışma durumundasınız. Günlük iletişim kaydı girmeniz gerekecektir.
              </Alert>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            <FiX className="me-1" />
            İptal
          </Button>
          <Button 
            variant="primary" 
            onClick={handleStatusChange}
            disabled={saving}
          >
            {saving ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <FiCheck className="me-1" />
                Durumu Ayarla
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default DailyStatusToggle;
