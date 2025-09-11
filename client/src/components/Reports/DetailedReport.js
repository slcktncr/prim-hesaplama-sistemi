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
import { toast } from 'react-toastify';
import { FiRefreshCw, FiFilter, FiDownload, FiList } from 'react-icons/fi';

import { reportsAPI, primsAPI, systemSettingsAPI } from '../../utils/api';
import { 
  formatCurrency, 
  formatDate,
  getSaleStatusBadgeClass,
  getPrimStatusBadgeClass,
  getPaymentTypeClass,
  debounce,
  getQuickDateFilters
} from '../../utils/helpers';
import Loading from '../Common/Loading';

const DetailedReport = () => {
  const [detailedData, setDetailedData] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [saleTypes, setSaleTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    period: '',
    status: 'aktif',
    saleType: '' // Satış türü filtresi
  });

  useEffect(() => {
    fetchPeriods();
    fetchSaleTypes();
    const debouncedFetch = debounce(fetchDetailedData, 500);
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

  const fetchSaleTypes = async () => {
    try {
      const response = await systemSettingsAPI.getSaleTypes();
      setSaleTypes(response.data || []);
    } catch (error) {
      console.error('Sale types fetch error:', error);
      // Hata durumunda varsayılan değerleri kullan
      setSaleTypes([]);
    }
  };

  const fetchDetailedData = async () => {
    try {
      setLoading(true);
      const response = await reportsAPI.getDetailedReport(filters);
      setDetailedData(response.data || []);
      setError(null);
    } catch (error) {
      console.error('Detailed report fetch error:', error);
      setError('Detaylı rapor yüklenirken hata oluştu');
      toast.error('Detaylı rapor yüklenirken hata oluştu');
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
      status: 'aktif',
      saleType: ''
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
      const fileName = `detayli_rapor_${new Date().toISOString().split('T')[0]}.xlsx`;
      
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
    return <Alert variant="danger">{error}</Alert>;
  }

  const totalSales = detailedData.length;
  const totalAmount = detailedData.reduce((sum, sale) => sum + (sale.basePrimPrice || 0), 0);
  const totalPrim = detailedData.reduce((sum, sale) => sum + (sale.primAmount || 0), 0);

  return (
    <div>
      {/* Filters */}
      <Card className="mb-4">
        <Card.Body>
          <Row>
            <Col md={2}>
              <Form.Group>
                <Form.Label>Başlangıç</Form.Label>
                <Form.Control
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                />
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label>Bitiş</Form.Label>
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
          
          <Row>
            <Col md={2}></Col>
            <Col md={2}></Col>
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
            <Col md={2}>
              <Form.Group>
                <Form.Label>Durum</Form.Label>
                <Form.Select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <option value="aktif">Aktif Satışlar</option>
                  <option value="iptal">İptal Edilenler</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label>Satış Türü</Form.Label>
                <Form.Select
                  value={filters.saleType}
                  onChange={(e) => handleFilterChange('saleType', e.target.value)}
                >
                  <option value="">Tüm Türler</option>
                  <option value="satis">Normal Satış</option>
                  <option value="kapora">Kapora</option>
                  {saleTypes.map(saleType => {
                    const lowerName = saleType.name.toLowerCase();
                    let mappedValue = lowerName.replace(/\s+/g, '').replace(/[^\w]/g, '').substring(0, 20);
                    
                    // Varsayılan türleri atla (zaten yukarıda tanımlanmış)
                    if (lowerName.includes('normal') || lowerName.includes('satış') || lowerName.includes('kapora')) {
                      return null;
                    }
                    
                    return (
                      <option key={saleType._id} value={mappedValue}>
                        {saleType.name}
                      </option>
                    );
                  })}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label>&nbsp;</Form.Label>
                <div className="d-flex gap-1">
                  <Button variant="outline-secondary" size="sm" onClick={fetchDetailedData}>
                    <FiRefreshCw />
                  </Button>
                  <Button variant="outline-primary" size="sm" onClick={clearFilters}>
                    <FiFilter />
                  </Button>
                </div>
              </Form.Group>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Summary */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <div className="h4 text-primary">{totalSales}</div>
              <div className="text-muted">Toplam Kayıt</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <div className="h4 text-info">{formatCurrency(totalAmount)}</div>
              <div className="text-muted">Toplam Tutar</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <div className="h4 text-success">{formatCurrency(totalPrim)}</div>
              <div className="text-muted">Toplam Prim</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <div className="h4 text-warning">
                {totalSales > 0 ? formatCurrency(totalAmount / totalSales) : '₺0'}
              </div>
              <div className="text-muted">Ortalama Tutar</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Detailed Table */}
      <Card>
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <h6 className="mb-0">
              <FiList className="me-2" />
              Detaylı Satış Raporu
            </h6>
            <div className="d-flex gap-2">
              <Badge bg="primary">{detailedData.length} kayıt</Badge>
              <Button variant="outline-success" size="sm" onClick={downloadReport}>
                <FiDownload className="me-2" />
                Excel İndir
              </Button>
            </div>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          {detailedData.length === 0 ? (
            <div className="text-center py-5">
              <p className="text-muted">Seçilen kriterlerde veri bulunamadı.</p>
            </div>
          ) : (
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              <Table responsive hover className="mb-0" size="sm">
                <thead className="sticky-top bg-light">
                  <tr>
                    <th>Sıra</th>
                    <th>Müşteri</th>
                    <th>Konum</th>
                    <th>Sözleşme No</th>
                    <th>Tarih</th>
                    <th>Fiyatlar</th>
                    <th>Prim</th>
                    <th>Durum</th>
                    <th>Temsilci</th>
                    <th>Dönem</th>
                  </tr>
                </thead>
                <tbody>
                  {detailedData.map((sale, index) => (
                    <tr key={sale._id}>
                      <td>{index + 1}</td>
                      <td>
                        <div>
                          <strong>{sale.customerName}</strong>
                          <div className="small text-muted">
                            Dönem: {sale.periodNo}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="small">
                          <div>Blok: {sale.blockNo}</div>
                          <div>Daire: {sale.apartmentNo}</div>
                        </div>
                      </td>
                      <td>
                        <code className="small">{sale.contractNo}</code>
                      </td>
                      <td>
                        <div className="small">
                          {formatDate(sale.saleDate)}
                        </div>
                      </td>
                      <td>
                        <div className="small">
                          <div>Liste: {formatCurrency(sale.listPrice)}</div>
                          <div>Aktivite: {formatCurrency(sale.activitySalePrice)}</div>
                          <Badge bg={getPaymentTypeClass(sale.paymentType)} size="sm">
                            {sale.paymentType}
                          </Badge>
                        </div>
                      </td>
                      <td>
                        <div>
                          <div className="fw-bold text-success small">
                            {formatCurrency(sale.primAmount)}
                          </div>
                          <Badge bg={getPrimStatusBadgeClass(sale.primStatus)} size="sm">
                            {sale.primStatus}
                          </Badge>
                        </div>
                      </td>
                      <td>
                        <Badge bg={getSaleStatusBadgeClass(sale.status)} size="sm">
                          {sale.status}
                        </Badge>
                        {sale.status === 'iptal' && sale.cancelledBy && (
                          <div className="small text-muted">
                            İptal: {sale.cancelledBy.name}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="small">
                          {sale.salesperson?.name}
                          {sale.transferredFrom && (
                            <div className="text-info">
                              Transfer: {sale.transferredFrom.name}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="small">
                          {sale.primPeriod?.name}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Export Info */}
      <Card className="mt-4">
        <Card.Body>
          <Row>
            <Col md={6}>
              <h6>Rapor Bilgileri</h6>
              <ul className="small mb-0">
                <li>Bu rapor seçilen kriterlerdeki tüm satış kayıtlarını gösterir</li>
                <li>Excel export ile tüm veriler indirilebilir</li>
                <li>Transfer edilmiş satışlar orijinal ve yeni temsilci bilgisiyle gösterilir</li>
                <li>İptal edilmiş satışlar iptal eden kişi bilgisiyle gösterilir</li>
              </ul>
            </Col>
            <Col md={6}>
              <h6>Filtreleme Seçenekleri</h6>
              <ul className="small mb-0">
                <li>Tarih aralığı ile filtreleme yapabilirsiniz</li>
                <li>Belirli bir döneme göre filtreleyebilirsiniz</li>
                <li>Aktif veya iptal edilmiş satışları seçebilirsiniz</li>
                <li>Admin kullanıcılar tüm temsilcilerin verilerini görebilir</li>
              </ul>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </div>
  );
};

export default DetailedReport;
