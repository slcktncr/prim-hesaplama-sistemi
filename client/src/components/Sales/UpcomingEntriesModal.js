import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  Button, 
  Table, 
  Badge, 
  Form, 
  Alert,
  Spinner,
  Card,
  Row,
  Col
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import { 
  FiCalendar, 
  FiUser, 
  FiPhone, 
  FiMapPin, 
  FiRefreshCw,
  FiClock,
  FiDownload
} from 'react-icons/fi';

import { salesAPI } from '../../utils/api';
import { formatCurrency } from '../../utils/helpers';

const UpcomingEntriesModal = ({ show, onHide }) => {
  const [upcomingData, setUpcomingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [daysAhead, setDaysAhead] = useState(7);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (show) {
      fetchUpcomingEntries();
    }
  }, [show, daysAhead]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchUpcomingEntries = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await salesAPI.getUpcomingEntries(daysAhead);
      
      if (response.data.success) {
        setUpcomingData(response.data.data);
        console.log('📅 Upcoming entries loaded:', response.data.data);
      } else {
        throw new Error(response.data.message || 'Veri yüklenemedi');
      }
      
    } catch (error) {
      console.error('Upcoming entries fetch error:', error);
      setError(error.response?.data?.message || 'Yaklaşan girişler yüklenirken hata oluştu');
      toast.error('Yaklaşan girişler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const getDateLabel = (dateStr) => {
    const today = new Date();
    const [day, month] = dateStr.split('/').map(Number);
    const entryDate = new Date(today.getFullYear(), month - 1, day);
    
    const diffTime = entryDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Bugün';
    if (diffDays === 1) return 'Yarın';
    if (diffDays === -1) return 'Dün';
    if (diffDays > 0) return `${diffDays} gün sonra`;
    if (diffDays < 0) return `${Math.abs(diffDays)} gün önce`;
    
    return dateStr;
  };

  const getDateVariant = (dateStr) => {
    const today = new Date();
    const [day, month] = dateStr.split('/').map(Number);
    const entryDate = new Date(today.getFullYear(), month - 1, day);
    
    const diffTime = entryDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'danger';   // Bugün - Kırmızı
    if (diffDays === 1) return 'warning';  // Yarın - Sarı
    if (diffDays <= 3) return 'info';      // 3 gün içinde - Mavi
    return 'secondary';                     // Daha uzak - Gri
  };

  const exportToCSV = () => {
    if (!upcomingData || upcomingData.totalCount === 0) {
      toast.warning('Export edilecek veri bulunamadı');
      return;
    }

    // CSV başlıkları
    const headers = [
      'Giriş Tarihi',
      'Müşteri Adı',
      'Telefon',
      'Konum',
      'Liste Fiyatı',
      'Aktivite Fiyatı',
      'Temsilci',
      'Sözleşme No',
      'Satış Tarihi',
      'Kapora Tarihi'
    ];

    // Tüm satışları tek bir diziye topla
    const allSales = [];
    upcomingData.sortedDates.forEach(dateStr => {
      upcomingData.groupedByDate[dateStr].forEach(sale => {
        allSales.push({
          entryDate: dateStr,
          customerName: sale.customerName || '',
          phone: sale.customerPhone || '',
          location: `${sale.blockNo || ''}/${sale.apartmentNo || ''}`,
          listPrice: sale.listPrice || 0,
          activityPrice: sale.activitySalePrice || 0,
          salesperson: sale.salesperson?.name || '',
          contractNo: sale.contractNo || '',
          saleDate: sale.saleDate ? new Date(sale.saleDate).toLocaleDateString('tr-TR') : '',
          kaporaDate: sale.kaporaDate ? new Date(sale.kaporaDate).toLocaleDateString('tr-TR') : ''
        });
      });
    });

    // CSV içeriği oluştur
    const csvContent = [
      headers.join(','),
      ...allSales.map(sale => [
        sale.entryDate,
        `"${sale.customerName}"`,
        sale.phone,
        sale.location,
        sale.listPrice,
        sale.activityPrice,
        `"${sale.salesperson}"`,
        sale.contractNo,
        sale.saleDate,
        sale.kaporaDate
      ].join(','))
    ].join('\n');

    // BOM ekle (Türkçe karakterler için)
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Dosya adı oluştur
    const today = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
    const filename = `yaklasan-girisler-${daysAhead}-gun-${today}.csv`;
    
    // İndir
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`${allSales.length} kayıt CSV olarak indirildi`);
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          <FiCalendar className="me-2" />
          Yaklaşan Girişler
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        {/* Filtreler */}
        <Row className="mb-3">
          <Col md={6}>
            <Form.Group>
              <Form.Label>Kaç gün ilerisi</Form.Label>
              <Form.Select 
                value={daysAhead} 
                onChange={(e) => setDaysAhead(parseInt(e.target.value))}
                disabled={loading}
              >
                <option value={3}>3 gün</option>
                <option value={7}>1 hafta</option>
                <option value={14}>2 hafta</option>
                <option value={30}>1 ay</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>&nbsp;</Form.Label>
              <div className="d-flex gap-2">
                <Button 
                  variant="outline-primary" 
                  onClick={fetchUpcomingEntries}
                  disabled={loading}
                >
                  <FiRefreshCw className={`me-2 ${loading ? 'spin' : ''}`} />
                  Yenile
                </Button>
                <Button 
                  variant="outline-success" 
                  onClick={exportToCSV}
                  disabled={loading || !upcomingData || upcomingData.totalCount === 0}
                  title="Listeyi CSV olarak indir"
                >
                  <FiDownload className="me-2" />
                  Export
                </Button>
              </div>
            </Form.Group>
          </Col>
        </Row>

        {/* Loading */}
        {loading && (
          <div className="text-center py-4">
            <Spinner animation="border" variant="primary" />
            <div className="mt-2">Yaklaşan girişler yükleniyor...</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <Alert variant="danger">
            <strong>Hata:</strong> {error}
          </Alert>
        )}

        {/* Results */}
        {!loading && !error && upcomingData && (
          <>
            {upcomingData.totalCount === 0 ? (
              <Alert variant="info">
                <FiClock className="me-2" />
                Önümüzdeki {daysAhead} gün içinde giriş yapacak müşteri bulunmamaktadır.
              </Alert>
            ) : (
              <>
                {/* Summary */}
                <Alert variant="success">
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <strong>{upcomingData.totalCount} müşteri</strong> önümüzdeki {daysAhead} gün içinde giriş yapacak.
                    </div>
                    <div className="text-muted small">
                      <FiDownload className="me-1" />
                      Export butonuna tıklayarak CSV olarak indirebilirsiniz
                    </div>
                  </div>
                </Alert>

                {/* Grouped by Date */}
                {upcomingData.sortedDates.map(dateStr => (
                  <Card key={dateStr} className="mb-3">
                    <Card.Header>
                      <h6 className="mb-0">
                        <Badge bg={getDateVariant(dateStr)} className="me-2">
                          {dateStr}
                        </Badge>
                        {getDateLabel(dateStr)}
                        <Badge bg="secondary" className="ms-2">
                          {upcomingData.groupedByDate[dateStr].length} müşteri
                        </Badge>
                      </h6>
                    </Card.Header>
                    <Card.Body>
                      <Table responsive size="sm">
                        <thead>
                          <tr>
                            <th>Müşteri</th>
                            <th>Telefon</th>
                            <th>Konum</th>
                            <th>Satış Türü</th>
                            <th>Tutar</th>
                            <th>Temsilci</th>
                          </tr>
                        </thead>
                        <tbody>
                          {upcomingData.groupedByDate[dateStr].map(sale => (
                            <tr key={sale._id}>
                              <td>
                                <div className="d-flex align-items-center">
                                  <FiUser className="me-2 text-muted" />
                                  <div>
                                    <strong>{sale.customerName}</strong>
                                    {sale.phone && (
                                      <div className="small text-primary fw-bold">
                                        📞 {sale.phone}
                                      </div>
                                    )}
                                    {sale.contractNo && (
                                      <div className="small text-muted">
                                        Sözleşme: {sale.contractNo}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td>
                                {sale.phone ? (
                                  <div className="d-flex align-items-center">
                                    <FiPhone className="me-2 text-muted" />
                                    <a href={`tel:${sale.phone}`} className="text-decoration-none">
                                      {sale.phone}
                                    </a>
                                  </div>
                                ) : (
                                  <span className="text-muted">-</span>
                                )}
                              </td>
                              <td>
                                <div className="d-flex align-items-center">
                                  <FiMapPin className="me-2 text-muted" />
                                  <div className="small">
                                    Blok {sale.blockNo}<br />
                                    Daire {sale.apartmentNo}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <Badge bg="info">
                                  {sale.saleType === 'satis' ? 'Satış' : 
                                   sale.saleType === 'kapora' ? 'Kapora' :
                                   sale.saleType === 'manuel' ? 'Manuel' :
                                   sale.saleType}
                                </Badge>
                              </td>
                              <td>
                                {sale.listPrice ? (
                                  <div className="small">
                                    <div>{formatCurrency(sale.listPrice)}</div>
                                    {sale.activitySalePrice && (
                                      <div className="text-muted">
                                        Aktivite: {formatCurrency(sale.activitySalePrice)}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted">-</span>
                                )}
                              </td>
                              <td>
                                <div className="small">
                                  {sale.salesperson?.name || 'Bilinmiyor'}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </Card.Body>
                  </Card>
                ))}
              </>
            )}
          </>
        )}
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Kapat
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default UpcomingEntriesModal;
