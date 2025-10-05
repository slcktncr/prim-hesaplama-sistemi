import React, { useState, useEffect } from 'react';
import { Modal, Button, Alert, Badge, Spinner } from 'react-bootstrap';
import { FaBell, FaTimes, FaExclamationTriangle, FaInfoCircle, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import { announcementsAPI } from '../../utils/api';
import { toast } from 'react-toastify';

const AnnouncementNotification = () => {
  const [announcement, setAnnouncement] = useState(null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    checkForUnreadAnnouncements();
    
    // Her 30 saniyede bir kontrol et
    const interval = setInterval(checkForUnreadAnnouncements, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const checkForUnreadAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await announcementsAPI.getAll(false); // Sadece okunmamış
      
      if (response.data && response.data.length > 0) {
        // En yüksek öncelikli ve en yeni duyuruyu al
        const unreadAnnouncements = response.data.sort((a, b) => {
          // Önce önceliğe göre sırala (urgent > high > medium > low)
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          const aPriority = priorityOrder[a.priority] || 0;
          const bPriority = priorityOrder[b.priority] || 0;
          
          if (aPriority !== bPriority) {
            return bPriority - aPriority;
          }
          
          // Aynı öncelikte ise tarihe göre sırala (en yeni önce)
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
        
        const latestAnnouncement = unreadAnnouncements[0];
        setAnnouncement(latestAnnouncement);
        setShow(true);
      }
    } catch (error) {
      console.error('Error checking for announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReadAnnouncement = async () => {
    if (!announcement) return;
    
    try {
      await announcementsAPI.markAsRead(announcement._id);
      setShow(false);
      setAnnouncement(null);
      toast.success('Duyuru okundu olarak işaretlendi');
    } catch (error) {
      console.error('Error marking announcement as read:', error);
      toast.error('Duyuru işaretlenirken hata oluştu');
    }
  };

  const handleClose = () => {
    setShow(false);
    setAnnouncement(null);
  };

  const getTypeIcon = (type) => {
    const icons = {
      info: <FaInfoCircle className="text-primary" />,
      success: <FaCheckCircle className="text-success" />,
      warning: <FaExclamationTriangle className="text-warning" />,
      danger: <FaExclamationCircle className="text-danger" />
    };
    return icons[type] || <FaInfoCircle className="text-primary" />;
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

  const getPriorityBadge = (priority) => {
    if (priority === 'urgent') {
      return (
        <Badge bg="danger" className="animate-pulse">
          ACİL
        </Badge>
      );
    } else if (priority === 'high') {
      return (
        <Badge bg="warning" className="text-dark">
          YÜKSEK
        </Badge>
      );
    }
    return null;
  };

  if (!announcement || loading) {
    return null;
  }

  return (
    <Modal
      show={show}
      onHide={handleClose}
      centered
      backdrop="static"
      keyboard={false}
      size="lg"
      className="announcement-notification-modal"
    >
      <Modal.Header 
        className={`bg-${getTypeColor(announcement.type)} text-white border-0`}
        style={{ borderTopLeftRadius: '0.375rem', borderTopRightRadius: '0.375rem' }}
      >
        <div className="d-flex align-items-center gap-2">
          <FaBell size={20} />
          <Modal.Title className="mb-0">
            Yeni Duyuru
          </Modal.Title>
        </div>
        <div className="d-flex align-items-center gap-2">
          {getPriorityBadge(announcement.priority)}
          <Button
            variant="link"
            onClick={handleClose}
            className="text-white p-0 border-0"
            style={{ fontSize: '1.5rem', lineHeight: 1 }}
          >
            <FaTimes />
          </Button>
        </div>
      </Modal.Header>

      <Modal.Body className="p-4">
        <div className="d-flex align-items-start gap-3 mb-3">
          <div className="flex-shrink-0" style={{ fontSize: '1.5rem' }}>
            {getTypeIcon(announcement.type)}
          </div>
          <div className="flex-grow-1">
            <h5 className="mb-2 fw-bold text-dark">
              {announcement.title}
            </h5>
            <div className="d-flex align-items-center gap-2 mb-3">
              <Badge bg={getTypeColor(announcement.type)} className="text-uppercase">
                {announcement.type}
              </Badge>
              <small className="text-muted">
                {new Date(announcement.createdAt).toLocaleDateString('tr-TR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </small>
            </div>
          </div>
        </div>

        <div className="announcement-content">
          <div 
            className="text-dark"
            style={{ 
              whiteSpace: 'pre-wrap',
              lineHeight: '1.6',
              fontSize: '1rem'
            }}
          >
            {announcement.content}
          </div>
        </div>

        {announcement.priority === 'urgent' && (
          <Alert variant="danger" className="mt-3 mb-0">
            <FaExclamationTriangle className="me-2" />
            <strong>ACİL DURUM:</strong> Bu duyuru acil öncelikli olduğu için lütfen dikkatle okuyun.
          </Alert>
        )}
      </Modal.Body>

      <Modal.Footer className="border-0 bg-light">
        <div className="d-flex justify-content-between w-100">
          <small className="text-muted d-flex align-items-center">
            <FaBell className="me-1" />
            Bu bildirim okunana kadar tekrar görünecektir
          </small>
          <div className="d-flex gap-2">
            <Button
              variant="outline-secondary"
              onClick={handleClose}
              size="sm"
            >
              Daha Sonra
            </Button>
            <Button
              variant={`${getTypeColor(announcement.type)}`}
              onClick={handleReadAnnouncement}
              size="sm"
              className="d-flex align-items-center gap-2"
            >
              <FaCheckCircle />
              Duyuruyu Oku
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default AnnouncementNotification;
