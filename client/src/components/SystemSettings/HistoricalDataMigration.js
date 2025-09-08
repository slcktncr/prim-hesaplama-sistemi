import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Alert, 
  Table, 
  Badge,
  Modal,
  Form,
  Spinner,
  ProgressBar,
  Row,
  Col
} from 'react-bootstrap';
import { 
  FiRefreshCw, 
  FiDatabase, 
  FiCheckCircle, 
  FiXCircle,
  FiAlertTriangle,
  FiPlay,
  FiEye
} from 'react-icons/fi';
import { toast } from 'react-toastify';

import { migrationAPI } from '../../utils/api';

const HistoricalDataMigration = () => {
  const [historicalYears, setHistoricalYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [selectedYears, setSelectedYears] = useState([]);
  const [dryRun, setDryRun] = useState(true);
  const [forceOverride, setForceOverride] = useState(false);
  const [migrationResults, setMigrationResults] = useState(null);

  useEffect(() => {
    fetchHistoricalYears();
  }, []);

  const fetchHistoricalYears = async () => {
    try {
      setLoading(true);
      const response = await migrationAPI.getHistoricalYears();
      setHistoricalYears(response.data || []);
    } catch (error) {
      console.error('Historical years fetch error:', error);
      toast.error('Geçmiş yıl verileri yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleYearSelection = (year, checked) => {
    if (checked) {
      setSelectedYears(prev => [...prev, year]);
    } else {
      setSelectedYears(prev => prev.filter(y => y !== year));
    }
  };

  const handleSelectAll = () => {
    const availableYears = historicalYears
      .filter(y => y.hasData && !y.alreadyMigrated)
      .map(y => y.year);
    setSelectedYears(availableYears);
  };

  const handleDeselectAll = () => {
    setSelectedYears([]);
  };

  const startMigration = async () => {
    if (selectedYears.length === 0) {
      toast.warning('Lütfen geçiş yapılacak yılları seçin');
      return;
    }

    try {
      setMigrationLoading(true);
      setMigrationResults(null);

      const migrationData = {
        years: selectedYears,
        dryRun: dryRun,
        force: forceOverride
      };

      console.log('Starting migration with data:', migrationData);

      const response = await migrationAPI.migrateHistoricalToDaily(migrationData);
      
      console.log('Migration response:', response.data);
      setMigrationResults(response.data.results);

      if (response.data.success) {
        if (dryRun) {
          toast.success('Simülasyon tamamlandı! Sonuçları kontrol edin.');
        } else {
          toast.success('Veri geçişi başarıyla tamamlandı!');
          await fetchHistoricalYears(); // Refresh the list
        }
      }

    } catch (error) {
      console.error('Migration error:', error);
      toast.error('Veri geçişi sırasında hata oluştu: ' + (error.response?.data?.message || error.message));
    } finally {
      setMigrationLoading(false);
    }
  };

  const closeMigrationModal = () => {
    setShowMigrationModal(false);
    setSelectedYears([]);
    setDryRun(true);
    setForceOverride(false);
    setMigrationResults(null);
  };

  const getMigrationStatus = (year) => {
    if (!year.hasData) {
      return <Badge bg="secondary">Veri Yok</Badge>;
    }
    if (year.alreadyMigrated) {
      return <Badge bg="success">Geçiş Tamamlandı</Badge>;
    }
    return <Badge bg="warning">Geçiş Bekliyor</Badge>;
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2">Geçmiş yıl verileri yükleniyor...</p>
      </div>
    );
  }

  return (
    <div>
      <Card>
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">
              <FiDatabase className="me-2" />
              Geçmiş Yıl Verilerini Günlük Kayıtlara Dönüştür
            </h5>
            <Button 
              variant="outline-primary" 
              size="sm" 
              onClick={fetchHistoricalYears}
              disabled={loading}
            >
              <FiRefreshCw className="me-1" />
              Yenile
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          <Alert variant="info">
            <strong>ℹ️ Önemli Bilgi:</strong> Bu araç, geçmiş yıl verilerinde toplam olarak girilen 
            iletişim ve satış verilerini günlük kayıtlara dönüştürür. Bu sayede tüm raporlar 
            geçmiş verileri doğru şekilde gösterebilir.
          </Alert>

          {historicalYears.length === 0 ? (
            <Alert variant="warning">
              <FiAlertTriangle className="me-2" />
              Geçiş yapılabilir geçmiş yıl verisi bulunamadı.
            </Alert>
          ) : (
            <>
              <div className="mb-3">
                <Button 
                  variant="primary" 
                  onClick={() => setShowMigrationModal(true)}
                  disabled={migrationLoading}
                >
                  <FiPlay className="me-2" />
                  Veri Geçişini Başlat
                </Button>
              </div>

              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th>Yıl</th>
                    <th>Kullanıcı Sayısı</th>
                    <th>İletişim Kullanıcısı</th>
                    <th>Durum</th>
                    <th>Geçiş Yapılan Kayıtlar</th>
                    <th>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {historicalYears.map(year => (
                    <tr key={year.year}>
                      <td>
                        <strong>{year.year}</strong>
                      </td>
                      <td>
                        <Badge bg="info">{year.usersCount}</Badge>
                      </td>
                      <td>
                        <Badge bg="info">{year.communicationUsersCount}</Badge>
                      </td>
                      <td>
                        {getMigrationStatus(year)}
                      </td>
                      <td>
                        {year.alreadyMigrated ? (
                          <div>
                            <small className="text-muted">
                              İletişim: <Badge bg="secondary">{year.migratedRecords.communication}</Badge>
                              {' '}
                              Satış: <Badge bg="secondary">{year.migratedRecords.sales}</Badge>
                            </small>
                          </div>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          disabled={!year.hasData}
                          onClick={() => {
                            setSelectedYears([year.year]);
                            setShowMigrationModal(true);
                          }}
                        >
                          <FiEye className="me-1" />
                          Detay
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}
        </Card.Body>
      </Card>

      {/* Migration Modal */}
      <Modal 
        show={showMigrationModal} 
        onHide={closeMigrationModal}
        size="lg"
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FiDatabase className="me-2" />
            Veri Geçişi
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row>
            <Col md={6}>
              <h6>Yıl Seçimi</h6>
              <div className="mb-3">
                <Button 
                  variant="outline-primary" 
                  size="sm" 
                  onClick={handleSelectAll}
                  className="me-2"
                >
                  Tümünü Seç
                </Button>
                <Button 
                  variant="outline-secondary" 
                  size="sm" 
                  onClick={handleDeselectAll}
                >
                  Seçimi Temizle
                </Button>
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {historicalYears.filter(y => y.hasData).map(year => (
                  <Form.Check
                    key={year.year}
                    type="checkbox"
                    id={`year-${year.year}`}
                    label={
                      <span>
                        {year.year} 
                        {year.alreadyMigrated && (
                          <Badge bg="warning" className="ms-2">Geçiş Yapılmış</Badge>
                        )}
                      </span>
                    }
                    checked={selectedYears.includes(year.year)}
                    onChange={(e) => handleYearSelection(year.year, e.target.checked)}
                    disabled={year.alreadyMigrated && !forceOverride}
                  />
                ))}
              </div>
            </Col>
            <Col md={6}>
              <h6>Geçiş Ayarları</h6>
              <Form.Check
                type="switch"
                id="dry-run-switch"
                label="Simülasyon Modu (Gerçek veri yazmaz)"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="mb-3"
              />
              <Form.Check
                type="switch"
                id="force-override-switch"
                label="Mevcut kayıtların üzerine yaz"
                checked={forceOverride}
                onChange={(e) => setForceOverride(e.target.checked)}
                className="mb-3"
              />
              {forceOverride && (
                <Alert variant="warning" className="small">
                  <FiAlertTriangle className="me-1" />
                  Bu seçenek mevcut geçiş kayıtlarını siler!
                </Alert>
              )}
            </Col>
          </Row>

          {migrationResults && (
            <div className="mt-4">
              <hr />
              <h6>Geçiş Sonuçları</h6>
              {migrationResults.dryRun && (
                <Alert variant="info">
                  <strong>Simülasyon Modu:</strong> Gerçek veri yazılmadı.
                </Alert>
              )}
              
              <Row>
                <Col md={6}>
                  <Card>
                    <Card.Body>
                      <h6 className="text-primary">Toplam Kayıtlar</h6>
                      <p className="mb-1">
                        <strong>İletişim:</strong> {migrationResults.totalCommunicationRecords}
                      </p>
                      <p className="mb-1">
                        <strong>Satış:</strong> {migrationResults.totalSalesRecords}
                      </p>
                      <p className="mb-0">
                        <strong>İşlenen Yıl:</strong> {migrationResults.processedYears.length}
                      </p>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  {migrationResults.errors.length > 0 && (
                    <Card border="danger">
                      <Card.Body>
                        <h6 className="text-danger">Hatalar</h6>
                        {migrationResults.errors.map((error, index) => (
                          <small key={index} className="d-block text-danger">
                            {error}
                          </small>
                        ))}
                      </Card.Body>
                    </Card>
                  )}
                </Col>
              </Row>

              {migrationResults.processedYears.length > 0 && (
                <div className="mt-3">
                  <h6>Yıl Detayları</h6>
                  <Table size="sm" striped>
                    <thead>
                      <tr>
                        <th>Yıl</th>
                        <th>İletişim Kayıtları</th>
                        <th>Satış Kayıtları</th>
                        <th>İşlenen Kullanıcı</th>
                      </tr>
                    </thead>
                    <tbody>
                      {migrationResults.processedYears.map(year => (
                        <tr key={year.year}>
                          <td>{year.year}</td>
                          <td>{year.communicationRecords}</td>
                          <td>{year.salesRecords}</td>
                          <td>{year.processedUsers}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeMigrationModal}>
            Kapat
          </Button>
          <Button 
            variant="primary" 
            onClick={startMigration}
            disabled={migrationLoading || selectedYears.length === 0}
          >
            {migrationLoading ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Geçiş Yapılıyor...
              </>
            ) : (
              <>
                <FiPlay className="me-2" />
                {dryRun ? 'Simülasyonu Başlat' : 'Geçişi Başlat'}
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default HistoricalDataMigration;
