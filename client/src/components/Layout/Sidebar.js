import React from 'react';
import { Nav } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { 
  FiHome, 
  FiShoppingBag, 
  FiPlus, 
  FiX, 
  FiDollarSign, 
  FiCalendar,
  FiList,
  FiTrendingUp,
  FiSettings,
  FiBarChart2,
  FiClock,
  FiUsers,
  FiCreditCard,
  FiShield
} from 'react-icons/fi';

const Sidebar = ({ onLinkClick }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Link tıklanınca mobilde sidebar'ı kapat
  const handleLinkClick = () => {
    if (onLinkClick && window.innerWidth < 992) {
      onLinkClick();
    }
  };

  return (
    <div className="sidebar">
      {/* Logo Area */}
      <div className="sidebar-logo">
        <div className="logo-container">
          <div className="logo-image">
            <img 
              src="/mola-logo.png" 
              alt="MOLA Logo" 
              className="logo-img"
              onError={(e) => {
                // Logo bulunamazsa placeholder göster
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
            <div className="logo-placeholder-modern" style={{ display: 'none' }}>
              <div className="mola-text">MOLA</div>
            </div>
          </div>
          <div className="logo-info">
            <h4>Prim Sistemi</h4>
            <p>Satış Kayıt ve Raporlama</p>
          </div>
        </div>
      </div>

      <Nav className="flex-column">
        <LinkContainer to="/dashboard" onClick={handleLinkClick}>
          <Nav.Link>
            <FiHome className="me-2" />
            Dashboard
          </Nav.Link>
        </LinkContainer>

        <div className="px-3 py-2 text-muted small">SATIŞLAR</div>
        
        <LinkContainer to="/sales" onClick={handleLinkClick}>
          <Nav.Link>
            <FiShoppingBag className="me-2" />
            Satışlar
          </Nav.Link>
        </LinkContainer>

        <LinkContainer to="/sales/new" onClick={handleLinkClick}>
          <Nav.Link>
            <FiPlus className="me-2" />
            Yeni Satış
          </Nav.Link>
        </LinkContainer>

        <LinkContainer to="/sales/cancelled" onClick={handleLinkClick}>
          <Nav.Link>
            <FiX className="me-2" />
            İptal Edilenler
          </Nav.Link>
        </LinkContainer>

        <div className="px-3 py-2 text-muted small">PRİMLER</div>

        <LinkContainer to="/prims/transactions" onClick={handleLinkClick}>
          <Nav.Link>
            <FiList className="me-2" />
            Prim İşlemleri
          </Nav.Link>
        </LinkContainer>

        <LinkContainer to="/prims/earnings" onClick={handleLinkClick}>
          <Nav.Link>
            <FiDollarSign className="me-2" />
            Prim Hakedişleri
          </Nav.Link>
        </LinkContainer>

        {isAdmin && (
          <>
            <LinkContainer to="/prims/periods" onClick={handleLinkClick}>
              <Nav.Link>
                <FiCalendar className="me-2" />
                Prim Dönemleri
              </Nav.Link>
            </LinkContainer>

            <div className="px-3 py-2 text-muted small mt-3">YÖNETİM</div>
            
            <LinkContainer to="/admin/pending-users" onClick={handleLinkClick}>
              <Nav.Link>
                <FiClock className="me-2" />
                Onay Bekleyenler
              </Nav.Link>
            </LinkContainer>

            <LinkContainer to="/admin/user-permissions" onClick={handleLinkClick}>
              <Nav.Link>
                <FiShield className="me-2" />
                Kullanıcı Yetkileri
              </Nav.Link>
            </LinkContainer>

            <LinkContainer to="/admin/system-settings" onClick={handleLinkClick}>
              <Nav.Link>
                <FiSettings className="me-2" />
                Sistem Ayarları
              </Nav.Link>
            </LinkContainer>
          </>
        )}

        <div className="px-3 py-2 text-muted small">RAPORLAR</div>

        <LinkContainer to="/reports" onClick={handleLinkClick}>
          <Nav.Link>
            <FiBarChart2 className="me-2" />
            Raporlar
          </Nav.Link>
        </LinkContainer>
      </Nav>
    </div>
  );
};

export default Sidebar;
