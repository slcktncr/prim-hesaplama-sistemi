import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Button, 
  Alert, 
  Row, 
  Col,
  Table,
  Badge,
  Modal,
  Tabs,
  Tab
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  FiCalendar, 
  FiDatabase, 
  FiSave,
  FiEdit,
  FiTrash2,
  FiPlus,
  FiBarChart,
  FiUsers,
  FiMessageSquare,
  FiPhone
} from 'react-icons/fi';

import { communicationsAPI, usersAPI } from '../../utils/api';
import { formatNumber } from '../../utils/helpers';
import Loading from '../Common/Loading';

const HistoricalDataManagement = () => {
  const [years, setYears] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingYear, setEditingYear] = useState(null);
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    type: 'historical',
    statistics: {}
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [yearsResponse, usersResponse] = await Promise.all([
        communicationsAPI.getRecords({ type: 'yearly' }),
        usersAPI.getSalespeople()
      ]);
      
      setYears(yearsResponse.data || []);
      setUsers(usersResponse.data || []);
    } catch (error) {
      console.error('Data fetch error:', error);
      toast.error('Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleAddYear = () => {
    setEditingYear(null);
    setFormData({
      year: new Date().getFullYear() - 1,
      type: 'historical',
      statistics: {}
    });
    setShowModal(true);
  };

  const handleEditYear = (year) => {
    setEditingYear(year);
    setFormData({
      year: year.year,
      type: year.type,
      statistics: year.statistics || {}
    });
    setShowModal(true);
  };

  const handleSaveYear = async () => {
    try {
      setSaving(true);
      
      if (editingYear) {
        // Güncelleme
        await communicationsAPI.updateYear(editingYear._id, formData);
        toast.success('Yıl verisi güncellendi');
      } else {
        // Yeni ekleme
        await communicationsAPI.createYear(formData);
        toast.success('Yıl verisi eklendi');
      }
      
      setShowModal(false);
      fetchData();
      
    } catch (error) {
      console.error('Save year error:', error);
      toast.error(error.response?.data?.message || 'Kaydetme hatası');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteYear = async (yearId) => {
    if (!window.confirm('Bu yıl verisini silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      await communicationsAPI.deleteYear(yearId);
      toast.success('Yıl verisi silindi');
      fetchData();
    } catch (error) {
      console.error('Delete year error:', error);
      toast.error('Silme hatası');
    }
  };

  const updateStatistic = (userId, field, value) => {
    setFormData(prev => ({
      ...prev,
      statistics: {
        ...prev.statistics,
        [userId]: {
          ...prev.statistics[userId],
          [field]: parseInt(value) || 0
        }
      }
    }));
  };

  const getUserStatistic = (userId, field) => {
    return formData.statistics[userId]?.[field] || 0;
  };

  const getTotalForField = (field) => {
    return Object.values(formData.statistics).reduce((total, userStats) => {
      return total + (userStats[field] || 0);
    }, 0);
  };

  if (loading) {
    return <Loading variant="dots" size="large" />;
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4>
            <FiDatabase className="me-2" />
            Geçmiş Yıllar İletişim Verileri
          </h4>
          <p className="text-muted mb-0">
            2021-2024 yılları için toplam iletişim verilerini yönetin
          </p>
        </div>
        <Button variant="primary" onClick={handleAddYear}>
          <FiPlus className="me-1" />
          Yıl Ekle
        </Button>
      </div>

      {/* Info Alert */}
      <Alert variant="info" className="mb-4">
        <FiCalendar className="me-2" />
        <strong>Bilgi:</strong> Geçmiş yıllar için günlük detay gerekmez, sadece yıllık toplam veriler girilir.
        2025 ve sonrası yıllar için günlük detaylı kayıt sistemi aktif olacaktır.
      </Alert>

      {/* Years Table */}
      <Card>
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <h6 className="mb-0">Kayıtlı Yıllar</h6>
            <Badge bg="primary">{years.length} yıl</Badge>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0">
            <thead className="table-light">
              <tr>
                <th>Yıl</th>
                <th>Tip</th>
                <th>Temsilci Sayısı</th>
                <th>Toplam İletişim</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {years.map((year) => (
                <tr key={year._id}>
                  <td>
                    <div className="fw-bold">{year.year}</div>
                  </td>
                  <td>
                    <Badge bg={year.type === 'historical' ? 'secondary' : 'success'}>
                      {year.type === 'historical' ? 'Geçmiş' : 'Aktif'}
                    </Badge>
                  </td>
                  <td>
                    {Object.keys(year.statistics || {}).length} temsilci
                  </td>
                  <td>
                    {formatNumber(
                      Object.values(year.statistics || {}).reduce((total, stats) => 
                        total + (stats.totalCommunication || 0), 0
                      )
                    )}
                  </td>
                  <td>
                    {year.isActive ? (
                      <Badge bg="success">Aktif</Badge>
                    ) : (
                      <Badge bg="secondary">Pasif</Badge>
                    )}
                  </td>
                  <td>
                    <div className="d-flex gap-2">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => handleEditYear(year)}
                      >
                        <FiEdit />
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleDeleteYear(year._id)}
                      >
                        <FiTrash2 />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* Add/Edit Year Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>
            <FiCalendar className="me-2" />
            {editingYear ? `${formData.year} Yılını Düzenle` : 'Yeni Yıl Ekle'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Row className="mb-4">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Yıl</Form.Label>
                  <Form.Control
                    type="number"
                    min="2020"
                    max="2030"
                    value={formData.year}
                    onChange={(e) => setFormData(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                    disabled={!!editingYear}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Tip</Form.Label>
                  <Form.Select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="historical">Geçmiş Yıl</option>
                    <option value="active">Aktif Yıl</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Alert variant="warning" className="mb-4">
              <strong>Not:</strong> Her temsilci için yıllık toplam değerleri girin. 
              Günlük detay gerekmez, sadece o yıl boyunca gerçekleştirdiği toplam iletişim sayıları.
            </Alert>

            {/* User Statistics */}
            <Tabs defaultActiveKey="communication" className="mb-3">
              <Tab eventKey="communication" title={
                <span>
                  <FiMessageSquare className="me-1" />
                  İletişim Verileri
                </span>
              }>
                <Table responsive className="mt-3">
                  <thead className="table-light">
                    <tr>
                      <th>Temsilci</th>
                      <th>WhatsApp</th>
                      <th>Gelen Arama</th>
                      <th>Giden Arama</th>
                      <th>Yeni Müşteri</th>
                      <th>Satış Sonrası</th>
                      <th>Toplam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user._id}>
                        <td>
                          <div className="fw-bold">{user.name}</div>
                          <small className="text-muted">{user.email}</small>
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            min="0"
                            size="sm"
                            value={getUserStatistic(user._id, 'whatsappIncoming')}
                            onChange={(e) => updateStatistic(user._id, 'whatsappIncoming', e.target.value)}
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            min="0"
                            size="sm"
                            value={getUserStatistic(user._id, 'callIncoming')}
                            onChange={(e) => updateStatistic(user._id, 'callIncoming', e.target.value)}
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            min="0"
                            size="sm"
                            value={getUserStatistic(user._id, 'callOutgoing')}
                            onChange={(e) => updateStatistic(user._id, 'callOutgoing', e.target.value)}
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            min="0"
                            size="sm"
                            value={getUserStatistic(user._id, 'meetingNewCustomer')}
                            onChange={(e) => updateStatistic(user._id, 'meetingNewCustomer', e.target.value)}
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            min="0"
                            size="sm"
                            value={getUserStatistic(user._id, 'meetingAfterSale')}
                            onChange={(e) => updateStatistic(user._id, 'meetingAfterSale', e.target.value)}
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <Badge bg="primary">
                            {(getUserStatistic(user._id, 'whatsappIncoming') +
                              getUserStatistic(user._id, 'callIncoming') +
                              getUserStatistic(user._id, 'callOutgoing') +
                              getUserStatistic(user._id, 'meetingNewCustomer') +
                              getUserStatistic(user._id, 'meetingAfterSale'))}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    <tr className="table-info">
                      <td><strong>TOPLAM</strong></td>
                      <td><strong>{formatNumber(getTotalForField('whatsappIncoming'))}</strong></td>
                      <td><strong>{formatNumber(getTotalForField('callIncoming'))}</strong></td>
                      <td><strong>{formatNumber(getTotalForField('callOutgoing'))}</strong></td>
                      <td><strong>{formatNumber(getTotalForField('meetingNewCustomer'))}</strong></td>
                      <td><strong>{formatNumber(getTotalForField('meetingAfterSale'))}</strong></td>
                      <td>
                        <Badge bg="success" className="fs-6">
                          {formatNumber(
                            getTotalForField('whatsappIncoming') +
                            getTotalForField('callIncoming') +
                            getTotalForField('callOutgoing') +
                            getTotalForField('meetingNewCustomer') +
                            getTotalForField('meetingAfterSale')
                          )}
                        </Badge>
                      </td>
                    </tr>
                  </tbody>
                </Table>
              </Tab>

              <Tab eventKey="summary" title={
                <span>
                  <FiBarChart className="me-1" />
                  Özet
                </span>
              }>
                <Row className="mt-3">
                  <Col md={3}>
                    <Card className="text-center">
                      <Card.Body>
                        <FiMessageSquare size={24} className="text-success mb-2" />
                        <h4 className="text-success">{formatNumber(getTotalForField('whatsappIncoming'))}</h4>
                        <small>WhatsApp</small>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={3}>
                    <Card className="text-center">
                      <Card.Body>
                        <FiPhone size={24} className="text-primary mb-2" />
                        <h4 className="text-primary">
                          {formatNumber(getTotalForField('callIncoming') + getTotalForField('callOutgoing'))}
                        </h4>
                        <small>Telefon Aramaları</small>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={3}>
                    <Card className="text-center">
                      <Card.Body>
                        <FiUsers size={24} className="text-info mb-2" />
                        <h4 className="text-info">
                          {formatNumber(getTotalForField('meetingNewCustomer') + getTotalForField('meetingAfterSale'))}
                        </h4>
                        <small>Görüşmeler</small>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={3}>
                    <Card className="text-center border-success">
                      <Card.Body>
                        <FiBarChart size={24} className="text-success mb-2" />
                        <h4 className="text-success">
                          {formatNumber(
                            getTotalForField('whatsappIncoming') +
                            getTotalForField('callIncoming') +
                            getTotalForField('callOutgoing') +
                            getTotalForField('meetingNewCustomer') +
                            getTotalForField('meetingAfterSale')
                          )}
                        </h4>
                        <small>Toplam İletişim</small>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Tab>
            </Tabs>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            İptal
          </Button>
          <Button 
            variant="primary" 
            onClick={handleSaveYear}
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="spinner-border spinner-border-sm me-2" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <FiSave className="me-1" />
                {editingYear ? 'Güncelle' : 'Kaydet'}
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default HistoricalDataManagement;
