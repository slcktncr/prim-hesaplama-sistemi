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
import { toast } from 'react-toastify';

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

  // Prim hakedişlerini getir
  const fetchEarnings = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/prims/earnings-simple', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('✅ Yeni hakediş verileri:', data);
      
      setAllEarnings(data);
      setEarnings(data);
      
      // Dönemleri çıkar
      const uniquePeriods = [...new Set(data.map(item => item.periodName))].sort();
      setPeriods(uniquePeriods);
      
      // Temsilcileri çıkar
      const uniqueSalespersons = [...new Set(data.map(item => ({ 
        id: item.salespersonId, 
        name: item.salespersonName 
      })))];
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

  // Özet hesaplamaları
  const calculateTotals = () => {
    return earnings.reduce((totals, earning) => ({
      totalSales: totals.totalSales + earning.totalSalesAmount,
      totalCommissions: totals.totalCommissions + earning.totalCommissions,
      totalPending: totals.totalPending + earning.pendingAmount,
      totalDeductions: totals.totalDeductions + earning.deductionAmount
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
            <Button variant="success" onClick={() => {}}>
              <FiDownload className="me-2" />
              Rapor Al
            </Button>
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
              <small className="text-muted">Bekleyen Ödeme</small>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center border-danger">
            <Card.Body>
              <FiTrendingDown size={24} className="text-danger mb-2" />
              <h4 className="text-danger">{formatCurrency(totals.totalDeductions)}</h4>
              <small className="text-muted">Kesintiler</small>
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
                <th>Ek Ödemeler</th>
                <th>Kesintiler</th>
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
                      {earning.pendingAmount > 0 ? (
                        <Button 
                          variant="outline-warning" 
                          size="sm"
                          onClick={() => openDetailModal('pending', earning)}
                        >
                          <FiClock className="me-1" />
                          +{formatCurrency(earning.pendingAmount)}
                        </Button>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td>
                      {earning.deductionAmount > 0 ? (
                        <Button 
                          variant="outline-danger" 
                          size="sm"
                          onClick={() => openDetailModal('deduction', earning)}
                        >
                          <FiTrendingDown className="me-1" />
                          -{formatCurrency(earning.deductionAmount)}
                        </Button>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td>
                      <span className={`fw-bold ${earning.netAmount >= 0 ? 'text-success' : 'text-danger'}`}>
                        {formatCurrency(earning.netAmount)}
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
            {modalData?.type === 'pending' && '⏰ Bekleyen Ödemeler'}
            {modalData?.type === 'deduction' && '📉 Kesintiler'}
            {modalData?.type === 'detail' && '📊 Hakediş Detayı'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalData && (
            <div>
              <h6>{modalData.data.salespersonName} - {modalData.data.periodName}</h6>
              <p>Modal içeriği burada gösterilecek...</p>
              {/* TODO: Modal içeriği detaylandırılacak */}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
            Kapat
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default PrimEarningsNew;
