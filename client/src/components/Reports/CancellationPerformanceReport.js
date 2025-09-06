import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Form, 
  Button,
  Alert,
  Badge,
  ListGroup,
  Table,
  ProgressBar
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { FiRefreshCw, FiFilter, FiXCircle, FiUser, FiAlertTriangle } from 'react-icons/fi';

import { reportsAPI, primsAPI } from '../../utils/api';
import { formatCurrency, formatNumber, debounce } from '../../utils/helpers';
import Loading from '../Common/Loading';

const CancellationPerformanceReport = () => {
  const [cancellationData, setCancellationData] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    period: '',
    limit: 20
  });

  useEffect(() => {
    fetchPeriods();
    const debouncedFetch = debounce(fetchCancellationData, 500);
    debouncedFetch();
  }, [filters]);

  const fetchPeriods = async () => {
    try {
      const response = await primsAPI.getPeriods();
      setPeriods(response.data || []);
    } catch (error) {
      console.error('Periods fetch error:', error);
    }
  };

  const fetchCancellationData = async () => {
    try {
      setLoading(true);
      const response = await reportsAPI.getCancellationPerformance(filters);
      setCancellationData(response.data || []);
      setError(null);
    } catch (error) {
      console.error('Cancellation data fetch error:', error);
      setError('İptal performans raporu yüklenirken hata oluştu');
      toast.error('İptal performans raporu yüklenirken hata oluştu');
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

  const clearFilters = () => {
    setFilters({
      period: '',
      limit: 20
    });
  };

  const getCancellationRate = (cancelled, total) => {
    if (total === 0) return 0;
    return ((cancelled / total) * 100).toFixed(1);
  };

  const getRiskLevel = (rate) => {
    if (rate >= 20) return { variant: 'danger', text: 'Yüksek Risk' };
    if (rate >= 10) return { variant: 'warning', text: 'Orta Risk' };
    if (rate >= 5) return { variant: 'info', text: 'Düşük Risk' };
    return { variant: 'success', text: 'Güvenli' };
  };

  if (loading) {
    return <Loading variant="ripple" size="large" />;
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  const totalCancellations = cancellationData.reduce((sum, item) => sum + item.cancelledSales, 0);
  const totalSales = cancellationData.reduce((sum, item) => sum + item.totalSales, 0);
  const overallRate = getCancellationRate(totalCancellations, totalSales);

  return (
    <div>
      {/* Filters */}
      <Card className="mb-4">
        <Card.Body>
          <Row>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Dönem</Form.Label>
                <Form.Select
                  value={filters.period}
                  onChange={(e) => handleFilterChange('period', e.target.value)}
                >
                  <option value="">Tüm Dönemler</option>
                  {periods.map(period => (
                    <option key={period._id} value={period._id}>
                      {period.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Gösterilecek Sayı</Form.Label>
                <Form.Select
                  value={filters.limit}
                  onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
                >
                  <option value={10}>İlk 10</option>
                  <option value={20}>İlk 20</option>
                  <option value={50}>İlk 50</option>
                  <option value={100}>Tümü</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>&nbsp;</Form.Label>
                <div className="d-flex gap-2">
                  <Button variant="outline-secondary" onClick={fetchCancellationData}>
                    <FiRefreshCw />
                  </Button>
                  <Button variant="outline-primary" onClick={clearFilters}>
                    <FiFilter />
                  </Button>
                </div>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Header */}
      <div className="mb-4">
        <h5>
          <FiXCircle className="me-2" />
          İptal Performansları
        </h5>
        <p className="text-muted mb-0">
          Temsilcilerin iptal oranları ve performans analizi
        </p>
      </div>

      {/* Overall Statistics */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <div className="h4 text-danger">{formatNumber(totalCancellations)}</div>
              <div className="small text-muted">Toplam İptal</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <div className="h4 text-primary">{formatNumber(totalSales)}</div>
              <div className="small text-muted">Toplam Satış</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <div className="h4 text-warning">%{overallRate}</div>
              <div className="small text-muted">Genel İptal Oranı</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Badge bg={getRiskLevel(parseFloat(overallRate)).variant} className="p-2">
                {getRiskLevel(parseFloat(overallRate)).text}
              </Badge>
              <div className="small text-muted mt-1">Risk Seviyesi</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {cancellationData.length === 0 ? (
        <Alert variant="info">
          <FiAlertTriangle className="me-2" />
          Seçilen kriterlerde iptal verisi bulunamadı.
        </Alert>
      ) : (
        <Row>
          {/* Main Table */}
          <Col lg={8}>
            <Card>
              <Card.Header>
                <div className="d-flex justify-content-between align-items-center">
                  <h6 className="mb-0">İptal Performans Tablosu</h6>
                  <Badge bg="primary">{cancellationData.length} temsilci</Badge>
                </div>
              </Card.Header>
              <Card.Body className="p-0">
                <Table responsive hover className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Sıra</th>
                      <th>Temsilci</th>
                      <th>Toplam Satış</th>
                      <th>İptal Edilen</th>
                      <th>İptal Oranı</th>
                      <th>İptal Tutarı</th>
                      <th>Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cancellationData.map((item, index) => {
                      const rate = getCancellationRate(item.cancelledSales, item.totalSales);
                      const risk = getRiskLevel(parseFloat(rate));
                      
                      return (
                        <tr key={item._id}>
                          <td>
                            <Badge bg="secondary" className="rounded-circle">
                              {index + 1}
                            </Badge>
                          </td>
                          <td>
                            <div className="d-flex align-items-center">
                              <FiUser className="me-2 text-muted" />
                              <div>
                                <div className="fw-bold">{item.name}</div>
                                <div className="small text-muted">{item.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="fw-bold text-primary">
                              {formatNumber(item.totalSales)}
                            </div>
                          </td>
                          <td>
                            <div className="fw-bold text-danger">
                              {formatNumber(item.cancelledSales)}
                            </div>
                          </td>
                          <td>
                            <div className="d-flex align-items-center">
                              <div className="me-2">%{rate}</div>
                              <ProgressBar 
                                variant={risk.variant}
                                now={parseFloat(rate)}
                                style={{ width: '60px', height: '8px' }}
                              />
                            </div>
                          </td>
                          <td>
                            <div className="fw-bold text-warning">
                              {formatCurrency(item.cancelledAmount || 0)}
                            </div>
                          </td>
                          <td>
                            <Badge bg={risk.variant}>
                              {risk.text}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          </Col>

          {/* Statistics Sidebar */}
          <Col lg={4}>
            <Card className="mb-4">
              <Card.Header>
                <h6 className="mb-0">
                  <FiAlertTriangle className="me-2" />
                  Risk Analizi
                </h6>
              </Card.Header>
              <Card.Body>
                <div className="mb-3">
                  <div className="d-flex justify-content-between mb-1">
                    <span>Yüksek Risk (≥%20):</span>
                    <Badge bg="danger">
                      {cancellationData.filter(item => 
                        getCancellationRate(item.cancelledSales, item.totalSales) >= 20
                      ).length}
                    </Badge>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="d-flex justify-content-between mb-1">
                    <span>Orta Risk (%10-19):</span>
                    <Badge bg="warning">
                      {cancellationData.filter(item => {
                        const rate = getCancellationRate(item.cancelledSales, item.totalSales);
                        return rate >= 10 && rate < 20;
                      }).length}
                    </Badge>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="d-flex justify-content-between mb-1">
                    <span>Düşük Risk (%5-9):</span>
                    <Badge bg="info">
                      {cancellationData.filter(item => {
                        const rate = getCancellationRate(item.cancelledSales, item.totalSales);
                        return rate >= 5 && rate < 10;
                      }).length}
                    </Badge>
                  </div>
                </div>
                <div>
                  <div className="d-flex justify-content-between mb-1">
                    <span>Güvenli (&lt;%5):</span>
                    <Badge bg="success">
                      {cancellationData.filter(item => 
                        getCancellationRate(item.cancelledSales, item.totalSales) < 5
                      ).length}
                    </Badge>
                  </div>
                </div>
              </Card.Body>
            </Card>

            <Card>
              <Card.Header>
                <h6 className="mb-0">En Yüksek İptal Oranları</h6>
              </Card.Header>
              <Card.Body>
                <ListGroup variant="flush">
                  {cancellationData
                    .sort((a, b) => 
                      getCancellationRate(b.cancelledSales, b.totalSales) - 
                      getCancellationRate(a.cancelledSales, a.totalSales)
                    )
                    .slice(0, 5)
                    .map((item, index) => {
                      const rate = getCancellationRate(item.cancelledSales, item.totalSales);
                      const risk = getRiskLevel(parseFloat(rate));
                      
                      return (
                        <ListGroup.Item key={item._id} className="d-flex justify-content-between align-items-center px-0">
                          <div>
                            <div className="fw-bold">{item.name}</div>
                            <div className="small text-muted">
                              {formatNumber(item.cancelledSales)} / {formatNumber(item.totalSales)}
                            </div>
                          </div>
                          <div className="text-end">
                            <div className="fw-bold">%{rate}</div>
                            <Badge bg={risk.variant} className="small">
                              {risk.text}
                            </Badge>
                          </div>
                        </ListGroup.Item>
                      );
                    })}
                </ListGroup>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default CancellationPerformanceReport;
