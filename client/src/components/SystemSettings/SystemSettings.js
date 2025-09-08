import React, { useState } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Nav,
  Tab
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
  FiRefreshCw
} from 'react-icons/fi';

import SaleTypesManagement from './SaleTypesManagement';
import PaymentMethods from '../Admin/PaymentMethods';
import PrimSettings from '../Prims/PrimSettings';
import ActiveUsers from '../Admin/ActiveUsers';
import PrimPeriods from '../Prims/PrimPeriods';
import PendingUsers from '../Admin/PendingUsers';
import UserPermissions from '../Admin/UserPermissions';
import CommunicationRequirements from './CommunicationRequirements';
import HistoricalDataManagement from '../Communications/HistoricalDataManagement';
import AnnouncementManagement from '../Announcements/AnnouncementManagement';
import HistoricalDataMigration from './HistoricalDataMigration';
import SalesImport from './SalesImport';

const SystemSettings = () => {
  const [activeTab, setActiveTab] = useState('sale-types');

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

      {/* Tabs */}
      <Card>
        <Card.Body className="p-0">
          <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
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
                <Nav.Link eventKey="users">
                  <FiUsers className="me-2" />
                  Kullanıcı Yönetimi
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
                <Nav.Link eventKey="permissions">
                  <FiShield className="me-2" />
                  Kullanıcı Yetkileri
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
            </Nav>

            <div className="p-4">
              <Tab.Content>
                <Tab.Pane eventKey="sale-types">
                  <SaleTypesManagement />
                </Tab.Pane>
                <Tab.Pane eventKey="payment-types">
                  <PaymentMethods />
                </Tab.Pane>
                <Tab.Pane eventKey="prim-rates">
                  <PrimSettings />
                </Tab.Pane>
                <Tab.Pane eventKey="users">
                  <ActiveUsers />
                </Tab.Pane>
                <Tab.Pane eventKey="periods">
                  <PrimPeriods />
                </Tab.Pane>
                <Tab.Pane eventKey="pending-users">
                  <PendingUsers />
                </Tab.Pane>
                <Tab.Pane eventKey="permissions">
                  <UserPermissions />
                </Tab.Pane>
                <Tab.Pane eventKey="communication-requirements">
                  <CommunicationRequirements />
                </Tab.Pane>
                <Tab.Pane eventKey="historical-data">
                  <HistoricalDataManagement />
                </Tab.Pane>
                <Tab.Pane eventKey="announcements">
                  <AnnouncementManagement />
                </Tab.Pane>
                <Tab.Pane eventKey="data-migration">
                  <HistoricalDataMigration />
                </Tab.Pane>
                <Tab.Pane eventKey="sales-import">
                  <SalesImport />
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
