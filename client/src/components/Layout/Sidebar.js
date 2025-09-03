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
  FiUsers
} from 'react-icons/fi';

const Sidebar = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

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
              style={{ display: 'block' }}
            />
          </div>
          <div className="logo-info">
            <h4>Prim Sistemi</h4>
            <p>Satış ve Komisyon Yönetimi</p>
          </div>
        </div>
      </div>

      <Nav className="flex-column">
        <LinkContainer to="/dashboard">
          <Nav.Link>
            <FiHome className="me-2" />
            Dashboard
          </Nav.Link>
        </LinkContainer>

        <div className="px-3 py-2 text-muted small">SATIŞLAR</div>
        
        <LinkContainer to="/sales">
          <Nav.Link>
            <FiShoppingBag className="me-2" />
            Satışlar
          </Nav.Link>
        </LinkContainer>

        <LinkContainer to="/sales/new">
          <Nav.Link>
            <FiPlus className="me-2" />
            Yeni Satış
          </Nav.Link>
        </LinkContainer>

        <LinkContainer to="/sales/cancelled">
          <Nav.Link>
            <FiX className="me-2" />
            İptal Edilenler
          </Nav.Link>
        </LinkContainer>

        <div className="px-3 py-2 text-muted small">PRİMLER</div>

        <LinkContainer to="/prims/transactions">
          <Nav.Link>
            <FiList className="me-2" />
            Prim İşlemleri
          </Nav.Link>
        </LinkContainer>

        <LinkContainer to="/prims/earnings">
          <Nav.Link>
            <FiDollarSign className="me-2" />
            Prim Hakedişleri
          </Nav.Link>
        </LinkContainer>

        {isAdmin && (
          <>
            <LinkContainer to="/prims/periods">
              <Nav.Link>
                <FiCalendar className="me-2" />
                Prim Dönemleri
              </Nav.Link>
            </LinkContainer>

            <LinkContainer to="/prims/settings">
              <Nav.Link>
                <FiSettings className="me-2" />
                Prim Ayarları
              </Nav.Link>
            </LinkContainer>

            <div className="px-3 py-2 text-muted small mt-3">YÖNETİM</div>
            
            <LinkContainer to="/admin/pending-users">
              <Nav.Link>
                <FiClock className="me-2" />
                Onay Bekleyenler
              </Nav.Link>
            </LinkContainer>

            <LinkContainer to="/admin/active-users">
              <Nav.Link>
                <FiUsers className="me-2" />
                Aktif Kullanıcılar
              </Nav.Link>
            </LinkContainer>
          </>
        )}

        <div className="px-3 py-2 text-muted small">RAPORLAR</div>

        <LinkContainer to="/reports">
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
