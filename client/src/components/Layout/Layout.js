import React, { useState, useEffect } from 'react';
import { Button } from 'react-bootstrap';
import { FiMenu, FiX } from 'react-icons/fi';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import DeveloperSignature from '../Common/DeveloperSignature';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  // Body scroll kontrolü (mobil için)
  useEffect(() => {
    if (sidebarOpen) {
      document.body.classList.add('sidebar-open');
    } else {
      document.body.classList.remove('sidebar-open');
    }

    // Cleanup
    return () => {
      document.body.classList.remove('sidebar-open');
    };
  }, [sidebarOpen]);

  // Escape tuşu ile sidebar'ı kapat
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && sidebarOpen) {
        closeSidebar();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [sidebarOpen]);

  return (
    <div className="layout-container">
      {/* Mobile Menu Button */}
      <Button 
        className="mobile-menu-btn d-lg-none" 
        onClick={toggleSidebar}
        variant="dark"
        aria-label={sidebarOpen ? 'Menüyü Kapat' : 'Menüyü Aç'}
      >
        {sidebarOpen ? <FiX /> : <FiMenu />}
      </Button>

      {/* Sidebar Overlay for Mobile */}
      <div 
        className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'show' : ''}`}>
        <Sidebar onLinkClick={closeSidebar} />
      </div>

      {/* Main Content */}
      <div className="main-content">
        <Navbar />
        <div className="content-wrapper p-4">
          <div className="fade-in">
            {children}
          </div>
        </div>
      </div>

      {/* Developer Signature */}
      <DeveloperSignature />
    </div>
  );
};

export default Layout;
