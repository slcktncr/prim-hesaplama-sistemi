import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Row, Col, Alert } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { FiEdit, FiSave, FiX } from 'react-icons/fi';

import { salesAPI, primsAPI } from '../../utils/api';
import { formatCurrency } from '../../utils/helpers';

const ModifySaleModal = ({ show, onHide, sale, onModified }) => {
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
  const [calculatedPrim, setCalculatedPrim] = useState(0);
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
      fetchPrimRate();
    }
  }, [sale, show]);

  useEffect(() => {
    calculatePrim();
  }, [formData.listPrice, formData.discountRate, formData.activitySalePrice, primRate]);

  const fetchPrimRate = async () => {
    try {
      const response = await primsAPI.getRate();
      setPrimRate(response.data.rate || 0);
    } catch (error) {
      console.error('Prim rate fetch error:', error);
    }
  };

  const calculatePrim = () => {
    const listPrice = parseFloat(formData.listPrice) || 0;
    const discountRate = parseFloat(formData.discountRate) || 0;
    const activitySalePrice = parseFloat(formData.activitySalePrice) || 0;

    if (listPrice === 0) {
      setCalculatedPrim(0);
      return;
    }

    // İndirimli liste fiyatını hesapla
    const discountedListPrice = discountRate > 0 ? 
      listPrice * (1 - discountRate / 100) : 
      listPrice;

    // En düşük fiyatı bul
    const basePrimPrice = Math.min(discountedListPrice, activitySalePrice || discountedListPrice);

    // Prim tutarını hesapla
    const primAmount = basePrimPrice * (primRate / 100);
    setCalculatedPrim(primAmount);
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

      await salesAPI.modifySale(sale._id, modificationData);
      
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
                <Form.Control
                  type="text"
                  placeholder="GG/AA"
                  value={formData.entryDate}
                  onChange={(e) => handleInputChange('entryDate', e.target.value)}
                  isInvalid={!!errors.entryDate}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.entryDate}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Çıkış Tarihi *</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="GG/AA"
                  value={formData.exitDate}
                  onChange={(e) => handleInputChange('exitDate', e.target.value)}
                  isInvalid={!!errors.exitDate}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.exitDate}
                </Form.Control.Feedback>
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

          {/* Prim Hesaplama Önizlemesi */}
          <Alert variant="success" className="mb-0">
            <div className="d-flex justify-content-between align-items-center">
              <span><strong>Yeni Prim Tutarı:</strong></span>
              <span className="h5 mb-0">{formatCurrency(calculatedPrim)}</span>
            </div>
            <small className="text-muted">
              Prim Oranı: %{primRate} | 
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
