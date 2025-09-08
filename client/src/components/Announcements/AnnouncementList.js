import React, { useState, useEffect } from 'react';
import { Card, Badge, Button, Modal, Alert, Spinner } from 'react-bootstrap';
import { FaBell, FaEye, FaEyeSlash, FaTimes, FaClock, FaUser } from 'react-icons/fa';
import { announcementsAPI } from '../../utils/api';
import { toast } from 'react-toastify';

const AnnouncementList = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [includeRead, setIncludeRead] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, [includeRead]);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await announcementsAPI.getAll(includeRead);
      setAnnouncements(response.data);
    } catch (error) {
      console.error('Error fetching announcements:', error);
      toast.error('Duyurular yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleReadAnnouncement = async (announcement) => {
    try {
      if (!announcement.isRead) {
        await announcementsAPI.markAsRead(announcement._id);
        // Update local state
        setAnnouncements(prev => prev.map(a => 
          a._id === announcement._id ? { ...a, isRead: true } : a
        ));
      }
      setSelectedAnnouncement(announcement);
      setShowModal(true);
    } catch (error) {
      console.error('Error marking announcement as read:', error);
      toast.error('Duyuru işaretlenirken hata oluştu');
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

  const getPriorityIcon = (priority) => {
    if (priority === 'urgent') return '🔥';
    if (priority === 'high') return '⚠️';
    if (priority === 'medium') return '📢';
    return '📝';
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
      <div className="text-center py-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2">Duyurular yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">
            <FaBell className="me-2 text-primary" />
            Duyurular
          </h2>
          <p className="text-muted mb-0">Sistem duyurularını buradan takip edebilirsiniz</p>
        </div>
        
        <div className="d-flex gap-2">
          <Button
            variant={includeRead ? "outline-secondary" : "primary"}
            size="sm"
            onClick={() => setIncludeRead(!includeRead)}
          >
            {includeRead ? <FaEyeSlash className="me-1" /> : <FaEye className="me-1" />}
            {includeRead ? 'Sadece Okunmayanlar' : 'Tümünü Göster'}
          </Button>
          
          <Button variant="outline-primary" size="sm" onClick={fetchAnnouncements}>
            Yenile
          </Button>
        </div>
      </div>

      {announcements.length === 0 ? (
        <Alert variant="info" className="text-center">
          <FaBell className="mb-2" size={32} />
          <p className="mb-0">
            {includeRead ? 'Henüz duyuru bulunmuyor.' : 'Okunmamış duyuru bulunmuyor.'}
          </p>
        </Alert>
      ) : (
        <div className="row">
          {announcements.map((announcement) => (
            <div key={announcement._id} className="col-12 col-lg-6 col-xl-4 mb-4">
              <Card 
                className={`h-100 shadow-sm border-start border-4 border-${getTypeColor(announcement.type)} ${!announcement.isRead ? 'bg-light' : ''}`}
                style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                onClick={() => handleReadAnnouncement(announcement)}
              >
                <Card.Header className="pb-2 border-0 bg-transparent">
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="d-flex align-items-center gap-2">
                      <span className="fs-5">{getPriorityIcon(announcement.priority)}</span>
                      <Badge bg={getTypeColor(announcement.type)} className="text-uppercase">
                        {announcement.type}
                      </Badge>
                      {announcement.priority === 'urgent' && (
                        <Badge bg="danger" className="animate-pulse">
                          ACİL
                        </Badge>
                      )}
                    </div>
                    {!announcement.isRead && (
                      <Badge bg="danger" pill className="animate-pulse">
                        YENİ
                      </Badge>
                    )}
                  </div>
                </Card.Header>
                
                <Card.Body className="pt-0">
                  <h6 className={`card-title mb-2 ${!announcement.isRead ? 'fw-bold' : ''}`}>
                    {announcement.title}
                  </h6>
                  
                  <p className="card-text text-muted small mb-3" style={{ 
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {announcement.content}
                  </p>
                  
                  <div className="d-flex justify-content-between align-items-center text-muted small">
                    <div className="d-flex align-items-center gap-1">
                      <FaUser size={12} />
                      <span>{announcement.createdBy?.name}</span>
                    </div>
                    <div className="d-flex align-items-center gap-1">
                      <FaClock size={12} />
                      <span>{formatDate(announcement.createdAt)}</span>
                    </div>
                  </div>
                  
                  {announcement.expiresAt && (
                    <div className="mt-2">
                      <Badge variant="outline-warning" className="small">
                        Son Tarih: {formatDate(announcement.expiresAt)}
                      </Badge>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Announcement Detail Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton className="border-bottom">
          <Modal.Title className="d-flex align-items-center gap-2">
            <span className="fs-4">{selectedAnnouncement && getPriorityIcon(selectedAnnouncement.priority)}</span>
            {selectedAnnouncement?.title}
          </Modal.Title>
        </Modal.Header>
        
        <Modal.Body>
          {selectedAnnouncement && (
            <>
              <div className="d-flex gap-2 mb-3">
                <Badge bg={getTypeColor(selectedAnnouncement.type)} className="text-uppercase">
                  {selectedAnnouncement.type}
                </Badge>
                <Badge bg="secondary">
                  {selectedAnnouncement.priority.toUpperCase()}
                </Badge>
              </div>
              
              <div className="mb-4" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                {selectedAnnouncement.content}
              </div>
              
              <div className="border-top pt-3">
                <div className="row text-muted small">
                  <div className="col-sm-6">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <FaUser />
                      <span>Oluşturan: {selectedAnnouncement.createdBy?.name}</span>
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <FaClock />
                      <span>Tarih: {formatDate(selectedAnnouncement.createdAt)}</span>
                    </div>
                  </div>
                  {selectedAnnouncement.expiresAt && (
                    <div className="col-12">
                      <div className="d-flex align-items-center gap-2">
                        <FaTimes />
                        <span>Son Geçerlilik: {formatDate(selectedAnnouncement.expiresAt)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </Modal.Body>
        
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Kapat
          </Button>
        </Modal.Footer>
      </Modal>

      <style jsx>{`
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        
        .card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        }
      `}</style>
    </div>
  );
};

export default AnnouncementList;
