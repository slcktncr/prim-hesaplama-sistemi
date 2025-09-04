import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Row, Col, Card, Form, Button, Alert, Badge } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { salesAPI, primsAPI, paymentMethodsAPI } from '../../utils/api';
import { 
  validateRequired, 
  validatePositiveNumber, 
  formatCurrency 
} from '../../utils/helpers';
import Loading from '../Common/Loading';
import { FiFileText, FiInfo } from 'react-icons/fi';

const SaleForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    customerName: '',
    blockNo: '',
    apartmentNo: '',
    periodNo: '',
    saleType: 'satis', // 'kapora' veya 'satis'
    saleDate: '',
    kaporaDate: '',
    contractNo: '',
    listPrice: '',
    originalListPrice: '', // İndirim öncesi orijinal fiyat
    discountRate: '',      // İndirim oranı (%)
    activitySalePrice: '',
    paymentType: 'Nakit',
    entryDate: '', // Giriş tarihi (gün/ay)
    exitDate: '',  // Çıkış tarihi (gün/ay)
    notes: ''      // Notlar
  });

  const [periods, setPeriods] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [currentRate, setCurrentRate] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);

  useEffect(() => {
    fetchPeriods();
    fetchCurrentRate();
    fetchPaymentMethods();
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

  const fetchPaymentMethods = async () => {
    try {
      const response = await paymentMethodsAPI.getActive();
      const methods = response.data.data || [];
      setPaymentMethods(methods);
      
      // Varsayılan ödeme yöntemini seç
      const defaultMethod = methods.find(m => m.isDefault);
      if (defaultMethod && !isEdit) {
        setFormData(prev => ({
          ...prev,
          paymentType: defaultMethod.name
        }));
      }
    } catch (error) {
      console.error('Payment methods fetch error:', error);
      // Hata durumunda eski sabit değerleri kullan
      setPaymentMethods([
        { _id: '1', name: 'Nakit' },
        { _id: '2', name: 'Kredi' },
        { _id: '3', name: 'Taksit' },
        { _id: '4', name: 'Diğer' }
      ]);
    }
  };

  const fetchSale = async () => {
    try {
      setInitialLoading(true);
      // Satış ID'si ile doğrudan satışı getir
      const response = await salesAPI.getSaleById(id);
      const sale = response.data;
      
      if (sale) {
        setFormData({
          customerName: sale.customerName || '',
          blockNo: sale.blockNo || '',
          apartmentNo: sale.apartmentNo || '',
          periodNo: sale.periodNo || '',
          saleType: sale.saleType || 'satis',
          saleDate: sale.saleDate ? new Date(sale.saleDate).toISOString().split('T')[0] : '',
          kaporaDate: sale.kaporaDate ? new Date(sale.kaporaDate).toISOString().split('T')[0] : '',
          contractNo: sale.contractNo || '',
          listPrice: sale.listPrice?.toString() || '',
          originalListPrice: sale.originalListPrice?.toString() || '',
          discountRate: sale.discountRate?.toString() || '',
          activitySalePrice: sale.activitySalePrice?.toString() || '',
          paymentType: sale.paymentType || 'Nakit',
          entryDate: sale.entryDate || '',
          exitDate: sale.exitDate || '',
          notes: sale.notes || ''
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

  // İndirim hesaplama fonksiyonu
  const calculateDiscountedPrice = (originalPrice, discountRate) => {
    if (!originalPrice || !discountRate) return originalPrice;
    const original = parseFloat(originalPrice);
    const discount = parseFloat(discountRate);
    if (isNaN(original) || isNaN(discount) || discount < 0 || discount > 100) return originalPrice;
    return (original * (1 - discount / 100)).toFixed(2);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Sözleşme no için karakter sınırı kontrolü
    if (name === 'contractNo') {
      if (value.length > 6) {
        return; // 6 karakterden fazla girişi engelle
      }
    }
    
    setFormData(prev => {
      const newData = { ...prev, [name]: value };

      // İndirim hesaplama logic'i
      if (name === 'discountRate') {
        // İndirim oranı değiştiğinde
        const basePrice = prev.originalListPrice || prev.listPrice;
        if (value && basePrice) {
          newData.listPrice = calculateDiscountedPrice(basePrice, value);
          if (!prev.originalListPrice) {
            newData.originalListPrice = prev.listPrice; // Orijinal fiyatı sakla
          }
        } else if (!value) {
          // İndirim temizlendiğinde orijinal fiyata dön
          newData.listPrice = prev.originalListPrice || prev.listPrice;
        }
      }

      return newData;
    });
    
    // Clear field error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    
    // Giriş tarihi için
    if (name === 'entryDay' || name === 'entryMonth') {
      const currentEntry = formData.entryDate || '';
      const parts = currentEntry.split('/');
      const currentDay = parts[0] || '';
      const currentMonth = parts[1] || '';
      
      let newDay = name === 'entryDay' ? value : currentDay;
      let newMonth = name === 'entryMonth' ? value : currentMonth;
      
      // Sadece her ikisi de seçiliyse birleştir, aksi halde kısmi seçimi koru
      let newEntryDate = '';
      if (newDay && newMonth) {
        newEntryDate = `${newDay}/${newMonth}`;
      } else if (newDay || newMonth) {
        // Kısmi seçim durumunda da değeri sakla
        newEntryDate = `${newDay || ''}/${newMonth || ''}`;
      }
      
      setFormData(prev => ({ ...prev, entryDate: newEntryDate }));
      
      // Clear error
      if (errors.entryDate) {
        setErrors(prev => ({ ...prev, entryDate: null }));
      }
    }
    
    // Çıkış tarihi için
    if (name === 'exitDay' || name === 'exitMonth') {
      const currentExit = formData.exitDate || '';
      const parts = currentExit.split('/');
      const currentDay = parts[0] || '';
      const currentMonth = parts[1] || '';
      
      let newDay = name === 'exitDay' ? value : currentDay;
      let newMonth = name === 'exitMonth' ? value : currentMonth;
      
      // Sadece her ikisi de seçiliyse birleştir, aksi halde kısmi seçimi koru
      let newExitDate = '';
      if (newDay && newMonth) {
        newExitDate = `${newDay}/${newMonth}`;
      } else if (newDay || newMonth) {
        // Kısmi seçim durumunda da değeri sakla
        newExitDate = `${newDay || ''}/${newMonth || ''}`;
      }
      
      setFormData(prev => ({ ...prev, exitDate: newExitDate }));
      
      // Clear error
      if (errors.exitDate) {
        setErrors(prev => ({ ...prev, exitDate: null }));
      }
    }
  };

  const validateDateFormat = (dateStr) => {
    if (!dateStr) return true; // Opsiyonel alan
    
    // Kısmi seçimleri de destekle (örn: "05/" veya "/03")
    if (dateStr === '/' || dateStr.endsWith('/') || dateStr.startsWith('/')) {
      return true; // Kısmi seçim geçerli kabul edilir
    }
    
    const regex = /^([0-2][0-9]|3[01])\/([0][1-9]|1[0-2])$/;
    if (!regex.test(dateStr)) return false;
    
    const [day, month] = dateStr.split('/').map(Number);
    return day >= 1 && day <= 31 && month >= 1 && month <= 12;
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

    // Satış tipine göre tarih validasyonu
    if (formData.saleType === 'satis') {
      if (!validateRequired(formData.saleDate)) {
        newErrors.saleDate = 'Satış tarihi gereklidir';
      }
    } else {
      if (!validateRequired(formData.kaporaDate)) {
        newErrors.kaporaDate = 'Kapora tarihi gereklidir';
      }
    }

    if (!validateRequired(formData.contractNo)) {
      newErrors.contractNo = 'Sözleşme no gereklidir';
    } else if (formData.contractNo.length < 6 || formData.contractNo.length > 6) {
      newErrors.contractNo = 'Sözleşme no tam olarak 6 hane olmalıdır';
    }

    // Fiyat validasyonu sadece normal satış için
    if (formData.saleType === 'satis') {
      if (!validatePositiveNumber(formData.listPrice)) {
        newErrors.listPrice = 'Geçerli bir liste fiyatı giriniz';
      }

      if (!validatePositiveNumber(formData.activitySalePrice)) {
        newErrors.activitySalePrice = 'Geçerli bir aktivite satış fiyatı giriniz';
      }

      if (!validateRequired(formData.paymentType)) {
        newErrors.paymentType = 'Ödeme tipi seçiniz';
      }

      // İndirim oranı validasyonu
      if (formData.discountRate) {
        const discountRate = parseFloat(formData.discountRate);
        if (isNaN(discountRate) || discountRate < 0 || discountRate > 100) {
          newErrors.discountRate = 'İndirim oranı 0-100 arasında olmalıdır';
        }
      }
    }

    // Giriş tarihi validasyonu (opsiyonel ama format kontrolü)
    if (formData.entryDate && !validateDateFormat(formData.entryDate)) {
      newErrors.entryDate = 'Geçersiz tarih formatı (GG/AA)';
    }

    // Çıkış tarihi validasyonu (opsiyonel ama format kontrolü)
    if (formData.exitDate && !validateDateFormat(formData.exitDate)) {
      newErrors.exitDate = 'Geçersiz tarih formatı (GG/AA)';
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
        customerName: formData.customerName,
        blockNo: formData.blockNo,
        apartmentNo: formData.apartmentNo,
        periodNo: formData.periodNo,
        contractNo: formData.contractNo,
        saleType: formData.saleType,
        entryDate: formData.entryDate,
        exitDate: formData.exitDate,
        notes: formData.notes
      };

      // Satış tipine göre farklı alanlar ekle
      if (formData.saleType === 'satis') {
        saleData.saleDate = formData.saleDate;
        saleData.listPrice = parseFloat(formData.listPrice) || 0;
        saleData.activitySalePrice = parseFloat(formData.activitySalePrice) || 0;
        saleData.paymentType = formData.paymentType;
        
        // İndirim bilgileri
        if (formData.discountRate) {
          saleData.discountRate = parseFloat(formData.discountRate) || 0;
        }
        if (formData.originalListPrice) {
          saleData.originalListPrice = parseFloat(formData.originalListPrice) || 0;
        }
      } else if (formData.saleType === 'kapora') {
        saleData.kaporaDate = formData.kaporaDate;
      }

      console.log('📤 Sending sale data:', saleData);

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
                  <Col md={4}>
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
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Satış Türü *</Form.Label>
                      <Form.Select
                        name="saleType"
                        value={formData.saleType}
                        onChange={handleChange}
                        isInvalid={!!errors.saleType}
                        disabled={isEdit} // Edit modunda değiştirilemez
                      >
                        <option value="satis">Normal Satış</option>
                        <option value="kapora">Kapora Durumu</option>
                      </Form.Select>
                      <Form.Control.Feedback type="invalid">
                        {errors.saleType}
                      </Form.Control.Feedback>
                      <Form.Text className="text-muted">
                        {formData.saleType === 'kapora' 
                          ? 'Kapora durumunda prim hesaplanmaz' 
                          : 'Normal satışta prim hesaplanır'
                        }
                      </Form.Text>
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
                        placeholder=""
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.periodNo}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>
                        {formData.saleType === 'kapora' ? 'Kapora Tarihi *' : 'Satış Tarihi *'}
                      </Form.Label>
                      <Form.Control
                        type="date"
                        name={formData.saleType === 'kapora' ? 'kaporaDate' : 'saleDate'}
                        value={formData.saleType === 'kapora' ? formData.kaporaDate : formData.saleDate}
                        onChange={handleChange}
                        isInvalid={!!(errors.saleDate || errors.kaporaDate)}
                      />
                      <Form.Control.Feedback type="invalid">
                        {errors.saleDate || errors.kaporaDate}
                      </Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  {/* Ödeme Tipi - Sadece Normal Satış İçin */}
                  {formData.saleType === 'satis' && (
                    <Col md={4}>
                      <Form.Group className="mb-3">
                        <Form.Label>Ödeme Tipi *</Form.Label>
                        <Form.Select
                          name="paymentType"
                          value={formData.paymentType}
                          onChange={handleChange}
                          isInvalid={!!errors.paymentType}
                        >
                          <option value="">Ödeme tipi seçiniz</option>
                          {paymentMethods.map((method) => (
                            <option key={method._id} value={method.name}>
                              {method.name}
                              {method.isDefault && ' (Varsayılan)'}
                            </option>
                          ))}
                        </Form.Select>
                        <Form.Control.Feedback type="invalid">
                          {errors.paymentType}
                        </Form.Control.Feedback>
                      </Form.Group>
                    </Col>
                  )}
                </Row>

                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Sözleşme No *</Form.Label>
                      <Form.Control
                        type="text"
                        name="contractNo"
                        value={formData.contractNo}
                        onChange={handleChange}
                        isInvalid={!!errors.contractNo}
                        placeholder=""
                        maxLength={6}
                      />
                      <div className="d-flex justify-content-between">
                        <Form.Control.Feedback type="invalid">
                          {errors.contractNo}
                        </Form.Control.Feedback>
                        <Form.Text className="text-muted">
                          {formData.contractNo.length}/6 karakter
                        </Form.Text>
                      </div>
                    </Form.Group>
                  </Col>
                  {/* Giriş/Çıkış Tarihleri - Hem Kapora Hem Normal Satış İçin */}
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Giriş Tarihi</Form.Label>
                      <Row>
                        <Col xs={6}>
                          <Form.Select
                            name="entryDay"
                            value={formData.entryDate ? (formData.entryDate.split('/')[0] || '') : ''}
                            onChange={handleDateChange}
                            isInvalid={!!errors.entryDate}
                          >
                            <option value="">Gün</option>
                            {Array.from({length: 31}, (_, i) => i + 1).map(day => {
                              const dayStr = day.toString().padStart(2, '0');
                              return (
                                <option key={day} value={dayStr}>
                                  {day}
                                </option>
                              );
                            })}
                          </Form.Select>
                        </Col>
                        <Col xs={6}>
                          <Form.Select
                            name="entryMonth"
                            value={formData.entryDate ? (formData.entryDate.split('/')[1] || '') : ''}
                            onChange={handleDateChange}
                            isInvalid={!!errors.entryDate}
                          >
                            <option value="">Ay</option>
                            <option value="01">Ocak</option>
                            <option value="02">Şubat</option>
                            <option value="03">Mart</option>
                            <option value="04">Nisan</option>
                            <option value="05">Mayıs</option>
                            <option value="06">Haziran</option>
                            <option value="07">Temmuz</option>
                            <option value="08">Ağustos</option>
                            <option value="09">Eylül</option>
                            <option value="10">Ekim</option>
                            <option value="11">Kasım</option>
                            <option value="12">Aralık</option>
                          </Form.Select>
                        </Col>
                      </Row>
                      <Form.Control.Feedback type="invalid">
                        {errors.entryDate}
                      </Form.Control.Feedback>
                      <Form.Text className="text-muted">
                        Örn: 5 Eylül
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Çıkış Tarihi</Form.Label>
                      <Row>
                        <Col xs={6}>
                          <Form.Select
                            name="exitDay"
                            value={formData.exitDate ? (formData.exitDate.split('/')[0] || '') : ''}
                            onChange={handleDateChange}
                            isInvalid={!!errors.exitDate}
                          >
                            <option value="">Gün</option>
                            {Array.from({length: 31}, (_, i) => i + 1).map(day => {
                              const dayStr = day.toString().padStart(2, '0');
                              return (
                                <option key={day} value={dayStr}>
                                  {day}
                                </option>
                              );
                            })}
                          </Form.Select>
                        </Col>
                        <Col xs={6}>
                          <Form.Select
                            name="exitMonth"
                            value={formData.exitDate ? (formData.exitDate.split('/')[1] || '') : ''}
                            onChange={handleDateChange}
                            isInvalid={!!errors.exitDate}
                          >
                            <option value="">Ay</option>
                            <option value="01">Ocak</option>
                            <option value="02">Şubat</option>
                            <option value="03">Mart</option>
                            <option value="04">Nisan</option>
                            <option value="05">Mayıs</option>
                            <option value="06">Haziran</option>
                            <option value="07">Temmuz</option>
                            <option value="08">Ağustos</option>
                            <option value="09">Eylül</option>
                            <option value="10">Ekim</option>
                            <option value="11">Kasım</option>
                            <option value="12">Aralık</option>
                          </Form.Select>
                        </Col>
                      </Row>
                      <Form.Control.Feedback type="invalid">
                        {errors.exitDate}
                      </Form.Control.Feedback>
                      <Form.Text className="text-muted">
                        Örn: 20 Mart
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>

                {/* Fiyat Alanları - Sadece Normal Satış İçin */}
                {formData.saleType === 'satis' && (
                  <>
                    {/* İndirim Oranı */}
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Yapılan İndirim Oranı (%)</Form.Label>
                          <Form.Control
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            name="discountRate"
                            value={formData.discountRate}
                            onChange={handleChange}
                            isInvalid={!!errors.discountRate}
                            placeholder="0.00"
                          />
                          <Form.Control.Feedback type="invalid">
                            {errors.discountRate}
                          </Form.Control.Feedback>
                          <Form.Text className="text-muted">
                            İndirim oranı girilirse liste fiyatına otomatik uygulanır
                          </Form.Text>
                        </Form.Group>
                      </Col>
                      {formData.discountRate && (
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>Orijinal Liste Fiyatı (₺)</Form.Label>
                            <Form.Control
                              type="number"
                              step="0.01"
                              min="0"
                              name="originalListPrice"
                              value={formData.originalListPrice}
                              readOnly
                              className="bg-light"
                            />
                            <Form.Text className="text-muted">
                              İndirim öncesi orijinal fiyat
                            </Form.Text>
                          </Form.Group>
                        </Col>
                      )}
                    </Row>

                    {/* Liste ve Aktivite Fiyatları */}
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>
                            Liste Fiyatı (₺) *
                            {formData.discountRate && (
                              <Badge bg="success" className="ms-2">
                                %{formData.discountRate} İndirimli
                              </Badge>
                            )}
                          </Form.Label>
                          <Form.Control
                            type="number"
                            step="0.01"
                            min="0"
                            name="listPrice"
                            value={formData.listPrice}
                            onChange={handleChange}
                            isInvalid={!!errors.listPrice}
                            placeholder="0.00"
                            readOnly={!!formData.discountRate}
                            className={formData.discountRate ? 'bg-light' : ''}
                          />
                          <Form.Control.Feedback type="invalid">
                            {errors.listPrice}
                          </Form.Control.Feedback>
                          {formData.discountRate && (
                            <Form.Text className="text-success">
                              İndirim uygulandı: {formData.originalListPrice} TL → {formData.listPrice} TL
                            </Form.Text>
                          )}
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
                  </>
                )}

                {/* Kapora Durumu Bilgilendirmesi */}
                {formData.saleType === 'kapora' && (
                  <Row>
                    <Col md={12}>
                      <Alert variant="info" className="mb-3">
                        <strong>Kapora Durumu:</strong> Bu kayıt kapora olarak işaretlenmiştir. 
                        Fiyat bilgileri ve prim hesaplama yapılmayacaktır. 
                        Daha sonra "Satışa Dönüştür" seçeneği ile normal satışa çevirebilirsiniz.
                      </Alert>
                    </Col>
                  </Row>
                )}

                {/* Notlar Alanı */}
                <Row>
                  <Col md={12}>
                    <Form.Group className="mb-4">
                      <Form.Label>
                        <FiFileText className="me-2" />
                        Notlar
                      </Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={4}
                        name="notes"
                        value={formData.notes}
                        onChange={handleChange}
                        placeholder="Bu satışla ilgili notlarınızı buraya yazabilirsiniz..."
                        maxLength={1000}
                        isInvalid={!!errors.notes}
                      />
                      <div className="d-flex justify-content-between">
                        <Form.Control.Feedback type="invalid">
                          {errors.notes}
                        </Form.Control.Feedback>
                        <Form.Text className="text-muted">
                          {formData.notes.length}/1000 karakter
                        </Form.Text>
                      </div>
                      <Form.Text className="text-muted">
                        <FiInfo className="me-1" />
                        Sadece siz ve adminler bu notu görebilir ve düzenleyebilir.
                      </Form.Text>
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
