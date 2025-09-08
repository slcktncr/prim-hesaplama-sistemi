import React, { useState } from 'react';
import { 
  Card, 
  Button, 
  Alert, 
  Form,
  Modal,
  Spinner,
  ProgressBar,
  Row,
  Col,
  Table,
  Badge
} from 'react-bootstrap';
import { 
  FiUpload, 
  FiDownload, 
  FiFileText,
  FiCheckCircle,
  FiXCircle,
  FiAlertTriangle,
  FiPlay,
  FiRotateCcw
} from 'react-icons/fi';
import { toast } from 'react-toastify';

import { salesImportAPI } from '../../utils/api';

const SalesImport = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [rollbackHours, setRollbackHours] = useState(2);
  const [rollbackMode, setRollbackMode] = useState('hours'); // 'hours' or 'dateRange'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [overwriteExisting, setOverwriteExisting] = useState(false);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Dosya türü kontrolü
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];
      
      if (!validTypes.includes(file.type)) {
        toast.error('Lütfen sadece Excel dosyaları (.xlsx, .xls) seçin');
        return;
      }
      
      // Dosya boyutu kontrolü (10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Dosya boyutu 10MB\'dan büyük olamaz');
        return;
      }
      
      setSelectedFile(file);
      toast.success(`Dosya seçildi: ${file.name}`);
    }
  };

  const handleRollback = async () => {
    let confirmMessage = '';
    let options = {};
    
    if (rollbackMode === 'hours') {
      confirmMessage = `⚠️ Son ${rollbackHours} saatte eklenen kayıtları geri almak istediğinizden emin misiniz?\n\nBu işlem GERİ ALINAMAZ!`;
      options = { hours: rollbackHours };
    } else {
      if (!startDate || !endDate) {
        toast.error('Başlangıç ve bitiş tarihlerini seçiniz');
        return;
      }
      
      const start = new Date(startDate).toLocaleDateString('tr-TR');
      const end = new Date(endDate).toLocaleDateString('tr-TR');
      confirmMessage = `⚠️ ${start} - ${end} tarihleri arasında eklenen kayıtları geri almak istediğinizden emin misiniz?\n\nBu işlem GERİ ALINAMAZ!`;
      options = { startDate, endDate };
    }
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsRollingBack(true);
    try {
      const response = await salesImportAPI.rollbackImports(options);
      
      if (response.data.success) {
        toast.success(`✅ ${response.data.deletedCount} adet kayıt başarıyla geri alındı!`);
        setImportResults(null);
        setSelectedFile(null);
        
        // File input'u temizle
        const fileInput = document.getElementById('salesFileInput');
        if (fileInput) fileInput.value = '';
      } else {
        toast.error('Import geri alma işlemi başarısız oldu');
      }
    } catch (error) {
      console.error('Rollback error:', error);
      toast.error('Import geri alma sırasında hata oluştu: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsRollingBack(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await salesImportAPI.downloadTemplate();
      
      // Blob'u dosya olarak indir
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'satis_import_sablonu.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Şablon dosyası indirildi');
    } catch (error) {
      console.error('Template download error:', error);
      toast.error('Şablon dosyası indirilemedi');
    }
  };

  const uploadFile = async () => {
    if (!selectedFile) {
      toast.warning('Lütfen bir Excel dosyası seçin');
      return;
    }

    try {
      setUploading(true);
      setImportResults(null);

      const formData = new FormData();
      formData.append('salesFile', selectedFile);
      formData.append('dryRun', dryRun.toString());
      formData.append('overwriteExisting', overwriteExisting.toString());

      console.log('Uploading file:', selectedFile.name, 'dryRun:', dryRun);

      const response = await salesImportAPI.uploadFile(formData);
      
      console.log('Upload response:', response.data);
      setImportResults(response.data.results);
      setShowResultsModal(true);

      if (response.data.success) {
        if (dryRun) {
          toast.success('Dosya analizi tamamlandı! Sonuçları kontrol edin.');
        } else {
          toast.success('Satış verileri başarıyla import edildi!');
        }
      } else {
        toast.warning('Import tamamlandı ancak bazı hatalar var');
      }

    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Import sırasında hata oluştu: ' + (error.response?.data?.message || error.message));
    } finally {
      setUploading(false);
    }
  };

  const closeResultsModal = () => {
    setShowResultsModal(false);
    setImportResults(null);
    setSelectedFile(null);
    // File input'u temizle
    const fileInput = document.getElementById('salesFileInput');
    if (fileInput) fileInput.value = '';
  };

  return (
    <div>
      <Card>
        <Card.Header>
          <h5 className="mb-0">
            <FiUpload className="me-2" />
            Eski Satışları Excel'den Import Et
          </h5>
        </Card.Header>
        <Card.Body>
          <Alert variant="info">
            <strong>ℹ️ Bilgilendirme:</strong> Bu araçla geçmiş yıllara ait satış verilerinizi 
            Excel dosyasından toplu olarak sisteme aktarabilirsiniz. Tüm veriler admin kullanıcısı 
            üzerine kaydedilir ve sonradan düzenlenebilir.
          </Alert>

          <Row>
            <Col md={6}>
              <Card>
                <Card.Body>
                  <h6 className="text-primary">1. Excel Şablonunu İndirin</h6>
                  <p className="small text-muted">
                    Öncelikle doğru format için örnek şablonu indirin ve verilerinizi bu formata göre hazırlayın.
                  </p>
                  <div className="d-flex gap-2 mb-3">
                    <Button 
                      variant="outline-primary" 
                      onClick={downloadTemplate}
                      className="flex-fill"
                    >
                      <FiDownload className="me-2" />
                      Excel Şablonunu İndir
                    </Button>
                    
                    <Button 
                      variant="outline-danger" 
                      onClick={handleRollback}
                      disabled={isRollingBack}
                      className="flex-fill"
                      title={`Son ${rollbackHours} saatteki kayıtları geri al`}
                    >
                      {isRollingBack ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" />
                          Geri Alınıyor...
                        </>
                      ) : (
                        <>
                          <FiRotateCcw className="me-2" />
                          Son {rollbackHours}h Geri Al
                        </>
                      )}
                    </Button>
                  </div>
                  
                  <div className="mb-3">
                    <Form.Label className="small">Geri Alma Türü</Form.Label>
                    <div className="d-flex gap-3 mb-2">
                      <Form.Check
                        type="radio"
                        id="rollback-hours"
                        label="Saat Bazında"
                        checked={rollbackMode === 'hours'}
                        onChange={() => setRollbackMode('hours')}
                      />
                      <Form.Check
                        type="radio"
                        id="rollback-daterange"
                        label="Tarih Aralığı"
                        checked={rollbackMode === 'dateRange'}
                        onChange={() => setRollbackMode('dateRange')}
                      />
                    </div>
                    
                    {rollbackMode === 'hours' ? (
                      <>
                        <Form.Select
                          size="sm"
                          value={rollbackHours}
                          onChange={(e) => setRollbackHours(parseInt(e.target.value))}
                          className="w-50"
                        >
                          <option value={1}>Son 1 saat</option>
                          <option value={2}>Son 2 saat</option>
                          <option value={6}>Son 6 saat</option>
                          <option value={12}>Son 12 saat</option>
                          <option value={24}>Son 24 saat</option>
                          <option value={48}>Son 48 saat</option>
                        </Form.Select>
                        <Form.Text className="text-muted">
                          Seçilen süre içinde eklenen kayıtlar silinecek
                        </Form.Text>
                      </>
                    ) : (
                      <>
                        <Row>
                          <Col md={6}>
                            <Form.Label className="small">Başlangıç Tarihi ve Saati</Form.Label>
                            <Form.Control
                              type="datetime-local"
                              size="sm"
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                              placeholder="Başlangıç tarih ve saat seçin"
                            />
                          </Col>
                          <Col md={6}>
                            <Form.Label className="small">Bitiş Tarihi ve Saati</Form.Label>
                            <Form.Control
                              type="datetime-local"
                              size="sm"
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
                              placeholder="Bitiş tarih ve saat seçin"
                            />
                          </Col>
                        </Row>
                        <Form.Text className="text-muted">
                          📅 Tarih ve 🕐 saat (dakika dahil) seçebilirsiniz. Örn: 08/01/2025 14:30
                        </Form.Text>
                      </>
                    )}
                  </div>
                  
                  <div className="small">
                    <strong>Gerekli Kolonlar:</strong>
                    <ul className="mt-2 mb-0">
                      <li>Müşteri Adı, Blok No, Daire No</li>
                      <li>Satış Tarihi (YYYY-MM-DD)</li>
                      <li>Liste Fiyatı, Aktivite Fiyatı</li>
                      <li>Prim Tutarı, Prim Durumu</li>
                      <li>Satış Temsilcisi (username)</li>
                    </ul>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={6}>
              <Card>
                <Card.Body>
                  <h6 className="text-success">2. Excel Dosyasını Yükleyin</h6>
                  <Form.Group className="mb-3">
                    <Form.Label>Excel Dosyası Seçin</Form.Label>
                    <Form.Control
                      id="salesFileInput"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileSelect}
                    />
                    <Form.Text className="text-muted">
                      Sadece .xlsx ve .xls dosyaları kabul edilir (Max: 10MB)
                    </Form.Text>
                  </Form.Group>

                  {selectedFile && (
                    <Alert variant="success" className="small">
                      <FiFileText className="me-2" />
                      <strong>Seçilen Dosya:</strong> {selectedFile.name}
                      <br />
                      <strong>Boyut:</strong> {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </Alert>
                  )}

                  <div className="mb-3">
                    <Form.Check
                      type="switch"
                      id="dry-run-switch"
                      label="Simülasyon Modu (Gerçek veri yazmaz)"
                      checked={dryRun}
                      onChange={(e) => setDryRun(e.target.checked)}
                      className="mb-2"
                    />
                    <Form.Check
                      type="switch"
                      id="overwrite-switch"
                      label="Mevcut kayıtların üzerine yaz"
                      checked={overwriteExisting}
                      onChange={(e) => setOverwriteExisting(e.target.checked)}
                    />
                  </div>

                  <Button 
                    variant="primary" 
                    onClick={uploadFile}
                    disabled={!selectedFile || uploading}
                    className="w-100"
                  >
                    {uploading ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        {dryRun ? 'Analiz Ediliyor...' : 'Import Ediliyor...'}
                      </>
                    ) : (
                      <>
                        <FiPlay className="me-2" />
                        {dryRun ? 'Dosyayı Analiz Et' : 'Import Et'}
                      </>
                    )}
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Results Modal */}
      <Modal 
        show={showResultsModal} 
        onHide={closeResultsModal}
        size="lg"
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <FiFileText className="me-2" />
            Import Sonuçları
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {importResults && (
            <div>
              {importResults.dryRun && (
                <Alert variant="info">
                  <strong>Simülasyon Modu:</strong> Gerçek veri yazılmadı.
                </Alert>
              )}
              
              <Row className="mb-4">
                <Col md={3}>
                  <Card className="text-center">
                    <Card.Body>
                      <h4 className="text-primary">{importResults.totalRows}</h4>
                      <small>Toplam Satır</small>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={3}>
                  <Card className="text-center">
                    <Card.Body>
                      <h4 className="text-success">{importResults.validRows}</h4>
                      <small>Geçerli Kayıt</small>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={3}>
                  <Card className="text-center">
                    <Card.Body>
                      <h4 className="text-danger">{importResults.invalidRows}</h4>
                      <small>Hatalı Kayıt</small>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={3}>
                  <Card className="text-center">
                    <Card.Body>
                      <h4 className="text-info">{importResults.importedRows}</h4>
                      <small>Import Edilen</small>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>

              {importResults.errors.length > 0 && (
                <div className="mb-4">
                  <h6 className="text-danger">
                    <FiXCircle className="me-2" />
                    Hatalar ({importResults.errors.length})
                  </h6>
                  <div 
                    className="border rounded p-3 bg-light" 
                    style={{ maxHeight: '200px', overflowY: 'auto' }}
                  >
                    {importResults.errors.map((error, index) => (
                      <div key={index} className="small text-danger mb-1">
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importResults.warnings.length > 0 && (
                <div className="mb-4">
                  <h6 className="text-warning">
                    <FiAlertTriangle className="me-2" />
                    Uyarılar ({importResults.warnings.length})
                  </h6>
                  <div 
                    className="border rounded p-3 bg-light" 
                    style={{ maxHeight: '150px', overflowY: 'auto' }}
                  >
                    {importResults.warnings.map((warning, index) => (
                      <div key={index} className="small text-warning mb-1">
                        {warning}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {importResults.validRows > 0 && importResults.dryRun && (
                <Alert variant="success">
                  <FiCheckCircle className="me-2" />
                  <strong>Analiz Başarılı!</strong> {importResults.validRows} adet geçerli kayıt bulundu. 
                  Gerçek import için "Simülasyon Modu"nu kapatın ve tekrar yükleyin.
                </Alert>
              )}

              {importResults.importedRows > 0 && !importResults.dryRun && (
                <Alert variant="success">
                  <FiCheckCircle className="me-2" />
                  <strong>Import Tamamlandı!</strong> {importResults.importedRows} adet satış kaydı başarıyla eklendi.
                </Alert>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeResultsModal}>
            Kapat
          </Button>
          {importResults && importResults.validRows > 0 && importResults.dryRun && (
            <Button 
              variant="primary" 
              onClick={() => {
                setDryRun(false);
                closeResultsModal();
              }}
            >
              Gerçek Import İçin Hazır
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default SalesImport;
