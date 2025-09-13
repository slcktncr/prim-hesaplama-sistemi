import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Row, 
  Col, 
  Card, 
  Button, 
  Form, 
  Alert, 
  Modal, 
  Table,
  Badge,
  Spinner
} from 'react-bootstrap';
import { 
  FaEdit, 
  FaCheck, 
  FaTimes, 
  FaUsers, 
  FaCalendarAlt, 
  FaMoneyBillWave,
  FaExclamationTriangle,
  FaInfoCircle
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { salesAPI, primsAPI, usersAPI } from '../../utils/api';
import { formatCurrency, formatDate } from '../../utils/helpers';

const BulkPrimStatusManagement = () => {
  const [periods, setPeriods] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  
  const [filters, setFilters] = useState({
    period: '',
    salesperson: '',
    month: '',
    year: new Date().getFullYear(),
    startDate: '',
    endDate: ''
  });
  
  const [primStatus, setPrimStatus] = useState('ödendi');

  useEffect(() => {
    fetchPeriods();
    fetchUsers();
  }, []);

  const fetchPeriods = async () => {
    try {
      const response = await primsAPI.getPeriods();
      setPeriods(response.data || []);
    } catch (error) {
      console.error('Periods fetch error:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await usersAPI.getUsersForFilters();
      setUsers(response.data || []);
    } catch (error) {
      console.error('Users fetch error:', error);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getFilterDescription = () => {
    const descriptions = [];
    
    if (filters.period) {
      const period = periods.find(p => p._id === filters.period);
      descriptions.push(`Dönem: ${period?.name}`);
    }
    
    if (filters.salesperson) {
      const user = users.find(u => u._id === filters.salesperson);
      descriptions.push(`Temsilci: ${user?.name}`);
    }
    
    if (filters.month && filters.year) {
      const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
      descriptions.push(`Ay: ${monthNames[filters.month - 1]} ${filters.year}`);
    } else if (filters.year) {
      descriptions.push(`Yıl: ${filters.year}`);
    }
    
    if (filters.startDate && filters.endDate) {
      descriptions.push(`Tarih: ${formatDate(filters.startDate)} - ${formatDate(filters.endDate)}`);
    } else if (filters.startDate) {
      descriptions.push(`Başlangıç: ${formatDate(filters.startDate)}`);
    } else if (filters.endDate) {
      descriptions.push(`Bitiş: ${formatDate(filters.endDate)}`);
    }
    
    return descriptions.length > 0 ? descriptions.join(', ') : 'Tüm satışlar';
  };

  const handlePreview = async () => {
    try {
      setPreviewLoading(true);
      
      // Önizleme için özel endpoint kullan
      const response = await salesAPI.previewBulkPrimStatus(primStatus, filters);
      
      setPreviewData(response.data.summary);
      setShowPreviewModal(true);
      
    } catch (error) {
      console.error('Preview error:', error);
      if (error.response?.status === 404) {
        toast.warning('Belirtilen kriterlere uygun satış bulunamadı');
      } else {
        toast.error('Önizleme yüklenirken hata oluştu');
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDirectUpdate = async () => {
    // Boş filtre kontrolü
    if (isFilterEmpty()) {
      const confirmed = window.confirm(
        '⚠️ UYARI: Hiçbir filtre seçilmedi!\n\n' +
        'Bu durumda TÜM satışların prim durumu değiştirilecek.\n\n' +
        'Devam etmek istediğinizden emin misiniz?'
      );
      if (!confirmed) return;
    } else {
      const confirmed = window.confirm(
        `Seçili kriterlere göre prim durumlarını "${primStatus}" olarak değiştirmek istediğinizden emin misiniz?\n\n` +
        `Kriterler: ${getFilterDescription()}\n\n` +
        'Bu işlem geri alınamaz!'
      );
      if (!confirmed) return;
    }

    try {
      setLoading(true);
      
      const response = await salesAPI.bulkUpdatePrimStatus(primStatus, filters);
      
      if (response.data.success) {
        toast.success(response.data.message);
        
        // Filtreleri temizle
        setFilters({
          period: '',
          salesperson: '',
          month: '',
          year: new Date().getFullYear(),
          startDate: '',
          endDate: ''
        });
      }
      
    } catch (error) {
      console.error('Direct update error:', error);
      if (error.response?.status === 404) {
        toast.warning('Belirtilen kriterlere uygun satış bulunamadı');
      } else {
        toast.error(error.response?.data?.message || 'Toplu güncelleme sırasında hata oluştu');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpdate = async () => {
    try {
      setLoading(true);
      
      const response = await salesAPI.bulkUpdatePrimStatus(primStatus, filters);
      
      if (response.data.success) {
        toast.success(response.data.message);
        setShowPreviewModal(false);
        
        // Filtreleri temizle
        setFilters({
          period: '',
          salesperson: '',
          month: '',
          year: new Date().getFullYear(),
          startDate: '',
          endDate: ''
        });
      }
      
    } catch (error) {
      console.error('Bulk update error:', error);
      toast.error(error.response?.data?.message || 'Toplu güncelleme sırasında hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const isFilterEmpty = () => {
    return !filters.period && 
           !filters.salesperson && 
           !filters.month && 
           !filters.startDate && 
           !filters.endDate;
  };

  return (
    <Container fluid className="py-4">
      <Row>
        <Col>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h2 className="mb-1">
                <FaMoneyBillWave className="me-2 text-success" />
                Toplu Prim Durumu Yönetimi
              </h2>
              <p className="text-muted mb-0">
                Seçili kriterlere göre prim durumlarını toplu olarak değiştirin
              </p>
            </div>
          </div>

          <Card>
            <Card.Header>
              <h5 className="mb-0">
                <FaEdit className="me-2" />
                Filtreler ve Ayarlar
              </h5>
            </Card.Header>
            <Card.Body>
              <Form>
                <Row>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>Prim Dönem</Form.Label>
                      <Form.Select
                        value={filters.period}
                        onChange={(e) => handleFilterChange('period', e.target.value)}
                      >
                        <option value="">Tüm Dönemler</option>
                        {periods.map(period => (
                          <option key={period._id} value={period._id}>
                            {period.name}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>Temsilci</Form.Label>
                      <Form.Select
                        value={filters.salesperson}
                        onChange={(e) => handleFilterChange('salesperson', e.target.value)}
                      >
                        <option value="">Tüm Temsilciler</option>
                        {users.map(user => (
                          <option key={user._id} value={user._id}>
                            {user.name}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>

                  <Col md={2}>
                    <Form.Group className="mb-3">
                      <Form.Label>Ay</Form.Label>
                      <Form.Select
                        value={filters.month}
                        onChange={(e) => handleFilterChange('month', e.target.value)}
                      >
                        <option value="">Tüm Aylar</option>
                        <option value="1">Ocak</option>
                        <option value="2">Şubat</option>
                        <option value="3">Mart</option>
                        <option value="4">Nisan</option>
                        <option value="5">Mayıs</option>
                        <option value="6">Haziran</option>
                        <option value="7">Temmuz</option>
                        <option value="8">Ağustos</option>
                        <option value="9">Eylül</option>
                        <option value="10">Ekim</option>
                        <option value="11">Kasım</option>
                        <option value="12">Aralık</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>

                  <Col md={2}>
                    <Form.Group className="mb-3">
                      <Form.Label>Yıl</Form.Label>
                      <Form.Control
                        type="number"
                        value={filters.year}
                        onChange={(e) => handleFilterChange('year', e.target.value)}
                        min="2020"
                        max="2030"
                      />
                    </Form.Group>
                  </Col>

                  <Col md={2}>
                    <Form.Group className="mb-3">
                      <Form.Label>Yeni Durum</Form.Label>
                      <Form.Select
                        value={primStatus}
                        onChange={(e) => setPrimStatus(e.target.value)}
                      >
                        <option value="ödendi">Ödendi</option>
                        <option value="ödenmedi">Ödenmedi</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>Başlangıç Tarihi</Form.Label>
                      <Form.Control
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => handleFilterChange('startDate', e.target.value)}
                      />
                    </Form.Group>
                  </Col>

                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>Bitiş Tarihi</Form.Label>
                      <Form.Control
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => handleFilterChange('endDate', e.target.value)}
                      />
                    </Form.Group>
                  </Col>

                  <Col md={6} className="d-flex align-items-end">
                    <div className="d-flex gap-2 mb-3">
                      <Button
                        variant="info"
                        onClick={handlePreview}
                        disabled={previewLoading || loading}
                      >
                        {previewLoading ? (
                          <>
                            <Spinner as="span" animation="border" size="sm" className="me-2" />
                            Kontrol Ediliyor...
                          </>
                        ) : (
                          <>
                            <FaInfoCircle className="me-2" />
                            Önizleme
                          </>
                        )}
                      </Button>

                      <Button
                        variant="success"
                        onClick={handleDirectUpdate}
                        disabled={loading || previewLoading}
                      >
                        {loading ? (
                          <>
                            <Spinner as="span" animation="border" size="sm" className="me-2" />
                            Uygulanıyor...
                          </>
                        ) : (
                          <>
                            <FaCheck className="me-2" />
                            Uygula
                          </>
                        )}
                      </Button>
                      
                      <Button
                        variant="outline-secondary"
                        onClick={() => setFilters({
                          period: '',
                          salesperson: '',
                          month: '',
                          year: new Date().getFullYear(),
                          startDate: '',
                          endDate: ''
                        })}
                        disabled={loading || previewLoading}
                      >
                        Temizle
                      </Button>

                      <Button
                        variant="outline-warning"
                        onClick={async () => {
                          try {
                            const response = await salesAPI.testBulk({ test: 'data', primStatus, filters });
                            toast.success('Test başarılı: ' + response.data.message);
                          } catch (error) {
                            toast.error('Test hatası: ' + error.message);
                          }
                        }}
                        disabled={loading || previewLoading}
                      >
                        Test
                      </Button>
                    </div>
                  </Col>
                </Row>

                <Alert variant="info" className="mb-0">
                  <FaInfoCircle className="me-2" />
                  <strong>Seçili Kriterler:</strong> {getFilterDescription()}
                  <br />
                  <strong>Yeni Durum:</strong> <Badge bg={primStatus === 'ödendi' ? 'success' : 'warning'}>
                    {primStatus === 'ödendi' ? 'Ödendi' : 'Ödenmedi'}
                  </Badge>
                  {isFilterEmpty() && (
                    <div className="mt-2">
                      <FaExclamationTriangle className="me-2 text-warning" />
                      <strong>Uyarı:</strong> Hiçbir filtre seçilmedi. Bu durumda TÜM satışlar etkilenecek!
                    </div>
                  )}
                </Alert>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Önizleme Modal */}
      <Modal show={showPreviewModal} onHide={() => setShowPreviewModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <FaInfoCircle className="me-2 text-info" />
            Toplu Güncelleme Önizlemesi
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {previewData && (
            <>
              <Alert variant="warning">
                <FaExclamationTriangle className="me-2" />
                <strong>DİKKAT!</strong> Bu işlem geri alınamaz!
                <br />
                <strong>{previewData.totalUpdated}</strong> satışın prim durumu 
                "<strong>{previewData.newStatus}</strong>" olarak değiştirilecek.
              </Alert>

              <div className="mb-3">
                <h6>Etkilenecek Satışlar:</h6>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <Table striped bordered hover size="sm">
                    <thead>
                      <tr>
                        <th>Müşteri</th>
                        <th>Sözleşme No</th>
                        <th>Temsilci</th>
                        <th>Dönem</th>
                        <th>Prim Tutarı</th>
                        <th>Mevcut Durum</th>
                        <th>Yeni Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.affectedSales.slice(0, 50).map((sale, index) => (
                        <tr key={index}>
                          <td>{sale.customerName}</td>
                          <td>{sale.contractNo || '-'}</td>
                          <td>{sale.salesperson}</td>
                          <td>{sale.period}</td>
                          <td>{formatCurrency(sale.primAmount)}</td>
                          <td>
                            <Badge bg={sale.oldStatus === 'ödendi' ? 'success' : 'warning'}>
                              {sale.oldStatus === 'ödendi' ? 'Ödendi' : 'Ödenmedi'}
                            </Badge>
                          </td>
                          <td>
                            <Badge bg={previewData.newStatus === 'ödendi' ? 'success' : 'warning'}>
                              {previewData.newStatus === 'ödendi' ? 'Ödendi' : 'Ödenmedi'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                  {previewData.affectedSales.length > 50 && (
                    <Alert variant="info" className="mt-2">
                      <FaInfoCircle className="me-2" />
                      Sadece ilk 50 kayıt gösteriliyor. Toplam {previewData.totalUpdated} kayıt etkilenecek.
                    </Alert>
                  )}
                </div>
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPreviewModal(false)}>
            <FaTimes className="me-2" />
            İptal
          </Button>
          <Button 
            variant="danger" 
            onClick={handleBulkUpdate}
            disabled={loading}
          >
            {loading ? (
              <>
                <Spinner as="span" animation="border" size="sm" className="me-2" />
                Güncelleniyor...
              </>
            ) : (
              <>
                <FaCheck className="me-2" />
                Onayla ve Güncelle
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default BulkPrimStatusManagement;
