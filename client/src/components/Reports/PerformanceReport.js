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
import { formatCurrency, formatNumber, debounce, getQuickDateFilters } from '../../utils/helpers';
import Loading from '../Common/Loading';
import MultiSelectDropdown from '../Common/MultiSelectDropdown';

const PerformanceReport = () => {
  const [performanceData, setPerformanceData] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    periods: [], // Çoklu dönem seçimi
    salespersons: [] // Çoklu temsilci seçimi
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
      const response = await usersAPI.getUsersForFilters(); // Tüm kullanıcılar erişebilir
      setUsers(response.data || []);
    } catch (error) {
      console.error('Users fetch error:', error);
    }
  };

  const fetchPerformanceData = async () => {
    try {
      setLoading(true);
      console.log('Frontend - Fetching performance data with filters:', filters);
      
      // Çoklu filtreleri API'ye uygun formata dönüştür
      const apiFilters = {
        startDate: filters.startDate,
        endDate: filters.endDate
      };
      
      // Çoklu dönem ve temsilci filtrelerini ekle
      if (filters.periods && filters.periods.length > 0) {
        apiFilters.periods = filters.periods;
      }
      if (filters.salespersons && filters.salespersons.length > 0) {
        apiFilters.salespersons = filters.salespersons;
      }
      
      const response = await reportsAPI.getSalespersonPerformance(apiFilters);
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

  const handleMultiSelectChange = (field, value, checked) => {
    setFilters(prev => {
      const currentValues = prev[field] || [];
      if (checked) {
        return {
          ...prev,
          [field]: [...currentValues, value]
        };
      } else {
        return {
          ...prev,
          [field]: currentValues.filter(item => item !== value)
        };
      }
    });
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      periods: [],
      salespersons: []
    });
  };

  const exportFilteredData = async (type) => {
    try {
      toast.info(`${type === 'excel' ? 'Excel' : 'PDF'} raporu hazırlanıyor...`);
      
      const exportData = {
        type,
        scope: 'filtered',
        ...filters
      };
      
      const response = await reportsAPI.exportExcel(exportData);
      
      // Blob'dan dosya oluştur
      const blob = new Blob([response.data], {
        type: type === 'excel' 
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf'
      });
      
      // Dosya adı oluştur
      const fileName = `filtrelenmis_performans_raporu_${new Date().toISOString().split('T')[0]}.${type === 'excel' ? 'xlsx' : 'pdf'}`;
      
      // Dosyayı indir
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`${type === 'excel' ? 'Excel' : 'PDF'} raporu başarıyla indirildi!`);
      
    } catch (error) {
      console.error('Export error:', error);
      toast.error(`${type === 'excel' ? 'Excel' : 'PDF'} raporu indirme sırasında hata oluştu`);
    }
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
          <Row className="align-items-end">
            <Col md={2}>
              <Form.Group>
                <Form.Label>Başlangıç Tarihi</Form.Label>
                <Form.Control
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label>Bitiş Tarihi</Form.Label>
                <Form.Control
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                />
              </Form.Group>
            </Col>
          </Row>
          
          <Row className="mb-3">
            <Col md={12}>
              <Form.Group>
                <Form.Label>Hızlı Tarih Seçimi</Form.Label>
                <div className="d-flex gap-2">
                  {(() => {
                    const quickFilters = getQuickDateFilters(filters);
                    return (
                      <>
                        <Button 
                          variant="outline-primary" 
                          size="sm"
                          onClick={() => setFilters(quickFilters.yesterday())}
                        >
                          Dün
                        </Button>
                        <Button 
                          variant="outline-primary" 
                          size="sm"
                          onClick={() => setFilters(quickFilters.thisMonth())}
                        >
                          Bu Ay
                        </Button>
                        <Button 
                          variant="outline-primary" 
                          size="sm"
                          onClick={() => setFilters(quickFilters.lastMonth())}
                        >
                          Geçen Ay
                        </Button>
                        <Button 
                          variant="outline-primary" 
                          size="sm"
                          onClick={() => setFilters(quickFilters.thisYear())}
                        >
                          Bu Yıl
                        </Button>
                      </>
                    );
                  })()}
                </div>
              </Form.Group>
            </Col>
          </Row>
          
          <Row className="mb-3">
            <Col md={2}></Col>
            <Col md={2}></Col>
            <Col md={3}>
              <MultiSelectDropdown
                label="Dönemler"
                placeholder="Dönem seçin..."
                options={periods.map(period => ({ value: period._id, label: period.name }))}
                selectedValues={filters.periods}
                onChange={(values) => setFilters(prev => ({ ...prev, periods: values }))}
              />
            </Col>
            <Col md={3}>
              <MultiSelectDropdown
                label="Temsilciler"
                placeholder="Temsilci seçin..."
                options={users.map(user => ({ value: user._id, label: user.name }))}
                selectedValues={filters.salespersons}
                onChange={(values) => setFilters(prev => ({ ...prev, salespersons: values }))}
              />
            </Col>
            <Col md={2}>
              <div className="d-flex flex-column gap-2">
                <Button variant="outline-secondary" size="sm" onClick={fetchPerformanceData}>
                  <FiRefreshCw className="me-1" />
                  Yenile
                </Button>
                <Button variant="outline-primary" size="sm" onClick={clearFilters}>
                  <FiFilter className="me-1" />
                  Temizle
                </Button>
              </div>
            </Col>
          </Row>
          
          {/* Filtered Export Buttons */}
          {(filters.periods.length > 0 || filters.salespersons.length > 0 || filters.startDate || filters.endDate) && (
            <Row className="mt-3 pt-3 border-top">
              <Col>
                <div className="d-flex align-items-center gap-3">
                  <span className="text-muted small">
                    <FiTrendingUp className="me-1" />
                    Filtrelenmiş Veriyi Raporla:
                  </span>
                  <div className="d-flex gap-2">
                    <Button 
                      variant="success" 
                      size="sm"
                      onClick={() => exportFilteredData('excel')}
                    >
                      📊 Excel İndir
                    </Button>
                    <Button 
                      variant="danger" 
                      size="sm"
                      onClick={() => exportFilteredData('pdf')}
                    >
                      📄 PDF İndir
                    </Button>
                  </div>
                </div>
              </Col>
            </Row>
          )}
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
