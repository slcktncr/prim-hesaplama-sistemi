import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Form, 
  Button,
  Alert,
  Table,
  Badge,
  ProgressBar
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { FiRefreshCw, FiFilter, FiTrendingUp } from 'react-icons/fi';

import { reportsAPI, primsAPI, usersAPI } from '../../utils/api';
import { formatCurrency, formatNumber, debounce } from '../../utils/helpers';
import Loading from '../Common/Loading';

const PerformanceReport = () => {
  const [performanceData, setPerformanceData] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    period: '',
    salesperson: ''
  });

  useEffect(() => {
    fetchPeriods();
    fetchUsers();
    const debouncedFetch = debounce(fetchPerformanceData, 500);
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

  const fetchUsers = async () => {
    try {
      const response = await usersAPI.getAllUsers();
      setUsers(response.data || []);
    } catch (error) {
      console.error('Users fetch error:', error);
    }
  };

  const fetchPerformanceData = async () => {
    try {
      setLoading(true);
      console.log('Frontend - Fetching performance data with filters:', filters);
      const response = await reportsAPI.getSalespersonPerformance(filters);
      console.log('Frontend - Performance data response:', response.data);
      setPerformanceData(response.data || []);
      setError(null);
    } catch (error) {
      console.error('Performance data fetch error:', error);
      setError('Performans raporu yüklenirken hata oluştu');
      toast.error('Performans raporu yüklenirken hata oluştu');
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
      startDate: '',
      endDate: '',
      period: '',
      salesperson: ''
    });
  };

  if (loading) {
    return <Loading variant="dots" size="large" />;
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  const maxSales = Math.max(...performanceData.map(p => p.totalSales), 1);

  return (
    <div>
      {/* Filters */}
      <Card className="mb-4">
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
            <Col md={3}>
              <Form.Group>
                <Form.Label>Temsilci</Form.Label>
                <Form.Select
                  value={filters.salesperson}
                  onChange={(e) => handleFilterChange('salesperson', e.target.value)}
                >
                  <option value="">Tüm Temsilciler</option>
                  {users.map(user => (
                    <option key={user._id} value={user._id}>
                      {user.name}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={12} className="mt-3">
              <div className="d-flex gap-2">
                <Button variant="outline-secondary" onClick={fetchPerformanceData}>
                  <FiRefreshCw className="me-1" />
                  Yenile
                </Button>
                <Button variant="outline-primary" onClick={clearFilters}>
                  <FiFilter className="me-1" />
                  Filtreleri Temizle
                </Button>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Performance Table */}
      <Card>
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">
              <FiTrendingUp className="me-2" />
              Temsilci Performans Tablosu
            </h5>
            <Badge bg="primary">{performanceData.length} temsilci</Badge>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          {performanceData.length === 0 ? (
            <div className="text-center py-5">
              <p className="text-muted">Performans verisi bulunamadı.</p>
            </div>
          ) : (
            <Table responsive hover className="mb-0">
              <thead>
                <tr>
                  <th>Sıra</th>
                  <th>Temsilci</th>
                  <th>Toplam Satış</th>
                  <th>Satış Tutarı</th>
                  <th>Prim Tutarı</th>
                  <th>Ortalama Satış</th>
                  <th>Prim Durumu</th>
                  <th>İptal Durumu</th>
                  <th>Kesinti</th>
                  <th>Net Prim</th>
                  <th>Performans</th>
                </tr>
              </thead>
              <tbody>
                {performanceData.map((performer, index) => (
                  <tr key={performer._id}>
                    <td>
                      <Badge 
                        bg={index === 0 ? 'warning' : index === 1 ? 'secondary' : index === 2 ? 'success' : 'light'}
                        text={index > 2 ? 'dark' : 'white'}
                      >
                        #{index + 1}
                      </Badge>
                    </td>
                    <td>
                      <div>
                        <strong>{performer.name}</strong>
                        <div className="small text-muted">{performer.email}</div>
                      </div>
                    </td>
                    <td>
                      <div className="fw-bold text-primary">
                        {formatNumber(performer.totalSales)}
                      </div>
                    </td>
                    <td>
                      <div className="fw-bold">
                        {formatCurrency(performer.totalSalesAmount)}
                      </div>
                    </td>
                    <td>
                      <div className="fw-bold text-success">
                        {formatCurrency(performer.totalPrimAmount)}
                      </div>
                    </td>
                    <td>
                      <div>
                        {formatCurrency(performer.avgSaleAmount)}
                      </div>
                    </td>
                    <td>
                      <div className="small">
                        <div className="text-success">
                          Ödenen: {formatNumber(performer.paidPrims)}
                        </div>
                        <div className="text-warning">
                          Ödenmemiş: {formatNumber(performer.unpaidPrims)}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="small">
                        {performer.cancelledSales > 0 ? (
                          <>
                            <div className="text-danger">
                              İptal: {formatNumber(performer.cancelledSales)}
                            </div>
                            <div className="text-muted">
                              {formatCurrency(performer.cancelledAmount)}
                            </div>
                          </>
                        ) : (
                          <div className="text-success">İptal yok</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="small">
                        {performer.deductionCount > 0 ? (
                          <>
                            <div className="text-danger">
                              İptal: {formatNumber(performer.deductionCount)}
                            </div>
                            <div className="text-muted">
                              {formatCurrency(performer.deductionAmount)}
                            </div>
                          </>
                        ) : (
                          <div className="text-success">Kesinti yok</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="fw-bold text-info">
                        {formatCurrency(performer.netPrimAmount)}
                      </div>
                      <div className="small text-muted">
                        Net Hakediş
                      </div>
                    </td>
                    <td style={{ width: '150px' }}>
                      <div className="mb-1">
                        <small>Satış Performansı</small>
                        <ProgressBar 
                          variant="primary"
                          now={(performer.totalSales / maxSales) * 100}
                          style={{ height: '6px' }}
                        />
                      </div>
                      <div className="small text-muted">
                        {((performer.totalSales / maxSales) * 100).toFixed(0)}% of top
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default PerformanceReport;
