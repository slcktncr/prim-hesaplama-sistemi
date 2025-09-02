import React from 'react';
import { Navbar as BSNavbar, Nav, NavDropdown, Container } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import { FiUser, FiLogOut } from 'react-icons/fi';

const Navbar = () => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <BSNavbar bg="dark" variant="dark" expand="lg" className="mb-0">
      <Container fluid>
        <BSNavbar.Brand href="/dashboard">
          Prim Hesaplama Sistemi
        </BSNavbar.Brand>
        
        <BSNavbar.Toggle aria-controls="basic-navbar-nav" />
        <BSNavbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto">
            <NavDropdown
              title={
                <span>
                  <FiUser className="me-2" />
                  {user?.name}
                  {user?.role === 'admin' && (
                    <span className="badge bg-warning ms-2">Admin</span>
                  )}
                </span>
              }
              id="user-nav-dropdown"
              align="end"
            >
              <NavDropdown.Item>
                <FiUser className="me-2" />
                Profil
              </NavDropdown.Item>
              <NavDropdown.Divider />
              <NavDropdown.Item onClick={handleLogout}>
                <FiLogOut className="me-2" />
                Çıkış Yap
              </NavDropdown.Item>
            </NavDropdown>
          </Nav>
        </BSNavbar.Collapse>
      </Container>
    </BSNavbar>
  );
};

export default Navbar;
