import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Row, 
  Col, 
  Card, 
  Button, 
  Table, 
  Badge, 
  Alert, 
  Modal, 
  Form, 
  Spinner,
  Accordion,
  OverlayTrigger,
  Tooltip
} from 'react-bootstrap';
import { 
  FaPlus, 
  FaEdit, 
  FaTrash, 
  FaUsers, 
  FaShieldAlt, 
  FaToggleOn, 
  FaToggleOff,
  FaInfoCircle,
  FaSave,
  FaTimes
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { rolesAPI } from '../../utils/api';
import { formatDate } from '../../utils/helpers';

const RoleManagement = () => {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    permissions: {}
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await rolesAPI.getAllRoles();
      setRoles(response.data || []);
    } catch (error) {
      console.error('Roles fetch error:', error);
      setError('Roller yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await rolesAPI.getPermissionsList();
      setPermissions(response.data || {});
    } catch (error) {
      console.error('Permissions fetch error:', error);
    }
  };

  const handleCreateRole = () => {
    setEditingRole(null);
    setFormData({
      name: '',
      displayName: '',
      description: '',
      permissions: getDefaultPermissions()
    });
    setShowModal(true);
  };

  const handleEditRole = (role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      displayName: role.displayName,
      description: role.description || '',
      permissions: role.permissions || getDefaultPermissions()
    });
    setShowModal(true);
  };

  const getDefaultPermissions = () => {
    const defaultPerms = {};
    Object.keys(permissions).forEach(category => {
      Object.keys(permissions[category].permissions).forEach(perm => {
        defaultPerms[perm] = false;
      });
    });
    return defaultPerms;
  };

  const handleSaveRole = async () => {
    try {
      setSaving(true);
      setError('');

      if (!formData.displayName.trim()) {
        setError('Rol adı gereklidir');
        return;
      }

      const roleData = {
        name: formData.name || formData.displayName.toLowerCase().replace(/\s+/g, '_'),
        displayName: formData.displayName.trim(),
        description: formData.description.trim(),
        permissions: formData.permissions
      };

      if (editingRole) {
        await rolesAPI.updateRole(editingRole._id, roleData);
        toast.success('Rol başarıyla güncellendi');
      } else {
        await rolesAPI.createRole(roleData);
        toast.success('Rol başarıyla oluşturuldu');
      }

      setShowModal(false);
      fetchRoles();
    } catch (error) {
      console.error('Save role error:', error);
      setError(error.response?.data?.message || 'Rol kaydedilirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (role) => {
    if (!window.confirm(`"${role.displayName}" rolünü silmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      await rolesAPI.deleteRole(role._id);
      toast.success('Rol başarıyla silindi');
      fetchRoles();
    } catch (error) {
      console.error('Delete role error:', error);
      toast.error(error.response?.data?.message || 'Rol silinirken hata oluştu');
    }
  };

  const handleToggleStatus = async (role) => {
    try {
      await rolesAPI.toggleRoleStatus(role._id);
      toast.success(`Rol ${role.isActive ? 'pasif' : 'aktif'} hale getirildi`);
      fetchRoles();
    } catch (error) {
      console.error('Toggle role status error:', error);
      toast.error('Rol durumu değiştirilirken hata oluştu');
    }
  };

  const handlePermissionChange = (permissionKey, value) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permissionKey]: value
      }
    }));
  };

  const getPermissionCount = (rolePermissions) => {
    return Object.values(rolePermissions || {}).filter(Boolean).length;
  };

  if (loading) {
    return (
      <Container fluid className="py-4">
        <div className="text-center">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Yükleniyor...</span>
          </Spinner>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4">
      <Row>
        <Col>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h2 className="mb-1">
                <FaShieldAlt className="me-2 text-primary" />
                Rol Yönetimi
              </h2>
              <p className="text-muted mb-0">Kullanıcı rollerini ve yetkilerini yönetin</p>
            </div>
            <Button variant="primary" onClick={handleCreateRole}>
              <FaPlus className="me-2" />
              Yeni Rol Oluştur
            </Button>
          </div>

          {error && (
            <Alert variant="danger" dismissible onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Card>
            <Card.Header>
              <h5 className="mb-0">
                <FaUsers className="me-2" />
                Mevcut Roller ({roles.length})
              </h5>
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive hover className="mb-0">
                <thead className="bg-light">
                  <tr>
                    <th>Rol Adı</th>
                    <th>Açıklama</th>
                    <th>Yetkiler</th>
                    <th>Durum</th>
                    <th>Oluşturan</th>
                    <th>Oluşturma Tarihi</th>
                    <th>İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map(role => (
                    <tr key={role._id}>
                      <td>
                        <div className="d-flex align-items-center">
                          <FaShieldAlt className={`me-2 ${role.isSystemRole ? 'text-danger' : 'text-primary'}`} />
                          <div>
                            <div className="fw-bold">{role.displayName}</div>
                            <small className="text-muted">{role.name}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="text-truncate" style={{ maxWidth: '200px' }}>
                          {role.description || '-'}
                        </div>
                      </td>
                      <td>
                        <Badge bg="info">
                          {getPermissionCount(role.permissions)} yetki
                        </Badge>
                      </td>
                      <td>
                        <Badge bg={role.isActive ? 'success' : 'secondary'}>
                          {role.isActive ? 'Aktif' : 'Pasif'}
                        </Badge>
                        {role.name === 'admin' && (
                          <Badge bg="warning" className="ms-1">Sistem</Badge>
                        )}
                      </td>
                      <td>
                        <small>{role.createdBy?.name || '-'}</small>
                      </td>
                      <td>
                        <small>{formatDate(role.createdAt)}</small>
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip>Düzenle</Tooltip>}
                          >
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleEditRole(role)}
                              disabled={role.name === 'admin'}
                            >
                              <FaEdit />
                            </Button>
                          </OverlayTrigger>
                          
                          <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip>{role.isActive ? 'Pasif Yap' : 'Aktif Yap'}</Tooltip>}
                          >
                            <Button
                              variant={role.isActive ? 'outline-warning' : 'outline-success'}
                              size="sm"
                              onClick={() => handleToggleStatus(role)}
                              disabled={role.isSystemRole}
                            >
                              {role.isActive ? <FaToggleOn /> : <FaToggleOff />}
                            </Button>
                          </OverlayTrigger>

                          <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip>Sil</Tooltip>}
                          >
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDeleteRole(role)}
                              disabled={role.name === 'admin'}
                            >
                              <FaTrash />
                            </Button>
                          </OverlayTrigger>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Rol Oluştur/Düzenle Modal */}
      <Modal show={showModal} onHide={() => !saving && setShowModal(false)} size="lg" backdrop="static">
        <Modal.Header closeButton={!saving}>
          <Modal.Title>
            <FaShieldAlt className="me-2" />
            {editingRole ? 'Rol Düzenle' : 'Yeni Rol Oluştur'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && (
            <Alert variant="danger" dismissible onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Rol Adı *</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.displayName}
                    onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                    placeholder="Örn: Satış Müdürü"
                    disabled={saving}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Sistem Adı</Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.name || formData.displayName.toLowerCase().replace(/\s+/g, '_')}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Otomatik oluşturulur"
                    disabled={editingRole || saving}
                  />
                  <Form.Text className="text-muted">
                    Sistem tarafından otomatik oluşturulur
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-4">
              <Form.Label>Açıklama</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Bu rolün ne için kullanıldığını açıklayın..."
                disabled={saving}
              />
            </Form.Group>

            <div className="mb-3">
              <h6>
                <FaInfoCircle className="me-2 text-info" />
                Yetkiler
              </h6>
              <p className="text-muted small mb-3">
                Bu role sahip kullanıcıların erişebileceği özellikleri seçin
              </p>

              <Accordion>
                {Object.entries(permissions).map(([categoryKey, category]) => (
                  <Accordion.Item eventKey={categoryKey} key={categoryKey}>
                    <Accordion.Header>
                      <div className="d-flex justify-content-between align-items-center w-100 me-3">
                        <span>{category.name}</span>
                        <Badge bg="secondary">
                          {Object.keys(category.permissions).filter(perm => 
                            formData.permissions[perm]
                          ).length} / {Object.keys(category.permissions).length}
                        </Badge>
                      </div>
                    </Accordion.Header>
                    <Accordion.Body>
                      <Row>
                        {Object.entries(category.permissions).map(([permKey, permLabel]) => (
                          <Col md={6} key={permKey} className="mb-2">
                            <Form.Check
                              type="checkbox"
                              id={permKey}
                              label={permLabel}
                              checked={formData.permissions[permKey] || false}
                              onChange={(e) => handlePermissionChange(permKey, e.target.checked)}
                              disabled={saving}
                            />
                          </Col>
                        ))}
                      </Row>
                    </Accordion.Body>
                  </Accordion.Item>
                ))}
              </Accordion>
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => setShowModal(false)}
            disabled={saving}
          >
            <FaTimes className="me-2" />
            İptal
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSaveRole}
            disabled={saving || !formData.displayName.trim()}
          >
            {saving ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" className="me-2" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <FaSave className="me-2" />
                {editingRole ? 'Güncelle' : 'Oluştur'}
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default RoleManagement;
