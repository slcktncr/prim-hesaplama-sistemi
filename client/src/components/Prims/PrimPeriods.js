import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Table, 
  Button, 
  Form, 
  Modal,
  Alert,
  Badge
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  FiCalendar, 
  FiPlus,
  FiUser,
  FiRefreshCw
} from 'react-icons/fi';

import { primsAPI } from '../../utils/api';
import { 
  formatDateTime,
  validateRequired,
  monthNames,
  createPeriodName
} from '../../utils/helpers';
import Loading from '../Common/Loading';

const PrimPeriods = () => {
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

  useEffect(() => {
    fetchPeriods();
  }, []);

  const fetchPeriods = async () => {
    try {
      setLoading(true);
      const response = await primsAPI.getPeriods();
      setPeriods(response.data || []);
      setError(null);
    } catch (error) {
      console.error('Periods fetch error:', error);
      setError('Prim dönemleri yüklenirken hata oluştu');
      toast.error('Prim dönemleri yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: parseInt(value)
    }));
  };

  const validateForm = () => {
    if (!validateRequired(formData.month)) {
      toast.error('Ay seçiniz');
      return false;
    }

    if (!validateRequired(formData.year)) {
      toast.error('Yıl giriniz');
      return false;
    }

    if (formData.year < 2020 || formData.year > 2050) {
      toast.error('Yıl 2020-2050 arasında olmalıdır');
      return false;
    }

    // Check if period already exists
    const periodName = createPeriodName(formData.month, formData.year);
    const existingPeriod = periods.find(p => p.name === periodName);
    if (existingPeriod) {
      toast.error('Bu dönem zaten mevcut');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      const periodData = {
        name: createPeriodName(formData.month, formData.year),
        month: formData.month,
        year: formData.year
      };

      await primsAPI.createPeriod(periodData);
      toast.success('Prim dönemi başarıyla oluşturuldu');
      
      setShowModal(false);
      setFormData({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
      });
      fetchPeriods();
    } catch (error) {
      console.error('Create period error:', error);
      toast.error(error.response?.data?.message || 'Prim dönemi oluşturulurken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const openModal = () => {
    setFormData({
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear()
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setFormData({
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear()
    });
  };

  if (loading) {
    return <Loading text="Prim dönemleri yükleniyor..." />;
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>
            <FiCalendar className="me-2" />
            Prim Dönemleri
          </h1>
          <p className="text-muted mb-0">
            Prim hesaplama dönemlerini yönetin
          </p>
        </div>
        <Button variant="primary" onClick={openModal}>
          <FiPlus className="me-2" />
          Yeni Dönem
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <Row>
        <Col lg={8}>
          {/* Periods Table */}
          <Card>
            <Card.Header>
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Prim Dönemleri</h5>
                <div className="d-flex align-items-center gap-2">
                  <Badge bg="primary">{periods.length} dönem</Badge>
                  <Button variant="outline-secondary" size="sm" onClick={fetchPeriods}>
                    <FiRefreshCw />
                  </Button>
                </div>
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              {periods.length === 0 ? (
                <div className="text-center py-5">
                  <FiCalendar size={48} className="text-muted mb-3" />
                  <p className="text-muted">Henüz prim dönemi oluşturulmamış.</p>
                  <Button variant="primary" onClick={openModal}>
                    İlk Dönem Oluştur
                  </Button>
                </div>
              ) : (
                <Table responsive hover className="mb-0">
                  <thead>
                    <tr>
                      <th>Dönem Adı</th>
                      <th>Ay</th>
                      <th>Yıl</th>
                      <th>Oluşturma Tarihi</th>
                      <th>Oluşturan</th>
                      <th>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((period) => (
                      <tr key={period._id}>
                        <td>
                          <strong>{period.name}</strong>
                        </td>
                        <td>
                          <Badge bg="info">
                            {monthNames[period.month - 1]}
                          </Badge>
                        </td>
                        <td>
                          <Badge bg="secondary">
                            {period.year}
                          </Badge>
                        </td>
                        <td>
                          <small>{formatDateTime(period.createdAt)}</small>
                        </td>
                        <td>
                          <div className="d-flex align-items-center">
                            <FiUser className="me-2 text-muted" size={14} />
                            <small>{period.createdBy?.name || 'Bilinmeyen'}</small>
                          </div>
                        </td>
                        <td>
                          <Badge bg={period.isActive ? 'success' : 'secondary'}>
                            {period.isActive ? 'Aktif' : 'Pasif'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          {/* Info Cards */}
          <Card className="mb-4">
            <Card.Header>
              <h6 className="mb-0">Dönem Bilgileri</h6>
            </Card.Header>
            <Card.Body>
              <div className="small">
                <h6>Prim Dönemleri Nasıl Çalışır?</h6>
                <ul>
                  <li>Her satış, satış tarihine göre otomatik olarak bir döneme atanır</li>
                  <li>Dönemler aylık bazda oluşturulur</li>
                  <li>Admin, gerekirse satışları farklı dönemlere atayabilir</li>
                  <li>Prim ödemeleri dönem bazında takip edilir</li>
                </ul>
                
                <h6 className="mt-3">Otomatik Dönem Atama:</h6>
                <p>
                  Yeni bir satış eklendiğinde, satış tarihi hangi aya aitse 
                  o ayın dönemi otomatik oluşturulur ve satış bu döneme atanır.
                </p>
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h6 className="mb-0">İstatistikler</h6>
            </Card.Header>
            <Card.Body>
              <div className="row text-center">
                <div className="col-6">
                  <div className="h4 text-primary">{periods.length}</div>
                  <div className="small text-muted">Toplam Dönem</div>
                </div>
                <div className="col-6">
                  <div className="h4 text-success">
                    {periods.filter(p => p.isActive).length}
                  </div>
                  <div className="small text-muted">Aktif Dönem</div>
                </div>
              </div>
              
              {periods.length > 0 && (
                <div className="mt-3">
                  <small className="text-muted">Son Dönem:</small>
                  <div className="fw-bold">
                    {periods[0]?.name}
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Create Period Modal */}
      <Modal show={showModal} onHide={closeModal}>
        <Modal.Header closeButton>
          <Modal.Title>Yeni Prim Dönemi</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Ay *</Form.Label>
                  <Form.Select
                    name="month"
                    value={formData.month}
                    onChange={handleInputChange}
                    required
                  >
                    {monthNames.map((month, index) => (
                      <option key={index + 1} value={index + 1}>
                        {month}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Yıl *</Form.Label>
                  <Form.Control
                    type="number"
                    name="year"
                    min="2020"
                    max="2050"
                    value={formData.year}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Alert variant="info">
              <strong>Dönem Adı:</strong> {createPeriodName(formData.month, formData.year)}
            </Alert>

            <Alert variant="warning">
              <strong>Bilgi:</strong>
              <ul className="mb-0 mt-2">
                <li>Dönem oluşturulduktan sonra değiştirilemez</li>
                <li>Aynı ay ve yıl için tekrar dönem oluşturulamaz</li>
                <li>Satışlar otomatik olarak uygun döneme atanır</li>
              </ul>
            </Alert>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={closeModal}>
              İptal
            </Button>
            <Button 
              variant="primary" 
              type="submit"
              disabled={saving}
            >
              {saving ? 'Oluşturuluyor...' : 'Dönem Oluştur'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default PrimPeriods;
