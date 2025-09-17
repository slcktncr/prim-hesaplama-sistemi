import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Row, 
  Col, 
  Card, 
  Button, 
  Form, 
  Alert, 
  Table,
  Badge,
  Spinner
} from 'react-bootstrap';
import { 
  FaMoneyBillWave,
  FaCheck,
  FaTimes,
  FaInfoCircle
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { salesAPI, usersAPI } from '../../utils/api';

const BulkPrimStatusManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [newStatus, setNewStatus] = useState('ödendi');

  const months = [
    { value: '', label: 'Tüm Yıl' },
    { value: 1, label: 'Ocak' },
    { value: 2, label: 'Şubat' },
    { value: 3, label: 'Mart' },
    { value: 4, label: 'Nisan' },
    { value: 5, label: 'Mayıs' },
    { value: 6, label: 'Haziran' },
    { value: 7, label: 'Temmuz' },
    { value: 8, label: 'Ağustos' },
    { value: 9, label: 'Eylül' },
    { value: 10, label: 'Ekim' },
    { value: 11, label: 'Kasım' },
    { value: 12, label: 'Aralık' }
  ];

  const years = [
    2021, 2022, 2023, 2024, 2025, 2026
  ];

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await usersAPI.getUsersForFilters();
      // Sadece satış temsilcilerini göster
      const salespeople = response.data.filter(user => 
        user.role && user.role.name === 'salesperson'
      );
      setUsers(salespeople);
    } catch (error) {
      console.error('Users fetch error:', error);
      toast.error('Kullanıcılar yüklenirken hata oluştu');
    }
  };

  const handlePreview = async () => {
    if (!selectedUser) {
      toast.warning('Lütfen bir temsilci seçin');
      return;
    }

    try {
      setLoading(true);
      
      const filters = {
        salesperson: selectedUser,
        year: selectedYear
      };

      // Ay seçilmişse ekle
      if (selectedMonth) {
        filters.month = selectedMonth;
      }

      const response = await salesAPI.previewBulkPrimStatus(newStatus, filters);
      setPreviewData(response.data.summary);
      
    } catch (error) {
      console.error('Preview error:', error);
      if (error.response?.status === 404) {
        toast.warning('Seçilen kriterlere uygun satış bulunamadı');
        setPreviewData(null);
      } else {
        toast.error('Önizleme yüklenirken hata oluştu');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedUser) {
      toast.warning('Lütfen bir temsilci seçin');
      return;
    }

    const selectedUserName = getSelectedUserName();
    const monthName = months.find(m => m.value === selectedMonth)?.label || 'Tüm Yıl';
    
    const periodText = selectedMonth ? `${monthName} ${selectedYear} ayındaki` : `${selectedYear} yılındaki tüm`;
    const userText = selectedUser === 'ALL_SALESPEOPLE' ? 'tüm satış temsilcilerinin' : `${selectedUserName} temsilcisinin`;
    
    const confirmed = window.confirm(
      `${userText} ${periodText} satışlarının prim durumunu "${newStatus}" olarak değiştirmek istediğinizden emin misiniz?`
    );
    
    if (!confirmed) return;

    try {
      setLoading(true);
      
      const filters = {
        salesperson: selectedUser,
        year: selectedYear
      };

      // Ay seçilmişse ekle
      if (selectedMonth) {
        filters.month = selectedMonth;
      }

      const response = await salesAPI.bulkUpdatePrimStatus(newStatus, filters);
      
      if (response.data.success) {
        toast.success(response.data.message);
        setPreviewData(null);
        // Formu sıfırla
        setSelectedUser('');
        setSelectedMonth('');
        setSelectedYear(new Date().getFullYear());
        setNewStatus('ödendi');
      }
      
    } catch (error) {
      console.error('Update error:', error);
      if (error.response?.status === 404) {
        toast.warning('Seçilen kriterlere uygun satış bulunamadı');
      } else {
        toast.error(error.response?.data?.message || 'Güncelleme sırasında hata oluştu');
      }
    } finally {
      setLoading(false);
    }
  };

  const getSelectedUserName = () => {
    if (selectedUser === 'ALL_SALESPEOPLE') {
      return 'Tüm Satış Temsilcileri';
    }
    const user = users.find(u => u._id === selectedUser);
    return user ? user.name : '';
  };

  const getSelectedMonthName = () => {
    const month = months.find(m => m.value === selectedMonth);
    return month ? month.label : '';
  };

  return (
    <Container fluid className="py-4">
      <Row>
        <Col>
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h2 className="mb-1">
                <FaMoneyBillWave className="me-2 text-success" />
                Toplu Prim Durumu Yönetimi
              </h2>
              <p className="text-muted mb-0">
                Temsilci ve aya göre prim durumlarını toplu olarak değiştirin
              </p>
            </div>
          </div>

          <Card>
            <Card.Header>
              <h5 className="mb-0">
                <FaInfoCircle className="me-2" />
                Filtreler
              </h5>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>Temsilci *</Form.Label>
                    <Form.Select
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      required
                    >
                      <option value="">Temsilci Seçin</option>
                      <option value="ALL_SALESPEOPLE">🎯 Tüm Satış Temsilcileri</option>
                      {users.map(user => (
                        <option key={user._id} value={user._id}>
                          {user.name}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={2}>
                  <Form.Group className="mb-3">
                    <Form.Label>Ay</Form.Label>
                    <Form.Select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value === '' ? '' : parseInt(e.target.value))}
                    >
                      {months.map(month => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={2}>
                  <Form.Group className="mb-3">
                    <Form.Label>Yıl *</Form.Label>
                    <Form.Select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    >
                      {years.map(year => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={2}>
                  <Form.Group className="mb-3">
                    <Form.Label>Yeni Durum *</Form.Label>
                    <Form.Select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                    >
                      <option value="ödendi">Ödendi</option>
                      <option value="ödenmedi">Ödenmedi</option>
                    </Form.Select>
                  </Form.Group>
                </Col>

                <Col md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>&nbsp;</Form.Label>
                    <div className="d-grid gap-2">
                      <Button 
                        variant="info" 
                        onClick={handlePreview}
                        disabled={loading || !selectedUser}
                      >
                        {loading ? (
                          <>
                            <Spinner as="span" animation="border" size="sm" className="me-2" />
                            Yükleniyor...
                          </>
                        ) : (
                          <>
                            <FaInfoCircle className="me-2" />
                            Önizleme
                          </>
                        )}
                      </Button>
                    </div>
                  </Form.Group>
                </Col>
              </Row>

              {selectedUser && (
                <Alert variant="info" className="mt-3">
                  <strong>Seçili Kriterler:</strong><br />
                  Temsilci: {getSelectedUserName()}<br />
                  Dönem: {selectedMonth ? `${getSelectedMonthName()} ${selectedYear}` : `${selectedYear} (Tüm Yıl)`}<br />
                  Yeni Durum: <Badge bg={newStatus === 'ödendi' ? 'success' : 'warning'}>{newStatus}</Badge>
                </Alert>
              )}
            </Card.Body>
          </Card>

          {previewData && (
            <Card className="mt-4">
              <Card.Header className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">
                  <FaInfoCircle className="me-2" />
                  Önizleme Sonucu
                </h5>
                <Badge bg="primary">{previewData.totalUpdated} satış bulundu</Badge>
              </Card.Header>
              <Card.Body>
                <Alert variant="warning" className="mb-3">
                  <FaInfoCircle className="me-2" />
                  <strong>{previewData.totalUpdated}</strong> adet satışın prim durumu 
                  <strong> "{previewData.newStatus}"</strong> olarak değiştirilecek.
                  {selectedUser === 'ALL_SALESPEOPLE' && (
                    <><br /><strong>⚠️ Bu işlem TÜM SATIŞ TEMSİLCİLERİNİ etkileyecek!</strong></>
                  )}
                </Alert>

                {previewData.affectedSales && previewData.affectedSales.length > 0 && (
                  <div>
                    <h6>Etkilenecek Satışlar (İlk 10 tanesi):</h6>
                    <Table striped hover size="sm">
                      <thead>
                        <tr>
                          <th>Müşteri</th>
                          <th>Sözleşme No</th>
                          {selectedUser === 'ALL_SALESPEOPLE' && <th>Temsilci</th>}
                          <th>Prim Tutarı</th>
                          <th>Mevcut Durum</th>
                          <th>Satış Tarihi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.affectedSales.slice(0, 10).map((sale, index) => (
                          <tr key={index}>
                            <td>{sale.customerName}</td>
                            <td>{sale.contractNo}</td>
                            {selectedUser === 'ALL_SALESPEOPLE' && <td>{sale.salesperson}</td>}
                            <td>{sale.primAmount?.toLocaleString('tr-TR')} ₺</td>
                            <td>
                              <Badge bg={sale.oldStatus === 'ödendi' ? 'success' : 'warning'}>
                                {sale.oldStatus}
                              </Badge>
                            </td>
                            <td>{new Date(sale.saleDate).toLocaleDateString('tr-TR')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                    
                    {previewData.affectedSales.length > 10 && (
                      <Alert variant="info" className="mt-2">
                        <FaInfoCircle className="me-2" />
                        Sadece ilk 10 kayıt gösteriliyor. Toplam {previewData.totalUpdated} kayıt etkilenecek.
                      </Alert>
                    )}
                  </div>
                )}

                <div className="d-flex gap-2 mt-3">
                  <Button 
                    variant="success" 
                    onClick={handleUpdate}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Spinner as="span" animation="border" size="sm" className="me-2" />
                        Güncelleniyor...
                      </>
                    ) : (
                      <>
                        <FaCheck className="me-2" />
                        Onayla ve Güncelle
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    variant="secondary" 
                    onClick={() => setPreviewData(null)}
                  >
                    <FaTimes className="me-2" />
                    İptal
                  </Button>
                </div>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default BulkPrimStatusManagement;