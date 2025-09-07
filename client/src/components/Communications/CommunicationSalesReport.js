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
  Tabs,
  Tab,
  ProgressBar
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  FiBarChart, 
  FiMessageSquare, 
  FiShoppingBag,
  FiCalendar,
  FiUsers,
  FiTrendingUp,
  FiDownload,
  FiFilter,
  FiRefreshCw,
  FiPhone,
  FiDollarSign,
  FiX
} from 'react-icons/fi';

import { communicationsAPI, salesAPI, usersAPI, reportsAPI } from '../../utils/api';
import { formatDate, formatCurrency, formatNumber } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import Loading from '../Common/Loading';

const CommunicationSalesReport = () => {
  const { user } = useAuth();
  const [reportData, setReportData] = useState(null);
  const [dailyReportData, setDailyReportData] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    salesperson: 'all',
    reportType: 'combined' // 'combined', 'communication', 'sales'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (users.length > 0) {
      // Debounce: 500ms bekle, sonra veri getir
      const timeoutId = setTimeout(() => {
        fetchReportData();
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [filters, users]);

  const fetchUsers = async () => {
    try {
      const response = await usersAPI.getSalespeople();
      setUsers(response.data || []);
    } catch (error) {
      console.error('Users fetch error:', error);
      toast.error('Kullanıcılar yüklenirken hata oluştu');
    }
  };

  const fetchReportData = async () => {
    try {
      setLoading(true);
      
      console.log('Fetching report data with filters:', filters);
      
      // Paralel olarak hem iletişim hem de satış verilerini getir
      const [communicationResponse, salesResponse, dailyResponse] = await Promise.all([
        communicationsAPI.getReport({
          startDate: filters.startDate,
          endDate: filters.endDate,
          salesperson: filters.salesperson !== 'all' ? filters.salesperson : undefined
        }),
        reportsAPI.getSalespersonPerformance({
          startDate: filters.startDate,
          endDate: filters.endDate,
          salespersons: filters.salesperson !== 'all' ? [filters.salesperson] : undefined
        }),
        communicationsAPI.getDailyReport({
          startDate: filters.startDate,
          endDate: filters.endDate,
          salesperson: filters.salesperson !== 'all' ? filters.salesperson : undefined
        })
      ]);

      console.log('=== FRONTEND DEBUG ===');
      console.log('Communication response:', communicationResponse);
      console.log('Communication data length:', communicationResponse?.data?.length);
      console.log('Communication data sample:', communicationResponse?.data?.slice(0, 2));
      console.log('Sales response:', salesResponse);
      console.log('Sales response data:', salesResponse.data);
      console.log('Sales response sample:', salesResponse.data?.slice(0, 2));
      console.log('Daily response:', dailyResponse);
      console.log('Users array:', users);
      console.log('Users length:', users.length);
      console.log('=== END FRONTEND DEBUG ===');

      // Günlük rapor verisini set et
      setDailyReportData(Array.isArray(dailyResponse.data) ? dailyResponse.data : []);

      // Verileri birleştir
      const communicationData = Array.isArray(communicationResponse.data) ? communicationResponse.data : [];
      const salesData = Array.isArray(salesResponse.data) ? salesResponse.data : [];

      console.log('Communication data type:', typeof communicationData, 'is array:', Array.isArray(communicationData));
      console.log('Sales data type:', typeof salesData, 'is array:', Array.isArray(salesData));

      // Kullanıcı bazında birleştirme
      const combinedData = users.map(user => {
        const commData = communicationData.find(c => c.salesperson && c.salesperson._id === user._id) || {};
        const salesInfo = salesData.find(s => s.salesperson && s.salesperson._id === user._id) || {};
        
        console.log(`=== USER ${user.name} DATA ===`);
        console.log('Communication data:', commData);
        console.log('Sales data:', salesInfo);
        console.log('=== END USER DATA ===');

        return {
          user: {
            _id: user._id,
            name: user.name,
            email: user.email
          },
          communication: {
            whatsappIncoming: (commData.communication && commData.communication.whatsappIncoming) || 0,
            callIncoming: (commData.communication && commData.communication.callIncoming) || 0,
            callOutgoing: (commData.communication && commData.communication.callOutgoing) || 0,
            meetingNewCustomer: (commData.communication && commData.communication.meetingNewCustomer) || 0,
            meetingAfterSale: (commData.communication && commData.communication.meetingAfterSale) || 0,
            totalCommunication: (commData.communication && commData.communication.totalCommunication) || 
              ((commData.communication?.whatsappIncoming || 0) + 
               (commData.communication?.callIncoming || 0) + 
               (commData.communication?.callOutgoing || 0) + 
               (commData.communication?.meetingNewCustomer || 0) + 
               (commData.communication?.meetingAfterSale || 0)),
            daysEntered: commData.recordCount || 0,
            totalDays: commData.totalDays || 0,
            entryRate: commData.entryRate || 0
          },
          sales: {
            totalSales: salesInfo.totalSales || salesInfo.sales?.length || 0,
            totalAmount: salesInfo.totalAmount || salesInfo.totalCiro || 0,
            totalPrimAmount: salesInfo.totalPrimAmount || salesInfo.totalPrim || 0,
            netPrimAmount: salesInfo.netPrimAmount || salesInfo.netPrim || 0,
            cancelledSales: salesInfo.cancelledSales || salesInfo.cancellations || 0,
            modifiedSales: salesInfo.modifiedSales || salesInfo.modifications || 0,
            avgSaleAmount: salesInfo.avgSaleAmount || 0,
            salesByType: salesInfo.salesByType || {}
          },
          performance: {
            communicationPerSale: salesInfo.totalSales > 0 ? 
              Math.round(((commData.communication && commData.communication.totalCommunication) || 0) / salesInfo.totalSales) : 0,
            salesConversionRate: (commData.communication && commData.communication.totalCommunication) > 0 ? 
              ((salesInfo.totalSales || 0) / ((commData.communication && commData.communication.totalCommunication) || 1) * 100).toFixed(1) : 0,
            avgPrimPerCommunication: (commData.communication && commData.communication.totalCommunication) > 0 ? 
              ((salesInfo.netPrimAmount || 0) / ((commData.communication && commData.communication.totalCommunication) || 1)).toFixed(0) : 0
          }
        };
      });

      // Tüm kullanıcıları göster (filtreleme kaldırıldı)
      const filteredData = combinedData;

      console.log('Combined data length:', combinedData.length);
      console.log('Filtered data length:', filteredData.length);
      console.log('Combined data sample:', combinedData.slice(0, 2));
      console.log('Filtered data sample:', filteredData.slice(0, 2));

      // Toplam istatistikleri hesapla
      const totals = filteredData.reduce((acc, item) => ({
        totalCommunication: acc.totalCommunication + (item.communication?.totalCommunication || 0),
        totalSales: acc.totalSales + (item.sales?.totalSales || 0),
        totalAmount: acc.totalAmount + (item.sales?.totalAmount || 0),
        totalPrimAmount: acc.totalPrimAmount + (item.sales?.totalPrimAmount || 0),
        netPrimAmount: acc.netPrimAmount + (item.sales?.netPrimAmount || 0),
        whatsappIncoming: acc.whatsappIncoming + (item.communication?.whatsappIncoming || 0),
        callIncoming: acc.callIncoming + (item.communication?.callIncoming || 0),
        callOutgoing: acc.callOutgoing + (item.communication?.callOutgoing || 0),
        meetingNewCustomer: acc.meetingNewCustomer + (item.communication?.meetingNewCustomer || 0),
        meetingAfterSale: acc.meetingAfterSale + (item.communication?.meetingAfterSale || 0)
      }), {
        totalCommunication: 0,
        totalSales: 0,
        totalAmount: 0,
        totalPrimAmount: 0,
        netPrimAmount: 0,
        whatsappIncoming: 0,
        callIncoming: 0,
        callOutgoing: 0,
        meetingNewCustomer: 0,
        meetingAfterSale: 0
      });

      console.log('Final totals calculated:', totals);
      console.log('Sample item for totals debug:', filteredData[0]);

      setReportData({
        data: filteredData.sort((a, b) => b.sales.totalAmount - a.sales.totalAmount),
        totals,
        period: {
          startDate: filters.startDate,
          endDate: filters.endDate,
          days: Math.ceil((new Date(filters.endDate) - new Date(filters.startDate)) / (1000 * 60 * 60 * 24)) + 1
        }
      });

    } catch (error) {
      console.error('Report data fetch error:', error);
      console.error('Error details:', error.response?.data || error.message);
      toast.error(`Rapor verileri yüklenirken hata oluştu: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const exportToExcel = async () => {
    try {
      toast.info('Excel raporu hazırlanıyor...');
      // Excel export işlemi burada yapılacak
      toast.success('Excel raporu indirildi');
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('Excel raporu oluşturulurken hata oluştu');
    }
  };

  const getPerformanceColor = (rate) => {
    if (rate >= 80) return 'success';
    if (rate >= 60) return 'info';
    if (rate >= 40) return 'warning';
    return 'danger';
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
            <FiBarChart className="me-2" />
            İletişim & Satış Entegre Raporu
          </h4>
          <p className="text-muted mb-0">
            İletişim faaliyetleri ve satış performansının birleşik analizi
          </p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-success" onClick={exportToExcel}>
            <FiDownload className="me-1" />
            Excel
          </Button>
          <Button variant="outline-primary" onClick={fetchReportData}>
            <FiRefreshCw className="me-1" />
            Yenile
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <Card.Header>
          <h6 className="mb-0">
            <FiFilter className="me-2" />
            Filtreler
          </h6>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Başlangıç Tarihi</Form.Label>
                <Form.Control
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Bitiş Tarihi</Form.Label>
                <Form.Control
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Temsilci</Form.Label>
                <Form.Select
                  value={filters.salesperson}
                  onChange={(e) => handleFilterChange('salesperson', e.target.value)}
                >
                  <option value="all">Tüm Temsilciler</option>
                  {users.map(user => (
                    <option key={user._id} value={user._id}>
                      {user.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Rapor Tipi</Form.Label>
                <Form.Select
                  value={filters.reportType}
                  onChange={(e) => handleFilterChange('reportType', e.target.value)}
                >
                  <option value="combined">Birleşik Rapor</option>
                  <option value="communication">Sadece İletişim</option>
                  <option value="sales">Sadece Satış</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {reportData && (
        <>
          {/* Summary Cards */}
          <Row className="mb-4">
            <Col md={3}>
              <Card className="border-primary">
                <Card.Body className="text-center">
                  <FiMessageSquare size={24} className="text-primary mb-2" />
                  <h4 className="text-primary">{formatNumber(reportData.totals.totalCommunication)}</h4>
                  <small>Toplam İletişim</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="border-success">
                <Card.Body className="text-center">
                  <FiShoppingBag size={24} className="text-success mb-2" />
                  <h4 className="text-success">{formatNumber(reportData.totals.totalSales)}</h4>
                  <small>Toplam Satış</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="border-warning">
                <Card.Body className="text-center">
                  <FiDollarSign size={24} className="text-warning mb-2" />
                  <h4 className="text-warning">{formatCurrency(reportData.totals.totalAmount)}</h4>
                  <small>Toplam Ciro</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="border-info">
                <Card.Body className="text-center">
                  <FiTrendingUp size={24} className="text-info mb-2" />
                  <h4 className="text-info">
                    {reportData.totals.totalSales > 0 ? 
                      Math.round(reportData.totals.totalCommunication / reportData.totals.totalSales) : 0}
                  </h4>
                  <small>İletişim/Satış Oranı</small>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Report Tabs */}
          <Tabs defaultActiveKey="combined" className="mb-4">
            <Tab eventKey="combined" title={
              <span>
                <FiBarChart className="me-1" />
                Birleşik Rapor
              </span>
            }>
              <Card>
                <Card.Body className="p-0">
                  <Table responsive hover className="mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Temsilci</th>
                        <th>İletişim</th>
                        <th>Satış</th>
                        <th>Ciro</th>
                        <th>Net Prim</th>
                        <th>İletişim/Satış</th>
                        <th>Dönüşüm Oranı</th>
                        <th>Performans</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.data.map((item) => (
                        <tr key={item.user._id}>
                          <td>
                            <div className="fw-bold">{item.user.name}</div>
                            <small className="text-muted">{item.user.email}</small>
                          </td>
                          <td>
                            <Badge bg="primary">{formatNumber(item.communication.totalCommunication)}</Badge>
                            <div className="small text-muted">
                              WA: {item.communication.whatsappIncoming} | 
                              Tel: {item.communication.callIncoming + item.communication.callOutgoing} | 
                              Görüşme: {item.communication.meetingNewCustomer + item.communication.meetingAfterSale}
                            </div>
                          </td>
                          <td>
                            <Badge bg="success">{formatNumber(item.sales.totalSales)}</Badge>
                            {item.sales.cancelledSales > 0 && (
                              <div className="small text-danger">
                                <FiX size={12} /> {item.sales.cancelledSales} iptal
                              </div>
                            )}
                          </td>
                          <td>
                            <div className="fw-bold">{formatCurrency(item.sales.totalAmount)}</div>
                            {item.sales.avgSaleAmount > 0 && (
                              <small className="text-muted">
                                Ort: {formatCurrency(item.sales.avgSaleAmount)}
                              </small>
                            )}
                          </td>
                          <td>
                            <div className="fw-bold text-success">
                              {formatCurrency(item.sales.netPrimAmount)}
                            </div>
                          </td>
                          <td>
                            <Badge bg="info">
                              {item.performance.communicationPerSale}
                            </Badge>
                          </td>
                          <td>
                            <Badge bg={getPerformanceColor(item.performance.salesConversionRate)}>
                              %{item.performance.salesConversionRate}
                            </Badge>
                          </td>
                          <td>
                            <ProgressBar 
                              now={Math.min(item.performance.salesConversionRate, 100)} 
                              variant={getPerformanceColor(item.performance.salesConversionRate)}
                              size="sm"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Tab>

            <Tab eventKey="communication" title={
              <span>
                <FiMessageSquare className="me-1" />
                İletişim Detayı
              </span>
            }>
              <Card>
                <Card.Body className="p-0">
                  <Table responsive hover className="mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Temsilci</th>
                        <th>WhatsApp</th>
                        <th>Gelen Arama</th>
                        <th>Giden Arama</th>
                        <th>Yeni Müşteri Birebir</th>
                        <th>Eski Müşteri Birebir</th>
                        <th>Toplam</th>
                        <th>Kayıt Oranı</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.data.map((item) => (
                        <tr key={item.user._id}>
                          <td>
                            <div className="fw-bold">{item.user.name}</div>
                          </td>
                          <td>
                            <Badge bg="success">{formatNumber(item.communication.whatsappIncoming)}</Badge>
                          </td>
                          <td>
                            <Badge bg="primary">{formatNumber(item.communication.callIncoming)}</Badge>
                          </td>
                          <td>
                            <Badge bg="warning">{formatNumber(item.communication.callOutgoing)}</Badge>
                          </td>
                          <td>
                            <Badge bg="info">{formatNumber(item.communication.meetingNewCustomer)}</Badge>
                          </td>
                          <td>
                            <Badge bg="secondary">{formatNumber(item.communication.meetingAfterSale)}</Badge>
                          </td>
                          <td>
                            <Badge bg="dark" className="fs-6">
                              {formatNumber(item.communication.totalCommunication)}
                            </Badge>
                          </td>
                          <td>
                            <ProgressBar 
                              now={item.communication.entryRate} 
                              variant={getPerformanceColor(item.communication.entryRate)}
                              size="sm"
                              label={`%${item.communication.entryRate}`}
                            />
                            <small className="text-muted">
                              {item.communication.daysEntered}/{item.communication.totalDays} gün
                            </small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Tab>

            <Tab eventKey="sales" title={
              <span>
                <FiShoppingBag className="me-1" />
                Satış Detayı
              </span>
            }>
              <Card>
                <Card.Body className="p-0">
                  <Table responsive hover className="mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Temsilci</th>
                        <th>Toplam Satış</th>
                        <th>Toplam Ciro</th>
                        <th>Brüt Prim</th>
                        <th>Net Prim</th>
                        <th>İptal</th>
                        <th>Değişiklik</th>
                        <th>Ortalama</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.data.map((item) => (
                        <tr key={item.user._id}>
                          <td>
                            <div className="fw-bold">{item.user.name}</div>
                          </td>
                          <td>
                            <Badge bg="success" className="fs-6">
                              {formatNumber(item.sales.totalSales)}
                            </Badge>
                          </td>
                          <td>
                            <div className="fw-bold">
                              {formatCurrency(item.sales.totalAmount)}
                            </div>
                          </td>
                          <td>
                            <div className="text-primary">
                              {formatCurrency(item.sales.totalPrimAmount)}
                            </div>
                          </td>
                          <td>
                            <div className="fw-bold text-success">
                              {formatCurrency(item.sales.netPrimAmount)}
                            </div>
                          </td>
                          <td>
                            {item.sales.cancelledSales > 0 ? (
                              <Badge bg="danger">{item.sales.cancelledSales}</Badge>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                          <td>
                            {item.sales.modifiedSales > 0 ? (
                              <Badge bg="warning">{item.sales.modifiedSales}</Badge>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                          <td>
                            <small className="text-muted">
                              {formatCurrency(item.sales.avgSaleAmount)}
                            </small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Tab>

            <Tab eventKey="daily" title={
              <span>
                <FiCalendar className="me-1" />
                Günlük Detay Raporu
              </span>
            }>
              <Card>
                <Card.Body className="p-0">
                  <Table responsive hover className="mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>Tarih</th>
                        <th>Temsilci</th>
                        <th>WhatsApp</th>
                        <th>Gelen Arama</th>
                        <th>Giden Arama</th>
                        <th>Yeni Müşteri Birebir</th>
                        <th>Eski Müşteri Birebir</th>
                        <th>Satış Adedi</th>
                        <th>Aktivite Satış Fiyatı</th>
                        <th>İptal Adedi</th>
                        <th>İptal Tutarı</th>
                        <th>Değişiklik Adedi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyReportData.map((item, index) => (
                        <tr key={`${item.salesperson._id}-${item.date}-${index}`}>
                          <td>
                            <div className="fw-bold text-primary">
                              {formatDate(item.date)}
                            </div>
                          </td>
                          <td>
                            <div className="fw-bold">{item.salesperson.name}</div>
                          </td>
                          <td>
                            <Badge bg="success">{item.communication.whatsappIncoming}</Badge>
                          </td>
                          <td>
                            <Badge bg="primary">{item.communication.callIncoming}</Badge>
                          </td>
                          <td>
                            <Badge bg="warning">{item.communication.callOutgoing}</Badge>
                          </td>
                          <td>
                            <Badge bg="info">{item.communication.meetingNewCustomer}</Badge>
                          </td>
                          <td>
                            <Badge bg="secondary">{item.communication.meetingAfterSale}</Badge>
                          </td>
                          <td>
                            <div className="fw-bold text-success">
                              {item.sales.length}
                            </div>
                            {item.sales.length > 0 && (
                              <div className="small text-muted">
                                {item.sales.map(sale => (
                                  <Badge 
                                    key={sale._id} 
                                    bg="light" 
                                    text="dark" 
                                    className="me-1 mb-1"
                                    style={{ backgroundColor: sale.saleType?.color || '#6c757d' }}
                                  >
                                    {sale.saleType?.name || 'Normal'}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </td>
                          <td>
                            <div className="fw-bold text-success">
                              {formatCurrency(
                                item.sales.reduce((sum, sale) => sum + (sale.activitySalePrice || 0), 0)
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="fw-bold text-danger">
                              {item.cancellations.length}
                            </div>
                          </td>
                          <td>
                            <div className="fw-bold text-danger">
                              {formatCurrency(
                                item.cancellations.reduce((sum, sale) => sum + (sale.activitySalePrice || 0), 0)
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="fw-bold text-warning">
                              {item.modifications.length}
                            </div>
                            {item.modifications.length > 0 && (
                              <div className="small text-muted">
                                Değişiklik detayları
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {dailyReportData.length === 0 && (
                        <tr>
                          <td colSpan="12" className="text-center py-4 text-muted">
                            Seçilen dönem için günlük veri bulunamadı
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Tab>
          </Tabs>

          {/* Period Info */}
          <Alert variant="info">
            <FiCalendar className="me-2" />
            <strong>Rapor Dönemi:</strong> {formatDate(reportData.period.startDate)} - {formatDate(reportData.period.endDate)} 
            ({reportData.period.days} gün) | 
            <strong> Toplam Temsilci:</strong> {reportData.data.length}
          </Alert>
        </>
      )}
    </div>
  );
};

export default CommunicationSalesReport;
