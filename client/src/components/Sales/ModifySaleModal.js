import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Row, Col, Alert, Badge } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { FiEdit, FiSave, FiX } from 'react-icons/fi';

import { salesAPI, primsAPI } from '../../utils/api';
import { formatCurrency } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

const ModifySaleModal = ({ show, onHide, sale, onModified }) => {
  const { user } = useAuth();
  const isAdmin = user?.role && user.role.name === 'admin';
  
  const [formData, setFormData] = useState({
    blockNo: '',
    apartmentNo: '',
    periodNo: '',
    listPrice: '',
    discountRate: '',
    activitySalePrice: '',
    contractNo: '',
    saleDate: '',
    kaporaDate: '',
    entryDate: '',
    exitDate: '',
    reason: ''
  });
  const [primRate, setPrimRate] = useState(0);
  const [customPrimRate, setCustomPrimRate] = useState('');
  const [useCustomPrimRate, setUseCustomPrimRate] = useState(false);
  const [excludeFromPrim, setExcludeFromPrim] = useState(false);
  const [calculatedPrim, setCalculatedPrim] = useState(0);
  const [primDifference, setPrimDifference] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (sale && show) {
      setFormData({
        blockNo: sale.blockNo || '',
        apartmentNo: sale.apartmentNo || '',
        periodNo: sale.periodNo || '',
        listPrice: sale.listPrice || '',
        discountRate: sale.discountRate || '',
        activitySalePrice: sale.activitySalePrice || '',
        contractNo: sale.contractNo || '',
        saleDate: sale.saleDate ? new Date(sale.saleDate).toISOString().split('T')[0] : '',
        kaporaDate: sale.kaporaDate ? new Date(sale.kaporaDate).toISOString().split('T')[0] : '',
        entryDate: sale.entryDate || '',
        exitDate: sale.exitDate || '',
        reason: ''
      });
      setExcludeFromPrim(sale.excludeFromPrim || false);
      fetchPrimRate();
    }
  }, [sale, show]);

  useEffect(() => {
    calculatePrim();
  }, [formData.listPrice, formData.discountRate, formData.activitySalePrice, primRate, customPrimRate, useCustomPrimRate, excludeFromPrim, sale]);

  const fetchPrimRate = async () => {
    try {
      const response = await primsAPI.getRate();
      setPrimRate(response.data.rate || 0);
    } catch (error) {
      console.error('Prim rate fetch error:', error);
    }
  };

  const calculatePrim = () => {
    // Prim ödenmeyecek olarak işaretlenmişse
    if (excludeFromPrim) {
      setCalculatedPrim(0);
      setPrimDifference(0 - (sale?.primAmount || 0)); // Mevcut primden fark
      return;
    }
    
    const listPrice = parseFloat(formData.listPrice) || 0;
    const discountRate = parseFloat(formData.discountRate) || 0;
    const activitySalePrice = parseFloat(formData.activitySalePrice) || 0;

    if (listPrice === 0) {
      setCalculatedPrim(0);
      setPrimDifference(0);
      return;
    }

    // İndirimli liste fiyatını hesapla
    const discountedListPrice = discountRate > 0 ? 
      listPrice * (1 - discountRate / 100) : 
      listPrice;

    // En düşük fiyatı bul
    const basePrimPrice = Math.min(discountedListPrice, activitySalePrice || discountedListPrice);

    // Prim oranını belirle (admin özel oran kullanabilir)
    const effectivePrimRate = useCustomPrimRate && isAdmin && customPrimRate ? 
      parseFloat(customPrimRate) : 
      primRate;

    // Yeni prim tutarını hesapla
    const newPrimAmount = basePrimPrice * (effectivePrimRate / 100);
    setCalculatedPrim(newPrimAmount);

    // Prim farkını hesapla (eski prim ile karşılaştır)
    const oldPrimAmount = sale?.primAmount || 0;
    const difference = newPrimAmount - oldPrimAmount;
    setPrimDifference(difference);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Hata mesajını temizle
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
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
        setErrors(prev => ({ ...prev, entryDate: '' }));
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
        setErrors(prev => ({ ...prev, exitDate: '' }));
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.blockNo.trim()) newErrors.blockNo = 'Blok no gereklidir';
    if (!formData.apartmentNo.trim()) newErrors.apartmentNo = 'Daire no gereklidir';
    if (!formData.periodNo.trim()) newErrors.periodNo = 'Dönem no gereklidir';
    if (!formData.listPrice || parseFloat(formData.listPrice) <= 0) {
      newErrors.listPrice = 'Geçerli bir liste fiyatı giriniz';
    }
    if (!formData.activitySalePrice || parseFloat(formData.activitySalePrice) <= 0) {
      newErrors.activitySalePrice = 'Geçerli bir aktivite satış fiyatı giriniz';
    }
    // Sözleşme no kontrolü - Yazlık ev ve Kışlık ev için gerekli değil
    const saleTypeValue = sale?.saleType || 'satis';
    const isContractRequired = !['yazlikev', 'kislikev'].includes(saleTypeValue);
    if (isContractRequired && !formData.contractNo.trim()) {
      newErrors.contractNo = 'Sözleşme no gereklidir';
    }
    if (!formData.entryDate.trim()) newErrors.entryDate = 'Giriş tarihi gereklidir';
    if (!formData.exitDate.trim()) newErrors.exitDate = 'Çıkış tarihi gereklidir';
    if (!formData.reason.trim()) newErrors.reason = 'Değişiklik sebebi gereklidir';

    // Tarih validasyonu
    if (sale?.saleType !== 'kapora' && !formData.saleDate) {
      newErrors.saleDate = 'Satış tarihi gereklidir';
    }
    if (sale?.saleType === 'kapora' && !formData.kaporaDate) {
      newErrors.kaporaDate = 'Kapora tarihi gereklidir';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Lütfen tüm zorunlu alanları doldurun');
      return;
    }
    
    // Değişiklik nedeni zorunlu kontrolü
    if (!formData.reason.trim()) {
      setErrors(prev => ({
        ...prev,
        reason: 'Değişiklik nedeni belirtilmesi zorunludur'
      }));
      toast.error('Değişiklik nedeni belirtilmesi zorunludur');
      return;
    }

    setLoading(true);

    try {
      const modificationData = {
        ...formData,
        listPrice: parseFloat(formData.listPrice),
        discountRate: parseFloat(formData.discountRate) || 0,
        activitySalePrice: parseFloat(formData.activitySalePrice)
      };

      // Admin özel prim oranı kullanıyorsa ekle
      if (useCustomPrimRate && isAdmin && customPrimRate) {
        modificationData.customPrimRate = parseFloat(customPrimRate);
      }
      
      // Admin prim ödenmeyecek seçeneğini ekle
      if (isAdmin) {
        modificationData.excludeFromPrim = excludeFromPrim;
      }

      const response = await salesAPI.modifySale(sale._id, modificationData);
      
      console.log('🔄 Sale modification response:', response);
      console.log('🔄 Updated sale data:', response.data?.sale);
      console.log('🔄 Updated listPrice:', response.data?.sale?.listPrice);
      console.log('🔄 Updated originalListPrice:', response.data?.sale?.originalListPrice);
      console.log('🔄 Updated activitySalePrice:', response.data?.sale?.activitySalePrice);
      
      toast.success('Satış başarıyla güncellendi');
      onModified();
      onHide();
      
    } catch (error) {
      console.error('Sale modification error:', error);
      toast.error(error.response?.data?.message || 'Satış güncellenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      blockNo: '',
      apartmentNo: '',
      periodNo: '',
      listPrice: '',
      discountRate: '',
      activitySalePrice: '',
      contractNo: '',
      saleDate: '',
      kaporaDate: '',
      entryDate: '',
      exitDate: '',
      reason: ''
    });
    setErrors({});
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          <FiEdit className="me-2" />
          Satış Değişikliği
        </Modal.Title>
      </Modal.Header>

      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {sale && (
            <Alert variant="info" className="mb-4">
              <strong>Değişiklik Yapılacak Satış:</strong><br />
              {sale.customerName} - {sale.blockNo}/{sale.apartmentNo} - Dönem: {sale.periodNo}
              <hr className="my-2" />
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <strong>Mevcut Prim Oranı:</strong> %{primRate}
                  <br />
                  <small className="text-muted">Ek prim/kesinti hesaplamasında kullanılacak oran</small>
                </div>
                <div className="text-end">
                  <strong>Mevcut Prim:</strong> {formatCurrency(sale.primAmount || 0)}
                  <br />
                  <Badge bg={sale.primStatus === 'ödendi' ? 'success' : 'warning'}>
                    {sale.primStatus}
                  </Badge>
                </div>
              </div>
            </Alert>
          )}

          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Blok No *</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.blockNo}
                  onChange={(e) => handleInputChange('blockNo', e.target.value)}
                  isInvalid={!!errors.blockNo}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.blockNo}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Daire No *</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.apartmentNo}
                  onChange={(e) => handleInputChange('apartmentNo', e.target.value)}
                  isInvalid={!!errors.apartmentNo}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.apartmentNo}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Dönem No *</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.periodNo}
                  onChange={(e) => handleInputChange('periodNo', e.target.value)}
                  isInvalid={!!errors.periodNo}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.periodNo}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Liste Fiyatı *</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  value={formData.listPrice}
                  onChange={(e) => handleInputChange('listPrice', e.target.value)}
                  isInvalid={!!errors.listPrice}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.listPrice}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>İndirim Oranı (%)</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.discountRate}
                  onChange={(e) => handleInputChange('discountRate', e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label>Aktivite Satış Fiyatı *</Form.Label>
                <Form.Control
                  type="number"
                  step="0.01"
                  value={formData.activitySalePrice}
                  onChange={(e) => handleInputChange('activitySalePrice', e.target.value)}
                  isInvalid={!!errors.activitySalePrice}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.activitySalePrice}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Sözleşme No *</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.contractNo}
                  onChange={(e) => handleInputChange('contractNo', e.target.value)}
                  isInvalid={!!errors.contractNo}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.contractNo}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={6}>
              {sale?.saleType !== 'kapora' ? (
                <Form.Group className="mb-3">
                  <Form.Label>Satış Tarihi *</Form.Label>
                  <Form.Control
                    type="date"
                    value={formData.saleDate}
                    onChange={(e) => handleInputChange('saleDate', e.target.value)}
                    isInvalid={!!errors.saleDate}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.saleDate}
                  </Form.Control.Feedback>
                </Form.Group>
              ) : (
                <Form.Group className="mb-3">
                  <Form.Label>Kapora Tarihi *</Form.Label>
                  <Form.Control
                    type="date"
                    value={formData.kaporaDate}
                    onChange={(e) => handleInputChange('kaporaDate', e.target.value)}
                    isInvalid={!!errors.kaporaDate}
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.kaporaDate}
                  </Form.Control.Feedback>
                </Form.Group>
              )}
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Giriş Tarihi *</Form.Label>
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
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Çıkış Tarihi *</Form.Label>
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

          <Form.Group className="mb-3">
            <Form.Label>Değişiklik Sebebi *</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={formData.reason}
              onChange={(e) => handleInputChange('reason', e.target.value)}
              placeholder="Değişiklik yapılma sebebini açıklayın..."
              isInvalid={!!errors.reason}
            />
            <Form.Control.Feedback type="invalid">
              {errors.reason}
            </Form.Control.Feedback>
          </Form.Group>

          {/* Admin Özel Prim Oranı */}
          {isAdmin && (
            <>
              <Row className="mb-3">
                <Col>
                  <Form.Check
                    type="checkbox"
                    label="Özel Prim Oranı Kullan"
                    checked={useCustomPrimRate}
                    onChange={(e) => setUseCustomPrimRate(e.target.checked)}
                    className="mb-2"
                    disabled={excludeFromPrim}
                  />
                  {useCustomPrimRate && !excludeFromPrim && (
                    <Form.Group>
                      <Form.Label>Özel Prim Oranı (%)</Form.Label>
                      <Form.Control
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={customPrimRate}
                        onChange={(e) => setCustomPrimRate(e.target.value)}
                        placeholder="Örn: 8.5"
                      />
                      <Form.Text className="text-muted">
                        Sistem oranı: %{primRate} | Bu değişiklik sadece ek prim/kesinti hesaplamasında kullanılır
                      </Form.Text>
                    </Form.Group>
                  )}
                </Col>
              </Row>
              
              {/* Prim Ödenmeyecek Seçeneği */}
              <Row className="mb-3">
                <Col>
                  <Form.Check
                    type="checkbox"
                    label="Bu satış için prim ödenmeyecek"
                    checked={excludeFromPrim}
                    onChange={(e) => setExcludeFromPrim(e.target.checked)}
                    className="text-danger"
                  />
                  <Form.Text className="text-muted">
                    İşaretlenirse bu satış prim hesaplamasına ve hakedişe dahil edilmez
                  </Form.Text>
                </Col>
              </Row>
            </>
          )}

          {/* Prim Hesaplama Önizlemesi */}
          <Alert variant={excludeFromPrim ? "danger" : (primDifference >= 0 ? "success" : "warning")} className="mb-0">
            {excludeFromPrim && (
              <div className="mb-2">
                <Badge bg="danger">
                  ⚠️ Prim Ödenmeyecek
                </Badge>
                <div className="small text-muted mt-1">
                  Bu satış için prim hesaplanmayacak ve hakedişe dahil edilmeyecek
                </div>
              </div>
            )}
            <div className="d-flex justify-content-between align-items-center">
              <span><strong>Yeni Prim Tutarı:</strong></span>
              <span className={`h5 mb-0 ${excludeFromPrim ? 'text-decoration-line-through' : ''}`}>
                {formatCurrency(calculatedPrim)}
              </span>
            </div>
            
            {/* Prim Farkı Gösterimi */}
            {sale?.primAmount && (
              <div className="d-flex justify-content-between align-items-center mt-2">
                <span>Mevcut Prim:</span>
                <span>{formatCurrency(sale.primAmount)}</span>
              </div>
            )}
            
            {primDifference !== 0 && (
              <div className="d-flex justify-content-between align-items-center mt-2">
                <span><strong>Prim Farkı:</strong></span>
                <span className={`h6 mb-0 ${primDifference > 0 ? 'text-success' : 'text-danger'}`}>
                  {primDifference > 0 ? '+' : ''}{formatCurrency(primDifference)}
                </span>
              </div>
            )}
            
            <small className="text-muted">
              Prim Oranı: %{useCustomPrimRate && isAdmin && customPrimRate ? customPrimRate : primRate}
              {useCustomPrimRate && isAdmin && customPrimRate && ` (Özel Oran)`} | 
              {formData.discountRate > 0 && ` İndirimli Liste: ${formatCurrency((parseFloat(formData.listPrice) || 0) * (1 - (parseFloat(formData.discountRate) || 0) / 100))} |`}
              {` Base Prim: ${formatCurrency(Math.min(
                formData.discountRate > 0 ?
                  (parseFloat(formData.listPrice) || 0) * (1 - (parseFloat(formData.discountRate) || 0) / 100) :
                  (parseFloat(formData.listPrice) || 0),
                parseFloat(formData.activitySalePrice) || (parseFloat(formData.listPrice) || 0)
              ))}`}
            </small>
          </Alert>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            <FiX className="me-1" />
            İptal
          </Button>
          <Button variant="primary" type="submit" disabled={loading}>
            <FiSave className="me-1" />
            {loading ? 'Kaydediliyor...' : 'Değişikliği Onayla'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default ModifySaleModal;
