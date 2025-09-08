import React, { useState, useEffect, useRef } from 'react';
import { Dropdown, Badge, ListGroup, Button, Spinner, Alert } from 'react-bootstrap';
import { FaBell, FaEye, FaTimes, FaClock, FaUser, FaCheck } from 'react-icons/fa';
import { announcementsAPI, activitiesAPI } from '../../utils/api';
import { toast } from 'react-toastify';

const NotificationDropdown = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [activities, setActivities] = useState([]);
  const [unreadAnnouncementCount, setUnreadAnnouncementCount] = useState(0);
  const [unreadActivityCount, setUnreadActivityCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('announcements');
  const dropdownRef = useRef();

  useEffect(() => {
    fetchNotificationCounts();
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchNotificationCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotificationCounts = async () => {
    try {
      const [announcementCountRes, activityCountRes] = await Promise.all([
        announcementsAPI.getUnreadCount(),
        activitiesAPI.getUnreadCount()
      ]);
      
      setUnreadAnnouncementCount(announcementCountRes.data.count);
      setUnreadActivityCount(activityCountRes.data.count);
    } catch (error) {
      console.error('Error fetching notification counts:', error);
    }
  };

  const fetchNotifications = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      
      if (activeTab === 'announcements') {
        const response = await announcementsAPI.getAll(false); // Only unread
        setAnnouncements(response.data.slice(0, 10)); // Latest 10
      } else {
        const response = await activitiesAPI.getAll(10, true); // Latest 10 unread
        setActivities(response.data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Bildirimler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleDropdownToggle = (isOpen) => {
    if (isOpen) {
      fetchNotifications();
    }
  };

  const handleAnnouncementRead = async (announcementId) => {
    try {
      await announcementsAPI.markAsRead(announcementId);
      setAnnouncements(prev => prev.filter(a => a._id !== announcementId));
      setUnreadAnnouncementCount(prev => Math.max(0, prev - 1));
      toast.success('Duyuru okundu olarak işaretlendi');
    } catch (error) {
      console.error('Error marking announcement as read:', error);
      toast.error('İşlem başarısız');
    }
  };

  const handleActivityRead = async (activityId) => {
    try {
      await activitiesAPI.markAsRead(activityId);
      setActivities(prev => prev.filter(a => a._id !== activityId));
      setUnreadActivityCount(prev => Math.max(0, prev - 1));
      toast.success('Aktivite okundu olarak işaretlendi');
    } catch (error) {
      console.error('Error marking activity as read:', error);
      toast.error('İşlem başarısız');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      if (activeTab === 'announcements') {
        // Mark all current announcements as read
        await Promise.all(
          announcements.map(a => announcementsAPI.markAsRead(a._id))
        );
        setAnnouncements([]);
        setUnreadAnnouncementCount(0);
      } else {
        await activitiesAPI.markAllAsRead();
        setActivities([]);
        setUnreadActivityCount(0);
      }
      toast.success('Tüm bildirimler okundu olarak işaretlendi');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('İşlem başarısız');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Şimdi';
    if (diffInMinutes < 60) return `${diffInMinutes}dk önce`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}sa önce`;
    return `${Math.floor(diffInMinutes / 1440)}gün önce`;
  };

  const getActivityIcon = (action) => {
    const icons = {
      sale_created: '💰',
      sale_updated: '📝',
      sale_cancelled: '❌',
      communication_added: '📞',
      login: '🔐',
      user_created: '👤',
      announcement_created: '📢'
    };
    return icons[action] || '📋';
  };

  const getActivityDescription = (activity) => {
    const descriptions = {
      sale_created: 'Yeni satış oluşturuldu',
      sale_updated: 'Satış güncellendi',
      sale_cancelled: 'Satış iptal edildi',
      communication_added: 'İletişim kaydı eklendi',
      login: 'Sisteme giriş yapıldı',
      user_created: 'Yeni kullanıcı oluşturuldu',
      announcement_created: 'Yeni duyuru oluşturuldu'
    };
    return descriptions[activity.action] || activity.description;
  };

  const totalUnreadCount = unreadAnnouncementCount + unreadActivityCount;

  const CustomToggle = React.forwardRef(({ children, onClick }, ref) => (
    <Button
      ref={ref}
      variant="link"
      className="position-relative p-2 text-decoration-none"
      onClick={(e) => {
        e.preventDefault();
        onClick(e);
      }}
      style={{ color: 'inherit' }}
    >
      <FaBell size={18} />
      {totalUnreadCount > 0 && (
        <Badge 
          bg="danger" 
          pill 
          className="position-absolute top-0 start-100 translate-middle"
          style={{ fontSize: '0.65rem' }}
        >
          {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
        </Badge>
      )}
    </Button>
  ));

  return (
    <Dropdown onToggle={handleDropdownToggle} ref={dropdownRef}>
      <Dropdown.Toggle as={CustomToggle} />
      
      <Dropdown.Menu 
        align="end" 
        className="shadow-lg border-0" 
        style={{ width: '380px', maxHeight: '500px' }}
      >
        <div className="px-3 py-2 border-bottom">
          <div className="d-flex justify-content-between align-items-center">
            <h6 className="mb-0">Bildirimler</h6>
            {(activeTab === 'announcements' ? announcements.length : activities.length) > 0 && (
              <Button 
                variant="link" 
                size="sm" 
                className="text-decoration-none p-0"
                onClick={handleMarkAllAsRead}
              >
                <FaCheck className="me-1" />
                Tümünü Okundu İşaretle
              </Button>
            )}
          </div>
          
          <div className="d-flex gap-2 mt-2">
            <Button
              variant={activeTab === 'announcements' ? 'primary' : 'outline-primary'}
              size="sm"
              onClick={() => setActiveTab('announcements')}
              className="flex-fill"
            >
              Duyurular
              {unreadAnnouncementCount > 0 && (
                <Badge bg="light" text="primary" className="ms-1">
                  {unreadAnnouncementCount}
                </Badge>
              )}
            </Button>
            <Button
              variant={activeTab === 'activities' ? 'primary' : 'outline-primary'}
              size="sm"
              onClick={() => setActiveTab('activities')}
              className="flex-fill"
            >
              Aktiviteler
              {unreadActivityCount > 0 && (
                <Badge bg="light" text="primary" className="ms-1">
                  {unreadActivityCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
          {loading ? (
            <div className="text-center py-4">
              <Spinner animation="border" size="sm" />
            </div>
          ) : (
            <>
              {activeTab === 'announcements' ? (
                announcements.length === 0 ? (
                  <Alert variant="light" className="m-3 text-center">
                    <FaBell className="mb-2" />
                    <div>Okunmamış duyuru yok</div>
                  </Alert>
                ) : (
                  <ListGroup variant="flush">
                    {announcements.map((announcement) => (
                      <ListGroup.Item 
                        key={announcement._id}
                        className="border-0 py-3"
                        action
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1 me-2">
                            <div className="d-flex align-items-center gap-2 mb-1">
                              <Badge bg="primary" className="text-uppercase small">
                                {announcement.type}
                              </Badge>
                              {announcement.priority === 'urgent' && (
                                <Badge bg="danger" className="small">ACİL</Badge>
                              )}
                            </div>
                            <h6 className="mb-1 fw-bold small">{announcement.title}</h6>
                            <p className="mb-2 text-muted small" style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}>
                              {announcement.content}
                            </p>
                            <div className="d-flex align-items-center gap-2 text-muted small">
                              <FaUser size={10} />
                              <span>{announcement.createdBy?.name}</span>
                              <FaClock size={10} />
                              <span>{formatDate(announcement.createdAt)}</span>
                            </div>
                          </div>
                          <Button
                            variant="link"
                            size="sm"
                            className="text-muted p-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAnnouncementRead(announcement._id);
                            }}
                          >
                            <FaTimes size={12} />
                          </Button>
                        </div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                )
              ) : (
                activities.length === 0 ? (
                  <Alert variant="light" className="m-3 text-center">
                    <FaBell className="mb-2" />
                    <div>Okunmamış aktivite yok</div>
                  </Alert>
                ) : (
                  <ListGroup variant="flush">
                    {activities.map((activity) => (
                      <ListGroup.Item 
                        key={activity._id}
                        className="border-0 py-3"
                        action
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <div className="flex-grow-1 me-2">
                            <div className="d-flex align-items-center gap-2 mb-1">
                              <span>{getActivityIcon(activity.action)}</span>
                              <Badge 
                                bg={activity.severity === 'high' ? 'warning' : 'secondary'} 
                                className="small"
                              >
                                {activity.severity.toUpperCase()}
                              </Badge>
                            </div>
                            <h6 className="mb-1 small">{getActivityDescription(activity)}</h6>
                            <p className="mb-2 text-muted small">{activity.description}</p>
                            <div className="d-flex align-items-center gap-2 text-muted small">
                              <FaUser size={10} />
                              <span>{activity.user?.name}</span>
                              <FaClock size={10} />
                              <span>{formatDate(activity.createdAt)}</span>
                            </div>
                          </div>
                          <Button
                            variant="link"
                            size="sm"
                            className="text-muted p-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleActivityRead(activity._id);
                            }}
                          >
                            <FaTimes size={12} />
                          </Button>
                        </div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                )
              )}
            </>
          )}
        </div>

        {(activeTab === 'announcements' ? announcements.length : activities.length) > 0 && (
          <div className="border-top px-3 py-2">
            <Button 
              variant="link" 
              size="sm" 
              className="text-decoration-none w-100 text-center"
              onClick={() => {
                // Navigate to full notifications page
                window.location.href = activeTab === 'announcements' ? '/announcements' : '/activities';
              }}
            >
              <FaEye className="me-1" />
              Tümünü Görüntüle
            </Button>
          </div>
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
};

export default NotificationDropdown;
