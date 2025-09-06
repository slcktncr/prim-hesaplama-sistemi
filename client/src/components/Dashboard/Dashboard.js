import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Alert, Form, Button } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { FiRefreshCw, FiCalendar } from 'react-icons/fi';
import { reportsAPI, primsAPI } from '../../utils/api';
import { formatCurrency, formatNumber } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';
import Loading from '../Common/Loading';
import StatsCard from './StatsCard';
import TopPerformers from './TopPerformers';
import RecentActivity from './RecentActivity';

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const { user } = useAuth();

  useEffect(() => {
    fetchPeriods();
  }, []);

  useEffect(() => {
    if (periods.length > 0) {
      fetchDashboardData();
    }
  }, [selectedPeriod, periods]);

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
      const params = selectedPeriod !== 'all' ? { period: selectedPeriod } : {};
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
    topPerformers
  } = dashboardData || {};

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1>Dashboard</h1>
          <p className="text-muted mb-0">
            Hoş geldiniz, {user?.name}
            {user?.role === 'admin' && <span className="badge bg-warning ms-2">Admin</span>}
          </p>
        </div>
      </div>

      {/* İstatistik Kartları */}
      <Row className="mb-4">
        <Col lg={3} md={6} className="mb-3">
          <StatsCard
            title="Toplam Satış"
            value={formatNumber(totalSales)}
            icon="shopping-bag"
            color="primary"
          />
        </Col>
        <Col lg={3} md={6} className="mb-3">
          <StatsCard
            title="Bu Ay Satış"
            value={formatNumber(thisMonthSales)}
            icon="calendar"
            color="success"
          />
        </Col>
        <Col lg={3} md={6} className="mb-3">
          <StatsCard
            title="Toplam Ciro"
            value={formatCurrency(totalSalesAmount)}
            icon="dollar-sign"
            color="info"
          />
        </Col>
        <Col lg={3} md={6} className="mb-3">
          <StatsCard
            title="Toplam Prim"
            value={formatCurrency(totalPrimAmount)}
            icon="trending-up"
            color="warning"
          />
        </Col>
      </Row>

      <Row className="mb-4">
        <Col lg={3} md={6} className="mb-3">
          <StatsCard
            title="Ödenen Primler"
            value={formatNumber(paidPrims)}
            icon="check-circle"
            color="success"
          />
        </Col>
        <Col lg={3} md={6} className="mb-3">
          <StatsCard
            title="Ödenmemiş Primler"
            value={formatNumber(unpaidPrims)}
            icon="clock"
            color="warning"
          />
        </Col>
        <Col lg={3} md={6} className="mb-3">
          <StatsCard
            title="İptal Edilen"
            value={formatNumber(cancelledSales)}
            icon="x-circle"
            color="danger"
          />
        </Col>
        <Col lg={3} md={6} className="mb-3">
          <StatsCard
            title="Başarı Oranı"
            value={totalSales > 0 ? `%${((totalSales / (totalSales + cancelledSales)) * 100).toFixed(1)}` : '%0'}
            icon="target"
            color="info"
          />
        </Col>
      </Row>

      <Row>
        {/* En İyi Performans (Sadece Admin için) */}
        {user?.role === 'admin' && topPerformers && (
          <Col lg={6} className="mb-4">
            <TopPerformers performers={topPerformers} />
          </Col>
        )}

        {/* Son Aktiviteler */}
        <Col lg={user?.role === 'admin' ? 6 : 12} className="mb-4">
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
    </div>
  );
};

export default Dashboard;
