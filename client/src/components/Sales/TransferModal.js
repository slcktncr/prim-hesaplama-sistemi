import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Row, Col, Badge } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { salesAPI, primsAPI } from '../../utils/api';
import API from '../../utils/api';

const TransferModal = ({ show, onHide, sale, onSuccess }) => {
  const [users, setUsers] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [changePeriod, setChangePeriod] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (show) {
      fetchUsers();
      fetchPeriods();
      setSelectedUser('');
      setSelectedPeriod('');
      setChangePeriod(false);
      setError(null);
    }
  }, [show]);

  const fetchUsers = async () => {
    try {
      const response = await API.get('/users/salespeople');
      setUsers(response.data || []);
    } catch (error) {
      console.error('Users fetch error:', error);
      setError('Kullanıcılar yüklenirken hata oluştu');
    }
  };

  const fetchPeriods = async () => {
    try {
      const response = await primsAPI.getPeriods();
      setPeriods(response.data || []);
    } catch (error) {
      console.error('Periods fetch error:', error);
      // Dönem yükleme hatası kritik değil, sessiz geç
    }
  };

  const handleTransfer = async () => {
    if (!selectedUser) {
      toast.error('Lütfen bir temsilci seçiniz');
      return;
    }

    if (selectedUser === sale?.salesperson?._id) {
      toast.error('Satış zaten bu temsilciye ait');
      return;
    }

    if (changePeriod && !selectedPeriod) {
      toast.error('Dönem değişikliği için lütfen bir dönem seçiniz');
      return;
    }

    // Prim ödendi durumunda dönem değişikliğine izin verme
    if (changePeriod && sale?.primStatus === 'ödendi') {
      toast.error('Prim ödendi durumundaki satışların dönemi değiştirilemez');
      return;
    }

    setLoading(true);
    try {
      const transferData = {
        newSalespersonId: selectedUser,
        transferReason: 'Admin transfer'
      };

      if (changePeriod && selectedPeriod) {
        transferData.newPeriod = selectedPeriod;
      }

      console.log('🔄 Transfer request data:', {
        saleId: sale._id,
        transferData,
        selectedUser,
        changePeriod,
        selectedPeriod
      });

      await salesAPI.transferSale(sale._id, transferData);
      
      const message = changePeriod 
        ? 'Satış başarıyla transfer edildi ve dönem değiştirildi'
        : 'Satış başarıyla transfer edildi';
      
      toast.success(message);
      onSuccess();
    } catch (error) {
      console.error('Transfer error:', error);
      console.error('Error response:', error.response?.data);
      
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.details ||
                          'Transfer işlemi sırasında hata oluştu';
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedUser('');
    setError(null);
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Satış Transfer Et</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && (
          <Alert variant="danger" className="mb-3">
            {error}
          </Alert>
        )}

        <div className="mb-3">
          <p>
            <strong>{sale?.customerName}</strong> müşterisine ait 
            <strong> {sale?.contractNo}</strong> sözleşme numaralı satışı başka bir temsilciye transfer edeceksiniz.
          </p>
          <Alert variant="info">
            <strong>Dikkat:</strong> Transfer işlemi sonrasında:
            <ul className="mb-0 mt-2">
              <li>Mevcut temsilciden prim kesintisi yapılacak</li>
              <li>Yeni temsilciye prim kazancı eklenecek</li>
              <li>Bu işlem geri alınamaz</li>
            </ul>
          </Alert>
        </div>

        <Row>
          <Col md={12}>
            <Form.Group className="mb-3">
              <Form.Label>Yeni Temsilci *</Form.Label>
              <Form.Select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
              >
                <option value="">Temsilci seçiniz...</option>
                {users.map(user => (
                  <option key={user._id} value={user._id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
        </Row>

        {/* Dönem Değiştirme Seçeneği - Sadece prim ödenmedi durumunda */}
        {sale?.primStatus === 'ödenmedi' && (
          <Row>
            <Col md={12}>
              <Form.Check
                type="checkbox"
                id="changePeriod"
                label="Prim dönemini de değiştir"
                checked={changePeriod}
                onChange={(e) => setChangePeriod(e.target.checked)}
                className="mb-3"
              />
            </Col>
          </Row>
        )}

        {changePeriod && (
          <Row>
            <Col md={12}>
              <Form.Group className="mb-3">
                <Form.Label>Yeni Prim Dönemi *</Form.Label>
                <Form.Select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                >
                  <option value="">Dönem seçiniz...</option>
                  {periods.map(period => (
                    <option key={period._id} value={period._id}>
                      {period.name}
                    </option>
                  ))}
                </Form.Select>
                <Form.Text className="text-muted">
                  Mevcut dönem: <strong>{sale?.primPeriod?.name}</strong>
                </Form.Text>
              </Form.Group>
            </Col>
          </Row>
        )}

        <Row>
          <Col md={6}>
            <small className="text-muted">
              <strong>Mevcut Temsilci:</strong><br />
              {sale?.salesperson?.name}
            </small>
          </Col>
          <Col md={6}>
            <small className="text-muted">
              <strong>Prim Durumu:</strong><br />
              <Badge bg={sale?.primStatus === 'ödendi' ? 'success' : 'warning'}>
                {sale?.primStatus === 'ödendi' ? 'Ödendi' : 'Ödenmedi'}
              </Badge>
            </small>
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>
          İptal
        </Button>
        <Button 
          variant="primary" 
          onClick={handleTransfer}
          disabled={loading || !selectedUser}
        >
          {loading ? 'Transfer Ediliyor...' : 'Transfer Et'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default TransferModal;
