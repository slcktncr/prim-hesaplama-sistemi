import React, { useState } from 'react';
import { Modal, Button, Alert, Badge } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { FiCheck, FiX, FiDollarSign, FiMinus } from 'react-icons/fi';
import { formatCurrency } from '../../utils/helpers';

const PrimTransactionStatusModal = ({ show, onHide, transaction, onStatusUpdate }) => {
  const [loading, setLoading] = useState(false);

  if (!transaction) return null;

  const isPositive = transaction.primDifference > 0;
  const amount = Math.abs(transaction.primDifference);

  const handleStatusUpdate = async (newStatus) => {
    setLoading(true);
    try {
      // TODO: API call to update PrimTransaction status
      // await primTransactionAPI.updateStatus(transaction.id, newStatus);
      
      toast.success(
        isPositive 
          ? (newStatus === 'paid' ? 'Ek prim ödendi olarak işaretlendi' : 'Ek prim ödenmedi olarak işaretlendi')
          : (newStatus === 'deducted' ? 'Kesinti yapıldı olarak işaretlendi' : 'Kesinti yapılmadı olarak işaretlendi')
      );
      
      onStatusUpdate(newStatus);
      onHide();
    } catch (error) {
      console.error('Status update error:', error);
      toast.error('Durum güncellenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {isPositive ? (
            <>
              <FiDollarSign className="me-2 text-success" />
              Ek Prim Durumu
            </>
          ) : (
            <>
              <FiMinus className="me-2 text-warning" />
              Kesinti Durumu
            </>
          )}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Alert variant={isPositive ? "success" : "warning"}>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <strong>
                {isPositive ? 'Ek Prim Tutarı:' : 'Kesinti Tutarı:'}
              </strong>
            </div>
            <div className="h5 mb-0">
              {isPositive ? '+' : '-'}{formatCurrency(amount)}
            </div>
          </div>
        </Alert>

        <div className="mb-3">
          <strong>Müşteri:</strong> {transaction.customerName}<br />
          <strong>Konum:</strong> {transaction.blockNo}/{transaction.apartmentNo}<br />
          <strong>Temsilci:</strong> {transaction.salespersonName}
        </div>

        <div className="mb-3">
          <strong>Mevcut Durum:</strong>
          <Badge bg="warning" className="ms-2">
            {isPositive ? 'ödenmedi' : 'kesilmedi'}
          </Badge>
        </div>

        <p className="text-muted">
          {isPositive 
            ? 'Bu ek prim tutarı temsilciye ödenecek mi?'
            : 'Bu kesinti tutarı temsilciden kesildi mi?'
          }
        </p>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          İptal
        </Button>
        
        {isPositive ? (
          <>
            <Button 
              variant="outline-success" 
              onClick={() => handleStatusUpdate('unpaid')}
              disabled={loading}
            >
              <FiX className="me-1" />
              Ödenmedi
            </Button>
            <Button 
              variant="success" 
              onClick={() => handleStatusUpdate('paid')}
              disabled={loading}
            >
              <FiCheck className="me-1" />
              Ödendi
            </Button>
          </>
        ) : (
          <>
            <Button 
              variant="outline-warning" 
              onClick={() => handleStatusUpdate('not_deducted')}
              disabled={loading}
            >
              <FiX className="me-1" />
              Kesilmedi
            </Button>
            <Button 
              variant="warning" 
              onClick={() => handleStatusUpdate('deducted')}
              disabled={loading}
            >
              <FiCheck className="me-1" />
              Kesildi
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default PrimTransactionStatusModal;
