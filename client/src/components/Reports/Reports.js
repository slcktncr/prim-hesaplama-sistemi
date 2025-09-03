import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Tab, 
  Tabs,
  Alert,
  Button,
  Modal,
  Form,
  Dropdown
} from 'react-bootstrap';
import { 
  FiBarChart2, 
  FiTrendingUp, 
  FiUsers, 
  FiCalendar,
  FiTarget,
  FiDownload,
  FiFileText
} from 'react-icons/fi';
import { toast } from 'react-toastify';

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
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState('excel');
  const [exportScope, setExportScope] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [selectedSalesperson, setSelectedSalesperson] = useState('');

  const handleExport = async () => {
    try {
      toast.info('Rapor hazırlanıyor...');
      
      // Burada export işlemi yapılacak
      const params = {
        type: exportType,
        scope: exportScope,
        period: selectedPeriod,
        salesperson: selectedSalesperson
      };
      
      // API çağrısı simülasyonu
      setTimeout(() => {
        toast.success(`${exportType.toUpperCase()} raporu başarıyla indirildi!`);
        setShowExportModal(false);
      }, 2000);
      
    } catch (error) {
      toast.error('Rapor indirme sırasında hata oluştu');
    }
  };

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
        <div className="d-flex gap-2">
          <Button 
            variant="success" 
            onClick={() => setShowExportModal(true)}
          >
            <FiDownload className="me-2" />
            Rapor İndir
          </Button>
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
            <Card 
              className="text-center report-card" 
              style={{ cursor: 'pointer' }}
              onClick={() => setActiveTab('performance')}
            >
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
          <Card 
            className="text-center report-card" 
            style={{ cursor: 'pointer' }}
            onClick={() => setActiveTab('period-comparison')}
          >
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
          <Card 
            className="text-center report-card" 
            style={{ cursor: 'pointer' }}
            onClick={() => setActiveTab('top-performers')}
          >
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

      {/* Export Modal */}
      <Modal show={showExportModal} onHide={() => setShowExportModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <FiDownload className="me-2" />
            Rapor İndir
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Dosya Formatı</Form.Label>
                  <Form.Select 
                    value={exportType} 
                    onChange={(e) => setExportType(e.target.value)}
                  >
                    <option value="excel">Excel (.xlsx)</option>
                    <option value="pdf">PDF (.pdf)</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Rapor Kapsamı</Form.Label>
                  <Form.Select 
                    value={exportScope} 
                    onChange={(e) => setExportScope(e.target.value)}
                  >
                    <option value="all">Tüm Veriler</option>
                    <option value="salesperson">Temsilci Bazında</option>
                    <option value="period">Dönem Bazında</option>
                    <option value="earnings">Hakediş Raporları</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            {exportScope === 'salesperson' && (
              <Form.Group className="mb-3">
                <Form.Label>Temsilci Seçin</Form.Label>
                <Form.Select 
                  value={selectedSalesperson} 
                  onChange={(e) => setSelectedSalesperson(e.target.value)}
                >
                  <option value="">Temsilci seçin...</option>
                  <option value="all">Tüm Temsilciler</option>
                  {/* Burada API'den temsilciler gelecek */}
                </Form.Select>
              </Form.Group>
            )}

            {exportScope === 'period' && (
              <Form.Group className="mb-3">
                <Form.Label>Dönem Seçin</Form.Label>
                <Form.Select 
                  value={selectedPeriod} 
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                >
                  <option value="">Dönem seçin...</option>
                  <option value="current">Mevcut Dönem</option>
                  <option value="all">Tüm Dönemler</option>
                  {/* Burada API'den dönemler gelecek */}
                </Form.Select>
              </Form.Group>
            )}

            <Alert variant="info" className="mb-0">
              <FiFileText className="me-2" />
              <strong>Rapor İçeriği:</strong>
              <ul className="mb-0 mt-2">
                <li>Satış detayları ve prim hesaplamaları</li>
                <li>Performans analizi ve karşılaştırmalar</li>
                <li>İptal edilen satışlar ve kesintiler</li>
                <li>Dönemsel hakediş özetleri</li>
              </ul>
            </Alert>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowExportModal(false)}>
            İptal
          </Button>
          <Button variant="success" onClick={handleExport}>
            <FiDownload className="me-2" />
            {exportType === 'excel' ? 'Excel' : 'PDF'} İndir
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Reports;
