import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Table, 
  Button, 
  Badge, 
  Modal, 
  Form, 
  Alert,
  Spinner
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  FiPlus, 
  FiEdit, 
  FiTrash2, 
  FiToggleLeft, 
  FiToggleRight,
  FiCreditCard,
  FiSave,
  FiX
} from 'react-icons/fi';
import { paymentMethodsAPI } from '../../utils/api';

const PaymentMethods = () => {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isDefault: false,
    sortOrder: 0
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(true);

  useEffect(() => {
    fetchPaymentMethods();
  }, [includeInactive]);

  const fetchPaymentMethods = async () => {
    try {
      setLoading(true);
      const response = await paymentMethodsAPI.getAll(includeInactive);
      const dataArray = Array.isArray(response.data?.data) ? response.data.data : [];
      setPaymentMethods(dataArray);
    } catch (error) {
      console.error('Fetch payment methods error:', error);
      setPaymentMethods(prevMethods => Array.isArray(prevMethods) ? prevMethods : []);
      toast.error('Ödeme yöntemleri yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingMethod(null);
    setFormData({
      name: '',
      description: '',
      isDefault: false,
      sortOrder: Array.isArray(paymentMethods) && paymentMethods.length > 0 
        ? Math.max(...paymentMethods.map(m => m.sortOrder || 0), 0) + 1 
        : 1
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleEdit = (method) => {
    setEditingMethod(method);
    setFormData({
      name: method.name,
      description: method.description || '',
      isDefault: method.isDefault,
      sortOrder: method.sortOrder || 0
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear field error
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Ödeme yöntemi adı gereklidir';
    } else if (formData.name.length > 50) {
      errors.name = 'Ödeme yöntemi adı 50 karakterden uzun olamaz';
    }
    
    if (formData.description && formData.description.length > 200) {
      errors.description = 'Açıklama 200 karakterden uzun olamaz';
    }
    
    if (formData.sortOrder < 0) {
      errors.sortOrder = 'Sıralama negatif olamaz';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setSubmitting(true);
    try {
      const data = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        isDefault: formData.isDefault,
        sortOrder: parseInt(formData.sortOrder) || 0
      };
      
      if (editingMethod) {
        await paymentMethodsAPI.update(editingMethod._id, data);
        toast.success('Ödeme yöntemi başarıyla güncellendi');
      } else {
        await paymentMethodsAPI.create(data);
        toast.success('Ödeme yöntemi başarıyla oluşturuldu');
      }
      
      setShowModal(false);
      fetchPaymentMethods();
    } catch (error) {
      console.error('Submit payment method error:', error);
      toast.error(error.response?.data?.message || 'İşlem başarısız');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (method) => {
    if (!window.confirm(`"${method.name}" ödeme yöntemini silmek istediğinizden emin misiniz?`)) {
      return;
    }
    
    try {
      await paymentMethodsAPI.delete(method._id);
      toast.success('Ödeme yöntemi başarıyla silindi');
      fetchPaymentMethods();
    } catch (error) {
      console.error('Delete payment method error:', error);
      toast.error(error.response?.data?.message || 'Silme işlemi başarısız');
    }
  };

  const handleToggleStatus = async (method) => {
    try {
      await paymentMethodsAPI.toggleStatus(method._id);
      const status = method.isActive ? 'pasif' : 'aktif';
      toast.success(`Ödeme yöntemi ${status} yapıldı`);
      fetchPaymentMethods();
    } catch (error) {
      console.error('Toggle status error:', error);
      toast.error('Durum değiştirme işlemi başarısız');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingMethod(null);
    setFormErrors({});
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center p-5">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <div>
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h4 className="mb-1">
                <FiCreditCard className="me-2" />
                Ödeme Yöntemleri Yönetimi
              </h4>
              <p className="text-muted mb-0">
                Satışlarda kullanılacak ödeme yöntemlerini yönetin
              </p>
            </div>
            <Button variant="primary" onClick={handleAdd}>
              <FiPlus className="me-2" />
              Yeni Ödeme Yöntemi
            </Button>
          </div>
        </Col>
      </Row>

      <Row>
        <Col>
          <Card>
            <Card.Header>
              <div className="d-flex justify-content-between align-items-center">
                <h6 className="mb-0">Ödeme Yöntemleri Listesi</h6>
                <Form.Check
                  type="switch"
                  id="include-inactive"
                  label="Pasif olanları da göster"
                  checked={includeInactive}
                  onChange={(e) => setIncludeInactive(e.target.checked)}
                />
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              {paymentMethods.length === 0 ? (
                <div className="text-center p-4">
                  <FiCreditCard size={48} className="text-muted mb-3" />
                  <p className="text-muted">Henüz ödeme yöntemi eklenmemiş</p>
                  <Button variant="outline-primary" onClick={handleAdd}>
                    İlk Ödeme Yöntemini Ekle
                  </Button>
                </div>
              ) : (
                <Table responsive hover className="mb-0">
                  <thead>
                    <tr>
                      <th>Sıra</th>
                      <th>Ödeme Yöntemi</th>
                      <th>Açıklama</th>
                      <th>Durum</th>
                      <th>Varsayılan</th>
                      <th>Oluşturan</th>
                      <th>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.isArray(paymentMethods) && paymentMethods.length > 0 ? (
                      paymentMethods.map((method) => (
                      <tr key={method._id}>
                        <td>
                          <Badge bg="secondary">{method.sortOrder}</Badge>
                        </td>
                        <td>
                          <strong>{method.name}</strong>
                        </td>
                        <td>
                          <small className="text-muted">
                            {method.description || '-'}
                          </small>
                        </td>
                        <td>
                          <Badge bg={method.isActive ? 'success' : 'secondary'}>
                            {method.isActive ? 'Aktif' : 'Pasif'}
                          </Badge>
                        </td>
                        <td>
                          {method.isDefault && (
                            <Badge bg="primary">Varsayılan</Badge>
                          )}
                        </td>
                        <td>
                          <small className="text-muted">
                            {method.createdBy?.name || 'Sistem'}
                          </small>
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleEdit(method)}
                              title="Düzenle"
                            >
                              <FiEdit />
                            </Button>
                            <Button
                              variant={method.isActive ? "outline-warning" : "outline-success"}
                              size="sm"
                              onClick={() => handleToggleStatus(method)}
                              title={method.isActive ? "Pasif Yap" : "Aktif Yap"}
                            >
                              {method.isActive ? <FiToggleRight /> : <FiToggleLeft />}
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDelete(method)}
                              title="Sil"
                            >
                              <FiTrash2 />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="text-center text-muted">
                          Henüz ödeme yöntemi eklenmemiş
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Add/Edit Modal */}
      <Modal show={showModal} onHide={handleCloseModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {editingMethod ? 'Ödeme Yöntemi Düzenle' : 'Yeni Ödeme Yöntemi'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Row>
              <Col md={8}>
                <Form.Group className="mb-3">
                  <Form.Label>Ödeme Yöntemi Adı *</Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    isInvalid={!!formErrors.name}
                    placeholder="örn: Kredi Kartı"
                    maxLength={50}
                  />
                  <Form.Control.Feedback type="invalid">
                    {formErrors.name}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Sıralama</Form.Label>
                  <Form.Control
                    type="number"
                    name="sortOrder"
                    value={formData.sortOrder}
                    onChange={handleChange}
                    isInvalid={!!formErrors.sortOrder}
                    min="0"
                  />
                  <Form.Control.Feedback type="invalid">
                    {formErrors.sortOrder}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Açıklama</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="description"
                value={formData.description}
                onChange={handleChange}
                isInvalid={!!formErrors.description}
                placeholder="Ödeme yöntemi hakkında açıklama (opsiyonel)"
                maxLength={200}
              />
              <Form.Control.Feedback type="invalid">
                {formErrors.description}
              </Form.Control.Feedback>
              <Form.Text className="text-muted">
                {formData.description.length}/200 karakter
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                name="isDefault"
                label="Bu ödeme yöntemini varsayılan yap"
                checked={formData.isDefault}
                onChange={handleChange}
              />
              <Form.Text className="text-muted">
                Varsayılan ödeme yöntemi satış formunda otomatik seçilir
              </Form.Text>
            </Form.Group>

            {editingMethod && (
              <Alert variant="info">
                <small>
                  <strong>Son güncelleme:</strong> {' '}
                  {editingMethod.updatedAt 
                    ? new Date(editingMethod.updatedAt).toLocaleString('tr-TR')
                    : new Date(editingMethod.createdAt).toLocaleString('tr-TR')
                  }
                </small>
              </Alert>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={handleCloseModal}>
              <FiX className="me-2" />
              İptal
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              <FiSave className="me-2" />
              {submitting ? 'Kaydediliyor...' : (editingMethod ? 'Güncelle' : 'Oluştur')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default PaymentMethods;
