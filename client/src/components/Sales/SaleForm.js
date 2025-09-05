import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Row, Col, Card, Form, Button, Alert, Badge } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { salesAPI, primsAPI, paymentMethodsAPI, systemSettingsAPI } from '../../utils/api';
import { 
  validateRequired, 
  validatePositiveNumber, 
  formatCurrency,
  getSaleTypeValue 
} from '../../utils/helpers';
import Loading from '../Common/Loading';
import { FiFileText, FiInfo } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';

const SaleForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [formData, setFormData] = useState({
    customerName: '',
    blockNo: '',
    apartmentNo: '',
    periodNo: '',
    saleType: 'satis', // 'kapora' veya 'satis'
    saleDate: '',
    kaporaDate: '',
    contractNo: '',
    listPrice: '',           // Ana liste fiyatı (girilen)
    originalListPrice: '',   // İndirim öncesi orijinal liste fiyatı (aynı listPrice ile)
    discountRate: '',        // İndirim oranı (%)
    discountedListPrice: '', // İndirim sonrası liste fiyatı
    activitySalePrice: '',   // Aktivite satış fiyatı
    paymentType: 'Nakit',
    entryDate: '', // Giriş tarihi (gün/ay)
    exitDate: '',  // Çıkış tarihi (gün/ay)
    notes: ''      // Notlar
  });

  const [periods, setPeriods] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [saleTypes, setSaleTypes] = useState([]);
  const [currentRate, setCurrentRate] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEdit);

  useEffect(() => {
    fetchPeriods();
    fetchCurrentRate();
    fetchPaymentMethods();
    fetchSaleTypes();
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

  const fetchSaleTypes = async () => {
    try {
      const response = await systemSettingsAPI.getSaleTypes();
      const types = response.data || [];
      
      // Eski sistemle uyumlu value mapping ekle
      const mappedTypes = types.map(type => ({
        ...type,
        value: getSaleTypeValue(type.name)
      }));
      
      setSaleTypes(mappedTypes);
      
      // Varsayılan satış türünü seç
      const defaultType = mappedTypes.find(t => t.isDefault);
      if (defaultType && !isEdit) {
        setFormData(prev => ({
          ...prev,
          saleType: defaultType.value
        }));
      }
    } catch (error) {
      console.error('Sale types fetch error:', error);
      // Hata durumunda eski sabit değerleri kullan
      setSaleTypes([
        { _id: '1', name: 'Normal Satış', value: 'satis', isDefault: true },
        { _id: '2', name: 'Kapora Durumu', value: 'kapora', isDefault: false }
      ]);
    }
  };

  // Sözleşme no gerekliliğini kontrol et
  const isContractRequired = () => {
    const saleTypeValue = getSaleTypeValue(formData.saleType);
    // Yazlık ev, kışlık ev ve kapora durumu için sözleşme no gerekli değil
    const nonContractTypes = ['yazlikev', 'kislikev', 'kapora'];
    return !nonContractTypes.includes(saleTypeValue);
  };


  const fetchSale = async () => {
    try {
      setInitialLoading(true);
      // Satış ID'si ile doğrudan satışı getir
      const response = await salesAPI.getSaleById(id);
      const sale = response.data;
      
      if (sale) {
        // İndirimli fiyatı hesapla (eğer kayıtlı değilse)
        let calculatedDiscountedPrice = '';
        if (sale.discountRate > 0 && sale.listPrice) {
          calculatedDiscountedPrice = sale.discountedListPrice?.toString() || 
            calculateDiscountedPrice(sale.listPrice, sale.discountRate);
        }

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
          originalListPrice: sale.originalListPrice?.toString() || sale.listPrice?.toString() || '',
          discountRate: sale.discountRate?.toString() || '',
          discountedListPrice: calculatedDiscountedPrice,
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
    if (!originalPrice || !discountRate) return '';
    
    const original = parseFloat(originalPrice);
    const discount = parseFloat(discountRate);
    
    if (isNaN(original) || isNaN(discount) || discount < 0 || discount > 100) {
      return '';
    }
    
    const result = original * (1 - discount / 100);
    return result.toFixed(2);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Sözleşme no için karakter sınırı kontrolü
    if (name === 'contractNo') {
      if (value.length > 10) {
        return; // 10 karakterden fazla girişi engelle
      }
    }
    
    setFormData(prev => {
      const newFormData = { ...prev, [name]: value };
      
      // Satış tipi değiştiğinde sözleşme no'yu temizle (gerekli değilse)
      if (name === 'saleType') {
        const saleTypeValue = getSaleTypeValue(value);
        const nonContractTypes = ['yazlikev', 'kislikev', 'kapora'];
        if (nonContractTypes.includes(saleTypeValue)) {
          newFormData.contractNo = '';
        }
      }
      
      const newData = newFormData;

      // Yeni fiyat hesaplama mantığı
      if (name === 'listPrice') {
        // Liste fiyatı değiştiğinde
        newData.originalListPrice = value; // Her zaman güncelle
        
        // Eğer indirim varsa, yeniden hesapla
        if (prev.discountRate && value) {
          newData.discountedListPrice = calculateDiscountedPrice(value, prev.discountRate);
        }
      } else if (name === 'discountRate') {
        // İndirim oranı değiştiğinde
        const basePrice = prev.listPrice; // Doğrudan listPrice kullan
        
        if (value && basePrice) {
          // Orijinal fiyatı kaydet
          newData.originalListPrice = basePrice;
          // İndirimli fiyatı hesapla
          newData.discountedListPrice = calculateDiscountedPrice(basePrice, value);
        } else if (!value || value === '0') {
          // İndirim temizlendiğinde
          newData.discountedListPrice = '';
          newData.originalListPrice = '';
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
    } else if (formData.saleType === 'kapora') {
      if (!validateRequired(formData.kaporaDate)) {
        newErrors.kaporaDate = 'Kapora tarihi gereklidir';
      }
    } else {
      // Yeni satış türleri için varsayılan olarak satış tarihi gerekli
      if (!validateRequired(formData.saleDate)) {
        newErrors.saleDate = 'Satış tarihi gereklidir';
      }
    }

    // Sözleşme no validasyonu - sadece gerekli olan türler için
    if (isContractRequired()) {
      if (!validateRequired(formData.contractNo)) {
        newErrors.contractNo = 'Sözleşme no gereklidir';
      } else if (formData.contractNo.length < 6 || formData.contractNo.length > 6) {
        newErrors.contractNo = 'Sözleşme no tam olarak 6 hane olmalıdır';
      }
    }

    // Fiyat validasyonu sadece normal satış için
    if (formData.saleType === 'satis') {
      if (!validatePositiveNumber(formData.listPrice)) {
        newErrors.listPrice = 'Geçerli bir liste fiyatı giriniz';
      }

      if (!validatePositiveNumber(formData.activitySalePrice)) {
        newErrors.activitySalePrice = 'Geçerli bir aktivite satış fiyatı giriniz';
      }
    } else if (formData.saleType !== 'kapora') {
      // Yeni satış türleri için de fiyat gerekli (kapora hariç)
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
      console.log('📝 Form data:', formData);
      
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
      
      console.log('📤 Gönderilecek saleData (base):', saleData);

      // Satış tipine göre farklı alanlar ekle
      if (formData.saleType === 'satis') {
        saleData.saleDate = formData.saleDate;
        saleData.listPrice = parseFloat(formData.listPrice) || 0;
        saleData.activitySalePrice = parseFloat(formData.activitySalePrice) || 0;
        saleData.paymentType = formData.paymentType;
        
        // Orijinal liste fiyatını her zaman gönder
        saleData.originalListPrice = parseFloat(formData.originalListPrice || formData.listPrice) || 0;
        
        // İndirim bilgileri
        if (formData.discountRate && parseFloat(formData.discountRate) > 0) {
          saleData.discountRate = parseFloat(formData.discountRate);
          if (formData.discountedListPrice) {
            saleData.discountedListPrice = parseFloat(formData.discountedListPrice) || 0;
          }
        }
      } else if (formData.saleType === 'kapora') {
        saleData.kaporaDate = formData.kaporaDate;
      } else {
        // Yeni satış türleri için normal satış gibi davran
        saleData.saleDate = formData.saleDate;
        saleData.listPrice = parseFloat(formData.listPrice) || 0;
        saleData.activitySalePrice = parseFloat(formData.activitySalePrice) || 0;
        saleData.paymentType = formData.paymentType;
        saleData.originalListPrice = parseFloat(formData.originalListPrice || formData.listPrice) || 0;
        
        if (formData.discountRate && parseFloat(formData.discountRate) > 0) {
          saleData.discountRate = parseFloat(formData.discountRate);
          if (formData.discountedListPrice) {
            saleData.discountedListPrice = parseFloat(formData.discountedListPrice) || 0;
          }
        }
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

  // Prim hesaplama - 3 fiyat arasından en düşüğü
  const calculatePrim = () => {
    const originalListPrice = parseFloat(formData.originalListPrice || formData.listPrice) || 0;
    const discountedListPrice = parseFloat(formData.discountedListPrice) || 0;
    const activityPrice = parseFloat(formData.activitySalePrice) || 0;
    const rate = currentRate?.rate || 0;
    
    // 3 fiyat arasından geçerli olanları topla
    const validPrices = [];
    
    if (originalListPrice > 0) {
      validPrices.push(originalListPrice);
    }
    
    if (discountedListPrice > 0) {
      validPrices.push(discountedListPrice);
    }
    
    if (activityPrice > 0) {
      validPrices.push(activityPrice);
    }
    
    // En az bir geçerli fiyat varsa, en düşüğü üzerinden hesapla
    if (validPrices.length > 0) {
      const basePrice = Math.min(...validPrices);
      return basePrice * rate;
    }
    
    return 0;
  };

  if (initialLoading) {
    return <Loading variant="ripple" size="large" />;
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
                      <Form.Label>
                        Satış Türü *
                        {isEdit && !isAdmin && (
                          <Badge bg="secondary" className="ms-2 small">
                            Sadece Admin Değiştirebilir
                          </Badge>
                        )}
                      </Form.Label>
                      <Form.Select
                        name="saleType"
                        value={formData.saleType}
                        onChange={handleChange}
                        isInvalid={!!errors.saleType}
                        disabled={isEdit && !isAdmin} // Edit modunda sadece admin değiştirebilir
                      >
                        {saleTypes.map(type => (
                          <option key={type._id} value={type.value}>
                            {type.name}
                          </option>
                        ))}
                      </Form.Select>
                      <Form.Control.Feedback type="invalid">
                        {errors.saleType}
                      </Form.Control.Feedback>
                      <Form.Text className="text-muted">
                        <FiInfo className="me-1" />
                        {isEdit && !isAdmin ? (
                          'Satış türü sadece admin tarafından değiştirilebilir.'
                        ) : (
                          formData.saleType === 'kapora' 
                            ? 'Kapora durumunda prim hesaplanmaz' 
                            : 'Normal satışta prim hesaplanır'
                        )}
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
                  {/* Ödeme Tipi - Kapora Hariç Tüm Satış Türleri İçin */}
                  {formData.saleType !== 'kapora' && (
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
                      <Form.Label>
                        Sözleşme No {!isContractRequired() && <small className="text-muted">(Opsiyonel)</small>}
                        {isContractRequired() && ' *'}
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="contractNo"
                        value={formData.contractNo}
                        onChange={handleChange}
                        isInvalid={!!errors.contractNo}
                        placeholder={isContractRequired() ? "Sözleşme numarası" : "Gerekli değil"}
                        maxLength={6}
                        disabled={!isContractRequired()}
                      />
                      <div className="d-flex justify-content-between">
                        <Form.Control.Feedback type="invalid">
                          {errors.contractNo}
                        </Form.Control.Feedback>
                        <Form.Text className="text-muted">
                          {isContractRequired() ? `${formData.contractNo.length}/6 karakter` : 'Bu satış tipi için sözleşme no gerekli değil'}
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

                {/* Fiyat Alanları - Kapora Hariç Tüm Satış Türleri İçin */}
                {formData.saleType !== 'kapora' && (
                  <>
                    {/* Ana Liste Fiyatı */}
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
                          <Form.Text className="text-muted">
                            Ana liste fiyatını giriniz
                          </Form.Text>
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>İndirim Oranı (%)</Form.Label>
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
                            İsteğe bağlı - Liste fiyatına uygulanacak indirim
                          </Form.Text>
                        </Form.Group>
                      </Col>
                    </Row>

                    {/* İndirim Sonrası Liste Fiyatı - Sadece indirim varsa göster */}
                    {formData.discountRate && formData.discountedListPrice && (
                      <Row>
                        <Col md={6}>
                          <Form.Group className="mb-3">
                            <Form.Label>
                              İndirim Sonrası Liste Fiyatı (₺)
                              <Badge bg="success" className="ms-2">
                                %{formData.discountRate} İndirimli
                              </Badge>
                            </Form.Label>
                            <Form.Control
                              type="number"
                              value={formData.discountedListPrice}
                              readOnly
                              className="bg-light"
                            />
                            <Form.Text className="text-success">
                              İndirim uygulandı: {formData.listPrice} TL → {formData.discountedListPrice} TL
                            </Form.Text>
                          </Form.Group>
                        </Col>
                      </Row>
                    )}

                    {/* Aktivite Satış Fiyatı */}
                    <Row>
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
                          <Form.Text className="text-muted">
                            İndirimden etkilenmez
                          </Form.Text>
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
                      %{currentRate.rate.toFixed(2)}
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <small className="text-muted">Liste Fiyatı (Ana)</small>
                    <div>
                      {formatCurrency(parseFloat(formData.listPrice) || 0)}
                    </div>
                  </div>
                  
                  {formData.discountedListPrice && (
                    <div className="mb-3">
                      <small className="text-muted">İndirim Sonrası Liste Fiyatı</small>
                      <div className="text-success">
                        {formatCurrency(parseFloat(formData.discountedListPrice) || 0)}
                      </div>
                    </div>
                  )}
                  
                  <div className="mb-3">
                    <small className="text-muted">Aktivite Fiyatı</small>
                    <div>
                      {formatCurrency(parseFloat(formData.activitySalePrice) || 0)}
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <small className="text-muted">Prim Hesaplama Tabanı</small>
                    <div className="text-info">
                      {(() => {
                        const originalListPrice = parseFloat(formData.listPrice) || 0;
                        const discountedListPrice = parseFloat(formData.discountedListPrice) || 0;
                        const activityPrice = parseFloat(formData.activitySalePrice) || 0;
                        
                        const validPrices = [];
                        if (originalListPrice > 0) validPrices.push(originalListPrice);
                        if (discountedListPrice > 0) validPrices.push(discountedListPrice);
                        if (activityPrice > 0) validPrices.push(activityPrice);
                        
                        const basePrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
                        return formatCurrency(basePrice);
                      })()}
                    </div>
                    <small className="text-muted">
                      (3 fiyat arasından en düşüğü)
                    </small>
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
