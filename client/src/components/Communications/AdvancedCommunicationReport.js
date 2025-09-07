import React, { useState, useEffect, useCallback } from 'react';
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
  ButtonGroup,
  Dropdown,
  InputGroup,
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
  FiX,
  FiPieChart,
  FiActivity,
  FiEye
} from 'react-icons/fi';

import { communicationsAPI, salesAPI, usersAPI, reportsAPI } from '../../utils/api';
import { formatDate, formatCurrency, formatNumber } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import Loading from '../Common/Loading';

const AdvancedCommunicationReport = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [users, setUsers] = useState([]);
  
  // Gelişmiş filtre sistemi
  const [filters, setFilters] = useState({
    // Tarih filtreleri
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    
    // Dönem filtreleri
    periodType: 'daily', // daily, weekly, monthly, yearly
    
    // Temsilci filtreleri
    selectedUsers: [], // Çoklu seçim
    
    // İletişim türü filtreleri
    communicationTypes: {
      whatsapp: true,
      incomingCalls: true,
      outgoingCalls: true,
      newCustomerMeetings: true,
      afterSaleMeetings: true
    },
    
    // Satış veri filtreleri
    includeSales: true,
    includeCancellations: true,
    includeModifications: true,
    includeHistoricalData: true,
    
    // Rapor türü
    reportType: 'combined', // combined, communication, sales, graphical
    
    // Gruplama
    groupBy: 'user' // user, date, type
  });

  // UI state
  const [showFilters, setShowFilters] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchUsers();
  }, []);

  // Debounced data fetching
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (users.length > 0) {
        fetchReportData();
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
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

  const fetchReportData = useCallback(async () => {
    try {
      setLoading(true);
      
      console.log('🔄 Fetching advanced report data with filters:', filters);
      
      // Paralel veri çekme
      const promises = [];
      
      // İletişim verileri
      promises.push(
        communicationsAPI.getReport({
          startDate: filters.startDate,
          endDate: filters.endDate,
          salesperson: filters.selectedUsers.length > 0 ? filters.selectedUsers[0] : undefined,
          groupBy: filters.periodType === 'daily' ? 'day' : 
                   filters.periodType === 'weekly' ? 'week' :
                   filters.periodType === 'monthly' ? 'month' : 'year'
        })
      );
      
      // Satış verileri
      if (filters.includeSales) {
        promises.push(
          reportsAPI.getSalespersonPerformance({
            startDate: filters.startDate,
            endDate: filters.endDate,
            salespersons: filters.selectedUsers.length > 0 ? filters.selectedUsers : undefined
          })
        );
      }
      
      // Günlük detay verileri
      promises.push(
        communicationsAPI.getDailyReport({
          startDate: filters.startDate,
          endDate: filters.endDate,
          salesperson: filters.selectedUsers.length > 0 ? filters.selectedUsers[0] : undefined
        })
      );

      const responses = await Promise.all(promises);
      
      const communicationData = responses[0]?.data || [];
      const salesData = filters.includeSales ? (responses[1]?.data || []) : [];
      const dailyData = responses[responses.length - 1]?.data || [];

      console.log('📊 Advanced report data received:', {
        communication: communicationData.length,
        sales: salesData.length,
        daily: dailyData.length
      });

      // Veri işleme ve birleştirme
      const processedData = processReportData({
        communication: communicationData,
        sales: salesData,
        daily: dailyData,
        filters,
        users
      });

      setReportData(processedData);
      
    } catch (error) {
      console.error('Advanced report fetch error:', error);
      toast.error(`Rapor verileri yüklenirken hata oluştu: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  }, [filters, users]);

  // Veri işleme fonksiyonu
  const processReportData = ({ communication, sales, daily, filters, users }) => {
    console.log('🔄 Processing report data...');
    
    // Kullanıcı bazlı veri birleştirme
    const userBasedData = users.map(user => {
      const userComm = communication.find(c => c.salesperson?._id === user._id) || {};
      const userSales = sales.find(s => s.salesperson?._id === user._id) || {};
      const userDaily = daily.filter(d => d.salesperson?._id === user._id) || [];

      return {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email
        },
        communication: processUserCommunication(userComm, filters),
        sales: processUserSales(userSales, filters),
        daily: userDaily,
        performance: calculateUserPerformance(userComm, userSales)
      };
    });

    // Toplam istatistikler
    const totals = calculateTotals(userBasedData);

    // Dönem bazlı gruplama
    const periodData = groupDataByPeriod(userBasedData, filters.periodType);

    return {
      users: userBasedData,
      totals,
      periods: periodData,
      filters: { ...filters },
      metadata: {
        dateRange: {
          start: filters.startDate,
          end: filters.endDate,
          days: Math.ceil((new Date(filters.endDate) - new Date(filters.startDate)) / (1000 * 60 * 60 * 24)) + 1
        },
        userCount: userBasedData.length,
        lastUpdated: new Date()
      }
    };
  };

  // Yardımcı fonksiyonlar
  const processUserCommunication = (commData, filters) => {
    const communication = commData.communication || {};
    
    return {
      whatsappIncoming: filters.communicationTypes.whatsapp ? (communication.whatsappIncoming || 0) : 0,
      callIncoming: filters.communicationTypes.incomingCalls ? (communication.callIncoming || 0) : 0,
      callOutgoing: filters.communicationTypes.outgoingCalls ? (communication.callOutgoing || 0) : 0,
      meetingNewCustomer: filters.communicationTypes.newCustomerMeetings ? (communication.meetingNewCustomer || 0) : 0,
      meetingAfterSale: filters.communicationTypes.afterSaleMeetings ? (communication.meetingAfterSale || 0) : 0,
      totalCommunication: 
        (filters.communicationTypes.whatsapp ? (communication.whatsappIncoming || 0) : 0) +
        (filters.communicationTypes.incomingCalls ? (communication.callIncoming || 0) : 0) +
        (filters.communicationTypes.outgoingCalls ? (communication.callOutgoing || 0) : 0) +
        (filters.communicationTypes.newCustomerMeetings ? (communication.meetingNewCustomer || 0) : 0) +
        (filters.communicationTypes.afterSaleMeetings ? (communication.meetingAfterSale || 0) : 0)
    };
  };

  const processUserSales = (salesData, filters) => {
    return {
      totalSales: filters.includeSales ? (salesData.totalSales || 0) : 0,
      totalAmount: filters.includeSales ? (salesData.totalAmount || salesData.totalCiro || 0) : 0,
      totalPrim: filters.includeSales ? (salesData.totalPrim || salesData.netPrim || 0) : 0,
      cancellations: filters.includeCancellations ? (salesData.cancellations || 0) : 0,
      modifications: filters.includeModifications ? (salesData.modifications || 0) : 0
    };
  };

  const calculateUserPerformance = (commData, salesData) => {
    const totalComm = commData.communication?.totalCommunication || 0;
    const totalSales = salesData.totalSales || 0;
    
    return {
      communicationPerSale: totalSales > 0 ? Math.round(totalComm / totalSales) : 0,
      salesConversionRate: totalComm > 0 ? ((totalSales / totalComm) * 100).toFixed(1) : '0.0',
      efficiency: totalComm > 0 && totalSales > 0 ? ((totalSales / totalComm) * 100).toFixed(1) : '0.0'
    };
  };

  const calculateTotals = (userData) => {
    return userData.reduce((totals, user) => ({
      totalCommunication: totals.totalCommunication + user.communication.totalCommunication,
      totalSales: totals.totalSales + user.sales.totalSales,
      totalAmount: totals.totalAmount + user.sales.totalAmount,
      totalPrim: totals.totalPrim + user.sales.totalPrim,
      whatsappIncoming: totals.whatsappIncoming + user.communication.whatsappIncoming,
      callIncoming: totals.callIncoming + user.communication.callIncoming,
      callOutgoing: totals.callOutgoing + user.communication.callOutgoing,
      meetingNewCustomer: totals.meetingNewCustomer + user.communication.meetingNewCustomer,
      meetingAfterSale: totals.meetingAfterSale + user.communication.meetingAfterSale
    }), {
      totalCommunication: 0,
      totalSales: 0,
      totalAmount: 0,
      totalPrim: 0,
      whatsappIncoming: 0,
      callIncoming: 0,
      callOutgoing: 0,
      meetingNewCustomer: 0,
      meetingAfterSale: 0
    });
  };

  const groupDataByPeriod = (userData, periodType) => {
    // Dönem bazlı gruplama mantığı burada olacak
    return [];
  };

  // Filtre güncelleme fonksiyonları
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

  const toggleUserSelection = (userId) => {
    setFilters(prev => ({
      ...prev,
      selectedUsers: prev.selectedUsers.includes(userId)
        ? prev.selectedUsers.filter(id => id !== userId)
        : [...prev.selectedUsers, userId]
    }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      periodType: 'daily',
      selectedUsers: [],
      communicationTypes: {
        whatsapp: true,
        incomingCalls: true,
        outgoingCalls: true,
        newCustomerMeetings: true,
        afterSaleMeetings: true
      },
      includeSales: true,
      includeCancellations: true,
      includeModifications: true,
      includeHistoricalData: true,
      reportType: 'combined',
      groupBy: 'user'
    });
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
            <FiActivity className="me-2" />
            Gelişmiş İletişim & Satış Raporu
          </h4>
          <p className="text-muted mb-0">
            Kapsamlı iletişim faaliyetleri ve satış performansının detaylı analizi
          </p>
        </div>
        <div>
          <Button
            variant="outline-primary"
            onClick={() => setShowFilters(!showFilters)}
            className="me-2"
          >
            <FiFilter className="me-1" />
            {showFilters ? 'Filtreleri Gizle' : 'Filtreleri Göster'}
          </Button>
          <Button variant="primary" onClick={fetchReportData} disabled={loading}>
            <FiRefreshCw className={`me-1 ${loading ? 'spin' : ''}`} />
            Yenile
          </Button>
        </div>
      </div>

      {/* Gelişmiş Filtre Sistemi */}
      {showFilters && (
        <Card className="mb-4">
          <Card.Header>
            <div className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                <FiFilter className="me-2" />
                Gelişmiş Filtreler
              </h5>
              <Button variant="outline-secondary" size="sm" onClick={clearFilters}>
                <FiX className="me-1" />
                Temizle
              </Button>
            </div>
          </Card.Header>
          <Card.Body>
            <Row>
              {/* Tarih Filtreleri */}
              <Col md={6} lg={3} className="mb-3">
                <Form.Group>
                  <Form.Label>Başlangıç Tarihi</Form.Label>
                  <Form.Control
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => updateFilter('startDate', e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={6} lg={3} className="mb-3">
                <Form.Group>
                  <Form.Label>Bitiş Tarihi</Form.Label>
                  <Form.Control
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => updateFilter('endDate', e.target.value)}
                  />
                </Form.Group>
              </Col>

              {/* Dönem Türü */}
              <Col md={6} lg={3} className="mb-3">
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

              {/* Rapor Türü */}
              <Col md={6} lg={3} className="mb-3">
                <Form.Group>
                  <Form.Label>Rapor Türü</Form.Label>
                  <Form.Select
                    value={filters.reportType}
                    onChange={(e) => updateFilter('reportType', e.target.value)}
                  >
                    <option value="combined">Birleşik Rapor</option>
                    <option value="communication">Sadece İletişim</option>
                    <option value="sales">Sadece Satış</option>
                    <option value="graphical">Grafiksel</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Row>
              {/* Temsilci Seçimi */}
              <Col md={6} className="mb-3">
                <Form.Group>
                  <Form.Label>Temsilciler (Çoklu Seçim)</Form.Label>
                  <div className="border rounded p-2" style={{ maxHeight: '120px', overflowY: 'auto' }}>
                    <Form.Check
                      type="checkbox"
                      label="Tüm Temsilciler"
                      checked={filters.selectedUsers.length === 0}
                      onChange={(e) => setFilters(prev => ({
                        ...prev,
                        selectedUsers: e.target.checked ? [] : users.map(u => u._id)
                      }))}
                      className="mb-1"
                    />
                    {users.map(user => (
                      <Form.Check
                        key={user._id}
                        type="checkbox"
                        label={user.name}
                        checked={filters.selectedUsers.includes(user._id)}
                        onChange={() => toggleUserSelection(user._id)}
                        className="mb-1"
                      />
                    ))}
                  </div>
                </Form.Group>
              </Col>

              {/* İletişim Türleri */}
              <Col md={6} className="mb-3">
                <Form.Group>
                  <Form.Label>İletişim Türleri</Form.Label>
                  <div className="border rounded p-2">
                    {Object.entries({
                      whatsapp: 'WhatsApp',
                      incomingCalls: 'Gelen Aramalar',
                      outgoingCalls: 'Giden Aramalar',
                      newCustomerMeetings: 'Yeni Müşteri Görüşmeleri',
                      afterSaleMeetings: 'Satış Sonrası Görüşmeler'
                    }).map(([key, label]) => (
                      <Form.Check
                        key={key}
                        type="checkbox"
                        label={label}
                        checked={filters.communicationTypes[key]}
                        onChange={(e) => updateCommunicationType(key, e.target.checked)}
                        className="mb-1"
                      />
                    ))}
                  </div>
                </Form.Group>
              </Col>
            </Row>

            <Row>
              {/* Veri Dahil Etme Seçenekleri */}
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Dahil Edilecek Veriler</Form.Label>
                  <div className="d-flex flex-wrap gap-3">
                    <Form.Check
                      type="checkbox"
                      label="Satış Verileri"
                      checked={filters.includeSales}
                      onChange={(e) => updateFilter('includeSales', e.target.checked)}
                    />
                    <Form.Check
                      type="checkbox"
                      label="İptal Edilen Satışlar"
                      checked={filters.includeCancellations}
                      onChange={(e) => updateFilter('includeCancellations', e.target.checked)}
                    />
                    <Form.Check
                      type="checkbox"
                      label="Değişiklik Yapılan Satışlar"
                      checked={filters.includeModifications}
                      onChange={(e) => updateFilter('includeModifications', e.target.checked)}
                    />
                    <Form.Check
                      type="checkbox"
                      label="Geçmiş Yıl Verileri"
                      checked={filters.includeHistoricalData}
                      onChange={(e) => updateFilter('includeHistoricalData', e.target.checked)}
                    />
                  </div>
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      )}

      {/* Ana Rapor Alanı */}
      {reportData ? (
        <div>
          {/* Özet İstatistikler */}
          <Row className="mb-4">
            <Col md={3}>
              <Card className="text-center h-100">
                <Card.Body>
                  <FiMessageSquare className="h1 text-primary mb-2" />
                  <h3 className="text-primary">{formatNumber(reportData.totals.totalCommunication)}</h3>
                  <p className="text-muted mb-0">Toplam İletişim</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center h-100">
                <Card.Body>
                  <FiShoppingBag className="h1 text-success mb-2" />
                  <h3 className="text-success">{formatNumber(reportData.totals.totalSales)}</h3>
                  <p className="text-muted mb-0">Toplam Satış</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center h-100">
                <Card.Body>
                  <FiDollarSign className="h1 text-warning mb-2" />
                  <h3 className="text-warning">{formatCurrency(reportData.totals.totalAmount)}</h3>
                  <p className="text-muted mb-0">Toplam Ciro</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center h-100">
                <Card.Body>
                  <FiTrendingUp className="h1 text-info mb-2" />
                  <h3 className="text-info">
                    {reportData.totals.totalCommunication > 0 && reportData.totals.totalSales > 0
                      ? ((reportData.totals.totalSales / reportData.totals.totalCommunication) * 100).toFixed(1)
                      : '0.0'}%
                  </h3>
                  <p className="text-muted mb-0">İletişim/Satış Oranı</p>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Detaylı Raporlar */}
          <Tabs activeKey={activeTab} onSelect={setActiveTab} className="mb-4">
            <Tab eventKey="overview" title={
              <span>
                <FiBarChart className="me-1" />
                Genel Bakış
              </span>
            }>
              {/* Genel bakış içeriği buraya gelecek */}
              <Card>
                <Card.Body>
                  <p>Genel bakış raporu geliştiriliyor...</p>
                </Card.Body>
              </Card>
            </Tab>

            <Tab eventKey="detailed" title={
              <span>
                <FiEye className="me-1" />
                Detaylı Rapor
              </span>
            }>
              {/* Detaylı rapor içeriği buraya gelecek */}
              <Card>
                <Card.Body>
                  <p>Detaylı rapor geliştiriliyor...</p>
                </Card.Body>
              </Card>
            </Tab>

            <Tab eventKey="graphical" title={
              <span>
                <FiPieChart className="me-1" />
                Grafiksel Rapor
              </span>
            }>
              {/* Grafiksel rapor içeriği buraya gelecek */}
              <Card>
                <Card.Body>
                  <p>Grafiksel rapor geliştiriliyor...</p>
                </Card.Body>
              </Card>
            </Tab>
          </Tabs>

          {/* Dönem Bilgisi */}
          <Alert variant="info">
            <FiCalendar className="me-2" />
            <strong>Rapor Dönemi:</strong> {formatDate(reportData.metadata.dateRange.start)} - {formatDate(reportData.metadata.dateRange.end)} 
            ({reportData.metadata.dateRange.days} gün) | 
            <strong> Toplam Temsilci:</strong> {reportData.metadata.userCount} |
            <strong> Son Güncelleme:</strong> {formatDate(reportData.metadata.lastUpdated)}
          </Alert>
        </div>
      ) : (
        <Card>
          <Card.Body className="text-center py-5">
            <FiBarChart className="h1 text-muted mb-3" />
            <h5 className="text-muted">Rapor verilerini görüntülemek için filtreleri ayarlayın</h5>
            <p className="text-muted">Tarih aralığı seçin ve "Yenile" butonuna tıklayın</p>
          </Card.Body>
        </Card>
      )}
    </div>
  );
};

export default AdvancedCommunicationReport;
