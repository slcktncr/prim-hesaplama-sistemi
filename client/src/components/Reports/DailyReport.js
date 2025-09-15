import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Form, 
  Button, 
  Table, 
  Badge, 
  Alert,
  Tab,
  Nav,
  ProgressBar
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  FiCalendar, 
  FiTrendingUp, 
  FiUsers, 
  FiPhone, 
  FiMessageSquare,
  FiDollarSign,
  FiBarChart2,
  FiClock,
  FiRefreshCw,
  FiDownload
} from 'react-icons/fi';
import { reportsAPI } from '../../utils/api';
import { formatCurrency, formatNumber, getTodayDateString, formatDateTime } from '../../utils/helpers';
import Loading from '../Common/Loading';

const DailyReport = () => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDailyReport();
  }, [selectedDate]);

  const fetchDailyReport = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await reportsAPI.getDailyReport({ date: selectedDate });
      
      if (response.data.success) {
        setReportData(response.data.data);
      } else {
        throw new Error(response.data.message || 'Rapor yüklenemedi');
      }
    } catch (error) {
      console.error('Daily report fetch error:', error);
      setError(error.response?.data?.message || 'Günlük rapor yüklenirken hata oluştu');
      toast.error('Günlük rapor yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const getSaleTypeDisplayName = (saleType) => {
    const typeNames = {
      'satis': 'Normal Satış',
      'kapora': 'Kapora',
      'yazlik': 'Yazlık Ev',
      'kislik': 'Kışlık Ev',
      'manuel': 'Manuel'
    };
    return typeNames[saleType] || saleType;
  };

  const getSaleTypeBadgeColor = (saleType) => {
    const colors = {
      'satis': 'success',
      'kapora': 'warning',
      'yazlik': 'info',
      'kislik': 'primary',
      'manuel': 'secondary'
    };
    return colors[saleType] || 'secondary';
  };

  if (loading) {
    return <Loading variant="pulse" size="large" />;
  }

  const { dailyStats, salesByType, communicationData, topUsers, hourlyDistribution, summary } = reportData || {};

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>📊 Detaylı Günlük Rapor</h1>
          <p className="text-muted mb-0">
            Günlük tüm hareketler ve detaylı analizler
          </p>
        </div>
      </div>

      {/* Tarih Seçici */}
      <Card className="mb-4">
        <Card.Body>
          <Row className="align-items-end">
            <Col md={3}>
              <Form.Group>
                <Form.Label>📅 Rapor Tarihi</Form.Label>
                <Form.Control
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={2}>
              <Button 
                variant="primary" 
                onClick={fetchDailyReport}
                disabled={loading}
                className="w-100"
              >
                <FiRefreshCw className={`me-1 ${loading ? 'spin' : ''}`} />
                Yenile
              </Button>
            </Col>
            <Col md={2}>
              <Button 
                variant="outline-success" 
                onClick={() => setSelectedDate(getTodayDateString())}
                className="w-100"
              >
                <FiCalendar className="me-1" />
                Bugün
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {error && (
        <Alert variant="danger" className="mb-4">
          <strong>Hata:</strong> {error}
        </Alert>
      )}

      {reportData && (
        <>
          {/* Özet İstatistikler */}
          <Row className="mb-4">
            {/* Normal Satış Kartı */}
            <Col lg={3} md={6} className="mb-3">
              <Card className="h-100 border-primary">
                <Card.Body className="text-center">
                  <FiTrendingUp className="display-4 text-primary mb-2" />
                  <h3 className="text-primary">{formatNumber(dailyStats.salesBreakdown?.regular?.count || 0)}</h3>
                  <p className="text-muted mb-0">Normal Satış</p>
                  <small className="text-success">
                    {formatCurrency(dailyStats.salesBreakdown?.regular?.totalAmount || 0)} ciro
                  </small>
                </Card.Body>
              </Card>
            </Col>

            {/* Kapora Kartı */}
            <Col lg={3} md={6} className="mb-3">
              <Card className="h-100 border-secondary">
                <Card.Body className="text-center">
                  <FiDollarSign className="display-4 text-secondary mb-2" />
                  <h3 className="text-secondary">{formatNumber(dailyStats.salesBreakdown?.kapora?.count || 0)}</h3>
                  <p className="text-muted mb-0">Kapora</p>
                  <small className="text-secondary">
                    {formatCurrency(dailyStats.salesBreakdown?.kapora?.totalAmount || 0)} tutar
                  </small>
                </Card.Body>
              </Card>
            </Col>

            {/* Detaylı İletişim Kartı */}
            <Col lg={3} md={6} className="mb-3">
              <Card className="h-100 border-warning">
                <Card.Body className="text-center">
                  <FiUsers className="display-4 text-warning mb-2" />
                  <h3 className="text-warning">{formatNumber(dailyStats.totalContacts)}</h3>
                  <p className="text-muted mb-0">Toplam İletişim</p>
                  <div className="mt-2">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <small className="text-muted">📞 Gelen Arama:</small>
                      <Badge bg="info">{formatNumber(dailyStats.communicationBreakdown?.callIncoming || 0)}</Badge>
                    </div>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <small className="text-muted">📞 Giden Arama:</small>
                      <Badge bg="primary">{formatNumber(dailyStats.communicationBreakdown?.callOutgoing || 0)}</Badge>
                    </div>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <small className="text-muted">💬 WhatsApp:</small>
                      <Badge bg="success">{formatNumber(dailyStats.communicationBreakdown?.whatsappIncoming || 0)}</Badge>
                    </div>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <small className="text-muted">👤 Yeni Müşteri:</small>
                      <Badge bg="warning">{formatNumber(dailyStats.communicationBreakdown?.newCustomerMeetings || 0)}</Badge>
                    </div>
                    <div className="d-flex justify-content-between align-items-center">
                      <small className="text-muted">🤝 Satış Sonrası:</small>
                      <Badge bg="secondary">{formatNumber(dailyStats.communicationBreakdown?.meetingAfterSale || 0)}</Badge>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {/* Toplam Prim Kartı */}
            <Col lg={3} md={6} className="mb-3">
              <Card className="h-100 border-success">
                <Card.Body className="text-center">
                  <FiDollarSign className="display-4 text-success mb-2" />
                  <h3 className="text-success">{formatCurrency(dailyStats.totalPrim)}</h3>
                  <p className="text-muted mb-0">Toplam Prim</p>
                  <div className="mt-2">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <small className="text-muted">Normal Satış:</small>
                      <Badge bg="success">{formatCurrency(dailyStats.salesBreakdown?.regular?.totalPrim || 0)}</Badge>
                    </div>
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <small className="text-muted">Kapora:</small>
                      <Badge bg="secondary">{formatCurrency(dailyStats.salesBreakdown?.kapora?.totalPrim || 0)}</Badge>
                    </div>
                    <div className="d-flex justify-content-between align-items-center">
                      <small className="text-success">👥 {dailyStats.activeUsers} aktif kullanıcı</small>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Performans Metrikleri */}
          <Row className="mb-4">
            <Col md={4}>
              <Card className="h-100">
                <Card.Body>
                  <h6 className="text-muted">📈 Ortalama Satış Tutarı</h6>
                  <h4 className="text-primary">{formatCurrency(summary?.averageRevenuePerSale || 0)}</h4>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="h-100">
                <Card.Body>
                  <h6 className="text-muted">🎯 İletişim Verimliliği</h6>
                  <h4 className="text-success">%{(summary?.communicationEfficiency || 0).toFixed(1)}</h4>
                  <ProgressBar 
                    now={summary?.communicationEfficiency || 0} 
                    max={100} 
                    variant="success" 
                    className="mt-2"
                  />
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="h-100">
                <Card.Body>
                  <h6 className="text-muted">🔄 Toplam İşlem</h6>
                  <h4 className="text-info">{formatNumber(summary?.totalTransactions || 0)}</h4>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Detaylı Veriler */}
          <Tab.Container defaultActiveKey="sales">
            <Nav variant="tabs" className="mb-4">
              <Nav.Item>
                <Nav.Link eventKey="sales">
                  <FiTrendingUp className="me-2" />
                  Satış Detayları
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="communications">
                  <FiPhone className="me-2" />
                  İletişim Detayları
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="analytics">
                  <FiBarChart2 className="me-2" />
                  Analitik
                </Nav.Link>
              </Nav.Item>
            </Nav>

            <Tab.Content>
              {/* Satış Detayları */}
              <Tab.Pane eventKey="sales">
                <Row>
                  {Object.entries(salesByType || {}).map(([saleType, data]) => (
                    <Col lg={6} key={saleType} className="mb-4">
                      <Card>
                        <Card.Header className="d-flex justify-content-between align-items-center">
                          <h6 className="mb-0">
                            <Badge bg={getSaleTypeBadgeColor(saleType)} className="me-2">
                              {getSaleTypeDisplayName(saleType)}
                            </Badge>
                            {data.count} adet
                          </h6>
                          <div className="text-end">
                            <div className="small text-muted">Toplam Ciro</div>
                            <strong>{formatCurrency(data.totalAmount)}</strong>
                          </div>
                        </Card.Header>
                        <Card.Body style={{ maxHeight: '300px', overflowY: 'auto' }}>
                          {data.sales?.map((sale, index) => (
                            <div key={sale._id} className="border-bottom py-2">
                              <div className="d-flex justify-content-between">
                                <div>
                                  <strong>{sale.customerName}</strong>
                                  <div className="small text-muted">
                                    Blok {sale.blockNo} - Daire {sale.apartmentNo}
                                  </div>
                                  <div className="small text-primary">
                                    👤 {sale.salesperson}
                                  </div>
                                </div>
                                <div className="text-end">
                                  <div>{formatCurrency(sale.listPrice)}</div>
                                  <div className="small text-success">
                                    Prim: {formatCurrency(sale.primAmount)}
                                  </div>
                                  <div className="small text-muted">
                                    {formatDateTime(sale.createdAt)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Tab.Pane>

              {/* İletişim Detayları */}
              <Tab.Pane eventKey="communications">
                <Row>
                  <Col lg={6} className="mb-4">
                    <Card>
                      <Card.Header>
                        <h6 className="mb-0">📞 En Aktif Kullanıcılar</h6>
                      </Card.Header>
                      <Card.Body>
                        {topUsers?.map((user, index) => (
                          <div key={user._id} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                            <div>
                              <Badge bg="primary" className="me-2">#{index + 1}</Badge>
                              <strong>{user.userName}</strong>
                            </div>
                            <div className="text-end">
                              <div className="small">
                                📞 {user.totalCalls} | 💬 {user.whatsappCount}
                              </div>
                              <div className="small text-muted">
                                Toplam: {user.totalContacts} iletişim
                              </div>
                            </div>
                          </div>
                        ))}
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  <Col lg={6} className="mb-4">
                    <Card>
                      <Card.Header>
                        <h6 className="mb-0">📊 İletişim Özeti</h6>
                      </Card.Header>
                      <Card.Body>
                        <Table size="sm" className="mb-0">
                          <tbody>
                            <tr>
                              <td>📞 Toplam Arama</td>
                              <td className="text-end"><strong>{formatNumber(dailyStats.totalCommunications)}</strong></td>
                            </tr>
                            <tr>
                              <td>💬 WhatsApp</td>
                              <td className="text-end"><strong>{formatNumber(dailyStats.totalWhatsApp)}</strong></td>
                            </tr>
                            <tr>
                              <td>👥 Toplam İletişim</td>
                              <td className="text-end"><strong>{formatNumber(dailyStats.totalContacts)}</strong></td>
                            </tr>
                            <tr>
                              <td>🆕 Yeni Müşteri</td>
                              <td className="text-end"><strong>{formatNumber(dailyStats.totalNewCustomers)}</strong></td>
                            </tr>
                            <tr className="table-success">
                              <td><strong>👤 Aktif Kullanıcı</strong></td>
                              <td className="text-end"><strong>{formatNumber(dailyStats.activeUsers)}</strong></td>
                            </tr>
                          </tbody>
                        </Table>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Tab.Pane>

              {/* Analitik */}
              <Tab.Pane eventKey="analytics">
                <Row>
                  <Col lg={12} className="mb-4">
                    <Card>
                      <Card.Header>
                        <h6 className="mb-0">🕐 Saatlik Satış Dağılımı</h6>
                      </Card.Header>
                      <Card.Body>
                        {hourlyDistribution && hourlyDistribution.length > 0 ? (
                          <div className="row">
                            {hourlyDistribution.map((hour) => (
                              <div key={hour._id} className="col-md-2 col-sm-3 col-4 mb-3">
                                <div className="text-center p-2 border rounded">
                                  <div className="small text-muted">{hour._id}:00</div>
                                  <div className="h5 mb-1">{hour.count}</div>
                                  <div className="small text-success">
                                    {formatCurrency(hour.totalAmount)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <Alert variant="info">Bu tarihte saatlik veri bulunmamaktadır.</Alert>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Tab.Pane>
            </Tab.Content>
          </Tab.Container>
        </>
      )}

      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default DailyReport;
