import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Alert, Form, Button, Nav, Tab } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { FiRefreshCw, FiCalendar, FiBarChart, FiUsers } from 'react-icons/fi';
import { reportsAPI, primsAPI } from '../../utils/api';
import { formatCurrency, formatNumber, getTodayDateString, getDateStringDaysAgo } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import Loading from '../Common/Loading';
import StatsCard from './StatsCard';
import TopPerformers from './TopPerformers';
import RecentActivity from './RecentActivity';
import TeamStatus from './TeamStatus';

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateFilters, setDateFilters] = useState({
    startDate: '', // Boş bırak - tüm veriler için
    endDate: ''    // Boş bırak - tüm veriler için
  });
  
  const [activeFilter, setActiveFilter] = useState('all'); // Aktif filtre durumu
  
  const { user } = useAuth();

  useEffect(() => {
    fetchPeriods();
  }, []);

  useEffect(() => {
    if (periods.length > 0) {
      fetchDashboardData();
    }
  }, [selectedPeriod, periods, dateFilters]);

  const fetchPeriods = async () => {
    try {
      const response = await primsAPI.getPeriods();
      setPeriods(response.data);
    } catch (error) {
      console.error('Periods fetch error:', error);
      toast.error('Dönemler yüklenirken hata oluştu');
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const params = {
        ...(selectedPeriod !== 'all' ? { period: selectedPeriod } : {}),
        startDate: dateFilters.startDate,
        endDate: dateFilters.endDate
      };
      const response = await reportsAPI.getDashboard(params);
      setDashboardData(response.data);
      setError(null);
    } catch (error) {
      console.error('Dashboard data fetch error:', error);
      setError('Dashboard verileri yüklenirken hata oluştu');
      toast.error('Dashboard verileri yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (periodId) => {
    setSelectedPeriod(periodId);
  };

  const getSelectedPeriodName = () => {
    if (selectedPeriod === 'all') return 'Tüm Dönemler';
    if (selectedPeriod === 'current') return 'Güncel Dönem';
    const period = periods.find(p => p._id === selectedPeriod);
    return period ? period.name : 'Bilinmeyen Dönem';
  };

  // Hızlı filtre butonları
  const handleQuickFilter = (filterType) => {
    const today = new Date();
    let startDate = '';
    let endDate = '';

    switch (filterType) {
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        startDate = yesterday.toISOString().split('T')[0];
        endDate = yesterday.toISOString().split('T')[0];
        break;
      case 'today':
        startDate = today.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        break;
      case 'week':
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        startDate = weekAgo.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        break;
      case 'month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(today.getMonth() - 1);
        startDate = monthAgo.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
        break;
      case 'all':
      default:
        startDate = '';
        endDate = '';
        break;
    }

    setDateFilters({ startDate, endDate });
    setActiveFilter(filterType);
  };

  if (loading) {
    return <Loading variant="pulse" size="large" />;
  }

  if (error) {
    return (
      <Alert variant="danger">
        <Alert.Heading>Hata!</Alert.Heading>
        <p>{error}</p>
      </Alert>
    );
  }

  const {
    totalSales,
    cancelledSales,
    totalSalesAmount,
    totalPrimAmount,
    thisMonthSales,
    paidPrims,
    unpaidPrims,
    topPerformers,
    saleTypesStats
  } = dashboardData || {};

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>Dashboard</h1>
          <p className="text-muted mb-0">
            Hoş geldiniz, {user?.name}
            {user?.role && user.role.name === 'admin' && <span className="badge bg-warning ms-2">Admin</span>}
          </p>
        </div>
      </div>

      {/* Dashboard Tabs */}
      <Tab.Container defaultActiveKey="analytics">
        <Nav variant="tabs" className="mb-4">
          <Nav.Item>
            <Nav.Link eventKey="analytics">
              <FiBarChart className="me-2" />
              Analitik
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="team-status">
              <FiUsers className="me-2" />
              Takım Durumları
            </Nav.Link>
          </Nav.Item>
        </Nav>

        <Tab.Content>
          <Tab.Pane eventKey="analytics">
            {/* Filtreler */}
            <Card className="mb-4">
              <Card.Body>
                <Row className="align-items-end">
                  <Col md={2}>
                    <Form.Group>
                      <Form.Label>Başlangıç Tarihi</Form.Label>
                      <Form.Control
                        type="date"
                        value={dateFilters.startDate}
                        onChange={(e) => {
                          setDateFilters(prev => ({ ...prev, startDate: e.target.value }));
                          setActiveFilter('custom');
                        }}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Form.Group>
                      <Form.Label>Bitiş Tarihi</Form.Label>
                      <Form.Control
                        type="date"
                        value={dateFilters.endDate}
                        onChange={(e) => {
                          setDateFilters(prev => ({ ...prev, endDate: e.target.value }));
                          setActiveFilter('custom');
                        }}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Hızlı Filtreler</Form.Label>
                      <div className="d-flex gap-2 flex-wrap">
                        <Button 
                          variant={activeFilter === 'all' ? 'primary' : 'outline-primary'} 
                          size="sm"
                          onClick={() => handleQuickFilter('all')}
                        >
                          Tüm Veriler
                        </Button>
                        <Button 
                          variant={activeFilter === 'yesterday' ? 'primary' : 'outline-primary'} 
                          size="sm"
                          onClick={() => handleQuickFilter('yesterday')}
                        >
                          Dün
                        </Button>
                        <Button 
                          variant={activeFilter === 'today' ? 'primary' : 'outline-primary'} 
                          size="sm"
                          onClick={() => handleQuickFilter('today')}
                        >
                          Bugün
                        </Button>
                        <Button 
                          variant={activeFilter === 'week' ? 'primary' : 'outline-primary'} 
                          size="sm"
                          onClick={() => handleQuickFilter('week')}
                        >
                          Son 1 Hafta
                        </Button>
                        <Button 
                          variant={activeFilter === 'month' ? 'primary' : 'outline-primary'} 
                          size="sm"
                          onClick={() => handleQuickFilter('month')}
                        >
                          Son 1 Ay
                        </Button>
                      </div>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group>
                      <Form.Label>Dönem Seçici</Form.Label>
                      <Form.Select
                        value={selectedPeriod}
                        onChange={(e) => handlePeriodChange(e.target.value)}
                      >
                        <option value="all">Tüm Dönemler</option>
                        <option value="current">Güncel Dönem</option>
                        {periods.map(period => (
                          <option key={period._id} value={period._id}>
                            {period.name}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={2}>
                    <Button 
                      variant="primary" 
                      onClick={fetchDashboardData}
                      disabled={loading}
                      className="w-100"
                    >
                      <FiRefreshCw className={`me-1 ${loading ? 'spin' : ''}`} />
                      Filtrele
                    </Button>
                  </Col>
                  <Col md={3}>
                    <div className="d-flex gap-2">
                      <Button 
                        variant="outline-secondary" 
                        size="sm"
                        onClick={() => setDateFilters({ startDate: getTodayDateString(), endDate: getTodayDateString() })}
                      >
                        Bugün
                      </Button>
                      <Button 
                        variant="outline-secondary" 
                        size="sm"
                        onClick={() => setDateFilters({ startDate: getDateStringDaysAgo(7), endDate: getTodayDateString() })}
                      >
                        Son 7 Gün
                      </Button>
                      <Button 
                        variant="outline-secondary" 
                        size="sm"
                        onClick={() => setDateFilters({ startDate: getDateStringDaysAgo(30), endDate: getTodayDateString() })}
                      >
                        Son 30 Gün
                      </Button>
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>

      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Seçilen Dönem Bilgisi */}
      <div className="mb-3">
        <Alert variant="info" className="d-flex align-items-center mb-0 py-2">
          <FiCalendar className="me-2" />
          <strong>Seçilen Dönem:</strong> 
          <span className="ms-2">{getSelectedPeriodName()}</span>
        </Alert>
      </div>

      {/* İstatistik Kartları */}
      <Row className="mb-4">
        <Col lg={3} md={6} className="mb-3">
          <StatsCard
            title={selectedPeriod === 'all' ? "Toplam Satış" : "Dönem Satışları"}
            value={formatNumber(totalSales)}
            icon="shopping-bag"
            color="primary"
          />
        </Col>
        <Col lg={3} md={6} className="mb-3">
          <StatsCard
            title={selectedPeriod === 'all' ? "Bu Ay Satış" : "Dönem Satışları"}
            value={formatNumber(thisMonthSales)}
            icon="calendar"
            color="success"
          />
        </Col>
        <Col lg={3} md={6} className="mb-3">
          <StatsCard
            title={selectedPeriod === 'all' ? "Toplam Ciro" : "Dönem Cirosu"}
            value={formatCurrency(totalSalesAmount)}
            icon="dollar-sign"
            color="info"
          />
        </Col>
        <Col lg={3} md={6} className="mb-3">
          <StatsCard
            title={selectedPeriod === 'all' ? "Toplam Prim" : "Dönem Primi"}
            value={formatCurrency(totalPrimAmount)}
            icon="trending-up"
            color="warning"
          />
        </Col>
      </Row>

      <Row className="mb-4">
        <Col lg={3} md={6} className="mb-3">
          <StatsCard
            title={selectedPeriod === 'all' ? "Ödenen Primler" : "Dönem Ödenen Primler"}
            value={formatCurrency(dashboardData?.primBreakdown?.paid?.totalPrim || 0)}
            icon="check-circle"
            color="success"
          />
          <div className="mt-2 small text-muted text-center">
            {formatNumber(dashboardData?.primBreakdown?.paid?.count || 0)} adet
          </div>
        </Col>
        <Col lg={3} md={6} className="mb-3">
          <StatsCard
            title={selectedPeriod === 'all' ? "Ödenmemiş Primler" : "Dönem Ödenmemiş Primler"}
            value={formatCurrency(dashboardData?.primBreakdown?.unpaid?.totalPrim || 0)}
            icon="clock"
            color="warning"
          />
          <div className="mt-2 small text-muted text-center">
            {formatNumber(dashboardData?.primBreakdown?.unpaid?.count || 0)} adet
          </div>
        </Col>
        <Col lg={3} md={6} className="mb-3">
          <StatsCard
            title={selectedPeriod === 'all' ? "İptal Edilen" : "Dönem İptal Edilen"}
            value={formatNumber(cancelledSales)}
            icon="x-circle"
            color="danger"
          />
        </Col>
        <Col lg={3} md={6} className="mb-3">
          <StatsCard
            title={selectedPeriod === 'all' ? "Başarı Oranı" : "Dönem Başarı Oranı"}
            value={totalSales > 0 ? `%${((totalSales / (totalSales + cancelledSales)) * 100).toFixed(1)}` : '%0'}
            icon="target"
            color="info"
          />
        </Col>
      </Row>

      {/* Satış Türleri İstatistikleri */}
      {saleTypesStats && (
        <>
          <div className="mb-3">
            <h5 className="text-muted">
              <FiBarChart className="me-2" />
              Satış Türleri İstatistikleri
            </h5>
          </div>
          <Row className="mb-4">
            <Col lg={3} md={6} className="mb-3">
              <StatsCard
                title="Normal Satış"
                value={formatNumber(saleTypesStats.satis?.count || 0)}
                icon="shopping-bag"
                color="primary"
              />
              <div className="mt-2 small text-muted text-center">
                Ciro: {formatCurrency(saleTypesStats.satis?.totalAmount || 0)}
              </div>
            </Col>
            <Col lg={3} md={6} className="mb-3">
              <StatsCard
                title="Kapora"
                value={formatNumber(saleTypesStats.kapora?.count || 0)}
                icon="clock"
                color="warning"
              />
              <div className="mt-2 small text-muted text-center">
                Liste Fiyatı: {formatCurrency(saleTypesStats.kapora?.totalListPrice || 0)}
              </div>
              <div className="mt-1 small text-muted text-center">
                Aktivite: {formatCurrency(saleTypesStats.kapora?.totalAmount || 0)}
              </div>
            </Col>
            <Col lg={3} md={6} className="mb-3">
              <StatsCard
                title="Yazlık Ev"
                value={formatNumber(saleTypesStats.yazlik?.count || 0)}
                icon="target"
                color="success"
              />
              <div className="mt-2 small text-muted text-center">
                Ciro: {formatCurrency(saleTypesStats.yazlik?.totalAmount || 0)}
              </div>
            </Col>
            <Col lg={3} md={6} className="mb-3">
              <StatsCard
                title="Kışlık Ev"
                value={formatNumber(saleTypesStats.kislik?.count || 0)}
                icon="target"
                color="info"
              />
              <div className="mt-2 small text-muted text-center">
                Ciro: {formatCurrency(saleTypesStats.kislik?.totalAmount || 0)}
              </div>
            </Col>
          </Row>
        </>
      )}

      <Row>
        {/* En İyi Performans (Sadece Admin için) */}
        {user?.role && user.role.name === 'admin' && topPerformers && (
          <Col lg={6} className="mb-4">
            <TopPerformers performers={topPerformers} />
          </Col>
        )}

        {/* Son Aktiviteler */}
        <Col lg={user?.role && user.role.name === 'admin' ? 6 : 12} className="mb-4">
          <RecentActivity />
        </Col>
      </Row>

      {/* Hızlı Eylemler */}
      <Row>
        <Col>
          <Card>
            <Card.Header>
              <h5 className="mb-0">Hızlı Eylemler</h5>
            </Card.Header>
            <Card.Body>
              <Row>
                <Col md={3} className="mb-2">
                  <a href="/sales/new" className="btn btn-primary w-100">
                    Yeni Satış Ekle
                  </a>
                </Col>
                <Col md={3} className="mb-2">
                  <a href="/sales" className="btn btn-outline-primary w-100">
                    Satışları Görüntüle
                  </a>
                </Col>
                <Col md={3} className="mb-2">
                  <a href="/prims/earnings" className="btn btn-outline-info w-100">
                    Prim Hakedişleri
                  </a>
                </Col>
                <Col md={3} className="mb-2">
                  <a href="/reports" className="btn btn-outline-success w-100">
                    Raporlar
                  </a>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>
          </Tab.Pane>
          
          <Tab.Pane eventKey="team-status">
            <TeamStatus />
          </Tab.Pane>
        </Tab.Content>
      </Tab.Container>
    </div>
  );
};

export default Dashboard;
