import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { validateEmail, validateRequired, validateMinLength } from '../../utils/helpers';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const { register, error, clearErrors } = useAuth();

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
      toast.success('Başarıyla kayıt oldunuz!');
    } else {
      toast.error(result.message);
    }
  };

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
    </Container>
  );
};

export default Register;
