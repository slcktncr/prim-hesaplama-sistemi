import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Form, 
  Button,
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
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { toast } from 'react-toastify';
import { 
  FiDownload, 
  FiRefreshCw,
  FiFilter
} from 'react-icons/fi';

import { reportsAPI, primsAPI, usersAPI } from '../../utils/api';
import { 
  formatCurrency, 
  formatNumber,
  debounce,
  getQuickDateFilters
} from '../../utils/helpers';
import Loading from '../Common/Loading';
import MultiSelectDropdown from '../Common/MultiSelectDropdown';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const SalesSummaryReport = () => {
  const [reportData, setReportData] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    period: ''
  });

  // Satış türü isimlerini düzeltme fonksiyonu
  const formatSaleTypeName = (saleType) => {
    const typeMap = {
      'satis': 'SATIŞ',
      'kapora': 'KAPORA', 
      'yazlik': 'YAZLIK',
      'kislik': 'KIŞLIK',
      'normal': 'NORMAL'
    };
    return typeMap[saleType?.toLowerCase()] || saleType?.toUpperCase() || 'BELİRTİLMEMİŞ';
  };

  useEffect(() => {
    fetchPeriods();
    const debouncedFetch = debounce(fetchReportData, 500);
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

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const response = await reportsAPI.getSalesSummary(filters);
      
      // Debug: Eski satış temsilcisi verilerinin dahil edilip edilmediğini kontrol et
      console.log('=== SALES SUMMARY DEBUG ===');
      console.log('Applied filters:', filters);
      console.log('Response data:', response.data);
      console.log('Historical data included:', response.data?.historicalDataIncluded);
      console.log('Active sales count:', response.data?.activeSales?.count);
      console.log('Cancelled sales count:', response.data?.cancelledSales?.count);
      console.log('Total sales count:', response.data?.successRateData?.totalSalesCount);
      console.log('Monthly sales count:', response.data?.monthlySales?.length);
      console.log('Monthly sales sample:', response.data?.monthlySales?.slice(0, 3));
      console.log('Sale type breakdown:', response.data?.saleTypeBreakdown);
      console.log('=== END DEBUG ===');
      
      setReportData(response.data);
      setError(null);
    } catch (error) {
      console.error('Sales summary fetch error:', error);
      setError('Satış özet raporu yüklenirken hata oluştu');
      toast.error('Satış özet raporu yüklenirken hata oluştu');
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
      period: ''
    });
  };

  const downloadReport = async () => {
    try {
      toast.info('Excel raporu hazırlanıyor...');
      
      const exportData = {
        type: 'excel',
        scope: 'all',
        ...filters
      };
      
      const response = await reportsAPI.exportExcel(exportData);
      
      // Blob'dan dosya oluştur
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      
      // Dosya adı oluştur
      const fileName = `satis_ozet_raporu_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Dosyayı indir
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Excel raporu başarıyla indirildi!');
      
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Excel raporu indirme sırasında hata oluştu');
    }
  };

  if (loading) {
    return <Loading variant="pulse" size="large" />;
  }

  if (error) {
    return (
      <Alert variant="danger">
        {error}
      </Alert>
    );
  }

  const { activeSales, cancelledSales, paymentTypeDistribution, monthlySales, successRateData } = reportData || {};

  // Prepare chart data
  const paymentChartData = paymentTypeDistribution?.map(item => ({
    name: item._id,
    value: item.count,
    amount: item.totalAmount
  })) || [];

  const monthlyChartData = monthlySales?.map(item => ({
    name: `${item._id.month}/${item._id.year}`,
    adet: item.count,
    aktiviteSatisFiyati: item.totalActivityPrice || 0
  })) || [];

  return (
    <div>
      {/* Historical Data Info */}
      {reportData?.historicalDataIncluded && (
        <Alert variant="info" className="mb-4">
          <strong>📊 Geçmiş Yıl Verileri Dahil:</strong> Bu rapor "Eski Satış Temsilcisi" verilerini günlük simülasyon olarak içermektedir. 
          Geçmiş yıl verileri her günü eşit olarak dağıtılmıştır.
        </Alert>
      )}
      
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
            <Col md={2}>
              <Form.Group>
                <Form.Label>&nbsp;</Form.Label>
                <div className="d-flex gap-2">
                  <Button variant="outline-secondary" onClick={fetchReportData}>
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

      {/* Summary Cards */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <div className="h3 text-success">{formatNumber(activeSales?.count || 0)}</div>
              <div className="text-muted">Aktif Satış</div>
              <div className="small text-muted">
                {formatCurrency(activeSales?.totalBasePrimPrice || 0)}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <div className="h3 text-danger">{formatNumber(cancelledSales?.count || 0)}</div>
              <div className="text-muted">İptal Edilen</div>
              <div className="small text-muted">
                {formatCurrency(cancelledSales?.totalBasePrimPrice || 0)}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <div className="h3 text-primary">{formatCurrency(activeSales?.totalPrimAmount || 0)}</div>
              <div className="text-muted">Toplam Prim</div>
              <div className="small text-muted">
                Ödenen: {formatNumber(activeSales?.paidPrims || 0)}
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <div className="h3 text-info">
                {activeSales?.count > 0 ? 
                  `%${(((activeSales.count) / (activeSales.count + (cancelledSales?.count || 0))) * 100).toFixed(1)}` : 
                  '%0'
                }
              </div>
              <div className="text-muted">Başarı Oranı</div>
              <div className="small text-muted">
                Ödenmemiş: {formatNumber(activeSales?.unpaidPrims || 0)}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        {/* Monthly Sales Chart */}
        <Col lg={8}>
          <Card className="mb-4">
            <Card.Header>
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0">Aylık Satış Trendi</h5>
                <Button variant="outline-primary" size="sm" onClick={downloadReport}>
                  <FiDownload className="me-2" />
                  İndir
                </Button>
              </div>
            </Card.Header>
            <Card.Body>
              {monthlyChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis 
                      yAxisId="left"
                      orientation="left"
                      tickFormatter={(value) => formatNumber(value)}
                      width={50}
                      label={{ value: 'Adet', angle: -90, position: 'insideLeft' }}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      tickFormatter={(value) => {
                        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                        return value;
                      }}
                      width={70}
                      label={{ value: 'Aktivite Satış Fiyatı', angle: 90, position: 'insideRight' }}
                    />
                    <Tooltip 
                      formatter={(value, name) => [
                        name === 'adet' ? formatNumber(value) : formatCurrency(value),
                        name === 'adet' ? 'Satış Adedi' : 'Aktivite Satış Fiyatı'
                      ]}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="adet" stroke="#8884d8" strokeWidth={2} name="adet" />
                    <Line yAxisId="right" type="monotone" dataKey="aktiviteSatisFiyati" stroke="#82ca9d" strokeWidth={2} name="aktiviteSatisFiyati" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-5">
                  <p className="text-muted">Grafik için yeterli veri bulunmuyor</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>


        {/* Payment Type Distribution */}
        <Col lg={4}>
          <Card className="mb-4">
            <Card.Header>
              <h5 className="mb-0">Ödeme Tipi Dağılımı</h5>
            </Card.Header>
            <Card.Body>
              {paymentChartData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={paymentChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {paymentChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatNumber(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  <Table size="sm" className="mt-3">
                    <tbody>
                      {paymentChartData.map((item, index) => (
                        <tr key={item.name}>
                          <td>
                            <Badge 
                              bg="light" 
                              text="dark"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            >
                              {item.name}
                            </Badge>
                          </td>
                          <td>{formatNumber(item.value)}</td>
                          <td>{formatCurrency(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </>
              ) : (
                <div className="text-center py-5">
                  <p className="text-muted">Veri bulunmuyor</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Detailed Stats */}
      <Card>
        <Card.Header>
          <h5 className="mb-0">Detaylı İstatistikler</h5>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <h6>Aktif Satışlar</h6>
              <Table size="sm">
                <tbody>
                  <tr>
                    <td>Toplam Satış Adedi:</td>
                    <td><strong>{formatNumber(activeSales?.count || 0)}</strong></td>
                  </tr>
                  <tr>
                    <td>Toplam Liste Fiyatı:</td>
                    <td><strong>{formatCurrency(activeSales?.totalListPrice || 0)}</strong></td>
                  </tr>
                  <tr>
                    <td>Toplam Aktivite Fiyatı:</td>
                    <td><strong>{formatCurrency(activeSales?.totalActivityPrice || 0)}</strong></td>
                  </tr>
                  <tr>
                    <td>Prim Hesaplama Tabanı:</td>
                    <td><strong>{formatCurrency(activeSales?.totalBasePrimPrice || 0)}</strong></td>
                  </tr>
                  <tr>
                    <td>Toplam Prim Tutarı:</td>
                    <td><strong className="text-success">{formatCurrency(activeSales?.totalPrimAmount || 0)}</strong></td>
                  </tr>
                </tbody>
              </Table>
            </Col>
            <Col md={6}>
              <h6>Satış Durumu</h6>
              <Table size="sm">
                <tbody>
                  {/* Satış Tipleri */}
                  {reportData?.saleTypeBreakdown && reportData.saleTypeBreakdown.length > 0 ? (
                    reportData.saleTypeBreakdown.map((saleType, index) => (
                        <tr key={index}>
                          <td>{formatSaleTypeName(saleType._id)} Satış:</td>
                        <td>
                          <strong className="text-primary">{formatNumber(saleType.count)}</strong>
                          <br />
                          <small className="text-muted">
                            Liste: {formatCurrency(saleType.totalListPrice || 0)}
                            <br />
                            Aktivite: {formatCurrency(saleType.totalActivityPrice || 0)}
                          </small>
                        </td>
                      </tr>
                    ))
                  ) : null}
                  
                  {/* İptal Bilgileri */}
                  <tr>
                    <td>İptal Edilen Satış:</td>
                    <td>
                      <strong className="text-danger">{formatNumber(cancelledSales?.count || 0)}</strong>
                      <br />
                      <small className="text-muted">
                        Liste: {formatCurrency(cancelledSales?.totalListPrice || 0)}
                        <br />
                        Aktivite: {formatCurrency(cancelledSales?.totalActivityPrice || 0)}
                      </small>
                    </td>
                  </tr>
                  
                  {/* Prim Durumu */}
                  <tr>
                    <td>Ödenen Prim:</td>
                    <td><strong className="text-success">{formatNumber(activeSales?.paidPrims || 0)}</strong></td>
                  </tr>
                  <tr>
                    <td>Ödenmemiş Prim:</td>
                    <td><strong className="text-warning">{formatNumber(activeSales?.unpaidPrims || 0)}</strong></td>
                  </tr>
                  
                  {/* Başarı Oranı */}
                  <tr>
                    <td>Başarı Oranı:</td>
                    <td>
                      <strong className="text-info">
                        %{successRateData?.successRate || 0}
                      </strong>
                      <br />
                      <small className="text-muted">
                        ({successRateData?.realSalesCount || 0} gerçek satış / {successRateData?.totalSalesCount || 0} toplam giriş)
                      </small>
                    </td>
                  </tr>
                </tbody>
              </Table>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </div>
  );
};

export default SalesSummaryReport;
