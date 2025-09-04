import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Table, 
  Button, 
  Form, 
  Modal,
  Badge,
  Alert
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  FiPlus, 
  FiEdit, 
  FiTrash2,
  FiCheck,
  FiX
} from 'react-icons/fi';

import { systemSettingsAPI } from '../../utils/api';
import { formatDateTime } from '../../utils/helpers';
import Loading from '../Common/Loading';

const SaleTypesManagement = () => {
  const [saleTypes, setSaleTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isDefault: false,
    isActive: true
  });

  useEffect(() => {
    fetchSaleTypes();
  }, []);

  const fetchSaleTypes = async () => {
    try {
      setLoading(true);
      const response = await systemSettingsAPI.getSaleTypes();
      setSaleTypes(response.data || []);
      setError(null);
    } catch (error) {
      console.error('Fetch sale types error:', error);
      setError('Satış türleri yüklenirken hata oluştu');
      toast.error('Satış türleri yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingItem) {
        await systemSettingsAPI.updateSaleType(editingItem._id, formData);
        toast.success('Satış türü başarıyla güncellendi');
      } else {
        await systemSettingsAPI.createSaleType(formData);
        toast.success('Satış türü başarıyla oluşturuldu');
      }
      
      fetchSaleTypes();
      handleCloseModal();
    } catch (error) {
      console.error('Submit error:', error);
      toast.error(error.response?.data?.message || 'İşlem sırasında hata oluştu');
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      isDefault: item.isDefault,
      isActive: item.isActive
    });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deletingItem) return;

    try {
      await systemSettingsAPI.deleteSaleType(deletingItem._id);
      toast.success('Satış türü başarıyla silindi');
      fetchSaleTypes();
      setShowDeleteModal(false);
      setDeletingItem(null);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.message || 'Silme işlemi sırasında hata oluştu');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData({
      name: '',
      description: '',
      isDefault: false,
      isActive: true
    });
  };

  const openDeleteModal = (item) => {
    setDeletingItem(item);
    setShowDeleteModal(true);
  };

  if (loading) {
    return <Loading text="Satış türleri yükleniyor..." />;
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="mb-1">Satış Türleri</h4>
          <p className="text-muted mb-0">Sistem genelinde kullanılacak satış türlerini yönetin</p>
        </div>
        <Button variant="primary" onClick={() => setShowModal(true)}>
          <FiPlus className="me-2" />
          Yeni Satış Türü
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Table */}
      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Adı</th>
            <th>Açıklama</th>
            <th>Durum</th>
            <th>Varsayılan</th>
            <th>Oluşturan</th>
            <th>Oluşturma Tarihi</th>
            <th>İşlemler</th>
          </tr>
        </thead>
        <tbody>
          {saleTypes.length === 0 ? (
            <tr>
              <td colSpan="7" className="text-center text-muted">
                Henüz satış türü eklenmemiş
              </td>
            </tr>
          ) : (
            saleTypes.map((item) => (
              <tr key={item._id}>
                <td>
                  <strong>{item.name}</strong>
                </td>
                <td>{item.description || '-'}</td>
                <td>
                  <Badge bg={item.isActive ? 'success' : 'secondary'}>
                    {item.isActive ? 'Aktif' : 'Pasif'}
                  </Badge>
                </td>
                <td>
                  {item.isDefault ? (
                    <Badge bg="primary">Varsayılan</Badge>
                  ) : (
                    '-'
                  )}
                </td>
                <td>{item.createdBy?.name || 'Bilinmeyen'}</td>
                <td>{formatDateTime(item.createdAt)}</td>
                <td>
                  <div className="d-flex gap-2">
                    <Button
                      variant="outline-primary"
                      size="sm"
                      onClick={() => handleEdit(item)}
                    >
                      <FiEdit />
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => openDeleteModal(item)}
                      disabled={item.isDefault}
                    >
                      <FiTrash2 />
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </Table>

      {/* Create/Edit Modal */}
      <Modal show={showModal} onHide={handleCloseModal} size="lg">
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title>
              {editingItem ? 'Satış Türünü Düzenle' : 'Yeni Satış Türü Ekle'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Adı *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                    maxLength={50}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Açıklama</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    maxLength={200}
                  />
                </Form.Group>
              </Col>
            </Row>
            
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label="Aktif"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label="Varsayılan olarak ayarla"
                    checked={formData.isDefault}
                    onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                  />
                  <Form.Text className="text-muted">
                    Varsayılan satış türü yeni satışlarda otomatik seçilir
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              <FiX className="me-2" />
              İptal
            </Button>
            <Button variant="primary" type="submit">
              <FiCheck className="me-2" />
              {editingItem ? 'Güncelle' : 'Oluştur'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Satış Türünü Sil</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            <strong>{deletingItem?.name}</strong> satış türünü silmek istediğinizden emin misiniz?
          </p>
          <p className="text-muted">Bu işlem geri alınamaz.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            İptal
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Sil
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default SaleTypesManagement;
