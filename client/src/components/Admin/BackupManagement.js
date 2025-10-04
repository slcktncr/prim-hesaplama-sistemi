import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Badge, Alert, Modal, Spinner, Form } from 'react-bootstrap';
import { FaDownload, FaHistory, FaTrash, FaInfoCircle, FaExclamationTriangle, FaPlus, FaShoppingCart, FaComments } from 'react-icons/fa';
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
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [backupDescription, setBackupDescription] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingBackup, setDeletingBackup] = useState(false);
  const [backupToDelete, setBackupToDelete] = useState(null);

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

  const handleDownload = async (backup) => {
    try {
      setError('');
      
      const response = await salesImportAPI.downloadBackup(backup.filename);
      
      // Blob'u dosya olarak indir
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', backup.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setSuccess(`✅ ${backup.filename} başarıyla indirildi`);
    } catch (error) {
      console.error('Download error:', error);
      setError('İndirme hatası: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleCreateBackup = async (type) => {
    try {
      setCreatingBackup(true);
      setError('');
      
      const description = backupDescription || `${type === 'sales' ? 'Satış' : 'İletişim'} kayıtları manuel yedeği`;
      
      const response = await salesImportAPI.createManualBackup(type, description);
      
      if (response.data.success) {
        setSuccess(`✅ ${response.data.message} (${response.data.backupFilename})`);
        setBackupDescription('');
        
        // Yedek listesini yenile
        await fetchBackups();
      } else {
        setError('Manuel yedek oluşturulamadı: ' + response.data.message);
      }
    } catch (error) {
      console.error('Manual backup error:', error);
      setError('Manuel yedek hatası: ' + (error.response?.data?.message || error.message));
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDeleteClick = (backup) => {
    setBackupToDelete(backup);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setDeletingBackup(true);
      setError('');
      
      const response = await salesImportAPI.deleteBackup(backupToDelete.filename);
      
      if (response.data.success) {
        setSuccess(`✅ ${response.data.message}`);
        setShowDeleteModal(false);
        setBackupToDelete(null);
        
        // Yedek listesini yenile
        await fetchBackups();
      } else {
        setError('Yedek silinemedi: ' + response.data.message);
      }
    } catch (error) {
      console.error('Delete backup error:', error);
      setError('Yedek silme hatası: ' + (error.response?.data?.message || error.message));
    } finally {
      setDeletingBackup(false);
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
      case 'manual_sales':
        return 'Manuel Satış Yedeği';
      case 'manual_communications':
        return 'Manuel İletişim Yedeği';
      case 'test':
        return 'Test Yedeği';
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

      {/* Manuel Yedekleme Butonları */}
      <Row className="mb-4">
        <Col>
          <Card>
            <Card.Header>
              <h5 className="mb-0">
                <FaPlus className="me-2" />
                Manuel Yedekleme
              </h5>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={8}>
                  <Form.Group className="mb-3">
                    <Form.Label>Yedek Açıklaması (İsteğe Bağlı)</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Örnek: Aylık rutin yedekleme"
                      value={backupDescription}
                      onChange={(e) => setBackupDescription(e.target.value)}
                      disabled={creatingBackup}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Label>&nbsp;</Form.Label>
                  <div className="d-flex gap-2">
                    <Button
                      variant="success"
                      onClick={() => handleCreateBackup('sales')}
                      disabled={creatingBackup}
                      className="flex-fill"
                    >
                      {creatingBackup ? (
                        <Spinner as="span" animation="border" size="sm" role="status" className="me-2" />
                      ) : (
                        <FaShoppingCart className="me-2" />
                      )}
                      Satışları Yedekle
                    </Button>
                    <Button
                      variant="info"
                      onClick={() => handleCreateBackup('communications')}
                      disabled={creatingBackup}
                      className="flex-fill"
                    >
                      {creatingBackup ? (
                        <Spinner as="span" animation="border" size="sm" role="status" className="me-2" />
                      ) : (
                        <FaComments className="me-2" />
                      )}
                      İletişimi Yedekle
                    </Button>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
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
                                variant="primary"
                                size="sm"
                                onClick={() => handleDownload(backup)}
                                title="Yedek dosyasını bilgisayarınıza indirin"
                              >
                                <FaDownload className="me-1" />
                                İndir
                              </Button>
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
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleDeleteClick(backup)}
                                title="Bu yedek dosyasını sil"
                              >
                                <FaTrash className="me-1" />
                                Sil
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

      {/* Silme Onay Modalı */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <FaTrash className="me-2 text-danger" />
            Yedek Dosyasını Sil
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning">
            <FaExclamationTriangle className="me-2" />
            <strong>Dikkat!</strong> Bu işlem geri alınamaz.
          </Alert>
          
          <p>
            <strong>Dosya:</strong> <code>{backupToDelete?.filename}</code>
          </p>
          
          <p>
            <strong>Kayıt Sayısı:</strong> {backupToDelete?.count?.toLocaleString() || 'Bilinmiyor'}
          </p>
          
          <p>
            <strong>Boyut:</strong> {backupToDelete ? formatFileSize(backupToDelete.size) : 'Bilinmiyor'}
          </p>
          
          <p className="text-muted">
            Bu yedek dosyasını silmek istediğinizden emin misiniz? 
            Bu işlem geri alınamaz ve dosya kalıcı olarak silinecektir.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => setShowDeleteModal(false)}
            disabled={deletingBackup}
          >
            İptal
          </Button>
          <Button 
            variant="danger" 
            onClick={handleDeleteConfirm}
            disabled={deletingBackup}
          >
            {deletingBackup ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" className="me-2" />
                Siliniyor...
              </>
            ) : (
              <>
                <FaTrash className="me-2" />
                Sil
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default BackupManagement;
