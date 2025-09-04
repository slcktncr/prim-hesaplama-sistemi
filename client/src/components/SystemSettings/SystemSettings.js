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
  FiUsers
} from 'react-icons/fi';

import SaleTypesManagement from './SaleTypesManagement';
import PaymentTypesManagement from './PaymentTypesManagement';
import PrimRatesManagement from './PrimRatesManagement';
import UsersManagement from './UsersManagement';

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
            </Nav>

            <div className="p-4">
              <Tab.Content>
                <Tab.Pane eventKey="sale-types">
                  <SaleTypesManagement />
                </Tab.Pane>
                <Tab.Pane eventKey="payment-types">
                  <PaymentTypesManagement />
                </Tab.Pane>
                <Tab.Pane eventKey="prim-rates">
                  <PrimRatesManagement />
                </Tab.Pane>
                <Tab.Pane eventKey="users">
                  <UsersManagement />
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
