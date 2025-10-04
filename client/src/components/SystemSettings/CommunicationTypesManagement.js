import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Badge, 
  Modal, 
  Form, 
  Alert,
  Row,
  Col,
  InputGroup,
  Dropdown,
  ButtonGroup
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  FiPlus, 
  FiEdit, 
  FiTrash2, 
  FiEye, 
  FiEyeOff,
  FiSettings,
  FiGripVertical,
  FiSave,
  FiX,
  FiMessageCircle,
  FiPhone,
  FiUsers,
  FiMail
} from 'react-icons/fi';

import { communicationTypesAPI } from '../../utils/api';
import Loading from '../Common/Loading';

const CommunicationTypesManagement = () => {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    category: 'incoming',
    color: '#007bff',
    icon: 'FiMessageCircle',
    minValue: 0,
    maxValue: 0,
    isRequired: false,
    sortOrder: 0
  });
  const [formErrors, setFormErrors] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const categories = [
    { value: 'incoming', label: 'Gelen İletişim', icon: FiMail, color: '#28a745' },
    { value: 'outgoing', label: 'Giden İletişim', icon: FiPhone, color: '#007bff' },
    { value: 'meeting', label: 'Toplantı', icon: FiUsers, color: '#ffc107' },
    { value: 'other', label: 'Diğer', icon: FiSettings, color: '#6c757d' }
  ];

  const commonIcons = [
    'FiMessageCircle', 'FiPhone', 'FiUsers', 'FiMail', 'FiVideo',
    'FiCalendar', 'FiClock', 'FiMapPin', 'FiUser', 'FiUserCheck',
    'FiTrendingUp', 'FiTarget', 'FiAward', 'FiStar', 'FiHeart'
  ];

  const commonColors = [
    '#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1',
    '#20c997', '#fd7e14', '#e83e8c', '#6c757d', '#17a2b8'
  ];

  useEffect(() => {
    fetchTypes();
  }, []);

  const fetchTypes = async () => {
    try {
      setLoading(true);
      const response = await communicationTypesAPI.getAll({ active: 'true' });
      setTypes(response.data || []);
    } catch (error) {
      console.error('Fetch types error:', error);
      toast.error('İletişim türleri yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (type = null) => {
    if (type) {
      setFormData({
        name: type.name,
        code: type.code,
        description: type.description || '',
        category: type.category,
        color: type.color,
        icon: type.icon,
        minValue: type.minValue,
        maxValue: type.maxValue,
        isRequired: type.isRequired,
        sortOrder: type.sortOrder
      });
      setIsEditing(true);
      setSelectedType(type);
    } else {
      setFormData({
        name: '',
        code: '',
        description: '',
        category: 'incoming',
        color: '#007bff',
        icon: 'FiMessageCircle',
        minValue: 0,
        maxValue: 0,
        isRequired: false,
        sortOrder: 0
      });
      setIsEditing(false);
      setSelectedType(null);
    }
    setFormErrors({});
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedType(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      category: 'incoming',
      color: '#007bff',
      icon: 'FiMessageCircle',
      minValue: 0,
      maxValue: 0,
      isRequired: false,
      sortOrder: 0
    });
    setFormErrors({});
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Hata temizleme
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
      errors.name = 'İsim gerekli';
    }
    
    if (!formData.code.trim()) {
      errors.code = 'Kod gerekli';
    }
    
    if (formData.maxValue > 0 && formData.maxValue <= formData.minValue) {
      errors.maxValue = 'Maksimum değer minimum değerden büyük olmalıdır';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      if (isEditing) {
        await communicationTypesAPI.update(selectedType._id, formData);
        toast.success('İletişim türü başarıyla güncellendi');
      } else {
        await communicationTypesAPI.create(formData);
        toast.success('İletişim türü başarıyla oluşturuldu');
      }
      
      handleCloseModal();
      fetchTypes();
    } catch (error) {
      console.error('Save type error:', error);
      const message = error.response?.data?.message || 'İletişim türü kaydedilirken hata oluştu';
      toast.error(message);
    }
  };

  const handleDelete = async () => {
    try {
      await communicationTypesAPI.delete(selectedType._id);
      toast.success('İletişim türü başarıyla silindi');
      setShowDeleteModal(false);
      setSelectedType(null);
      fetchTypes();
    } catch (error) {
      console.error('Delete type error:', error);
      const message = error.response?.data?.message || 'İletişim türü silinirken hata oluştu';
      toast.error(message);
    }
  };

  const handleToggleActive = async (type) => {
    try {
      await communicationTypesAPI.toggle(type._id);
      toast.success(`İletişim türü ${type.isActive ? 'pasif' : 'aktif'} yapıldı`);
      fetchTypes();
    } catch (error) {
      console.error('Toggle type error:', error);
      toast.error('Durum değiştirilirken hata oluştu');
    }
  };

  const handleCreateDefaults = async () => {
    try {
      const response = await communicationTypesAPI.createDefaults();
      toast.success(response.data.message);
      fetchTypes();
    } catch (error) {
      console.error('Create defaults error:', error);
      const message = error.response?.data?.message || 'Varsayılan türler oluşturulurken hata oluştu';
      toast.error(message);
    }
  };

  const filteredTypes = types.filter(type => {
    const matchesCategory = filterCategory === 'all' || type.category === filterCategory;
    const matchesSearch = type.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         type.code.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryInfo = (category) => {
    return categories.find(cat => cat.value === category) || categories[0];
  };

  const getIconComponent = (iconName) => {
    const IconComponent = {
      FiMessageCircle, FiPhone, FiUsers, FiMail, FiVideo,
      FiCalendar, FiClock, FiMapPin, FiUser, FiUserCheck,
      FiTrendingUp, FiTarget, FiAward, FiStar, FiHeart
    }[iconName] || FiMessageCircle;
    
    return <IconComponent size={16} />;
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div>
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <FiSettings className="me-2" />
            İletişim Türleri Yönetimi
          </h5>
          <div className="d-flex gap-2">
            {types.length === 0 && (
              <Button 
                variant="outline-success" 
                onClick={handleCreateDefaults}
                size="sm"
              >
                <FiSettings className="me-1" />
                Varsayılan Türleri Oluştur
              </Button>
            )}
            <Button 
              variant="primary" 
              onClick={() => handleOpenModal()}
              size="sm"
            >
              <FiPlus className="me-1" />
              Yeni Tür
            </Button>
          </div>
        </Card.Header>
        
        <Card.Body>
          {/* Filtreler */}
          <Row className="mb-3">
            <Col md={6}>
              <InputGroup>
                <InputGroup.Text>
                  <FiSettings />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="İletişim türü ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col md={6}>
              <Dropdown>
                <Dropdown.Toggle variant="outline-secondary">
                  Kategori: {getCategoryInfo(filterCategory).label}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => setFilterCategory('all')}>
                    Tümü
                  </Dropdown.Item>
                  {categories.map(cat => (
                    <Dropdown.Item 
                      key={cat.value}
                      onClick={() => setFilterCategory(cat.value)}
                    >
                      <cat.icon className="me-2" style={{ color: cat.color }} />
                      {cat.label}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </Col>
          </Row>

          {/* Tablo */}
          <Table responsive hover>
            <thead>
              <tr>
                <th>Sıra</th>
                <th>İsim</th>
                <th>Kod</th>
                <th>Kategori</th>
                <th>İkon</th>
                <th>Renk</th>
                <th>Min/Max</th>
                <th>Zorunlu</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filteredTypes.map((type, index) => {
                const categoryInfo = getCategoryInfo(type.category);
                return (
                  <tr key={type._id}>
                    <td>
                      <Badge bg="secondary">{type.sortOrder}</Badge>
                    </td>
                    <td>
                      <div>
                        <strong>{type.name}</strong>
                        {type.description && (
                          <div className="text-muted small">{type.description}</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <code>{type.code}</code>
                    </td>
                    <td>
                      <Badge 
                        bg="light" 
                        text="dark"
                        style={{ border: `1px solid ${categoryInfo.color}` }}
                      >
                        <categoryInfo.icon className="me-1" size={12} />
                        {categoryInfo.label}
                      </Badge>
                    </td>
                    <td>
                      <div style={{ color: type.color }}>
                        {getIconComponent(type.icon)}
                      </div>
                    </td>
                    <td>
                      <div 
                        className="d-inline-block rounded" 
                        style={{ 
                          width: '20px', 
                          height: '20px', 
                          backgroundColor: type.color,
                          border: '1px solid #ccc'
                        }}
                      />
                    </td>
                    <td>
                      <small>
                        {type.minValue} - {type.maxValue || '∞'}
                      </small>
                    </td>
                    <td>
                      {type.isRequired ? (
                        <Badge bg="danger">Zorunlu</Badge>
                      ) : (
                        <Badge bg="secondary">Opsiyonel</Badge>
                      )}
                    </td>
                    <td>
                      <Badge bg={type.isActive ? 'success' : 'secondary'}>
                        {type.isActive ? 'Aktif' : 'Pasif'}
                      </Badge>
                    </td>
                    <td>
                      <ButtonGroup size="sm">
                        <Button 
                          variant="outline-primary"
                          onClick={() => handleOpenModal(type)}
                        >
                          <FiEdit />
                        </Button>
                        <Button 
                          variant={type.isActive ? 'outline-warning' : 'outline-success'}
                          onClick={() => handleToggleActive(type)}
                        >
                          {type.isActive ? <FiEyeOff /> : <FiEye />}
                        </Button>
                        <Button 
                          variant="outline-danger"
                          onClick={() => {
                            setSelectedType(type);
                            setShowDeleteModal(true);
                          }}
                        >
                          <FiTrash2 />
                        </Button>
                      </ButtonGroup>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          {filteredTypes.length === 0 && (
            <Alert variant="info" className="text-center">
              <FiMessageCircle className="me-2" />
              {searchTerm || filterCategory !== 'all' 
                ? 'Arama kriterlerinize uygun iletişim türü bulunamadı'
                : 'Henüz iletişim türü tanımlanmamış'
              }
            </Alert>
          )}
        </Card.Body>
      </Card>

      {/* Ekleme/Düzenleme Modal */}
      <Modal show={showModal} onHide={handleCloseModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {isEditing ? 'İletişim Türü Düzenle' : 'Yeni İletişim Türü'}
          </Modal.Title>
        </Modal.Header>
        
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>İsim *</Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    isInvalid={!!formErrors.name}
                    placeholder="Örn: WhatsApp Mesajı"
                  />
                  <Form.Control.Feedback type="invalid">
                    {formErrors.name}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Kod *</Form.Label>
                  <Form.Control
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={handleInputChange}
                    isInvalid={!!formErrors.code}
                    placeholder="Örn: WHATSAPP_MSG"
                    style={{ textTransform: 'uppercase' }}
                  />
                  <Form.Control.Feedback type="invalid">
                    {formErrors.code}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Açıklama</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="İletişim türü hakkında açıklama..."
              />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Kategori *</Form.Label>
                  <Form.Select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                  >
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>İkon</Form.Label>
                  <Form.Select
                    name="icon"
                    value={formData.icon}
                    onChange={handleInputChange}
                  >
                    {commonIcons.map(icon => (
                      <option key={icon} value={icon}>
                        {icon}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Renk</Form.Label>
                  <div className="d-flex gap-2">
                    <Form.Control
                      type="color"
                      name="color"
                      value={formData.color}
                      onChange={handleInputChange}
                      style={{ width: '60px' }}
                    />
                    <div className="d-flex flex-wrap gap-1">
                      {commonColors.map(color => (
                        <button
                          key={color}
                          type="button"
                          className="btn btn-sm"
                          style={{ 
                            width: '30px', 
                            height: '30px', 
                            backgroundColor: color,
                            border: formData.color === color ? '2px solid #000' : '1px solid #ccc'
                          }}
                          onClick={() => setFormData(prev => ({ ...prev, color }))}
                        />
                      ))}
                    </div>
                  </div>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Sıralama</Form.Label>
                  <Form.Control
                    type="number"
                    name="sortOrder"
                    value={formData.sortOrder}
                    onChange={handleInputChange}
                    min="0"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Minimum Değer</Form.Label>
                  <Form.Control
                    type="number"
                    name="minValue"
                    value={formData.minValue}
                    onChange={handleInputChange}
                    min="0"
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Maksimum Değer</Form.Label>
                  <Form.Control
                    type="number"
                    name="maxValue"
                    value={formData.maxValue}
                    onChange={handleInputChange}
                    min="0"
                    placeholder="0 = Sınırsız"
                  />
                  <Form.Control.Feedback type="invalid">
                    {formErrors.maxValue}
                  </Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    name="isRequired"
                    label="Zorunlu"
                    checked={formData.isRequired}
                    onChange={handleInputChange}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal}>
              <FiX className="me-1" />
              İptal
            </Button>
            <Button variant="primary" type="submit">
              <FiSave className="me-1" />
              {isEditing ? 'Güncelle' : 'Oluştur'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Silme Onay Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>İletişim Türünü Sil</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            <strong>{selectedType?.name}</strong> iletişim türünü silmek istediğinizden emin misiniz?
          </p>
          <Alert variant="warning">
            <FiSettings className="me-2" />
            Bu işlem geri alınamaz ve kullanımda olan türler silinemez.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            İptal
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            <FiTrash2 className="me-1" />
            Sil
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CommunicationTypesManagement;
