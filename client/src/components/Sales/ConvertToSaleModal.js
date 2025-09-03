import React, { useState } from 'react';
import { Modal, Form, Button, Row, Col, Alert } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { salesAPI } from '../../utils/api';
import { validateRequired, validatePositiveNumber } from '../../utils/helpers';

const ConvertToSaleModal = ({ show, onHide, sale, onSuccess }) => {
  const [formData, setFormData] = useState({
    saleDate: '',
    listPrice: '',
    activitySalePrice: '',
    paymentType: 'Nakit'
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Hata varsa temizle
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!validateRequired(formData.saleDate)) {
      newErrors.saleDate = 'Satış tarihi gereklidir';
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
      return;
    }

    setLoading(true);
    try {
      await salesAPI.convertToSale(sale._id, formData);
      toast.success('Kapora başarıyla satışa dönüştürüldü!');
      onSuccess();
      onHide();
      
      // Formu temizle
      setFormData({
        saleDate: '',
        listPrice: '',
        activitySalePrice: '',
        paymentType: 'Nakit'
      });
      setErrors({});
    } catch (error) {
      console.error('Convert to sale error:', error);
      toast.error(error.response?.data?.message || 'Dönüştürme işlemi başarısız');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      saleDate: '',
      listPrice: '',
      activitySalePrice: '',
      paymentType: 'Nakit'
    });
    setErrors({});
    onHide();
  };

  if (!sale) return null;

  return (
    <Modal show={show} onHide={handleClose} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Kaporayı Satışa Dönüştür</Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        <Alert variant="info" className="mb-4">
          <strong>Kapora Bilgileri:</strong><br />
          <strong>Müşteri:</strong> {sale.customerName}<br />
          <strong>Sözleşme No:</strong> {sale.contractNo}<br />
          <strong>Kapora Tarihi:</strong> {sale.kaporaDate ? new Date(sale.kaporaDate).toLocaleDateString('tr-TR') : '-'}
        </Alert>

        <Form onSubmit={handleSubmit}>
          <Row>
            <Col md={6}>
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
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Ödeme Tipi *</Form.Label>
                <Form.Select
                  name="paymentType"
                  value={formData.paymentType}
                  onChange={handleChange}
                  isInvalid={!!errors.paymentType}
                >
                  <option value="Nakit">Nakit</option>
                  <option value="Kredi">Kredi Kartı</option>
                  <option value="Taksit">Taksit</option>
                  <option value="Diğer">Diğer</option>
                </Form.Select>
                <Form.Control.Feedback type="invalid">
                  {errors.paymentType}
                </Form.Control.Feedback>
              </Form.Group>
            </Col>
          </Row>

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

          <Alert variant="warning" className="mt-3">
            <strong>Uyarı:</strong> Bu işlem sonrasında kapora normal satışa dönüştürülecek ve prim hesaplaması yapılacaktır.
          </Alert>
        </Form>
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={handleClose} disabled={loading}>
          İptal
        </Button>
        <Button 
          variant="primary" 
          onClick={handleSubmit} 
          disabled={loading}
        >
          {loading ? 'Dönüştürülüyor...' : 'Satışa Dönüştür'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ConvertToSaleModal;
