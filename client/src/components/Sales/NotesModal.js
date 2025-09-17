import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Badge } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { FiFileText, FiEdit3, FiTrash2, FiUser, FiClock, FiSave, FiX } from 'react-icons/fi';
import { salesAPI } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const NotesModal = ({ show, onHide, sale, onSuccess }) => {
  const [notes, setNotes] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const canEditNotes = user && (
    (user.role && user.role.name === 'admin') || 
    (sale?.salesperson?._id === user._id || sale?.salesperson === user._id)
  );

  useEffect(() => {
    if (show && sale) {
      setNotes(sale.notes || '');
      setIsEditing(!sale.notes); // Eğer not yoksa düzenleme modunda aç
    }
  }, [show, sale]);

  const handleSave = async () => {
    if (!notes.trim()) {
      toast.error('Not içeriği boş olamaz');
      return;
    }

    if (notes.length > 1000) {
      toast.error('Not 1000 karakterden uzun olamaz');
      return;
    }

    setLoading(true);
    try {
      await salesAPI.updateNotes(sale._id, notes.trim());
      toast.success('Not başarıyla kaydedildi');
      setIsEditing(false);
      onSuccess && onSuccess();
    } catch (error) {
      console.error('Notes update error:', error);
      toast.error(error.response?.data?.message || 'Not kaydedilirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Bu notu silmek istediğinizden emin misiniz?')) {
      return;
    }

    setLoading(true);
    try {
      await salesAPI.deleteNotes(sale._id);
      toast.success('Not başarıyla silindi');
      setNotes('');
      setIsEditing(false);
      onSuccess && onSuccess();
    } catch (error) {
      console.error('Notes delete error:', error);
      toast.error(error.response?.data?.message || 'Not silinirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (sale?.notes) {
      setNotes(sale.notes);
    }
    setIsEditing(false);
    onHide();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!sale) return null;

  return (
    <Modal show={show} onHide={handleClose} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          <FiFileText className="me-2" />
          Satış Notu
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {/* Satış Bilgileri */}
        <div className="mb-3 p-3 bg-light rounded">
          <div className="row">
            <div className="col-md-6">
              <strong>Müşteri:</strong> {sale.customerName}
            </div>
            <div className="col-md-6">
              <strong>Sözleşme No:</strong> {sale.contractNo}
            </div>
          </div>
        </div>

        {/* Yetki Kontrolü */}
        {!canEditNotes && (
          <Alert variant="warning" className="mb-3">
            <strong>Uyarı:</strong> Bu satışın notunu görüntüleme yetkiniz var ancak düzenleme yetkiniz bulunmamaktadır.
          </Alert>
        )}

        {/* Not İçeriği */}
        <Form.Group className="mb-3">
          <Form.Label>
            <strong>Not İçeriği</strong>
          </Form.Label>
          {isEditing && canEditNotes ? (
            <Form.Control
              as="textarea"
              rows={6}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Satışla ilgili notlarınızı buraya yazın..."
              maxLength={1000}
              disabled={loading}
            />
          ) : (
            <div className="p-3 border rounded bg-white" style={{ minHeight: '150px' }}>
              {sale.notes ? (
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  {sale.notes}
                </div>
              ) : (
                <div className="text-muted text-center py-4">
                  <FiFileText size={32} className="mb-2" />
                  <div>Bu satış için henüz not eklenmemiş</div>
                </div>
              )}
            </div>
          )}
          {isEditing && canEditNotes && (
            <Form.Text className="text-muted">
              {notes.length}/1000 karakter
            </Form.Text>
          )}
        </Form.Group>

        {/* Not Meta Bilgileri */}
        {sale.notes && (sale.notesAddedAt || sale.notesUpdatedAt) && (
          <div className="mt-3 p-2 bg-light rounded small text-muted">
            {sale.notesAddedAt && (
              <div className="d-flex align-items-center mb-1">
                <FiUser className="me-1" />
                <span>Ekleyen: {sale.notesAddedBy?.name || 'Bilinmiyor'}</span>
                <FiClock className="ms-2 me-1" />
                <span>{formatDate(sale.notesAddedAt)}</span>
              </div>
            )}
            {sale.notesUpdatedAt && (
              <div className="d-flex align-items-center">
                <FiEdit3 className="me-1" />
                <span>Son güncelleyen: {sale.notesUpdatedBy?.name || 'Bilinmiyor'}</span>
                <FiClock className="ms-2 me-1" />
                <span>{formatDate(sale.notesUpdatedAt)}</span>
              </div>
            )}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <div className="d-flex justify-content-between w-100">
          <div>
            {sale.notes && canEditNotes && !isEditing && (
              <Button 
                variant="outline-danger" 
                size="sm"
                onClick={handleDelete}
                disabled={loading}
              >
                <FiTrash2 className="me-1" />
                Notu Sil
              </Button>
            )}
          </div>
          <div className="d-flex gap-2">
            {isEditing && canEditNotes ? (
              <>
                <Button 
                  variant="outline-secondary" 
                  onClick={() => {
                    setNotes(sale.notes || '');
                    setIsEditing(false);
                  }}
                  disabled={loading}
                >
                  <FiX className="me-1" />
                  İptal
                </Button>
                <Button 
                  variant="success" 
                  onClick={handleSave}
                  disabled={loading || !notes.trim()}
                >
                  <FiSave className="me-1" />
                  {loading ? 'Kaydediliyor...' : 'Kaydet'}
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={handleClose}>
                  Kapat
                </Button>
                {canEditNotes && (
                  <Button 
                    variant="primary" 
                    onClick={() => setIsEditing(true)}
                  >
                    <FiEdit3 className="me-1" />
                    {sale.notes ? 'Düzenle' : 'Not Ekle'}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default NotesModal;
