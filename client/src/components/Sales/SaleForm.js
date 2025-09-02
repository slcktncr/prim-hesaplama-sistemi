import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { salesAPI, primsAPI } from '../../utils/api';
import { 
  validateRequired, 
  validatePositiveNumber, 
  formatCurrency 
} from '../../utils/helpers';
import Loading from '../Common/Loading';

const SaleForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    customerName: '',
    blockNo: '',
    apartmentNo: '',
    periodNo: '',
    saleDate: '',
    contractNo: '',
    listPrice: '',
    activitySalePrice: '',
    paymentType: 'Nakit'
  });

  const [periods, setPeriods] = useState([]);
  const [currentRate, setCurrentRate] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);

  useEffect(() => {
    fetchPeriods();
    fetchCurrentRate();
    if (isEdit) {
      fetchSale();
    }
  }, [id, isEdit]);

  const fetchPeriods = async () => {
    try {
      const response = await primsAPI.getPeriods();
      setPeriods(response.data || []);
    } catch (error) {
      console.error('Periods fetch error:', error);
      toast.error('Dönemler yüklenirken hata oluştu');
    }
  };

  const fetchCurrentRate = async () => {
    try {
      const response = await primsAPI.getRate();
      setCurrentRate(response.data);
    } catch (error) {
      console.error('Current rate fetch error:', error);
    }
  };

  const fetchSale = async () => {
    try {
      setInitialLoading(true);
      // Bu endpoint'i backend'de oluşturmadık, getSales ile tek satış getirelim
      const response = await salesAPI.getSales({ contractNo: id });
      const sale = response.data.sales?.[0];
      
      if (sale) {
        setFormData({
          customerName: sale.customerName || '',
          blockNo: sale.blockNo || '',
          apartmentNo: sale.apartmentNo || '',
          periodNo: sale.periodNo || '',
          saleDate: sale.saleDate ? new Date(sale.saleDate).toISOString().split('T')[0] : '',
          contractNo: sale.contractNo || '',
          listPrice: sale.listPrice?.toString() || '',
          activitySalePrice: sale.activitySalePrice?.toString() || '',
          paymentType: sale.paymentType || 'Nakit'
        });
      } else {
        toast.error('Satış bulunamadı');
        navigate('/sales');
      }
    } catch (error) {
      console.error('Sale fetch error:', error);
      toast.error('Satış bilgileri yüklenirken hata oluştu');
      navigate('/sales');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear field error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!validateRequired(formData.customerName)) {
      newErrors.customerName = 'Müşteri adı soyadı gereklidir';
    }

    if (!validateRequired(formData.blockNo)) {
      newErrors.blockNo = 'Blok no gereklidir';
    }

    if (!validateRequired(formData.apartmentNo)) {
      newErrors.apartmentNo = 'Daire no gereklidir';
    }

    if (!validateRequired(formData.periodNo)) {
      newErrors.periodNo = 'Dönem no gereklidir';
    }

    if (!validateRequired(formData.saleDate)) {
      newErrors.saleDate = 'Satış tarihi gereklidir';
    }

    if (!validateRequired(formData.contractNo)) {
      newErrors.contractNo = 'Sözleşme no gereklidir';
    }

    if (!validatePositiveNumber(formData.listPrice)) {
      newErrors.listPrice = 'Geçerli bir liste fiyatı giriniz';
    }

    if (!validatePositiveNumber(formData.activitySalePrice)) {
      newErrors.activitySalePrice = 'Geçerli bir aktivite satış fiyatı giriniz';
    }

    if (!validateRequired(formData.paymentType)) {
      newErrors.paymentType = 'Ödeme tipi seçiniz';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Lütfen tüm alanları doğru şekilde doldurunuz');
      return;
    }

    setLoading(true);

    try {
      const saleData = {
        ...formData,
        listPrice: parseFloat(formData.listPrice),
        activitySalePrice: parseFloat(formData.activitySalePrice)
      };

      if (isEdit) {
        await salesAPI.updateSale(id, saleData);
        toast.success('Satış başarıyla güncellendi');
      } else {
        await salesAPI.createSale(saleData);
        toast.success('Satış başarıyla eklendi');
      }
      
      navigate('/sales');
    } catch (error) {
      console.error('Sale save error:', error);
      const message = error.response?.data?.message || 
        (isEdit ? 'Satış güncellenirken hata oluştu' : 'Satış eklenirken hata oluştu');
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Prim hesaplama
  const calculatePrim = () => {
    const listPrice = parseFloat(formData.listPrice) || 0;
    const activityPrice = parseFloat(formData.activitySalePrice) || 0;
    const rate = currentRate?.rate || 0;
    
    if (listPrice > 0 && activityPrice > 0) {
      const basePrice = Math.min(listPrice, activityPrice);
      return basePrice * rate;
    }
    return 0;
  };

  if (initialLoading) {
    return <Loading text={isEdit ? 'Satış bilgileri yükleniyor...' : 'Yükleniyor...'} />;
  }

  const primAmount = calculatePrim();

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>{isEdit ? 'Satış Düzenle' : 'Yeni Satış Ekle'}</h1>
          <p className="text-muted mb-0">
            {isEdit ? 'Satış bilgilerini güncelleyin' : 'Yeni bir satış kaydı oluşturun'}
          </p>
        </div>
        <Button variant="outline-secondary" onClick={() => navigate('/sales')}>
          Geri Dön
        </Button>
      </div>

      <Row>
        <Col lg={8}>
          <Card>
            <Card.Header>
              <h5 className="mb-0">Satış Bilgileri</h5>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleSubmit}>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Müşteri Ad Soyad *</Form.Label>
                      <Form.Control
                        type="text"
                        name="customerName"
                        value={formData.customerName}
                        onChange={handleChange}
                        isInvalid={!!errors.customerName}
                        placeholder="Müşteri adını giriniz"
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.customerName}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>Blok No *</Form.Label>
                      <Form.Control
                        type="text"
                        name="blockNo"
                        value={formData.blockNo}
                        onChange={handleChange}
                        isInvalid={!!errors.blockNo}
                        placeholder="A1"
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.blockNo}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>Daire No *</Form.Label>
                      <Form.Control
                        type="text"
                        name="apartmentNo"
                        value={formData.apartmentNo}
                        onChange={handleChange}
                        isInvalid={!!errors.apartmentNo}
                        placeholder="12"
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.apartmentNo}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Dönem No *</Form.Label>
                      <Form.Control
                        type="text"
                        name="periodNo"
                        value={formData.periodNo}
                        onChange={handleChange}
                        isInvalid={!!errors.periodNo}
                        placeholder="2024-1"
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.periodNo}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Satış Tarihi *</Form.Label>
                      <Form.Control
                        type="date"
                        name="saleDate"
                        value={formData.saleDate}
                        onChange={handleChange}
                        isInvalid={!!errors.saleDate}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.saleDate}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Ödeme Tipi *</Form.Label>
                      <Form.Select
                        name="paymentType"
                        value={formData.paymentType}
                        onChange={handleChange}
                        isInvalid={!!errors.paymentType}
                      >
                        <option value="Nakit">Nakit</option>
                        <option value="Kredi">Kredi</option>
                        <option value="Taksit">Taksit</option>
                        <option value="Diğer">Diğer</option>
                      </Form.Select>
                      <Form.Control.Feedback type="invalid">
                        {errors.paymentType}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label>Sözleşme No *</Form.Label>
                  <Form.Control
                    type="text"
                    name="contractNo"
                    value={formData.contractNo}
                    onChange={handleChange}
                    isInvalid={!!errors.contractNo}
                    placeholder="SZL-2024-001"
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.contractNo}
                  </Form.Control.Feedback>
                </Form.Group>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Liste Fiyatı (₺) *</Form.Label>
                      <Form.Control
                        type="number"
                        step="0.01"
                        min="0"
                        name="listPrice"
                        value={formData.listPrice}
                        onChange={handleChange}
                        isInvalid={!!errors.listPrice}
                        placeholder="0.00"
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.listPrice}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Aktivite Satış Fiyatı (₺) *</Form.Label>
                      <Form.Control
                        type="number"
                        step="0.01"
                        min="0"
                        name="activitySalePrice"
                        value={formData.activitySalePrice}
                        onChange={handleChange}
                        isInvalid={!!errors.activitySalePrice}
                        placeholder="0.00"
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.activitySalePrice}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>

                <div className="d-flex justify-content-end gap-2">
                  <Button 
                    variant="outline-secondary" 
                    type="button" 
                    onClick={() => navigate('/sales')}
                  >
                    İptal
                  </Button>
                  <Button 
                    variant="primary" 
                    type="submit" 
                    disabled={loading}
                  >
                    {loading ? 'Kaydediliyor...' : (isEdit ? 'Güncelle' : 'Kaydet')}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          {/* Prim Hesaplama Önizleme */}
          <Card>
            <Card.Header>
              <h5 className="mb-0">Prim Hesaplama</h5>
            </Card.Header>
            <Card.Body>
              {currentRate ? (
                <div>
                  <div className="mb-3">
                    <small className="text-muted">Aktif Prim Oranı</small>
                    <div className="h5 text-primary">
                      %{(currentRate.rate * 100).toFixed(2)}
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <small className="text-muted">Liste Fiyatı</small>
                    <div>
                      {formatCurrency(parseFloat(formData.listPrice) || 0)}
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <small className="text-muted">Aktivite Fiyatı</small>
                    <div>
                      {formatCurrency(parseFloat(formData.activitySalePrice) || 0)}
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <small className="text-muted">Prim Hesaplama Tabanı</small>
                    <div className="text-info">
                      {formatCurrency(Math.min(
                        parseFloat(formData.listPrice) || 0,
                        parseFloat(formData.activitySalePrice) || 0
                      ))}
                    </div>
                  </div>
                  
                  <hr />
                  
                  <div>
                    <small className="text-muted">Hesaplanan Prim</small>
                    <div className="h4 text-success">
                      {formatCurrency(primAmount)}
                    </div>
                  </div>
                </div>
              ) : (
                <Alert variant="warning">
                  Prim oranı yüklenemedi
                </Alert>
              )}
            </Card.Body>
          </Card>

          {/* Bilgilendirme */}
          <Card>
            <Card.Header>
              <h6 className="mb-0">Bilgilendirme</h6>
            </Card.Header>
            <Card.Body>
              <ul className="small mb-0">
                <li>Prim, liste fiyatı ve aktivite satış fiyatından düşük olanın %{currentRate ? (currentRate.rate * 100).toFixed(2) : '1'}'i üzerinden hesaplanır.</li>
                <li>Satış tarihi ayına göre prim dönemi otomatik atanır.</li>
                <li>Sözleşme numarası benzersiz olmalıdır.</li>
              </ul>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SaleForm;
