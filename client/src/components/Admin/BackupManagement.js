import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Badge, Alert, Modal, Spinner, Form } from 'react-bootstrap';
import { FaDownload, FaHistory, FaTrash, FaInfoCircle, FaExclamationTriangle } from 'react-icons/fa';
import { salesImportAPI } from '../../utils/api';

const BackupManagement = () => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await salesImportAPI.getBackups();
      
      if (response.data.success) {
        setBackups(response.data.backups);
      } else {
        setError('Yedek dosyaları alınırken hata oluştu');
      }
    } catch (error) {
      console.error('Backup list error:', error);
      console.error('Full error object:', error);
      console.error('Response data:', error.response?.data);
      setError('Yedek dosyaları yüklenirken hata: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreClick = (backup) => {
    setSelectedBackup(backup);
    setShowRestoreModal(true);
    setConfirmText('');
  };

  const handleRestoreConfirm = async () => {
    if (confirmText !== 'ONAYLA') {
      setError('Onaylamak için "ONAYLA" yazmanız gerekiyor');
      return;
    }

    try {
      setRestoring(true);
      setError('');
      
      const response = await salesImportAPI.restoreFromBackup(selectedBackup.filename, true);
      
      if (response.data.success) {
        setSuccess(`✅ ${response.data.message}`);
        setShowRestoreModal(false);
        setSelectedBackup(null);
        
        // Yedek listesini yenile
        await fetchBackups();
      } else {
        setError('Geri yükleme başarısız: ' + response.data.message);
      }
    } catch (error) {
      console.error('Restore error:', error);
      setError('Geri yükleme hatası: ' + (error.response?.data?.message || error.message));
    } finally {
      setRestoring(false);
    }
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleString('tr-TR');
    } catch {
      return dateString;
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getBackupTypeColor = (type) => {
    switch (type) {
      case 'rollback':
        return 'warning';
      case 'pre-restore':
        return 'info';
      case 'manual':
        return 'success';
      default:
        return 'secondary';
    }
  };

  const getBackupTypeText = (type) => {
    switch (type) {
      case 'rollback':
        return 'Rollback Yedeği';
      case 'pre-restore':
        return 'Restore Öncesi';
      case 'manual':
        return 'Manuel Yedek';
      default:
        return 'Bilinmeyen';
    }
  };

  if (loading) {
    return (
      <Container fluid className="py-4">
        <div className="text-center">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Yükleniyor...</span>
          </Spinner>
          <p className="mt-2">Yedek dosyaları yükleniyor...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4">
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <h2>
              <FaHistory className="me-2" />
              Yedek Dosya Yönetimi
            </h2>
            <Button variant="outline-primary" onClick={fetchBackups} disabled={loading}>
              <FaDownload className="me-2" />
              Listeyi Yenile
            </Button>
          </div>
        </Col>
      </Row>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          <FaExclamationTriangle className="me-2" />
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Row>
        <Col>
          <Card>
            <Card.Header>
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <FaInfoCircle className="me-2" />
                  Mevcut Yedek Dosyaları ({backups.length})
                </h5>
              </div>
            </Card.Header>
            <Card.Body>
              {backups.length === 0 ? (
                <Alert variant="info">
                  <FaInfoCircle className="me-2" />
                  Henüz hiç yedek dosyası bulunamadı.
                  <hr />
                  <small className="text-muted">
                    <strong>Test için:</strong> Terminal'de <code>npm run create:test-backup</code> komutunu çalıştırarak test yedeği oluşturabilirsiniz.
                  </small>
                </Alert>
              ) : (
                <div className="table-responsive">
                  <Table striped bordered hover>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Dosya Adı</th>
                        <th>Tür</th>
                        <th>Kayıt Sayısı</th>
                        <th>Boyut</th>
                        <th>Oluşturma Tarihi</th>
                        <th>İşlemler</th>
                      </tr>
                    </thead>
                    <tbody>
                      {backups.map((backup, index) => (
                        <tr key={backup.filename}>
                          <td>{index + 1}</td>
                          <td>
                            <code className="small">{backup.filename}</code>
                            {backup.error && (
                              <div className="text-danger small mt-1">
                                <FaExclamationTriangle className="me-1" />
                                Bozuk dosya: {backup.error}
                              </div>
                            )}
                          </td>
                          <td>
                            <Badge bg={getBackupTypeColor(backup.type)}>
                              {getBackupTypeText(backup.type)}
                            </Badge>
                          </td>
                          <td>
                            <Badge bg="info">{backup.count.toLocaleString()}</Badge>
                          </td>
                          <td>{formatFileSize(backup.size)}</td>
                          <td>
                            <small>{formatDate(backup.created)}</small>
                            {backup.timestamp && backup.timestamp !== backup.created && (
                              <div className="text-muted small">
                                Yedek: {formatDate(backup.timestamp)}
                              </div>
                            )}
                          </td>
                          <td>
                            <div className="d-flex gap-2">
                              <Button
                                variant="success"
                                size="sm"
                                onClick={() => handleRestoreClick(backup)}
                                disabled={backup.type === 'corrupted' || backup.count === 0}
                                title="Bu yedek dosyasından verileri geri yükle"
                              >
                                <FaHistory className="me-1" />
                                Geri Yükle
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Restore Confirmation Modal */}
      <Modal show={showRestoreModal} onHide={() => !restoring && setShowRestoreModal(false)} backdrop="static">
        <Modal.Header closeButton={!restoring}>
          <Modal.Title>
            <FaExclamationTriangle className="text-warning me-2" />
            Yedek Dosyasından Geri Yükleme
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedBackup && (
            <>
              <Alert variant="warning">
                <FaExclamationTriangle className="me-2" />
                <strong>DİKKAT!</strong> Bu işlem geri alınamaz!
              </Alert>
              
              <div className="mb-3">
                <h6>Geri Yüklenecek Yedek:</h6>
                <ul>
                  <li><strong>Dosya:</strong> {selectedBackup.filename}</li>
                  <li><strong>Tür:</strong> {getBackupTypeText(selectedBackup.type)}</li>
                  <li><strong>Kayıt Sayısı:</strong> {selectedBackup.count.toLocaleString()}</li>
                  <li><strong>Tarih:</strong> {formatDate(selectedBackup.created)}</li>
                </ul>
              </div>

              <Alert variant="info">
                <FaInfoCircle className="me-2" />
                Geri yükleme öncesi mevcut verileriniz otomatik olarak yedeklenecektir.
              </Alert>

              <Form.Group className="mb-3">
                <Form.Label>
                  Onaylamak için <code>ONAYLA</code> yazın:
                </Form.Label>
                <Form.Control
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="ONAYLA"
                  disabled={restoring}
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => setShowRestoreModal(false)}
            disabled={restoring}
          >
            İptal
          </Button>
          <Button 
            variant="danger" 
            onClick={handleRestoreConfirm}
            disabled={restoring || confirmText !== 'ONAYLA'}
          >
            {restoring ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" className="me-2" />
                Geri Yükleniyor...
              </>
            ) : (
              <>
                <FaHistory className="me-2" />
                Geri Yükle
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default BackupManagement;
