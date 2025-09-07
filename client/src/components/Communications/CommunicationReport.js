import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Button, 
  Row, 
  Col,
  Table,
  Badge,
  Tabs,
  Tab,
  Alert,
  Dropdown,
  ButtonGroup
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  FiMessageSquare, 
  FiPhone,
  FiUsers,
  FiCalendar,
  FiBarChart,
  FiPieChart,
  FiTrendingUp,
  FiFilter,
  FiDownload,
  FiRefreshCw,
  FiActivity
} from 'react-icons/fi';

import { communicationsAPI, usersAPI } from '../../utils/api';
import { formatDate, formatNumber } from '../../utils/helpers';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import Loading from '../Common/Loading';

const CommunicationReport = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [reportData, setReportData] = useState(null);

  // Basit ve etkili filtre sistemi
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    selectedUser: 'all',
    periodType: 'daily', // daily, weekly, monthly, yearly
    communicationTypes: {
      whatsapp: true,
      incomingCalls: true,
      outgoingCalls: true,
      newCustomerMeetings: true,
      afterSaleMeetings: true
    }
  });

  const [activeTab, setActiveTab] = useState('summary');

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (users.length > 0) {
      const timeoutId = setTimeout(() => {
        fetchCommunicationData();
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

  const fetchCommunicationData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching communication data with filters:', filters);

      // Paralel veri çekme - hem özet hem dönem bazlı
      const promises = [
        // Özet rapor
        communicationsAPI.getReport({
          startDate: filters.startDate,
          endDate: filters.endDate,
          salesperson: filters.selectedUser !== 'all' ? filters.selectedUser : undefined
        }),
        // Dönem bazlı rapor
        communicationsAPI.getPeriodReport({
          startDate: filters.startDate,
          endDate: filters.endDate,
          salesperson: filters.selectedUser !== 'all' ? filters.selectedUser : undefined,
          periodType: filters.periodType
        })
      ];

      const [summaryResponse, periodResponse] = await Promise.all(promises);

      console.log('📊 Communication data received:', {
        summary: summaryResponse.data?.length || 0,
        period: periodResponse.data?.length || 0
      });

      // Veriyi işle
      const processedData = processCommunicationData(
        summaryResponse.data || [], 
        periodResponse.data || []
      );
      setReportData(processedData);

    } catch (error) {
      console.error('Communication data fetch error:', error);
      toast.error(`İletişim verileri yüklenirken hata oluştu: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const processCommunicationData = (summaryData, periodData) => {
    console.log('🔄 Processing communication data:', { summaryData, periodData });

    // Kullanıcı bazlı veri işleme
    const userBasedData = summaryData.map(item => {
      const comm = item.communication || {};
      
      // Filtre uygula
      const filteredComm = {
        whatsappIncoming: filters.communicationTypes.whatsapp ? (comm.whatsappIncoming || 0) : 0,
        callIncoming: filters.communicationTypes.incomingCalls ? (comm.callIncoming || 0) : 0,
        callOutgoing: filters.communicationTypes.outgoingCalls ? (comm.callOutgoing || 0) : 0,
        meetingNewCustomer: filters.communicationTypes.newCustomerMeetings ? (comm.meetingNewCustomer || 0) : 0,
        meetingAfterSale: filters.communicationTypes.afterSaleMeetings ? (comm.meetingAfterSale || 0) : 0
      };

      // Toplam hesapla
      filteredComm.total = Object.values(filteredComm).reduce((sum, val) => sum + val, 0);

      return {
        user: item.salesperson || { name: 'Bilinmeyen', email: '' },
        communication: filteredComm,
        recordCount: item.recordCount || 0
      };
    });

    // Toplam istatistikler - hem özet hem dönem bazlı
    const summaryTotals = userBasedData.reduce((acc, item) => ({
      whatsappIncoming: acc.whatsappIncoming + item.communication.whatsappIncoming,
      callIncoming: acc.callIncoming + item.communication.callIncoming,
      callOutgoing: acc.callOutgoing + item.communication.callOutgoing,
      meetingNewCustomer: acc.meetingNewCustomer + item.communication.meetingNewCustomer,
      meetingAfterSale: acc.meetingAfterSale + item.communication.meetingAfterSale,
      total: acc.total + item.communication.total,
      activeUsers: acc.activeUsers + (item.communication.total > 0 ? 1 : 0)
    }), {
      whatsappIncoming: 0,
      callIncoming: 0,
      callOutgoing: 0,
      meetingNewCustomer: 0,
      meetingAfterSale: 0,
      total: 0,
      activeUsers: 0
    });

    // Dönem bazlı toplam istatistikler
    const periodTotals = processedPeriodData.reduce((acc, item) => ({
      whatsappIncoming: acc.whatsappIncoming + (item.communication.whatsappIncoming || 0),
      callIncoming: acc.callIncoming + (item.communication.callIncoming || 0),
      callOutgoing: acc.callOutgoing + (item.communication.callOutgoing || 0),
      meetingNewCustomer: acc.meetingNewCustomer + (item.communication.meetingNewCustomer || 0),
      meetingAfterSale: acc.meetingAfterSale + (item.communication.meetingAfterSale || 0),
      total: acc.total + (item.communication.totalCommunication || 0),
      activeUsers: new Set(processedPeriodData.map(p => p.salesperson?._id).filter(Boolean)).size
    }), {
      whatsappIncoming: 0,
      callIncoming: 0,
      callOutgoing: 0,
      meetingNewCustomer: 0,
      meetingAfterSale: 0,
      total: 0,
      activeUsers: 0
    });

    // Dönem bazlı veri işleme
    const processedPeriodData = processPeriodData(periodData, filters.periodType);

    // Dönem türüne göre hangi totali kullanacağımızı belirle
    const totals = processedPeriodData.length > 0 ? periodTotals : summaryTotals;

    // En aktif kullanıcılar
    const topUsers = [...userBasedData]
      .filter(item => item.communication.total > 0)
      .sort((a, b) => b.communication.total - a.communication.total)
      .slice(0, 10);

    return {
      users: userBasedData,
      totals,
      periods: processedPeriodData,
      topUsers,
      metadata: {
        dateRange: {
          start: filters.startDate,
          end: filters.endDate,
          days: Math.ceil((new Date(filters.endDate) - new Date(filters.startDate)) / (1000 * 60 * 60 * 24)) + 1
        },
        filters: { ...filters },
        lastUpdated: new Date()
      }
    };
  };

  const processPeriodData = (periodData, periodType) => {
    if (!periodData || periodData.length === 0) return [];

    // Dönem verilerini formatla
    return periodData.map(item => {
      let periodLabel = '';
      
      switch (periodType) {
        case 'daily':
          periodLabel = formatDate(item.date);
          break;
        case 'weekly':
          periodLabel = `${item._id.year} - Hafta ${item._id.week}`;
          break;
        case 'monthly':
          periodLabel = `${item._id.year}/${String(item._id.month).padStart(2, '0')}`;
          break;
        case 'yearly':
          periodLabel = `${item._id.year}`;
          break;
        default:
          periodLabel = formatDate(item.date);
      }

      return {
        ...item,
        periodLabel,
        totalCommunication: item.communication.totalCommunication || 0
      };
    });
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const updateCommunicationType = (type, checked) => {
    setFilters(prev => ({
      ...prev,
      communicationTypes: {
        ...prev.communicationTypes,
        [type]: checked
      }
    }));
  };

  const resetFilters = () => {
    setFilters({
      startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      selectedUser: 'all',
      periodType: 'daily',
      communicationTypes: {
        whatsapp: true,
        incomingCalls: true,
        outgoingCalls: true,
        newCustomerMeetings: true,
        afterSaleMeetings: true
      }
    });
  };

  // Grafik verileri hazırlama fonksiyonları
  const prepareBarChartData = () => {
    if (!reportData || !reportData.users) return [];
    
    return reportData.users
      .filter(item => item.communication.total > 0)
      .sort((a, b) => b.communication.total - a.communication.total)
      .slice(0, 10)
      .map(item => ({
        name: item.user.name.split(' ')[0], // Sadece ilk isim
        WhatsApp: item.communication.whatsappIncoming,
        'Gelen Arama': item.communication.callIncoming,
        'Giden Arama': item.communication.callOutgoing,
        'Yeni Müşteri': item.communication.meetingNewCustomer,
        'Satış Sonrası': item.communication.meetingAfterSale,
        Toplam: item.communication.total
      }));
  };

  const preparePieChartData = () => {
    if (!reportData || !reportData.totals) return [];
    
    return [
      { name: 'WhatsApp', value: reportData.totals.whatsappIncoming, color: '#28a745' },
      { name: 'Gelen Arama', value: reportData.totals.callIncoming, color: '#007bff' },
      { name: 'Giden Arama', value: reportData.totals.callOutgoing, color: '#ffc107' },
      { name: 'Yeni Müşteri', value: reportData.totals.meetingNewCustomer, color: '#17a2b8' },
      { name: 'Satış Sonrası', value: reportData.totals.meetingAfterSale, color: '#6c757d' }
    ].filter(item => item.value > 0);
  };

  const prepareTrendData = () => {
    if (!reportData || !reportData.periods) return [];
    
    // Dönem bazlı trend verisi
    const trendMap = new Map();
    
    reportData.periods.forEach(item => {
      const period = item.periodLabel;
      if (!trendMap.has(period)) {
        trendMap.set(period, {
          period,
          WhatsApp: 0,
          'Gelen Arama': 0,
          'Giden Arama': 0,
          'Yeni Müşteri': 0,
          'Satış Sonrası': 0,
          Toplam: 0
        });
      }
      
      const data = trendMap.get(period);
      data.WhatsApp += item.communication.whatsappIncoming || 0;
      data['Gelen Arama'] += item.communication.callIncoming || 0;
      data['Giden Arama'] += item.communication.callOutgoing || 0;
      data['Yeni Müşteri'] += item.communication.meetingNewCustomer || 0;
      data['Satış Sonrası'] += item.communication.meetingAfterSale || 0;
      data.Toplam += item.communication.totalCommunication || 0;
    });
    
    return Array.from(trendMap.values()).slice(0, 20); // Son 20 dönem
  };

  const COLORS = ['#28a745', '#007bff', '#ffc107', '#17a2b8', '#6c757d'];

  // Excel export fonksiyonu
  const exportToExcel = () => {
    if (!reportData) {
      toast.error('Export edilecek veri bulunamadı');
      return;
    }

    try {
      // Basit CSV formatında export
      const csvData = [
        ['Temsilci', 'WhatsApp', 'Gelen Arama', 'Giden Arama', 'Yeni Müşteri', 'Satış Sonrası', 'Toplam', 'Kayıt Günü'],
        ...reportData.users
          .filter(item => item.communication.total > 0)
          .map(item => [
            item.user.name,
            item.communication.whatsappIncoming,
            item.communication.callIncoming,
            item.communication.callOutgoing,
            item.communication.meetingNewCustomer,
            item.communication.meetingAfterSale,
            item.communication.total,
            item.recordCount
          ])
      ];

      const csvContent = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `iletisim_raporu_${formatDate(new Date())}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Rapor başarıyla indirildi');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Rapor indirme sırasında hata oluştu');
    }
  };

  if (loading && !reportData) {
    return <Loading variant="dots" size="large" />;
  }

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4>
            <FiMessageSquare className="me-2" />
            İletişim Raporları
          </h4>
          <p className="text-muted mb-0">
            Temsilci iletişim faaliyetlerinin detaylı analizi
          </p>
        </div>
        <div>
          <Button 
            variant="outline-success" 
            onClick={() => exportToExcel()} 
            disabled={!reportData || loading}
            className="me-2"
          >
            <FiDownload className="me-1" />
            Excel İndir
          </Button>
          <Button variant="primary" onClick={fetchCommunicationData} disabled={loading}>
            <FiRefreshCw className={`me-1 ${loading ? 'spin' : ''}`} />
            Yenile
          </Button>
        </div>
      </div>

      {/* Filtreler */}
      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">
            <FiFilter className="me-2" />
            Filtreler
          </h5>
        </Card.Header>
        <Card.Body>
          <Row>
            {/* Tarih Filtreleri */}
            <Col md={3} className="mb-3">
              <Form.Group>
                <Form.Label>Başlangıç Tarihi</Form.Label>
                <Form.Control
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => updateFilter('startDate', e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={3} className="mb-3">
              <Form.Group>
                <Form.Label>Bitiş Tarihi</Form.Label>
                <Form.Control
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => updateFilter('endDate', e.target.value)}
                />
              </Form.Group>
            </Col>

            {/* Temsilci Seçimi */}
            <Col md={3} className="mb-3">
              <Form.Group>
                <Form.Label>Temsilci</Form.Label>
                <Form.Select
                  value={filters.selectedUser}
                  onChange={(e) => updateFilter('selectedUser', e.target.value)}
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

            {/* Dönem Türü */}
            <Col md={3} className="mb-3">
              <Form.Group>
                <Form.Label>Dönem Türü</Form.Label>
                <Form.Select
                  value={filters.periodType}
                  onChange={(e) => updateFilter('periodType', e.target.value)}
                >
                  <option value="daily">Günlük</option>
                  <option value="weekly">Haftalık</option>
                  <option value="monthly">Aylık</option>
                  <option value="yearly">Yıllık</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>

          {/* İletişim Türleri */}
          <Row>
            <Col md={12}>
              <Form.Group>
                <Form.Label>İletişim Türleri</Form.Label>
                <div className="d-flex flex-wrap gap-3">
                  <Form.Check
                    type="checkbox"
                    label="WhatsApp"
                    checked={filters.communicationTypes.whatsapp}
                    onChange={(e) => updateCommunicationType('whatsapp', e.target.checked)}
                  />
                  <Form.Check
                    type="checkbox"
                    label="Gelen Aramalar"
                    checked={filters.communicationTypes.incomingCalls}
                    onChange={(e) => updateCommunicationType('incomingCalls', e.target.checked)}
                  />
                  <Form.Check
                    type="checkbox"
                    label="Giden Aramalar"
                    checked={filters.communicationTypes.outgoingCalls}
                    onChange={(e) => updateCommunicationType('outgoingCalls', e.target.checked)}
                  />
                  <Form.Check
                    type="checkbox"
                    label="Yeni Müşteri Görüşmeleri"
                    checked={filters.communicationTypes.newCustomerMeetings}
                    onChange={(e) => updateCommunicationType('newCustomerMeetings', e.target.checked)}
                  />
                  <Form.Check
                    type="checkbox"
                    label="Satış Sonrası Görüşmeler"
                    checked={filters.communicationTypes.afterSaleMeetings}
                    onChange={(e) => updateCommunicationType('afterSaleMeetings', e.target.checked)}
                  />
                </div>
              </Form.Group>
            </Col>
          </Row>

          <div className="mt-3">
            <Button variant="outline-secondary" size="sm" onClick={resetFilters}>
              Filtreleri Sıfırla
            </Button>
          </div>
        </Card.Body>
      </Card>

      {/* Ana Rapor Alanı */}
      {reportData ? (
        <div>
          {/* Özet İstatistikler */}
          <Row className="mb-4">
            <Col md={2}>
              <Card className="text-center h-100">
                <Card.Body>
                  <FiMessageSquare className="h2 text-primary mb-2" />
                  <h4 className="text-primary">{formatNumber(reportData.totals.total)}</h4>
                  <small className="text-muted">Toplam İletişim</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={2}>
              <Card className="text-center h-100">
                <Card.Body>
                  <FiPhone className="h2 text-success mb-2" />
                  <h4 className="text-success">
                    {formatNumber(reportData.totals.callIncoming + reportData.totals.callOutgoing)}
                  </h4>
                  <small className="text-muted">Toplam Arama</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={2}>
              <Card className="text-center h-100">
                <Card.Body>
                  <FiMessageSquare className="h2 text-info mb-2" />
                  <h4 className="text-info">{formatNumber(reportData.totals.whatsappIncoming)}</h4>
                  <small className="text-muted">WhatsApp</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={2}>
              <Card className="text-center h-100">
                <Card.Body>
                  <FiUsers className="h2 text-warning mb-2" />
                  <h4 className="text-warning">
                    {formatNumber(reportData.totals.meetingNewCustomer + reportData.totals.meetingAfterSale)}
                  </h4>
                  <small className="text-muted">Toplam Görüşme</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={2}>
              <Card className="text-center h-100">
                <Card.Body>
                  <FiTrendingUp className="h2 text-danger mb-2" />
                  <h4 className="text-danger">{reportData.totals.activeUsers}</h4>
                  <small className="text-muted">Aktif Temsilci</small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={2}>
              <Card className="text-center h-100">
                <Card.Body>
                  <FiCalendar className="h2 text-secondary mb-2" />
                  <h4 className="text-secondary">{reportData.metadata.dateRange.days}</h4>
                  <small className="text-muted">Gün</small>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Detaylı Raporlar */}
          <Tabs activeKey={activeTab} onSelect={setActiveTab} className="mb-4">
            <Tab eventKey="summary" title={
              <span>
                <FiBarChart className="me-1" />
                Özet Rapor
              </span>
            }>
              <Card>
                <Card.Body>
                  <Table responsive hover>
                    <thead className="table-light">
                      <tr>
                        <th>Temsilci</th>
                        <th>WhatsApp</th>
                        <th>Gelen Arama</th>
                        <th>Giden Arama</th>
                        <th>Yeni Müşteri</th>
                        <th>Satış Sonrası</th>
                        <th>Toplam</th>
                        <th>Kayıt Günü</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.users
                        .filter(item => item.communication.total > 0)
                        .sort((a, b) => b.communication.total - a.communication.total)
                        .map((item, index) => (
                        <tr key={item.user._id || index}>
                          <td>
                            <div className="fw-bold">{item.user.name}</div>
                            <small className="text-muted">{item.user.email}</small>
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
                            <Badge bg="dark" className="fs-6">{formatNumber(item.communication.total)}</Badge>
                          </td>
                          <td>
                            <span className="text-muted">{item.recordCount} gün</span>
                          </td>
                        </tr>
                      ))}
                      {reportData.users.filter(item => item.communication.total > 0).length === 0 && (
                        <tr>
                          <td colSpan="8" className="text-center py-4 text-muted">
                            Seçilen kriterlere uygun veri bulunamadı
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Tab>

            <Tab eventKey="top-performers" title={
              <span>
                <FiTrendingUp className="me-1" />
                En Aktifler
              </span>
            }>
              <Card>
                <Card.Body>
                  <Row>
                    {reportData.topUsers.slice(0, 6).map((item, index) => (
                      <Col md={4} key={item.user._id || index} className="mb-3">
                        <Card className="h-100">
                          <Card.Body className="text-center">
                            <div className="position-relative">
                              <Badge 
                                bg={index === 0 ? 'warning' : index === 1 ? 'secondary' : index === 2 ? 'dark' : 'light'}
                                className="position-absolute top-0 start-0"
                              >
                                #{index + 1}
                              </Badge>
                            </div>
                            <h5 className="mt-3">{item.user.name}</h5>
                            <h3 className="text-primary">{formatNumber(item.communication.total)}</h3>
                            <p className="text-muted mb-2">Toplam İletişim</p>
                            <div className="d-flex justify-content-around small">
                              <div>
                                <div className="fw-bold text-success">{item.communication.whatsappIncoming}</div>
                                <div className="text-muted">WhatsApp</div>
                              </div>
                              <div>
                                <div className="fw-bold text-primary">
                                  {item.communication.callIncoming + item.communication.callOutgoing}
                                </div>
                                <div className="text-muted">Arama</div>
                              </div>
                              <div>
                                <div className="fw-bold text-warning">
                                  {item.communication.meetingNewCustomer + item.communication.meetingAfterSale}
                                </div>
                                <div className="text-muted">Görüşme</div>
                              </div>
                            </div>
                          </Card.Body>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </Card.Body>
              </Card>
            </Tab>

            <Tab eventKey="period" title={
              <span>
                <FiCalendar className="me-1" />
                Dönem Bazlı
              </span>
            }>
              <Card>
                <Card.Body>
                  {reportData.periods && reportData.periods.length > 0 ? (
                    <Table responsive hover>
                      <thead className="table-light">
                        <tr>
                          <th>Dönem</th>
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
                        {reportData.periods.map((item, index) => (
                          <tr key={`${item._id.salesperson}-${item.periodLabel}-${index}`}>
                            <td>
                              <div className="fw-bold text-primary">{item.periodLabel}</div>
                            </td>
                            <td>
                              <div className="fw-bold">{item.salesperson?.name || 'Bilinmeyen'}</div>
                              <small className="text-muted">{item.salesperson?.email}</small>
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
                              <Badge bg="dark" className="fs-6">{formatNumber(item.communication.totalCommunication)}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  ) : (
                    <div className="text-center py-5">
                      <FiCalendar className="h1 text-muted mb-3" />
                      <h5 className="text-muted">Dönem bazlı veri bulunamadı</h5>
                      <p className="text-muted">
                        Seçilen tarih aralığında {filters.periodType === 'daily' ? 'günlük' : 
                        filters.periodType === 'weekly' ? 'haftalık' : 
                        filters.periodType === 'monthly' ? 'aylık' : 'yıllık'} veri bulunmuyor.
                      </p>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Tab>

            <Tab eventKey="breakdown" title={
              <span>
                <FiPhone className="me-1" />
                İletişim Türü Detayı
              </span>
            }>
              <Card>
                <Card.Body>
                  <Row>
                    {/* WhatsApp Detayı */}
                    <Col md={4} className="mb-4">
                      <Card className="h-100">
                        <Card.Header className="bg-success text-white">
                          <h6 className="mb-0">
                            <FiMessageSquare className="me-2" />
                            WhatsApp İletişimi
                          </h6>
                        </Card.Header>
                        <Card.Body>
                          <div className="text-center mb-3">
                            <h3 className="text-success">{formatNumber(reportData.totals.whatsappIncoming)}</h3>
                            <p className="text-muted mb-0">Toplam Mesaj</p>
                          </div>
                          <Table size="sm" className="mb-0">
                            <tbody>
                              {reportData.users
                                .filter(item => item.communication.whatsappIncoming > 0)
                                .sort((a, b) => b.communication.whatsappIncoming - a.communication.whatsappIncoming)
                                .slice(0, 5)
                                .map((item, index) => (
                                <tr key={item.user._id}>
                                  <td className="fw-bold">{item.user.name.split(' ')[0]}</td>
                                  <td className="text-end">
                                    <Badge bg="success">{item.communication.whatsappIncoming}</Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </Card.Body>
                      </Card>
                    </Col>

                    {/* Arama Detayı */}
                    <Col md={4} className="mb-4">
                      <Card className="h-100">
                        <Card.Header className="bg-primary text-white">
                          <h6 className="mb-0">
                            <FiPhone className="me-2" />
                            Telefon Aramaları
                          </h6>
                        </Card.Header>
                        <Card.Body>
                          <div className="text-center mb-3">
                            <h3 className="text-primary">
                              {formatNumber(reportData.totals.callIncoming + reportData.totals.callOutgoing)}
                            </h3>
                            <p className="text-muted mb-0">Toplam Arama</p>
                            <small className="text-muted">
                              Gelen: {formatNumber(reportData.totals.callIncoming)} | 
                              Giden: {formatNumber(reportData.totals.callOutgoing)}
                            </small>
                          </div>
                          <Table size="sm" className="mb-0">
                            <tbody>
                              {reportData.users
                                .filter(item => (item.communication.callIncoming + item.communication.callOutgoing) > 0)
                                .sort((a, b) => (b.communication.callIncoming + b.communication.callOutgoing) - (a.communication.callIncoming + a.communication.callOutgoing))
                                .slice(0, 5)
                                .map((item, index) => (
                                <tr key={item.user._id}>
                                  <td className="fw-bold">{item.user.name.split(' ')[0]}</td>
                                  <td className="text-end">
                                    <Badge bg="primary">
                                      {item.communication.callIncoming + item.communication.callOutgoing}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </Card.Body>
                      </Card>
                    </Col>

                    {/* Görüşme Detayı */}
                    <Col md={4} className="mb-4">
                      <Card className="h-100">
                        <Card.Header className="bg-warning text-dark">
                          <h6 className="mb-0">
                            <FiUsers className="me-2" />
                            Birebir Görüşmeler
                          </h6>
                        </Card.Header>
                        <Card.Body>
                          <div className="text-center mb-3">
                            <h3 className="text-warning">
                              {formatNumber(reportData.totals.meetingNewCustomer + reportData.totals.meetingAfterSale)}
                            </h3>
                            <p className="text-muted mb-0">Toplam Görüşme</p>
                            <small className="text-muted">
                              Yeni: {formatNumber(reportData.totals.meetingNewCustomer)} | 
                              Eski: {formatNumber(reportData.totals.meetingAfterSale)}
                            </small>
                          </div>
                          <Table size="sm" className="mb-0">
                            <tbody>
                              {reportData.users
                                .filter(item => (item.communication.meetingNewCustomer + item.communication.meetingAfterSale) > 0)
                                .sort((a, b) => (b.communication.meetingNewCustomer + b.communication.meetingAfterSale) - (a.communication.meetingNewCustomer + a.communication.meetingAfterSale))
                                .slice(0, 5)
                                .map((item, index) => (
                                <tr key={item.user._id}>
                                  <td className="fw-bold">{item.user.name.split(' ')[0]}</td>
                                  <td className="text-end">
                                    <Badge bg="warning" text="dark">
                                      {item.communication.meetingNewCustomer + item.communication.meetingAfterSale}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>

                  {/* Dönemlik Karşılaştırma */}
                  <Row>
                    <Col md={12}>
                      <Card>
                        <Card.Header>
                          <h6 className="mb-0">
                            <FiBarChart className="me-2" />
                            İletişim Türü Karşılaştırması ({filters.periodType === 'daily' ? 'Günlük' : 
                            filters.periodType === 'weekly' ? 'Haftalık' : 
                            filters.periodType === 'monthly' ? 'Aylık' : 'Yıllık'} Ortalama)
                          </h6>
                        </Card.Header>
                        <Card.Body>
                          <Row>
                            <Col md={3} className="text-center">
                              <div className="p-3 border rounded">
                                <FiMessageSquare className="h2 text-success mb-2" />
                                <h4 className="text-success">
                                  {reportData.metadata.dateRange.days > 0 
                                    ? Math.round(reportData.totals.whatsappIncoming / reportData.metadata.dateRange.days)
                                    : 0}
                                </h4>
                                <p className="text-muted mb-0">WhatsApp/Gün</p>
                              </div>
                            </Col>
                            <Col md={3} className="text-center">
                              <div className="p-3 border rounded">
                                <FiPhone className="h2 text-primary mb-2" />
                                <h4 className="text-primary">
                                  {reportData.metadata.dateRange.days > 0 
                                    ? Math.round((reportData.totals.callIncoming + reportData.totals.callOutgoing) / reportData.metadata.dateRange.days)
                                    : 0}
                                </h4>
                                <p className="text-muted mb-0">Arama/Gün</p>
                              </div>
                            </Col>
                            <Col md={3} className="text-center">
                              <div className="p-3 border rounded">
                                <FiUsers className="h2 text-warning mb-2" />
                                <h4 className="text-warning">
                                  {reportData.metadata.dateRange.days > 0 
                                    ? Math.round((reportData.totals.meetingNewCustomer + reportData.totals.meetingAfterSale) / reportData.metadata.dateRange.days)
                                    : 0}
                                </h4>
                                <p className="text-muted mb-0">Görüşme/Gün</p>
                              </div>
                            </Col>
                            <Col md={3} className="text-center">
                              <div className="p-3 border rounded">
                                <FiTrendingUp className="h2 text-info mb-2" />
                                <h4 className="text-info">
                                  {reportData.metadata.dateRange.days > 0 
                                    ? Math.round(reportData.totals.total / reportData.metadata.dateRange.days)
                                    : 0}
                                </h4>
                                <p className="text-muted mb-0">Toplam/Gün</p>
                              </div>
                            </Col>
                          </Row>
                        </Card.Body>
                      </Card>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </Tab>

            <Tab eventKey="charts" title={
              <span>
                <FiPieChart className="me-1" />
                Grafikler
              </span>
            }>
              <Row>
                {/* Temsilci Performans Grafiği */}
                <Col md={12} className="mb-4">
                  <Card>
                    <Card.Header>
                      <h5 className="mb-0">
                        <FiBarChart className="me-2" />
                        Temsilci İletişim Performansı (En İyi 10)
                      </h5>
                    </Card.Header>
                    <Card.Body>
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={prepareBarChartData()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="WhatsApp" fill="#28a745" />
                          <Bar dataKey="Gelen Arama" fill="#007bff" />
                          <Bar dataKey="Giden Arama" fill="#ffc107" />
                          <Bar dataKey="Yeni Müşteri" fill="#17a2b8" />
                          <Bar dataKey="Satış Sonrası" fill="#6c757d" />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card.Body>
                  </Card>
                </Col>

                {/* İletişim Türü Dağılımı */}
                <Col md={6} className="mb-4">
                  <Card>
                    <Card.Header>
                      <h5 className="mb-0">
                        <FiPieChart className="me-2" />
                        İletişim Türü Dağılımı
                      </h5>
                    </Card.Header>
                    <Card.Body>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={preparePieChartData()}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {preparePieChartData().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </Card.Body>
                  </Card>
                </Col>

                {/* İletişim Trend Analizi */}
                <Col md={6} className="mb-4">
                  <Card>
                    <Card.Header>
                      <h5 className="mb-0">
                        <FiTrendingUp className="me-2" />
                        İletişim Trend Analizi ({filters.periodType === 'daily' ? 'Günlük' : 
                        filters.periodType === 'weekly' ? 'Haftalık' : 
                        filters.periodType === 'monthly' ? 'Aylık' : 'Yıllık'})
                      </h5>
                    </Card.Header>
                    <Card.Body>
                      {prepareTrendData().length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={prepareTrendData()}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="period" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="Toplam" stroke="#dc3545" strokeWidth={3} />
                            <Line type="monotone" dataKey="WhatsApp" stroke="#28a745" />
                            <Line type="monotone" dataKey="Gelen Arama" stroke="#007bff" />
                            <Line type="monotone" dataKey="Giden Arama" stroke="#ffc107" />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="text-center py-4">
                          <FiTrendingUp className="h2 text-muted mb-2" />
                          <p className="text-muted">Trend analizi için dönem bazlı veri bulunamadı</p>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </Col>

                {/* İstatistiksel Özet */}
                <Col md={12}>
                  <Card>
                    <Card.Header>
                      <h5 className="mb-0">
                        <FiActivity className="me-2" />
                        İstatistiksel Özet
                      </h5>
                    </Card.Header>
                    <Card.Body>
                      <Row>
                        <Col md={3}>
                          <div className="text-center p-3 border rounded">
                            <h4 className="text-primary">{reportData?.totals?.total || 0}</h4>
                            <p className="text-muted mb-0">Toplam İletişim</p>
                          </div>
                        </Col>
                        <Col md={3}>
                          <div className="text-center p-3 border rounded">
                            <h4 className="text-success">
                              {reportData?.totals?.activeUsers || 0}
                            </h4>
                            <p className="text-muted mb-0">Aktif Temsilci</p>
                          </div>
                        </Col>
                        <Col md={3}>
                          <div className="text-center p-3 border rounded">
                            <h4 className="text-info">
                              {reportData?.totals?.total && reportData?.totals?.activeUsers 
                                ? Math.round(reportData.totals.total / reportData.totals.activeUsers)
                                : 0}
                            </h4>
                            <p className="text-muted mb-0">Ortalama/Temsilci</p>
                          </div>
                        </Col>
                        <Col md={3}>
                          <div className="text-center p-3 border rounded">
                            <h4 className="text-warning">
                              {reportData?.metadata?.dateRange?.days || 0}
                            </h4>
                            <p className="text-muted mb-0">Rapor Günü</p>
                          </div>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </Tab>
          </Tabs>

          {/* Dönem Bilgisi */}
          <Alert variant="info">
            <FiCalendar className="me-2" />
            <strong>Rapor Dönemi:</strong> {formatDate(reportData.metadata.dateRange.start)} - {formatDate(reportData.metadata.dateRange.end)} 
            ({reportData.metadata.dateRange.days} gün) | 
            <strong> Son Güncelleme:</strong> {formatDate(reportData.metadata.lastUpdated)}
          </Alert>
        </div>
      ) : (
        <Card>
          <Card.Body className="text-center py-5">
            <FiMessageSquare className="h1 text-muted mb-3" />
            <h5 className="text-muted">İletişim raporlarını görüntülemek için filtreleri ayarlayın</h5>
            <p className="text-muted">Tarih aralığı ve temsilci seçin, ardından "Yenile" butonuna tıklayın</p>
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default CommunicationReport;
