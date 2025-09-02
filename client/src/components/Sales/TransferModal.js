import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { salesAPI } from '../../utils/api';
import API from '../../utils/api';

const TransferModal = ({ show, onHide, sale, onSuccess }) => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (show) {
      fetchUsers();
    }
  }, [show]);

  const fetchUsers = async () => {
    try {
      const response = await API.get('/api/users/salespeople');
      setUsers(response.data || []);
    } catch (error) {
      console.error('Users fetch error:', error);
      setError('Kullanıcılar yüklenirken hata oluştu');
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

    setLoading(true);
    try {
      await salesAPI.transferSale(sale._id, selectedUser);
      toast.success('Satış başarıyla transfer edildi');
      onSuccess();
    } catch (error) {
      console.error('Transfer error:', error);
      toast.error(error.response?.data?.message || 'Transfer işlemi sırasında hata oluştu');
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

        <Form.Group>
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

        <div className="mt-3">
          <small className="text-muted">
            <strong>Mevcut Temsilci:</strong> {sale?.salesperson?.name}
          </small>
        </div>
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
