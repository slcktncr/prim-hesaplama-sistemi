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
  FiPhone,
  FiCheck
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
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    type: 'historical',
    monthlyData: {}, // Aylık veriler: { month: { userId: { whatsapp: 100, ... } } }
    historicalUsers: [], // Eski temsilciler listesi
    yearlySalesData: {} // Yıllık satış verileri: { userId: { totalSales: 10, totalAmount: 1000000, ... } }
  });
  const [selectedMonth, setSelectedMonth] = useState(1); // Seçili ay (1-12)

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
      monthlyData: {},
      historicalUsers: []
    });
    setSelectedMonth(1);
    setShowModal(true);
  };

  const handleEditYear = (year) => {
    setEditingYear(year);
    setFormData({
      year: year.year,
      type: year.type,
      monthlyData: year.monthlyData || {},
      historicalUsers: year.historicalUsers || [],
      yearlySalesData: year.yearlySalesData || {}
    });
    setSelectedMonth(1);
    setShowModal(true);
  };

  const handleSaveYear = async () => {
    try {
      setSaving(true);
      
      if (editingYear) {
        // Güncelleme
        await communicationsAPI.updateYear(editingYear._id, formData);
        toast.success('Yıl verisi güncellendi - Veri girişine devam edebilirsiniz');
      } else {
        // Yeni ekleme
        await communicationsAPI.createYear(formData);
        toast.success('Yıl verisi eklendi - Veri girişine devam edebilirsiniz');
        // Yeni ekleme sonrası düzenleme moduna geç
        const response = await communicationsAPI.getRecords({ type: 'yearly', limit: 1 });
        if (response.data && response.data.length > 0) {
          const newYear = response.data.find(y => y.year === formData.year);
          if (newYear) {
            setEditingYear(newYear);
          }
        }
      }
      
      // Modal'ı kapatma, sadece verileri güncelle
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

  const updateMonthlyStatistic = (month, userId, field, value) => {
    setFormData(prev => ({
      ...prev,
      monthlyData: {
        ...prev.monthlyData,
        [month]: {
          ...prev.monthlyData[month],
          [userId]: {
            ...prev.monthlyData[month]?.[userId],
            [field]: parseInt(value) || 0
          }
        }
      }
    }));
  };

  const getMonthlyUserStatistic = (month, userId, field) => {
    return formData.monthlyData[month]?.[userId]?.[field] || 0;
  };

  const getMonthlyTotalForField = (month, field) => {
    const monthData = formData.monthlyData[month] || {};
    return Object.values(monthData).reduce((total, userStats) => {
      return total + (userStats[field] || 0);
    }, 0);
  };

  const getYearlyTotalForField = (field) => {
    let total = 0;
    for (let month = 1; month <= 12; month++) {
      total += getMonthlyTotalForField(month, field);
    }
    return total;
  };

  const getMonthName = (monthNumber) => {
    const months = [
      'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];
    return months[monthNumber - 1];
  };

  // Satış verisi güncelleme fonksiyonu
  const updateSalesData = (userId, field, value) => {
    setFormData(prev => ({
      ...prev,
      yearlySalesData: {
        ...prev.yearlySalesData,
        [userId]: {
          ...prev.yearlySalesData[userId],
          [field]: parseInt(value) || 0
        }
      }
    }));
  };

  // Kullanıcının satış verisini getirme fonksiyonu
  const getUserSalesData = (userId, field) => {
    return formData.yearlySalesData[userId]?.[field] || 0;
  };

  // Toplam satış verisi hesaplama
  const getTotalSalesForField = (field) => {
    const yearlySalesData = formData.yearlySalesData || {};
    return Object.values(yearlySalesData).reduce((total, userSales) => {
      return total + (userSales[field] || 0);
    }, 0);
  };

  const handleAddHistoricalUser = () => {
    if (!newUserName.trim()) {
      toast.error('Temsilci adı giriniz');
      return;
    }

    const newUserId = `historical_${Date.now()}`;
    const newUser = {
      _id: newUserId,
      name: newUserName.trim(),
      email: `${newUserName.toLowerCase().replace(/\s+/g, '.')}@historical.local`,
      isHistorical: true
    };

    setFormData(prev => ({
      ...prev,
      historicalUsers: [...prev.historicalUsers, newUser]
    }));

    setNewUserName('');
    setShowAddUserModal(false);
    toast.success('Eski temsilci eklendi');
  };

  const handleRemoveHistoricalUser = (userId) => {
    setFormData(prev => {
      // Tüm aylardan bu kullanıcının verilerini kaldır
      const newMonthlyData = { ...prev.monthlyData };
      Object.keys(newMonthlyData).forEach(month => {
        if (newMonthlyData[month][userId]) {
          delete newMonthlyData[month][userId];
        }
      });

      return {
        ...prev,
        historicalUsers: prev.historicalUsers.filter(user => user._id !== userId),
        monthlyData: newMonthlyData
      };
    });
    toast.success('Eski temsilci kaldırıldı');
  };

  const getAllUsersForYear = () => {
    return [...users, ...formData.historicalUsers];
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
                <th>Toplam Satış</th>
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
                    {(() => {
                      const monthlyData = year.monthlyData || {};
                      const allUsers = new Set();
                      Object.values(monthlyData).forEach(monthData => {
                        Object.keys(monthData || {}).forEach(userId => allUsers.add(userId));
                      });
                      return allUsers.size + (year.historicalUsers?.length || 0);
                    })()} temsilci
                  </td>
                  <td>
                    {formatNumber(
                      (() => {
                        const monthlyData = year.monthlyData || {};
                        let total = 0;
                        Object.values(monthlyData).forEach(monthData => {
                          Object.values(monthData || {}).forEach(userStats => {
                            total += (userStats.whatsappIncoming || 0) +
                                   (userStats.callIncoming || 0) +
                                   (userStats.callOutgoing || 0) +
                                   (userStats.meetingNewCustomer || 0) +
                                   (userStats.meetingAfterSale || 0);
                          });
                        });
                        return total;
                      })()
                    )}
                  </td>
                  <td>
                    {formatNumber(
                      (() => {
                        const yearlySalesData = year.yearlySalesData || {};
                        return Object.values(yearlySalesData).reduce((total, userSales) => {
                          return total + (userSales.totalSales || 0);
                        }, 0);
                      })()
                    )} adet
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
                        title={`${year.year} yılını düzenle`}
                      >
                        <FiEdit className="me-1" />
                        Düzenle
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleDeleteYear(year._id)}
                        title={`${year.year} yılını sil`}
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

            <Alert variant={editingYear ? "info" : "warning"} className="mb-4">
              {editingYear ? (
                <>
                  <strong>Düzenleme Modu:</strong> {formData.year} yılının verilerini düzenliyorsunuz. 
                  Mevcut veriler yüklendi, istediğiniz değişiklikleri yapabilirsiniz.
                </>
              ) : (
                <>
                  <strong>Not:</strong> Her temsilci için aylık bazda değerleri girin. 
                  Ay seçerek her ay için ayrı ayrı veri girebilirsiniz.
                </>
              )}
            </Alert>

            <div className="d-flex justify-content-between align-items-center mb-3">
              <div className="d-flex align-items-center gap-3">
                <h6 className="mb-0">Aylık Veri Girişi</h6>
                <Form.Select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  style={{ width: '150px' }}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <option key={month} value={month}>
                      {getMonthName(month)}
                    </option>
                  ))}
                </Form.Select>
              </div>
              <Button 
                variant="outline-primary" 
                size="sm"
                onClick={() => setShowAddUserModal(true)}
              >
                <FiPlus className="me-1" />
                Eski Temsilci Ekle
              </Button>
            </div>

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
                    {getAllUsersForYear().map((user) => (
                      <tr key={user._id}>
                        <td>
                          <div className="d-flex justify-content-between align-items-center">
                            <div>
                              <div className="fw-bold">
                                {user.name}
                                {user.isHistorical && (
                                  <Badge bg="secondary" className="ms-2 small">Eski</Badge>
                                )}
                              </div>
                              <small className="text-muted">{user.email}</small>
                            </div>
                            {user.isHistorical && (
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => handleRemoveHistoricalUser(user._id)}
                                title="Eski temsilciyi kaldır"
                              >
                                <FiTrash2 size={12} />
                              </Button>
                            )}
                          </div>
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            min="0"
                            size="sm"
                            value={getMonthlyUserStatistic(selectedMonth, user._id, 'whatsappIncoming')}
                            onChange={(e) => updateMonthlyStatistic(selectedMonth, user._id, 'whatsappIncoming', e.target.value)}
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            min="0"
                            size="sm"
                            value={getMonthlyUserStatistic(selectedMonth, user._id, 'callIncoming')}
                            onChange={(e) => updateMonthlyStatistic(selectedMonth, user._id, 'callIncoming', e.target.value)}
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            min="0"
                            size="sm"
                            value={getMonthlyUserStatistic(selectedMonth, user._id, 'callOutgoing')}
                            onChange={(e) => updateMonthlyStatistic(selectedMonth, user._id, 'callOutgoing', e.target.value)}
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            min="0"
                            size="sm"
                            value={getMonthlyUserStatistic(selectedMonth, user._id, 'meetingNewCustomer')}
                            onChange={(e) => updateMonthlyStatistic(selectedMonth, user._id, 'meetingNewCustomer', e.target.value)}
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            min="0"
                            size="sm"
                            value={getMonthlyUserStatistic(selectedMonth, user._id, 'meetingAfterSale')}
                            onChange={(e) => updateMonthlyStatistic(selectedMonth, user._id, 'meetingAfterSale', e.target.value)}
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <Badge bg="primary">
                            {(getMonthlyUserStatistic(selectedMonth, user._id, 'whatsappIncoming') +
                              getMonthlyUserStatistic(selectedMonth, user._id, 'callIncoming') +
                              getMonthlyUserStatistic(selectedMonth, user._id, 'callOutgoing') +
                              getMonthlyUserStatistic(selectedMonth, user._id, 'meetingNewCustomer') +
                              getMonthlyUserStatistic(selectedMonth, user._id, 'meetingAfterSale'))}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    <tr className="table-info">
                      <td><strong>{getMonthName(selectedMonth)} TOPLAM</strong></td>
                      <td><strong>{formatNumber(getMonthlyTotalForField(selectedMonth, 'whatsappIncoming'))}</strong></td>
                      <td><strong>{formatNumber(getMonthlyTotalForField(selectedMonth, 'callIncoming'))}</strong></td>
                      <td><strong>{formatNumber(getMonthlyTotalForField(selectedMonth, 'callOutgoing'))}</strong></td>
                      <td><strong>{formatNumber(getMonthlyTotalForField(selectedMonth, 'meetingNewCustomer'))}</strong></td>
                      <td><strong>{formatNumber(getMonthlyTotalForField(selectedMonth, 'meetingAfterSale'))}</strong></td>
                      <td>
                        <Badge bg="success" className="fs-6">
                          {formatNumber(
                            getMonthlyTotalForField(selectedMonth, 'whatsappIncoming') +
                            getMonthlyTotalForField(selectedMonth, 'callIncoming') +
                            getMonthlyTotalForField(selectedMonth, 'callOutgoing') +
                            getMonthlyTotalForField(selectedMonth, 'meetingNewCustomer') +
                            getMonthlyTotalForField(selectedMonth, 'meetingAfterSale')
                          )}
                        </Badge>
                      </td>
                    </tr>
                  </tbody>
                </Table>
              </Tab>

              <Tab eventKey="sales" title={
                <span>
                  <FiBarChart className="me-1" />
                  Satış Verileri
                </span>
              }>
                <Alert variant="info" className="mt-3">
                  <strong>Not:</strong> Bu bölümde geçmiş yıl için toplam satış verilerini girebilirsiniz. 
                  Aylık detay gerekmez, sadece yıllık toplam değerler.
                </Alert>
                
                <Table responsive className="mt-3">
                  <thead className="table-light">
                    <tr>
                      <th>Temsilci</th>
                      <th>Toplam Satış Adedi</th>
                      <th>Toplam Ciro (TL)</th>
                      <th>Toplam Prim (TL)</th>
                      <th>İptal Adedi</th>
                      <th>İptal Tutarı (TL)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map((user) => (
                      <tr key={user._id}>
                        <td>
                          <div>
                            <strong>{user.name}</strong>
                            {user.isHistorical && (
                              <Badge bg="secondary" className="ms-2">Eski</Badge>
                            )}
                          </div>
                          <small className="text-muted">{user.email}</small>
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            min="0"
                            size="sm"
                            value={getUserSalesData(user._id, 'totalSales')}
                            onChange={(e) => updateSalesData(user._id, 'totalSales', e.target.value)}
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            min="0"
                            size="sm"
                            value={getUserSalesData(user._id, 'totalAmount')}
                            onChange={(e) => updateSalesData(user._id, 'totalAmount', e.target.value)}
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            min="0"
                            size="sm"
                            value={getUserSalesData(user._id, 'totalPrim')}
                            onChange={(e) => updateSalesData(user._id, 'totalPrim', e.target.value)}
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            min="0"
                            size="sm"
                            value={getUserSalesData(user._id, 'cancellations')}
                            onChange={(e) => updateSalesData(user._id, 'cancellations', e.target.value)}
                            placeholder="0"
                          />
                        </td>
                        <td>
                          <Form.Control
                            type="number"
                            min="0"
                            size="sm"
                            value={getUserSalesData(user._id, 'cancellationAmount')}
                            onChange={(e) => updateSalesData(user._id, 'cancellationAmount', e.target.value)}
                            placeholder="0"
                          />
                        </td>
                      </tr>
                    ))}
                    <tr className="table-info fw-bold">
                      <td>TOPLAM</td>
                      <td>{formatNumber(getTotalSalesForField('totalSales'))}</td>
                      <td>{formatNumber(getTotalSalesForField('totalAmount'))} TL</td>
                      <td>{formatNumber(getTotalSalesForField('totalPrim'))} TL</td>
                      <td>{formatNumber(getTotalSalesForField('cancellations'))}</td>
                      <td>{formatNumber(getTotalSalesForField('cancellationAmount'))} TL</td>
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
                        <h4 className="text-success">{formatNumber(getYearlyTotalForField('whatsappIncoming'))}</h4>
                        <small>WhatsApp (Yıllık)</small>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={3}>
                    <Card className="text-center">
                      <Card.Body>
                        <FiPhone size={24} className="text-primary mb-2" />
                        <h4 className="text-primary">
                          {formatNumber(getYearlyTotalForField('callIncoming') + getYearlyTotalForField('callOutgoing'))}
                        </h4>
                        <small>Telefon Aramaları (Yıllık)</small>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={3}>
                    <Card className="text-center">
                      <Card.Body>
                        <FiUsers size={24} className="text-info mb-2" />
                        <h4 className="text-info">
                          {formatNumber(getYearlyTotalForField('meetingNewCustomer') + getYearlyTotalForField('meetingAfterSale'))}
                        </h4>
                        <small>Görüşmeler (Yıllık)</small>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={3}>
                    <Card className="text-center border-success">
                      <Card.Body>
                        <FiBarChart size={24} className="text-success mb-2" />
                        <h4 className="text-success">
                          {formatNumber(
                            getYearlyTotalForField('whatsappIncoming') +
                            getYearlyTotalForField('callIncoming') +
                            getYearlyTotalForField('callOutgoing') +
                            getYearlyTotalForField('meetingNewCustomer') +
                            getYearlyTotalForField('meetingAfterSale')
                          )}
                        </h4>
                        <small>Toplam İletişim (Yıllık)</small>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                {/* Satış Verileri Özeti */}
                <Row className="mt-4">
                  <Col md={3}>
                    <Card className="text-center border-primary">
                      <Card.Body>
                        <FiBarChart size={24} className="text-primary mb-2" />
                        <h4 className="text-primary">{formatNumber(getTotalSalesForField('totalSales'))}</h4>
                        <small>Toplam Satış Adedi</small>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={3}>
                    <Card className="text-center border-success">
                      <Card.Body>
                        <FiBarChart size={24} className="text-success mb-2" />
                        <h4 className="text-success">{formatNumber(getTotalSalesForField('totalAmount'))} TL</h4>
                        <small>Toplam Ciro</small>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={3}>
                    <Card className="text-center border-warning">
                      <Card.Body>
                        <FiBarChart size={24} className="text-warning mb-2" />
                        <h4 className="text-warning">{formatNumber(getTotalSalesForField('totalPrim'))} TL</h4>
                        <small>Toplam Prim</small>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={3}>
                    <Card className="text-center border-danger">
                      <Card.Body>
                        <FiBarChart size={24} className="text-danger mb-2" />
                        <h4 className="text-danger">{formatNumber(getTotalSalesForField('cancellations'))}</h4>
                        <small>Toplam İptal</small>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                {/* Aylık Dağılım Tablosu */}
                <Card className="mt-4">
                  <Card.Header>
                    <h6 className="mb-0">Aylık Dağılım Özeti</h6>
                  </Card.Header>
                  <Card.Body className="p-0">
                    <Table responsive className="mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Ay</th>
                          <th>WhatsApp</th>
                          <th>Telefon</th>
                          <th>Görüşme</th>
                          <th>Toplam</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                          const monthTotal = 
                            getMonthlyTotalForField(month, 'whatsappIncoming') +
                            getMonthlyTotalForField(month, 'callIncoming') +
                            getMonthlyTotalForField(month, 'callOutgoing') +
                            getMonthlyTotalForField(month, 'meetingNewCustomer') +
                            getMonthlyTotalForField(month, 'meetingAfterSale');
                          
                          return (
                            <tr key={month} className={monthTotal > 0 ? '' : 'text-muted'}>
                              <td>
                                <strong>{getMonthName(month)}</strong>
                              </td>
                              <td>{formatNumber(getMonthlyTotalForField(month, 'whatsappIncoming'))}</td>
                              <td>
                                {formatNumber(
                                  getMonthlyTotalForField(month, 'callIncoming') + 
                                  getMonthlyTotalForField(month, 'callOutgoing')
                                )}
                              </td>
                              <td>
                                {formatNumber(
                                  getMonthlyTotalForField(month, 'meetingNewCustomer') + 
                                  getMonthlyTotalForField(month, 'meetingAfterSale')
                                )}
                              </td>
                              <td>
                                <Badge bg={monthTotal > 0 ? 'primary' : 'secondary'}>
                                  {formatNumber(monthTotal)}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              </Tab>
            </Tabs>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            İptal
          </Button>
          <Button 
            variant="success" 
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
          <Button 
            variant="primary" 
            onClick={async () => {
              await handleSaveYear();
              setShowModal(false);
            }}
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="spinner-border spinner-border-sm me-2" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <FiCheck className="me-1" />
                Kaydet ve Kapat
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Add Historical User Modal */}
      <Modal show={showAddUserModal} onHide={() => setShowAddUserModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <FiUsers className="me-2" />
            Eski Temsilci Ekle
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info" className="mb-3">
            <strong>Bilgi:</strong> Geçmiş yıllarda çalışmış olan ama artık sistemde olmayan temsilcileri ekleyebilirsiniz.
          </Alert>
          
          <Form>
            <Form.Group>
              <Form.Label>Temsilci Adı *</Form.Label>
              <Form.Control
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Örn: Ahmet Yılmaz"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddHistoricalUser();
                  }
                }}
              />
              <Form.Text className="text-muted">
                Eski temsilcinin tam adını girin
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAddUserModal(false)}>
            İptal
          </Button>
          <Button 
            variant="primary" 
            onClick={handleAddHistoricalUser}
            disabled={!newUserName.trim()}
          >
            <FiPlus className="me-1" />
            Ekle
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default HistoricalDataManagement;
