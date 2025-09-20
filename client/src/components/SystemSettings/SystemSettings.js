import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Nav,
  Tab,
  Alert,
  Button
} from 'react-bootstrap';
import { 
  FiSettings,
  FiTag,
  FiCreditCard,
  FiPercent,
  FiUsers,
  FiCalendar,
  FiClock,
  FiShield,
  FiMessageSquare,
  FiDatabase,
  FiBell,
  FiRefreshCw,
  FiX,
  FiAlertTriangle
} from 'react-icons/fi';

import SaleTypesManagement from './SaleTypesManagement';
import PaymentMethods from '../Admin/PaymentMethods';
import PrimSettings from '../Prims/PrimSettings';
import PrimPeriods from '../Prims/PrimPeriods';
import PendingUsers from '../Admin/PendingUsers';
import UserPermissions from '../Admin/UserPermissions';
import CommunicationRequirements from './CommunicationRequirements';
import HistoricalDataManagement from '../Communications/HistoricalDataManagement';
import AnnouncementManagement from '../Announcements/AnnouncementManagement';
import HistoricalDataMigration from './HistoricalDataMigration';
import SalesImport from './SalesImport';
import CancelledSalesImport from './CancelledSalesImport';
import LegacyUserManagement from './LegacyUserManagement';
import BackupManagement from '../Admin/BackupManagement';
import RoleManagement from '../Admin/RoleManagement';
import BulkPrimStatusManagement from '../Admin/BulkPrimStatusManagement';
import UserManagement from '../Admin/UserManagement';
import PenaltyManagement from '../Admin/PenaltyManagement';
import ErrorBoundary from '../Common/ErrorBoundary';

const SystemSettings = () => {
  const [activeTab, setActiveTab] = useState('sale-types');
  const [error, setError] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    console.log('🚀 SystemSettings component mounted');
    setIsLoaded(true);
    
    // Global error handler
    const handleError = (event) => {
      console.error('🔥 Global error in SystemSettings:', event.error);
      setError(`JavaScript hatası: ${event.error?.message || 'Bilinmeyen hata'}`);
    };

    const handleUnhandledRejection = (event) => {
      console.error('🔥 Unhandled promise rejection in SystemSettings:', event.reason);
      setError(`Promise hatası: ${event.reason?.message || 'Bilinmeyen hata'}`);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      console.log('🛑 SystemSettings component unmounting');
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Error boundary function
  const handleComponentError = (error, errorInfo) => {
    console.error('❌ SystemSettings component error:', error, errorInfo);
    setError(`Bir bileşen yüklenirken hata oluştu: ${error.message}`);
  };

  // Tab change handler with error handling
  const handleTabChange = (tab) => {
    try {
      console.log('📋 Changing tab to:', tab);
      setActiveTab(tab);
    } catch (error) {
      console.error('❌ Tab change error:', error);
      setError(`Tab değiştirilirken hata oluştu: ${error.message}`);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>
            <FiSettings className="me-2" />
            Sistem Ayarları
          </h1>
          <p className="text-muted mb-0">
            Sistem genelindeki ayarları buradan yönetebilirsiniz
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" className="mb-4">
          <Alert.Heading>Hata!</Alert.Heading>
          <p>{error}</p>
          <Button 
            variant="outline-danger" 
            size="sm" 
            onClick={() => setError(null)}
          >
            Tekrar Dene
          </Button>
        </Alert>
      )}

      {/* Tabs */}
      <Card>
        <Card.Body className="p-0">
          <Tab.Container activeKey={activeTab} onSelect={handleTabChange}>
            <Nav variant="tabs" className="border-bottom">
              <Nav.Item>
                <Nav.Link eventKey="sale-types">
                  <FiTag className="me-2" />
                  Satış Türleri
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="payment-types">
                  <FiCreditCard className="me-2" />
                  Ödeme Yöntemleri
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="prim-rates">
                  <FiPercent className="me-2" />
                  Prim Oranları
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="periods">
                  <FiCalendar className="me-2" />
                  Prim Dönemleri
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="pending-users">
                  <FiClock className="me-2" />
                  Onay Bekleyenler
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="user-management">
                  <FiUsers className="me-2" />
                  Kullanıcı Yönetimi
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="permissions">
                  <FiShield className="me-2" />
                  Kullanıcı Yetkileri
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="role-management">
                  <FiShield className="me-2" />
                  Rol Yönetimi
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="communication-requirements">
                  <FiMessageSquare className="me-2" />
                  İletişim Zorunlulukları
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="historical-data">
                  <FiDatabase className="me-2" />
                  Geçmiş Yıl Verileri
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="announcements">
                  <FiBell className="me-2" />
                  Duyuru Yönetimi
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="data-migration">
                  <FiRefreshCw className="me-2" />
                  Veri Geçişi
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="sales-import">
                  <FiDatabase className="me-2" />
                  Satış Import
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="cancelled-sales-import">
                  <FiX className="me-2" />
                  İptal Import
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="legacy-user">
                  <FiShield className="me-2" />
                  Eski Satış Temsilcisi
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="backup-management">
                  <FiDatabase className="me-2" />
                  Yedek Yönetimi
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="bulk-prim-status">
                  <FiPercent className="me-2" />
                  Toplu Prim Durumu
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="penalty-management">
                  <FiAlertTriangle className="me-2" />
                  Ceza Yönetimi
                </Nav.Link>
              </Nav.Item>
            </Nav>

            <div className="p-4">
              <Tab.Content>
                <Tab.Pane eventKey="sale-types">
                  <ErrorBoundary onError={handleComponentError}>
                    <SaleTypesManagement />
                  </ErrorBoundary>
                </Tab.Pane>
                <Tab.Pane eventKey="payment-types">
                  <ErrorBoundary onError={handleComponentError}>
                    <PaymentMethods />
                  </ErrorBoundary>
                </Tab.Pane>
                <Tab.Pane eventKey="prim-rates">
                  <ErrorBoundary onError={handleComponentError}>
                    <PrimSettings />
                  </ErrorBoundary>
                </Tab.Pane>
                <Tab.Pane eventKey="periods">
                  <ErrorBoundary onError={handleComponentError}>
                    <PrimPeriods />
                  </ErrorBoundary>
                </Tab.Pane>
                <Tab.Pane eventKey="pending-users">
                  <ErrorBoundary onError={handleComponentError}>
                    <PendingUsers />
                  </ErrorBoundary>
                </Tab.Pane>
                <Tab.Pane eventKey="user-management">
                  <ErrorBoundary onError={handleComponentError}>
                    <UserManagement />
                  </ErrorBoundary>
                </Tab.Pane>
                <Tab.Pane eventKey="permissions">
                  <ErrorBoundary onError={handleComponentError}>
                    <UserPermissions />
                  </ErrorBoundary>
                </Tab.Pane>
                <Tab.Pane eventKey="role-management">
                  <ErrorBoundary onError={handleComponentError}>
                    <RoleManagement />
                  </ErrorBoundary>
                </Tab.Pane>
                <Tab.Pane eventKey="communication-requirements">
                  <ErrorBoundary onError={handleComponentError}>
                    <CommunicationRequirements />
                  </ErrorBoundary>
                </Tab.Pane>
                <Tab.Pane eventKey="historical-data">
                  <ErrorBoundary onError={handleComponentError}>
                    <HistoricalDataManagement />
                  </ErrorBoundary>
                </Tab.Pane>
                <Tab.Pane eventKey="announcements">
                  <ErrorBoundary onError={handleComponentError}>
                    <AnnouncementManagement />
                  </ErrorBoundary>
                </Tab.Pane>
                <Tab.Pane eventKey="data-migration">
                  <ErrorBoundary onError={handleComponentError}>
                    <HistoricalDataMigration />
                  </ErrorBoundary>
                </Tab.Pane>
                <Tab.Pane eventKey="sales-import">
                  <ErrorBoundary onError={handleComponentError}>
                    <SalesImport />
                  </ErrorBoundary>
                </Tab.Pane>
                <Tab.Pane eventKey="cancelled-sales-import">
                  <ErrorBoundary onError={handleComponentError}>
                    <CancelledSalesImport />
                  </ErrorBoundary>
                </Tab.Pane>
                <Tab.Pane eventKey="legacy-user">
                  <ErrorBoundary onError={handleComponentError}>
                    <LegacyUserManagement />
                  </ErrorBoundary>
                </Tab.Pane>
                <Tab.Pane eventKey="backup-management">
                  <ErrorBoundary onError={handleComponentError}>
                    <BackupManagement />
                  </ErrorBoundary>
                </Tab.Pane>
                <Tab.Pane eventKey="bulk-prim-status">
                  <ErrorBoundary onError={handleComponentError}>
                    <BulkPrimStatusManagement />
                  </ErrorBoundary>
                </Tab.Pane>
                <Tab.Pane eventKey="penalty-management">
                  <ErrorBoundary onError={handleComponentError}>
                    <PenaltyManagement />
                  </ErrorBoundary>
                </Tab.Pane>
              </Tab.Content>
            </div>
          </Tab.Container>
        </Card.Body>
      </Card>
    </div>
  );
};

export default SystemSettings;
