import React, { useState, useEffect, useContext } from 'react';
import { 
  Container, Row, Col, Card, Table, Badge, Button, 
  Form, Alert, Modal, Spinner 
} from 'react-bootstrap';
import { 
  FiUser, FiCalendar, FiDollarSign, FiTrendingUp, 
  FiTrendingDown, FiClock, FiEye, FiDownload 
} from 'react-icons/fi';
import { AuthContext } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { primsAPI } from '../../utils/api';
import { toast } from 'react-toastify';
import PrimTransactionStatusModal from '../Sales/PrimTransactionStatusModal';

const PrimEarningsNew = () => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState([]);
  const [allEarnings, setAllEarnings] = useState([]); // Filtrelenmemiş veri
  const [periods, setPeriods] = useState([]); // Dönemler
  const [salespersons, setSalespersons] = useState([]); // Temsilciler
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [selectedSalesperson, setSelectedSalesperson] = useState('all');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  // Prim hakedişlerini getir
  const fetchEarnings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      console.log('🆕 YENİ TEMİZ SİSTEM - Hakediş verileri getiriliyor...');
      const response = await primsAPI.getEarningsClean();
      const data = response.data;
      console.log('✅ Yeni hakediş verileri:', data);
      
      setAllEarnings(data);
      setEarnings(data);
      
      // Dönemleri çıkar
      const uniquePeriods = [...new Set(data.map(item => item.periodName))].sort();
      setPeriods(uniquePeriods);
      
      // Temsilcileri çıkar (tekrarları önle)
      const salespersonMap = new Map();
      data.forEach(item => {
        if (item.salespersonId && item.salespersonName) {
          salespersonMap.set(item.salespersonId, {
            id: item.salespersonId,
            name: item.salespersonName
          });
        }
      });
      const uniqueSalespersons = Array.from(salespersonMap.values()).sort((a, b) => a.name.localeCompare(b.name));
      setSalespersons(uniqueSalespersons);
      
      console.log('📊 Filtre verileri:', {
        periods: uniquePeriods,
        salespersons: uniqueSalespersons.map(s => s.name)
      });
    } catch (error) {
      console.error('❌ Hakediş getirme hatası:', error);
      toast.error(`Hakediş verileri getirilemedi: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEarnings();
  }, []);

  // Filtreleme
  useEffect(() => {
    let filtered = allEarnings;
    
    if (selectedPeriod !== 'all') {
      filtered = filtered.filter(earning => earning.periodName === selectedPeriod);
    }
    
    if (selectedSalesperson !== 'all') {
      filtered = filtered.filter(earning => earning.salespersonId === selectedSalesperson);
    }
    
    console.log('🔍 Filtrelenmiş veri:', {
      selectedPeriod,
      selectedSalesperson,
      originalCount: allEarnings.length,
      filteredCount: filtered.length
    });
    
    setEarnings(filtered);
  }, [selectedPeriod, selectedSalesperson, allEarnings]);

  // Detay modalını aç
  const openDetailModal = (type, data) => {
    setModalData({ type, data });
    setShowDetailModal(true);
  };

  // Status update callback
  const handleStatusUpdate = (newStatus) => {
    console.log('✅ Status updated:', newStatus);
    // Veriyi yeniden getir
    fetchEarnings();
  };

  // Transfer düzeltmesi
  const handleFixTransfer = async () => {
    try {
      console.log('🔧 Transfer düzeltmesi başlatılıyor...');
      const response = await primsAPI.fixTransferTransactions();
      console.log('✅ Transfer düzeltmesi response:', response.data);
      toast.success(`Transfer düzeltmesi tamamlandı: ${response.data.totalFixed} transaction güncellendi`);
      fetchEarnings(); // Veriyi yenile
    } catch (error) {
      console.error('❌ Transfer düzeltme hatası:', error);
      console.error('❌ Error response:', error.response?.data);
      toast.error('Transfer düzeltmesi başarısız: ' + (error.response?.data?.message || error.message));
    }
  };

  // Debug Sibel transactions
  const handleDebugSibel = async () => {
    try {
      console.log('🔍 Sibel Çekmez transaction debug başlatılıyor...');
      const response = await primsAPI.debugSibelTransactions();
      console.log('📊 SIBEL ÇEKMEZ DEBUG SONUCU:', response.data);
      toast.info('Debug sonucu console\'da görüntülendi');
    } catch (error) {
      console.error('❌ Debug hatası:', error);
      toast.error('Debug başarısız: ' + (error.response?.data?.message || error.message));
    }
  };

  // Özet hesaplamaları
  const calculateTotals = () => {
    return earnings.reduce((totals, earning) => ({
      totalSales: totals.totalSales + earning.totalSalesAmount,
      totalCommissions: totals.totalCommissions + earning.totalCommissions,
      totalPending: totals.totalPending + earning.pendingEarnings,
      totalDeductions: totals.totalDeductions + (earning.cancellationAmount + earning.modificationDeductions + earning.pendingDeductions)
    }), {
      totalSales: 0,
      totalCommissions: 0,
      totalPending: 0,
      totalDeductions: 0
    });
  };

  const totals = calculateTotals();

  if (loading) {
    return (
      <Container className="py-4">
        <div className="text-center">
          <Spinner animation="border" variant="primary" />
          <p className="mt-2">Hakediş verileri yükleniyor...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4">
      {/* Başlık */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h2 className="mb-1">💰 Prim Hakedişleri</h2>
              <p className="text-muted">Temsilci bazında prim hakediş özeti</p>
            </div>
            <div className="d-flex gap-2">
              <Button variant="info" size="sm" onClick={handleDebugSibel}>
                🔍 Debug Sibel
              </Button>
              <Button variant="warning" size="sm" onClick={handleFixTransfer}>
                🔧 Transfer Düzelt
              </Button>
              <Button variant="success" onClick={() => {}}>
                <FiDownload className="me-2" />
                Rapor Al
              </Button>
            </div>
          </div>
        </Col>
      </Row>

      {/* Filtreler */}
      <Row className="mb-4">
        <Col md={6}>
          <Form.Group>
            <Form.Label>Dönem</Form.Label>
            <Form.Select 
              value={selectedPeriod} 
              onChange={(e) => setSelectedPeriod(e.target.value)}
            >
              <option value="all">Tüm Dönemler</option>
              {periods.map(period => (
                <option key={period} value={period}>{period}</option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group>
            <Form.Label>Temsilci</Form.Label>
            <Form.Select 
              value={selectedSalesperson} 
              onChange={(e) => setSelectedSalesperson(e.target.value)}
            >
              <option value="all">Tüm Temsilciler</option>
              {salespersons.map(person => (
                <option key={person.id} value={person.id}>{person.name}</option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
      </Row>

      {/* Özet Kartları */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center border-primary">
            <Card.Body>
              <FiDollarSign size={24} className="text-primary mb-2" />
              <h4 className="text-primary">{formatCurrency(totals.totalSales)}</h4>
              <small className="text-muted">Toplam Satış</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center border-success">
            <Card.Body>
              <FiTrendingUp size={24} className="text-success mb-2" />
              <h4 className="text-success">{formatCurrency(totals.totalCommissions)}</h4>
              <small className="text-muted">Toplam Prim</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center border-warning">
            <Card.Body>
              <FiClock size={24} className="text-warning mb-2" />
              <h4 className="text-warning">{formatCurrency(totals.totalPending)}</h4>
              <small className="text-muted">Ek Prim Ödemesi</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center border-danger">
            <Card.Body>
              <FiTrendingDown size={24} className="text-danger mb-2" />
              <h4 className="text-danger">{formatCurrency(totals.totalDeductions)}</h4>
              <small className="text-muted">Değişiklik Kesintisi</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Ana Tablo */}
      <Card>
        <Card.Header>
          <h5 className="mb-0">Hakediş Detayları</h5>
        </Card.Header>
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0">
            <thead className="bg-light">
              <tr>
                <th><FiUser className="me-2" />Temsilci</th>
                <th><FiCalendar className="me-2" />Dönem</th>
                <th>Satış Sayısı</th>
                <th>Satış Tutarı</th>
                <th>Satış Primi</th>
                <th>Ek Prim Ödemesi</th>
                <th>Değişiklik Kesintisi</th>
                <th>Net Hakediş</th>
                <th>Durum</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {earnings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-4">
                    <div className="text-muted">
                      <FiUser size={48} className="mb-3" />
                      <p>Henüz hakediş verisi bulunmuyor</p>
                    </div>
                  </td>
                </tr>
              ) : (
                earnings.map((earning, index) => (
                  <tr key={index}>
                    <td>
                      <div className="d-flex align-items-center">
                        <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2" 
                             style={{ width: '32px', height: '32px' }}>
                          {earning.salespersonName?.charAt(0) || 'T'}
                        </div>
                        <div>
                          <div className="fw-bold">{earning.salespersonName}</div>
                          <small className="text-muted">Temsilci</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge bg="info">
                        {earning.periodName}
                      </Badge>
                    </td>
                    <td>
                      <span className="fw-bold">{earning.salesCount}</span>
                      <small className="text-muted d-block">satış</small>
                    </td>
                    <td>{formatCurrency(earning.totalSalesAmount)}</td>
                    <td>
                      <span className="text-success fw-bold">
                        {formatCurrency(earning.totalCommissions)}
                      </span>
                    </td>
                    <td>
                      {earning.pendingEarnings > 0 ? (
                        <Button 
                          variant="outline-warning" 
                          size="sm"
                          onClick={() => {
                            // Ek prim ödemesi transaction'ı bul
                            const pendingTransaction = earning.transactions?.find(t => 
                              t.type === 'kazanç' && t.status === 'beklemede'
                            );
                            if (pendingTransaction) {
                              setSelectedTransaction({
                                primTransactionId: pendingTransaction.id,
                                primDifference: pendingTransaction.amount,
                                salesperson: earning.salespersonName,
                                period: earning.periodName
                              });
                              setShowStatusModal(true);
                            }
                          }}
                        >
                          <FiClock className="me-1" />
                          +{formatCurrency(earning.pendingEarnings)}
                        </Button>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td>
                      {(earning.cancellationAmount + earning.modificationDeductions + earning.pendingDeductions) > 0 ? (
                        <Button 
                          variant="outline-danger" 
                          size="sm"
                          onClick={() => openDetailModal('deduction', earning)}
                        >
                          <FiTrendingDown className="me-1" />
                          -{formatCurrency(earning.cancellationAmount + earning.modificationDeductions + earning.pendingDeductions)}
                        </Button>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td>
                      <span className={`fw-bold ${earning.totalNet >= 0 ? 'text-success' : 'text-danger'}`}>
                        {formatCurrency(earning.totalNet)}
                      </span>
                    </td>
                    <td>
                      <Badge bg={earning.status === 'paid' ? 'success' : 'warning'}>
                        {earning.status === 'paid' ? 'Ödendi' : 'Beklemede'}
                      </Badge>
                    </td>
                    <td>
                      <Button 
                        variant="outline-primary" 
                        size="sm"
                        onClick={() => openDetailModal('detail', earning)}
                      >
                        <FiEye />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* Detay Modal */}
      <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {modalData?.type === 'pending' && '💰 Ek Prim Ödemesi'}
            {modalData?.type === 'deduction' && '📉 Değişiklik Kesintisi'}
            {modalData?.type === 'detail' && '📊 Hakediş Detayı'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalData && (
            <div>
              <div className="mb-4">
                <h5 className="text-primary mb-3">
                  {modalData.data.salespersonName} - {modalData.data.periodName}
                </h5>
                
                {/* Özet Bilgiler */}
                <Row className="mb-4">
                  <Col md={3}>
                    <Card className="text-center border-info">
                      <Card.Body className="py-2">
                        <div className="h6 text-info mb-1">{modalData.data.salesCount}</div>
                        <small className="text-muted">Satış Adedi</small>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={3}>
                    <Card className="text-center border-primary">
                      <Card.Body className="py-2">
                        <div className="h6 text-primary mb-1">{formatCurrency(modalData.data.totalSalesAmount)}</div>
                        <small className="text-muted">Satış Tutarı</small>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={3}>
                    <Card className="text-center border-success">
                      <Card.Body className="py-2">
                        <div className="h6 text-success mb-1">{formatCurrency(modalData.data.totalCommissions)}</div>
                        <small className="text-muted">Satış Primi</small>
                      </Card.Body>
                    </Card>
                  </Col>
                  <Col md={3}>
                    <Card className="text-center border-dark">
                      <Card.Body className="py-2">
                        <div className="h6 text-dark mb-1">{formatCurrency(modalData.data.totalNet)}</div>
                        <small className="text-muted">Net Hakediş</small>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>

                {/* Satışlar Listesi */}
                {modalData.data.sales && modalData.data.sales.length > 0 && (
                  <div className="mb-4">
                    <h6 className="text-secondary mb-3">🏢 Dönem Satışları ({modalData.data.sales.length} adet)</h6>
                    <div className="table-responsive">
                      <table className="table table-sm table-hover">
                        <thead className="table-light">
                          <tr>
                            <th>Müşteri</th>
                            <th>Blok/Daire</th>
                            <th>Satış Tarihi</th>
                            <th>Liste Fiyatı</th>
                            <th>Prim Tutarı</th>
                            <th>Prim Durumu</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modalData.data.sales.map((sale, index) => (
                            <tr key={index}>
                              <td className="fw-bold">{sale.customerName}</td>
                              <td><small className="text-muted">{sale.blockNo}/{sale.apartmentNo}</small></td>
                              <td><small>{formatDate(sale.saleDate)}</small></td>
                              <td>{formatCurrency(sale.listPrice || 0)}</td>
                              <td className="text-success">{formatCurrency(sale.primAmount || 0)}</td>
                              <td>
                                <Badge bg={sale.primStatus === 'ödendi' ? 'success' : 'warning'}>
                                  {sale.primStatus === 'ödendi' ? '✅ Ödendi' : '⏰ Ödenmedi'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Ek İşlemler */}
                {modalData.data.transactions && modalData.data.transactions.length > 0 && (
                  <div>
                    <h6 className="text-secondary mb-3">📋 Ek İşlemler</h6>
                    <div className="table-responsive">
                      <table className="table table-sm table-hover">
                        <thead className="table-light">
                          <tr>
                            <th>Tarih</th>
                            <th>İşlem Tipi</th>
                            <th>Tutar</th>
                            <th>Durum</th>
                            <th>Satış</th>
                            <th>Açıklama</th>
                          </tr>
                        </thead>
                        <tbody>
                          {modalData.data.transactions.map((transaction, index) => (
                            <tr key={index}>
                              <td>
                                <small>{formatDate(transaction.createdAt)}</small>
                              </td>
                              <td>
                                <Badge bg={transaction.type === 'kazanç' ? 'success' : 'danger'}>
                                  {transaction.type === 'kazanç' ? '💰 Ek Prim Ödemesi' : '📉 Değişiklik Kesintisi'}
                                </Badge>
                              </td>
                              <td>
                                <span className={transaction.type === 'kazanç' ? 'text-success' : 'text-danger'}>
                                  {transaction.type === 'kazanç' ? '+' : '-'}{formatCurrency(transaction.amount)}
                                </span>
                              </td>
                              <td>
                                <Badge bg={
                                  transaction.status === 'beklemede' ? 'warning' :
                                  transaction.status === 'onaylandı' ? 'success' : 'secondary'
                                }>
                                  {transaction.status === 'beklemede' ? '⏰ Bekleyen' :
                                   transaction.status === 'onaylandı' ? '✅ Onaylandı' : transaction.status}
                                </Badge>
                              </td>
                              <td>
                                <div>
                                  <div className="fw-bold">{transaction.sale?.customerName}</div>
                                  <small className="text-muted">{transaction.sale?.contractNo}</small>
                                </div>
                              </td>
                              <td>
                                <small className="text-muted">{transaction.description}</small>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Ek İşlem Yoksa */}
                {(!modalData.data.transactions || modalData.data.transactions.length === 0) && (
                  <Alert variant="info" className="text-center">
                    <FiUser className="mb-2" size={24} />
                    <p className="mb-0">Bu dönem için ek işlem bulunmuyor.</p>
                  </Alert>
                )}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
            Kapat
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Prim Transaction Status Modal */}
      <PrimTransactionStatusModal
        show={showStatusModal}
        onHide={() => setShowStatusModal(false)}
        transaction={selectedTransaction}
        onStatusUpdate={handleStatusUpdate}
      />
    </Container>
  );
};

export default PrimEarningsNew;
