import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Form, 
  Button, 
  Alert,
  Table,
  Badge,
  Modal
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  FiSettings, 
  FiSave,
  FiClock,
  FiPercent,
  FiUser,
  FiCalendar
} from 'react-icons/fi';

import { primsAPI } from '../../utils/api';
import { 
  formatPercentage, 
  formatDateTime,
  validateRequired,
  validatePositiveNumber
} from '../../utils/helpers';
import Loading from '../Common/Loading';

const PrimSettings = () => {
  const [currentRate, setCurrentRate] = useState(null);
  const [rateHistory, setRateHistory] = useState([]);
  const [newRate, setNewRate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    fetchCurrentRate();
    fetchRateHistory();
  }, []);

  const fetchCurrentRate = async () => {
    try {
      const response = await primsAPI.getRate();
      console.log('📊 Frontend prim oranı alımı:');
      console.log('response.data.rate:', response.data.rate);
      console.log('typeof response.data.rate:', typeof response.data.rate);
      
      setCurrentRate(response.data);
      setNewRate(response.data.rate.toString());
    } catch (error) {
      console.error('Current rate fetch error:', error);
      setError('Aktif prim oranı yüklenirken hata oluştu');
    }
  };

  const fetchRateHistory = async () => {
    try {
      // Backend'de rate history endpoint'i yok, simüle edelim
      setRateHistory([]);
      setLoading(false);
    } catch (error) {
      console.error('Rate history fetch error:', error);
      setLoading(false);
    }
  };

  const handleRateChange = (e) => {
    const value = e.target.value;
    if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 100)) {
      setNewRate(value);
    }
  };

  const validateRate = () => {
    if (!validateRequired(newRate)) {
      toast.error('Prim oranı gereklidir');
      return false;
    }

    const rate = parseFloat(newRate);
    if (!validatePositiveNumber(newRate) || rate > 100) {
      toast.error('Prim oranı 0 ile 100 arasında olmalıdır');
      return false;
    }

    if (currentRate && Math.abs(rate - (currentRate.rate * 100)) < 0.01) {
      toast.error('Yeni oran mevcut orandan farklı olmalıdır');
      return false;
    }

    return true;
  };

  const handleSaveRate = async () => {
    if (!validateRate()) {
      return;
    }

    setSaving(true);
    try {
      const ratePercent = parseFloat(newRate);
      console.log('🔍 Frontend prim oranı gönderimi:');
      console.log('newRate (girilen):', newRate);
      console.log('ratePercent (gönderilen):', ratePercent);
      console.log('typeof ratePercent:', typeof ratePercent);
      
      await primsAPI.updateRate(ratePercent);
      
      toast.success('Prim oranı başarıyla güncellendi');
      await fetchCurrentRate();
      await fetchRateHistory();
      setShowConfirmModal(false);
    } catch (error) {
      console.error('Update rate error:', error);
      toast.error(error.response?.data?.message || 'Prim oranı güncellenirken hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const openConfirmModal = () => {
    if (validateRate()) {
      setShowConfirmModal(true);
    }
  };

  if (loading) {
    return <Loading text="Prim ayarları yükleniyor..." />;
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>
            <FiSettings className="me-2" />
            Prim Ayarları
          </h1>
          <p className="text-muted mb-0">
            Sistemdeki prim oranını yönetin
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      <Row>
        <Col lg={6}>
          {/* Current Rate Card */}
          <Card className="mb-4">
            <Card.Header>
              <div className="d-flex align-items-center">
                <FiPercent className="me-2" />
                <h5 className="mb-0">Aktif Prim Oranı</h5>
              </div>
            </Card.Header>
            <Card.Body>
              {currentRate ? (
                <div>
                  <div className="text-center mb-4">
                    <div className="display-4 text-primary mb-2">
                      %{currentRate.rate.toFixed(2)}
                    </div>
                    <Badge bg="success" className="mb-3">Aktif</Badge>
                    <div className="small text-muted">
                      <FiCalendar className="me-1" />
                      Geçerlilik Tarihi: {formatDateTime(currentRate.effectiveDate)}
                    </div>
                    <div className="small text-muted">
                      <FiUser className="me-1" />
                      Oluşturan: {currentRate.createdBy?.name}
                    </div>
                  </div>
                  
                  <Alert variant="info" className="small">
                    <strong>Bilgi:</strong> Prim, liste fiyatı ve aktivite satış fiyatından 
                    düşük olanın %{currentRate.rate.toFixed(2)}'i üzerinden hesaplanır.
                  </Alert>
                </div>
              ) : (
                <Alert variant="warning">
                  Aktif prim oranı bulunamadı
                </Alert>
              )}
            </Card.Body>
          </Card>

          {/* Update Rate Form */}
          <Card>
            <Card.Header>
              <h5 className="mb-0">Prim Oranını Güncelle</h5>
            </Card.Header>
            <Card.Body>
              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>Yeni Prim Oranı (%)</Form.Label>
                  <div className="input-group">
                    <Form.Control
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={newRate}
                      onChange={handleRateChange}
                      placeholder="1.00"
                    />
                    <span className="input-group-text">%</span>
                  </div>
                  <Form.Text className="text-muted">
                    Örnek: 1.50 = %1.50 prim oranı
                  </Form.Text>
                </Form.Group>

                {newRate && !isNaN(parseFloat(newRate)) && (
                  <Alert variant="info" className="mb-3">
                    <strong>Önizleme:</strong> 100.000₺'lik bir satışta prim tutarı: {' '}
                    <strong>{(100000 * (parseFloat(newRate) / 100)).toLocaleString('tr-TR', { 
                      style: 'currency', 
                      currency: 'TRY' 
                    })}</strong>
                  </Alert>
                )}

                <Alert variant="warning" className="mb-3">
                  <strong>Dikkat:</strong>
                  <ul className="mb-0 mt-2">
                    <li>Prim oranı değişikliği sadece yeni satışları etkiler</li>
                    <li>Mevcut satışların prim hesaplamaları değişmez</li>
                    <li>Bu işlem geri alınamaz</li>
                  </ul>
                </Alert>

                <div className="d-flex gap-2">
                  <Button 
                    variant="primary" 
                    onClick={openConfirmModal}
                    disabled={saving || !newRate || parseFloat(newRate) === (currentRate?.rate * 100)}
                  >
                    <FiSave className="me-2" />
                    Oranı Güncelle
                  </Button>
                  <Button 
                    variant="outline-secondary"
                    onClick={() => setNewRate(currentRate ? (currentRate.rate * 100).toString() : '')}
                  >
                    Sıfırla
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6}>
          {/* Rate History */}
          <Card>
            <Card.Header>
              <div className="d-flex align-items-center">
                <FiClock className="me-2" />
                <h5 className="mb-0">Prim Oranı Geçmişi</h5>
              </div>
            </Card.Header>
            <Card.Body>
              {rateHistory.length === 0 ? (
                <div className="text-center py-4">
                  <FiClock size={48} className="text-muted mb-3" />
                  <p className="text-muted">Henüz prim oranı geçmişi bulunmuyor.</p>
                  <p className="text-muted small">
                    İlk prim oranı güncellemesinden sonra geçmiş burada görünecektir.
                  </p>
                </div>
              ) : (
                <Table responsive size="sm">
                  <thead>
                    <tr>
                      <th>Oran</th>
                      <th>Geçerlilik</th>
                      <th>Oluşturan</th>
                      <th>Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rateHistory.map((rate) => (
                      <tr key={rate._id}>
                        <td>
                          <strong>{formatPercentage(rate.rate)}</strong>
                        </td>
                        <td>
                          <small>{formatDateTime(rate.effectiveDate)}</small>
                        </td>
                        <td>
                          <small>{rate.createdBy?.name}</small>
                        </td>
                        <td>
                          <Badge bg={rate.isActive ? 'success' : 'secondary'}>
                            {rate.isActive ? 'Aktif' : 'Pasif'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>

          {/* Info Card */}
          <Card className="mt-4">
            <Card.Header>
              <h6 className="mb-0">Prim Hesaplama Bilgileri</h6>
            </Card.Header>
            <Card.Body>
              <div className="small">
                <h6>Prim Nasıl Hesaplanır?</h6>
                <ol>
                  <li>Liste fiyatı ve aktivite satış fiyatı karşılaştırılır</li>
                  <li>İkisinden düşük olan seçilir (prim hesaplama tabanı)</li>
                  <li>Bu tutar prim oranı ile çarpılır</li>
                  <li>Sonuç temsilcinin prim tutarıdır</li>
                </ol>
                
                <h6 className="mt-3">Örnek Hesaplama:</h6>
                <ul>
                  <li>Liste Fiyatı: 150.000₺</li>
                  <li>Aktivite Fiyatı: 140.000₺</li>
                  <li>Prim Tabanı: 140.000₺ (düşük olan)</li>
                  <li>Prim Oranı: %{currentRate ? (currentRate.rate * 100).toFixed(2) : '1.00'}</li>
                  <li><strong>Prim Tutarı: {currentRate ? (140000 * currentRate.rate).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }) : '1.400₺'}</strong></li>
                </ul>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Confirmation Modal */}
      <Modal show={showConfirmModal} onHide={() => setShowConfirmModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Prim Oranını Güncelle</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="warning">
            <strong>Dikkat!</strong> Prim oranını güncellemek üzeresiniz.
          </Alert>
          
          <div className="mb-3">
            <div className="row">
              <div className="col-6">
                <strong>Mevcut Oran:</strong>
                <div className="h4 text-muted">
                  %{currentRate ? currentRate.rate.toFixed(2) : '0.00'}
                </div>
              </div>
              <div className="col-6">
                <strong>Yeni Oran:</strong>
                <div className="h4 text-primary">
                  %{parseFloat(newRate).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <p>Bu değişiklik:</p>
          <ul>
            <li>Sadece yeni satışları etkileyecek</li>
            <li>Mevcut satışların prim hesaplamalarını değiştirmeyecek</li>
            <li>Geri alınamaz</li>
          </ul>

          <p><strong>Devam etmek istediğinizden emin misiniz?</strong></p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
            İptal
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSaveRate}
            disabled={saving}
          >
            {saving ? 'Güncelleniyor...' : 'Evet, Güncelle'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default PrimSettings;
