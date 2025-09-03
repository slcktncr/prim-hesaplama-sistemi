import React, { useState } from 'react';
import { Button } from 'react-bootstrap';
import { FiMenu } from 'react-icons/fi';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="layout-container">
      {/* Mobile Menu Button */}
      <Button 
        className="mobile-menu-btn d-lg-none" 
        onClick={toggleSidebar}
        variant="dark"
      >
        <FiMenu />
      </Button>

      {/* Sidebar Overlay for Mobile */}
      <div 
        className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'show' : ''}`}>
        <Sidebar />
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
    </div>
  );
};

export default Layout;
