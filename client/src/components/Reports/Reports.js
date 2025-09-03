import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Tab, 
  Tabs,
  Alert
} from 'react-bootstrap';
import { 
  FiBarChart2, 
  FiTrendingUp, 
  FiUsers, 
  FiCalendar,
  FiTarget
} from 'react-icons/fi';

import { useAuth } from '../../context/AuthContext';
import SalesSummaryReport from './SalesSummaryReport';
import PerformanceReport from './PerformanceReport';
import PeriodComparisonReport from './PeriodComparisonReport';
import TopPerformersReport from './TopPerformersReport';
import DetailedReport from './DetailedReport';

const Reports = () => {
  const [activeTab, setActiveTab] = useState('sales-summary');
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>
            <FiBarChart2 className="me-2" />
            Raporlar
          </h1>
          <p className="text-muted mb-0">
            Satış performansı ve prim analiz raporları
            {!isAdmin && ` (${user?.name})`}
          </p>
        </div>
      </div>

      {/* Info Alert for Non-Admin Users */}
      {!isAdmin && (
        <Alert variant="info" className="mb-4">
          <strong>Bilgi:</strong> Bu sayfada sadece kendi satış ve prim verilerinizi görebilirsiniz. 
          Genel raporlar için admin yetkisi gereklidir.
        </Alert>
      )}

      {/* Report Tabs */}
      <Card>
        <Card.Body>
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k)}
            className="mb-4"
          >
            {/* Sales Summary Tab */}
            <Tab 
              eventKey="sales-summary" 
              title={
                <span>
                  <FiBarChart2 className="me-2" />
                  Satış Özeti
                </span>
              }
            >
              <SalesSummaryReport />
            </Tab>

            {/* Performance Report Tab - Admin Only */}
            {isAdmin && (
              <Tab 
                eventKey="performance" 
                title={
                  <span>
                    <FiTrendingUp className="me-2" />
                    Temsilci Performansı
                  </span>
                }
              >
                <PerformanceReport />
              </Tab>
            )}

            {/* Period Comparison Tab */}
            <Tab 
              eventKey="period-comparison" 
              title={
                <span>
                  <FiCalendar className="me-2" />
                  Dönem Karşılaştırma
                </span>
              }
            >
              <PeriodComparisonReport />
            </Tab>

            {/* Top Performers Tab */}
            <Tab 
              eventKey="top-performers" 
              title={
                <span>
                  <FiTarget className="me-2" />
                  En İyi Performans
                </span>
              }
            >
              <TopPerformersReport />
            </Tab>

            {/* Detailed Report Tab */}
            <Tab 
              eventKey="detailed" 
              title={
                <span>
                  <FiUsers className="me-2" />
                  Detaylı Rapor
                </span>
              }
            >
              <DetailedReport />
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>

      {/* Quick Stats Cards */}
      <Row className="mt-4">
                  <Col md={3}>
            <Card className="text-center">
              <Card.Body>
                <FiBarChart2 size={32} className="text-primary mb-2" />
                <div className="h6">Satış Özeti</div>
                <div className="small text-muted">
                  Toplam satış ve ciro analizi
                </div>
              </Card.Body>
            </Card>
          </Col>
        
        {isAdmin && (
          <Col md={3}>
            <Card className="text-center">
              <Card.Body>
                <FiTrendingUp size={32} className="text-success mb-2" />
                <div className="h6">Performans</div>
                <div className="small text-muted">
                  Temsilci bazında analiz
                </div>
              </Card.Body>
            </Card>
          </Col>
        )}
        
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <FiCalendar size={32} className="text-info mb-2" />
              <div className="h6">Dönem Analizi</div>
              <div className="small text-muted">
                Aylık karşılaştırmalar
              </div>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <FiTarget size={32} className="text-warning mb-2" />
              <div className="h6">Liderlik</div>
              <div className="small text-muted">
                En başarılı temsilciler
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Reports;
