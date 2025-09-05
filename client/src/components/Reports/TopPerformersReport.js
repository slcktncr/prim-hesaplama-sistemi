import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Form, 
  Button,
  Alert,
  Badge,
  ListGroup
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { FiRefreshCw, FiFilter, FiTarget, FiAward, FiUser } from 'react-icons/fi';

import { reportsAPI, primsAPI } from '../../utils/api';
import { formatCurrency, formatNumber, debounce } from '../../utils/helpers';
import Loading from '../Common/Loading';

const TopPerformersReport = () => {
  const [topPerformers, setTopPerformers] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    period: '',
    limit: 10
  });

  useEffect(() => {
    fetchPeriods();
    const debouncedFetch = debounce(fetchTopPerformers, 500);
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

  const fetchTopPerformers = async () => {
    try {
      setLoading(true);
      const response = await reportsAPI.getTopPerformers(filters);
      setTopPerformers(response.data || []);
      setError(null);
    } catch (error) {
      console.error('Top performers fetch error:', error);
      setError('En iyi performans raporu yüklenirken hata oluştu');
      toast.error('En iyi performans raporu yüklenirken hata oluştu');
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
      limit: 10
    });
  };

  const getMedalIcon = (index) => {
    switch (index) {
      case 0: return '🥇';
      case 1: return '🥈';
      case 2: return '🥉';
      default: return '🏆';
    }
  };

  const getBadgeVariant = (index) => {
    switch (index) {
      case 0: return 'warning';
      case 1: return 'secondary';
      case 2: return 'success';
      default: return 'primary';
    }
  };

  if (loading) {
    return <Loading variant="ripple" size="large" />;
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

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
                  <option value={5}>İlk 5</option>
                  <option value={10}>İlk 10</option>
                  <option value={20}>İlk 20</option>
                  <option value={50}>İlk 50</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>&nbsp;</Form.Label>
                <div className="d-flex gap-2">
                  <Button variant="outline-secondary" onClick={fetchTopPerformers}>
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
          <FiTarget className="me-2" />
          En İyi Performans Gösteren Temsilciler
        </h5>
        <p className="text-muted mb-0">
          Satış adedine göre sıralanmış en başarılı temsilciler
        </p>
      </div>

      {topPerformers.length === 0 ? (
        <Alert variant="info">
          <FiAward className="me-2" />
          Seçilen kriterlerde performans verisi bulunamadı.
        </Alert>
      ) : (
        <Row>
          {/* Top 3 Cards */}
          <Col lg={8}>
            <Row className="mb-4">
              {topPerformers.slice(0, 3).map((performer, index) => (
                <Col md={4} key={performer._id} className="mb-3">
                  <Card className={`h-100 ${index === 0 ? 'border-warning' : index === 1 ? 'border-secondary' : 'border-success'}`}>
                    <Card.Body className="text-center">
                      <div className="mb-3" style={{ fontSize: '3rem' }}>
                        {getMedalIcon(index)}
                      </div>
                      <Badge 
                        bg={getBadgeVariant(index)} 
                        className="mb-2"
                        style={{ fontSize: '0.9rem' }}
                      >
                        #{index + 1}
                      </Badge>
                      <h5 className="mb-2">{performer.name}</h5>
                      <div className="mb-2">
                        <div className="h4 text-primary">
                          {formatNumber(performer.totalSales)}
                        </div>
                        <div className="small text-muted">Satış</div>
                      </div>
                      <div className="mb-2">
                        <div className="h6 text-success">
                          {formatCurrency(performer.totalPrim)}
                        </div>
                        <div className="small text-muted">Prim</div>
                      </div>
                      <div className="small text-muted">
                        Ortalama: {formatCurrency(performer.avgSaleAmount)}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>

            {/* Full List */}
            <Card>
              <Card.Header>
                <div className="d-flex justify-content-between align-items-center">
                  <h6 className="mb-0">Tüm Performans Listesi</h6>
                  <Badge bg="primary">{topPerformers.length} temsilci</Badge>
                </div>
              </Card.Header>
              <Card.Body className="p-0">
                <ListGroup variant="flush">
                  {topPerformers.map((performer, index) => (
                    <ListGroup.Item key={performer._id} className="d-flex align-items-center">
                      <div className="me-3">
                        <Badge 
                          bg={getBadgeVariant(index)}
                          className="rounded-circle p-2"
                          style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          {index < 3 ? getMedalIcon(index) : index + 1}
                        </Badge>
                      </div>
                      <div className="flex-grow-1">
                        <div className="d-flex align-items-center mb-1">
                          <FiUser className="me-2 text-muted" size={16} />
                          <strong>{performer.name}</strong>
                          {index < 3 && (
                            <Badge bg="light" text="dark" className="ms-2">
                              Top {index + 1}
                            </Badge>
                          )}
                        </div>
                        <div className="small text-muted">
                          {performer.email}
                        </div>
                      </div>
                      <div className="text-end me-3">
                        <div className="fw-bold text-primary">
                          {formatNumber(performer.totalSales)} satış
                        </div>
                        <div className="small text-muted">
                          {formatCurrency(performer.totalAmount)}
                        </div>
                      </div>
                      <div className="text-end" style={{ minWidth: '100px' }}>
                        <div className="fw-bold text-success">
                          {formatCurrency(performer.totalPrim)}
                        </div>
                        <div className="small text-muted">
                          Prim
                        </div>
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </Card.Body>
            </Card>
          </Col>

          {/* Statistics Sidebar */}
          <Col lg={4}>
            <Card className="mb-4">
              <Card.Header>
                <h6 className="mb-0">
                  <FiAward className="me-2" />
                  Performans İstatistikleri
                </h6>
              </Card.Header>
              <Card.Body>
                <div className="mb-3">
                  <div className="d-flex justify-content-between">
                    <span>En Yüksek Satış:</span>
                    <strong>{formatNumber(topPerformers[0]?.totalSales || 0)}</strong>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="d-flex justify-content-between">
                    <span>En Yüksek Prim:</span>
                    <strong>{formatCurrency(topPerformers[0]?.totalPrim || 0)}</strong>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="d-flex justify-content-between">
                    <span>Ortalama Satış:</span>
                    <strong>
                      {formatNumber(
                        topPerformers.length > 0 ? 
                        topPerformers.reduce((sum, p) => sum + p.totalSales, 0) / topPerformers.length : 
                        0
                      )}
                    </strong>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="d-flex justify-content-between">
                    <span>Toplam Satış:</span>
                    <strong>
                      {formatNumber(topPerformers.reduce((sum, p) => sum + p.totalSales, 0))}
                    </strong>
                  </div>
                </div>
                <div>
                  <div className="d-flex justify-content-between">
                    <span>Toplam Prim:</span>
                    <strong className="text-success">
                      {formatCurrency(topPerformers.reduce((sum, p) => sum + p.totalPrim, 0))}
                    </strong>
                  </div>
                </div>
              </Card.Body>
            </Card>

            <Card>
              <Card.Header>
                <h6 className="mb-0">Başarı Kriterleri</h6>
              </Card.Header>
              <Card.Body>
                <div className="small">
                  <h6>Sıralama Kriterleri:</h6>
                  <ul>
                    <li>Birincil: Toplam satış adedi</li>
                    <li>İkincil: Toplam prim tutarı</li>
                    <li>Üçüncül: Ortalama satış tutarı</li>
                  </ul>
                  
                  <h6 className="mt-3">Ödül Kategorileri:</h6>
                  <ul>
                    <li>🥇 <strong>Altın:</strong> 1. sıra</li>
                    <li>🥈 <strong>Gümüş:</strong> 2. sıra</li>
                    <li>🥉 <strong>Bronz:</strong> 3. sıra</li>
                    <li>🏆 <strong>Başarı:</strong> Top 10</li>
                  </ul>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default TopPerformersReport;
