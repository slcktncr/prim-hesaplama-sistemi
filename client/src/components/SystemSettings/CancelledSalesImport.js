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
  Badge,
  Table
} from 'react-bootstrap';
import { 
  FiUpload, 
  FiDownload, 
  FiFileText,
  FiCheckCircle,
  FiXCircle,
  FiAlertTriangle,
  FiPlay,
  FiRotateCcw,
  FiInfo
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { cancelledSalesImportAPI } from '../../utils/api';

const CancelledSalesImport = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [dryRun, setDryRun] = useState(true);

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

  const downloadTemplate = async () => {
    try {
      const response = await cancelledSalesImportAPI.downloadTemplate();
      
      // Blob oluştur ve indir
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'iptal_import_sablonu.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Şablon başarıyla indirildi');
    } catch (error) {
      console.error('Template download error:', error);
      toast.error('Şablon indirilemedi');
    }
  };

  const uploadFile = async () => {
    if (!selectedFile) {
      toast.error('Lütfen önce bir dosya seçin');
      return;
    }

    try {
      setUploading(true);
      setImportResults(null);

      const formData = new FormData();
      formData.append('cancelledSalesFile', selectedFile);
      formData.append('dryRun', dryRun.toString());

      console.log('Uploading cancelled sales file:', selectedFile.name, 'dryRun:', dryRun);
      
      // Progress simulation for large files
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 500);

      const response = await cancelledSalesImportAPI.uploadFile(formData);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      console.log('Upload response:', response.data);
      setImportResults(response.data.results);
      setShowResultsModal(true);

      if (response.data.success) {
        if (dryRun) {
          toast.success('Dosya analizi tamamlandı! Sonuçları kontrol edin.');
        } else {
          toast.success('İptal edilen satışlar başarıyla import edildi!');
        }
      } else {
        toast.warning('Import tamamlandı ancak bazı hatalar var');
      }

    } catch (error) {
      console.error('Upload error:', error);
      if (error.code === 'ECONNABORTED') {
        toast.error('⏰ Dosya çok büyük veya işlem zaman aşımına uğradı. Lütfen daha küçük dosyalarla deneyin.');
      } else {
        toast.error('Import sırasında hata oluştu: ' + (error.response?.data?.message || error.message));
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const closeResultsModal = () => {
    setShowResultsModal(false);
    setImportResults(null);
    setSelectedFile(null);
    // Dosya input'unu temizle
    const fileInput = document.getElementById('cancelledSalesFileInput');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const getStatusBadge = (type, count) => {
    if (count === 0) return null;
    
    const variants = {
      valid: 'success',
      invalid: 'danger',
      imported: 'primary',
      skipped: 'secondary'
    };
    
    return <Badge bg={variants[type]} className="ms-2">{count}</Badge>;
  };

  return (
    <div className="container-fluid">
      <Row>
        <Col>
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                <FiRotateCcw className="me-2" />
                İptal Edilen Satışları Excel'den Import Et
              </h5>
            </Card.Header>
            <Card.Body>
              <Alert variant="info" className="mb-4">
                <FiInfo className="me-2" />
                <strong>Bilgilendirme:</strong> Bu araçla geçmiş yıllara ait iptal edilmiş satış verilerinizi Excel dosyasından toplu olarak sisteme aktarabilirsiniz. 
                Tüm veriler admin kullanıcısı üzerine kaydedilir ve sonradan düzenlenebilir.
              </Alert>

              <Row>
                <Col md={6}>
                  <Card className="h-100">
                    <Card.Header>
                      <h6 className="mb-0">1. Excel Şablonunu İndirin</h6>
                    </Card.Header>
                    <Card.Body>
                      <p className="text-muted small mb-3">
                        Öncelikle doğru format için örnek şablonu indirin ve verilerinizi bu formata göre hazırlayın.
                      </p>
                      
                      <Button 
                        variant="outline-primary" 
                        onClick={downloadTemplate}
                        className="w-100 mb-3"
                      >
                        <FiDownload className="me-2" />
                        Excel Şablonunu İndir
                      </Button>

                      <div className="small text-muted">
                        <strong>Gerekli Kolonlar:</strong>
                        <ul className="mt-2 mb-0">
                          <li>customerName, blockNo, apartmentNo, periodNo</li>
                          <li>saleDate (YYYY-MM-DD)</li>
                          <li>listPrice, activitySalePrice</li>
                          <li>salesperson (Ad Soyad), cancelledAt</li>
                          <li>cancelledBy (Ad Soyad)</li>
                        </ul>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>

                <Col md={6}>
                  <Card className="h-100">
                    <Card.Header>
                      <h6 className="mb-0">2. Excel Dosyasını Yükleyin</h6>
                    </Card.Header>
                    <Card.Body>
                      <Form.Group className="mb-3">
                        <Form.Label>Excel Dosyası Seçin</Form.Label>
                        <Form.Control
                          id="cancelledSalesFileInput"
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handleFileSelect}
                          disabled={uploading}
                        />
                        <Form.Text className="text-muted">
                          Sadece .xlsx ve .xls dosyaları kabul edilir (Max: 10MB)
                        </Form.Text>
                      </Form.Group>

                      {selectedFile && (
                        <Alert variant="success" className="py-2">
                          <FiCheckCircle className="me-2" />
                          <strong>Seçilen dosya:</strong> {selectedFile.name}
                          <br />
                          <small>Boyut: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</small>
                        </Alert>
                      )}

                      <Form.Check 
                        type="switch"
                        id="dryRunSwitch"
                        label="Simülasyon Modu (Gerçek veri yazmaz)"
                        checked={dryRun}
                        onChange={(e) => setDryRun(e.target.checked)}
                        className="mb-3"
                      />

                      <Button 
                        variant={dryRun ? "outline-primary" : "primary"}
                        onClick={uploadFile}
                        disabled={!selectedFile || uploading}
                        className="w-100"
                      >
                        {uploading ? (
                          <>
                            <Spinner size="sm" className="me-2" />
                            İşleniyor...
                          </>
                        ) : (
                          <>
                            <FiPlay className="me-2" />
                            {dryRun ? 'Dosyayı Analiz Et' : 'İptal Verilerini Import Et'}
                          </>
                        )}
                      </Button>

                      {uploading && (
                        <ProgressBar 
                          now={uploadProgress} 
                          className="mt-3"
                          label={`${Math.round(uploadProgress)}%`}
                        />
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Results Modal */}
      <Modal show={showResultsModal} onHide={closeResultsModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {importResults?.dryRun ? 'Analiz Sonuçları' : 'Import Sonuçları'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {importResults && (
            <>
              <Row className="mb-3">
                <Col>
                  <Alert variant={importResults.errors?.length > 0 ? "warning" : "success"}>
                    <div className="d-flex justify-content-between align-items-center">
                      <span>
                        <strong>Toplam Satır:</strong> {importResults.totalRows}
                        {getStatusBadge('valid', importResults.validRows)}
                        {getStatusBadge('invalid', importResults.invalidRows)}
                        {getStatusBadge('imported', importResults.importedRows)}
                        {getStatusBadge('skipped', importResults.skippedRows)}
                      </span>
                    </div>
                  </Alert>
                </Col>
              </Row>

              {importResults.errors?.length > 0 && (
                <div className="mb-3">
                  <h6 className="text-danger">
                    <FiXCircle className="me-2" />
                    Hatalar ({importResults.errors.length})
                  </h6>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    <Table size="sm" striped>
                      <thead>
                        <tr>
                          <th>Satır</th>
                          <th>Hata</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResults.errors.map((error, index) => (
                          <tr key={index}>
                            <td>{error.row}</td>
                            <td className="text-danger small">{error.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </div>
              )}

              {importResults.warnings?.length > 0 && (
                <div className="mb-3">
                  <h6 className="text-warning">
                    <FiAlertTriangle className="me-2" />
                    Uyarılar ({importResults.warnings.length})
                  </h6>
                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {importResults.warnings.map((warning, index) => (
                      <Alert key={index} variant="warning" className="py-2 small">
                        {warning}
                      </Alert>
                    ))}
                  </div>
                </div>
              )}

              {importResults.dryRun && importResults.validRows > 0 && (
                <Alert variant="info">
                  <FiInfo className="me-2" />
                  <strong>Simülasyon Modu:</strong> {importResults.validRows} kayıt import edilmeye hazır. 
                  Gerçek import için simülasyon modunu kapatın ve tekrar yükleyin.
                </Alert>
              )}

              {!importResults.dryRun && importResults.importedRows > 0 && (
                <Alert variant="success">
                  <FiCheckCircle className="me-2" />
                  <strong>Başarılı!</strong> {importResults.importedRows} iptal kaydı sisteme eklendi.
                  {importResults.backupFile && (
                    <div className="mt-2 small">
                      Yedek dosyası: {importResults.backupFile}
                    </div>
                  )}
                </Alert>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeResultsModal}>
            Kapat
          </Button>
          {importResults?.dryRun && importResults?.validRows > 0 && (
            <Button 
              variant="primary" 
              onClick={() => {
                setDryRun(false);
                closeResultsModal();
                setTimeout(() => uploadFile(), 100);
              }}
            >
              Gerçek Import Yap
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CancelledSalesImport;
