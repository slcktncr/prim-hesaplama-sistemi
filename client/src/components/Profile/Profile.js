import React, { useState } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Form, 
  Button,
  Alert,
  Badge
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { FiUser, FiMail, FiShield, FiSave, FiEdit } from 'react-icons/fi';

import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../utils/api';
import Loading from '../Common/Loading';

const Profile = () => {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      
      const updateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email
      };

      // Şifre değişikliği varsa ekle
      if (formData.newPassword) {
        if (formData.newPassword !== formData.confirmPassword) {
          toast.error('Yeni şifreler eşleşmiyor');
          return;
        }
        if (formData.newPassword.length < 6) {
          toast.error('Şifre en az 6 karakter olmalıdır');
          return;
        }
        updateData.currentPassword = formData.currentPassword;
        updateData.newPassword = formData.newPassword;
      }

      // API çağrısı (bu endpoint'i backend'de oluşturmamız gerekecek)
      const response = await authAPI.updateProfile(updateData);
      
      setUser(response.data.user);
      setEditing(false);
      toast.success('Profil başarıyla güncellendi');
      
      // Şifre alanlarını temizle
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
      
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error(error.response?.data?.message || 'Profil güncellenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setFormData({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setEditing(false);
  };

  if (loading && !editing) {
    return <Loading text="Profil bilgileri yükleniyor..." />;
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>Profil Ayarları</h1>
          <p className="text-muted mb-0">
            Kişisel bilgilerinizi ve hesap ayarlarınızı yönetin
          </p>
        </div>
      </div>

      <Row>
        <Col lg={8}>
          {/* Profil Bilgileri */}
          <Card className="mb-4">
            <Card.Header>
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <FiUser className="me-2" />
                  Kişisel Bilgiler
                </h5>
                {!editing && (
                  <Button variant="outline-primary" size="sm" onClick={() => setEditing(true)}>
                    <FiEdit className="me-1" />
                    Düzenle
                  </Button>
                )}
              </div>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Ad</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange('firstName', e.target.value)}
                      disabled={!editing}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Soyad</Form.Label>
                    <Form.Control
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange('lastName', e.target.value)}
                      disabled={!editing}
                    />
                  </Form.Group>
                </Col>
                <Col md={12}>
                  <Form.Group className="mb-3">
                    <Form.Label>E-posta</Form.Label>
                    <Form.Control
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      disabled={!editing}
                    />
                  </Form.Group>
                </Col>
              </Row>

              {editing && (
                <>
                  <hr />
                  <h6>Şifre Değiştir (İsteğe Bağlı)</h6>
                  <Row>
                    <Col md={12}>
                      <Form.Group className="mb-3">
                        <Form.Label>Mevcut Şifre</Form.Label>
                        <Form.Control
                          type="password"
                          value={formData.currentPassword}
                          onChange={(e) => handleInputChange('currentPassword', e.target.value)}
                          placeholder="Şifre değiştirmek istiyorsanız mevcut şifrenizi girin"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Yeni Şifre</Form.Label>
                        <Form.Control
                          type="password"
                          value={formData.newPassword}
                          onChange={(e) => handleInputChange('newPassword', e.target.value)}
                          placeholder="En az 6 karakter"
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group className="mb-3">
                        <Form.Label>Yeni Şifre (Tekrar)</Form.Label>
                        <Form.Control
                          type="password"
                          value={formData.confirmPassword}
                          onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                          placeholder="Yeni şifreyi tekrar girin"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <div className="d-flex gap-2">
                    <Button 
                      variant="primary" 
                      onClick={handleSaveProfile}
                      disabled={loading}
                    >
                      <FiSave className="me-1" />
                      {loading ? 'Kaydediliyor...' : 'Kaydet'}
                    </Button>
                    <Button variant="secondary" onClick={handleCancelEdit}>
                      İptal
                    </Button>
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={4}>
          {/* Hesap Bilgileri */}
          <Card className="mb-4">
            <Card.Header>
              <h5 className="mb-0">
                <FiShield className="me-2" />
                Hesap Bilgileri
              </h5>
            </Card.Header>
            <Card.Body>
              <div className="mb-3">
                <strong>Rol:</strong>
                <div className="mt-1">
                  <Badge bg={
                    user?.systemRole === 'admin' ? 'danger' : 
                    user?.role ? 'success' : 'secondary'
                  }>
                    {user?.systemRole === 'admin' ? 'Sistem Yöneticisi' : 
                     user?.role ? user.role.displayName || user.role.name :
                     'Rol Atanmamış'}
                  </Badge>
                </div>
              </div>
              
              <div className="mb-3">
                <strong>Hesap Durumu:</strong>
                <div className="mt-1">
                  <Badge bg={user?.isActive ? 'success' : 'secondary'}>
                    {user?.isActive ? 'Aktif' : 'Pasif'}
                  </Badge>
                </div>
              </div>

              <div className="mb-3">
                <strong>Onay Durumu:</strong>
                <div className="mt-1">
                  <Badge bg={user?.isApproved ? 'success' : 'warning'}>
                    {user?.isApproved ? 'Onaylanmış' : 'Onay Bekliyor'}
                  </Badge>
                </div>
              </div>

              <div className="mb-0">
                <strong>Kayıt Tarihi:</strong>
                <div className="text-muted small">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('tr-TR') : 'Bilinmiyor'}
                </div>
              </div>
            </Card.Body>
          </Card>

          {/* Güvenlik Uyarısı */}
          <Alert variant="info">
            <strong>Güvenlik:</strong> Şifrenizi düzenli olarak değiştirin ve başkalarıyla paylaşmayın.
          </Alert>
        </Col>
      </Row>
    </div>
  );
};

export default Profile;
