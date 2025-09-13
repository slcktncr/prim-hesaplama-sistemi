import React, { useState } from 'react';
import { Navbar as BSNavbar, Nav, Dropdown, Container, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FiUser, FiLogOut, FiSettings, FiShield, FiCalendar } from 'react-icons/fi';
import DailyStatusToggle from '../Common/DailyStatusToggle';
import NotificationDropdown from '../Notifications/NotificationDropdown';
import UpcomingEntriesModal from '../Sales/UpcomingEntriesModal';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showUpcomingEntries, setShowUpcomingEntries] = useState(false);

  const handleLogout = () => {
    logout();
  };

  const handleProfileClick = () => {
    navigate('/profile');
  };


  const getUserInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="top-navbar">
      <Container fluid className="d-flex align-items-center justify-content-between">
        {/* Page Title */}
        <div className="d-flex align-items-center">
          <h5 className="mb-0 text-gray-800 font-weight-bold">
            Hoş geldiniz, {user?.name}
          </h5>
        </div>

        {/* User Menu */}
        <div className="d-flex align-items-center gap-3">
          {/* Daily Status Toggle */}
          <DailyStatusToggle />
          
          {/* Upcoming Entries Button */}
          <Button
            variant="outline-primary"
            size="sm"
            onClick={() => setShowUpcomingEntries(true)}
            title="Yaklaşan girişleri göster"
          >
            <FiCalendar />
          </Button>
          
          {/* Notifications */}
          <NotificationDropdown />
          
          <Dropdown align="end">
            <Dropdown.Toggle 
              variant="link" 
              className="d-flex align-items-center text-decoration-none border-0 bg-transparent p-0"
              id="user-dropdown"
            >
              <div className="user-avatar">
                {getUserInitials(user?.name)}
              </div>
              <div className="d-none d-md-block text-start ms-2">
                <div className="fw-semibold text-gray-800 small">
                  {user?.name}
                </div>
                <div className="text-muted small">
                  {user?.role === 'admin' ? 'Yönetici' : 'Satış Temsilcisi'}
                </div>
              </div>
            </Dropdown.Toggle>

            <Dropdown.Menu className="user-dropdown">
              <div className="user-info">
                <h6>{user?.name}</h6>
                <small className="text-muted">{user?.email}</small>
                <div className="mt-1">
                  <span className={`badge ${user?.role === 'admin' ? 'bg-danger' : 'bg-primary'} small`}>
                    {user?.role === 'admin' ? (
                      <>
                        <FiShield className="me-1" size={10} />
                        Yönetici
                      </>
                    ) : (
                      <>
                        <FiUser className="me-1" size={10} />
                        Satış Temsilcisi
                      </>
                    )}
                  </span>
                </div>
              </div>
              
              <Dropdown.Item onClick={handleProfileClick}>
                <FiUser className="me-2" />
                Profil Ayarları
              </Dropdown.Item>
              
              {user?.role === 'admin' && (
                <Dropdown.Item onClick={() => navigate('/admin/system-settings')}>
                  <FiShield className="me-2" />
                  Sistem Ayarları
                </Dropdown.Item>
              )}
              
              <Dropdown.Divider />
              
              <Dropdown.Item onClick={handleLogout} className="text-danger">
                <FiLogOut className="me-2" />
                Çıkış Yap
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </Container>
      
      {/* Upcoming Entries Modal */}
      <UpcomingEntriesModal 
        show={showUpcomingEntries} 
        onHide={() => setShowUpcomingEntries(false)} 
      />
    </div>
  );
};

export default Navbar;
