import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Alert,
  Table,
  Badge
} from 'react-bootstrap';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { toast } from 'react-toastify';
import { FiCalendar, FiTrendingUp, FiTrendingDown } from 'react-icons/fi';

import { reportsAPI } from '../../utils/api';
import { formatCurrency, formatCurrencyCompact, formatNumber, formatNumberCompact } from '../../utils/helpers';
import Loading from '../Common/Loading';

const PeriodComparisonReport = () => {
  const [comparisonData, setComparisonData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchComparisonData();
  }, []);

  const fetchComparisonData = async () => {
    try {
      setLoading(true);
      const response = await reportsAPI.getPeriodComparison();
      setComparisonData(response.data || []);
      setError(null);
    } catch (error) {
      console.error('Period comparison fetch error:', error);
      setError('Dönem karşılaştırma raporu yüklenirken hata oluştu');
      toast.error('Dönem karşılaştırma raporu yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading variant="ripple" size="large" />;
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  const chartData = comparisonData.map(item => ({
    period: item.period,
    aktiveSatış: item.activeSales,
    iptalSatış: item.cancelledSales,
    ciro: item.totalAmount,
    prim: item.totalPrim
  }));

  const getTrendIcon = (current, previous) => {
    if (!previous) return null;
    return current > previous ? 
      <FiTrendingUp className="text-success" /> : 
      <FiTrendingDown className="text-danger" />;
  };

  const getTrendPercentage = (current, previous) => {
    if (!previous || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return (
      <Badge bg={change > 0 ? 'success' : 'danger'}>
        {change > 0 ? '+' : ''}{change.toFixed(1)}%
      </Badge>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h5>
          <FiCalendar className="me-2" />
          Dönem Karşılaştırma Raporu
        </h5>
        <p className="text-muted mb-0">
          Son 6 ayın performans karşılaştırması
        </p>
      </div>

      {comparisonData.length === 0 ? (
        <Alert variant="info">
          Henüz karşılaştırma için yeterli dönem verisi bulunmuyor.
        </Alert>
      ) : (
        <>
          {/* Charts */}
          <Row className="mb-4">
            <Col lg={6}>
              <Card>
                <Card.Header>
                  <h6 className="mb-0">Satış Adedi Trendi</h6>
                </Card.Header>
                <Card.Body>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis 
                        tickFormatter={(value) => formatNumberCompact(value)}
                        width={50}
                      />
                      <Tooltip formatter={(value) => formatNumber(value)} />
                      <Line type="monotone" dataKey="aktiveSatış" stroke="#28a745" strokeWidth={2} />
                      <Line type="monotone" dataKey="iptalSatış" stroke="#dc3545" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </Col>
            <Col lg={6}>
              <Card>
                <Card.Header>
                  <h6 className="mb-0">Ciro ve Prim Trendi</h6>
                </Card.Header>
                <Card.Body>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis 
                        tickFormatter={(value) => formatCurrencyCompact(value)}
                        width={60}
                      />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Bar dataKey="ciro" fill="#007bff" />
                      <Bar dataKey="prim" fill="#28a745" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Comparison Table */}
          <Card>
            <Card.Header>
              <h6 className="mb-0">Detaylı Dönem Karşılaştırması</h6>
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive hover className="mb-0">
                <thead>
                  <tr>
                    <th>Dönem</th>
                    <th>Aktif Satış</th>
                    <th>İptal Satış</th>
                    <th>Başarı Oranı</th>
                    <th>Toplam Ciro</th>
                    <th>Toplam Prim</th>
                    <th>Ödenen Prim</th>
                    <th>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((period, index) => {
                    const previousPeriod = comparisonData[index + 1];
                    const successRate = period.successRate || 0;

                    return (
                      <tr key={period.periodId}>
                        <td>
                          <strong>{period.period}</strong>
                        </td>
                        <td>
                          <div className="fw-bold text-success">
                            {formatNumber(period.activeSales)}
                          </div>
                        </td>
                        <td>
                          <div className="fw-bold text-danger">
                            {formatNumber(period.cancelledSales)}
                          </div>
                        </td>
                        <td>
                          <Badge 
                            bg={successRate >= 80 ? 'success' : successRate >= 60 ? 'warning' : 'danger'}
                          >
                            %{successRate}
                          </Badge>
                          <div className="small text-muted">
                            {period.realSalesCount || 0}/{period.totalSalesCount || 0}
                          </div>
                        </td>
                        <td>
                          <div className="fw-bold">
                            {formatCurrency(period.totalAmount)}
                          </div>
                        </td>
                        <td>
                          <div className="fw-bold text-primary">
                            {formatCurrency(period.totalPrim)}
                          </div>
                        </td>
                        <td>
                          <div>
                            <div className="small text-success">
                              {formatNumber(period.paidPrims)} ödendi
                            </div>
                            <div className="small text-warning">
                              {formatNumber(period.activeSales - period.paidPrims)} bekliyor
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            {getTrendIcon(period.activeSales, previousPeriod?.activeSales)}
                            {getTrendPercentage(period.activeSales, previousPeriod?.activeSales)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card.Body>
          </Card>

          {/* Summary Stats */}
          <Row className="mt-4">
            <Col md={3}>
              <Card className="text-center">
                <Card.Body>
                  <div className="h4 text-primary">
                    {formatNumber(comparisonData.reduce((sum, p) => sum + p.activeSales, 0))}
                  </div>
                  <div className="text-muted small">Toplam Aktif Satış</div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center">
                <Card.Body>
                  <div className="h4 text-success">
                    {formatCurrency(comparisonData.reduce((sum, p) => sum + p.totalAmount, 0))}
                  </div>
                  <div className="text-muted small">Toplam Ciro</div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center">
                <Card.Body>
                  <div className="h4 text-info">
                    {formatCurrency(comparisonData.reduce((sum, p) => sum + p.totalPrim, 0))}
                  </div>
                  <div className="text-muted small">Toplam Prim</div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center">
                <Card.Body>
                  <div className="h4 text-warning">
                    {comparisonData.length > 0 ? 
                      `%${(comparisonData.reduce((sum, p) => sum + (p.successRate || 0), 0) / comparisonData.length).toFixed(1)}` : 
                      '%0'
                    }
                  </div>
                  <div className="text-muted small">Ortalama Başarı</div>
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                    (Gerçek satış / Toplam giriş)
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
};

export default PeriodComparisonReport;
