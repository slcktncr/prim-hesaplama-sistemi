import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiCheckCircle, FiClock, FiUser } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import { validateEmail, validateRequired, validateMinLength } from '../../utils/helpers';
import DeveloperSignature from '../Common/DeveloperSignature';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [registrationData, setRegistrationData] = useState(null);

  const { register, error, clearErrors } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    clearErrors();
  }, [clearErrors]);

  const { name, email, password, confirmPassword } = formData;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Clear field error when user starts typing
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: null });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!validateRequired(name)) {
      newErrors.name = 'Ad soyad gereklidir';
    } else if (!validateMinLength(name, 2)) {
      newErrors.name = 'Ad soyad en az 2 karakter olmalıdır';
    }

    if (!validateRequired(email)) {
      newErrors.email = 'Email adresi gereklidir';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Geçerli bir email adresi giriniz';
    }

    if (!validateRequired(password)) {
      newErrors.password = 'Şifre gereklidir';
    } else if (!validateMinLength(password, 6)) {
      newErrors.password = 'Şifre en az 6 karakter olmalıdır';
    }

    if (!validateRequired(confirmPassword)) {
      newErrors.confirmPassword = 'Şifre tekrarı gereklidir';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Şifreler eşleşmiyor';
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
    const result = await register({ name, email, password });
    setLoading(false);

    if (result.success) {
      setRegistrationSuccess(true);
      setRegistrationData(result.data);
      
      // 5 saniye sonra login sayfasına yönlendir
      setTimeout(() => {
        navigate('/login');
      }, 5000);
    } else {
      toast.error(result.message);
    }
  };

  const handleGoToLogin = () => {
    navigate('/login');
  };

  // Başarılı kayıt sonrası görünüm
  if (registrationSuccess) {
    return (
      <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
        <Row className="w-100">
          <Col md={6} lg={5} className="mx-auto">
            <Card className="border-success">
              <Card.Body className="p-4 text-center">
                <div className="mb-4">
                  <FiCheckCircle size={64} className="text-success mb-3" />
                  <h2 className="text-success mb-3">Kayıt Başarılı!</h2>
                </div>

                <Alert variant="success" className="mb-4">
                  <div className="d-flex align-items-start">
                    <FiUser className="me-2 mt-1" size={18} />
                    <div className="text-start">
                      <strong>Merhaba {registrationData?.user?.name}!</strong>
                      <div className="mt-2">
                        Kayıt başvurunuz başarıyla alınmıştır.
                      </div>
                    </div>
                  </div>
                </Alert>

                <Alert variant="info" className="mb-4">
                  <div className="d-flex align-items-start">
                    <FiClock className="me-2 mt-1" size={18} />
                    <div className="text-start">
                      <strong>Onay Süreci</strong>
                      <div className="mt-2">
                        Hesabınız admin onayı beklemektedir. 
                        Onay süreci için lütfen sistem yöneticisi ile görüşünüz.
                      </div>
                      <div className="mt-2 small text-muted">
                        Onaylandıktan sonra email adresiniz ile sisteme giriş yapabileceksiniz.
                      </div>
                    </div>
                  </div>
                </Alert>

                <div className="mb-4">
                  <p className="text-muted mb-2">5 saniye sonra otomatik olarak giriş sayfasına yönlendirileceksiniz.</p>
                  <Button 
                    variant="primary" 
                    onClick={handleGoToLogin}
                    className="me-2"
                  >
                    Hemen Giriş Sayfasına Git
                  </Button>
                </div>

                <div className="text-center">
                  <small className="text-muted">
                    Email: <strong>{registrationData?.user?.email}</strong>
                  </small>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
        <DeveloperSignature />
      </Container>
    );
  }

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <Row className="w-100">
        <Col md={6} lg={5} className="mx-auto">
          <Card>
            <Card.Body className="p-4">
              <div className="text-center mb-4">
                {/* MOLA Logo */}
                <div className="logo-container mb-3">
                  <div className="logo-image mx-auto">
                    <img 
                      src="/mola-logo.png" 
                      alt="MOLA Logo" 
                      className="logo-img"
                      style={{ width: '80px', height: '80px', objectFit: 'contain' }}
                      onError={(e) => {
                        // Logo bulunamazsa placeholder göster
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div 
                      className="logo-placeholder-modern" 
                      style={{ 
                        display: 'none',
                        width: '80px', 
                        height: '80px',
                        background: 'linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)',
                        borderRadius: '16px',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto'
                      }}
                    >
                      <span style={{ 
                        color: 'white', 
                        fontWeight: '900', 
                        fontSize: '1.5rem', 
                        letterSpacing: '2px',
                        textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)' 
                      }}>
                        MOLA
                      </span>
                    </div>
                  </div>
                </div>
                <h2>Kayıt Ol</h2>
                <p className="text-muted">Prim Hesaplama Sistemi</p>
              </div>

              {error && (
                <Alert variant="danger" className="mb-3">
                  {error}
                </Alert>
              )}

              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Ad Soyad</Form.Label>
                  <Form.Control
                    type="text"
                    name="name"
                    value={name}
                    onChange={handleChange}
                    isInvalid={!!errors.name}
                    placeholder="Ad soyadınızı giriniz"
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.name}
                  </Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Email Adresi</Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    value={email}
                    onChange={handleChange}
                    isInvalid={!!errors.email}
                    placeholder="email@example.com"
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.email}
                  </Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Şifre</Form.Label>
                  <Form.Control
                    type="password"
                    name="password"
                    value={password}
                    onChange={handleChange}
                    isInvalid={!!errors.password}
                    placeholder="En az 6 karakter"
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.password}
                  </Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Şifre Tekrarı</Form.Label>
                  <Form.Control
                    type="password"
                    name="confirmPassword"
                    value={confirmPassword}
                    onChange={handleChange}
                    isInvalid={!!errors.confirmPassword}
                    placeholder="Şifrenizi tekrar giriniz"
                  />
                  <Form.Control.Feedback type="invalid">
                    {errors.confirmPassword}
                  </Form.Control.Feedback>
                </Form.Group>

                <Alert variant="info" className="mb-4">
                  <strong>Not:</strong> Kayıt olduktan sonra hesabınız admin onayı bekleyecektir. 
                  Onaylandıktan sonra sisteme giriş yapabileceksiniz.
                </Alert>

                <Button
                  variant="primary"
                  type="submit"
                  className="w-100 mb-3"
                  disabled={loading}
                >
                  {loading ? 'Kayıt yapılıyor...' : 'Kayıt Ol'}
                </Button>
              </Form>

              <div className="text-center">
                <p className="mb-0">
                  Zaten hesabınız var mı?{' '}
                  <Link to="/login" className="text-decoration-none">
                    Giriş Yap
                  </Link>
                </p>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      {/* Developer Signature */}
      <DeveloperSignature />
    </Container>
  );
};

export default Register;
